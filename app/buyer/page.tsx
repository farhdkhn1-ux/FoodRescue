import { requireRole } from "@/lib/auth/guard";
import Link from "next/link";
import BuyerOrdersClient from "./BuyerOrdersClient";
import { getBuyerOrdersAction } from "@/app/actions/order";

/**
 * Halaman Area Pembeli (Buyer Area) & Riwayat Pemesanan Makanan
 *
 * Terproteksi penuh di sisi server (Server Component):
 * - Memanggil `requireRole(["buyer", "admin"], "/buyer")`.
 * - Pengguna belum login -> diarahkan ke `/login?redirect=/buyer`.
 * - Role seller atau courier -> diarahkan ke `/unauthorized`.
 * - Mengambil riwayat pesanan aktif dari database Supabase sesuai identitas auth.uid().
 */
export default async function BuyerPage() {
  const auth = await requireRole(["buyer", "admin"], "/buyer");
  const ordersResult = await getBuyerOrdersAction();
  const initialOrders = ordersResult.success && ordersResult.data ? ordersResult.data : [];

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 md:py-14">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-8 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300 mb-3">
            <svg
              className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Area Pembeli • Food Rescue</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Riwayat Pesanan Anda
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Kelola pesanan makanan surplus, pantau status konfirmasi penjual, dan lacak penyelamatan pangan Anda.
          </p>
        </div>

        <Link
          href="/#katalog"
          className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 self-start sm:self-auto transition-colors"
        >
          Pesan Makanan Lainnya
        </Link>
      </div>

      {/* Informasi Ringkas Akun Pembeli */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Email Pembeli
          </span>
          <p className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white truncate">
            {auth.user.email}
          </p>
          <span className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400 block">
            ID: {auth.user.id.slice(0, 8)}...
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Role Terverifikasi
          </span>
          <p className="mt-1.5 text-sm font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wide">
            {auth.role}
          </p>
          <span className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 block">
            Otorisasi: Pembelian & Donasi
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Proteksi Transaksi
          </span>
          <div className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>PostgreSQL Atomic Lock</span>
          </div>
          <span className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 block">
            RLS Terisolasi Sesuai auth.uid()
          </span>
        </div>
      </div>

      {/* Komponen Utama Riwayat Pesanan */}
      <div className="mt-8">
        <BuyerOrdersClient
          initialOrders={initialOrders}
          userEmail={auth.user.email || ""}
        />
      </div>
    </main>
  );
}
