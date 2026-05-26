# Quickrons — Phase 2 Schema Delta (Task 1)

**Scope:** Prisma schema only. No services, controllers, routes, or frontend.
**Source of truth:** Phase 2 architecture plan (Menu → Order → Rider → Delivery, single-corridor closed-beta).
**Invariants preserved:** BigInt paise on the ledger, append-only `WalletTransaction`, FSM-driven `Order.status`, snapshot pricing on `OrderItem`, single-partner orders, zone-gated supply.

The full schema is also written side-by-side as `backend/prisma/schema.phase2.prisma` so you can diff it against current `schema.prisma` before swapping.

---

## 1. Final `schema.prisma`

```prisma
// ─────────────────────────────────────────────────────────────────────────────
// Quickrons — Phase 2 MVP schema (single source of truth)
//
// Locked invariants (do not violate):
//   • BigInt paise on every wallet/ledger column. Int paise OK on per-row money.
//   • Append-only WalletTransaction — never updated, never deleted.
//   • FSM-validated transitions in the service layer (Order, KYC, TamperSeal).
//   • Modular monolith — one schema, one Prisma client.
//   • Kerala-first closed-beta — Zone gates Address + Partner + Order.
//   • Order is single-partner (no multi-vendor cart) — partnerId is required.
//   • Snapshot pricing on OrderItem — pricePaise frozen at order placement.
// ─────────────────────────────────────────────────────────────────────────────

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ────────────────────────────────────────────────────────────────────

enum UserRole {
  CUSTOMER
  RIDER
  PARTNER
  ADMIN
}

enum AddressLabel {
  HOME
  WORK
  OTHER
}

enum PartnerCategory {
  HOME_MAKER
  RESTAURANT
  CATERER
  FORRA_SUPPLIER
}

enum VehicleType {
  BIKE
  SCOOTER
  BICYCLE
  EV_BIKE
}

enum KycStatus {
  PENDING
  IN_REVIEW
  APPROVED
  REJECTED
  SUSPENDED
}

enum ApplicationStatus {
  PENDING
  APPROVED
  REJECTED
}

enum OrderStatus {
  PLACED
  CONFIRMED
  PREPARING
  READY_FOR_PICKUP
  PICKED_UP
  OUT_FOR_DELIVERY
  DELIVERED
  CANCELLED
  FAILED
}

enum PaymentMethod {
  RAZORPAY
  COD
  WALLET
}

enum PaymentStatus {
  PENDING
  AUTHORIZED
  CAPTURED
  FAILED
  REFUNDED
  PARTIALLY_REFUNDED
}

enum TamperSealStatus {
  NONE
  SEALED
  VERIFIED_BY_RIDER
  VERIFIED_BY_CUSTOMER
  BROKEN
}

enum WalletOwnerType {
  PARTNER
  RIDER
}

enum WalletDirection {
  CREDIT
  DEBIT
}

enum WalletTxnKind {
  ORDER_HOLD
  ORDER_RELEASE
  ORDER_PAYOUT
  REFUND
  ADJUSTMENT
  SETTLEMENT_PAID
  MANUAL_CREDIT
  MANUAL_DEBIT
}

enum NotificationChannel {
  WHATSAPP
  SMS
  PUSH
  EMAIL
}

enum NotificationStatus {
  QUEUED
  SENT
  DELIVERED
  READ
  FAILED
}

// ─── Identity ─────────────────────────────────────────────────────────────────

model User {
  id               String   @id @default(cuid())
  phone            String   @unique
  name             String?
  email            String?  @unique
  role             UserRole @default(CUSTOMER)
  isActive         Boolean  @default(true)
  defaultAddressId String?  @unique
  lastSeenAt       DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  defaultAddress Address?       @relation("UserDefaultAddress", fields: [defaultAddressId], references: [id], onDelete: SetNull)
  addresses      Address[]      @relation("UserAddresses")
  favorites      Favorite[]
  orders         Order[]        @relation("CustomerOrders")
  orderEvents    OrderEvent[]
  partner        Partner?
  rider          Rider?
  notifications  Notification[]

  @@index([role])
  @@index([createdAt])
}

model OTP {
  id         String    @id @default(cuid())
  phone      String
  code       String
  consumedAt DateTime?
  expiresAt  DateTime
  createdAt  DateTime  @default(now())

  @@index([phone, createdAt])
  @@index([expiresAt])
}

// ─── Geography ────────────────────────────────────────────────────────────────

model Zone {
  code       String   @id
  nameEn     String
  nameMl     String
  district   String
  pincodes   String[]
  isActive   Boolean  @default(false)
  centerLat  Decimal? @db.Decimal(10, 7)
  centerLng  Decimal? @db.Decimal(10, 7)
  radiusKm   Decimal? @db.Decimal(5, 2)
  launchedAt DateTime?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  addresses Address[]
  partners  Partner[]
  riders    Rider[]
  orders    Order[]

  @@index([isActive])
  @@index([district])
}

model Address {
  id         String       @id @default(cuid())
  userId     String
  label      AddressLabel @default(HOME)
  recipient  String
  phone      String
  line1      String
  line2      String?
  landmark   String?
  city       String
  district   String
  pincode    String
  zoneCode   String?
  lat        Decimal?     @db.Decimal(10, 7)
  lng        Decimal?     @db.Decimal(10, 7)
  notes      String?
  isDefault  Boolean      @default(false)
  archivedAt DateTime?
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt

  user                User    @relation("UserAddresses", fields: [userId], references: [id], onDelete: Cascade)
  zone                Zone?   @relation(fields: [zoneCode], references: [code], onDelete: SetNull)
  defaultedByUser     User?   @relation("UserDefaultAddress")
  ordersDeliveredHere Order[]

  @@index([userId, archivedAt])
  @@index([zoneCode])
  @@index([pincode])
}

// ─── Onboarding intake (raw applications) ─────────────────────────────────────

model RiderApplication {
  id          String            @id @default(cuid())
  fullName    String
  phone       String
  vehicleType String
  location    String
  status      ApplicationStatus @default(PENDING)
  reviewedAt  DateTime?
  reviewerId  String?
  notes       String?
  createdAt   DateTime          @default(now())

  @@index([phone])
  @@index([status, createdAt])
}

model PartnerApplication {
  id         String            @id @default(cuid())
  brand      String
  ownerName  String
  phone      String
  category   String
  location   String
  status     ApplicationStatus @default(PENDING)
  reviewedAt DateTime?
  reviewerId String?
  notes      String?
  createdAt  DateTime          @default(now())

  @@index([phone])
  @@index([status, createdAt])
}

// ─── Partner (post-approval) ──────────────────────────────────────────────────

model Partner {
  id               String          @id @default(cuid())
  userId           String          @unique
  brand            String
  ownerName        String
  category         PartnerCategory
  kycStatus        KycStatus       @default(PENDING)
  isActive         Boolean         @default(false)
  zoneCode         String
  commissionBps    Int             @default(1500)
  fssaiNumber      String?
  gstNumber        String?
  bankAccountName  String?
  bankAccountLast4 String?
  ifscCode         String?
  payoutNotes      String?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  user      User       @relation(fields: [userId], references: [id], onDelete: Restrict)
  zone      Zone       @relation(fields: [zoneCode], references: [code], onDelete: Restrict)
  menuItems MenuItem[]
  orders    Order[]
  wallet    Wallet?

  @@index([zoneCode, isActive])
  @@index([kycStatus])
  @@index([category])
}

// ─── Rider (post-approval) ────────────────────────────────────────────────────

model Rider {
  id            String      @id @default(cuid())
  userId        String      @unique
  fullName      String
  vehicleType   VehicleType
  vehicleNumber String?
  licenseNumber String?
  kycStatus     KycStatus   @default(PENDING)
  isOnline      Boolean     @default(false)
  isActive      Boolean     @default(true)
  zoneCode      String
  currentLat    Decimal?    @db.Decimal(10, 7)
  currentLng    Decimal?    @db.Decimal(10, 7)
  lastPingAt    DateTime?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  user   User    @relation(fields: [userId], references: [id], onDelete: Restrict)
  zone   Zone    @relation(fields: [zoneCode], references: [code], onDelete: Restrict)
  orders Order[]
  wallet Wallet?

  @@index([zoneCode, isOnline, isActive])
  @@index([kycStatus])
}

// ─── Menu (partner-owned) ─────────────────────────────────────────────────────

model MenuItem {
  id                     String   @id @default(cuid())
  partnerId              String
  name                   String
  description            String
  pricePaise             Int
  isVeg                  Boolean  @default(true)
  signature              Boolean  @default(false)
  active                 Boolean  @default(true)
  sortOrder              Int      @default(0)
  category               String?
  imageUrl               String?
  dailyQuantityLimit     Int?
  dailyQuantityRemaining Int?
  servingStartMinutes    Int?
  servingEndMinutes      Int?
  lastResetAt            DateTime?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  partner    Partner     @relation(fields: [partnerId], references: [id], onDelete: Restrict)
  favorites  Favorite[]
  orderItems OrderItem[]

  @@index([partnerId, active, sortOrder])
  @@index([signature])
}

model Favorite {
  id         String   @id @default(cuid())
  userId     String
  menuItemId String
  createdAt  DateTime @default(now())

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  menuItem MenuItem @relation(fields: [menuItemId], references: [id], onDelete: Cascade)

  @@unique([userId, menuItemId])
  @@index([userId, createdAt])
}

// ─── Orders ───────────────────────────────────────────────────────────────────

model Order {
  id                  String           @id @default(cuid())
  orderNumber         String           @unique
  customerId          String?
  customerPhone       String
  customerName        String?
  partnerId           String
  riderId             String?
  zoneCode            String
  deliveryAddressId   String?
  // address snapshot
  addrLine1           String
  addrLine2           String?
  addrLandmark        String?
  addrCity            String
  addrPincode         String
  addrLat             Decimal?         @db.Decimal(10, 7)
  addrLng             Decimal?         @db.Decimal(10, 7)
  addrNotes           String?
  // money
  subtotalPaise       Int
  deliveryFeePaise    Int              @default(0)
  packagingFeePaise   Int              @default(0)
  taxPaise            Int              @default(0)
  discountPaise       Int              @default(0)
  totalPaise          Int
  itemCount           Int
  // status
  status              OrderStatus      @default(PLACED)
  cancelledReason     String?
  cancelledBy         UserRole?
  // payment
  paymentMethod       PaymentMethod    @default(RAZORPAY)
  paymentStatus       PaymentStatus    @default(PENDING)
  paymentRefId        String?
  paymentCapturedAt   DateTime?
  // tamper seal
  tamperSealCode      String?          @unique
  tamperSealStatus    TamperSealStatus @default(NONE)
  tamperSealSealedAt  DateTime?
  tamperSealRiderAt   DateTime?
  tamperSealCustAt    DateTime?
  // scheduling
  scheduledFor        DateTime?
  estimatedReadyAt    DateTime?
  estimatedDeliveryAt DateTime?
  pickedUpAt          DateTime?
  deliveredAt         DateTime?
  // audit
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  customer        User?               @relation("CustomerOrders", fields: [customerId], references: [id], onDelete: SetNull)
  partner         Partner             @relation(fields: [partnerId], references: [id], onDelete: Restrict)
  rider           Rider?              @relation(fields: [riderId], references: [id], onDelete: SetNull)
  zone            Zone                @relation(fields: [zoneCode], references: [code], onDelete: Restrict)
  deliveryAddress Address?            @relation(fields: [deliveryAddressId], references: [id], onDelete: SetNull)
  items           OrderItem[]
  events          OrderEvent[]
  walletTxns      WalletTransaction[]
  notifications   Notification[]

  @@index([customerPhone, createdAt])
  @@index([customerId, createdAt])
  @@index([partnerId, status, createdAt])
  @@index([riderId, status])
  @@index([zoneCode, status])
  @@index([status, createdAt])
  @@index([paymentStatus])
}

model OrderItem {
  id          String  @id @default(cuid())
  orderId     String
  menuItemId  String?
  name        String
  pricePaise  Int
  qty         Int
  notesPerRow String?

  order    Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  menuItem MenuItem? @relation(fields: [menuItemId], references: [id], onDelete: SetNull)

  @@index([orderId])
  @@index([menuItemId])
}

model OrderEvent {
  id          String       @id @default(cuid())
  orderId     String
  fromStatus  OrderStatus?
  toStatus    OrderStatus
  actorUserId String?
  actorRole   UserRole?
  note        String?
  metadata    Json?
  createdAt   DateTime     @default(now())

  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
  actor User? @relation(fields: [actorUserId], references: [id], onDelete: SetNull)

  @@index([orderId, createdAt])
  @@index([toStatus, createdAt])
}

// ─── Wallet (append-only ledger, BigInt paise) ────────────────────────────────

model Wallet {
  id                  String          @id @default(cuid())
  ownerType           WalletOwnerType
  partnerId           String?         @unique
  riderId             String?         @unique
  balancePaise        BigInt          @default(0)
  holdPaise           BigInt          @default(0)
  lifetimeCreditPaise BigInt          @default(0)
  lifetimeDebitPaise  BigInt          @default(0)
  currency            String          @default("INR")
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt

  partner      Partner?            @relation(fields: [partnerId], references: [id], onDelete: Restrict)
  rider        Rider?              @relation(fields: [riderId], references: [id], onDelete: Restrict)
  transactions WalletTransaction[]

  @@index([ownerType])
}

model WalletTransaction {
  id                String          @id @default(cuid())
  walletId          String
  direction         WalletDirection
  kind              WalletTxnKind
  amountPaise       BigInt
  balanceAfterPaise BigInt
  idempotencyKey    String          @unique
  orderId           String?
  note              String?
  metadata          Json?
  createdAt         DateTime        @default(now())

  wallet Wallet @relation(fields: [walletId], references: [id], onDelete: Restrict)
  order  Order? @relation(fields: [orderId], references: [id], onDelete: SetNull)

  @@index([walletId, createdAt])
  @@index([orderId])
  @@index([kind, createdAt])
}

// ─── Notifications ────────────────────────────────────────────────────────────

model Notification {
  id                String              @id @default(cuid())
  userId            String?
  phone             String
  channel           NotificationChannel @default(WHATSAPP)
  templateKey       String
  payload           Json
  status            NotificationStatus  @default(QUEUED)
  providerName      String?
  providerMessageId String?
  errorCode         String?
  errorMessage      String?
  attempts          Int                 @default(0)
  orderId           String?
  queuedAt          DateTime            @default(now())
  sentAt            DateTime?
  deliveredAt       DateTime?
  readAt            DateTime?
  failedAt          DateTime?

  user  User?  @relation(fields: [userId], references: [id], onDelete: SetNull)
  order Order? @relation(fields: [orderId], references: [id], onDelete: SetNull)

  @@index([userId, queuedAt])
  @@index([phone, queuedAt])
  @@index([orderId])
  @@index([status, queuedAt])
  @@index([providerMessageId])
}
```

### Post-migration raw SQL (run inside the same migration)

Prisma can't express the polymorphic-wallet check or partial uniques. Append this to the generated migration before `prisma migrate dev` finalizes it (paste into the new `migration.sql` after `prisma migrate dev --create-only`):

```sql
-- Wallet must belong to exactly one owner (Partner XOR Rider)
ALTER TABLE "Wallet"
  ADD CONSTRAINT "wallet_owner_xor"
  CHECK (
    ("ownerType" = 'PARTNER' AND "partnerId" IS NOT NULL AND "riderId" IS NULL)
 OR ("ownerType" = 'RIDER'   AND "riderId"   IS NOT NULL AND "partnerId" IS NULL)
  );

-- At most one default address per user (partial unique — the @unique on User.defaultAddressId
-- already covers the back-pointer; this catches duplicate isDefault=true via direct writes).
CREATE UNIQUE INDEX "address_one_default_per_user"
  ON "Address" ("userId")
  WHERE "isDefault" = true AND "archivedAt" IS NULL;

-- Idempotent retries on the wallet ledger must short-circuit.
-- (Already enforced by @unique on idempotencyKey; documented here for clarity.)
```

---

## 2. Migration warnings

| # | Risk | Reality | Mitigation |
|---|------|---------|------------|
| 1 | `MenuItem.partnerId` is **required**, breaks existing rows. | Current `MenuItem` rows have no `partnerId`. A naive `migrate dev` will fail on the NOT NULL backfill. | Dev: full reset (see §3). Prod path (not Phase 2 yet): two-step migration — add `partnerId` nullable, backfill to the seeded Forra partner, then `ALTER COLUMN partnerId SET NOT NULL`. |
| 2 | `Order.partnerId`, `Order.zoneCode`, `Order.addrLine1`, `Order.addrCity`, `Order.addrPincode`, `Order.subtotalPaise` are **required new columns** on an existing table. | Current `Order` rows lack all of these. | Phase 2 is closed-beta — wipe `Order` + `OrderItem` in dev. Document a backfill script before any prod cut. |
| 3 | Polymorphic Wallet (`partnerId` XOR `riderId`) is **not expressible in Prisma**. | Without a CHECK constraint a row could have neither or both. | Added via raw SQL (`wallet_owner_xor`) — see post-migration SQL block. Service layer must also refuse mixed writes. |
| 4 | `Order.tamperSealCode` is `@unique` but nullable. | Postgres allows multiple `NULL`s under `UNIQUE` — fine, but be aware the uniqueness check only kicks in once a code is generated. | Generate `nanoid(12)` synchronously inside the order-placement transaction, never after-the-fact. |
| 5 | `User.defaultAddressId @unique` creates a circular FK (User ↔ Address). | Prisma orders inserts correctly, but raw SQL seeds must create the `Address` row before setting `User.defaultAddressId`. | Seed Users with `defaultAddressId: null`, then create Addresses, then update User. (Reflected in seed order below.) |
| 6 | `Wallet.balancePaise` is **BigInt**. | Prisma client returns `bigint` literals in JS — JSON.stringify will throw without a serializer. | Add `BigInt.prototype.toJSON = function () { return this.toString() }` in the app bootstrap (one line in `src/lib/bigint.js`). All API responses must stringify wallet amounts before sending. |
| 7 | `OrderEvent.metadata`, `WalletTransaction.metadata`, `Notification.payload` are `Json`. | Postgres `jsonb` — safe, but reject unbounded payloads at the service layer (>16 KB hint cap). | Zod validation on every write path. |
| 8 | `Partner.commissionBps Int @default(1500)`. | Home-maker cap is 10% (1000 bps); locked decision. | Enforce `commissionBps <= 1000 when category = HOME_MAKER` in the service layer, not in DB — leaves room for promo overrides. |
| 9 | `Zone.code` is the primary key (slug). | Cheap joins, but renames are catastrophic — every FK breaks. | Treat zone slugs as immutable once created. Display names live in `nameEn` / `nameMl`. |
| 10 | Application tables (`RiderApplication`, `PartnerApplication`) coexist with post-approval entities (`Rider`, `Partner`). | Two sources of truth for "who exists". | Approval flow must (a) flip application to `APPROVED`, (b) create the canonical `Rider`/`Partner` row, (c) link via `reviewerId` only — no FK between application and entity, intentional. |
| 11 | All `Decimal(10,7)` lat/lng fields. | ~1.1 cm precision — more than enough; some Prisma client versions surface these as `Decimal` not `number`. | Cast to `Number(value)` only at the API boundary. Never compare with `===`. |
| 12 | `String[]` on `Zone.pincodes` (Postgres native array). | Not supported on every provider; locked to Postgres anyway. | Confirmed — `datasource db` is `postgresql`, safe. |

---

## 3. Dev reset strategy

Phase 2 is pre-launch — no live customer data, no live orders. Disposable database. The clean path:

```bash
cd backend

# 1. Stop the API + worker processes (so they don't reopen pooled connections mid-reset).
pm2 stop all 2>/dev/null || true

# 2. Hard-reset Postgres + reapply migrations from scratch.
npx prisma migrate reset --force --skip-seed
#   • Drops the database, recreates it, replays every migration in order.
#   • --skip-seed because we'll run the new seed manually so we can watch it.

# 3. Replace the schema file with the Phase 2 version, then create the migration.
mv prisma/schema.prisma prisma/schema.phase1.prisma.bak
mv prisma/schema.phase2.prisma prisma/schema.prisma
npx prisma migrate dev --name phase2_baseline --create-only
#   • --create-only writes the migration but doesn't apply it yet.

# 4. Open the generated migration.sql and APPEND the raw SQL block from §1
#    (wallet_owner_xor CHECK + address_one_default_per_user partial unique).

# 5. Apply.
npx prisma migrate dev
npx prisma generate

# 6. Seed in the order in §4.
node prisma/seed.js
```

**If you would rather keep the existing migration history**, instead of `reset`:

```bash
# Squash route — only safe before any prod cut. Drops everything in /migrations.
rm -rf prisma/migrations
npx prisma migrate reset --force --skip-seed
npx prisma migrate dev --name phase2_baseline --create-only
# …then the same SQL append + apply + seed.
```

Do not attempt an in-place `migrate dev` on top of the current Phase 1 history — the required-column adds (warnings #1 and #2) will throw and leave the DB in a half-migrated state.

---

## 4. Seed order

Strict dependency order. Each step must finish before the next starts (the existing `seed.js` runs sequentially with `await`).

```
 1. Zones                  (perinthalmanna, malappuram)               — no FK deps
 2. Users                  (customer, partner-owner, rider-owner, admin)
                            ↳ leave defaultAddressId NULL for now
 3. Addresses              (one HOME address for the customer in Perinthalmanna)
                            ↳ FK: userId → User, zoneCode → Zone
 4. User.defaultAddressId  UPDATE customer.defaultAddressId = address.id
                            ↳ resolves the circular User↔Address FK
 5. RiderApplication       (Rajan — already APPROVED in seed for dev)
 6. PartnerApplication     (Fathima's Kitchen — already APPROVED in seed for dev)
 7. Partner                (links to partner-owner User + perinthalmanna Zone)
                            ↳ kycStatus=APPROVED, isActive=true
 8. Rider                  (links to rider-owner User + perinthalmanna Zone)
                            ↳ kycStatus=APPROVED, isActive=true, isOnline=false
 9. Wallet (PARTNER)       (partnerId = Fathima.id, riderId = NULL)
10. Wallet (RIDER)         (riderId = Rajan.id, partnerId = NULL)
11. MenuItem               (5 Forra/Fathima items — all under partnerId = Fathima.id)
12. Favorite               (customer favourites the biryani — optional, useful for the favorites screen)
```

Skip `Order`, `OrderItem`, `OrderEvent`, `WalletTransaction`, `Notification` in the seed — those are produced by the live order lifecycle and should not be faked at boot. Use the E2E playbook to generate them.

Notes for the seed implementer:
- All upserts keyed by natural keys (`User.phone`, `Zone.code`, `Partner.userId`, `Rider.userId`) so the seed stays idempotent.
- After step 4 the seed should also write the BigInt fields as JS `BigInt` literals (`0n`), not numbers — Prisma will reject.
- Two `Wallet` rows must each set `ownerType` explicitly; the CHECK constraint will reject mismatches at write time.

---

**Files written:**
- `backend/prisma/schema.phase2.prisma` — the schema, ready to swap in.
- `docs/QUICKRONS_PHASE_2_SCHEMA_DELTA.md` — this brief.
