import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import SellerDashboardClient from "./SellerDashboardClient";
import type { Category, FoodItem } from "./types";
import { getSellerOrdersAction } from "@/app/actions/order";
import type { Order } from "@/lib/types/food";
import type { UserLocationData } from "@/app/actions/location";

/**
 * Halaman Dashboard Mitra Penjual (Seller Dashboard) — Food Waste to Animal Feed
 *
 * Terproteksi penuh di sisi server (Server Component):
 * - Memanggil `requireRole(["seller", "admin"], "/seller")`.
 * - Pengguna belum login -> diarahkan ke `/login?redirect=/seller`.
 * - Role buyer atau courier -> diarahkan ke `/unauthorized`.
 * - Admin diizinkan masuk untuk supervisi & moderasi platform.
 *
 * Data diambil secara server-side dari Supabase:
 * - Profil toko & lokasi penjemputan dari tabel `users`.
 * - Kategori dari tabel `categories`.
 * - Daftar bahan pakan dari tabel `foods`.
 * - Daftar pesanan/pengajuan peternak dari RPC `orders`.
 */
export default async function SellerPage() {
  // 1. Otorisasi ketat sisi server
  const auth = await requireRole(["seller", "admin"], "/seller");

  // 2. Baca data langsung dari database Supabase
  const supabase = await createClient();

  // Ambil data profil toko seller dari tabel users (Fitur Wajib W6)
  const { data: userProfile } = await supabase
    .from("users")
    .select("store_name, phone, is_phone_public, address, latitude, longitude")
    .eq("id", auth.user.id)
    .maybeSingle();

  const storeProfile: UserLocationData = {
    store_name: (userProfile?.store_name as string | undefined) || null,
    phone: (userProfile?.phone as string | undefined) || null,
    is_phone_public: Boolean(userProfile?.is_phone_public),
    address: (userProfile?.address as string | undefined) || null,
    latitude:
      userProfile?.latitude !== null && userProfile?.latitude !== undefined
        ? Number(userProfile.latitude)
        : null,
    longitude:
      userProfile?.longitude !== null && userProfile?.longitude !== undefined
        ? Number(userProfile.longitude)
        : null,
    is_location_complete: Boolean(
      userProfile?.store_name &&
        userProfile?.address &&
        userProfile?.latitude !== null &&
        userProfile?.longitude !== null
    ),
  };

  // Ambil daftar kategori aktif
  const { data: categoriesData } = await supabase
    .from("categories")
    .select("id, name")
    .order("id");

  const categories: Category[] = categoriesData || [];

  // Ambil bahan pakan ternak
  let foodsQuery = supabase
    .from("foods")
    .select("*, categories(name)")
    .order("created_at", { ascending: false });

  if (auth.role !== "admin") {
    foodsQuery = foodsQuery.eq("seller_id", auth.user.id);
  }

  const { data: foodsData, error: foodsError } = await foodsQuery;

  if (foodsError) {
    console.error("Gagal memuat listing bahan pakan seller:", foodsError);
  }

  const initialFoods: FoodItem[] = (foodsData as unknown as FoodItem[]) || [];

  // Ambil pesanan masuk penjual
  const ordersResult = await getSellerOrdersAction();
  const initialOrders: Order[] =
    ordersResult.success && ordersResult.data ? ordersResult.data : [];

  return (
    <SellerDashboardClient
      initialFoods={initialFoods}
      categories={categories}
      userEmail={auth.user.email || ""}
      userId={auth.user.id}
      userRole={auth.role}
      initialStoreProfile={storeProfile}
      initialOrders={initialOrders}
    />
  );
}
