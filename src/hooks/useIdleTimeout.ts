// ============================================================
// WAYTERO — useIdleTimeout
// Fires `onIdle` after the user has been inactive for `timeoutMs`.
// Activity = pointer/keyboard/touch/scroll interaction with the page.
// Also handles tabs left open: when the tab regains focus after being
// hidden longer than the timeout, `onIdle` fires immediately.
// ============================================================
import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "click",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
] as const;

export function useIdleTimeout(timeoutMs: number, onIdle: () => void) {
  const lastActivity = useRef(Date.now());
  const fired = useRef(false);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    fired.current = false;
    lastActivity.current = Date.now();

    const markActivity = () => {
      lastActivity.current = Date.now();
    };
    const checkIdle = () => {
      if (fired.current) return;
      if (Date.now() - lastActivity.current >= timeoutMs) {
        fired.current = true;
        onIdleRef.current();
      }
    };
    // Tab was left open — enforce the timeout immediately on return.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Coming back to the tab counts as activity, but only after
        // we've checked whether the gap already exceeded the timeout.
        checkIdle();
        markActivity();
      }
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, markActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibilityChange);
    const interval = setInterval(checkIdle, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, markActivity));
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(interval);
    };
  }, [timeoutMs]);
}
