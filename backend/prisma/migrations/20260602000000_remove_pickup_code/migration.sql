-- Remove Pickup Code (tamperSeal*) — keep Delivery OTP only.
-- The two-gate model is replaced: rider taps Picked Up (no code),
-- system generates deliveryOtp, customer shows it to rider at door.

-- Drop unique index on tamperSealCode before dropping the column
DROP INDEX IF EXISTS "Order_tamperSealCode_key";

-- Drop tamperSeal columns from Order
ALTER TABLE "Order"
  DROP COLUMN IF EXISTS "tamperSealCode",
  DROP COLUMN IF EXISTS "tamperSealStatus",
  DROP COLUMN IF EXISTS "tamperSealSealedAt",
  DROP COLUMN IF EXISTS "tamperSealRiderAt",
  DROP COLUMN IF EXISTS "tamperSealCustAt";

-- Drop TamperSealStatus enum
DROP TYPE IF EXISTS "TamperSealStatus";
