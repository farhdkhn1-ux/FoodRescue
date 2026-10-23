/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Order, OrderStatus } from "@/lib/types/food";
import {
  updateOrderStatusAction,
  cancelOrderAction,
} from "@/app/actions/order";

interface SellerOrdersManagerProps {
  initialOrders: Order[];
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
          Perlu Dikonfirmasi
        </span>
      );
    case "confirmed":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-800">
          <span className="h-2 w-2 rounded-full bg-sky-500" />
          Sedang Disiapkan
        </span>
      );
    case "completed":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
          <svg className="h-3 w-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
          </svg>
          Selesai Diserahkan
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          Dibatalkan / Ditolak
        </span>
      );
    default:
      return null;
  }
}

export default function SellerOrdersManager({ initialOrders }: SellerOrdersManagerProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [selectedFilter, setSelectedFilter] = useState<string>("pending");
  const [isPending, startTransition] = useTransition();

  // Feedback Notification
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Modal Penolakan / Pembatalan
  const [rejectingOrderId, setRejectingOrderId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");
  const [shouldRestock, setShouldRestock] = useState<boolean>(true);

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const confirmedOrders = orders.filter((o) => o.status === "confirmed");
  const completedOrders = orders.filter((o) => o.status === "completed");
  const cancelledOrders = orders.filter((o) => o.status === "cancelled");

  const filteredOrders = orders.filter((order) => {
    if (selectedFilter === "all") return true;
    return order.status === selectedFilter;
  });

  // Handler: Konfirmasi Pesanan (pending -> confirmed)
  function handleConfirmOrder(orderId: number) {
    setFeedback(null);
    startTransition(async () => {
      const res = await updateOrderStatusAction(orderId, "confirmed");
      if (res.success) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: "confirmed" } : o))
        );
        setFeedback({
          type: "success",
          message: `Pesanan #${orderId} berhasil dikonfirmasi! Segera siapkan porsi makanan.`,
        });
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Gagal mengonfirmasi pesanan.",
        });
      }
    });
  }

  // Handler: Selesaikan Pesanan (confirmed -> completed)
  function handleCompleteOrder(orderId: number) {
    setFeedback(null);
    startTransition(async () => {
      const res = await updateOrderStatusAction(orderId, "completed");
      if (res.success) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: "completed" } : o))
        );
        setFeedback({
          type: "success",
          message: `Pesanan #${orderId} telah selesai diserahkan ke pembeli. Terima kasih telah menyelamatkan pangan!`,
        });
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Gagal menyelesaikan pesanan.",
        });
      }
    });
  }

  // Handler: Tolak / Batalkan Pesanan (cancel_order_atomic dengan restock toggle)
  function handleConfirmReject() {
    if (!rejectingOrderId) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await cancelOrderAction(
        rejectingOrderId,
        rejectReason || "Ditolak oleh penjual",
        shouldRestock
      );

      if (res.success) {
        setOrders((prev) =>
          prev.map((o) => (o.id === rejectingOrderId ? { ...o, status: "cancelled" } : o))
        );
        setFeedback({
          type: "success",
          message: `Pesanan #${rejectingOrderId} telah dibatalkan.${
            shouldRestock ? " Porsi makanan telah dikembalikan ke katalog." : " Porsi fisik ditandai afkir (tidak direstock)."
          }`,
        });
        setRejectingOrderId(null);
        setRejectReason("");
        setShouldRestock(true);
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
      {/* Banner Feedback */}
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

      {/* Kartu Status Filter Pesanan */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setSelectedFilter("pending")}
          className={`rounded-2xl border p-3 text-left transition-all relative ${
            selectedFilter === "pending"
              ? "border-amber-600 bg-amber-50/70 ring-2 ring-amber-600/30"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <span className="text-[11px] font-bold text-amber-700 uppercase block">
            Perlu Tindakan
          </span>
          <p className="mt-1 text-2xl font-black text-amber-700">
            {pendingOrders.length}
          </p>
          {pendingOrders.length > 0 && (
            <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSelectedFilter("confirmed")}
          className={`rounded-2xl border p-3 text-left transition-all ${
            selectedFilter === "confirmed"
              ? "border-sky-600 bg-sky-50/70 ring-2 ring-sky-600/30"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <span className="text-[11px] font-bold text-sky-700 uppercase block">
            Sedang Disiapkan
          </span>
          <p className="mt-1 text-2xl font-black text-sky-700">
            {confirmedOrders.length}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFilter("completed")}
          className={`rounded-2xl border p-3 text-left transition-all ${
            selectedFilter === "completed"
              ? "border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-600/30"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <span className="text-[11px] font-bold text-emerald-700 uppercase block">
            Selesai
          </span>
          <p className="mt-1 text-2xl font-black text-emerald-700">
            {completedOrders.length}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFilter("cancelled")}
          className={`rounded-2xl border p-3 text-left transition-all ${
            selectedFilter === "cancelled"
              ? "border-slate-500 bg-slate-100 ring-2 ring-slate-400"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <span className="text-[11px] font-bold text-slate-500 uppercase block">
            Ditolak / Batal
          </span>
          <p className="mt-1 text-2xl font-black text-slate-700">
            {cancelledOrders.length}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFilter("all")}
          className={`col-span-2 sm:col-span-1 rounded-2xl border p-3 text-left transition-all ${
            selectedFilter === "all"
              ? "border-slate-700 bg-slate-50 ring-2 ring-slate-400"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <span className="text-[11px] font-bold text-slate-400 uppercase block">
            Semua Pesanan
          </span>
          <p className="mt-1 text-2xl font-black text-slate-800">
            {orders.length}
          </p>
        </button>
      </div>

      {/* Daftar Pesanan Masuk */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-800">
            {selectedFilter === "pending"
              ? "Tidak Ada Pesanan yang Perlu Tindakan"
              : `Tidak ada pesanan dengan status "${selectedFilter}"`}
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            Pesanan baru dari pembeli akan muncul di sini secara instan dengan proteksi stok atomik.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isDonation = order.total_amount === 0;

            return (
              <div
                key={order.id}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs transition-all hover:border-slate-300"
              >
                {/* Header Pesanan */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3.5 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-slate-900 font-mono text-sm">
                      #{order.id}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500">{formatDate(order.created_at)}</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-semibold text-slate-700">
                      Metode: {order.pickup_method === "delivery" ? "Pengantaran (Delivery)" : "Ambil di Gerai (Pickup)"}
                    </span>
                  </div>

                  <div>{getStatusBadge(order.status)}</div>
                </div>

                {/* Body Pesanan */}
                <div className="p-5 space-y-4">
                  {(order.order_items || []).map((item) => (
                    <div key={item.id} className="flex items-start gap-4">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                        {item.food?.image_url ? (
                          <img
                            src={item.food.image_url}
                            alt={item.food.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-400">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {item.food?.name || `Menu #${item.food_id}`}
                        </h4>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Jumlah: <strong className="text-slate-800">{item.quantity} Porsi</strong>
                          {" • "}
                          {item.price === 0 ? "Donasi Sosial" : `Rp ${item.price.toLocaleString("id-ID")} / porsi`}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Subtotal</span>
                        <span className="text-sm font-extrabold text-slate-900">
                          {item.subtotal === 0 ? "GRATIS" : `Rp ${item.subtotal.toLocaleString("id-ID")}`}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Alamat Pengantaran jika Delivery */}
                  {order.pickup_method === "delivery" && order.shipping_address && (
                    <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-3 text-xs text-sky-900">
                      <span className="font-bold block text-sky-800">Alamat Pengantaran Pembeli:</span>
                      <p className="mt-0.5 text-slate-700">{order.shipping_address}</p>
                    </div>
                  )}
                </div>

                {/* Footer Pesanan & Tombol Otorisasi Penjual */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100 bg-slate-50/40 px-5 py-3.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-slate-500 font-medium">Total Pesanan:</span>
                    <span className="text-base font-black text-emerald-700">
                      {isDonation ? "GRATIS (Donasi Sosial)" : `Rp ${order.total_amount.toLocaleString("id-ID")}`}
                    </span>
                  </div>

                  {/* Tombol Aksi Berdasarkan Status Pesanan */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {order.status === "pending" && (
                      <>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setRejectingOrderId(order.id)}
                          className="inline-flex items-center justify-center rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          Tolak Pesanan
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleConfirmOrder(order.id)}
                          className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                          Terima & Siapkan Pesanan
                        </button>
                      </>
                    )}

                    {order.status === "confirmed" && (
                      <>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setRejectingOrderId(order.id)}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          Batal Darurat
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleCompleteOrder(order.id)}
                          className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-sky-700 transition-colors disabled:opacity-50"
                        >
                          Tandai Selesai Diserahkan
                        </button>
                      </>
                    )}

                    {order.status === "completed" && (
                      <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        Transaksi Berhasil Selesai
                      </span>
                    )}

                    {order.status === "cancelled" && (
                      <span className="text-xs font-semibold text-slate-400">
                        Pesanan Telah Ditutup
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Tolak / Batalkan Pesanan dengan Flag Restock */}
      {rejectingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-100">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                Tolak / Batalkan Pesanan #{rejectingOrderId}
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Tindakan ini akan membatalkan pesanan secara atomik di database. Tentukan apakah porsi fisik makanan layak dikembalikan ke etalase atau diafkir.
            </p>

            <div>
              <label htmlFor="reject-reason" className="block text-xs font-bold text-slate-700 mb-1">
                Alasan Penolakan / Pembatalan
              </label>
              <textarea
                id="reject-reason"
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Stok fisik rusak di dapur, toko tutup mendadak..."
                className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            {/* Checkbox Restock Bersyarat */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shouldRestock}
                  onChange={(e) => setShouldRestock(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800 block">
                    Kembalikan porsi ke katalog makanan (Restock)
                  </span>
                  <span className="text-slate-500 block mt-0.5">
                    Centang jika porsi masih utuh & layak jual. Hilangkan centang jika makanan tumpah/rusak (afkir) agar tidak dijual ulang.
                  </span>
                </div>
              </label>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setRejectingOrderId(null);
                  setRejectReason("");
                  setShouldRestock(true);
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmReject}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Memproses...</span>
                  </>
                ) : (
                  <span>Tolak Pesanan Ini</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
