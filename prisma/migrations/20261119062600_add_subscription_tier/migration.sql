-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD');

-- AlterTable
ALTER TABLE "subscription_plans" ADD COLUMN "tier" "SubscriptionTier" NOT NULL DEFAULT 'GOLD';
