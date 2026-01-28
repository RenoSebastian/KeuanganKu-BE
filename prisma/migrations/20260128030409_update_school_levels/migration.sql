/*
  Warnings:

  - The values [PT] on the enum `SchoolLevel` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SchoolLevel_new" AS ENUM ('TK', 'SD', 'SMP', 'SMA', 'S1', 'S2');
ALTER TABLE "education_stages" ALTER COLUMN "level" TYPE "SchoolLevel_new" USING ("level"::text::"SchoolLevel_new");
ALTER TYPE "SchoolLevel" RENAME TO "SchoolLevel_old";
ALTER TYPE "SchoolLevel_new" RENAME TO "SchoolLevel";
DROP TYPE "SchoolLevel_old";
COMMIT;
