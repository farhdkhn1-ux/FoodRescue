"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { FoodItem, Category } from "@/lib/types/food";

type SortOption = "newest" | "expiring_soon" | "price_asc" | "price_desc";

export default function Home() {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedMethod, setSelectedMethod] = useState<string>("all");
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const now = Date.now();

      const [foodsRes, categoriesRes] = await Promise.all([
        supabase
          .from("foods")
          .select("*, categories(name)")
          .order("created_at", { ascending: false }),
        supabase.from("categories").select("id, name").order("id"),
      ]);

      if (foodsRes.error) {
        setError(foodsRes.error.message);
        return;
      }

      setCurrentTime(now);
      setFoods((foodsRes.data as unknown as FoodItem[]) || []);
      setCategories((categoriesRes.data as unknown as Category[]) || []);
    } catch {
      setError("Gagal memuat data katalog makanan. Silakan coba beberapa saat lagi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initialFetch() {
      const now = Date.now();
      try {
        const supabase = createClient();
        const [foodsRes, categoriesRes] = await Promise.all([
          supabase
            .from("foods")
            .select("*, categories(name)")
            .order("created_at", { ascending: false }),
          supabase.from("categories").select("id, name").order("id"),
        ]);

        if (!isMounted) return;

        if (foodsRes.error) {
          setError(foodsRes.error.message);
          return;
        }

        setCurrentTime(now);
        setFoods((foodsRes.data as unknown as FoodItem[]) || []);
        setCategories((categoriesRes.data as unknown as Category[]) || []);
      } catch {
        if (isMounted) {
          setError("Gagal memuat data katalog makanan. Silakan coba beberapa saat lagi.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initialFetch();

    return () => {
      isMounted = false;
    };
  }, []);

  // Helper pemeriksa kedaluwarsa waktu pengambilan
  function isFoodExpired(availableUntil?: string | null): boolean {
    if (!availableUntil || currentTime === 0) return false;
    const expiry = new Date(availableUntil).getTime();
    return !isNaN(expiry) && expiry < currentTime;
  }

  // Helper pemeriksa apakah sisa waktu kurang dari 3 jam (Segera Berakhir)
  function isExpiringSoon(availableUntil?: string | null): boolean {
    if (!availableUntil || currentTime === 0) return false;
    const expiry = new Date(availableUntil).getTime();
    if (isNaN(expiry)) return false;
    const diffHours = (expiry - currentTime) / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= 3;
  }

  // Format tanggal & jam ramah Indonesia
  function formatDateTime(dateStr?: string | null): string {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return new Intl.DateTimeFormat("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return dateStr;
    }
  }

  // Filter & Urutkan Makanan
  const filteredFoods = useMemo(() => {
    return foods
      .filter((food) => {
        // 1. Pencarian teks (Nama makanan & deskripsi)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesName = food.name.toLowerCase().includes(q);
          const matchesDesc = (food.description || "").toLowerCase().includes(q);
          if (!matchesName && !matchesDesc) return false;
        }

        // 2. Filter Kategori
        if (selectedCategory !== "all") {
          if (String(food.category_id) !== selectedCategory) return false;
        }

        // 3. Filter Jenis Makanan (Beli vs Donasi)
        if (selectedType !== "all") {
          if (food.type !== selectedType) return false;
        }

        // 4. Filter Metode Pengambilan
        if (selectedMethod !== "all") {
          if (food.pickup_method !== "both" && food.pickup_method !== selectedMethod) {
            return false;
          }
        }

        // 5. Filter Hanya Tersedia & Belum Kedaluwarsa
        if (onlyAvailable) {
          const expired = isFoodExpired(food.available_until);
          const hasStock = food.quantity > 0;
          const isAvailStatus = food.status === "available";
          if (expired || !hasStock || !isAvailStatus) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "price_asc") {
          return Number(a.price) - Number(b.price);
        }
        if (sortBy === "price_desc") {
          return Number(b.price) - Number(a.price);
        }
        if (sortBy === "expiring_soon") {
          const timeA = a.available_until ? new Date(a.available_until).getTime() : Infinity;
          const timeB = b.available_until ? new Date(b.available_until).getTime() : Infinity;
          return timeA - timeB;
        }
        // Default: newest
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foods, searchQuery, selectedCategory, selectedType, selectedMethod, onlyAvailable, sortBy, currentTime]);

  // Reset semua filter
  function handleResetFilters() {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedType("all");
    setSelectedMethod("all");
    setOnlyAvailable(false);
    setSortBy("newest");
  }

  const isFiltering =
    searchQuery !== "" ||
    selectedCategory !== "all" ||
    selectedType !== "all" ||
    selectedMethod !== "all" ||
    onlyAvailable ||
    sortBy !== "newest";

  return (
    <div className="flex-1 flex flex-col bg-slate-50 text-slate-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/70 via-slate-50 to-slate-50 py-12 md:py-16 border-b border-slate-200/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            {/* Badge Inisiatif */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-100/80 px-3.5 py-1 text-xs font-semibold text-emerald-800 shadow-2xs">
              <svg
                className="h-3.5 w-3.5 text-emerald-600"
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
            <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
              Selamatkan Makanan Lezat,{" "}
              <span className="text-emerald-600">Cegah Pemborosan</span>
            </h1>

            {/* Subhead */}
            <p className="mt-3.5 text-base leading-relaxed text-slate-600 sm:text-lg">
              Hubungkan bisnis makanan berlebih dengan pembeli secara langsung.
              Dapatkan makanan berkualitas tinggi dengan harga hemat atau donasi gratis
              sekaligus mengurangi jejak limbah makanan.
            </p>

            {/* Search Box Terintegrasi di Hero */}
            <div className="mt-8 max-w-2xl mx-auto">
              <div className="relative flex items-center">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
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
                      d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                    />
                  </svg>
                </div>
                <input
                  id="hero-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari makanan berlebih, roti, sayuran, paket donasi..."
                  className="w-full rounded-2xl border border-slate-300 bg-white py-3.5 pl-11 pr-11 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    aria-label="Hapus kata kunci pencarian"
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold">
              <a
                href="#katalog"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-white shadow-xs hover:bg-emerald-700 transition-colors"
              >
                <span>Jelajahi Katalog</span>
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
              <Link
                href="/register?role=seller"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:border-emerald-400 hover:text-emerald-700 transition-colors shadow-2xs"
              >
                <span>Daftar Sebagai Mitra Penjual</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Katalog & Filter Section */}
      <main id="katalog" className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        {/* Header Bagian */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Katalog Marketplace W4
            </span>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Makanan Siap Selamatkan Hari Ini
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Menampilkan {filteredFoods.length} menu makanan dari total {foods.length} menu terdaftar.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData()}
              disabled={loading}
              aria-label="Muat ulang data makanan"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
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
        </div>

        {/* Panel Kontrol Filter & Urutan */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
          {/* Baris 1: Filter Kategori Pills */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Kategori Makanan
              </span>
              {selectedCategory !== "all" && (
                <button
                  onClick={() => setSelectedCategory("all")}
                  className="text-xs text-emerald-600 hover:underline font-semibold"
                >
                  Semua Kategori
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`inline-flex items-center rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  selectedCategory === "all"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Semua Kategori ({foods.length})
              </button>
              {categories.map((cat) => {
                const count = foods.filter((f) => f.category_id === cat.id).length;
                const isSelected = selectedCategory === String(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(String(cat.id))}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                        isSelected ? "bg-emerald-700 text-emerald-100" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Baris 2: Dropdown Filter & Sortir */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Filter Jenis Makanan */}
            <div>
              <label htmlFor="filter-type" className="block text-xs font-bold text-slate-600 mb-1">
                Jenis Penawaran
              </label>
              <select
                id="filter-type"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="all">Semua Jenis (Beli & Donasi)</option>
                <option value="sale">Hanya Makanan Beli (Komersial)</option>
                <option value="donation">Hanya Donasi Gratis</option>
              </select>
            </div>

            {/* Filter Metode Pengambilan */}
            <div>
              <label htmlFor="filter-method" className="block text-xs font-bold text-slate-600 mb-1">
                Metode Pengambilan
              </label>
              <select
                id="filter-method"
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="all">Semua Metode</option>
                <option value="pickup">Ambil di Tempat (Pickup)</option>
                <option value="delivery">Pengantaran (Delivery)</option>
              </select>
            </div>

            {/* Sortir Urutan */}
            <div>
              <label htmlFor="sort-by" className="block text-xs font-bold text-slate-600 mb-1">
                Urutkan Berdasarkan
              </label>
              <select
                id="sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="newest">Terbaru Ditambahkan</option>
                <option value="expiring_soon">Batas Waktu Terdekat (Prioritas)</option>
                <option value="price_asc">Harga Terendah</option>
                <option value="price_desc">Harga Tertinggi</option>
              </select>
            </div>

            {/* Checkbox Hanya yang Tersedia */}
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={onlyAvailable}
                  onChange={(e) => setOnlyAvailable(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Hanya yang Siap Diambil</span>
              </label>
            </div>
          </div>

          {/* Active Filter Badges & Reset Button */}
          {isFiltering && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
              <div className="flex flex-wrap items-center gap-1.5 text-slate-500">
                <span className="font-semibold text-slate-700">Filter Aktif:</span>
                {searchQuery && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                    Kata kunci: &ldquo;{searchQuery}&rdquo;
                  </span>
                )}
                {selectedCategory !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                    Kategori: {categories.find((c) => String(c.id) === selectedCategory)?.name}
                  </span>
                )}
                {selectedType !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                    Jenis: {selectedType === "donation" ? "Donasi" : "Beli"}
                  </span>
                )}
                {selectedMethod !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                    Metode: {selectedMethod === "pickup" ? "Pickup" : "Delivery"}
                  </span>
                )}
                {onlyAvailable && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5">
                    Hanya Tersedia
                  </span>
                )}
              </div>

              <button
                onClick={handleResetFilters}
                className="font-bold text-red-600 hover:text-red-700 hover:underline"
              >
                Reset Semua Filter
              </button>
            </div>
          )}
        </div>

        {/* State: Error */}
        {error && (
          <div
            role="alert"
            className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 text-red-600 shrink-0 mt-0.5"
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
                <p className="font-semibold">Gagal memuat katalog makanan</p>
                <p className="mt-0.5 text-xs text-red-700">{error}</p>
                <button
                  onClick={() => loadData()}
                  className="mt-2 text-xs font-semibold underline hover:text-red-900"
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
            {[1, 2, 3, 4, 5, 6].map((index) => (
              <div
                key={index}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs animate-pulse"
                aria-hidden="true"
              >
                <div className="h-44 w-full rounded-xl bg-slate-200" />
                <div className="mt-4 flex items-center justify-between">
                  <div className="h-4 w-16 rounded bg-slate-200" />
                  <div className="h-4 w-20 rounded bg-slate-200" />
                </div>
                <div className="mt-2 h-6 w-3/4 rounded bg-slate-200" />
                <div className="mt-2 h-4 w-full rounded bg-slate-200" />
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <div className="h-6 w-24 rounded bg-slate-200" />
                  <div className="h-8 w-24 rounded-lg bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* State: Kosong / Tidak Ditemukan Hasil */}
        {!loading && !error && filteredFoods.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
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
            <h3 className="mt-4 text-base font-bold text-slate-900">
              Tidak Ada Makanan yang Cocok
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              {isFiltering
                ? "Tidak ada makanan yang memenuhi kriteria pencarian atau filter yang dipilih. Silakan sesuaikan filter atau reset."
                : "Belum ada makanan berlebih yang tersedia hari ini. Silakan kunjungi kembali nanti."}
            </p>
            {isFiltering && (
              <button
                onClick={handleResetFilters}
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700"
              >
                Reset Semua Filter
              </button>
            )}
          </div>
        )}

        {/* State: Grid Daftar Makanan */}
        {!loading && !error && filteredFoods.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredFoods.map((food) => {
              const expired = isFoodExpired(food.available_until);
              const soldOut = food.status === "sold_out" || food.quantity <= 0;
              const urgent = isExpiringSoon(food.available_until);
              const isAvailable = !expired && !soldOut;

              const isDonation = food.type === "donation";

              return (
                <div
                  key={food.id}
                  className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition-all hover:border-emerald-300 hover:shadow-md"
                >
                  {/* Foto Makanan */}
                  <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                    {food.image_url ? (
                      <img
                        src={food.image_url}
                        alt={food.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
                        <svg
                          className="h-10 w-10 text-slate-300"
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
                        <span className="mt-1 text-xs">Foto belum tersedia</span>
                      </div>
                    )}

                    {/* Top Overlay Badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                      {/* Badge Kategori */}
                      <span className="inline-flex items-center rounded-lg bg-white/90 backdrop-blur-xs px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-2xs">
                        {food.categories?.name || "Kategori"}
                      </span>

                      {/* Badge Tipe: Donasi / Beli */}
                      {isDonation ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/90 text-white backdrop-blur-xs px-2.5 py-1 text-[11px] font-extrabold shadow-2xs">
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          Donasi Gratis
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-lg bg-emerald-600/90 text-white backdrop-blur-xs px-2.5 py-1 text-[11px] font-bold shadow-2xs">
                          Hemat Pangan
                        </span>
                      )}
                    </div>

                    {/* Bottom Alert: Segera Berakhir */}
                    {urgent && isAvailable && (
                      <div className="absolute bottom-2 left-2 right-2 rounded-md bg-amber-500/95 px-2 py-0.5 text-center text-[10px] font-bold text-white shadow-2xs">
                        Perlu Diselamatkan Segera (&lt; 3 Jam)
                      </div>
                    )}
                  </div>

                  {/* Konten Card */}
                  <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
                    <div>
                      {/* Status Ketersediaan & Stok */}
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            !isAvailable
                              ? "bg-slate-100 text-slate-500"
                              : urgent
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              !isAvailable
                                ? "bg-slate-400"
                                : urgent
                                ? "bg-amber-500 animate-pulse"
                                : "bg-emerald-500"
                            }`}
                          />
                          {expired
                            ? "Kedaluwarsa"
                            : soldOut
                            ? "Stok Habis"
                            : "Tersedia"}
                        </span>

                        <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
                          <svg
                            className="h-3.5 w-3.5 text-slate-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="2"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                            />
                          </svg>
                          Stok: <strong className="text-slate-900">{food.quantity}</strong> porsi
                        </span>
                      </div>

                      {/* Judul & Deskripsi */}
                      <Link href={`/food/${food.id}`} className="group/title block mt-3">
                        <h3 className="text-base font-bold text-slate-900 group-hover/title:text-emerald-700 transition-colors line-clamp-1">
                          {food.name}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {food.description || "Tidak ada deskripsi tambahan untuk makanan ini."}
                        </p>
                      </Link>

                      {/* Info Metode & Waktu Ketersediaan */}
                      <div className="mt-3.5 space-y-1.5 rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-600 border border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Pengambilan:</span>
                          <span className="font-semibold text-slate-700">
                            {food.pickup_method === "pickup"
                              ? "Ambil di Tempat"
                              : food.pickup_method === "delivery"
                              ? "Pengantaran"
                              : "Pickup & Delivery"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Batas Waktu:</span>
                          <span
                            className={`font-semibold ${
                              expired
                                ? "text-red-600 line-through"
                                : urgent
                                ? "text-amber-700 font-bold"
                                : "text-slate-700"
                            }`}
                          >
                            {formatDateTime(food.available_until)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer: Harga & Tombol Detail */}
                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                          {isDonation ? "Nilai Donasi" : "Harga Penyelamatan"}
                        </span>
                        <span
                          className={`text-lg font-extrabold ${
                            isDonation ? "text-emerald-700" : "text-emerald-600"
                          }`}
                        >
                          {isDonation
                            ? "GRATIS"
                            : `Rp ${Number(food.price).toLocaleString("id-ID")}`}
                        </span>
                      </div>

                      <Link
                        id={`btn-detail-food-${food.id}`}
                        href={`/food/${food.id}`}
                        className={`inline-flex min-h-[38px] items-center justify-center rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-2xs ${
                          isAvailable
                            ? isDonation
                              ? "bg-emerald-700 text-white hover:bg-emerald-800"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                        }`}
                      >
                        {isAvailable
                          ? isDonation
                            ? "Ajukan Donasi"
                            : "Pesan & Ambil"
                          : "Lihat Detail"}
                      </Link>
                    </div>
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