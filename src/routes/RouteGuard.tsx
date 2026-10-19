// ============================================================
// WAYTERO ADMIN — ROUTE GUARD
// Doc: Admin Portal §39 Security — Route Guards, Role Based Menus
// Redirects unauthenticated users to /login
// Redirects wrong-role users to /unauthorized
// ============================================================
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { allowedRolesForPath } from "../constants";
import SessionManager from "../components/auth/SessionManager";
import type { UserRole } from "../types/auth";

interface RouteGuardProps {
  /**
   * Only for a subtree that wants a rule stricter than the page's own nav
   * entry. Ordinary routes need nothing here: the guard reads the location and
   * looks the path up, so there is no `allowedRoles` prop left to forget on a
   * new `<Route>`.
   */
  allowedRoles?: UserRole[];
}

export function RouteGuard({ allowedRoles }: RouteGuardProps) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (user) {
    const roles = allowedRoles ?? allowedRolesForPath(location.pathname);
    if (roles && !roles.includes(user.user_type)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Session validation on open + the idle/daily session rules (SessionManager)
  return (
    <SessionManager>
      <Outlet />
    </SessionManager>
  );
}
