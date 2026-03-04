/*
  Warnings:

  - A unique constraint covering the columns `[session_id]` on the table `active_sessions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `device_id` to the `active_sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `session_id` to the `active_sessions` table without a default value. This is not possible if the table is not empty.

*/
TRUNCATE TABLE "active_sessions" CASCADE;
-- AlterTable
ALTER TABLE "active_sessions" ADD COLUMN     "device_id" TEXT NOT NULL,
ADD COLUMN     "refresh_token_hash" TEXT,
ADD COLUMN     "session_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "active_sessions_session_id_key" ON "active_sessions"("session_id");

-- CreateIndex
CREATE INDEX "active_sessions_device_id_idx" ON "active_sessions"("device_id");
