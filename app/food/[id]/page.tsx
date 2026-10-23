import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserAndRole } from "@/lib/auth/guard";
import FoodDetailClient from "./FoodDetailClient";
import type { FoodItem } from "@/lib/types/food";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const foodId = Number(id);

  if (isNaN(foodId)) {
    return {
      title: "Makanan Tidak Ditemukan — Food Rescue",
    };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("foods")
    .select("name, description")
    .eq("id", foodId)
    .maybeSingle();

  if (!data) {
    return {
      title: "Makanan Tidak Ditemukan — Food Rescue",
    };
  }

  return {
    title: `${data.name} — Detail Penyelamatan Makanan | Food Rescue`,
    description:
      data.description ||
      "Dapatkan makanan berkualitas hemat atau donasi gratis untuk mencegah pemborosan makanan.",
  };
}

/**
 * Halaman Detail Makanan (Server Component)
 *
 * Mengambil data otoritatif dari tabel `foods` dan kategori terkait.
 * Memeriksa status autentikasi pembeli/penjual di server tanpa membocorkan data privat.
 */
function getServerTimestamp(): number {
  return Date.now();
}

export default async function FoodDetailPage({ params }: PageProps) {
  const { id } = await params;
  const foodId = Number(id);

  if (isNaN(foodId)) {
    notFound();
  }

  const supabase = await createClient();
  const authResult = await getAuthenticatedUserAndRole();

  const { data: foodData, error } = await supabase
    .from("foods")
    .select("*, categories(name)")
    .eq("id", foodId)
    .maybeSingle();

  if (error || !foodData) {
    notFound();
  }

  const serverTime = getServerTimestamp();

  return (
    <FoodDetailClient
      food={foodData as unknown as FoodItem}
      userRole={authResult.role}
      userId={authResult.user?.id || null}
      serverTime={serverTime}
    />
  );
}
