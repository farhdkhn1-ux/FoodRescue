import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import SellerDashboardClient from "./SellerDashboardClient";
import type { Category, FoodItem } from "./types";

/**
 * Halaman Dashboard Mitra Penjual (Seller Dashboard)
 *
 * Terproteksi penuh di sisi server (Server Component):
 * - Memanggil `requireRole(["seller", "admin"], "/seller")`.
 * - Pengguna belum login -> diarahkan ke `/login?redirect=/seller`.
 * - Role buyer atau courier -> diarahkan ke `/unauthorized`.
 * - Admin diizinkan masuk untuk supervisi & moderasi platform.
 *
 * Data diambil secara server-side dari Supabase:
 * - Kategori dari tabel `categories`.
 * - Daftar makanan dari tabel `foods` (difilter per `seller_id` untuk seller).
 */
export default async function SellerPage() {
  // 1. Otorisasi ketat sisi server
  const auth = await requireRole(["seller", "admin"], "/seller");

  // 2. Baca data langsung dari database Supabase
  const supabase = await createClient();

  // Ambil daftar kategori aktif
  const { data: categoriesData } = await supabase
    .from("categories")
    .select("id, name")
    .order("id");

  const categories: Category[] = categoriesData || [];

  // Ambil makanan:
  // - Mitra Penjual: HANYA makanan miliknya sendiri (seller_id = auth.user.id)
  // - Administrator: Seluruh makanan untuk keperluan supervisi
  let foodsQuery = supabase
    .from("foods")
    .select("*, categories(name)")
    .order("created_at", { ascending: false });

  if (auth.role !== "admin") {
    foodsQuery = foodsQuery.eq("seller_id", auth.user.id);
  }

  const { data: foodsData, error: foodsError } = await foodsQuery;

  if (foodsError) {
    console.error("Gagal memuat makanan seller:", foodsError);
  }

  const initialFoods: FoodItem[] = (foodsData as unknown as FoodItem[]) || [];

  return (
    <SellerDashboardClient
      initialFoods={initialFoods}
      categories={categories}
      userEmail={auth.user.email || ""}
      userId={auth.user.id}
      userRole={auth.role}
    />
  );
}
