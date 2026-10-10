import { createBrowserClient } from "@supabase/ssr";

/**
 * Membuat Supabase client untuk digunakan di Client Components ("use client").
 * Client ini otomatis mengelola cookie sesi di browser.
 *
 * Panggil fungsi ini setiap kali membutuhkan client di komponen browser.
 * Tidak perlu disimpan sebagai singleton — @supabase/ssr sudah menangani de-duplikasi.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
