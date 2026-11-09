"use client";

import { useState } from "react";
import { updateStoreProfileAction, type UserLocationData } from "@/app/actions/location";

interface SellerStoreProfileCardProps {
  initialProfile: UserLocationData;
  onProfileUpdated?: (updated: UserLocationData) => void;
}

export default function SellerStoreProfileCard({
  initialProfile,
  onProfileUpdated,
}: SellerStoreProfileCardProps) {
  const [storeName, setStoreName] = useState(initialProfile.store_name || "");
  const [phone, setPhone] = useState(initialProfile.phone || "");
  const [isPhonePublic, setIsPhonePublic] = useState(Boolean(initialProfile.is_phone_public));
  const [address, setAddress] = useState(initialProfile.address || "");
  const [latitude, setLatitude] = useState<string>(
    initialProfile.latitude !== null && initialProfile.latitude !== undefined
      ? String(initialProfile.latitude)
      : ""
  );
  const [longitude, setLongitude] = useState<string>(
    initialProfile.longitude !== null && initialProfile.longitude !== undefined
      ? String(initialProfile.longitude)
      : ""
  );

  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const isLocationComplete = Boolean(
    storeName.trim() &&
      address.trim().length >= 8 &&
      latitude !== "" &&
      longitude !== "" &&
      !isNaN(Number(latitude)) &&
      !isNaN(Number(longitude))
  );

  // Deteksi lokasi via browser GPS
  function handleDetectLocation() {
    if (!navigator.geolocation) {
      setFeedback({
        type: "error",
        message: "Browser Anda tidak mendukung deteksi lokasi GPS otomatis.",
      });
      return;
    }

    setIsDetectingLocation(true);
    setFeedback(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setLatitude(lat);
        setLongitude(lng);
        setIsDetectingLocation(false);
        setFeedback({
          type: "success",
          message: "Koordinat GPS toko berhasil terdeteksi dari perangkat Anda.",
        });
      },
      (err) => {
        setIsDetectingLocation(false);
        setFeedback({
          type: "error",
          message: `Gagal mendeteksi lokasi GPS: ${err.message}. Silakan masukkan koordinat secara manual.`,
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  // Simpan profil toko
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!storeName.trim()) {
      setFeedback({ type: "error", message: "Nama toko/usaha sumber bahan wajib diisi." });
      return;
    }

    if (!address.trim() || address.trim().length < 8) {
      setFeedback({
        type: "error",
        message: "Alamat lengkap penjemputan wajib diisi detail minimal 8 karakter.",
      });
      return;
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      setFeedback({
        type: "error",
        message: "Koordinat latitude (-90 s/d 90) dan longitude (-180 s/d 180) tidak valid.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateStoreProfileAction({
        store_name: storeName.trim(),
        phone: phone.trim() || null,
        is_phone_public: isPhonePublic,
        address: address.trim(),
        latitude: latNum,
        longitude: lngNum,
      });

      if (res.success && res.data) {
        setFeedback({
          type: "success",
          message: "Profil toko dan titik penjemputan bahan pakan berhasil disimpan!",
        });
        if (onProfileUpdated) {
          onProfileUpdated(res.data);
        }
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Gagal menyimpan profil toko.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        message: "Terjadi kesalahan jaringan saat menyimpan profil toko.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  const googleMapsUrl =
    latitude && longitude && !isNaN(Number(latitude)) && !isNaN(Number(longitude))
      ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
      : null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 mb-2">
            <svg
              className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>Lokasi Penjemputan Sumber Bahan (Fitur Wajib)</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Profil Toko & Titik Penjemputan Bahan Pakan
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Atur nama usaha dan lokasi satu kali. Data ini akan otomatis ditampilkan kepada peternak (buyer) pada setiap listing bahan pakan Anda.
          </p>
        </div>

        {/* Status Kelengkapan Badge */}
        <div>
          {isLocationComplete ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              Lokasi Siap & Terverifikasi
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse">
              <span className="h-2 w-2 rounded-full bg-amber-600" />
              Wajib Dilengkapi
            </span>
          )}
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          role="alert"
          className={`mt-6 rounded-2xl p-4 text-xs font-medium flex items-center gap-3 ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800"
              : "bg-red-50 text-red-900 border border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800"
          }`}
        >
          <span className="text-base">{feedback.type === "success" ? "✓" : "⚠️"}</span>
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Form Profil Toko */}
      <form onSubmit={handleSave} className="mt-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Nama Toko / Usaha */}
          <div>
            <label
              htmlFor="store_name"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Nama Toko / Sumber Bahan <span className="text-red-500">*</span>
            </label>
            <input
              id="store_name"
              type="text"
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Contoh: Resto Berkah Nusantara / Pabrik Tahu Sejahtera"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Nomor Kontak / WhatsApp */}
          <div>
            <label
              htmlFor="store_phone"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Nomor WhatsApp / Telepon Usaha
            </label>
            <input
              id="store_phone"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Contoh: 081234567890"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <label className="flex items-center gap-2 mt-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={isPhonePublic}
                onChange={(e) => setIsPhonePublic(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Izinkan nomor telepon ditampilkan ke pembeli terdaftar (Zero-Trust Privacy)</span>
            </label>
          </div>
        </div>

        {/* Alamat Lengkap Penjemputan */}
        <div>
          <label
            htmlFor="store_address"
            className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
          >
            Alamat Lengkap Lokasi Penjemputan Bahan <span className="text-red-500">*</span>
          </label>
          <textarea
            id="store_address"
            rows={3}
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Jalan, Nomor Bangunan, RT/RW, Kelurahan, Kecamatan, Kota/Kabupaten, Patokan Lokasi Penjemputan"
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white resize-none"
          />
        </div>

        {/* Deteksi GPS & Koordinat */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Koordinat GPS Penjemputan <span className="text-red-500">*</span>
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Diperlukan agar peternak dapat menghitung jarak dan navigasi Google Maps.
              </span>
            </div>

            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={isDetectingLocation}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 transition-all shrink-0"
            >
              {isDetectingLocation ? (
                <>
                  <svg
                    className="h-3.5 w-3.5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                  </svg>
                  <span>Mendeteksi GPS...</span>
                </>
              ) : (
                <>
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="22" y1="12" x2="18" y2="12" />
                    <line x1="6" y1="12" x2="2" y2="12" />
                    <line x1="12" y1="6" x2="12" y2="2" />
                    <line x1="12" y1="22" x2="12" y2="18" />
                  </svg>
                  <span>Deteksi Lokasi GPS Saya</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="store_lat"
                className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
              >
                Latitude
              </label>
              <input
                id="store_lat"
                type="number"
                step="any"
                required
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="-6.2088"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="store_lng"
                className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
              >
                Longitude
              </label>
              <input
                id="store_lng"
                type="number"
                step="any"
                required
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="106.8456"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Preview Google Maps */}
          {googleMapsUrl && (
            <div className="mt-3 flex items-center justify-between border-t border-slate-200/80 pt-3 dark:border-slate-700">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Koordinat Terpasang: <strong className="text-slate-700 dark:text-slate-200">{latitude}, {longitude}</strong>
              </span>
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 underline underline-offset-2"
              >
                <span>Buka Titik di Google Maps</span>
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          )}
        </div>

        {/* Tombol Simpan */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 transition-all"
          >
            {isSaving ? "Menyimpan Profil..." : "Simpan Profil Toko & Lokasi"}
          </button>
        </div>
      </form>
    </div>
  );
}

