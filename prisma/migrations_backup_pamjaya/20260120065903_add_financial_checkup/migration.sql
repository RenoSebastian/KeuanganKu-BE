/*
  Warnings:

  - You are about to drop the column `expense_snapshot` on the `financial_checkups` table. All the data in the column will be lost.
  - You are about to drop the column `income_snapshot` on the `financial_checkups` table. All the data in the column will be lost.
  - You are about to drop the column `recommendation` on the `financial_checkups` table. All the data in the column will be lost.
  - You are about to drop the column `score` on the `financial_checkups` table. All the data in the column will be lost.
  - The `status` column on the `financial_checkups` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `ratios_details` to the `financial_checkups` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_profile` to the `financial_checkups` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('SEHAT', 'WASPADA', 'BAHAYA');

-- AlterTable
ALTER TABLE "financial_checkups" DROP COLUMN "expense_snapshot",
DROP COLUMN "income_snapshot",
DROP COLUMN "recommendation",
DROP COLUMN "score",
ADD COLUMN     "asset_antique" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "asset_bonds" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "asset_cash" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "asset_deposit" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "asset_gold" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "asset_home" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "asset_inv_antique" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "asset_inv_home" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "asset_inv_other" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "asset_inv_vehicle" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "asset_jewelry" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "asset_mutual_fund" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "asset_personal_other" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "asset_stocks" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "asset_vehicle" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "debt_business" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "debt_cc" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "debt_consumptive_other" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "debt_coop" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "debt_kpm" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "debt_kpr" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "expense_communication" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "expense_food" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "expense_helpers" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "expense_lifestyle" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "expense_school" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "expense_tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "expense_transport" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "health_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "income_fixed" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "income_variable" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "installment_business" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "installment_cc" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "installment_consumptive_other" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "installment_coop" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "installment_kpm" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "installment_kpr" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "insurance_bpjs" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "insurance_health" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "insurance_home" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "insurance_life" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "insurance_other" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "insurance_vehicle" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "ratios_details" JSONB NOT NULL,
ADD COLUMN     "saving_education" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "saving_emergency" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "saving_holiday" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "saving_other" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "saving_pilgrimage" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "saving_retirement" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "spouse_profile" JSONB,
ADD COLUMN     "surplus_deficit" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "total_net_worth" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "user_profile" JSONB NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "HealthStatus" NOT NULL DEFAULT 'BAHAYA';
