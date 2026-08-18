// ============================================================
// WAYTERO ADMIN — AUTH SERVICE
// Doc: Auth API
//   Method 1 (Password): POST /auth/admin/login/password
//           { username: email OR mobile, password } → JWT tokens (no OTP)
//   Method 2 (OTP):     POST /auth/admin/send-otp
//           { mobile } → sends OTP to admin's registered mobile
//           → response includes dev_otp when APP_ENV != production (no SMS gateway)
//           POST /auth/admin/login/otp
//           { mobile, otp } → JWT tokens
// ============================================================
import apiClient from "./api";
import type { LoginResponse, OTPSentResponse, RefreshResponse } from "../types/auth";

export const authService = {
  /**
   * Method 2, step 1: Send a login OTP to an admin's registered mobile.
   * Returns OTPSentResponse which includes dev_otp in non-production environments.
   */
  sendAdminOtp: async (mobile: string): Promise<OTPSentResponse> => {
    const res = await apiClient.post<OTPSentResponse>("/auth/admin/send-otp", {
      mobile,
    });
    return res.data;
  },

  /**
   * Method 1: Admin password login — POST /auth/admin/login/password
   * username = email address OR 10-digit Indian mobile. No OTP required.
   */
  loginWithPassword: async (payload: {
    username: string;
    password: string;
    device_name?: string;
  }): Promise<LoginResponse> => {
    const res = await apiClient.post<LoginResponse>("/auth/admin/login/password", {
      username:    payload.username,
      password:    payload.password,
      device_name: payload.device_name ?? "Admin Portal Web",
    });
    return res.data;
  },

  /**
   * Method 2, step 2: Admin OTP login — POST /auth/admin/login/otp
   * mobile + the OTP received via sendAdminOtp.
   */
  loginWithOtp: async (payload: {
    mobile: string;
    otp: string;
    device_name?: string;
  }): Promise<LoginResponse> => {
    const res = await apiClient.post<LoginResponse>("/auth/admin/login/otp", {
      mobile:       payload.mobile,
      otp:          payload.otp,
      device_name:  payload.device_name ?? "Admin Portal Web",
    });
    return res.data;
  },

  /** POST /auth/logout */
  logout: async (refreshToken: string): Promise<void> => {
    await apiClient.post("/auth/logout", {
      refresh_token: refreshToken,
      logout_all_devices: false,
    });
  },

  /** GET /auth/me */
  getMe: async () => {
    const res = await apiClient.get("/auth/me");
    return res.data.data;
  },

  /** POST /auth/refresh */
  refresh: async (refreshToken: string): Promise<RefreshResponse> => {
    const res = await apiClient.post<RefreshResponse>("/auth/refresh", {
      refresh_token: refreshToken,
    });
    return res.data;
  },
};
