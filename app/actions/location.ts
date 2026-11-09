"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserAndRole } from "@/lib/auth/guard";
import { revalidatePath } from "next/cache";
import type { ActionResponse } from "@/lib/types/food";
import { isValidCoordinate } from "@/lib/utils/distance";

export interface UserLocationData {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Server Action: Mengambil data lokasi pengguna terautentikasi dari tabel public.users.
 * Menggunakan kolom address, latitude, dan longitude yang sudah ada.
 */
export async function getUserLocationAction(): Promise<ActionResponse<UserLocationData>> {
  try {
    const authResult = await getAuthenticatedUserAndRole();
    if (authResult.status !== "authenticated" || !authResult.user) {
      return { success: false, error: "Pengguna belum login." };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("users")
      .select("address, latitude, longitude")
      .eq("id", authResult.user.id)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        address: (data?.address as string | undefined) || null,
        latitude: data?.latitude !== null && data?.latitude !== undefined ? Number(data.latitude) : null,
        longitude: data?.longitude !== null && data?.longitude !== undefined ? Number(data.longitude) : null,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengambil data lokasi.",
    };
  }
}

/**
 * Server Action: Memperbarui alamat dan koordinat lokasi pengguna pada tabel public.users.
 * TIDAK membuat kolom baru — memanfaatkan kolom address, latitude, dan longitude eksisting.
 */
export async function updateUserLocationAction(
  address: string,
  latitude?: number | null,
  longitude?: number | null
): Promise<ActionResponse<UserLocationData>> {
  try {
    const authResult = await getAuthenticatedUserAndRole();
    if (authResult.status !== "authenticated" || !authResult.user) {
      return { success: false, error: "Sesi telah berakhir. Silakan login kembali." };
    }

    const trimmedAddress = (address || "").trim();
    if (!trimmedAddress || trimmedAddress.length < 5) {
      return { success: false, error: "Alamat lengkap wajib diisi minimal 5 karakter." };
    }

    const hasLatLon = latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined;
    if (hasLatLon && !isValidCoordinate(latitude, longitude)) {
      return { success: false, error: "Nilai koordinat lintang/bujur tidak valid." };
    }

    const supabase = await createClient();

    const updatePayload: {
      address: string;
      latitude?: number | null;
      longitude?: number | null;
      updated_at?: string;
    } = {
      address: trimmedAddress,
      latitude: hasLatLon ? Number(latitude) : null,
      longitude: hasLatLon ? Number(longitude) : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("users")
      .update(updatePayload)
      .eq("id", authResult.user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/seller");
    revalidatePath("/buyer");
    revalidatePath("/courier");

    return {
      success: true,
      message: "Data lokasi berhasil disimpan.",
      data: {
        address: trimmedAddress,
        latitude: hasLatLon ? Number(latitude) : null,
        longitude: hasLatLon ? Number(longitude) : null,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menyimpan data lokasi.",
    };
  }
}

