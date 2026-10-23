"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FoodItem } from "@/lib/types/food";
import type { UserRole } from "@/lib/auth/roles";
import { createOrderAction } from "@/app/actions/order";

interface FoodDetailClientProps {
  food: FoodItem;
  userRole: UserRole | null;
  userId: string | null;
  serverTime: number;
}

export default function FoodDetailClient({
  food,
  userRole,
  userId,
  serverTime,
}: FoodDetailClientProps) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [selectedMethod, setSelectedMethod] = useState<"pickup" | "delivery">(
    food.pickup_method === "delivery" ? "delivery" : "pickup"
  );
  const [addressNote, setAddressNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<{
    orderId: number;
    totalAmount: number;
    status: string;
  } | null>(null);

  // Cek kondisi ketersediaan berbasis waktu tersimpan dari server
  const availableUntilTime = food.available_until
    ? new Date(food.available_until).getTime()
    : null;
  const isExpired = serverTime > 0 && availableUntilTime ? availableUntilTime < serverTime : false;
  const isSoldOut = food.status === "sold_out" || food.quantity <= 0;
  const isAvailable = !isExpired && !isSoldOut;

  // Hitung sisa waktu
  const remainingHours = serverTime > 0 && availableUntilTime
    ? Math.max(0, Math.floor((availableUntilTime - serverTime) / (1000 * 60 * 60)))
    : null;
  const isUrgent =
    remainingHours !== null && remainingHours <= 3 && remainingHours >= 0;

  function formatDateTime(dateStr?: string | null): string {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(d);
    } catch {
      return dateStr;
    }
  }

  const isDonation = food.type === "donation";
  const totalPrice = isDonation ? 0 : Number(food.price) * selectedQuantity;

  return (
    <div className="flex-1 bg-slate-50 py-8 md:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigasi */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs text-slate-500">
          <Link href="/" className="hover:text-emerald-600 transition-colors">
            Beranda
          </Link>
          <span className="text-slate-300">/</span>
          <Link href="/#katalog" className="hover:text-emerald-600 transition-colors">
            Katalog
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-800 font-semibold truncate max-w-xs">{food.name}</span>
        </nav>

        {/* Banner Peringatan Status Khusus (Habis / Kedaluwarsa) */}
        {!isAvailable && (
          <div
            role="alert"
            className={`mb-6 rounded-2xl border p-4 sm:p-5 text-sm ${
              isExpired
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-slate-300 bg-slate-100 text-slate-800"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                {isExpired ? (
                  <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <div>
                <h4 className="font-bold text-sm">
                  {isExpired ? "Batas Waktu Pengambilan Telah Berakhir" : "Stok Makanan Telah Habis"}
                </h4>
                <p className="mt-0.5 text-xs text-slate-600">
                  {isExpired
                    ? "Makanan ini telah melewati batas waktu ketersediaan dan tidak dapat diajukan demi standar keamanan pangan."
                    : "Seluruh porsi makanan ini telah habis diselamatkan oleh pengguna lain."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Konten Utama 2 Kolom */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          {/* Kolom Kiri: Foto & Detail Visual (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Foto Makanan */}
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
              <div className="aspect-video sm:aspect-4/3 w-full bg-slate-100 relative">
                {food.image_url && !imgError ? (
                  <img
                    src={food.image_url}
                    alt={food.name}
                    onError={() => setImgError(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-slate-400 p-8 text-center">
                    <svg
                      className="h-16 w-16 text-slate-300 mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-sm font-semibold text-slate-500">
                      Foto produk belum disediakan oleh penjual
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Deskripsi dan rincian makanan dapat diperiksa di bawah
                    </p>
                  </div>
                )}

                {/* Badges di atas Foto */}
                <div className="absolute top-4 left-4 flex flex-wrap gap-2 pointer-events-none">
                  <span className="inline-flex items-center rounded-xl bg-white/95 backdrop-blur-xs px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm">
                    {food.categories?.name || "Kategori Makanan"}
                  </span>
                  {isDonation ? (
                    <span className="inline-flex items-center gap-1 rounded-xl bg-amber-500/95 text-white backdrop-blur-xs px-3 py-1.5 text-xs font-bold shadow-sm">
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Donasi Sosial Gratis
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-xl bg-emerald-600/95 text-white backdrop-blur-xs px-3 py-1.5 text-xs font-bold shadow-sm">
                      Penyelamatan Berbayar
                    </span>
                  )}
                </div>

                {isUrgent && isAvailable && (
                  <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-amber-500/95 px-3 py-1.5 text-center text-xs font-bold text-white shadow-sm">
                    Batas waktu segera berakhir ({remainingHours} jam tersisa)
                  </div>
                )}
              </div>
            </div>

            {/* Deskripsi & Anjuran Konsumsi */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                Deskripsi Makanan
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">
                {food.description || "Tidak ada rincian deskripsi tambahan."}
              </p>

              {/* Anjuran Keamanan Pangan */}
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-xs text-emerald-900">
                <div className="flex items-start gap-2.5">
                  <svg
                    className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 1a9 9 0 100 18 9 9 0 000-18zm.75 5.5a.75.75 0 00-1.5 0v5a.75.75 0 001.5 0v-5zm0 8a.75.75 0 10-1.5 0 .75.75 0 001.5 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <span className="font-bold">Standar Keamanan Pangan Food Rescue:</span>
                    <p className="mt-0.5 leading-relaxed text-emerald-800">
                      Seluruh makanan yang didaftarkan telah diverifikasi layak konsumsi oleh mitra penjual.
                      Harap segera mengambil dan mengonsumsi makanan sebelum batas waktu kedaluwarsa.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Rincian Ketersediaan, Harga & Form Pengajuan (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Kartu Ringkasan & Harga */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
                  <span>ID Menu: #{food.id}</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      isAvailable
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isAvailable ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                      }`}
                    />
                    {isExpired
                      ? "Kedaluwarsa"
                      : isSoldOut
                      ? "Stok Habis"
                      : "Tersedia untuk Diambil"}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  {food.name}
                </h1>
              </div>

              {/* Harga */}
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="block text-xs uppercase tracking-wider text-slate-400 font-bold">
                    {isDonation ? "Nilai Donasi" : "Harga Penyelamatan"}
                  </span>
                  <span
                    className={`text-2xl sm:text-3xl font-black ${
                      isDonation ? "text-emerald-700" : "text-emerald-600"
                    }`}
                  >
                    {isDonation
                      ? "GRATIS"
                      : `Rp ${Number(food.price).toLocaleString("id-ID")}`}
                  </span>
                </div>
                {!isDonation && (
                  <span className="rounded-xl bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    Per Porsi
                  </span>
                )}
              </div>

              {/* Spesifikasi Ketersediaan */}
              <div className="space-y-3 divide-y divide-slate-100 text-xs">
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-500">Porsi Tersedia:</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {food.quantity} porsi
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <span className="text-slate-500">Mulai Tersedia:</span>
                  <span className="font-semibold text-slate-800 text-right">
                    {formatDateTime(food.available_from)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <span className="text-slate-500">Batas Waktu Pengambilan:</span>
                  <span
                    className={`font-semibold text-right ${
                      isExpired
                        ? "text-red-600 line-through"
                        : isUrgent
                        ? "text-amber-700 font-bold"
                        : "text-slate-800"
                    }`}
                  >
                    {formatDateTime(food.available_until)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <span className="text-slate-500">Metode Penyerahan:</span>
                  <span className="font-bold text-slate-900">
                    {food.pickup_method === "pickup"
                      ? "Ambil di Tempat (Self-Pickup)"
                      : food.pickup_method === "delivery"
                      ? "Pengantaran (Delivery)"
                      : "Pickup di Tempat & Delivery"}
                  </span>
                </div>
              </div>

              {/* Area Aksi & Form Pengajuan W4 */}
              <div className="border-t border-slate-100 pt-5">
                {/* Kasus 1: Pengguna Belum Login */}
                {!userId ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center space-y-3">
                    <p className="text-xs font-semibold text-slate-700">
                      Anda perlu masuk sebagai <strong>Pembeli</strong> untuk mengajukan
                      penyelamatan makanan ini.
                    </p>
                    <Link
                      id="btn-login-to-order"
                      href={`/login?redirect=/food/${food.id}`}
                      className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                    >
                      Login untuk Mengajukan
                    </Link>
                    <p className="text-[11px] text-slate-400">
                      Belum punya akun?{" "}
                      <Link href="/register?role=buyer" className="text-emerald-600 underline font-semibold">
                        Daftar Pembeli
                      </Link>
                    </p>
                  </div>
                ) : userRole !== "buyer" && userRole !== "admin" ? (
                  /* Kasus 2: Login sebagai Penjual atau Kurir */
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-2">
                    <p className="font-bold">Akun Anda: Mitra {userRole}</p>
                    <p className="text-amber-800 leading-relaxed">
                      Pengajuan pembelian atau penerimaan makanan donasi hanya dapat dilakukan oleh akun dengan role <strong>buyer</strong>.
                    </p>
                    <Link
                      href="/seller"
                      className="inline-flex text-xs font-bold text-emerald-700 hover:underline"
                    >
                      Kembali ke Dashboard Penjual &rarr;
                    </Link>
                  </div>
                ) : !isAvailable ? (
                  /* Kasus 3: Makanan Habis atau Kedaluwarsa */
                  <button
                    disabled
                    className="w-full cursor-not-allowed rounded-2xl bg-slate-200 py-3.5 text-center text-xs font-bold text-slate-500"
                  >
                    {isExpired ? "Batas Pengambilan Telah Berakhir" : "Stok Makanan Telah Habis"}
                  </button>
                ) : (
                  /* Kasus 4: Pembeli Terautentikasi & Makanan Tersedia */
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Form Pengajuan Penyelamatan Makanan
                      </h4>

                      {/* Jumlah Porsi */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <label htmlFor="order-quantity" className="font-bold text-slate-700">
                            Jumlah Porsi
                          </label>
                          <span className="text-slate-400">
                            Maks. {food.quantity} porsi
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedQuantity((q) => Math.max(1, q - 1))}
                            disabled={selectedQuantity <= 1}
                            aria-label="Kurangi porsi"
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40"
                          >
                            -
                          </button>
                          <input
                            id="order-quantity"
                            type="number"
                            min={1}
                            max={food.quantity}
                            value={selectedQuantity}
                            onChange={(e) => {
                              const val = Math.floor(Number(e.target.value));
                              if (val >= 1 && val <= food.quantity) {
                                setSelectedQuantity(val);
                              }
                            }}
                            className="h-10 flex-1 rounded-xl border border-slate-300 bg-white text-center text-sm font-bold text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => setSelectedQuantity((q) => Math.min(food.quantity, q + 1))}
                            disabled={selectedQuantity >= food.quantity}
                            aria-label="Tambah porsi"
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Metode Pengambilan */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Metode Pengambilan yang Dipilih
                        </label>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setSelectedMethod("pickup")}
                            disabled={food.pickup_method === "delivery"}
                            className={`rounded-xl border p-2.5 font-bold transition-all ${
                              selectedMethod === "pickup"
                                ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                            }`}
                          >
                            Ambil Sendiri (Pickup)
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedMethod("delivery")}
                            disabled={food.pickup_method === "pickup"}
                            className={`rounded-xl border p-2.5 font-bold transition-all ${
                              selectedMethod === "delivery"
                                ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                            }`}
                          >
                            Pengantaran (Delivery)
                          </button>
                        </div>
                      </div>

                      {/* Catatan / Alamat Pengantaran */}
                      <div>
                        <label htmlFor="address-note" className="block text-xs font-bold text-slate-700 mb-1">
                          {selectedMethod === "delivery"
                            ? "Alamat Tujuan Pengantaran"
                            : "Catatan Waktu Penjemputan (Opsional)"}
                        </label>
                        <textarea
                          id="address-note"
                          rows={2}
                          value={addressNote}
                          onChange={(e) => setAddressNote(e.target.value)}
                          placeholder={
                            selectedMethod === "delivery"
                              ? "Masukkan alamat lengkap penyerahan makanan..."
                              : "Contoh: Diambil jam 14.30 WIB..."
                          }
                          className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      {/* Total Biaya */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <span className="font-semibold text-slate-600">Total Pengajuan:</span>
                        <span className="font-extrabold text-sm text-emerald-700">
                          {isDonation
                            ? "GRATIS (Rp 0)"
                            : `Rp ${totalPrice.toLocaleString("id-ID")}`}
                        </span>
                      </div>
                    </div>

                    {/* Alert Pesan Error jika Ada */}
                    {orderError && (
                      <div
                        role="alert"
                        className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2"
                      >
                        <svg className="h-4 w-4 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <p className="font-semibold">Pengajuan Gagal</p>
                          <p className="mt-0.5">{orderError}</p>
                        </div>
                      </div>
                    )}

                    {/* Konfirmasi Sukses */}
                    {orderSuccess ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-center space-y-3">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-emerald-900">
                            Pesanan Berhasil Diajukan!
                          </h4>
                          <p className="mt-1 text-xs text-emerald-700">
                            Nomor Pesanan: <strong className="font-mono">#{orderSuccess.orderId}</strong>
                          </p>
                          <p className="mt-0.5 text-[11px] text-emerald-600">
                            Status saat ini: <span className="font-bold uppercase tracking-wider">Menunggu Konfirmasi</span>
                          </p>
                        </div>
                        <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                          <Link
                            href="/buyer"
                            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                          >
                            Lihat Riwayat di Area Pembeli
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setOrderSuccess(null);
                              router.refresh();
                            }}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            Pesan Lagi
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Tombol Ajukan */
                      <div className="space-y-2">
                        <button
                          id="btn-submit-order"
                          type="button"
                          disabled={isSubmitting}
                          onClick={async () => {
                            setOrderError(null);
                            if (selectedMethod === "delivery" && (!addressNote || addressNote.trim().length < 5)) {
                              setOrderError("Mohon masukkan alamat lengkap pengantaran (minimal 5 karakter).");
                              return;
                            }
                            setIsSubmitting(true);
                            try {
                              const res = await createOrderAction({
                                foodId: food.id,
                                quantity: selectedQuantity,
                                pickupMethod: selectedMethod,
                                shippingAddress: selectedMethod === "delivery" ? addressNote.trim() : null,
                              });

                              if (!res.success || !res.data) {
                                setOrderError(res.error || "Gagal mengajukan pesanan.");
                              } else {
                                setOrderSuccess(res.data);
                              }
                            } catch (err) {
                              setOrderError(err instanceof Error ? err.message : "Terjadi kesalahan internal.");
                            } finally {
                              setIsSubmitting(false);
                            }
                          }}
                          className={`inline-flex w-full min-h-[46px] items-center justify-center gap-2 rounded-2xl py-3 text-xs font-bold text-white shadow-md transition-all ${
                            isSubmitting
                              ? "bg-slate-400 cursor-not-allowed"
                              : isDonation
                              ? "bg-emerald-700 hover:bg-emerald-800 shadow-emerald-700/20"
                              : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                          }`}
                        >
                          {isSubmitting ? (
                            <>
                              <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                              </svg>
                              <span>Memproses Transaksi Atomik...</span>
                            </>
                          ) : isDonation ? (
                            `Ajukan Penerimaan Donasi (${selectedQuantity} Porsi)`
                          ) : (
                            `Ajukan Pembelian (${selectedQuantity} Porsi • Rp ${totalPrice.toLocaleString("id-ID")})`
                          )}
                        </button>

                        <p className="text-center text-[11px] text-slate-400">
                          Pesanan Anda disimpan secara aman & stok dikunci otomatis oleh sistem.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Tombol Kembali ke Katalog */}
            <div className="text-center">
              <Link
                href="/#katalog"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-emerald-600 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Kembali ke Katalog Makanan</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
