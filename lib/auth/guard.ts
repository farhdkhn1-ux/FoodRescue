import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSafeInternalRedirect } from "./redirect";
import {
  isValidRole,
  type UserRole,
  type AuthContext,
  type AuthResolutionResult,
} from "./roles";

/**
 * Mengambil data pengguna terautentikasi dan memverifikasi role-nya dari database di sisi server.
 *
 * Menerapkan prinsip Fail-Closed:
 * 1. Tidak mempercayai input browser, URL, atau token yang tidak diverifikasi.
 * 2. Memverifikasi sesi Supabase Auth (getUser()).
 * 3. Mengambil role dari RPC `get_my_role()` atau tabel `public.users`.
 * 4. TIDAK PERNAH memberikan fallback default "buyer" jika query gagal atau role tidak ditemukan.
 * 5. Membedakan secara presisi jenis kegagalan otorisasi.
 *
 * @returns AuthResolutionResult dengan status terinci
 */
export async function getAuthenticatedUserAndRole(): Promise<AuthResolutionResult> {
  const supabase = await createClient();

  // 1. Verifikasi identitas melalui server Supabase Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      status: "unauthenticated",
      user: null,
      role: null,
      errorMessage: authError?.message || "Pengguna belum terautentikasi.",
    };
  }

  // 2. Ambil role dari sumber database tepercaya di sisi server
  try {
    // Prioritas 1: Baca melalui RPC get_my_role() jika tersedia di Supabase
    const { data: roleRpc, error: rpcError } =
      await supabase.rpc("get_my_role");

    if (!rpcError && isValidRole(roleRpc)) {
      return {
        status: "authenticated",
        user,
        role: roleRpc,
      };
    }

    // Prioritas 2: Baca langsung dari baris user di tabel public.users
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (userError) {
      return {
        status: "database_error",
        user,
        role: null,
        errorMessage: userError.message,
      };
    }

    if (!userData) {
      return {
        status: "role_not_found",
        user,
        role: null,
        errorMessage: "Baris data pengguna tidak ditemukan di tabel users.",
      };
    }

    if (!isValidRole(userData.role)) {
      return {
        status: "role_invalid",
        user,
        role: null,
        errorMessage: `Nilai role '${userData.role}' tidak valid.`,
      };
    }

    return {
      status: "authenticated",
      user,
      role: userData.role,
    };
  } catch (error) {
    return {
      status: "database_error",
      user,
      role: null,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan tak terduga saat memverifikasi role pengguna.",
    };
  }
}

/**
 * Server guard untuk Server Components di Next.js 16 App Router.
 * Memeriksa apakah pengguna sudah login dan memiliki role yang diizinkan.
 *
 * Menerapkan prinsip Fail-Closed & Defense-in-Depth:
 * - Belum login -> redirect ke `/login?redirect={safeCurrentPath}`
 * - Error database -> redirect ke `/unauthorized?required=...&current=error_database`
 * - Role tidak ditemukan -> redirect ke `/unauthorized?required=...&current=role_tidak_ditemukan`
 * - Role tidak valid -> redirect ke `/unauthorized?required=...&current=role_tidak_valid`
 * - Role tidak diizinkan -> redirect ke `/unauthorized?required=...&current={role}`
 * - Lolos semua verifikasi -> kembalikan AuthContext
 *
 * @param allowedRoles Daftar role yang diizinkan mengakses halaman
 * @param currentPath Path halaman saat ini untuk keperluan pengalihan kembali setelah login
 * @returns AuthContext objek yang berisi data user dan role terverifikasi
 */
export async function requireRole(
  allowedRoles: UserRole[],
  currentPath?: string
): Promise<AuthContext> {
  const result = await getAuthenticatedUserAndRole();

  // 1. Belum login -> redirect ke halaman login dengan path internal yang aman
  if (result.status === "unauthenticated" || !result.user) {
    const safePath = currentPath
      ? getSafeInternalRedirect(currentPath, "", true)
      : "";
    const redirectUrl = safePath
      ? `/login?redirect=${encodeURIComponent(safePath)}`
      : "/login";
    redirect(redirectUrl);
  }

  // 2. Terjadi error saat membaca database -> tolak akses (Fail-Closed) tanpa redirect loop
  if (result.status === "database_error") {
    const params = new URLSearchParams({
      required: allowedRoles.join(","),
      current: "error_database",
    });
    redirect(`/unauthorized?${params.toString()}`);
  }

  // 3. User terautentikasi tetapi role tidak ditemukan di tabel users
  if (result.status === "role_not_found" || !result.role) {
    const params = new URLSearchParams({
      required: allowedRoles.join(","),
      current: "role_tidak_ditemukan",
    });
    redirect(`/unauthorized?${params.toString()}`);
  }

  // 4. User terautentikasi tetapi nilai role tidak sah
  if (result.status === "role_invalid" || !isValidRole(result.role)) {
    const params = new URLSearchParams({
      required: allowedRoles.join(","),
      current: "role_tidak_valid",
    });
    redirect(`/unauthorized?${params.toString()}`);
  }

  // 5. Role tidak memenuhi daftar izin halaman
  if (!allowedRoles.includes(result.role)) {
    const params = new URLSearchParams({
      required: allowedRoles.join(","),
      current: result.role,
    });
    redirect(`/unauthorized?${params.toString()}`);
  }

  // 6. Izin terpenuhi secara sah
  return {
    user: result.user,
    role: result.role,
  };
}
