-- ============================================================================
-- ROLLBACK W5: PEMULIHAN SKEMA SEBELUM NOTIFIKASI & REALTIME
-- Tanggal: 09 November 2026
-- Fokus: Menghapus trigger, fungsi, RPC, tabel notifications, dan memulihkan
--        policy RLS orders/order_items ke baseline W4
-- ============================================================================

BEGIN;

-- 1. Cabut Tabel dari Publikasi Realtime
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;
  END IF;
END;
$$;

-- 2. Hapus Trigger Otomatis
DROP TRIGGER IF EXISTS trg_notify_order_status_change ON public.orders;
DROP TRIGGER IF EXISTS trg_notify_new_order_item ON public.order_items;

-- 3. Hapus Fungsi Penanganan Notifikasi di app_private
DROP FUNCTION IF EXISTS app_private.notify_on_order_status_change();
DROP FUNCTION IF EXISTS app_private.notify_on_new_order_item();

-- 4. Hapus RPC Helper Manajemen Notifikasi
DROP FUNCTION IF EXISTS public.mark_notification_as_read(BIGINT);
DROP FUNCTION IF EXISTS public.mark_all_notifications_read();

-- 5. Hapus Tabel Notifikasi
DROP TABLE IF EXISTS public.notifications CASCADE;

-- 6. Pulihkan Policy RLS orders dan order_items ke Baseline W4
DROP POLICY IF EXISTS orders_select_policy ON public.orders;
CREATE POLICY orders_select_policy ON public.orders
FOR SELECT TO authenticated
USING (
  buyer_id = (SELECT auth.uid())
  OR app_private.is_order_seller(id)
  OR app_private.is_admin()
);

DROP POLICY IF EXISTS order_items_select_policy ON public.order_items;
CREATE POLICY order_items_select_policy ON public.order_items
FOR SELECT TO authenticated
USING (
  seller_id = (SELECT auth.uid())
  OR app_private.is_order_buyer(order_id)
  OR app_private.is_admin()
);

-- 7. Hapus Helper Courier
DROP FUNCTION IF EXISTS app_private.is_courier();

COMMIT;
