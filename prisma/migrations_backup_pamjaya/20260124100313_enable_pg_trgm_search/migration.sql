-- This is an empty migration.
-- ===============================================================
-- STEP 1: Enable PostgreSQL Trigram Extension
-- ===============================================================
-- Ekstensi ini menyediakan fungsi similarity(), <-> operator, dll
-- yang dibutuhkan untuk pencarian fuzzy (typo tolerance).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ===============================================================
-- STEP 2: Create GIN Index for Users (Full Name)
-- ===============================================================
-- Index B-Tree standar tidak bisa menangani query "LIKE '%keyword%'".
-- GIN (Generalized Inverted Index) memecah teks menjadi trigram.
-- Operator 'gin_trgm_ops' spesifik memberitahu DB cara mengindeks string ini.
CREATE INDEX IF NOT EXISTS "users_full_name_trgm_idx" 
ON "users" 
USING GIN ("full_name" gin_trgm_ops);

-- ===============================================================
-- STEP 3: Create GIN Index for Unit Kerja (Nama Unit)
-- ===============================================================
-- Mempercepat pencarian unit kerja, misal input "Teknlogi" -> "Teknologi"
CREATE INDEX IF NOT EXISTS "unit_kerja_nama_unit_trgm_idx" 
ON "unit_kerja" 
USING GIN ("nama_unit" gin_trgm_ops);

-- ===============================================================
-- STEP 4: Create GIN Index for User Emails (Optional but Good)
-- ===============================================================
CREATE INDEX IF NOT EXISTS "users_email_trgm_idx" 
ON "users" 
USING GIN ("email" gin_trgm_ops);