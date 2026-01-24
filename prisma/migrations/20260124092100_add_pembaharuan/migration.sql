-- CreateIndex
CREATE INDEX "financial_checkups_user_id_check_date_idx" ON "financial_checkups"("user_id", "check_date" DESC);

-- CreateIndex
CREATE INDEX "financial_checkups_status_idx" ON "financial_checkups"("status");

-- CreateIndex
CREATE INDEX "users_unit_kerja_id_idx" ON "users"("unit_kerja_id");
