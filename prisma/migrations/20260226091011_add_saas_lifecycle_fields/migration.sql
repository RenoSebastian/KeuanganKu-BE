/*
  Warnings:

  - The values [DIRECTOR] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
ALTER TYPE "QuotaTransactionType" ADD VALUE 'SYSTEM_DOWNGRADE';


-- Ubah semua pengguna dengan role DIRECTOR menjadi ADMIN secara paksa sebelum tipe data diperbarui.
UPDATE "users" SET "role" = 'ADMIN' WHERE "role" = 'DIRECTOR';

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('USER', 'ADMIN');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;

-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'GRACE_PERIOD';

-- AlterTable
ALTER TABLE "subscription_orders" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user_quota_ledgers" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user_subscriptions" ADD COLUMN     "grace_period_end_date" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "user_quota_ledgers_created_at_idx" ON "user_quota_ledgers"("created_at");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");
