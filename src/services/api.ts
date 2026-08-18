// ============================================================
// WAYTERO ADMIN — AXIOS API CLIENT
// Doc: Frontend §9 API Integration — single instance, interceptors,
//      auto token refresh, centralized error handling
// ============================================================
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL, TOKEN_KEYS } from "../constants";

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

// REQUEST — attach Bearer token
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(TOKEN_KEYS.ACCESS);
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

// Callback registered by authStore to reset in-memory Zustand state synchronously.
// Prevents RouteGuard from briefly seeing stale isAuthenticated=true after a
// session clear (Zustand persist hydrates from localStorage, but the in-memory
// store is only updated on the next render).
let _onSessionCleared: (() => void) | null = null;
export function registerSessionClearedCallback(cb: () => void) {
  _onSessionCleared = cb;
}

// RESPONSE — 401 → refresh token → retry once; else logout
apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      const refreshToken = localStorage.getItem(TOKEN_KEYS.REFRESH);
      if (!refreshToken) {
        clearSession();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers["Authorization"] = `Bearer ${token}`;
          return apiClient(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
        // The auth router returns tokens at the top level (no envelope) —
        // tolerate both shapes so an expired access token refreshes cleanly
        // instead of silently clearing the session.
        const body = res.data as { data?: { access_token?: string }; access_token?: string };
        const newToken: string | undefined = body?.data?.access_token ?? body?.access_token;
        if (!newToken) throw new Error("Refresh response missing access_token");
        localStorage.setItem(TOKEN_KEYS.ACCESS, newToken);
        processQueue(null, newToken);
        original.headers["Authorization"] = `Bearer ${newToken}`;
        return apiClient(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearSession();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Clear the session (tokens + in-memory/persisted auth state) and redirect.
 *
 * `redirect` defaults to /login; pass e.g. "/login?reason=inactivity" so the
 * login page can show why the user was signed out. When already on the login
 * page, skip the redirect to avoid a full-page reload loop.
 */
export function clearSession(redirect?: string) {
  // 1. Reset in-memory Zustand state immediately (prevents route flicker)
  if (_onSessionCleared) _onSessionCleared();
  // 2. Clear tokens from localStorage
  Object.values(TOKEN_KEYS).forEach((k) => localStorage.removeItem(k));
  // 3. Clear Zustand persisted auth store so isAuthenticated=false on next load
  try {
    const stored = localStorage.getItem("wt_admin_auth");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.state) {
        parsed.state.isAuthenticated = false;
        parsed.state.user = null;
        parsed.state.accessToken = null;
        parsed.state.refreshToken = null;
        localStorage.setItem("wt_admin_auth", JSON.stringify(parsed));
      }
    }
  } catch { /* ignore */ }
  // 4. Redirect (skip when already on the login page)
  const target = redirect || "/login";
  if (window.location.pathname !== "/login") {
    window.location.href = target;
  }
}

export default apiClient;
