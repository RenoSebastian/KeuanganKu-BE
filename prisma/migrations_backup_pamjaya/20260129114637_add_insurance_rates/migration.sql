-- AlterTable
ALTER TABLE "insurance_plans" ADD COLUMN     "inflation_rate" DECIMAL(5,2) NOT NULL DEFAULT 5.0,
ADD COLUMN     "return_rate" DECIMAL(5,2) NOT NULL DEFAULT 7.0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar" TEXT;
