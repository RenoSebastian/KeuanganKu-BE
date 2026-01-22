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

-- CreateIndex
CREATE INDEX "gold_price_histories_fetched_at_idx" ON "gold_price_histories"("fetched_at");
