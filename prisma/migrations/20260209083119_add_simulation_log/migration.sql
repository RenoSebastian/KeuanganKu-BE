-- AlterTable
-- Menambahkan kolom baru jika ada perubahan di tabel user (saat ini tidak ada kolom baru, hanya relasi virtual)

-- CreateTable
CREATE TABLE "simulation_logs" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "client_age" INTEGER NOT NULL,
    "client_city" TEXT NOT NULL,
    "client_job" TEXT NOT NULL,
    "total_income" DECIMAL(15,2) NOT NULL,
    "calculated_surplus" DECIMAL(15,2) NOT NULL,
    "health_score" INTEGER NOT NULL,
    "status" "HealthStatus" NOT NULL DEFAULT 'BAHAYA',
    "financial_ratios" JSONB NOT NULL,
    "module_type" TEXT NOT NULL DEFAULT 'BUDGETING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "simulation_logs_client_city_client_job_idx" ON "simulation_logs"("client_city", "client_job");

-- CreateIndex
CREATE INDEX "simulation_logs_agent_id_idx" ON "simulation_logs"("agent_id");

-- CreateIndex
CREATE INDEX "simulation_logs_created_at_idx" ON "simulation_logs"("created_at");

-- AddForeignKey
ALTER TABLE "simulation_logs" ADD CONSTRAINT "simulation_logs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;