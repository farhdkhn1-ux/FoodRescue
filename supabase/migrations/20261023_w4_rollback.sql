-- ============================================================================
-- NASKAH ROLLBACK AMAN (SAFE ROLLBACK) — FOOD RESCUE W4
-- Tanggal: 23 Oktober 2026
-- Prinsip: Surgical Teardown, Pemulihan Policy Baseline, Least Privilege
-- ============================================================================

BEGIN;

-- 1. Hapus ketiga RPC publik W4
DROP FUNCTION IF EXISTS public.create_order_atomic(BIGINT, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.cancel_order_atomic(BIGINT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.update_order_status(BIGINT, TEXT);

-- 2. Hapus kebijakan RLS yang dibuat oleh W4
DROP POLICY IF EXISTS orders_select_policy ON public.orders;
DROP POLICY IF EXISTS order_items_select_policy ON public.order_items;

-- 3. Hapus fungsi-fungsi helper kepemilikan di skema privat
DROP FUNCTION IF EXISTS app_private.is_admin();
DROP FUNCTION IF EXISTS app_private.is_order_seller(BIGINT);
DROP FUNCTION IF EXISTS app_private.is_order_buyer(BIGINT);

-- 4. Hapus skema app_private dengan opsi RESTRICT (Bukan CASCADE)
-- Opsi RESTRICT memastikan skema hanya terhapus jika kosong,
-- mencegah penghapusan objek dependensi yang tidak diketahui secara tidak sengaja.
DROP SCHEMA IF EXISTS app_private RESTRICT;

-- 5. Pemulihan Kebijakan RLS Baseline (Hanya yang Tercatat Secara Minimal)
-- CATATAN KRITIS / BLOCKER IDENTIFIKASI:
-- Repositori lokal tidak memiliki file dump skema awal (baseline) untuk pg_policies.
-- Dua definisi policy di bawah ini adalah rekonstruksi minimal yang tercatat dari pengujian awal
-- agar tabel orders dan order_items tidak terkunci total (fail-closed tanpa pembacaan).
-- Jika database staging/produksi memiliki definisi baseline yang lebih spesifik (misal: akses seller/admin
-- pada orders_select_own), definisi tersebut WAJIB diekspor sebelum migrasi dijalankan.

DROP POLICY IF EXISTS orders_select_own ON public.orders;
CREATE POLICY orders_select_own ON public.orders
FOR SELECT TO authenticated
USING (buyer_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS order_items_select ON public.order_items;
CREATE POLICY order_items_select ON public.order_items
FOR SELECT TO authenticated
USING (
  seller_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.buyer_id = (SELECT auth.uid())
  )
);

-- ============================================================================
-- DOKUMENTASI KEAMANAN & BATASAN TEARDOWN ROLLBACK:
-- ============================================================================
-- 1. PEMULIHAN POLICY BASELINE:
--    - Hanya memulihkan orders_select_own dan order_items_select.
--    - Kebijakan lain yang di-DROP IF EXISTS pada forward migration (seperti orders_read_policy,
--      "Enable read access for all users", "Users can view their own orders", dll) TIDAK
--      dipulihkan secara otomatis karena definisi aslinya tidak tercatat dalam repositori git.
--    - Bukti yang dibutuhkan: Output query "SELECT * FROM pg_policies WHERE tablename IN ('orders', 'order_items')"
--      sebelum migrasi W4 dieksekusi.
--
-- 2. HAK AKSES DML YANG TIDAK DIPULIHKAN (INTENTIONAL LEAST-PRIVILEGE):
--    - Kami secara EKSPLISIT TIDAK menyertakan:
--        GRANT INSERT, UPDATE, DELETE ON public.orders TO authenticated, anon;
--        GRANT INSERT, UPDATE, DELETE ON public.order_items TO authenticated, anon;
--        GRANT UPDATE (role) ON public.users TO authenticated, anon;
--      Rasional Keamanan:
--      Membuka kembali hak DML langsung kepada klien REST tanpa proteksi RPC akan membuka celah
--      Direct REST API bypass (pembuatan pesanan tanpa validasi stok/harga dan eskalasi role mandiri).
--      Jika pasca-rollback dibutuhkan operasi DML, administrator harus menjalankannya via service_role.
--
-- 3. ISOLASI TEARDOWN OBJEK W4:
--    - Hanya menghapus fungsi RPC, helper, dan policy milik W4.
--    - DROP SCHEMA app_private menggunakan RESTRICT untuk mencegah penghapusan objek non-W4.
-- ============================================================================

COMMIT;

