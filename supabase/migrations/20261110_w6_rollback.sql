-- ============================================================================
-- ROLLBACK W6: PEMBATALAN REFACTOR ANIMAL FEED
-- Tanggal: 10 November 2026
-- Perhatian: Rollback ini AMAN dan TIDAK MENGHAPUS kolom atau data yang sudah
--            ada sebelum migrasi W6 (seperti phone, address, latitude, longitude,
--            maupun catatan pesanan dan notifikasi pengguna).
-- ============================================================================

BEGIN;

-- 1. Hapus Indeks Performa W6
DROP INDEX IF EXISTS public.idx_foods_condition_target;
DROP INDEX IF EXISTS public.idx_users_seller_coords;

-- 2. Hapus Helper RPC dan View W6
DROP FUNCTION IF EXISTS public.get_seller_public_profile(UUID);
DROP VIEW IF EXISTS public.seller_public_profiles;

-- 3. Hapus Constraint dan Kolom Khusus W6 pada Tabel public.foods
ALTER TABLE public.foods DROP CONSTRAINT IF EXISTS foods_condition_check;

ALTER TABLE public.foods
  DROP COLUMN IF EXISTS collected_at,
  DROP COLUMN IF EXISTS storage_instructions,
  DROP COLUMN IF EXISTS target_livestock,
  DROP COLUMN IF EXISTS condition,
  DROP COLUMN IF EXISTS unit;

-- 4. Hapus Kolom Tambahan W6 pada Tabel public.users (HANYA kolom W6)
-- Catatan: Kolom phone, address, latitude, longitude TIDAK DIHAPUS karena merupakan
--          data profil penting yang digunakan sejak fase sebelumnya (W1-W5).
ALTER TABLE public.users
  DROP COLUMN IF EXISTS is_phone_public,
  DROP COLUMN IF EXISTS store_name;

COMMIT;
