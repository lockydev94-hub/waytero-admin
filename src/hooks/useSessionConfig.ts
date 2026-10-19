// ============================================================
// WAYTERO ADMIN — USE SESSION CONFIG
// Pulls GET /auth/admin/session-config once per portal open and keeps it in
// the lock store: the idle window, the daily-logout hour, the platform
// timezone and the server clock all come from that single answer, so the
// topbar chip, the idle timer and the forced-logout countdown cannot drift
// apart. Re-fetched on unlock and when the tab is re-focused, because the
// admin may have set or removed a PIN in another tab or on the profile page.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { mpinService } from "../services/mpin.service";
import { useLockStore } from "../stores/lockStore";

export function useSessionConfig(enabled: boolean) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const config = await mpinService.getSessionConfig();
      useLockStore.getState().setSessionConfig(config);
      setFailed(false);
    } catch {
      // No policy → the manager falls back to today's idle behaviour, which is
      // the stricter one. A backend outage must not silently disable the lock.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [enabled, refresh]);

  return { loading, failed, refresh };
}
