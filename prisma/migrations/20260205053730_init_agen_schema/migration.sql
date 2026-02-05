-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'DIRECTOR');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('SEHAT', 'WASPADA', 'BAHAYA');

-- CreateEnum
CREATE TYPE "EducationMethod" AS ENUM ('ARITHMETIC', 'GEOMETRIC');

-- CreateEnum
CREATE TYPE "SchoolLevel" AS ENUM ('TK', 'SD', 'SMP', 'SMA', 'S1', 'S2');

-- CreateEnum
CREATE TYPE "CostType" AS ENUM ('ENTRY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "InsuranceType" AS ENUM ('LIFE', 'HEALTH', 'CRITICAL_ILLNESS');

-- CreateEnum
CREATE TYPE "EducationModuleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EducationProgressStatus" AS ENUM ('STARTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "QuizQuestionType" AS ENUM ('SINGLE_CHOICE');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

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
    "avatar" TEXT,
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_profile" JSONB NOT NULL,
    "spouse_profile" JSONB,
    "asset_cash" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "asset_home" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "asset_vehicle" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "asset_jewelry" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "asset_antique" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "asset_personal_other" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "asset_inv_home" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "asset_inv_vehicle" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "asset_gold" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "asset_inv_antique" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "asset_stocks" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "asset_mutual_fund" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "asset_bonds" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "asset_deposit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "asset_inv_other" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "debt_kpr" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "debt_kpm" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "debt_cc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "debt_coop" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "debt_consumptive_other" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "debt_business" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "income_fixed" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "income_variable" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "installment_kpr" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "installment_kpm" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "installment_cc" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "installment_coop" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "installment_consumptive_other" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "installment_business" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "insurance_life" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "insurance_health" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "insurance_home" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "insurance_vehicle" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "insurance_bpjs" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "insurance_other" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "saving_education" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "saving_retirement" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "saving_pilgrimage" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "saving_holiday" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "saving_emergency" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "saving_other" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "expense_food" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "expense_school" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "expense_transport" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "expense_communication" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "expense_helpers" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "expense_tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "expense_lifestyle" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "expense_other" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_net_worth" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "surplus_deficit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "health_score" INTEGER NOT NULL DEFAULT 0,
    "status" "HealthStatus" NOT NULL DEFAULT 'BAHAYA',
    "ratios_details" JSONB NOT NULL,

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
    "updated_at" TIMESTAMP(3) NOT NULL,

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

-- CreateTable
CREATE TABLE "pension_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
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
    "updated_at" TIMESTAMP(3) NOT NULL,
    "type" "InsuranceType" NOT NULL DEFAULT 'LIFE',
    "dependent_count" INTEGER NOT NULL DEFAULT 0,
    "monthly_expense" DECIMAL(15,2) NOT NULL,
    "existing_debt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "existing_coverage" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "protection_duration" INTEGER NOT NULL DEFAULT 10,
    "inflation_rate" DECIMAL(5,2) NOT NULL DEFAULT 5.0,
    "return_rate" DECIMAL(5,2) NOT NULL DEFAULT 7.0,
    "finalExpense" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "coverage_needed" DECIMAL(15,2) NOT NULL,
    "recommendation" TEXT,

    CONSTRAINT "insurance_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "goal_name" TEXT NOT NULL,
    "target_amount" DECIMAL(15,2) NOT NULL,
    "target_date" TIMESTAMP(3) NOT NULL,
    "inflation_rate" DECIMAL(5,2) NOT NULL DEFAULT 5.0,
    "return_rate" DECIMAL(5,2) NOT NULL DEFAULT 6.0,
    "future_value" DECIMAL(15,2) NOT NULL,
    "monthly_saving" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "goal_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gold_price_histories" (
    "id" TEXT NOT NULL,
    "buy_price" DECIMAL(10,2) NOT NULL,
    "sell_price" DECIMAL(10,2) NOT NULL,
    "open_price" DECIMAL(10,2),
    "change_amount" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "unit" TEXT NOT NULL DEFAULT 'GRAM',
    "source" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gold_price_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_logs" (
    "id" TEXT NOT NULL,
    "executor_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STARTED',
    "records_deleted" INTEGER NOT NULL DEFAULT 0,
    "cutoff_date" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "retention_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" VARCHAR(255),
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
    "level" "EducationLevel" NOT NULL DEFAULT 'BEGINNER',
    "points" INTEGER NOT NULL DEFAULT 0,
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
    "quiz_score" INTEGER,
    "quiz_attempts" INTEGER NOT NULL DEFAULT 0,
    "is_passed" BOOLEAN NOT NULL DEFAULT false,
    "last_quiz_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),

    CONSTRAINT "user_education_progress_pkey" PRIMARY KEY ("user_id","module_id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "passing_score" INTEGER NOT NULL DEFAULT 70,
    "time_limit" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "type" "QuizQuestionType" NOT NULL DEFAULT 'SINGLE_CHOICE',
    "image_url" TEXT,
    "points" INTEGER NOT NULL DEFAULT 10,
    "order_index" INTEGER NOT NULL,
    "explanation" TEXT,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_options" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "option_text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "image_url" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quiz_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unit_kerja_kode_unit_key" ON "unit_kerja"("kode_unit");

-- CreateIndex
CREATE UNIQUE INDEX "users_nip_key" ON "users"("nip");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_unit_kerja_id_idx" ON "users"("unit_kerja_id");

-- CreateIndex
CREATE INDEX "financial_checkups_user_id_check_date_idx" ON "financial_checkups"("user_id", "check_date" DESC);

-- CreateIndex
CREATE INDEX "financial_checkups_status_idx" ON "financial_checkups"("status");

-- CreateIndex
CREATE INDEX "gold_price_histories_fetched_at_idx" ON "gold_price_histories"("fetched_at");

-- CreateIndex
CREATE INDEX "retention_logs_started_at_idx" ON "retention_logs"("started_at");

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

-- CreateIndex
CREATE UNIQUE INDEX "quizzes_module_id_key" ON "quizzes"("module_id");

-- CreateIndex
CREATE INDEX "quiz_questions_quiz_id_idx" ON "quiz_questions"("quiz_id");

-- CreateIndex
CREATE INDEX "quiz_options_question_id_idx" ON "quiz_options"("question_id");

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

-- AddForeignKey
ALTER TABLE "pension_plans" ADD CONSTRAINT "pension_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_plans" ADD CONSTRAINT "insurance_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_plans" ADD CONSTRAINT "goal_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retention_logs" ADD CONSTRAINT "retention_logs_executor_id_fkey" FOREIGN KEY ("executor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_modules" ADD CONSTRAINT "education_modules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "education_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_sections" ADD CONSTRAINT "module_sections_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "education_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_education_progress" ADD CONSTRAINT "user_education_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_education_progress" ADD CONSTRAINT "user_education_progress_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "education_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_education_progress" ADD CONSTRAINT "user_education_progress_last_read_section_id_fkey" FOREIGN KEY ("last_read_section_id") REFERENCES "module_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "education_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_options" ADD CONSTRAINT "quiz_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
