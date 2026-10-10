import { requireRole } from "@/lib/auth/guard";
import Link from "next/link";

/**
 * Halaman Area Kurir (Courier Area)
 *
 * Terproteksi penuh di sisi server (Server Component).
 * Memanggil `requireRole(["courier", "admin"], "/courier")` sebelum merender komponen apa pun.
 * Jika belum login -> diarahkan ke `/login?redirect=/courier`.
 * Jika role tidak memenuhi izin -> diarahkan ke `/unauthorized`.
 */
export default async function CourierPage() {
  const auth = await requireRole(["courier", "admin"], "/courier");

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 md:py-14">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-8 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 mb-3">
            <svg
              className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400"
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
            <span>Rute Privat Terproteksi • Kurir (Courier)</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Area Kurir Pengantaran
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Akses khusus penjemputan makanan berlebih dari mitra penjual menuju pembeli.
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
          <p className="mt-2 text-base font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
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
      <div className="mt-8 rounded-2xl border border-dashed border-amber-200 bg-amber-50/50 p-6 dark:border-amber-900/40 dark:bg-amber-950/20">
        <h2 className="text-sm font-bold text-amber-900 dark:text-amber-300">
          Catatan Arsitektur Proteksi (Tahap 5):
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
          Halaman ini memastikan hanya pengguna dengan role <strong>courier</strong> yang dapat membuka area tugas kurir ini.
          Fitur daftar tugas pengantaran aktif dan konfirmasi penyerahan makanan akan dikembangkan pada tahap selanjutnya.
        </p>
      </div>
    </main>
  );
}
