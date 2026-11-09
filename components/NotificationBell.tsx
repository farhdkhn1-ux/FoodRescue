"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useNotifications } from "@/lib/context/NotificationContext";
import { formatNotificationDateWIB } from "@/lib/utils/format";

interface NotificationBellProps {
  userId: string;
  userRole?: string | null;
}

function formatNotificationTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return "Baru saja";
    if (diffMin < 60) return `${diffMin} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;

    return formatNotificationDateWIB(d);
  } catch {
    return dateStr;
  }
}

export default function NotificationBell({ userRole }: NotificationBellProps) {
  const context = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Ambil state dan aksi dari NotificationContext (terpusat & realtime)
  const notifications = context ? context.notifications : [];
  const unreadCount = context ? context.unreadCount : 0;
  const loading = context ? context.loading : false;

  // Tutup dropdown saat klik di luar area
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handler: Tandai 1 notifikasi telah dibaca
  async function handleMarkRead(id: number) {
    if (context) {
      await context.markAsRead(id);
    }
  }

  // Handler: Tandai semua telah dibaca
  async function handleMarkAllRead() {
    if (context) {
      await context.markAllAsRead();
    }
  }

  // Helper tujuan tautan pesanan berdasarkan role
  function getOrderLink(orderId: number | null) {
    if (!orderId) return "#";
    if (userRole === "seller") return "/seller";
    if (userRole === "courier") return "/courier";
    return "/buyer";
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Tombol Lonceng */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notifikasi (${unreadCount} belum dibaca)`}
        aria-expanded={isOpen}
        className="relative inline-flex items-center justify-center p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white shadow-xs animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-xl ring-1 ring-slate-900/10 dark:bg-slate-900 dark:ring-slate-800 z-50 overflow-hidden">
          {/* Header Panel */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Notifikasi</h2>
              {unreadCount > 0 && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {unreadCount} baru
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors disabled:opacity-50"
              >
                Tandai dibaca
              </button>
            )}
          </div>

          {/* Daftar Notifikasi */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                <svg
                  className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                Belum ada notifikasi saat ini.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                    !n.is_read ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {!n.is_read && (
                          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                        )}
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {n.title}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                        <span>{formatNotificationTime(n.created_at)}</span>
                        {n.order_id && (
                          <Link
                            href={getOrderLink(n.order_id)}
                            onClick={() => {
                              handleMarkRead(n.id);
                              setIsOpen(false);
                            }}
                            className="font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 underline underline-offset-2"
                          >
                            Lihat Pesanan #{n.order_id}
                          </Link>
                        )}
                      </div>
                    </div>

                    {!n.is_read && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(n.id)}
                        title="Tandai telah dibaca"
                        className="shrink-0 p-1 text-slate-400 hover:text-emerald-600 transition-colors"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
