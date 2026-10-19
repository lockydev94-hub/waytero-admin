// ============================================================
// WAYTERO ADMIN — MPIN / SESSION-POLICY SERVICE
// Doc: Backend app/modules/auth/api.py — /auth/admin/*
//   GET    /auth/admin/session-config        → SessionConfig (flat, no envelope)
//   POST   /auth/admin/mpin/set|change|verify → {success, data: SessionConfig}
//   DELETE /auth/admin/mpin                   → {success, data: SessionConfig}
//   PUT    /auth/admin/idle-lock-minutes      → {success, data: SessionConfig}
//
// `verify` issues no tokens: the lock is a screen gate, the session underneath
// it is untouched. Every mutation returns the refreshed policy so the shell
// (topbar chip, idle timer, lock screen) re-arms from one response instead of
// firing a second request.
//
// A PIN is never sent back by the server and never kept in client state.
// ============================================================
import apiClient from "./api";
import type { OTPSentResponse, SessionConfig } from "../types/auth";

type ConfigEnvelope = { success: boolean; data: SessionConfig };

export const mpinService = {
  getSessionConfig: async (): Promise<SessionConfig> => {
    const res = await apiClient.get<SessionConfig>("/auth/admin/session-config");
    return res.data;
  },

  setMpin: async (payload: {
    mpin: string;
    confirm_mpin: string;
    current_password?: string;
    otp?: string;
  }): Promise<SessionConfig> => {
    const res = await apiClient.post<ConfigEnvelope>("/auth/admin/mpin/set", payload);
    return res.data.data;
  },

  /** OTP to the signed-in admin's own registered mobile — the ownership proof
   *  for an account that has no password. The number is never sent in the body. */
  sendMpinOtp: async (): Promise<OTPSentResponse> => {
    const res = await apiClient.post<OTPSentResponse>("/auth/admin/mpin/otp");
    return res.data;
  },

  changeMpin: async (payload: {
    current_mpin: string;
    new_mpin: string;
    confirm_mpin: string;
  }): Promise<SessionConfig> => {
    const res = await apiClient.post<ConfigEnvelope>(
      "/auth/admin/mpin/change",
      payload
    );
    return res.data.data;
  },

  verifyMpin: async (mpin: string): Promise<void> => {
    await apiClient.post("/auth/admin/mpin/verify", { mpin });
  },

  removeMpin: async (payload: {
    current_password?: string;
    current_mpin?: string;
  }): Promise<SessionConfig> => {
    // axios sends a DELETE body under `data`.
    const res = await apiClient.delete<ConfigEnvelope>("/auth/admin/mpin", {
      data: payload,
    });
    return res.data.data;
  },

  setIdleLockMinutes: async (
    idle_lock_minutes: number | null
  ): Promise<SessionConfig> => {
    const res = await apiClient.put<ConfigEnvelope>(
      "/auth/admin/idle-lock-minutes",
      { idle_lock_minutes }
    );
    return res.data.data;
  },
};
