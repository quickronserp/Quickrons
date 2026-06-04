-- Server-side Ratings & Reviews. Fully additive / non-destructive:
--   * new "Rating" table (no existing data touched)
--   * Partner/Rider gain averageRating (Float, default 0) + reviewCount (Int, default 0)
--   * all FKs are additive; nothing is dropped or altered destructively

-- ── Aggregate columns (constant defaults → fast, no rewrite of existing rows) ──
ALTER TABLE "Partner"
  ADD COLUMN "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "reviewCount"   INTEGER          NOT NULL DEFAULT 0;

ALTER TABLE "Rider"
  ADD COLUMN "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "reviewCount"   INTEGER          NOT NULL DEFAULT 0;

-- ── Rating table ──────────────────────────────────────────────────────────────
CREATE TABLE "Rating" (
  "id"             TEXT NOT NULL,
  "orderId"        TEXT NOT NULL,
  "customerId"     TEXT,
  "partnerId"      TEXT NOT NULL,
  "riderId"        TEXT,
  "foodRating"     INTEGER NOT NULL,
  "deliveryRating" INTEGER NOT NULL,
  "overallRating"  INTEGER NOT NULL,
  "reviewText"     TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- One rating per order.
CREATE UNIQUE INDEX "Rating_orderId_key" ON "Rating"("orderId");
CREATE INDEX "Rating_partnerId_createdAt_idx"  ON "Rating"("partnerId", "createdAt");
CREATE INDEX "Rating_riderId_createdAt_idx"    ON "Rating"("riderId", "createdAt");
CREATE INDEX "Rating_customerId_createdAt_idx" ON "Rating"("customerId", "createdAt");

-- Foreign keys (mirror Prisma onDelete semantics).
ALTER TABLE "Rating"
  ADD CONSTRAINT "Rating_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rating"
  ADD CONSTRAINT "Rating_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Rating"
  ADD CONSTRAINT "Rating_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rating"
  ADD CONSTRAINT "Rating_riderId_fkey"
  FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
