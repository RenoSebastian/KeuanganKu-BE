-- 1. Pastikan Extension Aktif
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Index untuk Users (Full Name & Email)
-- Menggunakan GIST dengan gist_trgm_ops untuk mendukung operator <-> (Distance Sorting)
CREATE INDEX IF NOT EXISTS idx_users_fullname_trgm 
ON users 
USING GIST (full_name gist_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_email_trgm 
ON users 
USING GIST (email gist_trgm_ops);

-- 3. Index untuk Unit Kerja (Nama Unit & Kode Unit)
CREATE INDEX IF NOT EXISTS idx_unit_nama_trgm 
ON unit_kerja 
USING GIST (nama_unit gist_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_unit_kode_trgm 
ON unit_kerja 
USING GIST (kode_unit gist_trgm_ops);