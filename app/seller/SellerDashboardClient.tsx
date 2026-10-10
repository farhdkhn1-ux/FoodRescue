"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import type { Category, FoodItem, FoodStatus, FoodType } from "./types";
import {
  createFoodAction,
  updateFoodAction,
  toggleFoodStatusAction,
  deleteFoodAction,
} from "./actions";

interface SellerDashboardClientProps {
  initialFoods: FoodItem[];
  categories: Category[];
  userEmail: string;
  userId: string;
  userRole: string;
}

export default function SellerDashboardClient({
  initialFoods,
  categories,
  userEmail,
  userId,
  userRole,
}: SellerDashboardClientProps) {
  const [foods, setFoods] = useState<FoodItem[]>(initialFoods);
  const [isPending, startTransition] = useTransition();

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);
  const [deletingFood, setDeletingFood] = useState<FoodItem | null>(null);

  // Notification state
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Form states for Add Modal
  const [addType, setAddType] = useState<FoodType>("sale");
  const [addPrice, setAddPrice] = useState<number>(10000);

  // Form states for Edit Modal
  const [editType, setEditType] = useState<FoodType>("sale");
  const [editPrice, setEditPrice] = useState<number>(0);

  // Hitung metrik ringkasan
  const totalMenu = foods.length;
  const availableMenu = foods.filter((f) => f.status === "available").length;
  const soldOutMenu = foods.filter((f) => f.status === "sold_out").length;
  const totalPortions = foods.reduce((acc, f) => acc + (f.quantity || 0), 0);

  // Filter daftar makanan
  const filteredFoods = foods.filter((food) => {
    if (selectedCategory !== "all" && String(food.category_id) !== selectedCategory) {
      return false;
    }
    if (selectedStatus !== "all" && food.status !== selectedStatus) {
      return false;
    }
    if (selectedType !== "all" && food.type !== selectedType) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = food.name.toLowerCase().includes(q);
      const matchDesc = (food.description || "").toLowerCase().includes(q);
      return matchName || matchDesc;
    }
    return true;
  });

  // Handler: Tambah Makanan
  async function handleAddSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await createFoodAction(formData);
      if (res.success) {
        setFeedback({ type: "success", message: res.message || "Menu berhasil ditambahkan!" });
        setIsAddModalOpen(false);
        form.reset();
        // Optimistic refresh
        window.location.reload();
      } else {
        setFeedback({ type: "error", message: res.error || "Gagal menambahkan menu makanan." });
      }
    });
  }

  // Handler: Edit Makanan
  async function handleEditSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingFood) return;
    setFeedback(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await updateFoodAction(editingFood.id, formData);
      if (res.success) {
        setFeedback({ type: "success", message: res.message || "Data menu berhasil diperbarui!" });
        setEditingFood(null);
        window.location.reload();
      } else {
        setFeedback({ type: "error", message: res.error || "Gagal memperbarui menu makanan." });
      }
    });
  }

  // Handler: Toggle Status
  function handleToggleStatus(food: FoodItem) {
    setFeedback(null);
    startTransition(async () => {
      const res = await toggleFoodStatusAction(food.id, food.status);
      if (res.success) {
        const nextStatus: FoodStatus = food.status === "available" ? "sold_out" : "available";
        setFoods((prev) =>
          prev.map((f) => (f.id === food.id ? { ...f, status: nextStatus } : f))
        );
        setFeedback({ type: "success", message: res.message || "Status menu diperbarui." });
      } else {
        setFeedback({ type: "error", message: res.error || "Gagal mengubah status menu." });
      }
    });
  }

  // Handler: Hapus Makanan
  function handleDeleteConfirm() {
    if (!deletingFood) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await deleteFoodAction(deletingFood.id);
      if (res.success) {
        setFoods((prev) => prev.filter((f) => f.id !== deletingFood.id));
        setFeedback({ type: "success", message: res.message || "Menu berhasil dihapus!" });
        setDeletingFood(null);
      } else {
        setFeedback({ type: "error", message: res.error || "Gagal menghapus menu makanan." });
      }
    });
  }

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Header Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 mb-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              {userRole === "admin"
                ? "Mode Supervisi Administrator • Mitra Penjual"
                : "Area Mitra Penjual (Seller)"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Inventaris & Penyelamatan Makanan
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Akun: <span className="font-semibold text-slate-700 dark:text-slate-300">{userEmail}</span> (ID: {userId.slice(0, 8)}...). Kelola makanan berlebih dari toko Anda agar lekas diselamatkan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Lihat Katalog Publik
          </Link>
          <button
            onClick={() => {
              setAddType("sale");
              setAddPrice(10000);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-all focus:ring-2 focus:ring-emerald-500"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>Tambah Makanan Baru</span>
          </button>
        </div>
      </div>

      {/* Banner Notifikasi Feedback */}
      {feedback && (
        <div
          role="alert"
          className={`mt-6 rounded-xl border p-4 text-xs sm:text-sm flex items-start justify-between gap-3 ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <svg className="h-4 w-4 text-emerald-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-4 w-4 text-red-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Tutup notifikasi"
          >
            ✕
          </button>
        </div>
      )}

      {/* Kartu Ringkasan Metrik Toko */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Total Menu Terdaftar
          </span>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
            {totalMenu}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Surplus terkelola
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
            Siap Diselamatkan
          </span>
          <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {availableMenu}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Status: Tersedia
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Sudah Habis / Arsip
          </span>
          <p className="mt-1 text-2xl font-black text-slate-700 dark:text-slate-300">
            {soldOutMenu}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Stok 0 / Sold Out
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
            Total Porsi Aktif
          </span>
          <p className="mt-1 text-2xl font-black text-sky-600 dark:text-sky-400">
            {totalPortions}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Porsi tersedia di etalase
          </span>
        </div>
      </div>

      {/* Bar Filter & Pencarian */}
      <div className="mt-8 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div className="relative flex-1 min-w-[240px]">
          <svg
            className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Cari nama atau deskripsi makanan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Kategori */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 dark:text-slate-300"
          >
            <option value="all">Semua Kategori</option>
            {categories.map((cat) => (
              <option key={cat.id} value={String(cat.id)}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Filter Status */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 dark:text-slate-300"
          >
            <option value="all">Semua Status</option>
            <option value="available">Tersedia</option>
            <option value="sold_out">Habis</option>
          </select>

          {/* Filter Tipe */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 dark:text-slate-300"
          >
            <option value="all">Semua Jenis</option>
            <option value="sale">Dijual</option>
            <option value="donation">Donasi</option>
          </select>
        </div>
      </div>

      {/* Konten Daftar Makanan */}
      <div className="mt-6">
        {filteredFoods.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
              </svg>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
              Tidak Ada Menu Ditemukan
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {foods.length === 0
                ? "Toko Anda belum memiliki makanan berlebih terdaftar. Klik 'Tambah Makanan Baru' untuk mulai menyelamatkan makanan."
                : "Tidak ada menu yang cocok dengan kriteria filter saat ini."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredFoods.map((food) => {
              const isAvailable = food.status === "available";
              const isDonation = food.type === "donation";

              return (
                <div
                  key={food.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between dark:border-slate-800 dark:bg-slate-900 transition-all hover:border-emerald-300 dark:hover:border-emerald-800"
                >
                  <div>
                    {/* Header Item: Kategori & Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                        {food.categories?.name || "Kategori #" + food.category_id}
                      </span>

                      <button
                        onClick={() => handleToggleStatus(food)}
                        disabled={isPending}
                        title="Klik untuk mengubah status"
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-all ${
                          isAvailable
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isAvailable ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        <span>{isAvailable ? "Tersedia" : "Habis"}</span>
                      </button>
                    </div>

                    {/* Judul & Deskripsi */}
                    <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white line-clamp-1">
                      {food.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {food.description}
                    </p>

                    {/* Tags: Tipe & Metode Ambil */}
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                      <span
                        className={`px-2 py-0.5 rounded-md font-semibold ${
                          isDonation
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {isDonation ? "Donasi Gratis" : "Dijual Murah"}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {food.pickup_method === "pickup"
                          ? "Ambil di Tempat"
                          : food.pickup_method === "delivery"
                          ? "Antar Kurir"
                          : "Ambil / Antar"}
                      </span>
                      {userRole === "admin" && (
                        <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                          Seller: {food.seller_id.slice(0, 6)}...
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Footer Item: Harga, Stok, & Aksi */}
                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] uppercase font-semibold text-slate-400">
                        {isDonation ? "Bebas Biaya" : "Harga Satuan"}
                      </span>
                      <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                        {isDonation ? "Rp 0" : `Rp ${Number(food.price).toLocaleString("id-ID")}`}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        Sisa: <strong>{food.quantity}</strong> porsi
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingFood(food);
                          setEditType(food.type);
                          setEditPrice(food.price);
                        }}
                        disabled={isPending}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        title="Edit Menu"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                        </svg>
                      </button>

                      <button
                        onClick={() => setDeletingFood(food)}
                        disabled={isPending}
                        className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
                        title="Hapus Menu"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: Tambah Makanan Baru */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Tambah Makanan Berlebih Baru
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Makanan *
                </label>
                <input
                  name="name"
                  required
                  placeholder="Contoh: Roti Croissant Coklat"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kategori *
                  </label>
                  <select
                    name="category_id"
                    required
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Jenis Distribusi *
                  </label>
                  <select
                    name="type"
                    value={addType}
                    onChange={(e) => setAddType(e.target.value as FoodType)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="sale">Dijual Murah</option>
                    <option value="donation">Donasi Gratis</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Harga (Rp) *
                  </label>
                  <input
                    name="price"
                    type="number"
                    min="0"
                    required
                    value={addType === "donation" ? 0 : addPrice}
                    disabled={addType === "donation"}
                    onChange={(e) => setAddPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Jumlah Porsi *
                  </label>
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    defaultValue="10"
                    required
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Metode Pengambilan *
                </label>
                <select
                  name="pickup_method"
                  defaultValue="pickup"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="pickup">Ambil di Tempat (Self-Pickup)</option>
                  <option value="delivery">Diantar oleh Kurir (Delivery)</option>
                  <option value="both">Keduanya (Ambil / Antar)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Deskripsi Kondisi Makanan *
                </label>
                <textarea
                  name="description"
                  required
                  rows={2}
                  placeholder="Kondisi makanan masih sangat layak, dibuat pagi ini, kemasan bersih..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  URL Foto Makanan (Opsional)
                </label>
                <input
                  name="image_url"
                  placeholder="https://example.com/foto-makanan.jpg"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all"
                >
                  {isPending ? "Menyimpan..." : "Simpan Menu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Makanan */}
      {editingFood && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Edit Menu Makanan
              </h2>
              <button
                onClick={() => setEditingFood(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Makanan *
                </label>
                <input
                  name="name"
                  required
                  defaultValue={editingFood.name}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kategori *
                  </label>
                  <select
                    name="category_id"
                    required
                    defaultValue={editingFood.category_id}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Jenis Distribusi *
                  </label>
                  <select
                    name="type"
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as FoodType)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="sale">Dijual Murah</option>
                    <option value="donation">Donasi Gratis</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Harga (Rp) *
                  </label>
                  <input
                    name="price"
                    type="number"
                    min="0"
                    required
                    value={editType === "donation" ? 0 : editPrice}
                    disabled={editType === "donation"}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Jumlah Porsi *
                  </label>
                  <input
                    name="quantity"
                    type="number"
                    min="0"
                    defaultValue={editingFood.quantity}
                    required
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Metode Pengambilan *
                </label>
                <select
                  name="pickup_method"
                  defaultValue={editingFood.pickup_method}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="pickup">Ambil di Tempat (Self-Pickup)</option>
                  <option value="delivery">Diantar oleh Kurir (Delivery)</option>
                  <option value="both">Keduanya (Ambil / Antar)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Deskripsi Kondisi Makanan *
                </label>
                <textarea
                  name="description"
                  required
                  rows={2}
                  defaultValue={editingFood.description}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  URL Foto Makanan (Opsional)
                </label>
                <input
                  name="image_url"
                  defaultValue={editingFood.image_url || ""}
                  placeholder="https://example.com/foto-makanan.jpg"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingFood(null)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all"
                >
                  {isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Konfirmasi Hapus Makanan */}
      {deletingFood && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
              Hapus Menu Makanan?
            </h3>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Apakah Anda yakin ingin menghapus <strong>&quot;{deletingFood.name}&quot;</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingFood(null)}
                disabled={isPending}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isPending}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition-all"
              >
                {isPending ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
