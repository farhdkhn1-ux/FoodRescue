import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

/**
 * Membuat Supabase client untuk digunakan di Client Components ("use client").
 * Client ini otomatis mengelola cookie sesi di browser.
 *
 * Panggil fungsi ini setiap kali membutuhkan client di komponen browser.
 * Tidak perlu disimpan sebagai singleton — @supabase/ssr sudah menangani de-duplikasi.
 */
export function createClient() {
  const { supabaseUrl, supabaseKey } = getSupabaseEnv();
  return createBrowserClient(supabaseUrl, supabaseKey);
}
