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

  // Ambil profil publik toko seller untuk titik penjemputan via seller_public_profiles View
  // (atau RPC get_seller_public_profile) untuk menjamin data terbaca tanpa terhalang RLS public.users
  let sellerProfile: SellerPublicProfile | null = null;

  if (foodData.seller_id) {
    const { data: viewData, error: viewError } = await supabase
      .from("seller_public_profiles")
      .select("id, store_name, address, latitude, longitude, phone, is_phone_public, is_location_complete")
      .eq("id", foodData.seller_id)
      .maybeSingle();

    if (!viewError && viewData) {
      sellerProfile = {
        id: viewData.id,
        store_name:
          viewData.store_name || `Sumber Bahan #${viewData.id.slice(0, 8)}`,
        address: viewData.address || null,
        latitude:
          viewData.latitude !== null && viewData.latitude !== undefined
            ? Number(viewData.latitude)
            : null,
        longitude:
          viewData.longitude !== null && viewData.longitude !== undefined
            ? Number(viewData.longitude)
            : null,
        phone: viewData.phone || null,
        is_phone_public: Boolean(viewData.is_phone_public),
        is_location_complete: Boolean(viewData.is_location_complete),
      };
    } else {
      // Fallback: RPC get_seller_public_profile
      const { data: rpcData } = await supabase.rpc("get_seller_public_profile", {
        p_seller_id: foodData.seller_id,
      });

      if (rpcData && typeof rpcData === "object" && "id" in rpcData) {
        const raw = rpcData as unknown as SellerPublicProfile;
        sellerProfile = {
          id: raw.id,
          store_name:
            raw.store_name || `Sumber Bahan #${raw.id.slice(0, 8)}`,
          address: raw.address || null,
          latitude:
            raw.latitude !== null && raw.latitude !== undefined
              ? Number(raw.latitude)
              : null,
          longitude:
            raw.longitude !== null && raw.longitude !== undefined
              ? Number(raw.longitude)
              : null,
          phone: raw.phone || null,
          is_phone_public: Boolean(raw.is_phone_public),
          is_location_complete: Boolean(raw.is_location_complete),
        };
      }
    }
  }

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
