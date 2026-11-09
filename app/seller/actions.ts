"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserAndRole } from "@/lib/auth/guard";
import { revalidatePath } from "next/cache";
import type { ActionResponse, FoodType, PickupMethod, FoodStatus, FoodItem } from "./types";

/**
 * Server Action: Menambahkan makanan berlebih baru ke database Supabase.
 *
 * Menerapkan prinsip Zero-Trust:
 * 1. Verifikasi sesi auth dan role di sisi server (seller / admin).
 * 2. Mengikat `seller_id` secara otoritatif ke `auth.user.id` (tidak mempercayai input browser).
 * 3. Validasi ketat format data, harga, kuantitas, kategori, dan waktu ketersediaan.
 * 4. Mendukung upload foto ke Supabase Storage bucket 'foods' dengan validasi file (JPG/PNG/WebP, max 2MB).
 * 5. Fail-safe ramah pengguna jika bucket Storage belum dikonfigurasi di Supabase.
 */
export async function createFoodAction(
  formData: FormData
): Promise<ActionResponse<FoodItem>> {
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
    const rawAvailableFrom = String(formData.get("available_from") || "").trim();
    const rawAvailableUntil = String(formData.get("available_until") || "").trim();
    const rawUnit = String(formData.get("unit") || "kg").trim();
    const rawCondition = String(formData.get("condition") || "layak").trim();
    const rawTargetLivestock = String(formData.get("target_livestock") || "Semua Ternak").trim();
    const rawStorageInstructions = String(formData.get("storage_instructions") || "").trim();
    const rawCollectedAt = String(formData.get("collected_at") || "").trim();
    const imageFile = formData.get("image_file");

    // 3. Validasi profil toko & kelengkapan lokasi usaha seller (Fitur Wajib W6)
    const supabase = await createClient();
    const { data: sellerProfile } = await supabase
      .from("users")
      .select("store_name, address, latitude, longitude")
      .eq("id", authResult.user.id)
      .maybeSingle();

    if (
      !sellerProfile?.store_name ||
      !sellerProfile?.address ||
      sellerProfile.latitude === null ||
      sellerProfile.latitude === undefined ||
      sellerProfile.longitude === null ||
      sellerProfile.longitude === undefined
    ) {
      return {
        success: false,
        error:
          "Profil Toko & Lokasi Penjemputan belum lengkap. Anda wajib melengkapi Nama Toko, Alamat Lengkap, dan Koordinat GPS di menu 'Profil Toko' sebelum menerbitkan listing bahan pakan.",
      };
    }

    // 4. Validasi aturan bisnis bahan pakan
    if (!name || name.length < 2) {
      return { success: false, error: "Nama bahan pakan minimal 2 karakter." };
    }
    if (name.length > 100) {
      return { success: false, error: "Nama bahan pakan maksimal 100 karakter." };
    }
    if (!description) {
      return { success: false, error: "Deskripsi bahan pakan dan peruntukannya wajib diisi." };
    }
    if (isNaN(rawCategoryId) || rawCategoryId <= 0) {
      return { success: false, error: "Pilih kategori bahan pakan yang sah." };
    }

    const type: FoodType = rawType === "donation" ? "donation" : "sale";
    const price = type === "donation" ? 0 : Math.max(0, rawPrice);

    if (type === "sale" && price <= 0) {
      return { success: false, error: "Harga bahan pakan komersial harus lebih dari Rp 0." };
    }

    const quantity = Math.floor(rawQuantity);
    if (quantity <= 0) {
      return { success: false, error: "Jumlah bahan pakan minimal 1 (bilangan bulat positif)." };
    }

    const unit = rawUnit || "kg";
    const validConditions = ["layak", "segar", "fermentasi", "kering", "basah", "afkir"];
    const condition = validConditions.includes(rawCondition) ? rawCondition : "layak";
    const targetLivestock = rawTargetLivestock || "Semua Ternak";
    const storageInstructions = rawStorageInstructions || null;
    const collectedAt = rawCollectedAt ? new Date(rawCollectedAt).toISOString() : new Date().toISOString();

    const validPickupMethods: PickupMethod[] = ["pickup", "delivery", "both"];
    const pickupMethod: PickupMethod = validPickupMethods.includes(rawPickupMethod)
      ? rawPickupMethod
      : "pickup";

    // Validasi waktu ketersediaan (available_from dan available_until)
    let availableFrom: Date;
    if (rawAvailableFrom) {
      const parsed = new Date(rawAvailableFrom);
      if (isNaN(parsed.getTime())) {
        return { success: false, error: "Format waktu mulai ketersediaan tidak valid." };
      }
      availableFrom = parsed;
    } else {
      availableFrom = new Date();
    }

    let availableUntil: Date;
    if (rawAvailableUntil) {
      const parsed = new Date(rawAvailableUntil);
      if (isNaN(parsed.getTime())) {
        return { success: false, error: "Format batas waktu ketersediaan tidak valid." };
      }
      availableUntil = parsed;
    } else {
      // Default: 24 jam ke depan dari waktu mulai
      availableUntil = new Date(availableFrom.getTime() + 24 * 60 * 60 * 1000);
    }

    if (availableUntil.getTime() <= availableFrom.getTime()) {
      return {
        success: false,
        error: "Batas waktu ketersediaan (available_until) harus lebih lambat dari waktu mulai ketersediaan.",
      };
    }

    // 4. Penanganan Gambar: Upload file ke Storage atau simpan URL
    let imageUrl: string | null = null;

    if (imageFile instanceof File && imageFile.size > 0) {
      // Validasi tipe file
      const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
      if (!allowedMimeTypes.includes(imageFile.type)) {
        return {
          success: false,
          error: "Format file gambar tidak didukung. Harap gunakan format JPG, PNG, atau WebP.",
        };
      }

      // Validasi ukuran file (maksimal 2MB)
      const MAX_FILE_SIZE = 2 * 1024 * 1024;
      if (imageFile.size > MAX_FILE_SIZE) {
        return {
          success: false,
          error: "Ukuran file gambar melebihi batas maksimal 2MB.",
        };
      }

      // Upload file ke bucket 'foods'
      const fileExt = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${authResult.user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from("foods")
        .upload(fileName, buffer, {
          contentType: imageFile.type,
          upsert: false,
        });

      if (uploadError) {
        const errorMsg = uploadError.message || "";
        if (
          errorMsg.toLowerCase().includes("bucket not found") ||
          (uploadError as unknown as { statusCode?: string }).statusCode === "404" ||
          (uploadError as unknown as { code?: string }).code === "NoSuchBucket"
        ) {
          return {
            success: false,
            error:
              "Bucket Supabase Storage ('foods') belum tersedia di database. Silakan gunakan opsi URL Gambar atau hubungi administrator untuk membuat bucket 'foods'.",
          };
        }

        return {
          success: false,
          error: `Gagal mengunggah foto ke storage: ${uploadError.message}`,
        };
      }

      const { data: publicUrlData } = supabase.storage
        .from("foods")
        .getPublicUrl(fileName);

      imageUrl = publicUrlData.publicUrl;
    } else if (rawImageUrl) {
      if (rawImageUrl.startsWith("http://") || rawImageUrl.startsWith("https://")) {
        imageUrl = rawImageUrl;
      } else {
        return { success: false, error: "URL gambar harus diawali dengan http:// atau https://" };
      }
    }

    // 5. Eksekusi INSERT ke database Supabase
    const { data, error } = await supabase
      .from("foods")
      .insert({
        seller_id: authResult.user.id, // Otoritatif dari sesi terotentikasi!
        category_id: rawCategoryId,
        name,
        description,
        price,
        quantity,
        unit,
        type,
        condition,
        target_livestock: targetLivestock,
        storage_instructions: storageInstructions,
        collected_at: collectedAt,
        pickup_method: pickupMethod,
        image_url: imageUrl,
        status: "available",
        available_from: availableFrom.toISOString(),
        available_until: availableUntil.toISOString(),
      })
      .select("*, categories(name)")
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

    // 6. Segarkan cache Next.js
    revalidatePath("/seller");
    revalidatePath("/");

    return {
      success: true,
      message: `Menu "${data.name}" berhasil ditambahkan ke inventaris!`,
      data: data as FoodItem,
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
): Promise<ActionResponse<FoodItem>> {
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
    const rawAvailableFrom = String(formData.get("available_from") || "").trim();
    const rawAvailableUntil = String(formData.get("available_until") || "").trim();
    const rawUnit = String(formData.get("unit") || "kg").trim();
    const rawCondition = String(formData.get("condition") || "layak").trim();
    const rawTargetLivestock = String(formData.get("target_livestock") || "Semua Ternak").trim();
    const rawStorageInstructions = String(formData.get("storage_instructions") || "").trim();
    const rawCollectedAt = String(formData.get("collected_at") || "").trim();
    const imageFile = formData.get("image_file");

    if (!name || name.length < 2) {
      return { success: false, error: "Nama bahan pakan minimal 2 karakter." };
    }
    if (!description) {
      return { success: false, error: "Deskripsi bahan pakan dan peruntukannya wajib diisi." };
    }
    if (isNaN(rawCategoryId) || rawCategoryId <= 0) {
      return { success: false, error: "Pilih kategori bahan pakan yang sah." };
    }

    const type: FoodType = rawType === "donation" ? "donation" : "sale";
    const price = type === "donation" ? 0 : Math.max(0, rawPrice);
    const quantity = Math.max(0, Math.floor(rawQuantity));
    const unit = rawUnit || "kg";
    const validConditions = ["layak", "segar", "fermentasi", "kering", "basah", "afkir"];
    const condition = validConditions.includes(rawCondition) ? rawCondition : "layak";
    const targetLivestock = rawTargetLivestock || "Semua Ternak";
    const storageInstructions = rawStorageInstructions || null;

    const validPickupMethods: PickupMethod[] = ["pickup", "delivery", "both"];
    const pickupMethod: PickupMethod = validPickupMethods.includes(rawPickupMethod)
      ? rawPickupMethod
      : "pickup";

    const supabase = await createClient();

    let imageUrl: string | null = null;
    if (imageFile instanceof File && imageFile.size > 0) {
      const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
      if (!allowedMimeTypes.includes(imageFile.type)) {
        return {
          success: false,
          error: "Format file gambar tidak didukung. Harap gunakan format JPG, PNG, atau WebP.",
        };
      }

      const MAX_FILE_SIZE = 2 * 1024 * 1024;
      if (imageFile.size > MAX_FILE_SIZE) {
        return { success: false, error: "Ukuran file gambar melebihi batas maksimal 2MB." };
      }

      const fileExt = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${authResult.user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from("foods")
        .upload(fileName, buffer, { contentType: imageFile.type, upsert: false });

      if (uploadError) {
        return {
          success: false,
          error: `Gagal mengunggah foto ke storage: ${uploadError.message}`,
        };
      }

      const { data: publicUrlData } = supabase.storage.from("foods").getPublicUrl(fileName);
      imageUrl = publicUrlData.publicUrl;
    } else if (rawImageUrl) {
      if (rawImageUrl.startsWith("http://") || rawImageUrl.startsWith("https://")) {
        imageUrl = rawImageUrl;
      } else {
        return { success: false, error: "URL gambar harus diawali dengan http:// atau https://" };
      }
    }

    const updatePayload: Record<string, unknown> = {
      name,
      description,
      category_id: rawCategoryId,
      price,
      quantity,
      unit,
      condition,
      target_livestock: targetLivestock,
      storage_instructions: storageInstructions,
      type,
      pickup_method: pickupMethod,
    };

    if (rawCollectedAt) {
      const parsedCollected = new Date(rawCollectedAt);
      if (!isNaN(parsedCollected.getTime())) {
        updatePayload.collected_at = parsedCollected.toISOString();
      }
    }

    if (imageUrl !== null || rawImageUrl === "") {
      updatePayload.image_url = imageUrl;
    }

    if (rawAvailableFrom) {
      const parsedFrom = new Date(rawAvailableFrom);
      if (!isNaN(parsedFrom.getTime())) {
        updatePayload.available_from = parsedFrom.toISOString();
      }
    }

    if (rawAvailableUntil) {
      const parsedUntil = new Date(rawAvailableUntil);
      if (!isNaN(parsedUntil.getTime())) {
        updatePayload.available_until = parsedUntil.toISOString();
      }
    }

    // Query builder dengan pembatasan kepemilikan data (kecuali admin)
    let query = supabase
      .from("foods")
      .update(updatePayload)
      .eq("id", foodId);

    if (authResult.role !== "admin") {
      query = query.eq("seller_id", authResult.user.id);
    }

    const { data: updatedData, error } = await query
      .select("*, categories(name)")
      .single();

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
      data: updatedData as FoodItem,
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
