// ============================================================
// WAYTERO ADMIN PORTAL — AUDIO + RINGTONE HELPER
// Doc Ref: BRD Part 7 §155 — Realtime channel
//
// Browsers gate audio playback behind a user gesture. Until the
// user clicks/taps/types somewhere, AudioContext is "suspended" and
// HTML <audio> elements play muted or not at all. This helper:
//   1. Lazily creates a singleton AudioContext on first user gesture.
//   2. Resumes it the moment the user interacts (fires the browser's
//      "click to enable audio" path).
//   3. playRingtone() loops public/sound/ringtone.mp3 until
//      stopRingtone() is called.
//
// KEY FIX — ringtone on first arrival: when a booking WS event fires
// before the user has ever interacted with the page, el.play() is
// blocked by autoplay policy. Instead of silently giving up we
// schedule a retry on the next user gesture, so the moment the admin
// clicks anywhere the ringtone starts. Without this the first
// booking of a session never rings.
// ============================================================

let _audioCtx: AudioContext | null = null;
let _ringtoneEl: HTMLAudioElement | null = null;
let _userGestureLatch = false;
let _retryUnlock: (() => void) | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (_audioCtx) return _audioCtx;
  const Ctor = (window.AudioContext ||
    // Safari prefix
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return null;
  try {
    _audioCtx = new Ctor();
  } catch {
    _audioCtx = null;
  }
  return _audioCtx;
}

/**
 * Call once on app mount. Installs listeners that unlock the
 * AudioContext on the first user gesture; they detach afterwards.
 */
export function installAudioUnlocker(): () => void {
  if (typeof window === "undefined") return () => undefined;
  if (_userGestureLatch) return () => undefined;

  const EVENTS = ["click", "touchstart", "keydown", "pointerdown", "scroll"] as const;

  const tryUnlock = () => {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {
        /* some browsers reject until a real gesture — try again next click */
      });
    }
    _userGestureLatch = true;
    EVENTS.forEach((e) =>
      window.removeEventListener(e, tryUnlock, { capture: true } as any)
    );
  };

  EVENTS.forEach((e) =>
    window.addEventListener(e, tryUnlock, { capture: true, passive: true } as any)
  );

  return () => {
    EVENTS.forEach((e) =>
      window.removeEventListener(e, tryUnlock, { capture: true } as any)
    );
  };
}

/**
 * Manually nudge the AudioContext — call from a user-facing button so
 * the click is guaranteed to count as a gesture.
 */
export async function unlockAudioOnce(): Promise<void> {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    try { await ctx.resume(); } catch { /* ignore */ }
  }
  _userGestureLatch = true;
}

// ── Ringtone ──────────────────────────────────────────────────────

const RINGTONE_SRC = "/sound/ringtone.mp3";

/** Retry the blocked play() on the next user gesture (autoplay fix). */
function scheduleRetryOnGesture(): void {
  if (_retryUnlock) return; // already waiting on a gesture
  const EVENTS = ["pointerdown", "keydown", "touchstart"] as const;

  const retry = () => {
    _retryUnlock = null;
    const el = _ringtoneEl;
    if (!el) return;
    el.play().catch(() => {
      /* give up silently — user chose not to enable audio */
    });
  };

  EVENTS.forEach((e) =>
    window.addEventListener(e, retry, { capture: true, once: true } as any)
  );
  _retryUnlock = () => {
    EVENTS.forEach((e) =>
      window.removeEventListener(e, retry, { capture: true } as any)
    );
  };
}

/**
 * Start playing the admin portal's ringtone. Loops until
 * stopRingtone() is called. Safe to call repeatedly — calling while
 * already playing is a no-op.
 */
export async function playRingtone(): Promise<void> {
  if (typeof window === "undefined") return;

  // Make sure audio is unlocked before we try to play — otherwise the
  // first playRingtone() in a fresh tab is silent.
  await unlockAudioOnce();

  if (_ringtoneEl) {
    if (_ringtoneEl.paused) {
      try { await _ringtoneEl.play(); } catch { /* ignore */ }
    }
    return;
  }

  const el = new Audio(RINGTONE_SRC);
  el.loop = true;
  el.preload = "auto";
  el.volume = 0.7;
  _ringtoneEl = el;
  try {
    await el.play();
  } catch (err) {
    // Autoplay blocked — keep the element and retry on the next user
    // gesture so the ringtone still fires when the admin interacts.
    scheduleRetryOnGesture();
    throw err;
  }
}

export function stopRingtone(): void {
  if (_retryUnlock) {
    _retryUnlock();
    _retryUnlock = null;
  }
  if (!_ringtoneEl) return;
  try {
    _ringtoneEl.pause();
    _ringtoneEl.currentTime = 0;
  } catch { /* noop */ }
  _ringtoneEl = null;
}

export function isRingtonePlaying(): boolean {
  return !!_ringtoneEl && !_ringtoneEl.paused;
}

// ── Notification permission helper ───────────────────────────────

export function notificationStatus(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return await Notification.requestPermission();
}

/** Browser-level notification as a backup when the tab is backgrounded. */
export function showLocalNotification(title: string, options?: NotificationOptions): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      ...options,
    });
  } catch {
    /* ignore — some browsers throw if called too often */
  }
}
