-- CreateEnum
CREATE TYPE "InsuranceType" AS ENUM ('LIFE', 'HEALTH', 'CRITICAL_ILLNESS');

-- CreateTable
CREATE TABLE "pension_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_age" INTEGER NOT NULL,
    "retirement_age" INTEGER NOT NULL,
    "life_expectancy" INTEGER NOT NULL DEFAULT 80,
    "current_expense" DECIMAL(15,2) NOT NULL,
    "current_saving" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "inflation_rate" DECIMAL(5,2) NOT NULL DEFAULT 5.0,
    "return_rate" DECIMAL(5,2) NOT NULL DEFAULT 8.0,
    "total_fund_needed" DECIMAL(15,2) NOT NULL,
    "monthly_saving" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "pension_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "InsuranceType" NOT NULL DEFAULT 'LIFE',
    "dependent_count" INTEGER NOT NULL DEFAULT 0,
    "monthly_expense" DECIMAL(15,2) NOT NULL,
    "existing_debt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "existing_coverage" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "protection_duration" INTEGER NOT NULL DEFAULT 10,
    "coverage_needed" DECIMAL(15,2) NOT NULL,
    "recommendation" TEXT,

    CONSTRAINT "insurance_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "goal_name" TEXT NOT NULL,
    "target_amount" DECIMAL(15,2) NOT NULL,
    "target_date" TIMESTAMP(3) NOT NULL,
    "inflation_rate" DECIMAL(5,2) NOT NULL DEFAULT 5.0,
    "return_rate" DECIMAL(5,2) NOT NULL DEFAULT 6.0,
    "future_value" DECIMAL(15,2) NOT NULL,
    "monthly_saving" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "goal_plans_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pension_plans" ADD CONSTRAINT "pension_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_plans" ADD CONSTRAINT "insurance_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_plans" ADD CONSTRAINT "goal_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
