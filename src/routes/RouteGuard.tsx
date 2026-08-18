// ============================================================
// WAYTERO ADMIN — ROUTE GUARD
// Doc: Admin Portal §39 Security — Route Guards, Role Based Menus
// Redirects unauthenticated users to /login
// Redirects wrong-role users to /unauthorized
// ============================================================
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import SessionManager from "../components/auth/SessionManager";
import type { UserRole } from "../types/auth";

interface RouteGuardProps {
  allowedRoles?: UserRole[];
}

export function RouteGuard({ allowedRoles }: RouteGuardProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (allowedRoles && user && !allowedRoles.includes(user.user_type)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Session validation on open + 10-min idle auto-logout for authed users
  return (
    <SessionManager>
      <Outlet />
    </SessionManager>
  );
}
