-- CreateTable
CREATE TABLE "retention_logs" (
    "id" TEXT NOT NULL,
    "executor_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'PRUNE',
    "records_deleted" INTEGER NOT NULL,
    "cutoff_date" TIMESTAMP(3) NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "retention_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "retention_logs_executed_at_idx" ON "retention_logs"("executed_at");

-- AddForeignKey
ALTER TABLE "retention_logs" ADD CONSTRAINT "retention_logs_executor_id_fkey" FOREIGN KEY ("executor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;