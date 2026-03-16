/*
  Warnings:

  - You are about to drop the column `imageUrls` on the `module_sections` table. All the data in the column will be lost.

*/

DROP VIEW IF EXISTS "view_all_media_references" CASCADE;

-- AlterTable
ALTER TABLE "module_sections" DROP COLUMN "imageUrls",
ADD COLUMN     "image_urls" TEXT[];
