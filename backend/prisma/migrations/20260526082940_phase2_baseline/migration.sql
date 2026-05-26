/*
  Warnings:

  - A unique constraint covering the columns `[tamperSealCode]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[defaultAddressId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `partnerId` to the `MenuItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `addrCity` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `addrLine1` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `addrPincode` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `partnerId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotalPaise` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `zoneCode` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AddressLabel" AS ENUM ('HOME', 'WORK', 'OTHER');

-- CreateEnum
CREATE TYPE "PartnerCategory" AS ENUM ('HOME_MAKER', 'RESTAURANT', 'CATERER', 'FORRA_SUPPLIER');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('BIKE', 'SCOOTER', 'BICYCLE', 'EV_BIKE');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('RAZORPAY', 'COD', 'WALLET');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "TamperSealStatus" AS ENUM ('NONE', 'SEALED', 'VERIFIED_BY_RIDER', 'VERIFIED_BY_CUSTOMER', 'BROKEN');

-- CreateEnum
CREATE TYPE "WalletOwnerType" AS ENUM ('PARTNER', 'RIDER');

-- CreateEnum
CREATE TYPE "WalletDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "WalletTxnKind" AS ENUM ('ORDER_HOLD', 'ORDER_RELEASE', 'ORDER_PAYOUT', 'REFUND', 'ADJUSTMENT', 'SETTLEMENT_PAID', 'MANUAL_CREDIT', 'MANUAL_DEBIT');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('WHATSAPP', 'SMS', 'PUSH', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- DropIndex
DROP INDEX "public"."Order_status_idx";

-- DropIndex
DROP INDEX "public"."PartnerApplication_status_idx";

-- DropIndex
DROP INDEX "public"."RiderApplication_status_idx";

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "category" TEXT,
ADD COLUMN     "dailyQuantityLimit" INTEGER,
ADD COLUMN     "dailyQuantityRemaining" INTEGER,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "lastResetAt" TIMESTAMP(3),
ADD COLUMN     "partnerId" TEXT NOT NULL,
ADD COLUMN     "servingEndMinutes" INTEGER,
ADD COLUMN     "servingStartMinutes" INTEGER;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "addrCity" TEXT NOT NULL,
ADD COLUMN     "addrLandmark" TEXT,
ADD COLUMN     "addrLat" DECIMAL(10,7),
ADD COLUMN     "addrLine1" TEXT NOT NULL,
ADD COLUMN     "addrLine2" TEXT,
ADD COLUMN     "addrLng" DECIMAL(10,7),
ADD COLUMN     "addrNotes" TEXT,
ADD COLUMN     "addrPincode" TEXT NOT NULL,
ADD COLUMN     "cancelledBy" "UserRole",
ADD COLUMN     "cancelledReason" TEXT,
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveryAddressId" TEXT,
ADD COLUMN     "deliveryFeePaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discountPaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "estimatedDeliveryAt" TIMESTAMP(3),
ADD COLUMN     "estimatedReadyAt" TIMESTAMP(3),
ADD COLUMN     "packagingFeePaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "partnerId" TEXT NOT NULL,
ADD COLUMN     "paymentCapturedAt" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'RAZORPAY',
ADD COLUMN     "paymentRefId" TEXT,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "pickedUpAt" TIMESTAMP(3),
ADD COLUMN     "riderId" TEXT,
ADD COLUMN     "scheduledFor" TIMESTAMP(3),
ADD COLUMN     "subtotalPaise" INTEGER NOT NULL,
ADD COLUMN     "tamperSealCode" TEXT,
ADD COLUMN     "tamperSealCustAt" TIMESTAMP(3),
ADD COLUMN     "tamperSealRiderAt" TIMESTAMP(3),
ADD COLUMN     "tamperSealSealedAt" TIMESTAMP(3),
ADD COLUMN     "tamperSealStatus" "TamperSealStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "taxPaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "zoneCode" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "notesPerRow" TEXT;

-- AlterTable
ALTER TABLE "PartnerApplication" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewerId" TEXT;

-- AlterTable
ALTER TABLE "RiderApplication" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewerId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "defaultAddressId" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "name" TEXT;

-- CreateTable
CREATE TABLE "Zone" (
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameMl" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "pincodes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "centerLat" DECIMAL(10,7),
    "centerLng" DECIMAL(10,7),
    "radiusKm" DECIMAL(5,2),
    "launchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" "AddressLabel" NOT NULL DEFAULT 'HOME',
    "recipient" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "landmark" TEXT,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "zoneCode" TEXT,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "notes" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "category" "PartnerCategory" NOT NULL,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "zoneCode" TEXT NOT NULL,
    "commissionBps" INTEGER NOT NULL DEFAULT 1500,
    "fssaiNumber" TEXT,
    "gstNumber" TEXT,
    "bankAccountName" TEXT,
    "bankAccountLast4" TEXT,
    "ifscCode" TEXT,
    "payoutNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rider" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "vehicleNumber" TEXT,
    "licenseNumber" TEXT,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "zoneCode" TEXT NOT NULL,
    "currentLat" DECIMAL(10,7),
    "currentLng" DECIMAL(10,7),
    "lastPingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "actorUserId" TEXT,
    "actorRole" "UserRole",
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "ownerType" "WalletOwnerType" NOT NULL,
    "partnerId" TEXT,
    "riderId" TEXT,
    "balancePaise" BIGINT NOT NULL DEFAULT 0,
    "holdPaise" BIGINT NOT NULL DEFAULT 0,
    "lifetimeCreditPaise" BIGINT NOT NULL DEFAULT 0,
    "lifetimeDebitPaise" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "direction" "WalletDirection" NOT NULL,
    "kind" "WalletTxnKind" NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "balanceAfterPaise" BIGINT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "orderId" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "phone" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'WHATSAPP',
    "templateKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "providerName" TEXT,
    "providerMessageId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "orderId" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Zone_isActive_idx" ON "Zone"("isActive");

-- CreateIndex
CREATE INDEX "Zone_district_idx" ON "Zone"("district");

-- CreateIndex
CREATE INDEX "Address_userId_archivedAt_idx" ON "Address"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "Address_zoneCode_idx" ON "Address"("zoneCode");

-- CreateIndex
CREATE INDEX "Address_pincode_idx" ON "Address"("pincode");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_userId_key" ON "Partner"("userId");

-- CreateIndex
CREATE INDEX "Partner_zoneCode_isActive_idx" ON "Partner"("zoneCode", "isActive");

-- CreateIndex
CREATE INDEX "Partner_kycStatus_idx" ON "Partner"("kycStatus");

-- CreateIndex
CREATE INDEX "Partner_category_idx" ON "Partner"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Rider_userId_key" ON "Rider"("userId");

-- CreateIndex
CREATE INDEX "Rider_zoneCode_isOnline_isActive_idx" ON "Rider"("zoneCode", "isOnline", "isActive");

-- CreateIndex
CREATE INDEX "Rider_kycStatus_idx" ON "Rider"("kycStatus");

-- CreateIndex
CREATE INDEX "Favorite_userId_createdAt_idx" ON "Favorite"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_menuItemId_key" ON "Favorite"("userId", "menuItemId");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderEvent_toStatus_createdAt_idx" ON "OrderEvent"("toStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_partnerId_key" ON "Wallet"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_riderId_key" ON "Wallet"("riderId");

-- CreateIndex
CREATE INDEX "Wallet_ownerType_idx" ON "Wallet"("ownerType");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_idempotencyKey_key" ON "WalletTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_orderId_idx" ON "WalletTransaction"("orderId");

-- CreateIndex
CREATE INDEX "WalletTransaction_kind_createdAt_idx" ON "WalletTransaction"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_queuedAt_idx" ON "Notification"("userId", "queuedAt");

-- CreateIndex
CREATE INDEX "Notification_phone_queuedAt_idx" ON "Notification"("phone", "queuedAt");

-- CreateIndex
CREATE INDEX "Notification_orderId_idx" ON "Notification"("orderId");

-- CreateIndex
CREATE INDEX "Notification_status_queuedAt_idx" ON "Notification"("status", "queuedAt");

-- CreateIndex
CREATE INDEX "Notification_providerMessageId_idx" ON "Notification"("providerMessageId");

-- CreateIndex
CREATE INDEX "MenuItem_partnerId_active_sortOrder_idx" ON "MenuItem"("partnerId", "active", "sortOrder");

-- CreateIndex
CREATE INDEX "MenuItem_signature_idx" ON "MenuItem"("signature");

-- CreateIndex
CREATE INDEX "OTP_expiresAt_idx" ON "OTP"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_tamperSealCode_key" ON "Order"("tamperSealCode");

-- CreateIndex
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_partnerId_status_createdAt_idx" ON "Order"("partnerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_riderId_status_idx" ON "Order"("riderId", "status");

-- CreateIndex
CREATE INDEX "Order_zoneCode_status_idx" ON "Order"("zoneCode", "status");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");

-- CreateIndex
CREATE INDEX "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");

-- CreateIndex
CREATE INDEX "PartnerApplication_status_createdAt_idx" ON "PartnerApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RiderApplication_status_createdAt_idx" ON "RiderApplication"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_defaultAddressId_key" ON "User"("defaultAddressId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_defaultAddressId_fkey" FOREIGN KEY ("defaultAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_zoneCode_fkey" FOREIGN KEY ("zoneCode") REFERENCES "Zone"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_zoneCode_fkey" FOREIGN KEY ("zoneCode") REFERENCES "Zone"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rider" ADD CONSTRAINT "Rider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rider" ADD CONSTRAINT "Rider_zoneCode_fkey" FOREIGN KEY ("zoneCode") REFERENCES "Zone"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_zoneCode_fkey" FOREIGN KEY ("zoneCode") REFERENCES "Zone"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryAddressId_fkey" FOREIGN KEY ("deliveryAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Wallet must belong to exactly one owner: Partner XOR Rider
ALTER TABLE "Wallet"
  ADD CONSTRAINT "wallet_owner_xor"
  CHECK (
    ("ownerType" = 'PARTNER' AND "partnerId" IS NOT NULL AND "riderId" IS NULL)
 OR ("ownerType" = 'RIDER'   AND "riderId"   IS NOT NULL AND "partnerId" IS NULL)
  );

-- At most one default address per user
CREATE UNIQUE INDEX "address_one_default_per_user"
  ON "Address" ("userId")
  WHERE "isDefault" = true AND "archivedAt" IS NULL;
