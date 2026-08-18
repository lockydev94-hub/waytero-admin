// ============================================================
// WAYTERO ADMIN PORTAL — REALTIME WEBSOCKET HOOK
// Doc Ref: BRD Part 7 §155 — Realtime channel
//
// Identical contract to the partner portal hook (see
// partner-portal/src/hooks/useRealtime.ts). Lives in this repo so
// the admin portal can subscribe to the same /ws endpoint without
// a shared package.
// ============================================================

import { useEffect, useRef, useState, useCallback } from "react";
import { API_BASE_URL, TOKEN_KEYS } from "../constants";

export type WSStatus = "idle" | "connecting" | "open" | "closed";

export interface WSMessage<T = unknown> {
  event: string;
  data: T;
  ts: string;
}

type Handler<T = unknown> = (msg: WSMessage<T>) => void;

function wsBaseUrl(): string {
  const api = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
  return api.replace(/^http/, "ws");
}

export function useRealtime(options: { reconnectOnFocus?: boolean } = {}) {
  const [status, setStatus] = useState<WSStatus>("idle");
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<Handler>>>(new Map());
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectDelayRef = useRef<number>(1000);
  const pingTimerRef = useRef<number | null>(null);
  const isUnmountedRef = useRef(false);
  const { reconnectOnFocus = true } = options;

  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;
    const token = localStorage.getItem(TOKEN_KEYS.ACCESS);
    if (!token) {
      setStatus("idle");
      return;
    }
    const openSocket = () => {
      if (isUnmountedRef.current) return;
      if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;
      setStatus("connecting");
      const url = `${wsBaseUrl()}/ws?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      attachHandlers(ws);
    };

    if (typeof document !== "undefined" && document.readyState !== "complete") {
      const onLoaded = () => {
        if (isUnmountedRef.current) return;
        const ric = (window as any).requestIdleCallback as
          | ((cb: () => void, opts?: { timeout: number }) => number)
          | undefined;
        if (typeof ric === "function") ric(openSocket, { timeout: 1500 });
        else window.setTimeout(openSocket, 250);
      };
      if (document.readyState === "interactive") {
        window.addEventListener("load", onLoaded, { once: true });
      } else {
        onLoaded();
      }
      return;
    }

    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    if (typeof ric === "function") ric(openSocket, { timeout: 500 });
    else window.setTimeout(openSocket, 0);
  }, []);

  const attachHandlers = useCallback((ws: WebSocket) => {
    ws.onopen = () => {
      setStatus("open");
      reconnectDelayRef.current = 1000;
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as WSMessage;
        if (msg && typeof msg === "object" && msg.event) {
          if (msg.event === "ping") {
            try { ws.send(JSON.stringify({ type: "pong" })); } catch { /* ignore */ }
            return;
          }
          if (msg.event === "pong") return;
          const set = handlersRef.current.get(msg.event);
          if (set) {
            set.forEach((h) => {
              try { h(msg); } catch (err) {
                console.error("ws.handler_err event=", msg.event, err);
              }
            });
          }
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => { /* let onclose handle reconnect */ };

    ws.onclose = () => {
      setStatus("closed");
      if (wsRef.current === ws) wsRef.current = null;
      if (isUnmountedRef.current) return;
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, 30_000);
      reconnectTimerRef.current = window.setTimeout(connect, delay);
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingTimerRef.current) {
      window.clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      try { wsRef.current.close(); } catch { /* noop */ }
      wsRef.current = null;
    }
    setStatus("closed");
  }, []);

  useEffect(() => {
    if (status !== "open") return;
    pingTimerRef.current = window.setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      try { ws.send(JSON.stringify({ type: "ping" })); } catch { /* ignore */ }
    }, 20_000);
    return () => {
      if (pingTimerRef.current) {
        window.clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
    };
  }, [status]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();
    return () => {
      isUnmountedRef.current = true;
      disconnect();
    };
  }, [connect, disconnect]);

  useEffect(() => {
    if (!reconnectOnFocus) return;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (status !== "open") {
        disconnect();
        reconnectDelayRef.current = 1000;
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [connect, disconnect, reconnectOnFocus, status]);

  const subscribe = useCallback(
    <T = unknown,>(event: string, handler: Handler<T>) => {
      let set = handlersRef.current.get(event);
      if (!set) {
        set = new Set();
        handlersRef.current.set(event, set);
      }
      set.add(handler as Handler);
      return () => {
        const s = handlersRef.current.get(event);
        if (s) {
          s.delete(handler as Handler);
          if (s.size === 0) handlersRef.current.delete(event);
        }
      };
    },
    []
  );

  return { status, subscribe };
}
