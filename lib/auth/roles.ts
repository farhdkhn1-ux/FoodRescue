import type { User } from "@supabase/supabase-js";
import { getSafeInternalRedirect, isValidInternalRedirect } from "./redirect";

export { getSafeInternalRedirect, isValidInternalRedirect };

/**
 * Tipe role yang sah pada sistem Food Rescue.
 * Sesuai dengan nilai role pada tabel public.users: admin, seller, buyer, courier.
 */
export type UserRole = "admin" | "seller" | "buyer" | "courier";

export const VALID_ROLES: readonly UserRole[] = [
  "admin",
  "seller",
  "buyer",
  "courier",
] as const;

/**
 * Memvalidasi apakah sebuah nilai merupakan role yang sah.
 */
export function isValidRole(role: unknown): role is UserRole {
  return typeof role === "string" && VALID_ROLES.includes(role as UserRole);
}

export interface AuthContext {
  user: User;
  role: UserRole;
}

/**
 * Status hasil verifikasi otentikasi dan otorisasi pengguna.
 * Membedakan dengan jelas antara belum login, role tidak ditemukan, role invalid,
 * dan kendala koneksi/database.
 */
export type RoleVerificationStatus =
  | "authenticated"
  | "unauthenticated"
  | "role_not_found"
  | "role_invalid"
  | "database_error";

export interface AuthResolutionResult {
  status: RoleVerificationStatus;
  user: User | null;
  role: UserRole | null;
  errorMessage?: string;
}
