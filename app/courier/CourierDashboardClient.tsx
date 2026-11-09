"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calculateDistance, formatDistance } from "@/lib/utils/distance";
import { formatDateWIB } from "@/lib/utils/format";
import UserLocationCard from "@/components/UserLocationCard";
import type { UserLocationData } from "@/app/actions/location";

export interface DeliveryOrderItem {
  id: number;
  food_name: string;
  quantity: number;
  unit?: string;
  condition?: string;
  seller_id: string;
}

export interface DeliveryOrder {
  id: number;
  buyer_id: string;
  total_amount: number;
  status: string;
  pickup_method: string;
  shipping_address: string | null;
  created_at: string;
  items: DeliveryOrderItem[];
  seller_info?: {
    name: string | null;
    store_name?: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    phone?: string | null;
  } | null;
}

interface CourierDashboardClientProps {
  initialLocation: UserLocationData;
  initialOrders: DeliveryOrder[];
  courierEmail: string;
}

function formatDate(dateStr: string): string {
  return formatDateWIB(dateStr);
}

export default function CourierDashboardClient({
  initialLocation,
  initialOrders,
  courierEmail,
}: CourierDashboardClientProps) {
  const router = useRouter();
  const [courierLocation, setCourierLocation] = useState<UserLocationData>(initialLocation);
  const [orders, setOrders] = useState<DeliveryOrder[]>(initialOrders);
  const [prevInitialOrders, setPrevInitialOrders] = useState<DeliveryOrder[]>(initialOrders);
  if (prevInitialOrders !== initialOrders) {
    setPrevInitialOrders(initialOrders);
    setOrders(initialOrders);
  }
  const [filter, setFilter] = useState<string>("all");

  // Listener Realtime Supabase untuk Kurir (W5)
  useEffect(() => {
    const supabase = createClient();
    const channelName = `courier-deliveries-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          router.refresh();
        }
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" && process.env.NODE_ENV !== "production") {
          console.warn("[Realtime Courier Deliveries] Subscription error:", err?.message);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const activeDeliveries = orders.filter((o) => o.status === "confirmed");
  const completedDeliveries = orders.filter((o) => o.status === "completed");

  const filteredOrders = orders.filter((o) => {
    if (filter === "active") return o.status === "confirmed";
    if (filter === "completed") return o.status === "completed";
    return true;
  });

  return (
    <div className="space-y-8">
      {/* 1. Pengaturan Lokasi & GPS Kurir */}
      <UserLocationCard
        initialLocation={courierLocation}
        title="Lokasi Posisi Kurir & GPS"
        description="Gunakan fitur deteksi GPS perangkat Anda untuk menghitung jarak ke sumber bahan pakan dan alamat kandang peternak."
        onLocationUpdated={(newLoc) => setCourierLocation(newLoc)}
      />

      {/* 2. Ringkasan Statistik Tugas Pengantaran */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Pengantaran Aktif
          </span>
          <p className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
            {activeDeliveries.length}
          </p>
          <span className="mt-1 text-xs text-slate-500 block">
            Bahan siap dijemput & diantar
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Selesai Diantar
          </span>
          <p className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {completedDeliveries.length}
          </p>
          <span className="mt-1 text-xs text-slate-500 block">
            Total pakan berhasil disalurkan ke peternak
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Status Realtime
          </span>
          <div className="mt-2 flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
              WebSocket Aktif
            </span>
          </div>
          <span className="mt-1 text-xs text-slate-500 block">
            Sinkronisasi otomatis tanpa refresh
          </span>
        </div>
      </div>

      {/* 3. Filter Tugas Pengantaran */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Daftar Tugas Pengantaran ({filteredOrders.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pesanan khusus metode delivery dengan titik jemput dan titik tujuan lengkap • Kurir: {courierEmail}
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-800/80">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
              filter === "all"
                ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Semua ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("active")}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
              filter === "active"
                ? "bg-white text-amber-700 shadow-2xs dark:bg-slate-900 dark:text-amber-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Siap Antar ({activeDeliveries.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("completed")}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
              filter === "completed"
                ? "bg-white text-emerald-700 shadow-2xs dark:bg-slate-900 dark:text-emerald-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Selesai ({completedDeliveries.length})
          </button>
        </div>
      </div>

      {/* 4. Daftar Kartu Pengantaran */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-800">
          <svg
            className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125V14.25m-19.5 0h19.5m-19.5 0l2.25-6.75A2.25 2.25 0 014.5 6h15a2.25 2.25 0 012.13 1.5l2.25 6.75m-19.5 0H21"
            />
          </svg>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Tidak ada tugas pengantaran pada filter ini.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Pesanan baru dengan metode delivery akan otomatis muncul secara realtime saat dikonfirmasi penjual.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredOrders.map((order) => {
            // Kalkulasi jarak dari Kurir ke Toko Penjual
            const distCourierToSeller = calculateDistance(
              courierLocation.latitude,
              courierLocation.longitude,
              order.seller_info?.latitude,
              order.seller_info?.longitude
            );

            return (
              <div
                key={order.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-md"
              >
                <div>
                  {/* Header Kartu */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          Pesanan #{order.id}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {formatDate(order.created_at)}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 mt-1">
                        🚚 Antar ke Alamat (Delivery)
                      </span>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        order.status === "confirmed"
                          ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      }`}
                    >
                      {order.status === "confirmed" ? "Siap Diantar" : "Selesai"}
                    </span>
                  </div>

                  {/* Rincian Bahan Pakan */}
                  <div className="py-3 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Bahan Pakan yang Diangkut
                    </span>
                    <ul className="space-y-1.5">
                      {order.items.map((item) => (
                        <li
                          key={item.id}
                          className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="truncate">{item.food_name}</span>
                            {item.condition && (
                              <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                {item.condition}
                              </span>
                            )}
                          </div>
                          <span className="text-slate-600 dark:text-slate-400 shrink-0 font-bold ml-2">
                            {item.quantity} {item.unit || "kg"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Rute Penjemputan & Pengantaran (Fitur Lokasi W5 & W6) */}
                  <div className="py-3 space-y-3.5">
                    {/* Titik Jemput (Seller Shop) */}
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-xs font-bold mt-0.5">
                        1
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-bold text-slate-500 uppercase">
                            Titik Jemput (Sumber Bahan)
                          </span>
                          {distCourierToSeller !== null && (
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              📍 {formatDistance(distCourierToSeller)} dari posisi Anda
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">
                          {order.seller_info?.store_name || order.seller_info?.name || "Sumber Bahan Pangan"}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {order.seller_info?.address || "Alamat toko belum dicantumkan."}
                        </p>
                        {order.seller_info?.latitude && order.seller_info?.longitude && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${order.seller_info.latitude},${order.seller_info.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                              <span>Navigasi Titik Jemput Google Maps</span>
                            </a>
                            {order.seller_info?.phone && (
                              <span className="text-[11px] text-slate-400">
                                • Telp: {order.seller_info.phone}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Titik Antar (Buyer Shipping Address) */}
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold mt-0.5">
                        2
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-bold text-slate-500 uppercase block">
                          Titik Tujuan (Alamat Peternak / Kandang)
                        </span>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white leading-relaxed">
                          {order.shipping_address || "Alamat tidak dicantumkan"}
                        </p>
                        {order.shipping_address && (
                          <div className="mt-1.5">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.shipping_address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                              <span>Navigasi Tujuan Peternak Google Maps</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Kartu */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Nilai Pesanan:{" "}
                    <strong className="text-slate-900 dark:text-white">
                      Rp {Number(order.total_amount).toLocaleString("id-ID")}
                    </strong>
                  </span>

                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    {order.status === "confirmed" ? "Menunggu Penjemputan" : "Pengantaran Tuntas"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
