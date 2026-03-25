-- AlterTable
ALTER TABLE "subscription_plans" ADD COLUMN     "discount_note" VARCHAR(255),
ADD COLUMN     "original_price" DECIMAL(15,2);
