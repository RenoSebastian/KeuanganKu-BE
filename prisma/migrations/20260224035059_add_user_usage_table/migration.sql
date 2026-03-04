-- CreateTable
CREATE TABLE "user_usages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_count" INTEGER NOT NULL DEFAULT 0,
    "client_limit" INTEGER NOT NULL DEFAULT 5,
    "simulation_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_usages_user_id_key" ON "user_usages"("user_id");

-- AddForeignKey
ALTER TABLE "user_usages" ADD CONSTRAINT "user_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
