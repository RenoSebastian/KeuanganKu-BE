/*
  Warnings:

  - You are about to drop the column `agency_name` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `unit_kerja_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `unit_kerja` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "QuotaTransactionType" AS ENUM ('SUBSCRIPTION_RENEWAL', 'ADMIN_BONUS', 'USAGE_SIMULATION', 'COMPENSATION', 'CORRECTION');

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_unit_kerja_id_fkey";

-- DropIndex
DROP INDEX "users_unit_kerja_id_idx";

-- AlterTable
ALTER TABLE "subscription_plans" ADD COLUMN     "bonus_quota" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "agency_name",
DROP COLUMN "unit_kerja_id",
ADD COLUMN     "agency_id" TEXT,
ADD COLUMN     "quota" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "unit_kerja";

-- CreateTable
CREATE TABLE "agencies" (
    "id" TEXT NOT NULL,
    "agency_code" TEXT NOT NULL,
    "agency_name" TEXT NOT NULL,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_quota_ledgers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "QuotaTransactionType" NOT NULL,
    "reference_id" TEXT,
    "balance_after" INTEGER NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_quota_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_payment_audits" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL,
    "rejection_reason" TEXT,
    "proof_snapshot_url" TEXT,
    "verified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_payment_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "socket_id" TEXT,
    "device_info" TEXT,
    "ip_address" TEXT,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "login_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "active_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agencies_agency_code_key" ON "agencies"("agency_code");

-- CreateIndex
CREATE INDEX "user_quota_ledgers_user_id_idx" ON "user_quota_ledgers"("user_id");

-- CreateIndex
CREATE INDEX "user_quota_ledgers_type_idx" ON "user_quota_ledgers"("type");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_payment_audits_order_id_key" ON "subscription_payment_audits"("order_id");

-- CreateIndex
CREATE INDEX "active_sessions_last_activity_at_idx" ON "active_sessions"("last_activity_at");

-- CreateIndex
CREATE INDEX "users_agency_id_idx" ON "users"("agency_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quota_ledgers" ADD CONSTRAINT "user_quota_ledgers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payment_audits" ADD CONSTRAINT "subscription_payment_audits_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "subscription_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_sessions" ADD CONSTRAINT "active_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
