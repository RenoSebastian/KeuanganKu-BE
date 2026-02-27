-- 1. Bersihkan sisa-sisa tipe "sampah" dari error sebelumnya agar tidak bentrok
DROP TYPE IF EXISTS "Role_new" CASCADE;
DROP TYPE IF EXISTS "Role_old" CASCADE;

-- 2. Tambah nilai Enum (Gunakan IF NOT EXISTS agar tahan duplikasi)
ALTER TYPE "QuotaTransactionType" ADD VALUE IF NOT EXISTS 'SYSTEM_DOWNGRADE';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'GRACE_PERIOD';

-- 3. Sanitasi data pengguna (Amankan user lama)
UPDATE "users" SET "role" = 'ADMIN' WHERE "role" = 'DIRECTOR';

-- 4. Rombak struktur Enum Role (Sekarang 100% aman karena tipe sudah dibersihkan)
CREATE TYPE "Role_new" AS ENUM ('USER', 'ADMIN');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';

-- 5. Tambahkan kolom baru (Gunakan IF NOT EXISTS)
ALTER TABLE "subscription_orders" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "user_quota_ledgers" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "grace_period_end_date" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- 6. Tambahkan index (Gunakan IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "user_quota_ledgers_created_at_idx" ON "user_quota_ledgers"("created_at");
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users"("deleted_at");
