"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserAndRole } from "@/lib/auth/guard";
import { revalidatePath } from "next/cache";
import type { ActionResponse, FoodType, PickupMethod, FoodStatus } from "./types";

/**
 * Server Action: Menambahkan makanan berlebih baru ke database Supabase.
 *
 * Menerapkan prinsip Zero-Trust:
 * 1. Verifikasi sesi auth dan role di sisi server.
 * 2. Mengikat `seller_id` secara otoritatif ke `auth.user.id` (tidak mempercayai input browser).
 * 3. Validasi ketat format data, harga, kuantitas, dan kategori.
 */
export async function createFoodAction(
  formData: FormData
): Promise<ActionResponse> {
  try {
    // 1. Verifikasi otentikasi & otorisasi di sisi server
    const authResult = await getAuthenticatedUserAndRole();
    if (authResult.status !== "authenticated" || !authResult.user) {
      return {
        success: false,
        error: "Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.",
      };
    }

    if (authResult.role !== "seller" && authResult.role !== "admin") {
      return {
        success: false,
        error: "Akses ditolak: Hanya mitra penjual atau admin yang dapat menambahkan menu makanan.",
      };
    }

    // 2. Ekstraksi dan sanitasi input dari form
    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const rawCategoryId = Number(formData.get("category_id"));
    const rawType = String(formData.get("type") || "sale").trim() as FoodType;
    const rawPrice = Number(formData.get("price") || 0);
    const rawQuantity = Number(formData.get("quantity") || 0);
    const rawPickupMethod = String(formData.get("pickup_method") || "pickup").trim() as PickupMethod;
    const rawImageUrl = String(formData.get("image_url") || "").trim();

    // 3. Validasi aturan bisnis
    if (!name || name.length < 2) {
      return { success: false, error: "Nama makanan minimal 2 karakter." };
    }
    if (name.length > 100) {
      return { success: false, error: "Nama makanan maksimal 100 karakter." };
    }
    if (!description) {
      return { success: false, error: "Deskripsi makanan wajib diisi." };
    }
    if (isNaN(rawCategoryId) || rawCategoryId <= 0) {
      return { success: false, error: "Pilih kategori makanan yang sah." };
    }

    const type: FoodType = rawType === "donation" ? "donation" : "sale";
    const price = type === "donation" ? 0 : Math.max(0, rawPrice);

    if (type === "sale" && price <= 0) {
      return { success: false, error: "Harga makanan untuk menu komersial harus lebih dari Rp 0." };
    }

    const quantity = Math.floor(rawQuantity);
    if (quantity <= 0) {
      return { success: false, error: "Jumlah porsi makanan minimal 1 porsi." };
    }

    const validPickupMethods: PickupMethod[] = ["pickup", "delivery", "both"];
    const pickupMethod: PickupMethod = validPickupMethods.includes(rawPickupMethod)
      ? rawPickupMethod
      : "pickup";

    // Validasi URL gambar sederhana jika diisi
    let imageUrl: string | null = null;
    if (rawImageUrl) {
      if (rawImageUrl.startsWith("http://") || rawImageUrl.startsWith("https://")) {
        imageUrl = rawImageUrl;
      } else {
        return { success: false, error: "URL gambar harus diawali dengan http:// atau https://" };
      }
    }

    // Waktu ketersediaan: mulai sekarang sampai 24 jam ke depan
    const now = new Date();
    const until = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // 4. Eksekusi ke database Supabase
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("foods")
      .insert({
        seller_id: authResult.user.id, // Otoritatif dari sesi terotentikasi!
        category_id: rawCategoryId,
        name,
        description,
        price,
        quantity,
        type,
        pickup_method: pickupMethod,
        image_url: imageUrl,
        status: "available",
        available_from: now.toISOString(),
        available_until: until.toISOString(),
      })
      .select("id, name")
      .single();

    if (error) {
      if (error.code === "42501") {
        return {
          success: false,
          error: "Izin ditolak oleh database (RLS). Pastikan akun Anda telah memiliki role 'seller' di database.",
        };
      }
      return {
        success: false,
        error: `Gagal menyimpan makanan: ${error.message}`,
      };
    }

    // 5. Segarkan cache Next.js
    revalidatePath("/seller");
    revalidatePath("/");

    return {
      success: true,
      message: `Menu "${data.name}" berhasil ditambahkan ke inventaris!`,
      data,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem saat menyimpan makanan.",
    };
  }
}

/**
 * Server Action: Memperbarui data makanan yang sudah ada.
 */
export async function updateFoodAction(
  foodId: number,
  formData: FormData
): Promise<ActionResponse> {
  try {
    const authResult = await getAuthenticatedUserAndRole();
    if (authResult.status !== "authenticated" || !authResult.user) {
      return { success: false, error: "Sesi tidak valid. Silakan login kembali." };
    }

    if (authResult.role !== "seller" && authResult.role !== "admin") {
      return { success: false, error: "Akses ditolak: Anda tidak memiliki izin mengedit makanan ini." };
    }

    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const rawCategoryId = Number(formData.get("category_id"));
    const rawType = String(formData.get("type") || "sale").trim() as FoodType;
    const rawPrice = Number(formData.get("price") || 0);
    const rawQuantity = Number(formData.get("quantity") || 0);
    const rawPickupMethod = String(formData.get("pickup_method") || "pickup").trim() as PickupMethod;
    const rawImageUrl = String(formData.get("image_url") || "").trim();

    if (!name || name.length < 2) {
      return { success: false, error: "Nama makanan minimal 2 karakter." };
    }
    if (!description) {
      return { success: false, error: "Deskripsi makanan wajib diisi." };
    }
    if (isNaN(rawCategoryId) || rawCategoryId <= 0) {
      return { success: false, error: "Pilih kategori makanan yang sah." };
    }

    const type: FoodType = rawType === "donation" ? "donation" : "sale";
    const price = type === "donation" ? 0 : Math.max(0, rawPrice);
    const quantity = Math.max(0, Math.floor(rawQuantity));

    const validPickupMethods: PickupMethod[] = ["pickup", "delivery", "both"];
    const pickupMethod: PickupMethod = validPickupMethods.includes(rawPickupMethod)
      ? rawPickupMethod
      : "pickup";

    let imageUrl: string | null = null;
    if (rawImageUrl) {
      if (rawImageUrl.startsWith("http://") || rawImageUrl.startsWith("https://")) {
        imageUrl = rawImageUrl;
      } else {
        return { success: false, error: "URL gambar harus diawali dengan http:// atau https://" };
      }
    }

    const supabase = await createClient();

    // Query builder dengan pembatasan kepemilikan data (kecuali admin)
    let query = supabase
      .from("foods")
      .update({
        name,
        description,
        category_id: rawCategoryId,
        price,
        quantity,
        type,
        pickup_method: pickupMethod,
        image_url: imageUrl,
      })
      .eq("id", foodId);

    if (authResult.role !== "admin") {
      query = query.eq("seller_id", authResult.user.id);
    }

    const { error } = await query;

    if (error) {
      if (error.code === "42501") {
        return {
          success: false,
          error: "Akses ditolak: Anda hanya dapat mengubah makanan milik toko Anda sendiri.",
        };
      }
      return { success: false, error: `Gagal memperbarui makanan: ${error.message}` };
    }

    revalidatePath("/seller");
    revalidatePath("/");

    return {
      success: true,
      message: "Data menu makanan berhasil diperbarui!",
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem saat memperbarui data.",
    };
  }
}

/**
 * Server Action: Mengubah status ketersediaan makanan (Tersedia / Habis).
 */
export async function toggleFoodStatusAction(
  foodId: number,
  currentStatus: FoodStatus
): Promise<ActionResponse> {
  try {
    const authResult = await getAuthenticatedUserAndRole();
    if (authResult.status !== "authenticated" || !authResult.user) {
      return { success: false, error: "Sesi tidak valid. Silakan login kembali." };
    }

    const newStatus: FoodStatus = currentStatus === "available" ? "sold_out" : "available";

    const supabase = await createClient();

    let query = supabase
      .from("foods")
      .update({ status: newStatus })
      .eq("id", foodId);

    if (authResult.role !== "admin") {
      query = query.eq("seller_id", authResult.user.id);
    }

    const { error } = await query;

    if (error) {
      return {
        success: false,
        error: `Gagal mengubah status: ${error.message}`,
      };
    }

    revalidatePath("/seller");
    revalidatePath("/");

    return {
      success: true,
      message: `Status menu berhasil diubah menjadi ${newStatus === "available" ? "Tersedia" : "Habis"}!`,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengubah status menu.",
    };
  }
}

/**
 * Server Action: Menghapus makanan dari inventaris.
 */
export async function deleteFoodAction(foodId: number): Promise<ActionResponse> {
  try {
    const authResult = await getAuthenticatedUserAndRole();
    if (authResult.status !== "authenticated" || !authResult.user) {
      return { success: false, error: "Sesi tidak valid. Silakan login kembali." };
    }

    const supabase = await createClient();

    let query = supabase.from("foods").delete().eq("id", foodId);

    if (authResult.role !== "admin") {
      query = query.eq("seller_id", authResult.user.id);
    }

    const { error } = await query;

    if (error) {
      return {
        success: false,
        error: `Gagal menghapus menu: ${error.message}`,
      };
    }

    revalidatePath("/seller");
    revalidatePath("/");

    return {
      success: true,
      message: "Menu makanan berhasil dihapus dari inventaris.",
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menghapus menu makanan.",
    };
  }
}
