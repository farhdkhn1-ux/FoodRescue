"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function formatRoleDisplay(role: string): string {
  switch (role.toLowerCase()) {
    case "error_database":
      return "Kendala Database (Gagal Verifikasi)";
    case "role_tidak_ditemukan":
      return "Role Tidak Ditemukan";
    case "role_tidak_valid":
      return "Role Tidak Sah / Di Luar Ketentuan";
    default:
      return role;
  }
}

function getExplanationMessage(role: string): string {
  switch (role.toLowerCase()) {
    case "error_database":
      return "Sistem mendeteksi kendala koneksi atau query saat memverifikasi role akun Anda dari server database. Demi keamanan, akses privat ditutup sementara (Fail-Closed).";
    case "role_tidak_ditemukan":
      return "Akun Anda terautentikasi, namun data role belum terdaftar di tabel pengguna sistem Food Rescue. Silakan hubungi admin atau login ulang.";
    case "role_tidak_valid":
      return "Akun Anda memiliki nilai role yang tidak sah atau rusak. Akses ke area privat ini ditolak.";
    default:
      return "Akun Anda tidak memiliki hak akses yang diizinkan untuk membuka halaman ini. Setiap area privat di Food Rescue dilindungi berdasarkan role akun pengguna.";
  }
}

function UnauthorizedContent() {
  const searchParams = useSearchParams();
  const requiredRole = searchParams.get("required") || "Role khusus";
  const currentRole = searchParams.get("current") || "Tidak diketahui";

  const isSystemError =
    currentRole === "error_database" ||
    currentRole === "role_tidak_ditemukan" ||
    currentRole === "role_tidak_valid";

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg text-center">
        {/* Shield Icon SVG */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400 mb-6 shadow-sm">
          <svg
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zM12 16.5h.008v.008H12v-.008z"
            />
          </svg>
        </div>

        {/* Status Code & Judul */}
        <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 dark:bg-red-950/80 dark:text-red-300 mb-3">
          {isSystemError ? "Status 403 • Verifikasi Gagal" : "Status 403 • Akses Tidak Diizinkan"}
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {isSystemError ? "Otorisasi Akun Tidak Terverifikasi" : "Izin Akses Tidak Memadai"}
        </h1>
        <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
          {getExplanationMessage(currentRole)}
        </p>

        {/* Card Detail Otorisasi */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
            Rincian Verifikasi Otorisasi Sisi Server
          </h2>
          <div className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">Role Akun Anda Saat Ini:</span>
              <span className="font-semibold uppercase text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md text-xs">
                {formatRoleDisplay(currentRole)}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">Role yang Dibutuhkan:</span>
              <span className="font-semibold uppercase text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2.5 py-0.5 rounded-md text-xs">
                {requiredRole}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
              <span>Metode Proteksi:</span>
              <span>Server-Side Guard & Supabase SSR (Fail-Closed)</span>
            </div>
          </div>
        </div>

        {/* Tombol Aksi */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            Kembali ke Beranda
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Masuk dengan Akun Lain
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function UnauthorizedPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500">Memverifikasi otorisasi...</p>
          </div>
        </main>
      }
    >
      <UnauthorizedContent />
    </Suspense>
  );
}
