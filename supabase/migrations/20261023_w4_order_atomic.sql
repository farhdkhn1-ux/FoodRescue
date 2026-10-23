-- ============================================================================
-- MIGRASI W4: TRANSAKSI PEMESANAN ATOMIK & KEAMANAN DATABASE FOOD RESCUE
-- Tanggal: 23 Oktober 2026
-- Fokus: Skema Privat, Transaksi Atomik, Least Privilege, RLS Anti-Bypass
-- ============================================================================

BEGIN;

-- 1. Skema Terisolasi app_private (Mencegah Eksposur RPC Helper ke PostgREST)
CREATE SCHEMA IF NOT EXISTS app_private;

REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON SCHEMA app_private FROM anon;
GRANT USAGE ON SCHEMA app_private TO authenticated;

-- Helper 1: Evaluasi Role Admin Tanpa Rekursi
CREATE OR REPLACE FUNCTION app_private.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE id = (SELECT auth.uid()) 
      AND role = 'admin'
  );
$$;

-- Helper 2: Evaluasi Kepemilikan Seller Tanpa Membuka Oracle PostgREST
CREATE OR REPLACE FUNCTION app_private.is_order_seller(p_order_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id 
      AND oi.seller_id = (SELECT auth.uid())
  );
$$;

-- Helper 3: Evaluasi Kepemilikan Buyer Tanpa Membuka Oracle PostgREST
CREATE OR REPLACE FUNCTION app_private.is_order_buyer(p_order_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.orders o
    WHERE o.id = p_order_id 
      AND o.buyer_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_order_seller(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_order_buyer(BIGINT) TO authenticated;

-- ============================================================================
-- 2. Proteksi Direct REST API Bypass & Kebijakan RLS
-- ============================================================================

-- Pastikan RLS aktif
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Cabut hak DML langsung pada orders dan order_items dari klien REST
-- Klien dilarang keras INSERT/UPDATE/DELETE langsung; wajib lewat RPC SECURITY DEFINER
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM anon, authenticated, PUBLIC;

-- Cegah eskalasi mandiri kolom role pada tabel users
REVOKE UPDATE (role) ON public.users FROM anon, authenticated, PUBLIC;

-- Berikan hak baca (SELECT) kepada role authenticated (difilter oleh policy RLS)
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;

-- Policy RLS Pembacaan (SELECT)
-- Bersihkan seluruh policy lama (termasuk orders_select_own dan order_items_select)
-- agar tidak terjadi penggabungan permisif (OR) yang membuka akses secara tidak sengaja
DROP POLICY IF EXISTS orders_select_policy ON public.orders;
DROP POLICY IF EXISTS orders_select_own ON public.orders;
DROP POLICY IF EXISTS orders_read_policy ON public.orders;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow authenticated select on orders" ON public.orders;

CREATE POLICY orders_select_policy ON public.orders
FOR SELECT TO authenticated
USING (
  buyer_id = (SELECT auth.uid())
  OR app_private.is_order_seller(id)
  OR app_private.is_admin()
);

DROP POLICY IF EXISTS order_items_select_policy ON public.order_items;
DROP POLICY IF EXISTS order_items_select ON public.order_items;
DROP POLICY IF EXISTS order_items_read_policy ON public.order_items;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.order_items;
DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow authenticated select on order_items" ON public.order_items;

CREATE POLICY order_items_select_policy ON public.order_items
FOR SELECT TO authenticated
USING (
  seller_id = (SELECT auth.uid())
  OR app_private.is_order_buyer(order_id)
  OR app_private.is_admin()
);

-- ============================================================================
-- 3. RPC Pembuatan Pesanan Atomik (public.create_order_atomic)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_food_id BIGINT,
  p_quantity INTEGER,
  p_pickup_method TEXT,
  p_shipping_address TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_buyer_id UUID := (SELECT auth.uid());
  v_buyer_role TEXT;
  v_food RECORD;
  v_order_id BIGINT;
  v_subtotal NUMERIC;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- 1. Verifikasi Autentikasi Pengguna
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Sesi tidak valid atau telah berakhir.' USING ERRCODE = '28000';
  END IF;

  -- 2. Verifikasi Role Pengguna (Hanya 'buyer' dan 'admin' yang sah)
  SELECT role INTO v_buyer_role FROM public.users WHERE id = v_buyer_id;
  IF v_buyer_role IS NULL OR v_buyer_role NOT IN ('buyer', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: Hanya akun pembeli atau admin yang dapat membuat pesanan.' USING ERRCODE = '42501';
  END IF;

  -- 3. Validasi Parameter Input
  IF p_food_id IS NULL OR p_food_id <= 0 THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: ID makanan tidak valid.' USING ERRCODE = '22023';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 1000 THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: Kuantitas harus antara 1 sampai 1000 porsi.' USING ERRCODE = '22023';
  END IF;

  IF p_pickup_method IS NULL OR p_pickup_method NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: Metode pengambilan harus "pickup" atau "delivery".' USING ERRCODE = '22023';
  END IF;

  IF p_pickup_method = 'delivery' AND (p_shipping_address IS NULL OR length(trim(p_shipping_address)) < 5) THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: Alamat pengiriman lengkap wajib diisi untuk delivery (minimal 5 karakter).' USING ERRCODE = '22023';
  END IF;

  -- 4. Kunci Baris Makanan untuk Serialisasi Transaksi (FOR UPDATE)
  SELECT * INTO v_food 
  FROM public.foods 
  WHERE id = p_food_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Menu makanan tidak ditemukan.' USING ERRCODE = 'P0002';
  END IF;

  -- 5. Validasi Aturan Bisnis & Integritas Data
  IF v_food.seller_id = v_buyer_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Penjual dilarang membeli produk makanan miliknya sendiri.' USING ERRCODE = '42501';
  END IF;

  IF v_food.status <> 'available' THEN
    RAISE EXCEPTION 'CONFLICT: Porsi makanan ini sudah habis atau tidak tersedia.' USING ERRCODE = '23514';
  END IF;

  IF (v_food.available_from IS NOT NULL AND v_now < v_food.available_from)
     OR (v_food.available_until IS NOT NULL AND v_now > v_food.available_until) THEN
    RAISE EXCEPTION 'CONFLICT: Makanan sudah melewati batas waktu ketersediaan atau belum dibuka.' USING ERRCODE = '23514';
  END IF;

  IF v_food.quantity < p_quantity THEN
    RAISE EXCEPTION 'CONFLICT: Jumlah porsi yang diminta (%) melebihi sisa stok yang tersedia (%).', p_quantity, v_food.quantity USING ERRCODE = '23514';
  END IF;

  IF v_food.pickup_method <> 'both' AND v_food.pickup_method <> p_pickup_method THEN
    RAISE EXCEPTION 'CONFLICT: Pilihan metode "%" tidak didukung oleh menu ini (hanya mendukung "%").', p_pickup_method, v_food.pickup_method USING ERRCODE = '22023';
  END IF;

  -- 6. Kalkulasi Harga dan Total di Sisi Server Database
  IF lower(trim(COALESCE(v_food.type, 'sale'))) = 'donation' THEN
    v_subtotal := 0;
  ELSE
    IF v_food.price IS NULL OR v_food.price < 0 THEN
      RAISE EXCEPTION 'CONFLICT: Nilai harga makanan pada katalog tidak valid.' USING ERRCODE = '23514';
    END IF;
    v_subtotal := v_food.price * p_quantity;
  END IF;

  -- 7. Simpan Pesanan (orders)
  INSERT INTO public.orders (
    buyer_id,
    total_amount,
    status,
    pickup_method,
    shipping_address,
    created_at,
    updated_at
  ) VALUES (
    v_buyer_id,
    v_subtotal,
    'pending',
    p_pickup_method,
    CASE WHEN p_pickup_method = 'delivery' THEN trim(p_shipping_address) ELSE NULL END,
    v_now,
    v_now
  ) RETURNING id INTO v_order_id;

  -- 8. Simpan Rincian Item (order_items)
  INSERT INTO public.order_items (
    order_id,
    food_id,
    seller_id,
    quantity,
    price,
    subtotal
  ) VALUES (
    v_order_id,
    v_food.id,
    v_food.seller_id,
    p_quantity,
    CASE WHEN lower(trim(COALESCE(v_food.type, 'sale'))) = 'donation' THEN 0 ELSE v_food.price END,
    v_subtotal
  );

  -- 9. Kurangi Stok dan Perbarui Status Makanan Secara Atomik
  UPDATE public.foods
  SET 
    quantity = quantity - p_quantity,
    status = CASE WHEN quantity - p_quantity <= 0 THEN 'sold_out' ELSE status END
  WHERE id = v_food.id AND quantity >= p_quantity;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONFLICT: Stok makanan tidak mencukupi untuk memenuhi pesanan.' USING ERRCODE = '23514';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'food_id', v_food.id,
    'food_name', v_food.name,
    'quantity', p_quantity,
    'total_amount', v_subtotal,
    'status', 'pending',
    'pickup_method', p_pickup_method
  );
END;
$$;

-- ============================================================================
-- 4. RPC Pembatalan Pesanan Atomik (public.cancel_order_atomic)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cancel_order_atomic(
  p_order_id BIGINT,
  p_reason TEXT DEFAULT 'Dibatalkan',
  p_restock BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_user_role TEXT;
  v_order RECORD;
  v_item RECORD;
  v_is_seller BOOLEAN := false;
  v_is_buyer BOOLEAN := false;
  v_actual_restock BOOLEAN := COALESCE(p_restock, true);
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Sesi tidak valid atau telah berakhir.' USING ERRCODE = '28000';
  END IF;

  IF p_order_id IS NULL OR p_order_id <= 0 THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: ID pesanan tidak valid.' USING ERRCODE = '22023';
  END IF;

  SELECT role INTO v_user_role FROM public.users WHERE id = v_user_id;

  -- Kunci baris pesanan untuk serialisasi pembatalan (FOR UPDATE)
  -- Mencegah kondisi race / pembatalan ganda / pemulihan stok ganda secara bersamaan
  SELECT * INTO v_order 
  FROM public.orders 
  WHERE id = p_order_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Pesanan tidak ditemukan.' USING ERRCODE = 'P0002';
  END IF;

  -- Lindungi status terminal (Immutable)
  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'CONFLICT: Pesanan ini sudah dibatalkan sebelumnya.' USING ERRCODE = '23514';
  END IF;

  IF v_order.status = 'completed' THEN
    RAISE EXCEPTION 'CONFLICT: Pesanan yang sudah selesai tidak dapat dibatalkan.' USING ERRCODE = '23514';
  END IF;

  -- Verifikasi Kepemilikan & Relasi Pesanan
  v_is_buyer := (v_order.buyer_id = v_user_id);
  v_is_seller := EXISTS (
    SELECT 1 FROM public.order_items WHERE order_id = p_order_id AND seller_id = v_user_id
  );

  -- Pencegahan Celah Otorisasi: Pengguna terasosiasi sebagai Buyer sekaligus Seller
  IF v_is_buyer AND v_is_seller AND v_user_role <> 'admin' THEN
    RAISE EXCEPTION 'FORBIDDEN: Transaksi tidak valid (pengguna terdeteksi sebagai pembeli sekaligus penjual pada pesanan ini).' USING ERRCODE = '42501';
  END IF;

  -- Evaluasi Otorisasi Eksplisit per Role & Proteksi Kehilangan Stok:
  IF v_user_role = 'admin' THEN
    -- Admin: Berhak membatalkan pesanan pending atau confirmed
    IF v_order.status NOT IN ('pending', 'confirmed') THEN
      RAISE EXCEPTION 'CONFLICT: Admin hanya dapat membatalkan pesanan yang belum selesai (pending atau confirmed).' USING ERRCODE = '23514';
    END IF;
    -- Proteksi Stok: Jika admin menonaktifkan restock, wajib sertakan alasan tertulis untuk audit trail
    IF NOT v_actual_restock AND length(trim(COALESCE(p_reason, ''))) < 5 THEN
      RAISE EXCEPTION 'INVALID_ARGUMENT: Pembatalan tanpa pemulihan stok oleh Admin memerlukan alasan tertulis minimal 5 karakter.' USING ERRCODE = '22023';
    END IF;

  ELSIF v_is_seller AND NOT v_is_buyer THEN
    -- Seller: Berhak membatalkan/menolak pesanan tokonya pada status pending atau confirmed
    IF v_order.status NOT IN ('pending', 'confirmed') THEN
      RAISE EXCEPTION 'CONFLICT: Penjual hanya dapat membatalkan pesanan berstatus pending atau confirmed.' USING ERRCODE = '23514';
    END IF;
    -- Proteksi Stok: Penjual boleh membatalkan tanpa restock HANYA jika makanan rusak/afkir/tidak layak jual,
    -- dan WAJIB menyertakan keterangan alasan yang sah minimal 5 karakter agar tidak terjadi stock leakage.
    IF NOT v_actual_restock AND length(trim(COALESCE(p_reason, ''))) < 5 THEN
      RAISE EXCEPTION 'INVALID_ARGUMENT: Pembatalan tanpa pemulihan stok (makanan rusak/afkir) mewajibkan alasan tertulis minimal 5 karakter.' USING ERRCODE = '22023';
    END IF;

  ELSIF v_is_buyer AND NOT v_is_seller THEN
    -- Buyer: Hanya berhak membatalkan pesanan miliknya saat masih berstatus pending
    IF v_order.status <> 'pending' THEN
      RAISE EXCEPTION 'FORBIDDEN: Pesanan yang telah dikonfirmasi penjual tidak dapat dibatalkan oleh pembeli.' USING ERRCODE = '42501';
    END IF;
    -- Proteksi Stok: Pembeli TIDAK BERHAK menghilangkan stok fisik milik mitra penjual.
    -- Parameter p_restock dari pembeli selalu dipaksa menjadi TRUE terlepas dari nilai input.
    v_actual_restock := true;

  ELSE
    -- Pengguna lain tanpa hak akses (kurir, pembeli lain, atau peran tidak dikenal)
    RAISE EXCEPTION 'FORBIDDEN: Anda tidak memiliki wewenang membatalkan pesanan ini.' USING ERRCODE = '42501';
  END IF;

  -- Mutasi Status Pesanan Menjadi 'cancelled'
  UPDATE public.orders
  SET 
    status = 'cancelled',
    updated_at = v_now
  WHERE id = p_order_id;

  -- Pemulihan Stok Atomik (Urutkan ID untuk Pencegahan Deadlock)
  IF v_actual_restock THEN
    FOR v_item IN 
      SELECT food_id, SUM(quantity) AS total_qty
      FROM public.order_items
      WHERE order_id = p_order_id
      GROUP BY food_id
      ORDER BY food_id ASC
    LOOP
      UPDATE public.foods f
      SET 
        quantity = f.quantity + v_item.total_qty,
        -- Anti-Zombie: Hanya aktifkan kembali jika BELUM kedaluwarsa atau tanpa batas waktu
        status = CASE 
          WHEN f.status = 'sold_out' AND (f.available_until IS NULL OR f.available_until > v_now) THEN 'available'
          ELSE f.status 
        END
      WHERE f.id = v_item.food_id;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'status', 'cancelled',
    'restocked', v_actual_restock
  );
END;
$$;

-- ============================================================================
-- 5. RPC Pembaruan Status Pesanan (public.update_order_status)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id BIGINT,
  p_target_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_user_role TEXT;
  v_order RECORD;
  v_is_seller BOOLEAN := false;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Sesi tidak valid atau telah berakhir.' USING ERRCODE = '28000';
  END IF;

  IF p_target_status IS NULL OR p_target_status NOT IN ('confirmed', 'completed') THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: Status target harus "confirmed" atau "completed". Pembatalan wajib menggunakan cancel_order_atomic.' USING ERRCODE = '22023';
  END IF;

  SELECT role INTO v_user_role FROM public.users WHERE id = v_user_id;

  SELECT * INTO v_order 
  FROM public.orders 
  WHERE id = p_order_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Pesanan tidak ditemukan.' USING ERRCODE = 'P0002';
  END IF;

  -- Pencegahan Celah Otorisasi: Pembeli dilarang mengonfirmasi atau menyelesaikan pesanan
  IF v_order.buyer_id = v_user_id AND v_user_role <> 'admin' THEN
    RAISE EXCEPTION 'FORBIDDEN: Pembeli dilarang mengubah status pemrosesan pesanannya sendiri.' USING ERRCODE = '42501';
  END IF;

  v_is_seller := EXISTS (
    SELECT 1 FROM public.order_items WHERE order_id = p_order_id AND seller_id = v_user_id
  );

  -- Transisi: pending -> confirmed (Hanya Penjual Terkait atau Admin)
  IF p_target_status = 'confirmed' THEN
    IF v_order.status <> 'pending' THEN
      RAISE EXCEPTION 'CONFLICT: Hanya pesanan berstatus "pending" yang dapat dikonfirmasi.' USING ERRCODE = '23514';
    END IF;
    IF NOT (v_is_seller OR v_user_role = 'admin') THEN
      RAISE EXCEPTION 'FORBIDDEN: Hanya mitra penjual pemilik makanan atau admin yang dapat mengonfirmasi pesanan.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Transisi: confirmed -> completed (Penjual Terkait atau Admin setelah serah-terima W4)
  IF p_target_status = 'completed' THEN
    IF v_order.status <> 'confirmed' THEN
      RAISE EXCEPTION 'CONFLICT: Hanya pesanan berstatus "confirmed" yang dapat diselesaikan.' USING ERRCODE = '23514';
    END IF;
    -- Sesuai Aturan Bisnis W4: Buyer tidak boleh menyelesaikan sendiri via RPC; Courier belum memiliki hak di W4
    IF NOT (v_is_seller OR v_user_role = 'admin') THEN
      RAISE EXCEPTION 'FORBIDDEN: Hanya penjual atau admin yang berhak menandai pesanan selesai pada tahap ini.' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.orders
  SET 
    status = p_target_status,
    updated_at = v_now
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'status', p_target_status
  );
END;
$$;

-- ============================================================================
-- 6. Hak Akses Eksekusi (Privileges)
-- ============================================================================
REVOKE ALL ON FUNCTION public.create_order_atomic(BIGINT, INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_order_atomic(BIGINT, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_order_status(BIGINT, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_order_atomic(BIGINT, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_atomic(BIGINT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_status(BIGINT, TEXT) TO authenticated;

COMMIT;
