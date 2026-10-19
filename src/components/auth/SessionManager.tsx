// ============================================================
// WAYTERO ADMIN — SESSION MANAGER (policy engine)
// Mounted around all protected routes. Reads GET /auth/admin/session-config
// once and enforces the two rules the owner set:
//
//   1. Idle → the dashboard LOCKS (overlay, MPIN re-entry) when the admin has
//      an unlock PIN. Without a PIN there is nothing to unlock with, so idle
//      still performs the full logout — and the profile asks them to set one.
//   2. Daily → everyone is logged out at ADMIN_DAILY_LOGOUT_HOUR (23:00 by
//      default, super-admin configurable), after a 60-second warning that
//      cannot be dismissed. The deadline is counted from the server clock.
//
// Both rules are synced across the admin's open tabs: idle is measured per
// browser (activity in any tab resets them all), and one lock/unlock applies
// to every tab.
// ============================================================
import { ReactNode, useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogContentText, DialogTitle,
} from "@mui/material";
import { useAuthStore } from "../../stores/authStore";
import { useLockStore, trustedNowMs } from "../../stores/lockStore";
import { useIdleLock } from "../../hooks/useIdleLock";
import { useSessionConfig } from "../../hooks/useSessionConfig";
import { useBroadcastSession, postSessionMessage } from "../../hooks/useBroadcastSession";
import { useSessionValidation } from "../../hooks/useSessionValidation";
import { clearSession } from "../../services/api";

/** Used until the policy arrives; the server value replaces it immediately. */
const IDLE_FALLBACK_MINUTES = 5;
const DAILY_WARNING_MS = 60_000;

function ActiveSessionManager({ children }: { children: ReactNode }) {
  const isLocked = useLockStore((s) => s.isLocked);
  const config = useLockStore((s) => s.sessionConfig);
  const dailyDeadlineTs = useLockStore((s) => s.dailyDeadlineTs);

  useSessionValidation();
  const { refresh } = useSessionConfig(true);

  // One tab's activity, lock or unlock applies to all of them.
  useBroadcastSession((message) => {
    if (message.type === "activity") useLockStore.getState().markActivity(message.ts);
    else if (message.type === "lock") useLockStore.getState().lock();
    else if (message.type === "unlock") {
      useLockStore.getState().unlock();
      void refresh();
    }
  });

  const lockMode = Boolean(config?.has_mpin);
  const timeoutMs = (config?.idle_minutes ?? IDLE_FALLBACK_MINUTES) * 60_000;

  useIdleLock({
    timeoutMs,
    // The idle clock stops behind the overlay — typing a PIN is not "active",
    // but re-firing the lock every second would be noise.
    enabled: !isLocked,
    onIdle: () => {
      if (lockMode) {
        useLockStore.getState().lock();
        postSessionMessage({ type: "lock" });
      } else {
        clearSession("/login?reason=inactivity");
      }
    },
  });

  const [msToDailyLogout, setMsToDailyLogout] = useState<number | null>(null);
  useEffect(() => {
    if (dailyDeadlineTs === null) return;
    const tick = () => setMsToDailyLogout(dailyDeadlineTs - trustedNowMs());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [dailyDeadlineTs]);

  useEffect(() => {
    if (msToDailyLogout === null || msToDailyLogout > 0) return;
    clearSession("/login?reason=daily");
  }, [msToDailyLogout]);

  const warningOpen = msToDailyLogout !== null && msToDailyLogout <= DAILY_WARNING_MS;

  return (
    <>
      {children}
      {warningOpen && msToDailyLogout !== null && (
        <Dialog open disableEscapeKeyDown>
          <DialogTitle>Signing you out</DialogTitle>
          <DialogContent>
            <DialogContentText>
              The dashboard closes for everyone at{" "}
              {String(config?.daily_logout_hour ?? 23).padStart(2, "0")}:00. You will be
              signed out in {Math.max(0, Math.ceil(msToDailyLogout / 1000))} seconds — save
              anything you are working on.
            </DialogContentText>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export default function SessionManager({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <>{children}</>;
  return <ActiveSessionManager>{children}</ActiveSessionManager>;
}
