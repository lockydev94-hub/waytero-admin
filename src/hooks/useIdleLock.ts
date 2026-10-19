// ============================================================
// WAYTERO ADMIN — USE IDLE LOCK
// Measures the gap since the last real interaction and publishes what is
// left of the window, so the topbar can count down and the session manager
// can arm the lock.
//
// Unlike a plain "log out after N minutes" timer, the remaining time is
// exposed (so the topbar can count down), the timer pauses while already
// locked, `lastActivityTs` comes from the lock store so a refresh or another
// tab cannot buy a fresh window, and activity is broadcast to the admin's
// other tabs.
// ============================================================
import { useEffect, useRef } from "react";
import { useLockStore } from "../stores/lockStore";
import { postSessionMessage } from "./useBroadcastSession";

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "click",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
] as const;

/** BroadcastChannel chatter per mousemove is pointless — one message a second is enough. */
const BROADCAST_EVERY_MS = 1_000;

interface IdleLockOptions {
  timeoutMs: number;
  /** false while the portal is already locked, so the timer does not re-fire */
  enabled: boolean;
  onIdle: () => void;
}

export function useIdleLock({ timeoutMs, enabled, onIdle }: IdleLockOptions) {
  const firedRef = useRef(false);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    firedRef.current = false;
    if (!enabled) {
      // Locked or still loading the policy: show a full window so the topbar
      // chip never reads "locks in 00:00" behind the overlay.
      useLockStore.getState().setIdleRemaining(timeoutMs);
      return;
    }

    let lastBroadcast = 0;
    const markActivity = () => {
      const now = Date.now();
      useLockStore.getState().markActivity(now);
      if (now - lastBroadcast >= BROADCAST_EVERY_MS) {
        lastBroadcast = now;
        postSessionMessage({ type: "activity", ts: now });
      }
    };

    const check = () => {
      const state = useLockStore.getState();
      const remaining = Math.max(0, timeoutMs - (Date.now() - state.lastActivityTs));
      state.setIdleRemaining(remaining);
      if (remaining === 0 && !firedRef.current) {
        firedRef.current = true;
        onIdleRef.current();
      }
    };

    // A tab that was in the background is not "active" just because it is
    // visible again — check the elapsed gap first, then accept input.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        check();
        markActivity();
      }
    };

    check();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, markActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibilityChange);
    const interval = window.setInterval(check, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, markActivity));
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(interval);
    };
  }, [timeoutMs, enabled]);
}
