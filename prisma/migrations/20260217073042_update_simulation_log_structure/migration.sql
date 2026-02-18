/*
  Warnings:

  - You are about to alter the column `gender` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - Added the required column `client_name` to the `simulation_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `input_payload` to the `simulation_logs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "simulation_logs" ADD COLUMN     "client_name" TEXT NOT NULL,
ADD COLUMN     "input_payload" JSONB NOT NULL,
ADD COLUMN     "output_result" JSONB,
ADD COLUMN     "simulation_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "client_age" DROP NOT NULL,
ALTER COLUMN "client_city" DROP NOT NULL,
ALTER COLUMN "client_job" DROP NOT NULL,
ALTER COLUMN "total_income" DROP NOT NULL,
ALTER COLUMN "calculated_surplus" DROP NOT NULL,
ALTER COLUMN "health_score" DROP NOT NULL,
ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "financial_ratios" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "gender" SET DATA TYPE VARCHAR(50);
