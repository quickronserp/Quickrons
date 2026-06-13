-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MenuItem_partnerId_archivedAt_idx" ON "MenuItem"("partnerId", "archivedAt");
