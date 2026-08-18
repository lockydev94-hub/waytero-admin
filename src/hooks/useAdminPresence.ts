// ============================================================
// WAYTERO ADMIN — ADMIN PRESENCE HEARTBEAT HOOK
// Doc Ref: Website Chat §3 — Smart routing
//
// Keeps this admin "online" in the backend Redis presence set while
// they are logged into the portal. The customer chat widget checks
// that set before offering a live chat, so routing only happens when
// someone is actually at the desk. Presence tracks "logged in", not
// "tab focused" — an admin who switches tabs (e.g. to glance at the
// customer website) stays online, so the widget keeps showing the
// team as available. Heartbeat every 30s; flips to offline on
// logout / tab close.
// ============================================================

import { useEffect, useRef } from "react";
import { chatService } from "../services/chat.service";

const HEARTBEAT_MS = 30_000;

export function useAdminPresence() {
  const onlineRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const beat = async () => {
      try {
        await chatService.presence("online");
        onlineRef.current = true;
      } catch {
        /* Redis / auth hiccup — retry next beat */
      }
    };

    const markOffline = async () => {
      if (!onlineRef.current) return;
      onlineRef.current = false;
      try {
        await chatService.presence("offline");
      } catch {
        /* best effort */
      }
    };

    void beat();
    const timer = window.setInterval(() => {
      if (!cancelled) void beat();
    }, HEARTBEAT_MS);
    const onUnload = () => void markOffline();
    window.addEventListener("beforeunload", onUnload);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("beforeunload", onUnload);
      void markOffline();
    };
  }, []);
}