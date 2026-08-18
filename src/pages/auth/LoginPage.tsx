// ============================================================
// WAYTERO ADMIN — LOGIN PAGE (Password | OTP)
// Auth flows:
//   Method 1 — Password: email OR mobile + password (no OTP)
//              POST /auth/admin/login/password → JWT tokens
//   Method 2 — OTP:      mobile → send OTP → verify
//              POST /auth/admin/send-otp → POST /auth/admin/login/otp
//              In dev: response includes dev_otp (no SMS gateway) → shown in UI
//
// Dev mode: seed credentials are shown in a banner and auto-fillable.
// Production: credentials are never rendered in the UI.
// ============================================================
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box, Paper, Typography, TextField, Button, InputAdornment,
  IconButton, Alert, CircularProgress, Chip, Divider, Tabs, Tab,
  Collapse, alpha,
} from "@mui/material";
import {
  Visibility, VisibilityOff, Lock, FlightTakeoff,
  ContentCopy, CheckCircleOutline, InfoOutlined,
  AlternateEmail, Key, Smartphone, Password as PasswordIcon,
} from "@mui/icons-material";
import { useAuthStore } from "../../stores/authStore";
import { authService } from "../../services/auth.service";

// ── Dev credentials from env (NEVER rendered when APP_ENV === production) ──
const APP_ENV = import.meta.env.VITE_APP_ENV;
const IS_DEV = !APP_ENV || APP_ENV === "development" || APP_ENV === "dev";

const DEV_MOBILE   = import.meta.env.VITE_DEV_ADMIN_USERNAME ?? "9000000001";
const DEV_EMAIL    = import.meta.env.VITE_DEV_ADMIN_EMAIL    ?? "admin@waytero.dev";
const DEV_PASSWORD = import.meta.env.VITE_DEV_ADMIN_PASSWORD ?? "Admin@WayTero1";

// ── Validators ──
function looksLikeEmail(v: string) {
  return v.includes("@");
}

function isUsernameValid(v: string) {
  const t = v.trim();
  if (looksLikeEmail(t)) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
  return /^[6-9]\d{9}$/.test(t.replace(/[\s-]/g, ""));
}

function isMobileValid(v: string) {
  return /^[6-9]\d{9}$/.test(v.replace(/[\s-]/g, ""));
}

type LoginMethod = "password" | "otp";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [inactivityNotice, setInactivityNotice] = useState(
    searchParams.get("reason") === "inactivity"
  );

  const [method, setMethod] = useState<LoginMethod>("password");

  // ── Method 1: password ──
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // ── Method 2: OTP ──
  const [otpMobile, setOtpMobile] = useState("");
  const [otpSent, setOtpSent]     = useState(false);
  const [otp, setOtp]             = useState("");
  const [devOtp, setDevOtp]       = useState<string | null>(null);

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [copied, setCopied]     = useState<string | null>(null);

  const passValid   = isUsernameValid(username) && password.length >= 8;
  const mobileValid = isMobileValid(otpMobile);
  const otpValid    = /^\d{6}$/.test(otp);

  function copy(value: string, label: string) {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  function fillDev() {
    setMethod("password");
    setUsername(DEV_MOBILE);
    setPassword(DEV_PASSWORD);
    setError(null);
  }

  function switchMethod(next: LoginMethod) {
    setMethod(next);
    setError(null);
  }

  // ── Method 1: password login ──
  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!passValid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authService.loginWithPassword({
        username: username.trim(),
        password,
      });
      setAuth(res.user, res.tokens.access_token, res.tokens.refresh_token);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        err?.response?.data?.message ??
        "Invalid credentials. Please check and try again.";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }

  // ── Method 2: send OTP ──
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!mobileValid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authService.sendAdminOtp(otpMobile.replace(/[\s-]/g, ""));
      if (res.dev_otp) {
        setDevOtp(res.dev_otp);
        setOtp(res.dev_otp); // auto-fill in dev
      }
      setOtpSent(true);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        err?.response?.data?.message ??
        "Failed to send OTP. Try again.";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }

  // ── Method 2: OTP login ──
  async function handleOtpLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!otpValid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authService.loginWithOtp({
        mobile: otpMobile.replace(/[\s-]/g, ""),
        otp,
      });
      setAuth(res.user, res.tokens.access_token, res.tokens.refresh_token);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ?? err?.response?.data?.message;
      setError(
        typeof detail === "string" ? detail : "Login failed. Check your OTP and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function backToMobile() {
    setOtpSent(false);
    setOtp("");
    setDevOtp(null);
    setError(null);
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        background: "linear-gradient(135deg, #0B1120 0%, #0F1E3C 55%, #0a2a1a 100%)",
      }}
    >
      {/* ── Brand Panel (desktop only) ── */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "space-between",
          width: "46%",
          p: 6,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box sx={{ position: "absolute", top: -100, left: -100, width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle, rgba(15,111,255,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
        <Box sx={{ position: "absolute", bottom: -60, right: -80, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(20,184,166,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />

        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ width: 46, height: 46, borderRadius: 2, background: "linear-gradient(135deg,#0F6FFF,#14B8A6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(15,111,255,0.4)" }}>
            <FlightTakeoff sx={{ color: "#fff", fontSize: 22 }} />
          </Box>
          <Box>
            <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 22, lineHeight: 1 }}>WayTero</Typography>
            <Typography sx={{ color: "#64748B", fontSize: 12, lineHeight: 1.3 }}>Admin Control Center</Typography>
          </Box>
        </Box>

        <Box>
          <Typography sx={{ color: "#fff", fontSize: 38, fontWeight: 700, lineHeight: 1.25, mb: 2 }}>
            Every journey<br />managed from<br />
            <Box component="span" sx={{ color: "#14B8A6" }}>one command center.</Box>
          </Typography>
          <Typography sx={{ color: "#64748B", fontSize: 15, lineHeight: 1.7, maxWidth: 340 }}>
            Bookings, partners, drivers, hotels, finance, and operations — unified in a single intelligent platform.
          </Typography>
          <Box sx={{ display: "flex", gap: 4, mt: 4 }}>
            {[["15K+", "Customers"], ["350+", "Partners"], ["55K+", "Bookings"]].map(([v, l]) => (
              <Box key={l}>
                <Typography sx={{ color: "#0F6FFF", fontWeight: 800, fontSize: 24 }}>{v}</Typography>
                <Typography sx={{ color: "#475569", fontSize: 12 }}>{l}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Typography sx={{ color: "#1E293B", fontSize: 12 }}>
          © {new Date().getFullYear()} WayTero Technologies Pvt. Ltd.
        </Typography>
      </Box>

      {/* ── Login Form Panel ── */}
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", p: { xs: 2, sm: 4 } }}>
        <Box sx={{ width: "100%", maxWidth: 420 }}>

          {/* ── Dev credentials banner (never rendered in production) ── */}
          {IS_DEV && (
            <Paper elevation={0} sx={{ mb: 2, p: 1.5, borderRadius: 2, border: "1px solid", borderColor: alpha("#F59E0B", 0.4), bgcolor: alpha("#F59E0B", 0.06) }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <InfoOutlined sx={{ fontSize: 16, color: "warning.main" }} />
                <Typography variant="caption" fontWeight={700} color="warning.main" sx={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Dev Mode — Seed Credentials
                </Typography>
              </Box>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                {[
                  { label: "Mobile", value: DEV_MOBILE },
                  { label: "Email", value: DEV_EMAIL },
                  { label: "Password", value: DEV_PASSWORD },
                ].map(({ label, value }) => (
                  <Box key={label} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", bgcolor: alpha("#0F172A", 0.3), borderRadius: 1, px: 1.5, py: 0.75 }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: "#64748B", display: "block", lineHeight: 1 }}>{label}</Typography>
                      <Typography variant="caption" fontWeight={600} sx={{ color: "#E2E8F0", fontFamily: "monospace" }}>{value}</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => copy(value, label)} sx={{ color: copied === label ? "success.main" : "#64748B" }}>
                      {copied === label ? <CheckCircleOutline sx={{ fontSize: 14 }} /> : <ContentCopy sx={{ fontSize: 14 }} />}
                    </IconButton>
                  </Box>
                ))}
              </Box>
              <Button size="small" variant="outlined" color="warning" fullWidth sx={{ mt: 1.5, height: 30, fontSize: 12, fontWeight: 600 }} onClick={fillDev}>
                Auto-fill credentials
              </Button>
            </Paper>
          )}

          {/* ── Login card ── */}
          <Paper elevation={0} sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
            {/* Mobile logo */}
            <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1.5, mb: 3 }}>
              <Box sx={{ width: 36, height: 36, borderRadius: 1.5, background: "linear-gradient(135deg,#0F6FFF,#14B8A6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FlightTakeoff sx={{ color: "#fff", fontSize: 18 }} />
              </Box>
              <Typography fontWeight={800} fontSize={18}>WayTero Admin</Typography>
            </Box>

            <Typography variant="h5" fontWeight={700} mb={0.5}>
              Admin sign in
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2.5}>
              Secure access for authorised WayTero staff.
            </Typography>

            {/* ── Method switcher ── */}
            <Tabs
              value={method}
              onChange={(_, v: LoginMethod) => switchMethod(v)}
              variant="fullWidth"
              sx={{
                mb: 2.5,
                minHeight: 40,
                "& .MuiTab-root": { minHeight: 40, fontSize: 13, fontWeight: 700, textTransform: "none" },
                "& .MuiTabs-indicator": { height: 3, borderRadius: "3px 3px 0 0" },
              }}
            >
              <Tab icon={<PasswordIcon sx={{ fontSize: 16 }} />} iconPosition="start" value="password" label="Password" />
              <Tab icon={<Smartphone sx={{ fontSize: 16 }} />} iconPosition="start" value="otp" label="OTP" />
            </Tabs>

            {inactivityNotice && (
              <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setInactivityNotice(false)}>
                You were signed out automatically after 10 minutes of inactivity. Please sign in again.
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* ── Method 1: Email / Mobile + Password ── */}
            <Collapse in={method === "password"} unmountOnExit>
              <Box component="form" onSubmit={handlePasswordLogin} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Box>
                  <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 0.5, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Email or Mobile
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="admin@waytero.dev  or  9000000001"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <AlternateEmail fontSize="small" sx={{ color: "text.secondary" }} />
                        </InputAdornment>
                      ),
                    }}
                    inputProps={{ autoComplete: "username" }}
                    disabled={loading}
                    autoFocus
                  />
                  <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: "block" }}>
                    Your registered email address or mobile number
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 0.5, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Password
                  </Typography>
                  <TextField
                    fullWidth
                    type={showPass ? "text" : "password"}
                    placeholder="Your admin password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock fontSize="small" sx={{ color: "text.secondary" }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowPass(!showPass)} edge="end">
                            {showPass ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    inputProps={{ autoComplete: "current-password" }}
                    disabled={loading}
                    onKeyDown={(e) => { if (e.key === "Enter") handlePasswordLogin(e); }}
                  />
                </Box>

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={!passValid || loading}
                  sx={{ mt: 0.5, height: 48, fontWeight: 700, fontSize: 15 }}
                >
                  {loading ? <CircularProgress size={22} color="inherit" /> : "Sign In"}
                </Button>
              </Box>
            </Collapse>

            {/* ── Method 2: Mobile + OTP ── */}
            <Collapse in={method === "otp"} unmountOnExit>
              {!otpSent ? (
                <Box component="form" onSubmit={handleSendOtp} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <Box>
                    <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 0.5, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Mobile Number
                    </Typography>
                    <TextField
                      fullWidth
                      placeholder="9000000001"
                      value={otpMobile}
                      onChange={(e) => setOtpMobile(e.target.value.replace(/[^\d\s-]/g, ""))}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Smartphone fontSize="small" sx={{ color: "text.secondary" }} />
                          </InputAdornment>
                        ),
                      }}
                      inputProps={{ inputMode: "numeric", autoComplete: "tel" }}
                      disabled={loading}
                      autoFocus
                    />
                    <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: "block" }}>
                      We'll send a 6-digit OTP to this number
                    </Typography>
                  </Box>

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={!mobileValid || loading}
                    sx={{ mt: 0.5, height: 48, fontWeight: 700, fontSize: 15 }}
                  >
                    {loading ? <CircularProgress size={22} color="inherit" /> : "Send OTP"}
                  </Button>
                </Box>
              ) : (
                <Box component="form" onSubmit={handleOtpLogin} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {/* Dev OTP banner */}
                  {IS_DEV && devOtp && (
                    <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: alpha("#14B8A6", 0.5), bgcolor: alpha("#14B8A6", 0.06) }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                        <Key sx={{ fontSize: 16, color: "#14B8A6" }} />
                        <Typography variant="caption" fontWeight={700} sx={{ color: "#14B8A6", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Dev Mode — OTP Intercepted
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: "#64748B", display: "block", mb: 1 }}>
                        No SMS gateway is configured. The backend returned this OTP directly and it has been auto-filled below.
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", bgcolor: alpha("#0F172A", 0.4), borderRadius: 1, px: 1.5, py: 1 }}>
                        <Typography sx={{ fontFamily: "monospace", fontWeight: 800, fontSize: 26, color: "#14B8A6", letterSpacing: "0.3em" }}>
                          {devOtp}
                        </Typography>
                        <IconButton size="small" onClick={() => copy(devOtp, "otp")} sx={{ color: copied === "otp" ? "success.main" : "#64748B" }}>
                          {copied === "otp" ? <CheckCircleOutline sx={{ fontSize: 16 }} /> : <ContentCopy sx={{ fontSize: 16 }} />}
                        </IconButton>
                      </Box>
                    </Paper>
                  )}

                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                      <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        6-digit OTP
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        Sent to <b>+91 ****{otpMobile.replace(/[\s-]/g, "").slice(-4)}</b>
                      </Typography>
                    </Box>
                    <TextField
                      fullWidth
                      placeholder="• • • • • •"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Key fontSize="small" sx={{ color: "text.secondary" }} />
                          </InputAdornment>
                        ),
                        endAdornment: otp.length === 6 ? (
                          <InputAdornment position="end">
                            <CheckCircleOutline fontSize="small" sx={{ color: "success.main" }} />
                          </InputAdornment>
                        ) : null,
                      }}
                      inputProps={{
                        inputMode: "numeric",
                        maxLength: 6,
                        style: { letterSpacing: "0.35em", fontSize: 22, fontWeight: 700 },
                      }}
                      disabled={loading}
                      autoFocus
                    />
                    {!IS_DEV && (
                      <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: "block" }}>
                        OTP expires in 5 minutes
                      </Typography>
                    )}
                  </Box>

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={!otpValid || loading}
                    sx={{ height: 48, fontWeight: 700, fontSize: 15 }}
                  >
                    {loading ? <CircularProgress size={22} color="inherit" /> : "Sign In with OTP"}
                  </Button>

                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Button variant="text" size="small" onClick={backToMobile} disabled={loading} sx={{ color: "text.secondary" }}>
                      ← Change number
                    </Button>
                    <Button variant="text" size="small" onClick={handleSendOtp} disabled={loading} sx={{ color: "text.secondary" }}>
                      Resend OTP
                    </Button>
                  </Box>
                </Box>
              )}
            </Collapse>

            <Divider sx={{ my: 2.5 }}>
              <Chip label="Secure Access" size="small" sx={{ fontSize: 11, color: "text.secondary" }} />
            </Divider>

            <Typography variant="caption" color="text.secondary" align="center" display="block">
              Access restricted to authorised WayTero staff only.
            </Typography>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
