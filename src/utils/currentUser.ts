// ============================================================
// WAYTERO ADMIN — CURRENT USER HELPERS
// The authenticated user lives in the Zustand auth store
// (stores/authStore.ts), which persists it under "wt_admin_auth".
// Reading that key out of localStorage by hand is what these helpers
// replace: the store is the live value, survives a setUser() from
// /auth/me, and stays in sync with what the components render.
// ============================================================
import { useAuthStore } from "../stores/authStore";

/** Returns the current user's user_type (e.g. "SUPER_ADMIN"), or "" if not logged in. */
export function currentUserType(): string {
  return useAuthStore.getState().user?.user_type ?? "";
}

export function isSuperAdmin(): boolean {
  return currentUserType() === "SUPER_ADMIN";
}

export function isAdmin(): boolean {
  return ["ADMIN", "SUPER_ADMIN"].includes(currentUserType());
}

export function isVerificationOfficer(): boolean {
  return currentUserType() === "VERIFICATION_OFFICER";
}

/** Admins/super-admins may perform officer verification actions at their own risk. */
export function isAdminOrOfficer(): boolean {
  return isAdmin() || isVerificationOfficer();
}
