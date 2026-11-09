"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserAndRole } from "@/lib/auth/guard";
import { revalidatePath } from "next/cache";
import type { ActionResponse, SellerPublicProfile } from "@/lib/types/food";
import { isValidCoordinate } from "@/lib/utils/distance";

export interface UserLocationData {
  store_name?: string | null;
  phone?: string | null;
  is_phone_public?: boolean;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  is_location_complete?: boolean;
}

/**
 * Server Action: Mengambil data lokasi dan profil toko pengguna terautentikasi.
 * Menggunakan tabel public.users.
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
      .select("store_name, phone, is_phone_public, address, latitude, longitude")
      .eq("id", authResult.user.id)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    const storeName = (data?.store_name as string | undefined) || null;
    const phone = (data?.phone as string | undefined) || null;
    const isPhonePublic = Boolean(data?.is_phone_public);
    const address = (data?.address as string | undefined) || null;
    const latitude =
      data?.latitude !== null && data?.latitude !== undefined
        ? Number(data.latitude)
        : null;
    const longitude =
      data?.longitude !== null && data?.longitude !== undefined
        ? Number(data.longitude)
        : null;

    const isComplete = Boolean(
      storeName && address && latitude !== null && longitude !== null
    );

    return {
      success: true,
      data: {
        store_name: storeName,
        phone,
        is_phone_public: isPhonePublic,
        address,
        latitude,
        longitude,
        is_location_complete: isComplete,
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

    const hasLatLon =
      latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined;
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
    revalidatePath("/");

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

/**
 * Server Action: Menyimpan profil lengkap toko & lokasi penjemputan Seller.
 * Fitur Wajib W6: Nama toko, nomor kontak, alamat lengkap, dan koordinat GPS.
 */
export async function updateStoreProfileAction(data: {
  store_name: string;
  phone?: string | null;
  is_phone_public?: boolean;
  address: string;
  latitude: number | null;
  longitude: number | null;
}): Promise<ActionResponse<UserLocationData>> {
  try {
    const authResult = await getAuthenticatedUserAndRole();
    if (authResult.status !== "authenticated" || !authResult.user) {
      return { success: false, error: "Sesi telah berakhir. Silakan login kembali." };
    }

    const storeName = (data.store_name || "").trim();
    if (!storeName || storeName.length < 3) {
      return { success: false, error: "Nama toko/usaha sumber bahan minimal 3 karakter." };
    }

    const address = (data.address || "").trim();
    if (!address || address.length < 8) {
      return {
        success: false,
        error: "Alamat lengkap penjemputan wajib diisi detail (minimal 8 karakter).",
      };
    }

    if (
      data.latitude === null ||
      data.latitude === undefined ||
      data.longitude === null ||
      data.longitude === undefined ||
      !isValidCoordinate(data.latitude, data.longitude)
    ) {
      return {
        success: false,
        error:
          "Koordinat lokasi GPS (latitude & longitude) wajib diisi valid untuk peta penjemputan buyer.",
      };
    }

    const phone = (data.phone || "").trim() || null;
    const isPhonePublic = Boolean(data.is_phone_public);
    const supabase = await createClient();

    const updatePayload = {
      store_name: storeName,
      phone,
      is_phone_public: isPhonePublic,
      address,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
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
    revalidatePath("/");

    return {
      success: true,
      message: "Profil toko dan titik penjemputan berhasil diperbarui.",
      data: {
        store_name: storeName,
        phone,
        is_phone_public: isPhonePublic,
        address,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        is_location_complete: true,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menyimpan profil toko.",
    };
  }
}

/**
 * Server Action: Mengambil profil publik seller berdasarkan sellerId secara aman.
 * Menjamin tidak membocorkan email, auth metadata, atau informasi sensitif.
 * Zero-Trust: Nomor telepon disembunyikan kecuali buyer terautentikasi dan seller memberikan izin (is_phone_public).
 */
export async function getSellerPublicProfileAction(
  sellerId: string
): Promise<ActionResponse<SellerPublicProfile>> {
  try {
    if (!sellerId) {
      return { success: false, error: "ID seller tidak valid." };
    }

    const authResult = await getAuthenticatedUserAndRole();
    const currentUserId = authResult.status === "authenticated" ? authResult.user?.id : null;

    const supabase = await createClient();

    // Query hanya kolom publik yang aman dari users
    const { data, error } = await supabase
      .from("users")
      .select("id, store_name, address, latitude, longitude, phone, is_phone_public")
      .eq("id", sellerId)
      .maybeSingle();

    if (error || !data) {
      return {
        success: false,
        error: "Data profil penjual / sumber bahan tidak ditemukan.",
      };
    }

    const storeName =
      (data.store_name as string | undefined) ||
      `Sumber Bahan #${data.id.slice(0, 8)}`;
    const address = (data.address as string | undefined) || null;
    const latitude =
      data.latitude !== null && data.latitude !== undefined
        ? Number(data.latitude)
        : null;
    const longitude =
      data.longitude !== null && data.longitude !== undefined
        ? Number(data.longitude)
        : null;

    const isPhonePublic = Boolean(data.is_phone_public);
    // Zero-Trust Masking: hanya terbuka untuk caller terautentikasi jika seller set is_phone_public = true atau caller adalah seller itu sendiri
    const rawPhone = (data.phone as string | undefined) || null;
    const phone =
      currentUserId && (isPhonePublic || currentUserId === data.id)
        ? rawPhone
        : null;

    const isComplete = Boolean(
      data.store_name && address && latitude !== null && longitude !== null
    );

    return {
      success: true,
      data: {
        id: data.id,
        store_name: storeName,
        address,
        latitude,
        longitude,
        phone,
        is_phone_public: isPhonePublic,
        is_location_complete: isComplete,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengambil profil seller.",
    };
  }
}
