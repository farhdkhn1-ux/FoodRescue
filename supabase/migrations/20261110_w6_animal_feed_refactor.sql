-- ============================================================================
-- MIGRASI W6: REFACTOR FOOD RESCUE — FOOD WASTE TO ANIMAL FEED
-- Tanggal: 10 November 2026
-- Fokus: Profil Toko & Lokasi Seller (store_name, phone, is_phone_public),
--        Listing Karakteristik Bahan Pakan Ternak (unit, condition, target_livestock, storage_instructions),
--        Public Seller Profile View & RPC Zero-Trust (Masking nomor telepon),
--        Kategori Bahan Pakan Ternak Awal,
--        dan Proteksi Integritas Data Penjemputan
-- ============================================================================

BEGIN;

-- 1. Penambahan Kolom Profil Toko & Usaha pada Tabel public.users
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS store_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS is_phone_public BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users.store_name IS 'Nama toko, restoran, katering, atau unit usaha sumber bahan pangan berlebih';
COMMENT ON COLUMN public.users.phone IS 'Nomor kontak/WhatsApp resmi toko atau usaha seller';
COMMENT ON COLUMN public.users.is_phone_public IS 'Izin publikasi nomor telepon seller kepada publik/pembeli terautentikasi (Zero-Trust Privacy)';

-- 2. Penambahan Kolom Karakteristik Bahan Pakan Ternak pada Tabel public.foods
ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS condition TEXT NOT NULL DEFAULT 'layak',
  ADD COLUMN IF NOT EXISTS target_livestock TEXT DEFAULT 'Semua Ternak',
  ADD COLUMN IF NOT EXISTS storage_instructions TEXT,
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ DEFAULT now();

-- Normalisasi nilai condition yang ada sebelum menerapkan CHECK constraint kondisi fisik
UPDATE public.foods 
SET condition = 'layak' 
WHERE condition IS NULL OR condition NOT IN ('layak', 'segar', 'fermentasi', 'kering', 'basah', 'afkir');

-- Hapus constraint lama jika ada, lalu terapkan constraint kondisi fisik pakan
ALTER TABLE public.foods DROP CONSTRAINT IF EXISTS foods_condition_check;

ALTER TABLE public.foods 
  ADD CONSTRAINT foods_condition_check 
  CHECK (condition IN ('layak', 'segar', 'fermentasi', 'kering', 'basah', 'afkir'));

COMMENT ON COLUMN public.foods.unit IS 'Satuan jumlah bahan pangan: kg, gram, liter, karung, ember, porsi';
COMMENT ON COLUMN public.foods.condition IS 'Status kondisi fisik bahan: layak, segar, fermentasi, kering, basah, afkir';
COMMENT ON COLUMN public.foods.target_livestock IS 'Rekomendasi jenis ternak: Unggas/Ayam, Sapi/Ruminansia, Kambing/Domba, Ikan, Babi, Semua Ternak';
COMMENT ON COLUMN public.foods.storage_instructions IS 'Petunjuk penanganan dan penyimpanan bahan agar tidak membusuk';
COMMENT ON COLUMN public.foods.collected_at IS 'Waktu pengumpulan atau penyelesaian produksi bahan pangan berlebih';

-- 3. View Profil Publik Seller (Zero-Trust Data Protection)
-- Tanpa CASCADE agar tidak merusak objek dependent lain jika ada
DROP VIEW IF EXISTS public.seller_public_profiles;

CREATE OR REPLACE VIEW public.seller_public_profiles AS
SELECT 
  u.id,
  COALESCE(u.store_name, 'Sumber Bahan #' || substr(u.id::text, 1, 8)) AS store_name,
  u.address,
  u.latitude,
  u.longitude,
  -- Masking nomor telepon: hanya ditampilkan untuk user terautentikasi jika seller mengizinkan (is_phone_public) atau seller sendiri
  CASE 
    WHEN (SELECT auth.uid()) IS NOT NULL AND (u.is_phone_public = TRUE OR (SELECT auth.uid()) = u.id)
    THEN u.phone
    ELSE NULL
  END AS phone,
  COALESCE(u.is_phone_public, FALSE) AS is_phone_public,
  CASE 
    WHEN u.store_name IS NOT NULL AND u.address IS NOT NULL AND u.latitude IS NOT NULL AND u.longitude IS NOT NULL 
    THEN TRUE 
    ELSE FALSE 
  END AS is_location_complete
FROM public.users u
WHERE u.role IN ('seller', 'admin');

REVOKE ALL ON public.seller_public_profiles FROM PUBLIC;
GRANT SELECT ON public.seller_public_profiles TO anon, authenticated;

-- 4. RPC Helper: Mengambil Profil Publik Seller Tunggal (Zero-Trust)
CREATE OR REPLACE FUNCTION public.get_seller_public_profile(p_seller_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', u.id,
    'store_name', COALESCE(u.store_name, 'Sumber Bahan #' || substr(u.id::text, 1, 8)),
    'address', u.address,
    'latitude', u.latitude,
    'longitude', u.longitude,
    'phone', CASE 
               WHEN (SELECT auth.uid()) IS NOT NULL AND (u.is_phone_public = TRUE OR (SELECT auth.uid()) = u.id) 
               THEN u.phone 
               ELSE NULL 
             END,
    'is_phone_public', COALESCE(u.is_phone_public, FALSE),
    'is_location_complete', (
      u.store_name IS NOT NULL AND 
      u.address IS NOT NULL AND 
      u.latitude IS NOT NULL AND 
      u.longitude IS NOT NULL
    )
  )
  FROM public.users u
  WHERE u.id = p_seller_id AND u.role IN ('seller', 'admin');
$$;

REVOKE ALL ON FUNCTION public.get_seller_public_profile(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_seller_public_profile(UUID) TO anon, authenticated;

-- 5. Kategori Awal Bahan Pakan Ternak (Food Waste to Animal Feed)
-- Verifikasi keberadaan unique constraint pada categories.name sebelum ON CONFLICT (name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public' 
      AND rel.relname = 'categories' 
      AND con.contype = 'u'
      AND pg_get_constraintdef(con.oid) LIKE '%(name)%'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_index idx
    JOIN pg_class rel ON rel.oid = idx.indrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_class idxrel ON idxrel.oid = idx.indexrelid
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'categories'
      AND idx.indisunique = TRUE
      AND pg_get_indexdef(idx.indexrelid) LIKE '%(name)%'
  ) THEN
    ALTER TABLE public.categories ADD CONSTRAINT categories_name_key UNIQUE (name);
  END IF;
END $$;

INSERT INTO public.categories (name)
VALUES 
  ('Sisa Nasi & Biji-bijian'),
  ('Sisa Sayuran & Buah Segar'),
  ('Ampas Tahu'),
  ('Ampas Kelapa'),
  ('Sisa Roti & Produk Olahan Tepung'),
  ('Bahan Pakan Berlebih Olahan'),
  ('Limbah Organik Segar Lainnya')
ON CONFLICT (name) DO NOTHING;

-- 6. Indeks Performa untuk Pencarian & Filter Lokasi
CREATE INDEX IF NOT EXISTS idx_users_seller_coords 
  ON public.users (latitude, longitude) 
  WHERE role IN ('seller', 'admin');

CREATE INDEX IF NOT EXISTS idx_foods_condition_target 
  ON public.foods (condition, target_livestock, status);

COMMIT;
