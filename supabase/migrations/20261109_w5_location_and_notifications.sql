-- ============================================================================
-- MIGRASI W5: NOTIFIKASI OTOMATIS & INTEGRASI REALTIME FOOD RESCUE
-- Tanggal: 09 November 2026
-- Fokus: Tabel notifications, RLS Zero-Trust, Trigger Notifikasi Transaksional,
--        Pencegahan Duplikasi Buyer, Notifikasi Multi-Seller, Supabase Realtime,
--        dan Otorisasi Akses Pengantaran Kurir (Delivery)
-- ============================================================================

BEGIN;

-- 1. Tabel Notifikasi (public.notifications)
CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'order_status' CHECK (type IN ('order_status', 'delivery', 'system')),
  order_id BIGINT REFERENCES public.orders(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indeks performa untuk unread count & sorting kronologis
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON public.notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_order_id 
  ON public.notifications (order_id);

-- 2. Hak Akses & RLS Ketat (Least Privilege & Zero-Trust)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Cabut seluruh akses DML dari publik & anon
REVOKE ALL ON public.notifications FROM PUBLIC, anon;

-- Klien terautentikasi HANYA boleh membaca (SELECT) dan mengubah status baca (UPDATE is_read)
-- Klien DILARANG KERAS melakukan INSERT dan DELETE langsung
GRANT SELECT, UPDATE (is_read) ON public.notifications TO authenticated;

DROP POLICY IF EXISTS notifications_select_policy ON public.notifications;
CREATE POLICY notifications_select_policy ON public.notifications
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid()) 
  OR app_private.is_admin()
);

DROP POLICY IF EXISTS notifications_update_read_policy ON public.notifications;
CREATE POLICY notifications_update_read_policy ON public.notifications
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- 3. Otorisasi Peran Kurir pada Pesanan Delivery (Read-Only Least Privilege)
CREATE OR REPLACE FUNCTION app_private.is_courier()
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
      AND role IN ('courier', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION app_private.is_courier() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.is_courier() TO authenticated;

-- Perbarui policy SELECT orders agar kurir dapat membaca pesanan delivery aktif
DROP POLICY IF EXISTS orders_select_policy ON public.orders;
CREATE POLICY orders_select_policy ON public.orders
FOR SELECT TO authenticated
USING (
  buyer_id = (SELECT auth.uid())
  OR app_private.is_order_seller(id)
  OR app_private.is_admin()
  OR (app_private.is_courier() AND pickup_method = 'delivery')
);

-- Perbarui policy SELECT order_items agar kurir dapat membaca rincian menu pesanan delivery
DROP POLICY IF EXISTS order_items_select_policy ON public.order_items;
CREATE POLICY order_items_select_policy ON public.order_items
FOR SELECT TO authenticated
USING (
  seller_id = (SELECT auth.uid())
  OR app_private.is_order_buyer(order_id)
  OR app_private.is_admin()
  OR app_private.is_courier()
);

-- 4. Trigger Notifikasi Saat Pesanan Baru Masuk (via order_items)
-- Mengatasi urutan insert atomik: orders -> order_items
-- Menjamin:
-- a. Buyer hanya menerima TEPAT 1 notifikasi per pesanan baru (tidak duplikat per item).
-- b. Seller menerima notifikasi pesanan masuk untuk setiap menu miliknya.
CREATE OR REPLACE FUNCTION app_private.notify_on_new_order_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_buyer_id UUID;
  v_food_name TEXT;
  v_order_status TEXT;
BEGIN
  -- Dapatkan buyer_id dan status dari tabel orders
  SELECT buyer_id, status INTO v_buyer_id, v_order_status 
  FROM public.orders 
  WHERE id = NEW.order_id;

  -- Dapatkan nama makanan
  SELECT name INTO v_food_name 
  FROM public.foods 
  WHERE id = NEW.food_id;

  -- A. Notifikasi untuk Seller (Hanya 1 notifikasi per pesanan per seller untuk mencegah spam)
  IF NEW.seller_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE order_id = NEW.order_id 
        AND user_id = NEW.seller_id 
        AND type = 'order_status'
        AND (metadata->>'status') = 'pending'
    ) THEN
      INSERT INTO public.notifications (
        user_id, title, message, type, order_id, metadata
      ) VALUES (
        NEW.seller_id,
        'Pesanan Baru Masuk!',
        'Ada pesanan baru #' || NEW.order_id || ' untuk menu "' || COALESCE(v_food_name, 'Makanan') || '". Segera periksa dan konfirmasi.',
        'order_status',
        NEW.order_id,
        jsonb_build_object(
          'status', 'pending',
          'role', 'seller',
          'food_name', COALESCE(v_food_name, 'Makanan'),
          'quantity', NEW.quantity
        )
      );
    END IF;
  END IF;

  -- B. Notifikasi untuk Buyer (Anti-Duplikasi: Tepat 1 notifikasi untuk order baru)
  IF v_buyer_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE order_id = NEW.order_id 
        AND user_id = v_buyer_id 
        AND type = 'order_status'
        AND (metadata->>'status') = 'pending'
    ) THEN
      INSERT INTO public.notifications (
        user_id, title, message, type, order_id, metadata
      ) VALUES (
        v_buyer_id,
        'Pesanan Berhasil Diajukan',
        'Pesanan #' || NEW.order_id || ' berhasil dibuat dan sedang menunggu konfirmasi dari toko.',
        'order_status',
        NEW.order_id,
        jsonb_build_object(
          'status', 'pending',
          'role', 'buyer'
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_order_item ON public.order_items;
CREATE TRIGGER trg_notify_new_order_item
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION app_private.notify_on_new_order_item();

-- 5. Trigger Notifikasi Saat Status Pesanan Berubah (orders.status)
-- Menjamin:
-- a. Buyer menerima tepat 1 notifikasi setiap kali status berubah.
-- b. Seluruh seller unik (DISTINCT) yang terlibat dalam pesanan menerima notifikasi.
CREATE OR REPLACE FUNCTION app_private.notify_on_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_seller RECORD;
  v_buyer_id UUID := NEW.buyer_id;
  v_order_id BIGINT := NEW.id;
BEGIN
  -- Hanya eksekusi jika kolom status benar-benar mengalami mutasi nilai
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- ==========================================================================
  -- Kasus 1: Dikonfirmasi Penjual (pending -> confirmed)
  -- ==========================================================================
  IF NEW.status = 'confirmed' THEN
    IF v_buyer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, order_id, metadata)
      VALUES (
        v_buyer_id,
        'Pesanan Dikonfirmasi!',
        'Pesanan #' || v_order_id || ' telah dikonfirmasi oleh penjual dan sedang dipersiapkan.',
        'order_status',
        v_order_id,
        jsonb_build_object('status', 'confirmed', 'role', 'buyer')
      );
    END IF;

  -- ==========================================================================
  -- Kasus 2: Selesai Diselamatkan (confirmed -> completed)
  -- ==========================================================================
  ELSIF NEW.status = 'completed' THEN
    -- Notifikasi Buyer
    IF v_buyer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, order_id, metadata)
      VALUES (
        v_buyer_id,
        'Makanan Berhasil Diselamatkan! 🎉',
        'Pesanan #' || v_order_id || ' telah selesai diserahterimakan. Terima kasih telah mencegah pemborosan pangan!',
        'order_status',
        v_order_id,
        jsonb_build_object('status', 'completed', 'role', 'buyer')
      );
    END IF;

    -- Notifikasi untuk setiap Seller yang terlibat dalam pesanan ini
    FOR v_seller IN 
      SELECT DISTINCT seller_id 
      FROM public.order_items 
      WHERE order_id = v_order_id AND seller_id IS NOT NULL
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, order_id, metadata)
      VALUES (
        v_seller.seller_id,
        'Pesanan Selesai Diserahkan',
        'Pesanan #' || v_order_id || ' telah selesai diserahterimakan kepada pembeli.',
        'order_status',
        v_order_id,
        jsonb_build_object('status', 'completed', 'role', 'seller')
      );
    END LOOP;

  -- ==========================================================================
  -- Kasus 3: Dibatalkan (pending/confirmed -> cancelled)
  -- ==========================================================================
  ELSIF NEW.status = 'cancelled' THEN
    -- Notifikasi Buyer
    IF v_buyer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, order_id, metadata)
      VALUES (
        v_buyer_id,
        'Pesanan Dibatalkan',
        'Pesanan #' || v_order_id || ' telah dibatalkan. Jika ada pengembalian stok, status katalog telah disesuaikan.',
        'order_status',
        v_order_id,
        jsonb_build_object('status', 'cancelled', 'role', 'buyer')
      );
    END IF;

    -- Notifikasi untuk setiap Seller yang terlibat dalam pesanan ini
    FOR v_seller IN 
      SELECT DISTINCT seller_id 
      FROM public.order_items 
      WHERE order_id = v_order_id AND seller_id IS NOT NULL
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, order_id, metadata)
      VALUES (
        v_seller.seller_id,
        'Pesanan Dibatalkan',
        'Pesanan #' || v_order_id || ' telah dibatalkan dan kuantitas stok makanan telah diperbarui.',
        'order_status',
        v_order_id,
        jsonb_build_object('status', 'cancelled', 'role', 'seller')
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_order_status_change ON public.orders;
CREATE TRIGGER trg_notify_order_status_change
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION app_private.notify_on_order_status_change();

-- 6. RPC Helper untuk Manajemen Status Notifikasi
CREATE OR REPLACE FUNCTION public.mark_notification_as_read(p_notification_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Sesi login tidak valid.' USING ERRCODE = '28000';
  END IF;

  UPDATE public.notifications
  SET is_read = TRUE
  WHERE id = p_notification_id AND user_id = v_user_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.notifications
  SET is_read = TRUE
  WHERE user_id = (SELECT auth.uid()) AND is_read = FALSE;
$$;

REVOKE ALL ON FUNCTION public.mark_notification_as_read(BIGINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_as_read(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

-- 7. Konfigurasi Supabase Realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END;
$$;

COMMIT;
