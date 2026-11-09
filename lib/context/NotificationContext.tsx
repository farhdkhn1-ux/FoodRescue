"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { NotificationItem } from "@/lib/types/notification";
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/app/actions/notification";

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

interface NotificationProviderProps {
  children: ReactNode;
  userId?: string | null;
}

export function NotificationProvider({ children, userId }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [prevUserId, setPrevUserId] = useState<string | null | undefined>(userId);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Pola React 19 untuk penyesuaian state saat prop userId berubah tanpa cascading effect
  if (prevUserId !== userId) {
    setPrevUserId(userId);
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
    }
  }

  // Muat notifikasi saat pertama kali mount, userId berubah, atau refresh dipicu
  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    async function loadNotifications() {
      try {
        const res = await getNotificationsAction(15);
        if (isMounted && res.success && res.data) {
          setNotifications(res.data.notifications);
          setUnreadCount(res.data.unreadCount);
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[NotificationContext] Gagal memuat notifikasi:", err);
        }
      }
    }

    loadNotifications();

    return () => {
      isMounted = false;
    };
  }, [userId, refreshTrigger]);

  // Listener Supabase Realtime TUNGGAL untuk userId ini
  useEffect(() => {
    if (!userId) return;
    let isSubscribed = true;

    const supabase = createClient();
    // Gunakan suffix unik agar tidak terjadi tabrakan channel di Supabase Client
    // saat React Strict Mode atau navigasi cepat
    const channelName = `notifications-${userId}-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!isSubscribed) return;
          const newNotif = payload.new as NotificationItem;
          setNotifications((prev) => [newNotif, ...prev.slice(0, 14)]);
          setUnreadCount((prev) => prev + 1);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!isSubscribed) return;
          const updated = payload.new as NotificationItem;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? { ...n, is_read: updated.is_read } : n))
          );
          if (updated.is_read) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" && process.env.NODE_ENV !== "production") {
          console.warn("[Realtime Notifications] Subscription error:", err?.message);
        }
      });

    return () => {
      isSubscribed = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Tandai 1 notifikasi telah dibaca
  const markAsRead = useCallback(async (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await markNotificationReadAction(id);
  }, []);

  // Tandai semua notifikasi telah dibaca
  const markAllAsRead = useCallback(async () => {
    setLoading(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsReadAction();
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        refresh,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  return context;
}
