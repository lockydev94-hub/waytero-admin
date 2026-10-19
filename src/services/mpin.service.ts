// ============================================================
// WAYTERO ADMIN — MPIN / SESSION-POLICY SERVICE
// Doc: Backend app/modules/auth/api.py — /auth/admin/*
//   GET    /auth/admin/session-config   → SessionConfig (flat, no envelope)
//   POST   /auth/admin/mpin/verify      → unlocks the dashboard lock
// `verify` issues no tokens: the lock is a screen gate, the session
// underneath it is untouched.
// ============================================================
import apiClient from "./api";
import type { SessionConfig } from "../types/auth";

export const mpinService = {
  getSessionConfig: async (): Promise<SessionConfig> => {
    const res = await apiClient.get<SessionConfig>("/auth/admin/session-config");
    return res.data;
  },

  verifyMpin: async (mpin: string): Promise<void> => {
    await apiClient.post("/auth/admin/mpin/verify", { mpin });
  },
};
