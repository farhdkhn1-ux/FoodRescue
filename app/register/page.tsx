"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Halaman Register Food Rescue.
 *
 * Field: Nama lengkap, Email, Password, Konfirmasi password.
 * Role default: buyer (ditetapkan oleh trigger handle_new_user di database).
 * Tidak ada opsi untuk memilih admin/courier di form publik.
 */
export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

      // Periksa apakah email konfirmasi diperlukan.
      // Jika Supabase mengharuskan email confirmation, data.session akan null
      // meskipun data.user sudah ada.
      if (data.user && !data.session) {
        setSuccess(
          "Registrasi berhasil! Silakan periksa email Anda untuk mengonfirmasi akun sebelum login."
        );
        setLoading(false);
        return;
      }

      // Jika email confirmation tidak aktif, user langsung login
      setSuccess("Registrasi berhasil! Mengalihkan ke halaman utama...");
      setLoading(false);

      // Redirect setelah jeda singkat agar user membaca pesan sukses
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            🍽️ Food Rescue
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Buat akun baru untuk mulai menyelamatkan makanan
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-6 text-xl font-semibold">Daftar</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
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
