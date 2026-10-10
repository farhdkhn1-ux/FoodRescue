import { requireRole } from "@/lib/auth/guard";
import Link from "next/link";

/**
 * Halaman Area Pembeli (Buyer Area)
 *
 * Terproteksi penuh di sisi server (Server Component).
 * Memanggil `requireRole(["buyer", "admin"], "/buyer")` sebelum merender komponen apa pun.
 * Jika belum login -> diarahkan ke `/login?redirect=/buyer`.
 * Jika role tidak memenuhi izin -> diarahkan ke `/unauthorized`.
 */
export default async function BuyerPage() {
  const auth = await requireRole(["buyer", "admin"], "/buyer");

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
            <span>Rute Privat Terproteksi • Pembeli (Buyer)</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Area Pembeli
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Akses khusus untuk riwayat pesanan, voucher penyelamatan makanan, dan status pembelian Anda.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 self-start sm:self-auto"
        >
          Kembali ke Beranda
        </Link>
      </div>

      {/* Informasi Otorisasi Sisi Server */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Email Terotentikasi
          </span>
          <p className="mt-2 text-base font-bold text-slate-900 dark:text-white truncate">
            {auth.user.email}
          </p>
          <span className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 block">
            ID: {auth.user.id.slice(0, 8)}...
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Role Terverifikasi Database
          </span>
          <p className="mt-2 text-base font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wide">
            {auth.role}
          </p>
          <span className="mt-1 text-xs text-slate-500 dark:text-slate-400 block">
            Sumber: public.users / RPC
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Status Proteksi
          </span>
          <div className="mt-2 flex items-center gap-1.5 text-base font-bold text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Aktif & Terlindungi</span>
          </div>
          <span className="mt-1 text-xs text-slate-500 dark:text-slate-400 block">
            Layer: proxy.ts + Server Component
          </span>
        </div>
      </div>

      {/* Roadmap & Keterangan Tahap */}
      <div className="mt-8 rounded-2xl border border-dashed border-sky-200 bg-sky-50/50 p-6 dark:border-sky-900/40 dark:bg-sky-950/20">
        <h2 className="text-sm font-bold text-sky-900 dark:text-sky-300">
          Catatan Arsitektur Proteksi (Tahap 5):
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-sky-800 dark:text-sky-300">
          Halaman ini memastikan hanya pengguna dengan role <strong>buyer</strong> yang dapat membuka area pembeli ini.
          Fitur detail pelacakan pesanan dan riwayat hemat pengeluaran akan diintegrasikan pada tahap selanjutnya.
        </p>
      </div>
    </main>
  );
}
