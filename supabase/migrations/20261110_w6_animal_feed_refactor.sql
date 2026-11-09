-- ============================================================================
-- MIGRASI W6 FINAL: REFACTOR FOOD RESCUE — FOOD WASTE TO ANIMAL FEED
-- Tanggal: 10 November 2026
-- Fokus:
--   1. Profil Toko & Usaha Seller (store_name, phone, is_phone_public, updated_at)
--   2. Listing Karakteristik Pakan Ternak (unit, condition, target_livestock, storage_instructions, collected_at)
--   3. Policy RLS & Proteksi Anti-Eskalasi Role pada public.users
--   4. Public Seller Profile View & RPC Zero-Trust (Masking nomor telepon)
--   5. Idempotensi Kategori Bahan Pakan Ternak Awal (ON CONFLICT)
--   6. Indeks Performa Koordinat Seller & Filter Bahan Pakan
--   7. Reload PostgREST Schema Cache (Menghilangkan error schema cache di Supabase)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Penambahan Kolom Profil Toko & Usaha pada Tabel public.users
-- ----------------------------------------------------------------------------
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS store_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS is_phone_public BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

COMMENT ON COLUMN public.users.store_name IS 'Nama toko, restoran, katering, atau unit usaha sumber bahan pangan berlebih';
COMMENT ON COLUMN public.users.phone IS 'Nomor kontak/WhatsApp resmi toko atau usaha seller';
COMMENT ON COLUMN public.users.is_phone_public IS 'Izin publikasi nomor telepon seller kepada publik/pembeli terautentikasi (Zero-Trust Privacy)';
COMMENT ON COLUMN public.users.updated_at IS 'Waktu terakhir pembaruan profil pengguna atau toko';

-- ----------------------------------------------------------------------------
-- 2. Kebijakan Row Level Security (RLS) pada Tabel public.users
-- ----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Proteksi eskalasi hak akses: cegah manipulasi kolom role oleh pengguna
REVOKE UPDATE (role) ON public.users FROM anon, authenticated, PUBLIC;

-- Izinkan pengguna terautentikasi memperbarui profil miliknya sendiri (alamat, koordinat, toko, phone)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_update_own_profile'
  ) THEN
    CREATE POLICY users_update_own_profile ON public.users
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_read_own_profile'
  ) THEN
    CREATE POLICY users_read_own_profile ON public.users
      FOR SELECT
      TO authenticated
      USING (auth.uid() = id);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Penambahan Kolom Karakteristik Bahan Pakan Ternak pada Tabel public.foods
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 4. View Profil Publik Seller (Zero-Trust Data Protection)
-- ----------------------------------------------------------------------------
-- Hapus tanpa CASCADE agar tidak merusak objek database dependen lain
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

-- ----------------------------------------------------------------------------
-- 5. RPC Helper: Mengambil Profil Publik Seller Tunggal (Zero-Trust)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 6. Kategori Awal Bahan Pakan Ternak (Food Waste to Animal Feed)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 7. Indeks Performa untuk Pencarian & Filter Lokasi
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_seller_coords 
  ON public.users (latitude, longitude) 
  WHERE role IN ('seller', 'admin');

CREATE INDEX IF NOT EXISTS idx_foods_condition_target 
  ON public.foods (condition, target_livestock, status);

-- ----------------------------------------------------------------------------
-- 8. Muat Ulang Schema Cache PostgREST
-- ----------------------------------------------------------------------------
-- Menginstruksikan PostgREST untuk memuat ulang skema seketika,
-- menyelesaikan error: "Could not find the 'xyz' column of 'users' in the schema cache".
NOTIFY pgrst, 'reload schema';

COMMIT;
