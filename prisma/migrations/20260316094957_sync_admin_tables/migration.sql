-- AlterTable
ALTER TABLE "subscription_orders" ADD COLUMN     "unique_code" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "user_login_histories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "login_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "device_info" TEXT,

    CONSTRAINT "user_login_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashflow_ledgers" (
    "id" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "gross_amount" DECIMAL(15,2) NOT NULL,
    "mrr_amount" DECIMAL(15,2) NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cashflow_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_login_histories_user_id_idx" ON "user_login_histories"("user_id");

-- CreateIndex
CREATE INDEX "user_login_histories_login_at_idx" ON "user_login_histories"("login_at");

-- CreateIndex
CREATE INDEX "cashflow_ledgers_transaction_date_idx" ON "cashflow_ledgers"("transaction_date");

-- CreateIndex
CREATE INDEX "cashflow_ledgers_source_idx" ON "cashflow_ledgers"("source");

-- AddForeignKey
ALTER TABLE "user_login_histories" ADD CONSTRAINT "user_login_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
