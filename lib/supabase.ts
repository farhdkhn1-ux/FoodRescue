/**
 * @deprecated File ini tidak digunakan lagi.
 *
 * Gunakan:
 * - lib/supabase/client.ts  → untuk Client Components ("use client")
 * - lib/supabase/server.ts  → untuk Server Components, Server Actions, Route Handlers
 *
 * File ini dipertahankan sementara agar tidak merusak referensi yang mungkin masih ada.
 * Akan dihapus setelah migrasi selesai.
 */
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);