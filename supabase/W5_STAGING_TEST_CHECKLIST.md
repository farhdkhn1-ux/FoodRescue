# PAKET CHECKLIST PENGUJIAN STAGING DATABASE — FOOD RESCUE W5
**Tanggal Penyusunan:** 09 November 2026  
**Status Evaluasi:** READY FOR STAGING (Belum Production GO)  
**Dokumen Terkait:**  
- `supabase/migrations/20261109_w5_location_and_notifications.sql`
- `supabase/migrations/20261109_w5_rollback.sql`

---

## PANDUAN PELAKSANAAN & ATURAN PENGUJIAN
> [!IMPORTANT]
> 1. Dokumen ini adalah **rancangan pengujian staging** (test checklist) untuk modul Lokasi & Notifikasi (W5). Seluruh hasil aktual wajib diverifikasi oleh Database Administrator (DBA) / QA saat pengujian dijalankan di Supabase Staging.
> 2. **JANGAN** menjalankan SQL ini pada database production sebelum seluruh pengujian staging dinyatakan lolos.
> 3. Pengujian dibagi menjadi dua kelompok:
>    - **[SQL-SINGLE]**: Pengujian DDL, fungsi, RLS, dan RPC yang dapat dieksekusi dalam satu sesi SQL Editor.
>    - **[MULTI-ROLE / REALTIME]**: Pengujian yang melibatkan perbedaan JWT token (buyer, seller, courier, admin) serta verifikasi penerimaan event WebSocket Supabase Realtime di browser.

---

## 0. PRE-MIGRATION BASELINE & SNAPSHOT [SQL-SINGLE]

Tujuan: Mengambil bukti konfigurasi eksisting sebelum migrasi W5 diaplikasikan.

### TC-0.1: Verifikasi Kolom Lokasi Eksisting pada Tabel `users`
- **Langkah Uji**:
  ```sql
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name IN ('address', 'latitude', 'longitude');
  ```
- **Hasil yang Diharapkan**: Kolom `address`, `latitude`, dan `longitude` terdaftar. Tidak boleh ada duplikasi atau perubahan tipe kolom.

### TC-0.2: Snapshot Policy RLS Eksisting pada `orders` & `order_items`
- **Langkah Uji**:
  ```sql
  SELECT tablename, policyname, roles, cmd, qual 
  FROM pg_policies 
  WHERE schemaname = 'public' 
    AND tablename IN ('orders', 'order_items')
  ORDER BY tablename, policyname;
  ```
- **Hasil yang Diharapkan**: Policy baseline W4 (`orders_select_policy`, `order_items_select_policy`) tercatat sebelum diperbarui untuk akses kurir.

---

## 1. DDL MIGRATION ATOMICITY & STRUCTURE VERIFICATION [SQL-SINGLE]

Tujuan: Memastikan skrip migrasi berjalan sukses tanpa error dalam transaksi atomik tunggal.

### TC-1.1: Eksekusi Migrasi W5
- **Langkah Uji**: Jalankan file `20261109_w5_location_and_notifications.sql` secara utuh dari `BEGIN;` sampai `COMMIT;`.
- **Hasil yang Diharapkan**: Query mengembalikan `COMMIT` tanpa error sintaks atau kegagalan DDL.

### TC-1.2: Verifikasi Struktur Tabel `public.notifications`
- **Langkah Uji**:
  ```sql
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'notifications'
  ORDER BY ordinal_position;
  ```
- **Hasil yang Diharapkan**:
  - `id`: BIGINT (Identity Primary Key)
  - `user_id`: UUID (NOT NULL, FK ke `public.users.id`)
  - `title`: TEXT (NOT NULL)
  - `message`: TEXT (NOT NULL)
  - `type`: TEXT (NOT NULL, default 'order_status')
  - `order_id`: BIGINT (Nullable, FK ke `public.orders.id`)
  - `is_read`: BOOLEAN (NOT NULL, default false)
  - `metadata`: JSONB (NOT NULL, default '{}')
  - `created_at`: TIMESTAMPTZ (NOT NULL, default now())

### TC-1.3: Verifikasi Indeks Performa
- **Langkah Uji**:
  ```sql
  SELECT indexname, indexdef 
  FROM pg_indexes 
  WHERE schemaname = 'public' AND tablename = 'notifications';
  ```
- **Hasil yang Diharapkan**:
  - `idx_notifications_user_unread` pada `(user_id, is_read, created_at DESC)`
  - `idx_notifications_order_id` pada `(order_id)`

### TC-1.4: Verifikasi Publikasi Realtime & Replica Identity
- **Langkah Uji**:
  ```sql
  SELECT schemaname, tablename 
  FROM pg_publication_tables 
  WHERE pubname = 'supabase_realtime' 
    AND tablename IN ('notifications', 'orders');

  SELECT relname, relreplident 
  FROM pg_class 
  WHERE relname IN ('notifications', 'orders');
  ```
- **Hasil yang Diharapkan**:
  - Kedua tabel terdaftar di publikasi `supabase_realtime`.
  - Nilai `relreplident` = `f` (FULL) untuk kedua tabel.

---

## 2. ROW LEVEL SECURITY & LEAST PRIVILEGE AUDIT [MULTI-ROLE]

Tujuan: Memastikan tidak ada celah bypass langsung dari klien REST/PostgREST.

### TC-2.1: Proteksi Direct INSERT oleh Klien Biasa (Bypass Prevention)
- **Langkah Uji**: Coba lakukan insert langsung ke tabel `notifications` menggunakan token role `authenticated`:
  ```sql
  INSERT INTO public.notifications (user_id, title, message)
  VALUES (auth.uid(), 'Fake Alert', 'Mencoba bypass insert');
  ```
- **Hasil yang Diharapkan**: Gagal dengan error `42501 (permission denied for table notifications)`.

### TC-2.2: Isolasi Pembacaan Notifikasi (User Isolation)
- **Langkah Uji**: Login sebagai User A, jalankan `SELECT * FROM public.notifications`.
- **Hasil yang Diharapkan**: Hanya baris dengan `user_id = User A` yang tampil. Notifikasi milik User B sama sekali tidak dapat dilihat.

### TC-2.3: Pembatasan UPDATE Hanya pada Kolom `is_read`
- **Langkah Uji**:
  1. Coba update kolom `message` sebagai pemilik notifikasi:
     ```sql
     UPDATE public.notifications SET message = 'Tampered' WHERE id = :my_notif_id;
     ```
     *Hasil*: Gagal / ditolak karena hanya diberi `GRANT UPDATE (is_read)`.
  2. Coba update kolom `is_read = true`:
     ```sql
     UPDATE public.notifications SET is_read = true WHERE id = :my_notif_id;
     ```
     *Hasil*: Berhasil (1 row updated).

### TC-2.4: Otorisasi Pembacaan Kurir pada Pesanan Delivery
- **Langkah Uji**: Login sebagai role `courier`:
  1. Kueri pesanan delivery: `SELECT * FROM public.orders WHERE pickup_method = 'delivery';` -> Berhasil tampil.
  2. Kueri pesanan pickup milik orang lain: `SELECT * FROM public.orders WHERE pickup_method = 'pickup';` -> Mengembalikan 0 baris (terisolasi oleh RLS).

---

## 3. PENGUJIAN TRIGGER NOTIFIKASI TRANSAKSIONAL [MULTI-ROLE]

Tujuan: Memverifikasi pembuatan notifikasi otomatis saat pesanan dibuat dan statusnya berubah.

### TC-3.1: Notifikasi Pembuatan Pesanan Baru (Anti-Duplikasi Buyer)
- **Prasyarat**: Buyer membuat pesanan makanan via RPC `create_order_atomic`.
- **Verifikasi**:
  1. Notifikasi Buyer: Tepat 1 baris notifikasi dengan judul `'Pesanan Berhasil Diajukan'`.
  2. Notifikasi Seller: Tepat 1 baris notifikasi dengan judul `'Pesanan Baru Masuk!'`.
  3. **Pengujian Multi-Item**: Tambahkan item kedua pada pesanan yang sama secara langsung di database.
     - *Hasil*: Buyer **TIDAK** menerima notifikasi kedua (anti-duplikasi bekerja).

### TC-3.2: Notifikasi Konfirmasi Penjual (`pending` -> `confirmed`)
- **Langkah Uji**: Penjual mengonfirmasi pesanan via RPC `update_order_status(p_order_id, 'confirmed')`.
- **Verifikasi**:
  - Buyer menerima notifikasi `'Pesanan Dikonfirmasi!'`.
  - Kolom `metadata` mencantumkan `'status': 'confirmed'`.

### TC-3.3: Notifikasi Penyelesaian Pesanan (`confirmed` -> `completed`)
- **Langkah Uji**: Pesanan diselesaikan via RPC `update_order_status(p_order_id, 'completed')`.
- **Verifikasi**:
  - Buyer menerima notifikasi `'Makanan Berhasil Diselamatkan! 🎉'`.
  - Seluruh seller yang terlibat menerima notifikasi `'Pesanan Selesai Diserahkan'`.

### TC-3.4: Notifikasi Pembatalan Pesanan (`cancelled`)
- **Langkah Uji**: Pesanan dibatalkan via RPC `cancel_order_atomic`.
- **Verifikasi**:
  - Buyer dan Seller menerima notifikasi `'Pesanan Dibatalkan'`.

---

## 4. PENGUJIAN RPC HELPER [SQL-SINGLE]

### TC-4.1: Eksekusi `mark_notification_as_read`
- **Langkah Uji**:
  ```sql
  SELECT public.mark_notification_as_read(:notification_id);
  ```
- **Hasil yang Diharapkan**: Mengembalikan `true`, dan kolom `is_read` berubah menjadi `TRUE`.

### TC-4.2: Eksekusi `mark_all_notifications_read`
- **Langkah Uji**:
  ```sql
  SELECT public.mark_all_notifications_read();
  ```
- **Hasil yang Diharapkan**: Seluruh baris notifikasi milik `auth.uid()` yang berstatus `is_read = FALSE` berubah menjadi `TRUE`.

---

## 5. PENGUJIAN ROLLBACK [SQL-SINGLE]

Tujuan: Memastikan skrip rollback dapat mengembalikan skema ke baseline W4 secara sempurna tanpa merusak database.

### TC-5.1: Eksekusi Rollback
- **Langkah Uji**: Jalankan file `20261109_w5_rollback.sql`.
- **Hasil yang Diharapkan**:
  - Tabel `public.notifications` berhasil dihapus (`DROP TABLE`).
  - Trigger `trg_notify_order_status_change` dan `trg_notify_new_order_item` terhapus.
  - Policy `orders_select_policy` dan `order_items_select_policy` kembali ke versi baseline W4.
  - Eksekusi mengembalikan `COMMIT` tanpa error.

