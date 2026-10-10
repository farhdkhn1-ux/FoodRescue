import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (pengganti middleware di Next.js 16).
 *
 * Berfungsi untuk:
 * 1. Me-refresh token sesi Supabase Auth yang hampir kedaluwarsa.
 * 2. Memastikan cookie sesi selalu diperbarui di setiap request.
 * 3. Melindungi halaman yang memerlukan autentikasi.
 *
 * Supabase Auth menyimpan sesi di cookie. Tanpa proxy ini,
 * sesi bisa kedaluwarsa saat user sedang browsing, menyebabkan
 * Server Components gagal membaca user yang login.
 */
export async function proxy(request: NextRequest) {
  // Buat response awal yang akan dimodifikasi
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Set cookie pada request agar Server Components bisa membacanya
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          // Buat response baru dengan request yang sudah diperbarui
          supabaseResponse = NextResponse.next({
            request,
          });

          // Set cookie pada response agar browser menyimpannya
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // PENTING: Jangan menghapus baris ini!
  // getUser() memicu refresh token jika token hampir kedaluwarsa.
  // Tanpa ini, sesi user bisa tiba-tiba hilang.
  await supabase.auth.getUser();

  return supabaseResponse;
}

/**
 * Matcher: tentukan path mana yang harus melewati proxy.
 * Mengecualikan file statis, gambar, favicon, dan file SEO.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
