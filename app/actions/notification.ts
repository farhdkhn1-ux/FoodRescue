"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUserAndRole } from "@/lib/auth/guard";
import { revalidatePath } from "next/cache";
import type { ActionResponse } from "@/lib/types/food";
import type { NotificationItem } from "@/lib/types/notification";

export interface NotificationsPayload {
  notifications: NotificationItem[];
  unreadCount: number;
}

/**
 * Server Action: Mengambil daftar notifikasi terbaru milik pengguna terautentikasi.
 */
export async function getNotificationsAction(
  limit: number = 20
): Promise<ActionResponse<NotificationsPayload>> {
  try {
    const authResult = await getAuthenticatedUserAndRole();
    if (authResult.status !== "authenticated" || !authResult.user) {
      return {
        success: false,
        error: "Sesi tidak valid atau telah berakhir.",
        data: { notifications: [], unreadCount: 0 },
      };
    }

    const supabase = await createClient();

    // 1. Ambil daftar notifikasi terbaru
    const { data, error } = await supabase
      .from("notifications")
      .select("id, user_id, title, message, type, order_id, is_read, metadata, created_at")
      .eq("user_id", authResult.user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return {
        success: false,
        error: error.message,
        data: { notifications: [], unreadCount: 0 },
      };
    }

    const notifications: NotificationItem[] = (data || []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      message: row.message,
      type: row.type,
      order_id: row.order_id,
      is_read: Boolean(row.is_read),
      metadata: row.metadata as NotificationItem["metadata"],
      created_at: row.created_at,
    }));

    // 2. Hitung jumlah unread
    const { count, error: countError } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", authResult.user.id)
      .eq("is_read", false);

    const unreadCount = !countError && count !== null ? count : notifications.filter((n) => !n.is_read).length;

    return {
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat notifikasi.",
      data: { notifications: [], unreadCount: 0 },
    };
  }
}

/**
 * Server Action: Menandai satu notifikasi sebagai telah dibaca.
 */
export async function markNotificationReadAction(
  notificationId: number
): Promise<ActionResponse<boolean>> {
  try {
    const authResult = await getAuthenticatedUserAndRole();
    if (authResult.status !== "authenticated" || !authResult.user) {
      return { success: false, error: "Sesi tidak valid." };
    }

    const supabase = await createClient();

    // Coba RPC terlebih dahulu jika terpasang di database
    const { error: rpcError } = await supabase.rpc("mark_notification_as_read", {
      p_notification_id: notificationId,
    });

    if (rpcError) {
      // Fallback update langsung terproteksi RLS
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("user_id", authResult.user.id);

      if (updateError) {
        return { success: false, error: updateError.message };
      }
    }

    revalidatePath("/");
    return { success: true, data: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memperbarui status notifikasi.",
    };
  }
}

/**
 * Server Action: Menandai seluruh notifikasi pengguna sebagai telah dibaca.
 */
export async function markAllNotificationsReadAction(): Promise<ActionResponse<boolean>> {
  try {
    const authResult = await getAuthenticatedUserAndRole();
    if (authResult.status !== "authenticated" || !authResult.user) {
      return { success: false, error: "Sesi tidak valid." };
    }

    const supabase = await createClient();

    // Coba RPC terlebih dahulu
    const { error: rpcError } = await supabase.rpc("mark_all_notifications_read");

    if (rpcError) {
      // Fallback update langsung terproteksi RLS
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", authResult.user.id)
        .eq("is_read", false);

      if (updateError) {
        return { success: false, error: updateError.message };
      }
    }

    revalidatePath("/");
    return { success: true, data: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memperbarui notifikasi.",
    };
  }
}

