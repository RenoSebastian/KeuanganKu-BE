/*
  Warnings:

  - Added the required column `updated_at` to the `education_plans` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `financial_checkups` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `goal_plans` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `insurance_plans` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `pension_plans` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EducationModuleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EducationProgressStatus" AS ENUM ('STARTED', 'COMPLETED');

-- AlterTable
ALTER TABLE "education_plans" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "financial_checkups" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expense_other" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "goal_plans" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "insurance_plans" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "pension_plans" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "education_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon_url" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "education_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education_modules" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "thumbnail_url" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "reading_time" INTEGER NOT NULL DEFAULT 5,
    "status" "EducationModuleStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "education_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_sections" (
    "id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "section_order" INTEGER NOT NULL,
    "title" TEXT,
    "content_markdown" TEXT NOT NULL,
    "illustration_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_education_progress" (
    "user_id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "status" "EducationProgressStatus" NOT NULL DEFAULT 'STARTED',
    "last_read_section_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_education_progress_pkey" PRIMARY KEY ("user_id","module_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "education_categories_slug_key" ON "education_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "education_modules_slug_key" ON "education_modules"("slug");

-- CreateIndex
CREATE INDEX "education_modules_category_id_idx" ON "education_modules"("category_id");

-- CreateIndex
CREATE INDEX "education_modules_status_idx" ON "education_modules"("status");

-- CreateIndex
CREATE INDEX "education_modules_slug_idx" ON "education_modules"("slug");

-- CreateIndex
CREATE INDEX "module_sections_module_id_idx" ON "module_sections"("module_id");

-- AddForeignKey
ALTER TABLE "education_modules" ADD CONSTRAINT "education_modules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "education_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_sections" ADD CONSTRAINT "module_sections_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "education_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_education_progress" ADD CONSTRAINT "user_education_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_education_progress" ADD CONSTRAINT "user_education_progress_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "education_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_education_progress" ADD CONSTRAINT "user_education_progress_last_read_section_id_fkey" FOREIGN KEY ("last_read_section_id") REFERENCES "module_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
