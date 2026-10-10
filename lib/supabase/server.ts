import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Membuat Supabase client untuk digunakan di Server Components, Server Actions,
 * dan Route Handlers.
 *
 * Client ini membaca dan menulis cookie melalui next/headers,
 * sehingga sesi pengguna bisa diakses di server.
 *
 * HARUS dipanggil dengan await karena cookies() di Next.js 16 bersifat async.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll dipanggil dari Server Component (read-only context).
            // Bisa diabaikan jika proxy sudah me-refresh sesi.
          }
        },
      },
    }
  );
}
