"use client";

import { useState, type FormEvent, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Komponen Form Login Food Rescue.
 *
 * Menggunakan browser client Supabase (@supabase/ssr) untuk signInWithPassword.
 * Sesi otomatis tersimpan pada cookie yang kompatibel dengan proxy.ts dan lib/supabase/server.ts.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Validasi redirect URL agar terhindar dari bahaya Open Redirect.
   * Hanya rute internal yang valid yang diizinkan (berawalan '/', bukan '//' atau '/\').
   */
  function getSafeRedirectUrl(rawUrl: string | null): string {
    if (!rawUrl) return "/";

    // Mencegah protocol-relative URL (//evil.com) atau backslash (/\evil.com)
    if (rawUrl.startsWith("//") || rawUrl.startsWith("/\\")) {
      return "/";
    }

    // Pastikan berawalan single slash dan hanya karakter path URL yang aman
    const safePathRegex = /^\/[a-zA-Z0-9_\-\/]*$/;
    if (safePathRegex.test(rawUrl)) {
      return rawUrl;
    }

    return "/";
  }

  /**
   * Menerjemahkan pesan error dari Supabase ke pesan bahasa Indonesia yang aman,
   * tanpa mengungkapkan detail sensitif sistem atau keberadaan user.
   */
  function getSafeErrorMessage(rawMessage?: string): string {
    if (!rawMessage) return "Terjadi kesalahan saat masuk. Silakan coba lagi.";

    const lower = rawMessage.toLowerCase();

    if (
      lower.includes("invalid login credentials") ||
      lower.includes("invalid credentials")
    ) {
      return "Email atau password salah. Silakan periksa kembali.";
    }

    if (lower.includes("email not confirmed")) {
      return "Email Anda belum dikonfirmasi. Silakan periksa kotak masuk atau spam email Anda untuk mengonfirmasi akun.";
    }

    if (lower.includes("too many requests") || lower.includes("rate limit")) {
      return "Terlalu banyak percobaan masuk. Silakan tunggu beberapa saat sebelum mencoba lagi.";
    }

    return "Gagal masuk ke akun. Silakan periksa kembali data Anda atau coba lagi.";
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // --- 1. Validasi input sebelum mengirim permintaan ---
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError("Email wajib diisi.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Format email tidak valid.");
      return;
    }

    if (!password) {
      setError("Password wajib diisi.");
      return;
    }

    // --- 2. Proses login melalui Supabase Auth ---
    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: password,
        });

      if (signInError) {
        setError(getSafeErrorMessage(signInError.message));
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError("Gagal masuk. Silakan coba lagi.");
        setLoading(false);
        return;
      }

      // --- 3. Ambil role pengguna dari sumber tepercaya (database, bukan input browser) ---
      let userRole = "buyer"; // Default fallback

      try {
        // Coba baca role via RPC get_my_role()
        const { data: roleRpc, error: rpcError } =
          await supabase.rpc("get_my_role");

        if (!rpcError && roleRpc && typeof roleRpc === "string") {
          userRole = roleRpc;
        } else if (data.user.id) {
          // Fallback: baca langsung dari tabel public.users
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("role")
            .eq("id", data.user.id)
            .single();

          if (!userError && userData?.role) {
            userRole = userData.role;
          }
        }
      } catch {
        // Jika pembacaan role mengalami kendala, tetap gunakan default aman
        userRole = "buyer";
      }

      // --- 4. Tentukan redirect sesuai role dan halaman yang tersedia ---
      // Catatan: Dashboard khusus per role (seller, admin, courier) direncanakan pada tahap W5/W6.
      // Saat ini halaman yang tersedia adalah beranda marketplace ("/").
      // Kita siapkan pemetaan rute yang aman dan tidak mengarahkan ke halaman 404.
      const redirectParam =
        searchParams.get("redirect") || searchParams.get("next");
      const safeRedirect = getSafeRedirectUrl(redirectParam);

      // Jika ada target redirect URL spesifik dari query param (selain "/") gunakan itu,
      // selain itu arahkan ke beranda ("/")
      const targetDestination = safeRedirect !== "/" ? safeRedirect : "/";

      setSuccess(
        `Login berhasil sebagai ${userRole}! Mengalihkan ke halaman utama...`
      );
      setLoading(false);

      // Segarkan status sesi dan alihkan halaman
      setTimeout(() => {
        router.push(targetDestination);
        router.refresh();
      }, 1000);
    } catch {
      setError("Terjadi kesalahan yang tidak terduga. Silakan coba lagi.");
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
            Masuk ke akun Anda untuk mulai menyelamatkan makanan
          </p>
        </div>

        {/* Card Form */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-6 text-xl font-semibold">Masuk</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Input Email */}
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-sm font-medium"
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-800 dark:focus:border-emerald-400"
              />
            </div>

            {/* Input Password dengan Toggle Tampil/Sembunyikan */}
            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-sm font-medium"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password Anda"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-11 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-700 dark:bg-gray-800 dark:focus:border-emerald-400"
                />
                <button
                  type="button"
                  id="toggle-password-visibility"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword
                      ? "Sembunyikan password"
                      : "Tampilkan password"
                  }
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showPassword ? (
                    // Eye slash icon (sembunyikan)
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  ) : (
                    // Eye icon (tampilkan)
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Pesan Error */}
            {error && (
              <div
                id="login-error"
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
              >
                {error}
              </div>
            )}

            {/* Pesan Sukses */}
            {success && (
              <div
                id="login-success"
                role="status"
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
              >
                {success}
              </div>
            )}

            {/* Tombol Login */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-600"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  Memproses...
                </span>
              ) : (
                "Masuk"
              )}
            </button>
          </form>

          {/* Link ke Register */}
          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Belum punya akun?{" "}
            <Link
              id="login-register-link"
              href="/register"
              className="font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
            >
              Daftar di sini
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

/**
 * Halaman Login Food Rescue.
 * Dibungkus dengan Suspense boundary karena LoginForm menggunakan useSearchParams().
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500">Memuat halaman masuk...</p>
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
