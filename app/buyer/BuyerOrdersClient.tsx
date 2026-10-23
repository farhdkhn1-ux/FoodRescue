/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Order, OrderStatus } from "@/lib/types/food";
import { cancelOrderAction } from "@/app/actions/order";

interface BuyerOrdersClientProps {
  initialOrders: Order[];
  userEmail: string;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return dateStr;
  }
}

function getStatusBadge(status: OrderStatus) {
  switch (status) {
    case "pending":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          Menunggu Konfirmasi
        </span>
      );
    case "confirmed":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-800">
          <span className="h-2 w-2 rounded-full bg-sky-500" />
          Dikonfirmasi Penjual
        </span>
      );
    case "completed":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
          <svg className="h-3 w-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
          </svg>
          Selesai Diselamatkan
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          Dibatalkan
        </span>
      );
    default:
      return null;
  }
}

export default function BuyerOrdersClient({
  initialOrders,
  userEmail,
}: BuyerOrdersClientProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  // Modal Pembatalan
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const confirmedCount = orders.filter((o) => o.status === "confirmed").length;
  const completedCount = orders.filter((o) => o.status === "completed").length;

  const filteredOrders = orders.filter((order) => {
    if (selectedFilter === "all") return true;
    return order.status === selectedFilter;
  });

  async function handleConfirmCancel() {
    if (!cancellingOrderId) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await cancelOrderAction(
        cancellingOrderId,
        cancelReason || "Dibatalkan oleh pembeli",
        true
      );

      if (res.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === cancellingOrderId ? { ...o, status: "cancelled" } : o
          )
        );
        setFeedback({
          type: "success",
          message: `Pesanan #${cancellingOrderId} berhasil dibatalkan dan stok telah dipulihkan.`,
        });
        setCancellingOrderId(null);
        setCancelReason("");
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Gagal membatalkan pesanan.",
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Bar Info Akun Pembeli */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-800">
          Riwayat Pemesanan Makanan ({orders.length})
        </h2>
        <span className="text-xs text-slate-500">
          Akun: <strong className="text-slate-700 font-semibold">{userEmail}</strong>
        </span>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          role="alert"
          className={`rounded-2xl border p-4 text-xs sm:text-sm flex items-start justify-between gap-3 ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <svg className="h-5 w-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Ringkasan Status Pesanan */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setSelectedFilter("all")}
          className={`rounded-2xl border p-3.5 text-left transition-all ${
            selectedFilter === "all"
              ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/30"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <span className="text-[11px] font-semibold text-slate-500 uppercase block">
            Semua Pesanan
          </span>
          <p className="mt-1 text-2xl font-black text-slate-900">{orders.length}</p>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFilter("pending")}
          className={`rounded-2xl border p-3.5 text-left transition-all ${
            selectedFilter === "pending"
              ? "border-amber-600 bg-amber-50/60 ring-2 ring-amber-600/30"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <span className="text-[11px] font-semibold text-amber-700 uppercase block">
            Menunggu
          </span>
          <p className="mt-1 text-2xl font-black text-amber-700">{pendingCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFilter("confirmed")}
          className={`rounded-2xl border p-3.5 text-left transition-all ${
            selectedFilter === "confirmed"
              ? "border-sky-600 bg-sky-50/60 ring-2 ring-sky-600/30"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <span className="text-[11px] font-semibold text-sky-700 uppercase block">
            Dikonfirmasi
          </span>
          <p className="mt-1 text-2xl font-black text-sky-700">{confirmedCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFilter("completed")}
          className={`rounded-2xl border p-3.5 text-left transition-all ${
            selectedFilter === "completed"
              ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/30"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <span className="text-[11px] font-semibold text-emerald-700 uppercase block">
            Selesai
          </span>
          <p className="mt-1 text-2xl font-black text-emerald-700">{completedCount}</p>
        </button>
      </div>

      {/* Daftar Pesanan */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-800">
            {selectedFilter === "all"
              ? "Belum Ada Riwayat Pesanan"
              : `Tidak ada pesanan dengan status "${selectedFilter}"`}
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            Jelajahi berbagai menu makanan surplus lezat dan donasi sosial di katalog untuk mulai menyelamatkan pangan.
          </p>
          <div className="mt-6">
            <Link
              href="/#katalog"
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition-colors"
            >
              <span>Jelajahi Makanan Sekarang</span>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isDonation = order.total_amount === 0;
            const canCancel = order.status === "pending";

            return (
              <div
                key={order.id}
                className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs transition-all hover:border-slate-300"
              >
                {/* Header Pesanan */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3.5 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-slate-900 font-mono text-sm">
                      #{order.id}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500">{formatDate(order.created_at)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(order.status)}
                  </div>
                </div>

                {/* Body: Rincian Item */}
                <div className="p-5 space-y-4">
                  {(order.order_items || []).map((item) => (
                    <div key={item.id} className="flex items-start gap-4">
                      {/* Foto Makanan */}
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                        {item.food?.image_url ? (
                          <img
                            src={item.food.image_url}
                            alt={item.food.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-400">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Info Item */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {item.food?.name || `Item Makanan #${item.food_id}`}
                        </h4>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">
                            {item.quantity} Porsi
                          </span>
                          <span>•</span>
                          <span>
                            {item.price === 0 ? "Donasi Sosial" : `Rp ${item.price.toLocaleString("id-ID")} / porsi`}
                          </span>
                        </div>
                      </div>

                      {/* Subtotal Item */}
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Subtotal</span>
                        <span className="text-sm font-extrabold text-slate-900">
                          {item.subtotal === 0 ? "GRATIS" : `Rp ${item.subtotal.toLocaleString("id-ID")}`}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Rincian Metode & Alamat */}
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700">Metode Pengambilan:</span>
                      <span className="inline-flex items-center rounded-lg bg-white px-2 py-0.5 font-semibold text-slate-800 border border-slate-200">
                        {order.pickup_method === "delivery" ? "Pengantaran (Delivery)" : "Ambil Sendiri (Pickup)"}
                      </span>
                    </div>

                    {order.pickup_method === "delivery" && order.shipping_address && (
                      <div className="text-slate-500 truncate max-w-md">
                        <span className="font-semibold text-slate-700">Tujuan:</span> {order.shipping_address}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Pesanan & Aksi */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100 bg-slate-50/40 px-5 py-3.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-slate-500 font-medium">Total Pembayaran:</span>
                    <span className="text-base font-black text-emerald-700">
                      {isDonation ? "GRATIS (Donasi)" : `Rp ${order.total_amount.toLocaleString("id-ID")}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => setCancellingOrderId(order.id)}
                        className="inline-flex items-center justify-center rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Batalkan Pesanan
                      </button>
                    )}

                    <Link
                      href={`/food/${order.order_items?.[0]?.food_id || ""}`}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Lihat Produk
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Dialog Pembatalan Pesanan */}
      {cancellingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-100">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                Konfirmasi Pembatalan Pesanan #{cancellingOrderId}
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin membatalkan pesanan ini? Stok porsi makanan akan otomatis dikembalikan ke katalog agar dapat diselamatkan pengguna lain.
            </p>

            <div>
              <label htmlFor="cancel-reason" className="block text-xs font-bold text-slate-700 mb-1">
                Alasan Pembatalan (Opsional)
              </label>
              <textarea
                id="cancel-reason"
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Contoh: Berhalangan hadir, salah memilih porsi..."
                className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setCancellingOrderId(null);
                  setCancelReason("");
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmCancel}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Membatalkan...</span>
                  </>
                ) : (
                  <span>Ya, Batalkan Pesanan</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
