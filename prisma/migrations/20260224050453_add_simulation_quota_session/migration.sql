/*
  Warnings:

  - The primary key for the `user_usages` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `client_count` on the `user_usages` table. All the data in the column will be lost.
  - You are about to drop the column `client_limit` on the `user_usages` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `user_usages` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `user_usages` table. All the data in the column will be lost.
  - You are about to drop the column `simulation_count` on the `user_usages` table. All the data in the column will be lost.
  - Added the required column `session_id` to the `simulation_logs` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "simulation_logs_agent_id_idx";

-- DropIndex
DROP INDEX "user_usages_user_id_key";

-- AlterTable
-- 1. Tambahkan kolom sebagai NULLABLE dulu
ALTER TABLE "simulation_logs" ADD COLUMN "session_id" TEXT;

-- 2. Isi data lama dengan nilai unik (Format: "legacy_uuid-log")
-- Ini memastikan data lama tidak error dan tetap punya session_id unik
UPDATE "simulation_logs" 
SET "session_id" = 'legacy_' || "id" 
WHERE "session_id" IS NULL;

-- 3. Ubah kolom menjadi NOT NULL (Wajib Diisi) setelah semua terisi
ALTER TABLE "simulation_logs" ALTER COLUMN "session_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "user_usages" DROP CONSTRAINT "user_usages_pkey",
DROP COLUMN "client_count",
DROP COLUMN "client_limit",
DROP COLUMN "created_at",
DROP COLUMN "id",
DROP COLUMN "simulation_count",
ADD COLUMN     "simulation_quota" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "total_used" INTEGER NOT NULL DEFAULT 0,
ADD CONSTRAINT "user_usages_pkey" PRIMARY KEY ("user_id");

-- CreateIndex
CREATE INDEX "simulation_logs_agent_id_session_id_idx" ON "simulation_logs"("agent_id", "session_id");
