import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import CourierDashboardClient, {
  type DeliveryOrder,
} from "./CourierDashboardClient";

interface RawOrderItem {
  id: number;
  food_id: number;
  seller_id: string;
  quantity: number;
  price: number;
  subtotal: number;
  foods?: {
    name: string;
    unit?: string | null;
    condition?: string | null;
  } | null;
}

interface RawOrder {
  id: number;
  buyer_id: string;
  total_amount: number | string;
  status: string;
  pickup_method: string;
  shipping_address: string | null;
  created_at: string;
  order_items?: RawOrderItem[];
}

/**
 * Halaman Area Kurir Pengantaran (Courier Area) — Food Rescue W5
 *
 * Terproteksi penuh di sisi server (Server Component):
 * - Memanggil `requireRole(["courier", "admin"], "/courier")`.
 * - Pengguna belum login -> diarahkan ke `/login?redirect=/courier`.
 * - Role tidak sesuai -> diarahkan ke `/unauthorized`.
 * - Menampilkan tugas pengantaran delivery aktif & kalkulasi jarak toko - kurir.
 */
export default async function CourierPage() {
  const auth = await requireRole(["courier", "admin"], "/courier");
  const supabase = await createClient();

  // 1. Ambil data profil lokasi kurir dari kolom users eksisting
  const { data: userProfile } = await supabase
    .from("users")
    .select("address, latitude, longitude")
    .eq("id", auth.user.id)
    .maybeSingle();

  const courierLocation = {
    address: (userProfile?.address as string | undefined) || null,
    latitude:
      userProfile?.latitude !== null && userProfile?.latitude !== undefined
        ? Number(userProfile.latitude)
        : null,
    longitude:
      userProfile?.longitude !== null && userProfile?.longitude !== undefined
        ? Number(userProfile.longitude)
        : null,
  };

  // 2. Ambil pesanan delivery yang perlu diantar (confirmed atau completed)
  const { data: rawOrdersData, error: ordersError } = await supabase
    .from("orders")
    .select(`
      id,
      buyer_id,
      total_amount,
      status,
      pickup_method,
      shipping_address,
      created_at,
      order_items (
        id,
        food_id,
        seller_id,
        quantity,
        price,
        subtotal,
        foods (
          name,
          unit,
          condition
        )
      )
    `)
    .eq("pickup_method", "delivery")
    .in("status", ["confirmed", "completed"])
    .order("created_at", { ascending: false });

  if (ordersError) {
    console.error("Gagal memuat tugas pengantaran kurir:", ordersError);
  }

  const rawOrders: RawOrder[] = (rawOrdersData as unknown as RawOrder[]) || [];

  // 3. Ambil data profil toko mitra penjual terkait untuk titik penjemputan
  const sellerIds = Array.from(
    new Set(
      rawOrders
        .flatMap((o) => (o.order_items || []).map((i) => i.seller_id))
        .filter(Boolean)
    )
  );

  const sellersMap: Record<
    string,
    {
      name: string | null;
      store_name: string | null;
      address: string | null;
      latitude: number | null;
      longitude: number | null;
      phone: string | null;
    }
  > = {};

  if (sellerIds.length > 0) {
    const { data: sellersData } = await supabase
      .from("seller_public_profiles")
      .select("id, store_name, address, latitude, longitude, phone")
      .in("id", sellerIds);

    (sellersData || []).forEach((s) => {
      sellersMap[s.id] = {
        name: s.store_name,
        store_name: s.store_name,
        address: s.address,
        latitude: s.latitude !== null && s.latitude !== undefined ? Number(s.latitude) : null,
        longitude: s.longitude !== null && s.longitude !== undefined ? Number(s.longitude) : null,
        phone: s.phone,
      };
    });
  }

  // 4. Transformasi ke format DeliveryOrder
  const initialOrders: DeliveryOrder[] = rawOrders.map((ro) => {
    const firstSellerId = ro.order_items?.[0]?.seller_id;
    const sellerInfo = firstSellerId ? sellersMap[firstSellerId] : null;

    return {
      id: ro.id,
      buyer_id: ro.buyer_id,
      total_amount: Number(ro.total_amount),
      status: ro.status,
      pickup_method: ro.pickup_method,
      shipping_address: ro.shipping_address,
      created_at: ro.created_at,
      items: (ro.order_items || []).map((item) => ({
        id: item.id,
        food_name: item.foods?.name || "Bahan Pakan",
        quantity: item.quantity,
        unit: item.foods?.unit || "kg",
        condition: item.foods?.condition || "layak",
        seller_id: item.seller_id,
      })),
      seller_info: sellerInfo || null,
    };
  });

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
            <span>Logistik Pakan Ternak • Kurir (Courier)</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Area Kurir Pengantaran Bahan Pakan
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Penjemputan bahan pakan dari sumber bahan (restoran, pasar, pabrik) dan pengantaran ke peternak secara realtime.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 self-start sm:self-auto transition-colors"
        >
          Kembali ke Beranda
        </Link>
      </div>

      {/* Informasi Otorisasi Sisi Server */}
      <div className="mt-6 mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Email Kurir
          </span>
          <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white truncate">
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
          <p className="mt-1 text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
            {auth.role}
          </p>
          <span className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 block">
            Otorisasi: Delivery & Pickup
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Proteksi Lokasi & Rute
          </span>
          <div className="mt-1 flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Aktif & Terlindungi RLS</span>
          </div>
          <span className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 block">
            Haversine Geolocation Engine
          </span>
        </div>
      </div>

      {/* Komponen Utama Interaktif Kurir */}
      <CourierDashboardClient
        initialLocation={courierLocation}
        initialOrders={initialOrders}
        courierEmail={auth.user.email || ""}
      />
    </main>
  );
}
