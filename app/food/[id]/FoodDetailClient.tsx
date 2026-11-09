"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FoodItem, SellerPublicProfile } from "@/lib/types/food";
import type { UserRole } from "@/lib/auth/roles";
import type { UserLocationData } from "@/app/actions/location";
import { createOrderAction } from "@/app/actions/order";
import { formatFullDateTimeWIB } from "@/lib/utils/format";
import { calculateDistance, formatDistance } from "@/lib/utils/distance";

interface FoodDetailClientProps {
  food: FoodItem;
  userRole: UserRole | null;
  userId: string | null;
  serverTime: number;
  sellerProfile?: SellerPublicProfile | null;
  buyerLocation?: UserLocationData | null;
}

export default function FoodDetailClient({
  food,
  userRole,
  userId,
  serverTime,
  sellerProfile,
  buyerLocation,
}: FoodDetailClientProps) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [selectedMethod, setSelectedMethod] = useState<"pickup" | "delivery">(
    food.pickup_method === "delivery" ? "delivery" : "pickup"
  );
  const [addressNote, setAddressNote] = useState<string>(
    buyerLocation?.address || ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<{
    orderId: number;
    totalAmount: number;
    status: string;
  } | null>(null);

  // Cek ketersediaan bahan pakan
  const availableUntilTime = food.available_until
    ? new Date(food.available_until).getTime()
    : null;
  const isExpired =
    serverTime > 0 && availableUntilTime ? availableUntilTime < serverTime : false;
  const isSoldOut = food.status === "sold_out" || food.quantity <= 0;
  const isAvailable = !isExpired && !isSoldOut;

  // Hitung sisa waktu
  const remainingHours =
    serverTime > 0 && availableUntilTime
      ? Math.max(0, Math.floor((availableUntilTime - serverTime) / (1000 * 60 * 60)))
      : null;
  const isUrgent =
    remainingHours !== null && remainingHours <= 3 && remainingHours >= 0;

  function formatDateTime(dateStr?: string | null): string {
    return formatFullDateTimeWIB(dateStr);
  }

  const isDonation = food.type === "donation";
  const unit = food.unit || "kg";
  const totalPrice = isDonation ? 0 : Number(food.price) * selectedQuantity;

  // Profil & Lokasi Penjemputan Seller (Fitur Wajib W6)
  const hasSellerLocation = Boolean(
    sellerProfile &&
      sellerProfile.address &&
      sellerProfile.latitude !== null &&
      sellerProfile.latitude !== undefined &&
      sellerProfile.longitude !== null &&
      sellerProfile.longitude !== undefined
  );

  const sellerLat = sellerProfile?.latitude ?? null;
  const sellerLng = sellerProfile?.longitude ?? null;

  // Jarak ke lokasi peternak buyer jika koordinat buyer tersedia
  const distanceKm =
    hasSellerLocation &&
    sellerLat !== null &&
    sellerLng !== null &&
    buyerLocation?.latitude !== null &&
    buyerLocation?.latitude !== undefined &&
    buyerLocation?.longitude !== null &&
    buyerLocation?.longitude !== undefined
      ? calculateDistance(
          buyerLocation.latitude,
          buyerLocation.longitude,
          sellerLat,
          sellerLng
        )
      : null;

  const googleMapsUrl =
    hasSellerLocation && sellerLat !== null && sellerLng !== null
      ? `https://www.google.com/maps/search/?api=1&query=${sellerLat},${sellerLng}`
      : null;

  // Status kelayakan bahan pakan
  const condition = food.condition || "layak";

  return (
    <div className="flex-1 bg-slate-50 py-8 md:py-12 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigasi */}
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"
        >
          <Link href="/" className="hover:text-emerald-600 transition-colors">
            Beranda
          </Link>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <Link href="/#katalog" className="hover:text-emerald-600 transition-colors">
            Katalog Bahan Pakan
          </Link>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-xs">
            {food.name}
          </span>
        </nav>

        {/* Banner Peringatan Status Khusus (Habis / Kedaluwarsa) */}
        {!isAvailable && (
          <div
            role="alert"
            className={`mb-6 rounded-2xl border p-4 sm:p-5 text-sm ${
              isExpired
                ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                : "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-sm">
                  {isExpired
                    ? "Batas Waktu Pengambilan Telah Berakhir"
                    : "Stok Bahan Pakan Telah Habis"}
                </h4>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  {isExpired
                    ? "Bahan pakan ini telah melewati batas waktu pengambilan dan ditutup demi menjaga standar mutu pakan ternak."
                    : "Seluruh stok bahan pakan ini telah diselamatkan oleh peternak lain."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Layout Utama Dua Kolom */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Kolom Kiri: Foto, Info Kondisi, Lokasi Penjemputan & Peta (7 Kolom) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Foto Bahan Pakan */}
            <div className="relative aspect-4/3 sm:aspect-16/10 w-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
              {food.image_url && !imgError ? (
                <img
                  src={food.image_url}
                  alt={food.name}
                  className="h-full w-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-slate-900 text-emerald-700 dark:text-emerald-300 p-8 text-center">
                  <svg
                    className="h-16 w-16 text-emerald-600/70 mb-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.2"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                    />
                  </svg>
                  <span className="text-sm font-bold">Food Rescue • Animal Feed</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Bahan Pangan Berlebih untuk Pakan Ternak
                  </span>
                </div>
              )}

              {/* Tag Kategori & Kondisi */}
              <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-slate-800 shadow-md backdrop-blur-xs dark:bg-slate-900/95 dark:text-slate-100">
                  {food.categories?.name || "Bahan Pakan"}
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold shadow-md backdrop-blur-xs ${
                    condition === "layak" || condition === "segar"
                      ? "bg-emerald-600 text-white"
                      : condition === "fermentasi"
                      ? "bg-amber-500 text-white"
                      : condition === "kering"
                      ? "bg-sky-600 text-white"
                      : condition === "basah"
                      ? "bg-blue-600 text-white"
                      : "bg-rose-600 text-white"
                  }`}
                >
                  {condition === "layak" || condition === "segar"
                    ? "Segar / Layak Pakan"
                    : condition === "fermentasi"
                    ? "Bahan Fermentasi"
                    : condition === "kering"
                    ? "Bahan Kering"
                    : condition === "basah"
                    ? "Bahan Basah / Bubur"
                    : "Afkir / Olahan"}
                </span>
              </div>
            </div>

            {/* KARTU LOKASI PENJEMPUTAN (FITUR WAJIB W6) */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Lokasi Penjemputan Bahan Pakan
                    </h2>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Titik pengambilan langsung dari mitra sumber bahan
                    </span>
                  </div>
                </div>

                {/* Indikator Jarak dari Peternak */}
                {distanceKm !== null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 self-start sm:self-auto">
                    <svg className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    <span>{formatDistance(distanceKm)} dari peternakan Anda</span>
                  </span>
                )}
              </div>

              {/* Rincian Nama Toko & Alamat */}
              <div className="mt-4 space-y-3">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Nama Toko / Sumber Bahan
                  </span>
                  <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                    {sellerProfile?.store_name || "Sumber Bahan Terdaftar"}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Alamat Lengkap Penjemputan
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">
                    {sellerProfile?.address || (
                      <span className="text-amber-600 dark:text-amber-400 italic">
                        Alamat penjemputan belum dilengkapi oleh penjual. Harap konfirmasi sebelum pengambilan.
                      </span>
                    )}
                  </p>
                </div>

                {sellerProfile?.phone && (
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Kontak Usaha
                    </span>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {sellerProfile.phone}
                    </p>
                  </div>
                )}
              </div>

              {/* Peta Preview Interaktif & Tombol Google Maps */}
              {hasSellerLocation && sellerLat !== null && sellerLng !== null ? (
                <div className="mt-5 space-y-3">
                  {/* Peta OpenStreetMap Embed */}
                  <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                    <iframe
                      title="Peta Lokasi Penjemputan"
                      width="100%"
                      height="100%"
                      loading="lazy"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${sellerLng - 0.008}%2C${sellerLat - 0.006}%2C${sellerLng + 0.008}%2C${sellerLat + 0.006}&layer=mapnik&marker=${sellerLat}%2C${sellerLng}`}
                      className="border-0"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Koordinat GPS: <strong>{sellerLat.toFixed(5)}, {sellerLng.toFixed(5)}</strong>
                    </span>

                    {googleMapsUrl && (
                      <a
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition-colors"
                      >
                        <span>Buka di Google Maps</span>
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-amber-50 p-4 border border-amber-200 text-xs text-amber-800 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-300">
                  <p className="font-semibold">⚠️ Koordinat peta belum disetel oleh mitra sumber bahan.</p>
                  <p className="mt-0.5 text-[11px]">
                    Peternak tetap dapat mengajukan pengambilan berdasarkan alamat teks yang tertera di atas.
                  </p>
                </div>
              )}
            </div>

            {/* Deskripsi & Petunjuk Penanganan Bahan Pakan */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Deskripsi &amp; Petunjuk Pemanfaatan Pakan
              </h3>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-line">
                {food.description}
              </p>

              {/* Target Ternak & Petunjuk Penyimpanan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Rekomendasi Ternak
                  </span>
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                    {food.target_livestock || "Semua Jenis Ternak"}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Petunjuk Penyimpanan
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                    {food.storage_instructions || "Simpan di tempat teduh, sejuk, dan terlindung dari serangga."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Detail Harga, Stok, & Form Pengajuan Peternak (5 Kolom) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
              {/* Header Nama Bahan */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      isAvailable
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isAvailable ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                      }`}
                    />
                    {isExpired
                      ? "Waktu Berakhir"
                      : isSoldOut
                      ? "Stok Habis"
                      : "Tersedia untuk Diambil"}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {food.name}
                </h1>
              </div>

              {/* Harga */}
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 dark:bg-slate-800/50 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="block text-xs uppercase tracking-wider text-slate-400 font-bold">
                    {isDonation ? "Donasi Sosial" : `Harga Bahan / ${unit}`}
                  </span>
                  <span
                    className={`text-2xl sm:text-3xl font-black ${
                      isDonation ? "text-purple-700 dark:text-purple-400" : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {isDonation
                      ? "GRATIS"
                      : `Rp ${Number(food.price).toLocaleString("id-ID")}`}
                  </span>
                </div>
                {!isDonation && (
                  <span className="rounded-xl bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Per {unit}
                  </span>
                )}
              </div>

              {/* Rincian Ketersediaan */}
              <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-500 dark:text-slate-400">Total Ketersediaan:</span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                    {food.quantity} {unit}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <span className="text-slate-500 dark:text-slate-400">Mulai Tersedia:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">
                    {formatDateTime(food.available_from)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <span className="text-slate-500 dark:text-slate-400">Batas Pengambilan:</span>
                  <span
                    className={`font-semibold text-right ${
                      isExpired
                        ? "text-red-600 line-through"
                        : isUrgent
                        ? "text-amber-700 font-bold"
                        : "text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {formatDateTime(food.available_until)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <span className="text-slate-500 dark:text-slate-400">Metode Penyerahan:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {food.pickup_method === "pickup"
                      ? "Ambil di Lokasi Toko (Pickup)"
                      : food.pickup_method === "delivery"
                      ? "Pengantaran ke Peternakan"
                      : "Ambil di Toko & Antar Kurir"}
                  </span>
                </div>
              </div>

              {/* Form Pengajuan Peternak */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
                {!userId ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center space-y-3 dark:border-slate-800 dark:bg-slate-850">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Anda perlu masuk sebagai <strong>Peternak (Buyer)</strong> untuk mengajukan
                      pengambilan bahan pakan ini.
                    </p>
                    <Link
                      id="btn-login-to-order"
                      href={`/login?redirect=/food/${food.id}`}
                      className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                    >
                      Login Peternak untuk Mengajukan
                    </Link>
                    <p className="text-[11px] text-slate-400">
                      Belum punya akun?{" "}
                      <Link href="/register?role=buyer" className="text-emerald-600 underline font-semibold">
                        Daftar Akun Peternak
                      </Link>
                    </p>
                  </div>
                ) : userRole !== "buyer" && userRole !== "admin" ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-2 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                    <p className="font-bold">Akun Anda: Mitra {userRole}</p>
                    <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                      Pengajuan bahan pakan ternak hanya dapat dilakukan oleh akun dengan role <strong>buyer (peternak)</strong>.
                    </p>
                    <Link
                      href="/seller"
                      className="inline-flex text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      Kembali ke Dashboard Sumber Bahan &rarr;
                    </Link>
                  </div>
                ) : !isAvailable ? (
                  <button
                    disabled
                    className="w-full rounded-2xl bg-slate-200 py-3 text-xs font-bold text-slate-500 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600"
                  >
                    Bahan Pakan Tidak Tersedia
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-4 dark:border-slate-800 dark:bg-slate-800/40">
                      {/* Pilihan Jumlah */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Jumlah Bahan yang Diajukan
                          </label>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Maksimal: {food.quantity} {unit}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedQuantity((q) => Math.max(1, q - 1))}
                            disabled={selectedQuantity <= 1}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={food.quantity}
                            value={selectedQuantity}
                            onChange={(e) => {
                              const val = Math.floor(Number(e.target.value));
                              if (val >= 1 && val <= food.quantity) {
                                setSelectedQuantity(val);
                              }
                            }}
                            className="h-10 flex-1 rounded-xl border border-slate-300 bg-white text-center text-sm font-bold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => setSelectedQuantity((q) => Math.min(food.quantity, q + 1))}
                            disabled={selectedQuantity >= food.quantity}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Metode Pengambilan */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Pilihan Metode Pengambilan
                        </label>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setSelectedMethod("pickup")}
                            disabled={food.pickup_method === "delivery"}
                            className={`rounded-xl border p-2.5 font-bold transition-all ${
                              selectedMethod === "pickup"
                                ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600 dark:bg-emerald-950 dark:text-emerald-300"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            Ambil Mandiri (Pickup)
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedMethod("delivery")}
                            disabled={food.pickup_method === "pickup"}
                            className={`rounded-xl border p-2.5 font-bold transition-all ${
                              selectedMethod === "delivery"
                                ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600 dark:bg-emerald-950 dark:text-emerald-300"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            Diantar Kurir (Delivery)
                          </button>
                        </div>
                      </div>

                      {/* Catatan / Alamat Pengantaran */}
                      <div>
                        <label htmlFor="address-note" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          {selectedMethod === "delivery"
                            ? "Alamat Tujuan Peternakan Anda"
                            : "Catatan Waktu Penjemputan ke Toko (Opsional)"}
                        </label>
                        <textarea
                          id="address-note"
                          rows={2}
                          value={addressNote}
                          onChange={(e) => setAddressNote(e.target.value)}
                          placeholder={
                            selectedMethod === "delivery"
                              ? "Masukkan alamat lengkap lokasi peternakan atau kandang Anda..."
                              : "Contoh: Diambil menggunakan pikap/truk jam 10.00 WIB..."
                          }
                          className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white resize-none"
                        />
                      </div>

                      {/* Total Biaya */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700 text-xs">
                        <span className="font-semibold text-slate-600 dark:text-slate-400">Total Pengajuan:</span>
                        <span className="font-extrabold text-sm text-emerald-700 dark:text-emerald-400">
                          {isDonation
                            ? "GRATIS (Rp 0)"
                            : `Rp ${totalPrice.toLocaleString("id-ID")}`}
                        </span>
                      </div>
                    </div>

                    {/* Alert Error */}
                    {orderError && (
                      <div
                        role="alert"
                        className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 flex items-start gap-2"
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
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-center space-y-3 dark:border-emerald-900 dark:bg-emerald-950/40">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                            Pengajuan Bahan Pakan Berhasil Dikirim!
                          </h4>
                          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                            Nomor Pengajuan: <strong className="font-mono">#{orderSuccess.orderId}</strong>
                          </p>
                          <p className="mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                            Status saat ini: <span className="font-bold uppercase tracking-wider">Menunggu Konfirmasi Sumber Bahan</span>
                          </p>
                        </div>
                        <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                          <Link
                            href="/buyer"
                            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                          >
                            Lihat di Area Peternak
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setOrderSuccess(null);
                              router.refresh();
                            }}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            Ajukan Bahan Lain
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <button
                          id="btn-submit-order"
                          type="button"
                          disabled={isSubmitting}
                          onClick={async () => {
                            setOrderError(null);
                            if (selectedMethod === "delivery" && (!addressNote || addressNote.trim().length < 5)) {
                              setOrderError("Mohon masukkan alamat lengkap peternakan Anda untuk pengantaran kurir.");
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
                                setOrderError(res.error || "Gagal mengajukan bahan pakan.");
                              } else {
                                setOrderSuccess(res.data);
                              }
                            } catch (err) {
                              setOrderError(err instanceof Error ? err.message : "Terjadi kesalahan sistem.");
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
                              <span>Memproses Pengajuan...</span>
                            </>
                          ) : isDonation ? (
                            `Ajukan Penerimaan Donasi (${selectedQuantity} ${unit})`
                          ) : (
                            `Ajukan Pengambilan (${selectedQuantity} ${unit} • Rp ${totalPrice.toLocaleString("id-ID")})`
                          )}
                        </button>

                        <p className="text-center text-[11px] text-slate-400">
                          Data penjemputan dan transaksi aman, tersinkronisasi langsung ke mitra sumber bahan.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Tombol Navigasi Kembali */}
            <div className="text-center">
              <Link
                href="/#katalog"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-emerald-600 transition-colors dark:text-slate-400 dark:hover:text-emerald-400"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Kembali ke Katalog Bahan Pakan</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
