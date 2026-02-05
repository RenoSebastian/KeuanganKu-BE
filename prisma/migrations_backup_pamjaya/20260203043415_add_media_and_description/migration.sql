/*
  Warnings:

  - You are about to drop the column `action` on the `retention_logs` table. All the data in the column will be lost.
  - You are about to drop the column `executed_at` on the `retention_logs` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_education_progress" DROP CONSTRAINT "user_education_progress_module_id_fkey";

-- DropIndex
DROP INDEX "retention_logs_executed_at_idx";

-- AlterTable
ALTER TABLE "education_categories" ADD COLUMN     "description" VARCHAR(255);

-- AlterTable
ALTER TABLE "quiz_options" ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "order_index" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "quiz_questions" ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "retention_logs" DROP COLUMN "action",
DROP COLUMN "executed_at",
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'STARTED',
ALTER COLUMN "records_deleted" SET DEFAULT 0;

-- CreateIndex
CREATE INDEX "retention_logs_started_at_idx" ON "retention_logs"("started_at");

-- AddForeignKey
ALTER TABLE "user_education_progress" ADD CONSTRAINT "user_education_progress_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "education_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
