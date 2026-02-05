-- 1. Index untuk Tabel USERS (Nama & NIP)
-- Menggunakan GIN Index agar pencarian LIKE/Similarity super cepat
CREATE INDEX IF NOT EXISTS idx_users_fullname_trgm ON users USING GIN (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_nip_trgm ON users USING GIN (nip gin_trgm_ops);

-- 2. Index untuk Tabel UNIT KERJA
CREATE INDEX IF NOT EXISTS idx_unitkerja_nama_trgm ON unit_kerja USING GIN (nama_unit gin_trgm_ops);