-- Phase 1 image system: partner storefront branding fields.
-- Fully additive and non-destructive:
--   * nullable TEXT columns (no table rewrite, no default backfill)
--   * galleryUrls is TEXT[] with an empty-array default (safe constant default)
-- Existing Partner rows are untouched; new columns read NULL / '{}' until set.

ALTER TABLE "Partner"
  ADD COLUMN "profileImageUrl" TEXT,
  ADD COLUMN "bannerImageUrl"  TEXT,
  ADD COLUMN "galleryUrls"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "tagline"         TEXT;
