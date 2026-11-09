/**
 * Utility Pemformatan Tanggal & Waktu Ramah Indonesia (WIB - UTC+7)
 *
 * Mencegah React Hydration Error (#418) dengan memastikan hasil render teks
 * waktu dan tanggal identik 100% antara Server-Side Rendering (SSR) dan Client Hydration,
 * terlepas dari zona waktu server hosting (misalnya container Linux UTC) dan browser lokal pengguna.
 */

export const TIMEZONE_WIB = "Asia/Jakarta";
export const LOCALE_ID = "id-ID";

/**
 * Format tanggal dan jam umum WIB (misal: "9 Nov 2026, 14.30")
 */
export function formatDateWIB(dateInput?: string | number | Date | null): string {
  if (!dateInput) return "-";
  try {
    const d = typeof dateInput === "object" && dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);

    return new Intl.DateTimeFormat(LOCALE_ID, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: TIMEZONE_WIB,
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

/**
 * Format tanggal ringkas dengan hari dan jam WIB (misal: "Sen, 9 Nov 14.30")
 */
export function formatShortDateWIB(dateInput?: string | number | Date | null): string {
  if (!dateInput) return "-";
  try {
    const d = typeof dateInput === "object" && dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);

    return new Intl.DateTimeFormat(LOCALE_ID, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: TIMEZONE_WIB,
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

/**
 * Format tanggal ketersediaan makanan (misal: "9 Nov, 14.30")
 */
export function formatAvailabilityWIB(dateInput?: string | number | Date | null): string {
  if (!dateInput) return "-";
  try {
    const d = typeof dateInput === "object" && dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);

    return new Intl.DateTimeFormat(LOCALE_ID, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: TIMEZONE_WIB,
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

/**
 * Format tanggal dan waktu lengkap untuk halaman detail makanan
 * (misal: "Senin, 9 November 2026 14.30 WIB")
 */
export function formatFullDateTimeWIB(dateInput?: string | number | Date | null): string {
  if (!dateInput) return "-";
  try {
    const d = typeof dateInput === "object" && dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);

    return new Intl.DateTimeFormat(LOCALE_ID, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: TIMEZONE_WIB,
      timeZoneName: "short",
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

/**
 * Format waktu notifikasi ringkas atau tanggal
 */
export function formatNotificationDateWIB(dateInput?: string | number | Date | null): string {
  if (!dateInput) return "-";
  try {
    const d = typeof dateInput === "object" && dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);

    return new Intl.DateTimeFormat(LOCALE_ID, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: TIMEZONE_WIB,
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

/**
 * Format mata uang Rupiah konsisten
 */
export function formatRupiah(amount: number): string {
  return `Rp ${Number(amount).toLocaleString(LOCALE_ID)}`;
}

