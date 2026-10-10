/**
 * Helper validasi redirect internal Food Rescue.
 * Mencegah kerentanan Open Redirect dan Redirect Loop.
 *
 * Kriteria keamanan:
 * 1. Menolak URL eksternal absolut ('https://...', 'http://...').
 * 2. Menolak protocol-relative URL ('//evil.com', '///evil.com').
 * 3. Menolak backslash ('\\', '/\\', '\\/').
 * 4. Menolak skema non-HTTP berbahaya ('javascript:', 'data:', 'vbscript:').
 * 5. Menolak manipulasi encoding (%2f%2f, %5c) dan karakter kontrol.
 * 6. Mencegah redirect loop ke halaman autentikasi (/login, /register).
 */

export function getSafeInternalRedirect(
  rawUrl: string | null | undefined,
  fallback: string = "/",
  preventAuthLoop: boolean = true
): string {
  if (!rawUrl || typeof rawUrl !== "string") {
    return fallback;
  }

  // Bersihkan whitespace di awal dan akhir
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return fallback;
  }

  // Tolak backslash dalam bentuk apa pun (sering disalahartikan browser sebagai host delimiter)
  if (/[\\]/.test(trimmed)) {
    return fallback;
  }

  // Wajib diawali single slash dan BUKAN double slash (protocol-relative)
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  // Periksa apakah decode URI menghasilkan karakter terlarang (misal %5C atau %2f%2f)
  try {
    const decoded = decodeURIComponent(trimmed);
    if (
      /[\\]/.test(decoded) ||
      decoded.startsWith("//") ||
      decoded.startsWith("/\\") ||
      /[\x00-\x1f\x7f]/.test(decoded)
    ) {
      return fallback;
    }
  } catch {
    // Malformed URI encoding -> tolak
    return fallback;
  }

  // Validasi ketat menggunakan WHATWG URL parser dengan dummy origin internal
  try {
    const parsed = new URL(trimmed, "http://localhost");

    // Pastikan hostname tidak berubah dari 'localhost'
    if (parsed.hostname !== "localhost") {
      return fallback;
    }

    // Pastikan protokol dummy tidak berubah menjadi javascript:, data:, dll
    if (parsed.protocol !== "http:") {
      return fallback;
    }

    const pathname = parsed.pathname;

    // Cegah redirect loop jika target mengarah kembali ke login atau register
    if (preventAuthLoop) {
      const lower = pathname.toLowerCase();
      if (
        lower === "/login" ||
        lower === "/register" ||
        lower.startsWith("/login/") ||
        lower.startsWith("/register/")
      ) {
        return fallback;
      }
    }

    // Bangun kembali path internal yang bersih (pathname + query + hash)
    const safeResult = `${pathname}${parsed.search}${parsed.hash}`;

    // Pastikan hasil akhir tetap berawalan '/' dan bukan '//'
    if (!safeResult.startsWith("/") || safeResult.startsWith("//")) {
      return fallback;
    }

    return safeResult;
  } catch {
    return fallback;
  }
}

/**
 * Memeriksa apakah sebuah URL adalah redirect internal yang sah.
 */
export function isValidInternalRedirect(
  url: string | null | undefined,
  preventAuthLoop: boolean = true
): boolean {
  if (!url) return false;
  const safe = getSafeInternalRedirect(url, "", preventAuthLoop);
  return safe !== "";
}
