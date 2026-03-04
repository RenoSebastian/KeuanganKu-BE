-- CreateTable
CREATE TABLE "global_market_settings" (
    "id" TEXT NOT NULL,
    "inflation_rate" DECIMAL(5,2) NOT NULL DEFAULT 5.0,
    "interest_rate" DECIMAL(5,2) NOT NULL DEFAULT 4.5,
    "risk_free_rate" DECIMAL(5,2) NOT NULL DEFAULT 6.0,
    "gold_price" DECIMAL(15,2) NOT NULL DEFAULT 1000000,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "global_market_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_activity_logs" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "entity_name" TEXT NOT NULL,
    "entity_id" TEXT,
    "changes" JSONB NOT NULL,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_activity_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "admin_activity_logs" ADD CONSTRAINT "admin_activity_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
