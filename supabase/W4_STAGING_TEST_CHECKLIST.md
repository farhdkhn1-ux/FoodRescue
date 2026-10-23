# PAKET CHECKLIST PENGUJIAN STAGING DATABASE — FOOD RESCUE W4
**Tanggal Penyusunan:** 23 Oktober 2026  
**Status Evaluasi:** READY FOR STAGING (Belum Production GO)  
**Dokumen Terkait:**  
- `supabase/migrations/20261023_w4_order_atomic.sql`
- `supabase/migrations/20261023_w4_rollback.sql`

---

## PANDUAN PELAKSANAAN & ATURAN PENGUJIAN
> [!IMPORTANT]
> 1. Dokumen ini adalah **rancangan pengujian staging** (test checklist). Seluruh hasil aktual wajib diisi oleh Database Administrator / QA saat pengujian dijalankan di lingkungan Supabase Staging.
> 2. **JANGAN** menganggap hasil build/lint lokal Next.js sebagai bukti verifikasi database.
> 3. Pengujian dibagi menjadi dua kelompok:
>    - **[SQL-SINGLE]**: Pengujian kueri/skrip SQL yang dapat dieksekusi dalam satu sesi SQL Editor atau psql client.
>    - **[MULTI-SESSION / MULTI-ROLE]**: Pengujian yang membutuhkan dua koneksi/sesi konkuren bersamaan atau pengujian dengan JWT token role yang berbeda (anon, buyer, seller, admin).

---

## 0. PRE-MIGRATION BASELINE & CATALOG SNAPSHOT [SQL-SINGLE]

Tujuan: Mengambil bukti otentik konfigurasi eksisting sebelum migrasi W4 diaplikasikan.

### TC-0.1: Ekspor Snapshot Kebijakan RLS Baseline
- **Prasyarat**: Akses read-only ke staging database sebelum migrasi dijalankan.
- **Langkah Uji**:
  ```sql
  SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
  FROM pg_policies 
  WHERE schemaname = 'public' 
    AND tablename IN ('users', 'foods', 'orders', 'order_items')
  ORDER BY tablename, policyname;
  ```
- **Hasil yang Diharapkan**: Daftar seluruh policy aktif tercatat lengkap (khususnya nilai kolom `qual` dan `with_check`).
- **Bukti yang Harus Dicatat**: Output CSV / JSON dari hasil kueri disimpan sebagai `baseline_policies_pre_w4.json`.

### TC-0.2: Evaluasi Keberadaan Trigger Pengubah Stok
- **Prasyarat**: Akses read-only ke staging database.
- **Langkah Uji**:
  ```sql
  SELECT event_object_table, trigger_name, action_timing, event_manipulation, action_statement
  FROM information_schema.triggers 
  WHERE trigger_schema = 'public' 
    AND event_object_table IN ('foods', 'orders', 'order_items')
  ORDER BY event_object_table, trigger_name;
  ```
- **Hasil yang Diharapkan**: Terdata apakah ada trigger tersembunyi yang melakukan kalkulasi otomatis pada `foods.quantity`.
- **Bukti yang Harus Dicatat**: Output daftar trigger. *(Jika ada trigger mutasi stok, migrasi W4 WAJIB DITAHAN untuk mencegah pengurangan stok ganda).*

### TC-0.3: Verifikasi Constraint Kolom dan Tabel
- **Prasyarat**: Akses read-only ke staging database.
- **Langkah Uji**:
  ```sql
  SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name, cc.check_clause
  FROM information_schema.table_constraints tc
  LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  LEFT JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
  WHERE tc.table_schema = 'public' 
    AND tc.table_name IN ('users', 'foods', 'orders', 'order_items')
  ORDER BY tc.table_name, tc.constraint_type;
  ```
- **Hasil yang Diharapkan**: Terverifikasi tipe ID (`BIGINT` vs `UUID`), foreign key, serta check constraint pada status dan kuantitas.
- **Bukti yang Harus Dicatat**: Output relasi kunci dan constraint tabel.

---

## 1. DDL MIGRATION ATOMICITY & STRUCTURE VERIFICATION [SQL-SINGLE]

Tujuan: Memastikan skrip migrasi berjalan sukses tanpa error dalam blok transaksi tunggal.

### TC-1.1: Eksekusi Migrasi Transaksional
- **Prasyarat**: File `20261023_w4_order_atomic.sql` siap dieksekusi di database staging.
- **Langkah Uji**: Eksekusi naskah migrasi secara utuh dari `BEGIN;` sampai `COMMIT;`.
- **Hasil yang Diharapkan**: Query mengembalikan `COMMIT` tanpa error sintaks atau kegagalan DDL.
- **Bukti yang Harus Dicatat**: Log konsol eksekusi DDL staging.

### TC-1.2: Verifikasi Isolasi Skema `app_private` dan Hak Akses Spesifik
- **Prasyarat**: Migrasi TC-1.1 telah dieksekusi.
- **Langkah Uji**:
  ```sql
  SELECT routine_schema, routine_name, security_type, data_type
  FROM information_schema.routines
  WHERE routine_schema = 'app_private'
  ORDER BY routine_name;

  SELECT grantee, routine_name, privilege_type
  FROM information_schema.routine_privileges
  WHERE routine_schema = 'app_private'
  ORDER BY routine_name, grantee;
  ```
- **Hasil yang Diharapkan**:
  - Terdaftar tepat 3 fungsi: `is_admin`, `is_order_seller`, `is_order_buyer` dengan `security_type = 'DEFINER'`.
  - Hanya role `authenticated` yang memiliki privilege `EXECUTE`. Role `PUBLIC` dan `anon` tidak memiliki privilege `EXECUTE`.
- **Bukti yang Harus Dicatat**: Hasil query privilege skema `app_private`.

### TC-1.3: Verifikasi Pemilik dan Search Path RPC Publik
- **Prasyarat**: Migrasi TC-1.1 telah dieksekusi.
- **Langkah Uji**:
  ```sql
  SELECT proname, prosecdef, proconfig
  FROM pg_proc 
  WHERE proname IN ('create_order_atomic', 'cancel_order_atomic', 'update_order_status');
  ```
- **Hasil yang Diharapkan**: Ketiga fungsi memiliki `prosecdef = true` (SECURITY DEFINER) dan `proconfig = {search_path=""}` (Anti-Hijacking).
- **Bukti yang Harus Dicatat**: Daftar konfigurasi `pg_proc`.

---

## 2. DIRECT REST / DML ANTI-BYPASS & RLS TESTING [MULTI-ROLE]

Tujuan: Membuktikan bahwa celah modifikasi langsung via PostgREST telah ditutup total.

### TC-2.1: Uji Coba Direct INSERT ke `public.orders` oleh Role Authenticated
- **Prasyarat**: Pengguna login sebagai `buyer` via REST API / Supabase Client.
- **Langkah Uji**:
  Klien mengeksekusi direct REST call:
  `POST /rest/v1/orders` dengan payload `{"buyer_id": "<uid>", "total_amount": 0, "status": "pending"}`.
- **Hasil yang Diharapkan**: Ditolak oleh PostgreSQL dengan HTTP 403 / Error code `42501`: `permission denied for table orders`.
- **Bukti yang Harus Dicatat**: Response JSON dan status HTTP REST API.

### TC-2.2: Uji Coba Direct UPDATE ke `public.orders` oleh Role Authenticated
- **Prasyarat**: Pengguna login sebagai `buyer` atau `seller`.
- **Langkah Uji**:
  Klien mengeksekusi direct REST call:
  `PATCH /rest/v1/orders?id=eq.1` dengan payload `{"status": "completed"}`.
- **Hasil yang Diharapkan**: Ditolak dengan Error code `42501`: `permission denied for table orders`.
- **Bukti yang Harus Dicatat**: Response JSON error PostgREST.

### TC-2.3: Uji Coba Eskalasi Role Mandiri pada `public.users`
- **Prasyarat**: Pengguna terautentikasi sebagai `buyer`.
- **Langkah Uji**:
  Klien mengeksekusi direct REST call:
  `PATCH /rest/v1/users?id=eq.<own_uid>` dengan payload `{"role": "admin"}`.
- **Hasil yang Diharapkan**: Ditolak dengan Error code `42501`: `permission denied for column role of table users` atau `permission denied for table users`.
- **Bukti yang Harus Dicatat**: Response JSON error eskalasi role.

### TC-2.4: Uji Partisi Akses Baca (SELECT) Pesanan Sesuai Kebijakan RLS
- **Prasyarat**: Terdapat Pesanan #101 milik Buyer A dari Seller B.
- **Langkah Uji**:
  1. Login sebagai Buyer A -> SELECT `orders` WHERE id = 101.
  2. Login sebagai Seller B -> SELECT `orders` WHERE id = 101.
  3. Login sebagai Buyer C (pihak ketiga) -> SELECT `orders` WHERE id = 101.
  4. Login sebagai Admin -> SELECT `orders` WHERE id = 101.
- **Hasil yang Hiharapkan**:
  - Buyer A: Melihat baris pesanan (1 baris).
  - Seller B: Melihat baris pesanan (1 baris).
  - Buyer C: Mengembalikan 0 baris (terisolasi oleh RLS).
  - Admin: Melihat baris pesanan (1 baris).
- **Bukti yang Harus Dicatat**: Rekaman baris yang dikembalikan pada masing-masing akun.

---

## 3. `create_order_atomic` FUNCTIONAL & BOUNDARY TESTING [SQL-SINGLE]

Tujuan: Memverifikasi validasi input, kalkulasi harga, ketersediaan, dan integritas stok.

### TC-3.1: Pembuatan Pesanan Sukses (Commercial Sale - Pickup)
- **Prasyarat**: Makanan ID 1 (Harga: Rp 5.000, Stok: 10, Type: `sale`, Pickup Method: `both`, status: `available`, waktu ketersediaan valid). Sesi pengguna disimulasikan sebagai Buyer (`auth.uid() = <buyer_uuid>`).
- **Langkah Uji**:
  ```sql
  SELECT public.create_order_atomic(1, 2, 'pickup', NULL);
  ```
- **Hasil yang Diharapkan**:
  - Return JSON: `success: true`, `total_amount: 10000`, `status: 'pending'`, `pickup_method: 'pickup'`.
  - Tabel `orders`: 1 baris baru terbentuk dengan `total_amount = 10000`.
  - Tabel `order_items`: 1 baris baru terbentuk dengan `quantity = 2`, `price = 5000`, `subtotal = 10000`.
  - Tabel `foods`: `quantity` berkurang dari 10 menjadi 8. Status tetap `available`.
- **Bukti yang Harus Dicatat**: Output JSON RPC dan status baris tabel `foods`, `orders`, `order_items`.

### TC-3.2: Pembuatan Pesanan Sukses (Donation - Subtotal Rp 0)
- **Prasyarat**: Makanan ID 2 (Harga tercatat: Rp 0, Type: `donation`, Stok: 5).
- **Langkah Uji**:
  ```sql
  SELECT public.create_order_atomic(2, 3, 'pickup', NULL);
  ```
- **Hasil yang Diharapkan**:
  - Return JSON: `total_amount: 0`.
  - Subtotal pada `order_items` bernilai 0 terlepas dari kolom harga acuan.
  - Sisa stok makanan berkurang dari 5 menjadi 2.
- **Bukti yang Harus Dicatat**: Output JSON RPC dan baris `order_items`.

### TC-3.3: Pembuatan Pesanan Hingga Menghabiskan Stok (`sold_out`)
- **Prasyarat**: Makanan ID 3 (Stok: 2 porsi, status: `available`).
- **Langkah Uji**:
  ```sql
  SELECT public.create_order_atomic(3, 2, 'pickup', NULL);
  ```
- **Hasil yang Diharapkan**:
  - Pesanan berhasil dibuat.
  - Sisa stok makanan menjadi 0.
  - Kolom `foods.status` otomatis berubah dari `available` menjadi `sold_out`.
- **Bukti yang Harus Dicatat**: Nilai `quantity` dan `status` makanan ID 3 pascatransaksi.

### TC-3.4: Uji Penolakan Input Tidak Valid (Boundary & Defensive Checks)
- **Prasyarat**: Sesi terautentikasi sebagai Buyer.
- **Langkah Uji & Hasil yang Diharapkan**:
  1. `p_food_id <= 0`: Error `22023` (INVALID_ARGUMENT).
  2. `p_quantity = 0` atau `p_quantity < 0`: Error `22023`.
  3. `p_quantity > 1000`: Error `22023`.
  4. `p_pickup_method = 'drone'` (bukan pickup/delivery): Error `22023`.
  5. `p_pickup_method = 'delivery'` dengan `p_shipping_address = NULL` atau `< 5 char`: Error `22023`.
  6. `p_food_id` tidak ada di database: Error `P0002` (NOT_FOUND).
- **Bukti yang Harus Dicatat**: Pesan error dan SQLSTATE untuk setiap skenario penolakan.

### TC-3.5: Uji Pencegahan Self-Purchase (Penjual Membeli Menu Sendiri)
- **Prasyarat**: Sesi diset ke UUID penjual pemilik makanan ID 1.
- **Langkah Uji**:
  ```sql
  SELECT public.create_order_atomic(1, 1, 'pickup', NULL);
  ```
- **Hasil yang Diharapkan**: Transaksi gagal dengan Error code `42501`: `FORBIDDEN: Penjual dilarang membeli produk makanan miliknya sendiri`.
- **Bukti yang Harus Dicatat**: Pesan error penolakan.

### TC-3.6: Uji Penolakan Waktu Ketersediaan Kedaluwarsa
- **Prasyarat**: Makanan ID 4 dengan `available_until = NOW() - INTERVAL '1 hour'`.
- **Langkah Uji**:
  ```sql
  SELECT public.create_order_atomic(4, 1, 'pickup', NULL);
  ```
- **Hasil yang Diharapkan**: Transaksi gagal dengan Error code `23514`: `CONFLICT: Makanan sudah melewati batas waktu ketersediaan...`.
- **Bukti yang Harus Dicatat**: Pesan error konflik ketersediaan.

---

## 4. CONCURRENCY & RACE CONDITION TESTING [MULTI-SESSION]

Tujuan: Membuktikan efektivitas penguncian baris (`FOR UPDATE`) dalam mencegah *overselling* saat diakses bersamaan.

### TC-4.1: Uji Konkurensi Checkout Serentak (Anti-Overselling)
- **Prasyarat**: Makanan ID 5 memiliki sisa stok tepat **1 porsi**.
- **Langkah Uji**:
  1. Buka Koneksi A (Sesi Buyer 1) dan Koneksi B (Sesi Buyer 2) secara simultan.
  2. Koneksi A menjalankan: `SELECT public.create_order_atomic(5, 1, 'pickup', NULL);`
  3. Koneksi B pada milidetik yang sama menjalankan: `SELECT public.create_order_atomic(5, 1, 'pickup', NULL);`
- **Hasil yang Diharapkan**:
  - Tepat **satu koneksi** berhasil (`success: true`, status `pending`).
  - Koneksi lainnya tertahan (*locked*) hingga transaksi pertama selesai, lalu dibatalkan bersih dengan Error `23514`: `CONFLICT: Jumlah porsi yang diminta (1) melebihi sisa stok yang tersedia (0)` atau `Porsi makanan ini sudah habis atau tidak tersedia`.
  - Stok akhir makanan ID 5 tepat bernilai **0** (tidak pernah menjadi -1).
- **Bukti yang Harus Dicatat**: Timestamp eksekusi, log koneksi A dan B, serta snapshot stok akhir.

---

## 5. `cancel_order_atomic` & RESTOCK INTEGRITY TESTING [SQL-SINGLE & MULTI-ROLE]

Tujuan: Menguji otorisasi pembatalan, pemulihan stok atomik, dan pencegahan restock ganda.

### TC-5.1: Pembatalan oleh Buyer pada Status `pending` (Restock Otomatis)
- **Prasyarat**: Pesanan #201 berstatus `pending` (memesan 2 porsi makanan ID 1). Makanan ID 1 saat ini memiliki stok 8. Sesi adalah Buyer pemilik pesanan.
- **Langkah Uji**:
  ```sql
  SELECT public.cancel_order_atomic(201, 'Salah pesan', true);
  ```
- **Hasil yang Diharapkan**:
  - Return JSON: `success: true`, `status: 'cancelled'`, `restocked: true`.
  - Status pesanan #201 berubah menjadi `cancelled`.
  - Stok makanan ID 1 bertambah dari 8 menjadi 10.
- **Bukti yang Harus Dicatat**: Nilai status pesanan dan stok makanan sebelum vs sesudah pembatalan.

### TC-5.2: Uji Pembeli Mencoba Mematikan Restock (`p_restock = false`)
- **Prasyarat**: Pesanan #202 berstatus `pending` milik Buyer.
- **Langkah Uji**:
  Buyer memanggil RPC dengan parameter `p_restock = false`:
  ```sql
  SELECT public.cancel_order_atomic(202, 'Batalkan tanpa restock', false);
  ```
- **Hasil yang Diharapkan**:
  - RPC mengabaikan parameter `false` dari buyer dan memaksa `v_actual_restock := true`.
  - Stok tetap dipulihkan ke inventaris penjual.
- **Bukti yang Harus Dicatat**: Nilai `restocked: true` pada return JSON dan penambahan stok fisik.

### TC-5.3: Penolakan Pembatalan oleh Buyer pada Status `confirmed`
- **Prasyarat**: Pesanan #203 telah berstatus `confirmed` oleh penjual. Sesi adalah Buyer.
- **Langkah Uji**:
  ```sql
  SELECT public.cancel_order_atomic(203, 'Ingin batal', true);
  ```
- **Hasil yang Diharapkan**: Ditolak dengan Error code `42501`: `FORBIDDEN: Pesanan yang telah dikonfirmasi penjual tidak dapat dibatalkan oleh pembeli`.
- **Bukti yang Harus Dicatat**: Pesan error penolakan hak akses pembeli.

### TC-5.4: Pembatalan oleh Penjual Tanpa Restock (Makanan Rusak / Afkir)
- **Prasyarat**: Pesanan #204 berstatus `confirmed`. Sesi adalah Penjual pemilik makanan.
- **Langkah Uji**:
  ```sql
  SELECT public.cancel_order_atomic(204, 'Makanan basi/rusak saat disiapkan', false);
  ```
- **Hasil yang Diharapkan**:
  - Berhasil dibatalkan (`status: 'cancelled'`, `restocked: false`).
  - Stok makanan TIDAK ditambahkan ke katalog.
- **Bukti yang Harus Dicatat**: Alasan tertulis terverifikasi minimal 5 karakter dan kuantitas stok makanan tidak berubah.

### TC-5.5: Uji Penolakan Pembatalan Tanpa Alasan yang Sah
- **Prasyarat**: Sesi adalah Penjual atau Admin.
- **Langkah Uji**:
  Memanggil RPC dengan `p_restock = false` tetapi alasan kosong atau `< 5 karakter`:
  ```sql
  SELECT public.cancel_order_atomic(204, 'bad', false);
  ```
- **Hasil yang Diharapkan**: Ditolak dengan Error code `22023`: `INVALID_ARGUMENT: Pembatalan tanpa pemulihan stok ... mewajibkan alasan tertulis minimal 5 karakter`.
- **Bukti yang Harus Dicatat**: Pesan error validasi alasan.

### TC-5.6: Pencegahan Pembatalan Ganda (Idempotensi Terminal Status)
- **Prasyarat**: Pesanan #201 sudah berstatus `cancelled`.
- **Langkah Uji**:
  Mencoba memanggil kembali `cancel_order_atomic(201, ...)` untuk kedua kalinya.
- **Hasil yang Diharapkan**: Ditolak dengan Error code `23514`: `CONFLICT: Pesanan ini sudah dibatalkan sebelumnya`. Stok TIDAK dipulihkan untuk kedua kalinya.
- **Bukti yang Harus Dicatat**: Bukti stok makanan tidak bertambah dua kali.

### TC-5.7: Pencegahan Pembatalan Pesanan Selesai (`completed`)
- **Prasyarat**: Pesanan #205 berstatus `completed`.
- **Langkah Uji**:
  Memanggil `cancel_order_atomic(205, ...)`.
- **Hasil yang Diharapkan**: Ditolak dengan Error code `23514`: `CONFLICT: Pesanan yang sudah selesai tidak dapat dibatalkan`.
- **Bukti yang Harus Dicatat**: Pesan error perlindungan status terminal `completed`.

### TC-5.8: Uji Restock Anti-Zombie (Menu Habis Tanpa Batas Kedaluwarsa)
- **Prasyarat**: Makanan ID 6 berstatus `sold_out` dengan `available_until = NULL`.
- **Langkah Uji**: Batalkan pesanan terkait dengan `restock = true`.
- **Hasil yang Diharapkan**: Status makanan ID 6 kembali menjadi `available` (karena tidak kedaluwarsa).
- **Bukti yang Harus Dicatat**: Status kolom `foods.status` pasca-restock.

---

## 6. `update_order_status` STATE TRANSITION MATRIX TESTING [SQL-SINGLE & MULTI-ROLE]

Tujuan: Memvalidasi matriks transisi status yang sah dan memblokir modifikasi status ilegal.

### TC-6.1: Transisi Sah `pending` -> `confirmed` oleh Penjual
- **Prasyarat**: Pesanan #301 berstatus `pending`. Sesi adalah Penjual terkait atau Admin.
- **Langkah Uji**:
  ```sql
  SELECT public.update_order_status(301, 'confirmed');
  ```
- **Hasil yang Diharapkan**: Berhasil, status menjadi `confirmed`.
- **Bukti yang Harus Dicatat**: Status pesanan dan return JSON.

### TC-6.2: Transisi Sah `confirmed` -> `completed` oleh Penjual
- **Prasyarat**: Pesanan #301 berstatus `confirmed`. Sesi adalah Penjual terkait atau Admin.
- **Langkah Uji**:
  ```sql
  SELECT public.update_order_status(301, 'completed');
  ```
- **Hasil yang Diharapkan**: Berhasil, status menjadi `completed`.
- **Bukti yang Harus Dicatat**: Status pesanan dan return JSON.

### TC-6.3: Penolakan Transisi Langsung `pending` -> `completed` (Melompati Tahap)
- **Prasyarat**: Pesanan #302 berstatus `pending`.
- **Langkah Uji**:
  ```sql
  SELECT public.update_order_status(302, 'completed');
  ```
- **Hasil yang Diharapkan**: Ditolak dengan Error code `23514`: `CONFLICT: Hanya pesanan berstatus "confirmed" yang dapat diselesaikan`.
- **Bukti yang Harus Dicatat**: Pesan error konflik status.

### TC-6.4: Penolakan Perubahan Status oleh Buyer
- **Prasyarat**: Pesanan #301. Sesi adalah Buyer pemilik pesanan.
- **Langkah Uji**:
  Buyer memanggil `update_order_status(301, 'completed')`.
- **Hasil yang Diharapkan**: Ditolak dengan Error code `42501`: `FORBIDDEN: Pembeli dilarang mengubah status pemrosesan pesanannya sendiri`.
- **Bukti yang Harus Dicatat**: Pesan error penolakan otorisasi pembeli.

### TC-6.5: Penolakan Status Target Tidak Sah (Arbitrary Status)
- **Prasyarat**: Pesanan #301.
- **Langkah Uji**:
  Memanggil `update_order_status(301, 'delivered')` atau `'cancelled'`.
- **Hasil yang Diharapkan**: Ditolak dengan Error code `22023`: `INVALID_ARGUMENT: Status target harus "confirmed" atau "completed". Pembatalan wajib menggunakan cancel_order_atomic`.
- **Bukti yang Harus Dicatat**: Pesan error penolakan nilai parameter target.

---

## 7. DUAL-ROLE AUTHORIZATION EDGE CASES [MULTI-ROLE]

Tujuan: Menguji keamanan saat satu akun memiliki relasi ambigu sebagai Buyer sekaligus Seller.

### TC-7.1: Skenario Akun Terdaftar Buyer Sekaligus Seller pada Pesanan yang Sama
- **Prasyarat**: Simulasi data anomali di mana pada Pesanan #401, `orders.buyer_id = 'user-x'` dan `order_items.seller_id = 'user-x'`.
- **Langkah Uji 1**: Akun `user-x` memanggil `cancel_order_atomic(401, 'Batal', false)`.
- **Hasil Uji 1**: Ditolak dengan Error code `42501`: `FORBIDDEN: Transaksi tidak valid (pengguna terdeteksi sebagai pembeli sekaligus penjual pada pesanan ini)`.
- **Langkah Uji 2**: Akun `user-x` memanggil `update_order_status(401, 'confirmed')`.
- **Hasil Uji 2**: Ditolak dengan Error code `42501`: `FORBIDDEN: Pembeli dilarang mengubah status pemrosesan pesanannya sendiri`.
- **Bukti yang Harus Dicatat**: Bukti bahwa hak istimewa penjual tidak dapat disalahgunakan untuk pesanan yang dibeli oleh dirinya sendiri.

---

## 8. SAFE ROLLBACK EXECUTION & TEARDOWN VERIFICATION [SQL-SINGLE]

Tujuan: Membuktikan bahwa naskah rollback menghapus seluruh objek W4 secara bersih tanpa merusak objek database lain.

### TC-8.1: Eksekusi Rollback Utuh
- **Prasyarat**: Migrasi W4 telah aktif di staging.
- **Langkah Uji**: Eksekusi naskah `20261023_w4_rollback.sql` dari `BEGIN;` sampai `COMMIT;`.
- **Hasil yang Diharapkan**: Transaksi rollback berhasil tanpa kegagalan dependensi.
- **Bukti yang Harus Dicatat**: Log eksekusi rollback.

### TC-8.2: Verifikasi Penghapusan Objek W4
- **Prasyarat**: TC-8.1 selesai dieksekusi.
- **Langkah Uji**:
  ```sql
  -- 1. Cek RPC W4
  SELECT proname FROM pg_proc 
  WHERE proname IN ('create_order_atomic', 'cancel_order_atomic', 'update_order_status');

  -- 2. Cek Skema app_private
  SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'app_private';

  -- 3. Cek Policy Baru W4
  SELECT policyname FROM pg_policies 
  WHERE policyname IN ('orders_select_policy', 'order_items_select_policy');
  ```
- **Hasil yang Diharapkan**: Seluruh kueri mengembalikan **0 baris** (objek W4 telah terhapus bersih).
- **Bukti yang Harus Dicatat**: Output kueri verifikasi objek.

### TC-8.3: Verifikasi Ketersediaan Policy Baseline Pasca-Rollback
- **Prasyarat**: TC-8.1 selesai dieksekusi.
- **Langkah Uji**:
  ```sql
  SELECT tablename, policyname, cmd, roles 
  FROM pg_policies 
  WHERE tablename IN ('orders', 'order_items');
  ```
- **Hasil yang Diharapkan**: Terdaftar policy `orders_select_own` dan `order_items_select` sehingga pembeli dan penjual tetap dapat membaca riwayat data mereka dan tabel tidak terkunci dalam status *deny-all*.
- **Bukti yang Harus Dicatat**: Daftar policy RLS aktif pasca-rollback.

---

## 9. INVENTARIS BLOCKER & ASUMSI YANG BELUM TERVERIFIKASI

| No | Komponen | Status Saat Ini | Dampak Risiko | Bukti yang Wajib Diperoleh di Staging |
|---|---|---|---|---|
| 1 | **Definisi Asli `pg_policies` Pre-W4** | Belum ada dump resmi di git | Jika rollback dijalankan, hanya policy minimal yang dipulihkan. Policy lama lainnya (seperti admin global read) hilang jika tidak diekspor sebelumnya. | Hasil eksekusi `TC-0.1` wajib disimpan sebelum menjalankan migrasi di Staging. |
| 2 | **Keberadaan Trigger Stok di Supabase** | Belum terverifikasi di server | Jika terdapat trigger yang mengurangi stok saat `order_items` di-insert, mutasi di RPC menyebabkan pengurangan stok 2x lipat. | Hasil eksekusi `TC-0.2` wajib diperiksa sebelum migrasi. |
| 3 | **Constraint Check Status Pesanan** | Asumsi nilai status: `pending`, `confirmed`, `completed`, `cancelled` | Jika database target memiliki enum / constraint yang melarang salah satu status di atas, RPC akan gagal saat mutasi. | Hasil eksekusi `TC-0.3` pada check constraints tabel `orders`. |

---

## 10. KEPUTUSAN & TAHAP SELANJUTNYA

- **Status Kode Lokal:** **READY FOR STAGING**
- **Status Rilis Produksi:** **PRODUCTION GO DITAHAN (BLOCKED)**
- **Kriteria Kelulusan ke Production GO:**
  1. Seluruh 24 test case dalam dokumen ini dieksekusi di database Supabase Staging dengan status **PASS 100%**.
  2. Snapshot baseline `pg_policies` dan konfirmasi ketiadaan trigger stok telah diarsipkan.
  3. Uji konkurensi (TC-4.1) terbukti mencegah *overselling* secara nyata.
