// ============================================================
// WAYTERO ADMIN — CROSS-TAB SESSION CHANNEL
// One admin usually has several portal tabs open. Without sync, each tab
// would run its own idle timer: locking one while the other keeps working
// makes the lock decorative, and every tab heartbeating separately would
// double-count the admin's working minutes.
//
//   activity  — any tab's real input resets the idle window in all of them
//   lock      — one tab hitting the idle window locks every tab
//   unlock    — one MPIN entry frees every tab
//
// The heartbeat lease is a localStorage lock (not part of the channel):
// only the tab holding it sends work-minute heartbeats. Renewed every 20s
// and treated as abandoned after 45s so a crashed or closed tab releases it
// without a message.
// ============================================================
import { useEffect, useRef, useState } from "react";

const CHANNEL_NAME = "wt_admin_session";
const LEASE_KEY = "wt_admin_heartbeat_lease";
const LEASE_RENEW_MS = 20_000;
const LEASE_STALE_MS = 45_000;

export type SessionMessage =
  | { type: "activity"; ts: number }
  | { type: "lock" }
  | { type: "unlock" };

/** Unique per tab (per document), used as the lease owner id. */
const TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

let channel: BroadcastChannel | null = null;
const listeners = new Set<(message: SessionMessage) => void>();

function ensureChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (channel) return channel;
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent) => {
    const message = event.data as SessionMessage;
    listeners.forEach((fn) => fn(message));
  };
  return channel;
}

export function postSessionMessage(message: SessionMessage) {
  ensureChannel()?.postMessage(message);
}

export function useBroadcastSession(onMessage: (message: SessionMessage) => void) {
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    const wrapped = (message: SessionMessage) => handlerRef.current(message);
    listeners.add(wrapped);
    ensureChannel();
    return () => {
      listeners.delete(wrapped);
    };
  }, []);
}

// ------------------------------------------------------------ heartbeat lease

interface Lease {
  owner: string;
  renewedAt: number;
}

function readLease(): Lease | null {
  try {
    const raw = localStorage.getItem(LEASE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Lease;
    if (typeof parsed.owner !== "string" || typeof parsed.renewedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Claim or keep the lease; true when this tab owns it and should heartbeat. */
function tryClaimLease(): boolean {
  const now = Date.now();
  const current = readLease();
  const mine = current?.owner === TAB_ID;
  const abandoned = !current || now - current.renewedAt > LEASE_STALE_MS;
  if (!mine && !abandoned) return false;
  try {
    localStorage.setItem(LEASE_KEY, JSON.stringify({ owner: TAB_ID, renewedAt: now } satisfies Lease));
  } catch {
    return false;
  }
  return true;
}

export function releaseHeartbeatLease() {
  const current = readLease();
  if (current?.owner === TAB_ID) {
    try { localStorage.removeItem(LEASE_KEY); } catch { /* nothing to clean */ }
  }
}

/**
 * Whether this tab is the one allowed to send work-minute heartbeats.
 * Consumed by the work-hours capture hook; every other tab returns false.
 */
export function useHeartbeatLeader(enabled: boolean): boolean {
  const [isLeader, setIsLeader] = useState(false);

  useEffect(() => {
    if (!enabled) {
      releaseHeartbeatLease();
      setIsLeader(false);
      return;
    }
    const tick = () => setIsLeader(tryClaimLease());
    tick();
    const id = window.setInterval(tick, LEASE_RENEW_MS);
    return () => {
      window.clearInterval(id);
      releaseHeartbeatLease();
    };
  }, [enabled]);

  return isLeader;
}
