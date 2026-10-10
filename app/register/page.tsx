"use client";

import { useState, useEffect, type FormEvent, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Komponen Form Register Food Rescue.
 *
 * Field: Nama lengkap, Email, Password, Konfirmasi password.
 * Mendukung pembacaan parameter query ?role=seller atau ?role=buyer dengan validasi ketat.
 * Role default: buyer (ditetapkan oleh trigger handle_new_user di database).
 * Tidak ada opsi untuk memilih admin/courier di form publik.
 */
function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Membaca parameter query ?role=seller atau ?role=buyer secara aman
  const queryRole = searchParams.get("role")?.toLowerCase();
  const initialRole: "buyer" | "seller" = queryRole === "seller" ? "seller" : "buyer";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"buyer" | "seller">(initialRole);

  // Sinkronisasi jika parameter query di URL berubah
  useEffect(() => {
    if (queryRole === "seller") {
      setRole("seller");
    } else if (queryRole === "buyer") {
      setRole("buyer");
    }
  }, [queryRole]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // --- Validasi input ---
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError("Nama lengkap wajib diisi.");
      return;
    }
    if (trimmedName.length < 2) {
      setError("Nama lengkap minimal 2 karakter.");
      return;
    }
    if (!trimmedEmail) {
      setError("Email wajib diisi.");
      return;
    }
    // Validasi format email sederhana
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Format email tidak valid.");
      return;
    }
    if (!password) {
      setError("Password wajib diisi.");
      return;
    }
    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Password dan konfirmasi password tidak sama.");
      return;
    }

    // --- Proses registrasi ---
    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: password,
        options: {
          data: {
            name: trimmedName,
            role, // Mengirim pilihan role ('buyer' atau 'seller')
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // Periksa apakah user berhasil dibuat
      if (!data.user) {
        setError("Registrasi gagal. Silakan coba lagi.");
        setLoading(false);
        return;
      }

      const roleLabel = role === "seller" ? "Mitra Penjual" : "Pembeli";
      const targetPath = role === "seller" ? "/seller" : "/buyer";

      // Periksa apakah email konfirmasi diperlukan.
      if (data.user && !data.session) {
        setSuccess(
          `Registrasi berhasil sebagai ${roleLabel}! Silakan periksa email Anda untuk mengonfirmasi akun sebelum login.`
        );
        setLoading(false);
        return;
      }

      // Jika email confirmation tidak aktif, user langsung login
      setSuccess(`Registrasi berhasil sebagai ${roleLabel}! Mengalihkan...`);
      setLoading(false);

      // Redirect ke area sesuai role yang dipilih
      setTimeout(() => {
        router.push(targetPath);
      }, 1200);
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md shadow-emerald-500/20 mb-3">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Food<span className="text-emerald-600 dark:text-emerald-400">Rescue</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Buat akun baru untuk mulai menyelamatkan makanan
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-6 text-xl font-semibold">Daftar</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Pilihan Jenis Akun: Buyer vs Seller */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Pilih Jenis Akun
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  id="register-role-buyer"
                  onClick={() => setRole("buyer")}
                  className={`relative flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all focus:outline-none ${
                    role === "buyer"
                      ? "border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/60"
                  }`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 mb-1.5">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold">Pembeli</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Selamatkan Makanan
                  </span>
                  {role === "buyer" && (
                    <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-emerald-600" />
                  )}
                </button>

                <button
                  type="button"
                  id="register-role-seller"
                  onClick={() => setRole("seller")}
                  className={`relative flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all focus:outline-none ${
                    role === "seller"
                      ? "border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/60"
                  }`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 mb-1.5">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72m-13.5 8.651h3a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75v2.25c0 .414.336.75.75.75Z" />
                    </svg>
                  </div>
                  <span className="text-xs font-bold">Mitra Penjual</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Jual Surplus Toko
                  </span>
                  {role === "seller" && (
                    <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-emerald-600" />
                  )}
                </button>
              </div>
            </div>
            {/* Nama Lengkap */}
            <div>
              <label
                htmlFor="register-name"
                className="mb-1.5 block text-sm font-medium"
              >
                Nama Lengkap
              </label>
              <input
                id="register-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masukkan nama lengkap"
                required
                autoComplete="name"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-800 dark:focus:border-emerald-400"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="register-email"
                className="mb-1.5 block text-sm font-medium"
              >
                Email
              </label>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-800 dark:focus:border-emerald-400"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="register-password"
                className="mb-1.5 block text-sm font-medium"
              >
                Password
              </label>
              <input
                id="register-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                required
                autoComplete="new-password"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-800 dark:focus:border-emerald-400"
              />
            </div>

            {/* Konfirmasi Password */}
            <div>
              <label
                htmlFor="register-confirm-password"
                className="mb-1.5 block text-sm font-medium"
              >
                Konfirmasi Password
              </label>
              <input
                id="register-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password"
                required
                autoComplete="new-password"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-800 dark:focus:border-emerald-400"
              />
            </div>

            {/* Pesan Error */}
            {error && (
              <div
                id="register-error"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
              >
                {error}
              </div>
            )}

            {/* Pesan Sukses */}
            {success && (
              <div
                id="register-success"
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
              >
                {success}
              </div>
            )}

            {/* Tombol Daftar */}
            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-600"
            >
              {loading ? "Mendaftarkan..." : "Daftar"}
            </button>
          </form>

          {/* Link ke Login */}
          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Sudah punya akun?{" "}
            <Link
              href="/login"
              className="font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
            >
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

/**
 * Halaman Register Food Rescue.
 * Dibungkus dengan Suspense boundary karena RegisterForm menggunakan useSearchParams().
 */
export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500">Memuat halaman pendaftaran...</p>
          </div>
        </main>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
