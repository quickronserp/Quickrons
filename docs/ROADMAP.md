# Quickrons — Engineering Roadmap

## Phase 0 — Foundation (Weeks 1–4)
**Goal:** working dev environment, backend skeleton, schema migrated, smoke-tested locally.

- ✅ Architecture document
- ✅ Prisma schema covering users / partners / menu / orders / wallet / payments / riders / settlements / sessions / OTPs / notifications / referrals / zones / addresses
- ✅ Backend monolith scaffold (Node + Express + Prisma + Redis + Socket.io + BullMQ)
- ✅ Auth module (phone OTP → JWT + refresh)
- ✅ Orders module with FSM (PLACED → DELIVERED + cancel/refund branches)
- ✅ Wallet module with append-only ledger
- ✅ Payments module with Razorpay create-order + webhook verification
- ✅ Realtime socket.io setup with role-based rooms
- ✅ Docker + docker-compose for local dev
- ✅ Admin dashboard scaffold (Next.js)
- ✅ Mobile app: Kerala-localized mock data, Malayalam i18n scaffold, Ippol/Pre-order tabs
- ⏳ Partner module CRUD (next: 2 days)
- ⏳ Menu module + daily-quantity caps (next: 2 days)
- ⏳ Riders module + manual assignment endpoints (next: 2 days)

## Phase 1 — Closed beta in Perinthalmanna (Weeks 5–10)
**Goal:** 50 invite-only customers, 5 home-makers, 2 restaurants, 4 riders. Real money. Real food.

- Phone OTP login flow polished (Malayalam UX strings)
- Customer flow: browse → cart → checkout → UPI/COD → live tracking via WhatsApp
- Partner app: accept order → mark cooking → mark ready
- Rider app: accept assignment → pickup OTP → delivery OTP
- Admin: live order feed, manual rider dispatch, partner on/off
- Wallet: customer-side credits visible, refunds tested end-to-end
- Razorpay UPI live-mode keys
- WhatsApp Business Cloud API templates approved (4 templates: order placed, cooking, picked up, delivered)
- Settlements: weekly partner payouts via NEFT, rider weekly payouts
- Cancellation policy + refund flows hardened
- Sentry + CloudWatch + basic Grafana dashboard

## Phase 2 — Public launch Perinthalmanna (Months 3–6)
**Goal:** 100–300 orders/day, 20+ home-makers, 8+ restaurants, 12+ riders.

- Ratings + reviews
- WhatsApp-share referral with credit on both sides
- Saved addresses with map pin
- Order history with re-order
- Mapbox live rider tracking on customer app
- Sadhya / Iftar / event catering booking flow
- Partner self-service menu editing in app
- Auto-assignment v1 (nearest free rider)
- Daily reconciliation report (auto email to founders)

## Phase 3 — Corridor expansion (Months 6–12)
**Goal:** Perinthalmanna + Malappuram + Edathanattukara extension. 500–800 orders/day.

- Multi-zone support (zone whitelist enforced server-side)
- Subscription tiffin (auto-renew daily lunch from chosen home-maker)
- Loyalty (Quickrons Coins ledger as a sub-ledger of wallet)
- Inventory dashboards for partners
- Shift-based rider scheduling
- Razorpay Route for split-payment automated settlement
- Push notifications (Expo)
- A/B testing harness (basic)

## Phase 4 — Multi-corridor + scale prep (Months 12–18)
**Goal:** ready for 5,000 orders/day, ready to add a second district.

- Extract notifications service
- Postgres read replica + CQRS for order list views
- Rider GPS to Redis Streams + Go consumer
- iOS + Android separate builds for partner and rider (if app review pushes back)
- Multi-language: add Tamil for border districts
- Quickrons Plus subscription (Phase 1 feature postponed deliberately)

---

## What is NOT in scope yet (and we will say no to all of these)

- Web ordering site (mobile-first; web only when CAC math demands it)
- Drone / dark-store ops
- Nutrition tracking, calorie counters
- ERP for partners
- Loyalty NFTs, tokens, blockchain anything
- AI-driven personalization (we don't have the data yet)
- Multi-vendor cart in one order
- Bus / parcel delivery side-hustles
- A standalone Forra Foods app (Forra is *inside* Quickrons by design)

These show up on every food-delivery roadmap and they all delay launch. We will revisit them only after in-zone breakeven.
