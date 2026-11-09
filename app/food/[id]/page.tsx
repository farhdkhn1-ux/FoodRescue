import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserAndRole } from "@/lib/auth/guard";
import FoodDetailClient from "./FoodDetailClient";
import type { FoodItem, SellerPublicProfile } from "@/lib/types/food";
import type { UserLocationData } from "@/app/actions/location";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const foodId = Number(id);

  if (isNaN(foodId)) {
    return {
      title: "Bahan Pakan Tidak Ditemukan — Food Rescue",
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
      title: "Bahan Pakan Tidak Ditemukan — Food Rescue",
    };
  }

  return {
    title: `${data.name} — Detail Bahan Pakan Ternak | Food Rescue`,
    description:
      data.description ||
      "Pemanfaatan bahan pangan berlebih untuk pakan ternak berkualitas. Food Waste to Animal Feed.",
  };
}

/**
 * Halaman Detail Bahan Pakan Ternak (Server Component)
 *
 * Mengambil data otoritatif bahan pakan, kategori, profil toko penjual (sumber bahan),
 * dan lokasi peternak (buyer) untuk perhitungan jarak & navigasi penjemputan.
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

  // Ambil profil publik toko seller untuk titik penjemputan (Fitur Wajib W6)
  const { data: sellerData } = await supabase
    .from("users")
    .select("id, store_name, address, latitude, longitude, phone, is_phone_public")
    .eq("id", foodData.seller_id)
    .maybeSingle();

  const isPhonePublic = Boolean(sellerData?.is_phone_public);
  const isOwner =
    authResult.status === "authenticated" && authResult.user?.id === sellerData?.id;
  const isAuthenticated = authResult.status === "authenticated";
  const maskedPhone =
    isAuthenticated && (isPhonePublic || isOwner)
      ? (sellerData?.phone as string | undefined) || null
      : null;

  const sellerProfile: SellerPublicProfile | null = sellerData
    ? {
        id: sellerData.id,
        store_name:
          (sellerData.store_name as string | undefined) ||
          `Sumber Bahan #${sellerData.id.slice(0, 8)}`,
        address: (sellerData.address as string | undefined) || null,
        latitude:
          sellerData.latitude !== null && sellerData.latitude !== undefined
            ? Number(sellerData.latitude)
            : null,
        longitude:
          sellerData.longitude !== null && sellerData.longitude !== undefined
            ? Number(sellerData.longitude)
            : null,
        phone: maskedPhone,
        is_phone_public: isPhonePublic,
        is_location_complete: Boolean(
          sellerData.store_name &&
            sellerData.address &&
            sellerData.latitude !== null &&
            sellerData.longitude !== null
        ),
      }
    : null;

  // Ambil data lokasi buyer jika sudah login (untuk perhitungan jarak penjemputan)
  let buyerLocation: UserLocationData | null = null;
  if (authResult.user?.id) {
    const { data: buyerData } = await supabase
      .from("users")
      .select("address, latitude, longitude")
      .eq("id", authResult.user.id)
      .maybeSingle();

    if (buyerData) {
      buyerLocation = {
        address: (buyerData.address as string | undefined) || null,
        latitude:
          buyerData.latitude !== null && buyerData.latitude !== undefined
            ? Number(buyerData.latitude)
            : null,
        longitude:
          buyerData.longitude !== null && buyerData.longitude !== undefined
            ? Number(buyerData.longitude)
            : null,
      };
    }
  }

  const serverTime = getServerTimestamp();
  const foodItem: FoodItem = {
    ...(foodData as unknown as FoodItem),
    seller_profile: sellerProfile,
  };

  return (
    <FoodDetailClient
      food={foodItem}
      userRole={authResult.role}
      userId={authResult.user?.id || null}
      serverTime={serverTime}
      sellerProfile={sellerProfile}
      buyerLocation={buyerLocation}
    />
  );
}
