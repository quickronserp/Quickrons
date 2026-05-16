# Quickrons — System Architecture (Phase 1)

**Author:** Quickrons engineering · **Status:** v1.0, target launch Perinthalmanna 2026 Q3
**Mandate:** ship a Kerala-corridor MVP that handles 1,000 orders/day reliably on a ₹15K/month infra spend, while being structured for 100K orders/day without rewrite.

---

## 1. Architectural posture

We optimize for three things, in this order: **operational reliability**, **iteration speed**, **cost**. We do not optimize for theoretical scale, microservice purity, or résumé-driven framework choices.

The system is a **modular monolith** today. Every module (auth, orders, wallet, payments, riders, partners, menu, notifications) is a self-contained directory inside one Node.js service with clear public interfaces. When any single module's load profile diverges (most likely candidates: notifications and rider GPS ingest), it can be lifted into its own service without touching callers — they consume the module through an interface, not through internal coupling.

We will graduate to a service split only when one of these three triggers fires: (a) deploy frequency on a module conflicts with the rest of the system, (b) a module's resource footprint diverges by an order of magnitude, or (c) a module needs a different runtime (e.g. Go for high-throughput rider GPS).

---

## 2. System diagram

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│  Customer (Expo)    │    │  Rider (Expo)       │    │  Partner (Expo)     │
│  iOS / Android      │    │  iOS / Android      │    │  iOS / Android      │
└──────────┬──────────┘    └──────────┬──────────┘    └──────────┬──────────┘
           │ HTTPS+WSS               │ HTTPS+WSS               │ HTTPS+WSS
           └──────────────┬──────────┴───────────────┬──────────┘
                          │                          │
                  ┌───────▼──────────────────────────▼───────┐
                  │      Cloudflare (DNS, CDN, WAF, R2)      │
                  └───────────────────┬──────────────────────┘
                                      │
                           ┌──────────▼──────────┐
                           │  AWS ALB (Mumbai)   │
                           └──────────┬──────────┘
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
  ┌───────────▼───────────┐ ┌─────────▼─────────┐  ┌──────────▼──────────┐
  │  API (Node.js)        │ │  Realtime (SIO)   │  │  Admin web (Next)   │
  │  ECS Fargate × 2      │ │  ECS Fargate × 1  │  │  Vercel             │
  └───────────┬───────────┘ └─────────┬─────────┘  └──────────┬──────────┘
              │                       │                       │
              └───────────────────────┼───────────────────────┘
                                      │
              ┌───────────────────────┼─────────────────────────────┐
              │                       │                             │
  ┌───────────▼───────────┐ ┌─────────▼─────────┐       ┌───────────▼─────────┐
  │  PostgreSQL 16 (RDS)  │ │  Redis (Elasticache)│      │  S3 (object store)  │
  │  Primary + read replica│ │  pub/sub + queues  │      │  KYC docs, images   │
  └───────────────────────┘ └─────────┬─────────┘       └─────────────────────┘
                                      │
                          ┌───────────▼────────────┐
                          │  BullMQ workers        │
                          │  ECS Fargate × 1       │
                          │  - rider-assign        │
                          │  - whatsapp-dispatch   │
                          │  - settlements         │
                          └────────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
  ┌───────────▼─────────┐ ┌───────────▼─────────┐ ┌──────────▼──────────┐
  │  WhatsApp Cloud API │ │  MSG91 (OTP SMS)    │ │  Razorpay (UPI)     │
  └─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

**Phase 1 baseline cost:** ~₹14,500/month (1× t3.medium API, 1× t3.small realtime, 1× t3.small worker, db.t3.medium RDS, cache.t3.micro Redis, S3 + transfer, Cloudflare free tier, Razorpay no monthly fee).

---

## 3. Tech stack — and why

**Backend: Node.js 20 + Express 4 + Prisma 5.** Node because every dev we'll hire in Kerala/India already knows it. Express because it's boring, predictable, and battle-tested. Prisma because schema-first migrations + type-safe queries pay back tenfold in MVP velocity, and we can drop to raw SQL anywhere it matters (we will, in the wallet ledger). Not Nest.js — too much ceremony for our team size.

**Database: PostgreSQL 16 (Amazon RDS).** Single Postgres instance with one read replica from day one. Postgres handles JSONB for event payloads, GIST indexes for geo queries, partial indexes for hot paths, and a transactional wallet ledger without us reaching for a separate event store.

**Cache + queues: Redis 7 (Elasticache cache.t3.micro).** Used for: (a) BullMQ job queues, (b) Socket.io adapter for horizontal scale, (c) OTP rate-limiting buckets, (d) menu cache (90s TTL).

**Realtime: Socket.io.** One process bound to a separate ECS service so its long-lived connections don't fight API request-response traffic for memory. Rooms: `user:<id>`, `order:<id>`, `partner:<id>`, `rider:<id>`, `zone:<id>`, `admin`.

**Background jobs: BullMQ.** Three workers: rider-assignment, whatsapp/SMS dispatch, periodic settlements.

**Mobile: Expo SDK 50 + React Native 0.73 + React Navigation 6.** One codebase, three roles via a runtime role switch in the same app. We'll split into separate apps (Customer, Rider, Partner) only after Phase 2 if app-store reviewers push back or the rider/partner UX diverges enough.

**Admin: Next.js 14 (app router) + Tailwind.** Deployed on Vercel. SSR + server actions for fast operator UX; can pull from Postgres directly via the same Prisma client.

**Auth:** Phone OTP via MSG91, JWT access tokens (15-min) + opaque refresh tokens (30-day) stored hashed in `sessions`. Role claims embedded in access token. Refresh rotation on every use.

**Payments:** Razorpay Standard Checkout for UPI, cards, COD-tracked. Webhook-driven order completion — never trust client confirmation.

**Notifications:** WhatsApp Business Cloud API for order updates (free tier covers Phase 1). MSG91 for OTPs. Expo Push for in-app notifications, deferred to Phase 2.

**Maps:** Mapbox SDK on mobile (50K free loads/month), MapLibre GL on admin web. Geocoding via Nominatim (free) for Phase 1; switch to Mapbox geocoding when load justifies it.

**Storage:** S3 for KYC documents, dish images, kitchen photos. Served through Cloudflare for CDN.

**Observability:** Pino → CloudWatch logs, Sentry for errors (free tier), simple `/metrics` Prometheus endpoint scraped by Grafana Cloud (free tier). No Datadog yet.

---

## 4. Order lifecycle — finite state machine

This is the most important piece of the system. Every order moves through the FSM below, every transition writes to `order_events`, every transition triggers exactly the right notifications and wallet ledger entries.

```
                                         ┌──────────────┐
                                         │   CANCELLED  │ ← any state before PICKED_UP
                                         └──────────────┘
                                                ▲
                                                │
PLACED ─→ CONFIRMED ─→ PREPARING ─→ READY_FOR_PICKUP ─→ PICKED_UP ─→ OUT_FOR_DELIVERY ─→ DELIVERED
   │           │           │              │                │              │                  │
   │           │           │              │                │              │                  └─→ COMPLETED (terminal)
   │           │           │              │                │              │
   └───────────┴───────────┴──────────────┴────────────────┘              └─→ FAILED (terminal, with auto-refund)
                                                                              ↓
                                                                         REFUNDED
```

**Invariants enforced by the FSM module (`orders/orders.fsm.js`):**
1. State transitions are validated against an allow-list — illegal transitions throw `InvalidStateTransitionError`.
2. Every transition is wrapped in a single Postgres transaction that updates `orders.status`, appends to `order_events`, and (where applicable) writes wallet ledger entries.
3. Each transition fires a single domain event onto Redis pub/sub, which Socket.io and the WhatsApp worker subscribe to.

**Wallet entries by transition:**
- `PLACED` (online payment): `hold` on customer wallet/payment → `wallet_transactions` HOLD entry.
- `DELIVERED`: `release` to platform + partner credit + rider credit, all in one DB tx.
- `CANCELLED` (by customer pre-CONFIRMED): release hold → refund credit to customer wallet (or refund initiated to source if Razorpay-paid).
- `CANCELLED` (by partner post-CONFIRMED): release hold → full refund + small inconvenience credit (₹15) to customer wallet.
- `FAILED` (rider could not deliver): full refund + customer support flag.

---

## 5. Wallet ledger — the rules we never break

The wallet is the system's general ledger. It must be correct, auditable, and survive any future migration. Rules:

**Append-only.** No row in `wallet_transactions` is ever updated or deleted. Adjustments are made by writing a new compensating entry. Period.

**Double-entry semantics.** Every economic event writes a matched pair (or set) of entries summing to zero across the platform. A ₹400 customer charge writes: `customer.wallet -400` (debit), `platform.wallet +400` (credit).

**Balance is computed, then cached.** `wallets.balance_paise` is a denormalized cache, recomputed from the ledger on every transaction inside a `SELECT … FOR UPDATE` row lock. We can rebuild any wallet's balance from scratch by summing its ledger entries.

**Paise everywhere.** All monetary amounts are stored as `BigInt` paise. Never floats. Never rupees-as-decimals.

**Idempotency via reference keys.** Every external trigger (a Razorpay webhook, a settlement job) carries a unique idempotency key written into `wallet_transactions.idempotency_key` with a unique constraint. Re-delivery is a no-op.

**Settlement = a separate ledger.** Partner and rider payouts are written to `settlements`, which records the net amount paid out and a snapshot of the contributing wallet entries. The wallet ledger is the source of truth; settlements are the payout record.

The implementation lives in `backend/src/modules/wallet/wallet.service.js` and uses `prisma.$transaction(async (tx) => …)` with explicit row locks on the wallet rows being touched.

---

## 6. Realtime — what's pushed where

Socket.io rooms and the events they receive:

| Room              | Subscribers              | Events received                                                  |
|-------------------|--------------------------|------------------------------------------------------------------|
| `user:<id>`       | The user themselves       | `wallet.updated`, `notification.new`                              |
| `order:<id>`      | Customer + rider + partner| `order.transition`, `rider.location` (post-pickup), `order.eta`   |
| `partner:<id>`    | Partner staff             | `order.placed`, `order.cancelled`, `partner.rating`               |
| `rider:<id>`      | The rider                 | `order.assigned`, `order.unassigned`                              |
| `zone:<z>`        | Admin dashboard          | All order/rider events in that zone (firehose)                    |
| `admin`           | Operators                 | Cross-zone alerts, SLA breaches                                   |

Auth: socket connection requires a valid JWT in `auth.token`; on connect, the server joins the socket to the rooms permitted by the token's role + ID.

Rider GPS: rider app pings `rider.location` every 10s while on an active delivery. Server fans out only to the corresponding `order:<id>` room — never broadcast.

---

## 7. Security baseline (Phase 1)

JWT signing with rotating keys (kid header) and 15-minute access token lifetime. Refresh tokens are opaque, stored hashed (`bcrypt`) in the `sessions` table, and rotated on every use. All `/admin/*` routes require role `admin` or `ops`. All inter-service comms inside the VPC.

PII encryption at rest on RDS (AWS-managed KMS). KYC documents encrypted with envelope encryption in S3 (per-object key encrypted with KMS CMK). Razorpay webhook signature verified on every callback; reject any callback not bearing a valid HMAC.

OTP rate limits: 5 OTP requests per phone per hour, 3 verification attempts per OTP, lockout 15 minutes after 3 failed verifications. All buckets in Redis.

Logs scrub: phone numbers masked except last 4 digits in non-error logs; full numbers only in error logs and tagged for short retention.

---

## 8. Deployment + CI

Single GitHub repo (monorepo), three deployable units: `backend`, `admin`, `mobile`. Pnpm workspaces.

**CI:** GitHub Actions per package. `lint → typecheck → test → build`. Backend integration tests run against a Postgres + Redis docker-compose service.

**CD:**
- `backend` → Docker image to AWS ECR → ECS Fargate rolling deploy.
- `admin` → Vercel auto-deploy on `main`.
- `mobile` → EAS Build for OTA-eligible JS-only changes (instant), full builds for native bumps (manual).

**Environments:** `dev` (single shared instance), `staging` (mirrors prod with anonymized data), `prod`. No per-developer cloud envs; local dev is `docker-compose up`.

---

## 9. Scaling plan (when we hit each ceiling)

| Metric                | Phase 1 cap | Action when crossed |
|-----------------------|-------------|---------------------|
| ~1,000 orders/day     | sized for   | nothing             |
| ~5,000 orders/day     |             | scale API horizontally (2→4 ECS tasks), add Postgres read replica |
| ~20,000 orders/day    |             | extract `notifications` and `rider GPS` into own services, partition orders by zone in DB |
| ~50,000 orders/day    |             | introduce CQRS for order read models, move rider GPS to a Redis Streams + Go consumer |
| > 100,000 orders/day  |             | shard Postgres by zone, multi-region for South India |

---

## 10. Known unknowns + risks

The biggest is Razorpay UPI failure rates in tier-3 — we instrument a `payment_failure` metric from day one and surface it on the admin dashboard. Second is rider supply elasticity — we model rider unit economics weekly and rebalance base pay quickly. Third is Postgres single-AZ failure during launch — we run RDS Multi-AZ from day one (extra ~₹2K/month, worth it).
