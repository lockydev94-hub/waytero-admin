// ============================================================
// WAYTERO ADMIN — LOCK SCREEN
// The idle gate. Covers the whole viewport and the portal behind it is
// unmounted (see AdminLayout), so the sidebar, the notification bell and
// Ctrl+K search are gone rather than merely hidden.
//
// The session underneath is still valid — this is a screen lock, not a
// logout — so `mpin/verify` is the only call made here and it returns the
// admin to the page they were on. "Logout instead" is the escape hatch for
// an admin who cannot remember the PIN.
//
// The PIN is a fixed six digits and the input is six boxes: the last digit
// submits, so unlocking is type-type-type-type-type-type rather than typing
// then hunting for the button.
// ============================================================
import { useState } from "react";
import {
  Box, Button, Chip, CircularProgress, Dialog, DialogContent, Divider,
  Stack, Typography, alpha,
} from "@mui/material";
import { Lock as LockIcon, VerifiedUser } from "@mui/icons-material";
import type { AxiosError } from "axios";
import { mpinService } from "../../services/mpin.service";
import { authService } from "../../services/auth.service";
import { clearSession } from "../../services/api";
import { useAuthStore } from "../../stores/authStore";
import { useLockStore } from "../../stores/lockStore";
import { postSessionMessage } from "../../hooks/useBroadcastSession";
import { useCountdown } from "../../hooks/useCountdown";
import { MpinInput, MPIN_LENGTH } from "../auth/MpinInput";

/** The auth exceptions put their `details` in `errors`, which is looser than
 *  the generic ApiError shape — read only the two keys this screen uses. */
interface ErrorBody {
  success?: boolean;
  message?: string;
  code?: string;
  errors?: { attempts_remaining?: number; locked_until?: string };
}

export default function LockScreen() {
  const config = useLockStore((s) => s.sessionConfig);
  const lockedAt = useLockStore((s) => s.lockedAt);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  const [mpin, setMpin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(
    config?.mpin_attempts_remaining ?? null
  );
  const [lockedUntil, setLockedUntil] = useState<string | null>(
    config?.mpin_locked_until ?? null
  );
  const lockout = useCountdown(lockedUntil);
  const locked = !lockout.expired && lockedUntil !== null;

  async function submit(candidate?: string) {
    const pin = candidate ?? mpin;
    if (busy || locked || pin.length !== MPIN_LENGTH) return;
    setBusy(true);
    setError(null);
    try {
      await mpinService.verifyMpin(pin);
      useLockStore.getState().unlock();
      postSessionMessage({ type: "unlock" });
    } catch (err) {
      const body = (err as AxiosError<ErrorBody>)?.response?.data;
      const details = body?.errors ?? {};
      if (body?.code === "MPIN_LOCKED" && details.locked_until) {
        setLockedUntil(details.locked_until);
        setError(null);
      } else if (body?.code === "MPIN_INVALID") {
        setAttemptsLeft(details.attempts_remaining ?? null);
        setError(body.message || "That PIN is incorrect.");
      } else if (body?.code === "MPIN_NOT_SET") {
        // The PIN was removed in another tab; the overlay is now stale.
        useLockStore.getState().unlock();
        postSessionMessage({ type: "unlock" });
      } else {
        setError(
          body?.message ||
            "Could not reach the server. Check the connection and try again."
        );
      }
      setMpin("");
    } finally {
      setBusy(false);
    }
  }

  async function logoutInstead() {
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } catch {
      /* already expired server-side — the local clear is what matters */
    }
    // clearSession also drops the lock, so the login page is not shadowed.
    clearSession("/login");
  }

  return (
    <Dialog
      open
      fullScreen
      disableEscapeKeyDown
      disableRestoreFocus
      slotProps={{
        backdrop: { sx: { backgroundColor: "rgba(9, 14, 26, 0.97)" } },
        paper: { sx: { m: 0, maxWidth: "100%", height: "100vh", bgcolor: "#070C16", color: "#fff" } },
      }}
    >
      <DialogContent sx={{ p: 0, position: "relative", overflow: "hidden" }}>
        {/* Ambient light + a faint grid: makes the lock feel like a state of
            the product rather than a blank page with a field on it. */}
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 16% 18%, rgba(15,111,255,0.32), transparent 46%), radial-gradient(circle at 84% 80%, rgba(99,102,241,0.24), transparent 52%)",
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            opacity: 0.4,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
            backgroundSize: "46px 46px",
            maskImage: "radial-gradient(circle at 50% 38%, black, transparent 76%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 38%, black, transparent 76%)",
          }}
        />

        <Stack
          sx={{
            position: "relative",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            px: 2,
            py: 6,
          }}
        >
          <Box
            sx={{
              width: "100%",
              maxWidth: 468,
              p: { xs: 3, sm: 4.5 },
              borderRadius: 4,
              bgcolor: alpha("#ffffff", 0.045),
              border: `1px solid ${alpha("#ffffff", 0.09)}`,
              boxShadow: "0 32px 80px rgba(0,0,0,0.55)",
              backdropFilter: "blur(18px)",
            }}
          >
            <Stack alignItems="center" spacing={2.25}>
              <Box
                sx={{
                  width: 68,
                  height: 68,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  background:
                    "linear-gradient(140deg, rgba(15,111,255,0.42), rgba(99,102,241,0.16))",
                  border: `1px solid ${alpha("#7FB0FF", 0.36)}`,
                  boxShadow: `0 14px 34px ${alpha("#0F6FFF", 0.3)}`,
                }}
              >
                <LockIcon sx={{ fontSize: 30, color: "#9CC4FF" }} />
              </Box>

              <Box sx={{ textAlign: "center" }}>
                <Typography
                  sx={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}
                >
                  Dashboard locked
                </Typography>
                <Typography
                  sx={{
                    mt: 0.9,
                    fontSize: 13.5,
                    lineHeight: 1.65,
                    color: alpha("#ffffff", 0.66),
                    maxWidth: 340,
                    mx: "auto",
                  }}
                >
                  {lockedAt
                    ? `Inactive since ${new Date(lockedAt).toLocaleTimeString()}. Enter your 6-digit PIN to pick up where you left off.`
                    : "Enter your 6-digit PIN to pick up where you left off."}
                </Typography>
              </Box>

              <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center">
                <Chip
                  size="small"
                  icon={<VerifiedUser sx={{ fontSize: 14, color: "#8FD3A8 !important" }} />}
                  label="Session still active"
                  sx={{
                    bgcolor: alpha("#34D399", 0.12),
                    color: "#9BE7C4",
                    border: `1px solid ${alpha("#34D399", 0.28)}`,
                    fontSize: 11.5,
                    fontWeight: 600,
                    "& .MuiChip-icon": { ml: 1 },
                  }}
                />
                {attemptsLeft !== null && attemptsLeft > 0 && (
                  <Chip
                    size="small"
                    label={`${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left`}
                    sx={{
                      bgcolor: alpha("#F59E0B", 0.12),
                      color: "#F8CE8B",
                      border: `1px solid ${alpha("#F59E0B", 0.26)}`,
                      fontSize: 11.5,
                      fontWeight: 600,
                    }}
                  />
                )}
              </Stack>
            </Stack>

            <Box
              component="form"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
              sx={{ mt: 3.5 }}
            >
              <MpinInput
                value={mpin}
                onChange={setMpin}
                onComplete={(pin) => void submit(pin)}
                autoFocus
                tone="dark"
                size="lg"
                accent="#4C8DFF"
                disabled={busy || locked}
                error={Boolean(error)}
                ariaLabel="Unlock PIN"
              />

              {error && (
                <Typography
                  sx={{
                    mt: 1.5,
                    fontSize: 12.5,
                    textAlign: "center",
                    color: "#FFB4B4",
                  }}
                >
                  {error}
                </Typography>
              )}

              <Box sx={{ mt: 2.5 }}>
                {locked ? (
                  <Box
                    sx={{
                      py: 1.6,
                      px: 2,
                      borderRadius: 2.5,
                      textAlign: "center",
                      bgcolor: alpha("#EF4444", 0.1),
                      border: `1px solid ${alpha("#EF4444", 0.24)}`,
                    }}
                  >
                    <Typography sx={{ fontSize: 12.5, color: "#FFC9C9" }}>
                      Too many wrong PINs. Try again in{" "}
                      <Box component="span" sx={{ fontWeight: 700 }}>
                        {lockout.minutes}:{String(lockout.seconds).padStart(2, "0")}
                      </Box>
                      .
                    </Typography>
                  </Box>
                ) : (
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={busy || mpin.length !== MPIN_LENGTH}
                    startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
                    sx={{
                      py: 1.35,
                      borderRadius: 2.5,
                      textTransform: "none",
                      fontWeight: 700,
                      fontSize: 15,
                      background:
                        "linear-gradient(135deg, #2E7BFF 0%, #145EE0 100%)",
                      boxShadow: `0 12px 26px ${alpha("#0F6FFF", 0.34)}`,
                ":hover": { background: "linear-gradient(135deg, #3C86FF 0%, #1A66EE 100%)" },
                    }}
                  >
                    Unlock dashboard
                  </Button>
                )}
              </Box>
            </Box>

            <Divider sx={{ my: 2.5, borderColor: alpha("#ffffff", 0.08) }} />

            <Button
              onClick={() => void logoutInstead()}
              fullWidth
              size="small"
              sx={{
                color: alpha("#ffffff", 0.62),
                textTransform: "none",
                fontSize: 13,
                "&:hover": { bgcolor: alpha("#ffffff", 0.05), color: "#fff" },
              }}
            >
              Logout instead
            </Button>
          </Box>

          <Typography
            sx={{ mt: 3, fontSize: 11.5, color: alpha("#ffffff", 0.34), textAlign: "center" }}
          >
            WayTero admin · the PIN is verified on the server and never stored in this browser
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
