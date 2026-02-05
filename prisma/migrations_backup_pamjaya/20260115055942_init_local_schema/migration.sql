-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'DIRECTOR');

-- CreateEnum
CREATE TYPE "EducationMethod" AS ENUM ('ARITHMETIC', 'GEOMETRIC');

-- CreateEnum
CREATE TYPE "SchoolLevel" AS ENUM ('TK', 'SD', 'SMP', 'SMA', 'PT');

-- CreateEnum
CREATE TYPE "CostType" AS ENUM ('ENTRY', 'ANNUAL');

-- CreateTable
CREATE TABLE "unit_kerja" (
    "id" TEXT NOT NULL,
    "kode_unit" TEXT NOT NULL,
    "nama_unit" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_kerja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "unit_kerja_id" TEXT NOT NULL,
    "nip" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "date_of_birth" TIMESTAMP(3) NOT NULL,
    "dependent_count" INTEGER NOT NULL DEFAULT 0,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "target_user_id" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "fixed_income" DECIMAL(15,2) NOT NULL,
    "variable_income" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "productive_debt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "consumptive_debt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "insurance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "saving" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "living_cost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_income" DECIMAL(15,2) NOT NULL,
    "total_expense" DECIMAL(15,2) NOT NULL,
    "balance" DECIMAL(15,2) NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_checkups" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "check_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "income_snapshot" DECIMAL(15,2) NOT NULL,
    "expense_snapshot" DECIMAL(15,2) NOT NULL,
    "recommendation" TEXT NOT NULL,

    CONSTRAINT "financial_checkups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "child_name" TEXT NOT NULL,
    "child_dob" TIMESTAMP(3) NOT NULL,
    "inflation_rate" DECIMAL(5,2) NOT NULL DEFAULT 10.0,
    "return_rate" DECIMAL(5,2) NOT NULL DEFAULT 12.0,
    "method" "EducationMethod" NOT NULL DEFAULT 'GEOMETRIC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "education_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education_stages" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "level" "SchoolLevel" NOT NULL,
    "cost_type" "CostType" NOT NULL,
    "current_cost" DECIMAL(15,2) NOT NULL,
    "future_cost" DECIMAL(15,2) NOT NULL,
    "years_to_start" INTEGER NOT NULL,
    "monthly_saving" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "education_stages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unit_kerja_kode_unit_key" ON "unit_kerja"("kode_unit");

-- CreateIndex
CREATE UNIQUE INDEX "users_nip_key" ON "users"("nip");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_unit_kerja_id_fkey" FOREIGN KEY ("unit_kerja_id") REFERENCES "unit_kerja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_plans" ADD CONSTRAINT "budget_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_checkups" ADD CONSTRAINT "financial_checkups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_plans" ADD CONSTRAINT "education_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_stages" ADD CONSTRAINT "education_stages_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "education_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
