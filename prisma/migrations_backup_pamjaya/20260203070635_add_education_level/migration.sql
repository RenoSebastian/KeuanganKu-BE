-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- AlterTable
ALTER TABLE "education_modules" ADD COLUMN     "level" "EducationLevel" NOT NULL DEFAULT 'BEGINNER',
ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0;
