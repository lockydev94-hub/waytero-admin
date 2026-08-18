// ============================================================
// WAYTERO ADMIN — AUTH STORE (Zustand)
// Matches backend AuthUser shape: { id, mobile, full_name, user_type, ... }
// ============================================================
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "../types/auth";
import { TOKEN_KEYS } from "../constants";
import { registerSessionClearedCallback } from "../services/api";

interface AuthStore {
  user:            AuthUser | null;
  accessToken:     string | null;
  refreshToken:    string | null;
  isAuthenticated: boolean;

  setAuth:     (user: AuthUser, accessToken: string, refreshToken: string) => void;
  setUser:     (user: AuthUser) => void;
  clearAuth:   () => void;
  updateToken: (accessToken: string) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => {
      // Let the axios interceptor reset in-memory state synchronously so
      // RouteGuard never sees a stale isAuthenticated=true after a clear.
      registerSessionClearedCallback(() => {
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      });

      return {
        user:            null,
        accessToken:     null,
        refreshToken:    null,
        isAuthenticated: false,

        setAuth: (user, accessToken, refreshToken) => {
          localStorage.setItem(TOKEN_KEYS.ACCESS,  accessToken);
          localStorage.setItem(TOKEN_KEYS.REFRESH, refreshToken);
          set({ user, accessToken, refreshToken, isAuthenticated: true });
        },

        setUser: (user) => {
          set({ user });
        },

        clearAuth: () => {
          Object.values(TOKEN_KEYS).forEach((k) => localStorage.removeItem(k));
          set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
        },

        updateToken: (accessToken) => {
          localStorage.setItem(TOKEN_KEYS.ACCESS, accessToken);
          set({ accessToken });
        },
      };
    },
    {
      name: "wt_admin_auth",
      partialize: (s) => ({
        user:            s.user,
        accessToken:     s.accessToken,
        refreshToken:    s.refreshToken,
        isAuthenticated: s.isAuthenticated,
      }),
    }
  )
);
