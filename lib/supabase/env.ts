/**
 * Sanitasi dan validasi environment variable Supabase.
 * Menghilangkan whitespace, carriage return (\r), newline (\n), dan trailing slash
 * untuk mencegah kegagalan koneksi WebSocket (%0A) dan malformed URL.
 */
export function getSupabaseEnv() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

  const supabaseUrl = rawUrl.trim().replace(/[\r\n]+/g, "").replace(/\/+$/, "");
  const supabaseKey = rawKey.trim().replace(/[\r\n]+/g, "");

  if (!supabaseUrl || !supabaseKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[Supabase Env] Warning: NEXT_PUBLIC_SUPABASE_URL atau NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY belum disetel."
      );
    }
  }

  return { supabaseUrl, supabaseKey };
}

