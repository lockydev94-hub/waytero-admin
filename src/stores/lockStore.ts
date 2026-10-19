// ============================================================
// WAYTERO ADMIN — LOCK STORE
// The dashboard lock: an idle gate in front of a session that is still
// alive. Tokens are deliberately NOT touched here — unlocking returns the
// admin to the same page. Kept out of authStore (a lock is not a logout)
// and out of uiStore (which is cosmetic and not persisted for this).
//
// Persistence is hand-rolled instead of zustand/persist: the ticker
// writes `idleRemainingMs` every second and only these four fields are
// worth putting on disk. `lastActivityTs` is persisted so refreshing the
// tab cannot buy a fresh idle window.
// ============================================================
import { create } from "zustand";
import type { SessionConfig } from "../types/auth";

const PERSIST_KEY = "wt_admin_lock";
const PERSIST_ACTIVITY_EVERY_MS = 2_000;
const DAY_MS = 24 * 60 * 60 * 1000;

interface PersistedLock {
  isLocked: boolean;
  lockedAt: string | null;
  lastActivityTs: number;
  sessionConfig: SessionConfig | null;
}

interface LockStore extends PersistedLock {
  /** serverNow - Date.now() at fetch time; corrects a wrong laptop clock */
  serverOffsetMs: number;
  /** epoch ms of the next forced daily logout, derived from server_now */
  dailyDeadlineTs: number | null;
  /** ms left in the idle window, written by useIdleLock once a second */
  idleRemainingMs: number;

  setSessionConfig: (config: SessionConfig) => void;
  setIdleRemaining: (ms: number) => void;
  markActivity: (ts?: number) => void;
  lock: () => void;
  unlock: () => void;
  /** a fresh sign-in: unlocked, with the idle window starting now */
  startSession: () => void;
}

function readPersisted(): PersistedLock {
  const now = Date.now();
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedLock>;
      return {
        isLocked: Boolean(parsed.isLocked),
        lockedAt: typeof parsed.lockedAt === "string" ? parsed.lockedAt : null,
        lastActivityTs:
          typeof parsed.lastActivityTs === "number" ? parsed.lastActivityTs : now,
        sessionConfig: parsed.sessionConfig ?? null,
      };
    }
  } catch {
    /* corrupt or unavailable storage — fall through to a fresh session */
  }
  return { isLocked: false, lockedAt: null, lastActivityTs: now, sessionConfig: null };
}

let lastPersistTs = 0;

function persist(state: PersistedLock, force = false) {
  const now = Date.now();
  if (!force && now - lastPersistTs < PERSIST_ACTIVITY_EVERY_MS) return;
  lastPersistTs = now;
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota — the in-memory lock still works */
  }
}

const OFFSET_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

/** Milliseconds to add to a UTC instant to read the wall clock in `timeZone`. */
function wallClockOffsetMs(atMs: number, timeZone: string): number {
  let fmt = OFFSET_FORMATTERS.get(timeZone);
  if (!fmt) {
    try {
      fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour12: false,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
    } catch {
      // Unknown zone (a bad PLATFORM_TIMEZONE row) — fall back to UTC rather
      // than losing the daily-logout rule entirely.
      return 0;
    }
    OFFSET_FORMATTERS.set(timeZone, fmt);
  }
  const parts = fmt.formatToParts(new Date(atMs)).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const hour = Number(parts.hour === "24" ? "0" : parts.hour ?? "0");
  const asWallUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    hour, Number(parts.minute), Number(parts.second)
  );
  return asWallUtc - Math.floor(atMs / 1000) * 1000;
}

/**
 * Next occurrence of `hour`:00 in the platform timezone, as epoch ms.
 *
 * Counted from a trusted "now" (see `trustedNowMs`), never the laptop clock,
 * so a machine set to 1999 cannot sit out the 23:00 rule. The +24h rollover is
 * exact for fixed-offset zones; `Asia/Kolkata` has no DST, and a DST-aware
 * zone would re-derive the deadline on the next session-config fetch anyway.
 */
export function nextDailyDeadlineTs(hour: number, timeZone: string, nowMs: number): number {
  const offset = wallClockOffsetMs(nowMs, timeZone);
  const wall = new Date(nowMs + offset);
  const todayAtHour =
    Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate(), hour) - offset;
  return todayAtHour > nowMs ? todayAtHour : todayAtHour + DAY_MS;
}

export const useLockStore = create<LockStore>((set, get) => {
  const initial = readPersisted();
  // serverOffsetMs is not persisted, so the deadline is re-derived on the next
  // session-config fetch; the local clock is only used for this first pass.
  const daily = initial.sessionConfig
    ? nextDailyDeadlineTs(initial.sessionConfig.daily_logout_hour, initial.sessionConfig.timezone, Date.now())
    : null;

  const write = (patch: Partial<LockStore>, force = false) => {
    set(patch);
    const s = get();
    persist(
      { isLocked: s.isLocked, lockedAt: s.lockedAt, lastActivityTs: s.lastActivityTs, sessionConfig: s.sessionConfig },
      force
    );
  };

  return {
    ...initial,
    serverOffsetMs: 0,
    dailyDeadlineTs: daily,
    idleRemainingMs: (initial.sessionConfig?.idle_minutes ?? 5) * 60_000,

    setSessionConfig: (config) => {
      const serverNowMs = new Date(config.server_now).getTime();
      const serverOffsetMs = Number.isFinite(serverNowMs)
        ? serverNowMs - Date.now()
        : 0;
      write({
        sessionConfig: config,
        serverOffsetMs,
        dailyDeadlineTs: nextDailyDeadlineTs(config.daily_logout_hour, config.timezone, Date.now() + serverOffsetMs),
      }, true);
    },

    setIdleRemaining: (ms) => set({ idleRemainingMs: ms }),

    markActivity: (ts) => {
      const now = ts ?? Date.now();
      if (now <= get().lastActivityTs) return;
      write({ lastActivityTs: now });
    },

    lock: () => {
      if (get().isLocked) return;
      write({ isLocked: true, lockedAt: new Date().toISOString(), lastActivityTs: Date.now() }, true);
    },

    unlock: () => {
      write({ isLocked: false, lockedAt: null, lastActivityTs: Date.now() }, true);
    },

    startSession: () => {
      write({ isLocked: false, lockedAt: null, lastActivityTs: Date.now() }, true);
    },
  };
});

/**
 * "Now" as the portal believes it, in epoch ms — the laptop clock corrected by
 * the offset taken from the last session-config fetch. Only the daily-logout
 * rule needs this; idle is measured as a delta, so an absolute clock skew does
 * not affect it.
 */
export function trustedNowMs(): number {
  return Date.now() + useLockStore.getState().serverOffsetMs;
}

/** Drop the lock state entirely (logout / session clear). */
export function clearLockState() {
  useLockStore.getState().startSession();
}
