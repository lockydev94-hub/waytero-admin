// ============================================================
// WAYTERO ADMIN — AUTH TYPES
// Mirrors backend app/modules/auth/schemas/__init__.py
// LoginResponse: { user: AuthUserResponse, tokens: TokenResponse, session_id }
// ============================================================

export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "CCO"
  | "FINANCE_MANAGER"
  | "VERIFICATION_OFFICER";

/** Mirrors backend AuthUserResponse */
export interface AuthUser {
  id: string;
  mobile: string;
  email: string | null;
  full_name: string | null;
  user_type: UserRole;
  status: string;
  roles: string[];
  permissions: string[];
  is_mobile_verified: boolean;
  is_email_verified: boolean;
  must_change_password?: boolean;
  /** Staff with no unlock PIN: idle can only log them out, so the profile nudges. */
  must_set_mpin?: boolean;
  /** The admin's own account code — shown on their own profile. */
  user_code?: string | null;
  last_login_at?: string | null;
  partner_id?: number | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

/** Mirrors backend LoginResponse exactly */
export interface LoginResponse {
  user: AuthUser;
  tokens: TokenResponse;
  session_id: string;
}

export interface RefreshResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  roles: string[];
  permissions: string[];
}

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

/** Mirrors backend OTPSentResponse */
export interface OTPSentResponse {
  mobile_number: string;
  message: string;
  expires_in_seconds: number;
  dev_otp?: string | null;   // Only present in non-production (no SMS gateway)
}

export interface AdminSendOTPPayload {
  mobile: string;   // 10-digit Indian mobile
}

export interface AdminPasswordLoginPayload {
  username: string;   // email address or 10-digit Indian mobile
  password: string;
  device_name?: string;
}

export interface AdminOTPLoginPayload {
  mobile: string;   // 10-digit Indian mobile
  otp: string;
  device_name?: string;
}

/** Mirrors backend SessionConfigResponse — GET /auth/admin/session-config */
export interface SessionConfig {
  has_mpin: boolean;
  /** false = the account signs in with an OTP, so installing a PIN proves the
      mobile instead of asking for a password that does not exist */
  has_password: boolean;
  /** effective idle window (the admin's own value, or the platform default) */
  idle_minutes: number;
  /** the admin's own setting; null = inherits idle_default_minutes */
  idle_lock_minutes: number | null;
  idle_default_minutes: number;
  daily_logout_hour: number;
  timezone: string;
  /** ISO timestamp — the only clock the daily-logout deadline is counted against */
  server_now: string;
  mpin_locked_until: string | null;
  mpin_attempts_remaining: number | null;
  mpin_min_length: number;
  access_token_expires_in: number;
}

export interface ApiError {
  success: false;
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}
