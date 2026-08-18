// ============================================================
// WAYTERO — useSessionValidation
// Validates the stored session once when the portal opens:
//   1. Calls GET /auth/me with the stored access token. If the token is
//      expired/invalid, the axios 401 → refresh → retry interceptor handles
//      it automatically (and clears the session when the refresh fails).
//   2. On success, syncs the returned user profile into the auth store.
// Network errors (backend down) do NOT log the user out — only real
// authentication failures do (handled by the interceptor).
// ============================================================
import { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { authService } from "../services/auth.service";

export function useSessionValidation() {
  const { isAuthenticated, setUser } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    (async () => {
      try {
        const me = await authService.getMe();
        if (!cancelled && me) setUser(me);
      } catch {
        // 401/403 → interceptor already cleared the session and redirected.
        // Other errors (network) → leave the user signed in.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, setUser]);
}
