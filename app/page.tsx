"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

// Tipe data untuk tabel foods (sementara, nanti akan dipindah ke file types)
interface Food {
  id: string;
  name: string;
  price: number;
  quantity: number;
  status: string;
}

export default function Home() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status autentikasi sesi pengguna aktual
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  async function fetchFoods() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from("foods").select("*");

      if (error) {
        setError(error.message);
        return;
      }

      setFoods(data || []);
    } catch {
      setError("Gagal memuat data makanan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    // 1. Verifikasi status autentikasi pengguna secara aman melalui Supabase Auth
    async function checkAuthStatus() {
      try {
        const {
          data: { user: currentUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (authError || !currentUser) {
          setUser(null);
        } else {
          setUser(currentUser);
        }
      } catch {
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    }

    checkAuthStatus();

    // 2. Sinkronisasi sesi secara realtime saat login, logout, atau perubahan token
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;

      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    // 3. Muat data katalog makanan
    async function loadInitial() {
      try {
        const { data, error } = await supabase.from("foods").select("*");

        if (!isMounted) return;
        if (error) {
          setError(error.message);
          return;
        }

        setFoods(data || []);
      } catch {
        if (isMounted) setError("Gagal memuat data makanan. Silakan coba lagi.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInitial();
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/60 via-slate-50 to-slate-50 dark:from-emerald-950/20 dark:via-slate-950 dark:to-slate-950 py-12 md:py-20 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            {/* Badge Inisiatif */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-100/70 px-3.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
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
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
              </svg>
              <span>Gerakan Penyelamatan Makanan Berlebih</span>
            </div>

            {/* Headline */}
            <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl md:text-5xl dark:text-white">
              Selamatkan Makanan Lezat,{" "}
              <span className="text-emerald-600 dark:text-emerald-400">
                Cegah Pemborosan
              </span>
            </h1>

            {/* Subhead */}
            <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
              Hubungkan bisnis makanan berlebih dengan pembeli secara langsung.
              Dapatkan makanan berkualitas tinggi dengan harga hemat sekaligus
              berkontribusi mengurangi jejak karbon limbah makanan.
            </p>

            {/* CTA Group */}
            <div className="mt-8 flex flex-col items-center justify-center gap-4">
              {!authLoading && !user && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Link
                    id="cta-register-buyer"
                    href="/register"
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/30 transition-all hover:bg-emerald-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                  >
                    Daftar Sebagai Pembeli
                  </Link>
                  <Link
                    id="cta-register-seller"
                    href="/register?role=seller"
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-emerald-600 bg-emerald-50/70 px-5 py-2.5 text-sm font-semibold text-emerald-700 shadow-2xs transition-colors hover:bg-emerald-100 hover:border-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
                  >
                    Daftar Sebagai Penjual
                  </Link>
                  <Link
                    id="cta-login"
                    href="/login"
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-2xs transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Login
                  </Link>
                </div>
              )}

              {/* Tombol Jelajahi Makanan Tersedia (di bagian bawah tombol pendaftaran/login jika belum login, atau satu-satunya tombol jika sudah login) */}
              <div>
                <a
                  id="cta-explore-catalog"
                  href="#katalog"
                  className={
                    !authLoading && !user
                      ? "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-2xs transition-colors hover:border-emerald-300 hover:bg-slate-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-emerald-400"
                      : "inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/30 transition-all hover:bg-emerald-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                  }
                >
                  Jelajahi Makanan Tersedia
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Katalog Section */}
      <main id="katalog" className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Katalog Marketplace
            </span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              Makanan Siap Selamatkan Hari Ini
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Porsi terbatas dari restoran, toko roti, dan penjual lokal terdekat.
            </p>
          </div>
          <button
            onClick={() => fetchFoods()}
            disabled={loading}
            aria-label="Muat ulang data makanan"
            className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-2xs hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <svg
              className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            <span>Segarkan</span>
          </button>
        </div>

        {/* State: Error */}
        {error && (
          <div
            role="alert"
            className="mb-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
          >
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="font-semibold">Gagal memuat data dari database</p>
                <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">{error}</p>
                <button
                  onClick={() => fetchFoods()}
                  className="mt-2 text-xs font-semibold underline hover:text-red-900 dark:hover:text-red-200"
                >
                  Coba lagi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* State: Loading Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 animate-pulse"
                aria-hidden="true"
              >
                <div className="flex items-center justify-between">
                  <div className="h-5 w-16 rounded-md bg-slate-200 dark:bg-slate-800" />
                  <div className="h-5 w-20 rounded-md bg-slate-200 dark:bg-slate-800" />
                </div>
                <div className="mt-4 h-6 w-3/4 rounded-md bg-slate-200 dark:bg-slate-800" />
                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                  <div className="h-6 w-24 rounded-md bg-slate-200 dark:bg-slate-800" />
                  <div className="h-9 w-24 rounded-lg bg-slate-200 dark:bg-slate-800" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* State: Kosong (Empty) */}
        {!loading && !error && foods.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <svg
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
              Belum Ada Makanan Tersedia
            </h3>
            <p className="mt-1.5 text-sm text-slate-500 max-w-sm mx-auto dark:text-slate-400">
              Penjual belum menambahkan makanan berlebih untuk hari ini. Silakan
              kunjungi kembali dalam beberapa saat.
            </p>
          </div>
        )}

        {/* State: Daftar Makanan */}
        {!loading && !error && foods.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {foods.map((food) => {
              const isAvailable =
                food.status?.toLowerCase() === "available" ||
                food.status?.toLowerCase() === "tersedia" ||
                food.quantity > 0;

              return (
                <div
                  key={food.id}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-emerald-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-700/60"
                >
                  <div>
                    {/* Header Card: Status & Stok */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          isAvailable
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isAvailable ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                          aria-hidden="true"
                        />
                        {food.status || (isAvailable ? "Tersedia" : "Habis")}
                      </span>

                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
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
                            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                          />
                        </svg>
                        Stok: <strong className="text-slate-700 dark:text-slate-200">{food.quantity}</strong>
                      </span>
                    </div>

                    {/* Judul Makanan */}
                    <h3 className="mt-4 text-lg font-bold text-slate-900 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400 transition-colors">
                      {food.name}
                    </h3>
                  </div>

                  {/* Footer Card: Harga & Aksi */}
                  <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800/80">
                    <div>
                      <span className="block text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                        Harga Penyelamatan
                      </span>
                      <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                        Rp {Number(food.price).toLocaleString("id-ID")}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!isAvailable}
                      className="inline-flex min-h-[38px] items-center justify-center rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:bg-emerald-500 dark:hover:bg-emerald-600 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                    >
                      {isAvailable ? "Pesan Makanan" : "Sudah Habis"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}