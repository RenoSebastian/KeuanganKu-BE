-- [PHASE 2] View Agregasi untuk Garbage Collector
-- Menggabungkan semua referensi file media dari seluruh tabel sistem.
-- Digunakan untuk validasi "Allowlist" saat pembersihan file fisik.

CREATE OR REPLACE VIEW "view_all_media_references" AS
-- 1. User Avatars
SELECT "password_hash" as "id_ref", "avatar" as "file_path", 'user_avatar' as "source_table" 
FROM "users" 
WHERE "avatar" IS NOT NULL AND "avatar" <> ''

UNION ALL

-- 2. Education Category Icons
SELECT "id" as "id_ref", "icon_url" as "file_path", 'edu_category' as "source_table"
FROM "education_categories"
WHERE "icon_url" IS NOT NULL AND "icon_url" <> ''

UNION ALL

-- 3. Education Module Thumbnails
SELECT "id" as "id_ref", "thumbnail_url" as "file_path", 'edu_module' as "source_table"
FROM "education_modules"
WHERE "thumbnail_url" IS NOT NULL AND "thumbnail_url" <> ''

UNION ALL

-- 4. Module Section Illustrations
SELECT "id" as "id_ref", "illustration_url" as "file_path", 'module_section' as "source_table"
FROM "module_sections"
WHERE "illustration_url" IS NOT NULL AND "illustration_url" <> ''

UNION ALL

-- 5. Quiz Question Images
SELECT "id" as "id_ref", "image_url" as "file_path", 'quiz_question' as "source_table"
FROM "quiz_questions"
WHERE "image_url" IS NOT NULL AND "image_url" <> ''

UNION ALL

-- 6. Quiz Option Images
SELECT "id" as "id_ref", "image_url" as "file_path", 'quiz_option' as "source_table"
FROM "quiz_options"
WHERE "image_url" IS NOT NULL AND "image_url" <> '';