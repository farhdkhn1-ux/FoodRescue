"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserAndRole } from "@/lib/auth/guard";
import { revalidatePath } from "next/cache";
import type { ActionResponse, Order, OrderStatus } from "@/lib/types/food";

export interface CreateOrderInput {
  foodId: number;
  quantity: number;
  pickupMethod: "pickup" | "delivery";
  shippingAddress?: string | null;
}

interface RawOrderItem {
  id: number;
  food_id: number;
  seller_id: string;
  quantity: number;
  price: number;
  subtotal: number;
  foods?: {
    id: number;
    name: string;
    image_url: string | null;
    type: "sale" | "donation";
    pickup_method: "pickup" | "delivery" | "both";
    categories?: { name: string } | null;
  } | null;
}

interface RawOrder {
  id: number;
  buyer_id: string;
  total_amount: number | string;
  status: string;
  pickup_method: "pickup" | "delivery";
  shipping_address: string | null;
  created_at: string;
  updated_at: string;
  order_items?: RawOrderItem[];
}

/**
 * Memetakan error PostgreSQL / Supabase RPC ke pesan ramah pengguna.
 */
function mapDatabaseError(error: { code?: string; message: string }): string {
  const msg = error.message || "";

  if (error.code === "PGRST202" || msg.includes("Could not find the function")) {
    return "Fungsi transaksi pesanan belum aktif di database Supabase. Jalankan skema migrasi '20261023_w4_order_atomic.sql' di Supabase SQL Editor.";
  }

  if (error.code === "28000" || msg.includes("UNAUTHENTICATED")) {
    return "Sesi login Anda telah berakhir. Silakan login kembali.";
  }

  if (error.code === "42501" || msg.includes("FORBIDDEN")) {
    if (msg.includes("Penjual dilarang membeli produk makanan miliknya sendiri")) {
      return "Anda tidak dapat memesan makanan dari toko Anda sendiri.";
    }
    if (msg.includes("Pesanan yang telah dikonfirmasi penjual tidak dapat dibatalkan oleh pembeli")) {
      return "Pesanan yang sudah dikonfirmasi penjual tidak dapat dibatalkan sepihak oleh pembeli.";
    }
    return "Akses ditolak: Anda tidak memiliki wewenang untuk melakukan aksi ini.";
  }

  if (error.code === "23514" || msg.includes("CONFLICT")) {
    if (msg.includes("Stok tidak mencukupi") || msg.includes("melebihi sisa stok")) {
      return msg.replace(/^.*?CONFLICT:\s*/, "");
    }
    if (msg.includes("Makanan sudah melewati batas waktu ketersediaan")) {
      return "Waktu ketersediaan menu makanan ini telah berakhir.";
    }
    if (msg.includes("sudah dibatalkan sebelumnya")) {
      return "Pesanan ini sudah dibatalkan sebelumnya.";
    }
    if (msg.includes("sudah selesai tidak dapat dibatalkan")) {
      return "Pesanan yang sudah selesai tidak dapat dibatalkan.";
    }
    return msg.replace(/^.*?CONFLICT:\s*/, "");
  }

  if (error.code === "22023" || msg.includes("INVALID_ARGUMENT")) {
    return msg.replace(/^.*?INVALID_ARGUMENT:\s*/, "");
  }

  if (error.code === "P0002" || msg.includes("NOT_FOUND")) {
    return "Data makanan atau pesanan tidak ditemukan.";
  }

  return msg || "Terjadi kesalahan pada sistem saat memproses transaksi.";
}

/**
 * Server Action: Membuat Pesanan Atomik (create_order_atomic)
 *
 * Menerapkan prinsip Zero-Trust:
 * 1. Verifikasi sesi auth dan role di sisi server (buyer / admin).
 * 2. Memanggil RPC PostgreSQL yang mengeksekusi penguncian baris (FOR UPDATE),
 *    validasi stok, pengurangan stok, dan insert atomik.
 */
export async function createOrderAction(
  input: CreateOrderInput
): Promise<ActionResponse<{ orderId: number; totalAmount: number; status: string }>> {
  try {
    const authResult = await getAuthenticatedUserAndRole();
    if (authResult.status !== "authenticated" || !authResult.user) {
      return {
        success: false,
        error: "Sesi tidak valid atau telah berakhir. Silakan login terlebih dahulu.",
      };
    }

    if (authResult.role !== "buyer" && authResult.role !== "admin") {
      return {
        success: false,
        error: "Akses ditolak: Hanya akun pembeli yang dapat melakukan pemesanan makanan.",
      };
    }

    // Validasi parameter di sisi server
    const foodId = Number(input.foodId);
    const quantity = Math.floor(Number(input.quantity));
    const pickupMethod = input.pickupMethod;
    const shippingAddress = (input.shippingAddress || "").trim();

    if (isNaN(foodId) || foodId <= 0) {
      return { success: false, error: "ID makanan tidak valid." };
    }

    if (isNaN(quantity) || quantity <= 0) {
      return { success: false, error: "Jumlah porsi makanan minimal 1 porsi." };
    }

    if (pickupMethod !== "pickup" && pickupMethod !== "delivery") {
      return { success: false, error: "Metode pengambilan harus 'pickup' atau 'delivery'." };
    }

    if (pickupMethod === "delivery" && (!shippingAddress || shippingAddress.length < 5)) {
      return {
        success: false,
        error: "Alamat pengiriman lengkap wajib diisi untuk metode delivery (minimal 5 karakter).",
      };
    }

    const supabase = await createClient();

    // Panggil RPC create_order_atomic yang dieksekusi secara atomik di database
    const { data, error } = await supabase.rpc("create_order_atomic", {
      p_food_id: foodId,
      p_quantity: quantity,
      p_pickup_method: pickupMethod,
      p_shipping_address: pickupMethod === "delivery" ? shippingAddress : null,
    });

    if (error) {
      return {
        success: false,
        error: mapDatabaseError(error),
      };
    }

    const result = data as {
      success: boolean;
      order_id: number;
      total_amount: number;
      status: string;
    };

    // Revalidasi cache halaman terkait
    revalidatePath(`/food/${foodId}`);
    revalidatePath("/");
    revalidatePath("/buyer");
    revalidatePath("/seller");

    return {
      success: true,
      message: "Pesanan berhasil diajukan! Penjual akan segera mengonfirmasi pesanan Anda.",
      data: {
        orderId: result.order_id,
        totalAmount: result.total_amount,
        status: result.status,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan internal saat membuat pesanan.",
    };
  }
}

/**
 * Server Action: Membatalkan Pesanan Atomik (cancel_order_atomic)
 *
 * Mendukung pemulihan stok atomik:
 * - Pembeli hanya dapat membatalkan pesanan 'pending'.
 * - Penjual/Admin dapat membatalkan dengan opsi p_restock (apakah stok fisik masih layak).
 */
export async function cancelOrderAction(
  orderId: number,
  reason: string = "Dibatalkan oleh pengguna",
  restock: boolean = true
): Promise<ActionResponse<{ orderId: number; status: string }>> {
  try {
    const authResult = await getAuthenticatedUserAndRole();
    if (authResult.status !== "authenticated" || !authResult.user) {
      return {
        success: false,
        error: "Sesi telah berakhir. Silakan login kembali.",
      };
    }

    const parsedOrderId = Number(orderId);
    if (isNaN(parsedOrderId) || parsedOrderId <= 0) {
      return { success: false, error: "ID pesanan tidak valid." };
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc("cancel_order_atomic", {
      p_order_id: parsedOrderId,
      p_reason: reason.trim() || "Dibatalkan",
      p_restock: Boolean(restock),
    });

    if (error) {
      return {
        success: false,
        error: mapDatabaseError(error),
      };
    }

    const result = data as { success: boolean; order_id: number; status: string };

    revalidatePath("/buyer");
    revalidatePath("/seller");
    revalidatePath("/");

    return {
      success: true,
      message: "Pesanan berhasil dibatalkan dan stok telah diperbarui.",
      data: {
        orderId: result.order_id,
        status: result.status,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal membatalkan pesanan.",
    };
  }
}

/**
 * Server Action: Memperbarui Status Pesanan (update_order_status)
 *
 * Menegakkan matriks transisi status yang sah:
 * - pending -> confirmed (Hanya Penjual / Admin)
 * - confirmed -> completed (Penjual / Admin setelah serah-terima fisik)
 */
export async function updateOrderStatusAction(
  orderId: number,
  targetStatus: "confirmed" | "completed"
): Promise<ActionResponse<{ orderId: number; status: OrderStatus }>> {
  try {
    const authResult = await getAuthenticatedUserAndRole();
    if (authResult.status !== "authenticated" || !authResult.user) {
      return {
        success: false,
        error: "Sesi telah berakhir. Silakan login kembali.",
      };
    }

    const parsedOrderId = Number(orderId);
    if (isNaN(parsedOrderId) || parsedOrderId <= 0) {
      return { success: false, error: "ID pesanan tidak valid." };
    }

    if (targetStatus !== "confirmed" && targetStatus !== "completed") {
      return { success: false, error: "Status target tidak valid." };
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc("update_order_status", {
      p_order_id: parsedOrderId,
      p_target_status: targetStatus,
    });

    if (error) {
      return {
        success: false,
        error: mapDatabaseError(error),
      };
    }

    const result = data as { success: boolean; order_id: number; status: OrderStatus };

    revalidatePath("/seller");
    revalidatePath("/buyer");

    const statusLabel = targetStatus === "confirmed" ? "dikonfirmasi" : "diselesaikan";

    return {
      success: true,
      message: `Pesanan #${orderId} berhasil ${statusLabel}!`,
      data: {
        orderId: result.order_id,
        status: result.status,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memperbarui status pesanan.",
    };
  }
}

/**
 * Server Action: Mengambil riwayat pesanan milik pembeli yang aktif.
 */
export async function getBuyerOrdersAction(): Promise<ActionResponse<Order[]>> {
  try {
    const authResult = await getAuthenticatedUserAndRole();
    if (authResult.status !== "authenticated" || !authResult.user) {
      return { success: false, error: "Pengguna belum login.", data: [] };
    }

    const supabase = await createClient();

    // Mengambil pesanan buyer beserta order_items dan relasi makanan
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        buyer_id,
        total_amount,
        status,
        pickup_method,
        shipping_address,
        created_at,
        updated_at,
        order_items (
          id,
          food_id,
          seller_id,
          quantity,
          price,
          subtotal,
          foods (
            id,
            name,
            image_url,
            type,
            pickup_method,
            categories (name)
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: mapDatabaseError(error), data: [] };
    }

    // Transformasi data agar sesuai dengan interface Order
    const orders: Order[] = ((data as unknown as RawOrder[]) || []).map((raw: RawOrder) => ({
      id: raw.id,
      buyer_id: raw.buyer_id,
      total_amount: Number(raw.total_amount),
      status: raw.status as OrderStatus,
      pickup_method: raw.pickup_method,
      shipping_address: raw.shipping_address,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
      order_items: (raw.order_items || []).map((item: RawOrderItem) => ({
        id: item.id,
        order_id: raw.id,
        food_id: item.food_id,
        seller_id: item.seller_id,
        quantity: item.quantity,
        price: Number(item.price),
        subtotal: Number(item.subtotal),
        food: item.foods
          ? {
              id: item.foods.id,
              seller_id: item.seller_id,
              category_id: 0,
              name: item.foods.name,
              description: "",
              image_url: item.foods.image_url,
              quantity: item.quantity,
              price: Number(item.price),
              type: item.foods.type,
              pickup_method: item.foods.pickup_method,
              status: "available",
              categories: item.foods.categories,
            }
          : undefined,
      })),
    }));

    return { success: true, data: orders };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat riwayat pesanan.",
      data: [],
    };
  }
}

/**
 * Server Action: Mengambil pesanan masuk milik makanan mitra penjual.
 */
export async function getSellerOrdersAction(): Promise<ActionResponse<Order[]>> {
  try {
    const authResult = await getAuthenticatedUserAndRole();
    if (authResult.status !== "authenticated" || !authResult.user) {
      return { success: false, error: "Pengguna belum login.", data: [] };
    }

    if (authResult.role !== "seller" && authResult.role !== "admin") {
      return { success: false, error: "Akses ditolak: Hanya penjual atau admin.", data: [] };
    }

    const supabase = await createClient();

    // RLS memastikan seller hanya melihat orders yang memuat makanannya
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        buyer_id,
        total_amount,
        status,
        pickup_method,
        shipping_address,
        created_at,
        updated_at,
        order_items (
          id,
          food_id,
          seller_id,
          quantity,
          price,
          subtotal,
          foods (
            id,
            name,
            image_url,
            type,
            pickup_method,
            categories (name)
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: mapDatabaseError(error), data: [] };
    }

    const orders: Order[] = ((data as unknown as RawOrder[]) || []).map((raw: RawOrder) => ({
      id: raw.id,
      buyer_id: raw.buyer_id,
      total_amount: Number(raw.total_amount),
      status: raw.status as OrderStatus,
      pickup_method: raw.pickup_method,
      shipping_address: raw.shipping_address,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
      order_items: (raw.order_items || []).map((item: RawOrderItem) => ({
        id: item.id,
        order_id: raw.id,
        food_id: item.food_id,
        seller_id: item.seller_id,
        quantity: item.quantity,
        price: Number(item.price),
        subtotal: Number(item.subtotal),
        food: item.foods
          ? {
              id: item.foods.id,
              seller_id: item.seller_id,
              category_id: 0,
              name: item.foods.name,
              description: "",
              image_url: item.foods.image_url,
              quantity: item.quantity,
              price: Number(item.price),
              type: item.foods.type,
              pickup_method: item.foods.pickup_method,
              status: "available",
              categories: item.foods.categories,
            }
          : undefined,
      })),
    }));

    return { success: true, data: orders };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat pesanan penjual.",
      data: [],
    };
  }
}
