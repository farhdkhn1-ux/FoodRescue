"use client";

import { useState, useTransition } from "react";
import { updateUserLocationAction, type UserLocationData } from "@/app/actions/location";

interface UserLocationCardProps {
  initialLocation: UserLocationData;
  title?: string;
  description?: string;
  onLocationUpdated?: (newLoc: UserLocationData) => void;
}

export default function UserLocationCard({
  initialLocation,
  title = "Pengaturan Lokasi & Koordinat GPS",
  description = "Tentukan alamat dan koordinat GPS untuk optimasi rute penjemputan dan pengantaran.",
  onLocationUpdated,
}: UserLocationCardProps) {
  const [location, setLocation] = useState<UserLocationData>(initialLocation);
  const [isEditing, setIsEditing] = useState(false);
  const [address, setAddress] = useState(initialLocation.address || "");
  const [latitude, setLatitude] = useState<string>(
    initialLocation.latitude !== null && initialLocation.latitude !== undefined
      ? String(initialLocation.latitude)
      : ""
  );
  const [longitude, setLongitude] = useState<string>(
    initialLocation.longitude !== null && initialLocation.longitude !== undefined
      ? String(initialLocation.longitude)
      : ""
  );
  const [geoLoading, setGeoLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  // Handler: Deteksi koordinat perangkat via Browser Geolocation API
  function handleDetectGPS() {
    setFeedback(null);
    if (!navigator.geolocation) {
      setFeedback({
        type: "error",
        message: "Peramban Anda tidak mendukung deteksi lokasi GPS otomatis.",
      });
      return;
    }

    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setGeoLoading(false);
        setFeedback({
          type: "success",
          message: "Koordinat GPS berhasil terdeteksi dari perangkat Anda.",
        });
      },
      (err) => {
        setGeoLoading(false);
        let errorMsg = "Gagal mendeteksi koordinat GPS.";
        if (err.code === 1) errorMsg = "Izin akses lokasi ditolak oleh browser Anda.";
        if (err.code === 2) errorMsg = "Sinyal GPS atau posisi perangkat tidak tersedia.";
        if (err.code === 3) errorMsg = "Permintaan deteksi lokasi telah kedaluwarsa (timeout).";
        setFeedback({ type: "error", message: errorMsg });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  // Handler: Simpan data lokasi ke tabel users (menggunakan kolom address, latitude, longitude eksisting)
  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    const trimmedAddress = address.trim();
    if (!trimmedAddress || trimmedAddress.length < 5) {
      setFeedback({
        type: "error",
        message: "Alamat lengkap wajib diisi minimal 5 karakter.",
      });
      return;
    }

    const numLat = latitude ? parseFloat(latitude) : null;
    const numLon = longitude ? parseFloat(longitude) : null;

    startTransition(async () => {
      const res = await updateUserLocationAction(trimmedAddress, numLat, numLon);
      if (res.success && res.data) {
        setLocation(res.data);
        setIsEditing(false);
        setFeedback({
          type: "success",
          message: "Data lokasi berhasil diperbarui!",
        });
        if (onLocationUpdated) {
          onLocationUpdated(res.data);
        }
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Gagal memperbarui lokasi.",
        });
      }
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>

        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 self-start sm:self-auto transition-colors"
          >
            <svg
              className="h-3.5 w-3.5 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            <span>Ubah Lokasi</span>
          </button>
        )}
      </div>

      {/* Banner Feedback */}
      {feedback && (
        <div
          role="alert"
          className={`mt-4 rounded-xl p-3 text-xs font-medium flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
              : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-bold underline ml-2"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Mode Baca (Display Mode) */}
      {!isEditing ? (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Alamat Terdaftar
            </span>
            <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
              {location.address || "Belum ada alamat terdaftar."}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Koordinat GPS (Latitude, Longitude)
            </span>
            <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
              {location.latitude !== null && location.longitude !== null
                ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
                : "Koordinat GPS belum diatur."}
            </p>
          </div>
        </div>
      ) : (
        /* Mode Edit Form */
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="loc-address"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
            >
              Alamat Lengkap <span className="text-red-500">*</span>
            </label>
            <textarea
              id="loc-address"
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Contoh: Jl. Sudirman No. 123, Kel. Senayan, Jakarta Selatan"
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="loc-lat"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                Latitude (Lintang)
              </label>
              <input
                id="loc-lat"
                type="text"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="-6.2088"
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="loc-lon"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                Longitude (Bujur)
              </label>
              <input
                id="loc-lon"
                type="text"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="106.8456"
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleDetectGPS}
              disabled={geoLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 transition-colors"
            >
              {geoLoading ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                  <span>Mendeteksi GPS...</span>
                </>
              ) : (
                <>
                  <svg
                    className="h-3.5 w-3.5 text-emerald-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 100 12 6 6 0 000-12zm0 4a2 2 0 100 4 2 2 0 000-4z"
                    />
                  </svg>
                  <span>Deteksi Lokasi GPS Saya</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setAddress(location.address || "");
                  setLatitude(location.latitude !== null ? String(location.latitude) : "");
                  setLongitude(location.longitude !== null ? String(location.longitude) : "");
                }}
                disabled={isPending}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-60 transition-colors"
              >
                {isPending ? "Menyimpan..." : "Simpan Lokasi"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

