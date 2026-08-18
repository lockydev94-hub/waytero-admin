// ============================================================
// WAYTERO ADMIN — SESSION MANAGER
// Mounted around all protected routes. For authenticated users it:
//   1. Validates the session when the portal opens (useSessionValidation)
//   2. Auto-logs-out after IDLE_TIMEOUT_MS of no user activity, redirecting
//      to /login?reason=inactivity
// ============================================================
import { ReactNode } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useIdleTimeout } from "../../hooks/useIdleTimeout";
import { useSessionValidation } from "../../hooks/useSessionValidation";
import { clearSession } from "../../services/api";

export const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function ActiveSessionManager({ children }: { children: ReactNode }) {
  useSessionValidation();
  useIdleTimeout(IDLE_TIMEOUT_MS, () => {
    clearSession("/login?reason=inactivity");
  });
  return <>{children}</>;
}

export default function SessionManager({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <>{children}</>;
  return <ActiveSessionManager>{children}</ActiveSessionManager>;
}
