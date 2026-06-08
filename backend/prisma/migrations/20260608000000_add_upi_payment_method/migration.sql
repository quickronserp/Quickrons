-- Add UPI as a supported payment method.
-- Additive, non-destructive: existing rows and enum values are untouched.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'UPI';
