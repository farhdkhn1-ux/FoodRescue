"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isValidRole } from "@/lib/auth/roles";
import type { User } from "@supabase/supabase-js";

/**
 * Komponen Navbar Responsif Food Rescue
 *
 * Menerapkan standar UI/UX Pro Max:
 * - Brand identity bernuansa emerald/keberlanjutan makanan
 * - SVG vektor murni (tanpa emoji struktural)
 * - Session management dengan listener realtime & cleanup subscription
 * - Penanganan nama pengguna yang aman dengan fallback bertingkat
 * - Loading indicator pada proses logout & error message yang jelas
 * - Aksesibilitas: focus ring, role semantic, dan mobile menu aria-expanded
 */
export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Monitor status sesi & subscribe ke perubahan auth
  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function fetchUserRole(userId: string): Promise<string | null> {
      try {
        const { data: roleRpc, error: rpcError } =
          await supabase.rpc("get_my_role");
        if (!rpcError && isValidRole(roleRpc)) {
          return roleRpc;
        }

        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("role")
          .eq("id", userId)
          .maybeSingle();

        if (!userError && isValidRole(userData?.role)) {
          return userData.role;
        }
      } catch {
        // Jangan memberikan role default unverified jika query gagal
      }
      return null;
    }

    async function initializeUser() {
      try {
        const {
          data: { user: currentUser },
          error,
        } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (error || !currentUser) {
          setUser(null);
          setUserRole(null);
        } else {
          setUser(currentUser);
          const role = await fetchUserRole(currentUser.id);
          if (isMounted) setUserRole(role);
        }
      } catch {
        if (isMounted) {
          setUser(null);
          setUserRole(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initializeUser();

    // Listener realtime untuk update sesi auth
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === "SIGNED_OUT" || !session) {
        setUser(null);
        setUserRole(null);
      } else if (session?.user) {
        setUser(session.user);
        const role = await fetchUserRole(session.user.id);
        if (isMounted) setUserRole(role);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Reset menu mobile dan error saat pathname berubah (pola resmi React untuk prop/param change)
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileMenuOpen(false);
    setLogoutError(null);
  }

  // Ekstrak nama tampilan secara aman (aman dari nilai null/kosong)
  function getDisplayName(user: User | null): string {
    if (!user) return "";
    const metadata = user.user_metadata;
    if (metadata?.name && typeof metadata.name === "string" && metadata.name.trim()) {
      return metadata.name.trim();
    }
    if (metadata?.full_name && typeof metadata.full_name === "string" && metadata.full_name.trim()) {
      return metadata.full_name.trim();
    }
    if (user.email) {
      return user.email.split("@")[0];
    }
    return "Pengguna";
  }

  // Ambil inisial nama untuk avatar visual
  function getInitials(name: string): string {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  // Penanganan Logout dengan Supabase Auth
  async function handleLogout() {
    setLogoutError(null);
    setLoggingOut(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setLogoutError(error.message || "Gagal keluar. Silakan coba lagi.");
        setLoggingOut(false);
        return;
      }

      setUser(null);
      setUserRole(null);
      setMobileMenuOpen(false);

      // Arahkan ke halaman login dan refresh sesi SSR
      router.push("/login");
      router.refresh();
    } catch {
      setLogoutError("Terjadi kesalahan tak terduga saat keluar. Silakan coba lagi.");
    } finally {
      setLoggingOut(false);
    }
  }

  function getRoleLink(role: string | null): { href: string; label: string } | null {
    if (!role) return null;
    switch (role.toLowerCase()) {
      case "admin":
        return { href: "/admin", label: "Area Admin" };
      case "seller":
        return { href: "/seller", label: "Area Seller" };
      case "buyer":
        return { href: "/buyer", label: "Area Buyer" };
      case "courier":
        return { href: "/courier", label: "Area Kurir" };
      default:
        return null;
    }
  }

  const displayName = getDisplayName(user);
  const initials = getInitials(displayName);
  const roleLink = getRoleLink(userRole);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/90 transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          aria-label="Food Rescue Beranda"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-200">
            {/* SVG Logo Daun/Penyelamatan Makanan */}
            <svg
              className="h-5 w-5"
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
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Food<span className="text-emerald-600 dark:text-emerald-400">Rescue</span>
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300 -mt-1 hidden sm:inline">
              Marketplace
            </span>
          </div>
        </Link>

        {/* Navigasi Desktop */}
        <nav className="hidden md:flex md:items-center md:gap-6" aria-label="Navigasi Utama">
          <Link
            href="/"
            className={`text-sm font-medium transition-colors hover:text-emerald-600 dark:hover:text-emerald-400 ${
              pathname === "/"
                ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                : "text-slate-600 dark:text-slate-300"
            }`}
          >
            Beranda
          </Link>
          <Link
            href="/#katalog"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
          >
            Jelajahi Makanan
          </Link>
          {roleLink && (
            <Link
              href={roleLink.href}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                pathname === roleLink.href
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 ring-1 ring-emerald-500/40"
                  : "bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>{roleLink.label}</span>
            </Link>
          )}
        </nav>

        {/* Bagian Aksi Autentikasi Desktop */}
        <div className="hidden md:flex md:items-center md:gap-4">
          {loading ? (
            // Skeleton loader halus agar tidak jumping/flicker
            <div className="flex items-center gap-3 animate-pulse" aria-hidden="true">
              <div className="h-8 w-24 rounded-lg bg-slate-200 dark:bg-slate-800" />
              <div className="h-9 w-20 rounded-lg bg-slate-200 dark:bg-slate-800" />
            </div>
          ) : user ? (
            // State: SUDAH LOGIN
            <div className="flex items-center gap-3">
              {/* Profil Pengguna */}
              <div className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-800/80">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white shadow-xs"
                  aria-hidden="true"
                >
                  {initials}
                </div>
                <div className="flex flex-col text-left pr-1">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 max-w-[140px] truncate">
                    {displayName}
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 capitalize -mt-0.5">
                    {userRole ? `Role: ${userRole}` : "Aktif"}
                  </span>
                </div>
              </div>

              {/* Tombol Logout */}
              <button
                id="btn-logout-desktop"
                onClick={handleLogout}
                disabled={loggingOut}
                aria-label="Keluar dari akun"
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-red-800 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              >
                {loggingOut ? (
                  <>
                    <svg
                      className="h-3.5 w-3.5 animate-spin text-red-600 dark:text-red-400"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
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
                    <span>Mengeluarkan...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                      />
                    </svg>
                    <span>Keluar</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            // State: BELUM LOGIN
            <div className="flex items-center gap-3">
              <Link
                id="nav-login-btn"
                href="/login"
                className="inline-flex min-h-[38px] items-center justify-center rounded-lg px-3.5 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-200 dark:hover:text-emerald-400"
              >
                Masuk
              </Link>
              <Link
                id="nav-register-btn"
                href="/register"
                className="inline-flex min-h-[38px] items-center justify-center rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                Daftar
              </Link>
            </div>
          )}
        </div>

        {/* Tombol Hamburger Menu Mobile */}
        <div className="flex items-center md:hidden">
          <button
            id="mobile-menu-toggle"
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={mobileMenuOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            {mobileMenuOpen ? (
              // X icon
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              // Hamburger bars icon
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Banner Error Logout jika ada */}
      {logoutError && (
        <div
          role="alert"
          className="border-t border-red-200 bg-red-50 px-4 py-2 text-center text-xs text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
        >
          <span>{logoutError}</span>
          <button
            type="button"
            onClick={() => setLogoutError(null)}
            className="ml-3 font-semibold underline hover:text-red-900 dark:hover:text-red-100"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Panel Navigasi Mobile */}
      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="border-b border-slate-200 bg-white px-4 pt-3 pb-6 shadow-lg md:hidden dark:border-slate-800 dark:bg-slate-900 transition-all"
        >
          <div className="space-y-1.5">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-base font-medium transition-colors ${
                pathname === "/"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-semibold"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.8"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                />
              </svg>
              <span>Beranda</span>
            </Link>
            <Link
              href="/#katalog"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.8"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.25A2.25 2.25 0 0 1 0 18.75V5.25A2.25 2.25 0 0 1 2.25 3h19.5A2.25 2.25 0 0 1 24 5.25v13.5A2.25 2.25 0 0 1 21.75 21H13.5Z"
                />
              </svg>
              <span>Jelajahi Makanan</span>
            </Link>
            {roleLink && (
              <Link
                href={roleLink.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-base font-medium transition-colors ${
                  pathname === roleLink.href
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-semibold"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                <svg
                  className="h-5 w-5 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
                <span>{roleLink.label}</span>
              </Link>
            )}
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
            {loading ? (
              <div className="h-10 w-full rounded-lg bg-slate-200 animate-pulse dark:bg-slate-800" />
            ) : user ? (
              // Mobile: SUDAH LOGIN
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white shadow-xs"
                    aria-hidden="true"
                  >
                    {initials}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {displayName}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate capitalize">
                      {user.email} • {userRole ? `Role: ${userRole}` : "Aktif"}
                    </span>
                  </div>
                </div>

                <button
                  id="btn-logout-mobile"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50/70 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {loggingOut ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin text-red-600 dark:text-red-400"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
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
                      <span>Mengeluarkan sesi...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                        />
                      </svg>
                      <span>Keluar dari Akun</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              // Mobile: BELUM LOGIN
              <div className="grid grid-cols-2 gap-3">
                <Link
                  id="mobile-login-btn"
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 py-2.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Masuk
                </Link>
                <Link
                  id="mobile-register-btn"
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 py-2.5 text-center text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                >
                  Daftar
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
