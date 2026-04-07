/*
  Warnings:

  - You are about to drop the column `hashed_otp` on the `password_reset_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `retry_count` on the `password_reset_tokens` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[user_id]` on the table `password_reset_tokens` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `hashed_token` to the `password_reset_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "password_reset_tokens_user_id_idx";

-- AlterTable
ALTER TABLE "password_reset_tokens" DROP COLUMN "hashed_otp",
DROP COLUMN "retry_count",
ADD COLUMN     "hashed_token" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "agency_name" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_user_id_key" ON "password_reset_tokens"("user_id");
