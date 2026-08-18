// ============================================================
// WAYTERO ADMIN — CURRENT USER HELPERS
// The authenticated user is persisted by the Zustand auth store
// (stores/authStore.ts) under the localStorage key "wt_admin_auth"
// with shape { state: { user: { user_type, ... } }, version }.
// Reading localStorage.getItem("user") directly is WRONG — that key
// does not exist, so user_type comes back undefined. Always go
// through these helpers.
// ============================================================

const AUTH_STORAGE_KEY = "wt_admin_auth";

/** Returns the current user's user_type (e.g. "SUPER_ADMIN"), or "" if not logged in. */
export function currentUserType(): string {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return "";
    return JSON.parse(raw)?.state?.user?.user_type ?? "";
  } catch {
    return "";
  }
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
