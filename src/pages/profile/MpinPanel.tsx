// ============================================================
// WAYTERO ADMIN — UNLOCK PIN PANEL (profile → Unlock PIN tab)
// Doc: Admin Portal §39 Security; migration 0084.
//
// Installing, rotating or removing the PIN all demand proof that the caller
// really is this admin — the account password, an OTP to their own mobile, or
// the current PIN — because a stolen live session token must not be able to
// build the gate that locks the real admin out.
//
// A PIN is never logged, never stored outside this component's state, and
// never returned by the server. Each mutation answers with the refreshed
// policy, which goes straight into the lock store so the topbar chip and the
// idle timer re-arm without a second request.
// ============================================================
import { useState } from "react";
import { Alert, Box, Button, Divider, Grid, Stack, Typography } from "@mui/material";
import { Send } from "@mui/icons-material";
import type { AxiosError } from "axios";
import { useSnackbar } from "notistack";
import { mpinService } from "../../services/mpin.service";
import { apiErrorMessage } from "../../utils/apiError";
import { useAuthStore } from "../../stores/authStore";
import { useLockStore } from "../../stores/lockStore";
import { useCountdown } from "../../hooks/useCountdown";
import { PinField } from "./PinField";
import { MpinInput, MPIN_LENGTH } from "../../components/auth/MpinInput";
import type { SessionConfig } from "../../types/auth";

interface ErrorBody {
  message?: string;
  code?: string;
  errors?: { locked_until?: string; attempts_remaining?: number };
}

function bodyOf(err: unknown): ErrorBody {
  return (err as AxiosError<ErrorBody>)?.response?.data ?? {};
}

export function MpinPanel() {
  const { enqueueSnackbar } = useSnackbar();
  const config = useLockStore((s) => s.sessionConfig);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(
    config?.mpin_locked_until ?? null
  );
  const lockout = useCountdown(lockedUntil);

  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const [currentPin, setCurrentPin] = useState("");
  const [changedNew, setChangedNew] = useState("");
  const [changedConfirm, setChangedConfirm] = useState("");

  const [removeProof, setRemoveProof] = useState("");

  // The PIN is exactly MPIN_LENGTH digits in the schema, the server and the
  // six boxes below — `mpin_min_length` stays in the payload for older shells.
  const hasMpin = Boolean(config?.has_mpin);
  // Until the policy arrives, ask for the password: it is the proof that works
  // for the accounts this platform issues today, and a wrong guess is refused.
  const hasPassword = config?.has_password ?? true;
  const locked = Boolean(lockedUntil) && !lockout.expired;
  const attemptsLeft = config?.mpin_attempts_remaining ?? null;

  function applyPolicy(next: SessionConfig) {
    useLockStore.getState().setSessionConfig(next);
    setLockedUntil(next.mpin_locked_until);
    if (user) setUser({ ...user, must_set_mpin: !next.has_mpin });
  }

  /** Run one PIN mutation, mapping the server's PIN error codes onto this UI. */
  async function submit(
    action: () => Promise<SessionConfig>,
    done: string,
    fallback: string
  ) {
    setBusy(true);
    setMessage(null);
    try {
      const next = await action();
      applyPolicy(next);
      enqueueSnackbar(done, { variant: "success" });
      setNewPin("");
      setConfirmPin("");
      setPassword("");
      setOtp("");
      setOtpSent(false);
      setCurrentPin("");
      setChangedNew("");
      setChangedConfirm("");
      setRemoveProof("");
    } catch (err) {
      const body = bodyOf(err);
      if (body.code === "MPIN_LOCKED" && body.errors?.locked_until) {
        setLockedUntil(body.errors.locked_until);
      } else {
        setMessage(apiErrorMessage(err, fallback));
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendOtp() {
    setBusy(true);
    setMessage(null);
    try {
      await mpinService.sendMpinOtp();
      setOtpSent(true);
      enqueueSnackbar("OTP sent to your registered mobile", { variant: "success" });
    } catch (err) {
      setMessage(apiErrorMessage(err, "Could not send the OTP."));
    } finally {
      setBusy(false);
    }
  }

  const canSet =
    newPin.length === MPIN_LENGTH &&
    confirmPin === newPin &&
    (hasPassword ? password.length > 0 : otp.length > 0);

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        Unlock PIN
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {hasMpin
          ? "The dashboard locks when you go idle. This PIN opens it again — you stay signed in underneath."
          : "With no PIN, going idle signs you out of the dashboard completely. Set a PIN and inactivity becomes a lock you can open in seconds."}
      </Typography>

      {locked && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          Too many wrong PINs. The PIN is locked for another{" "}
          {lockout.minutes}:{String(lockout.seconds).padStart(2, "0")}.
          {hasPassword && " Confirming your account password clears it earlier."}
        </Alert>
      )}

      {message && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {message}
        </Alert>
      )}

      {!hasMpin ? (
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(
              () =>
                mpinService.setMpin({
                  mpin: newPin,
                  confirm_mpin: confirmPin,
                  ...(hasPassword ? { current_password: password } : { otp }),
                }),
              "Unlock PIN set",
              "Could not set the PIN."
            );
          }}
        >
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <MpinInput
                label="New 6-digit PIN"
                value={newPin}
                onChange={setNewPin}
                disabled={busy}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MpinInput
                label="Confirm new PIN"
                value={confirmPin}
                onChange={setConfirmPin}
                disabled={busy}
                error={confirmPin.length === MPIN_LENGTH && confirmPin !== newPin}
                helperText={
                  confirmPin.length === MPIN_LENGTH && confirmPin !== newPin
                    ? "The two PINs do not match."
                    : undefined
                }
              />
            </Grid>

            {hasPassword ? (
              <Grid item xs={12} sm={6}>
                <PinField
                  label="Your account password"
                  value={password}
                  onChange={setPassword}
                  numeric={false}
                  disabled={busy}
                  helperText="Needed because the PIN becomes the gate on this account."
                />
              </Grid>
            ) : (
              <Grid item xs={12} sm={6}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Box flex={1}>
                    <PinField
                      label="OTP from your mobile"
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={busy || !otpSent}
                      helperText="This account signs in with OTP, so there is no password to confirm."
                    />
                  </Box>
                  <Button
                    variant="outlined"
                    startIcon={<Send />}
                    onClick={sendOtp}
                    disabled={busy}
                    sx={{ mt: 1 }}
                  >
                    {otpSent ? "Resend" : "Send OTP"}
                  </Button>
                </Stack>
              </Grid>
            )}
          </Grid>

          <Button
            type="submit"
            variant="contained"
            sx={{ mt: 2 }}
            disabled={busy || !canSet}
          >
            Set unlock PIN
          </Button>
        </Box>
      ) : (
        <Box>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {attemptsLeft === null
              ? "An unlock PIN is set."
              : `An unlock PIN is set. ${attemptsLeft} attempt${
                  attemptsLeft === 1 ? "" : "s"
                } remain before a short lock.`}
          </Typography>

          <Divider sx={{ mb: 3 }} />

          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            Change the PIN
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <MpinInput
                label="Current PIN"
                value={currentPin}
                onChange={setCurrentPin}
                size="sm"
                disabled={busy || locked}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <MpinInput
                label="New 6-digit PIN"
                value={changedNew}
                onChange={setChangedNew}
                size="sm"
                disabled={busy || locked}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <MpinInput
                label="Confirm new PIN"
                value={changedConfirm}
                onChange={setChangedConfirm}
                size="sm"
                disabled={busy || locked}
                error={changedConfirm.length === MPIN_LENGTH && changedConfirm !== changedNew}
              />
            </Grid>
          </Grid>
          <Button
            variant="contained"
            sx={{ mt: 2 }}
            disabled={
              busy ||
              locked ||
              currentPin.length !== MPIN_LENGTH ||
              changedNew.length !== MPIN_LENGTH ||
              changedNew !== changedConfirm
            }
            onClick={() =>
              void submit(
                () =>
                  mpinService.changeMpin({
                    current_mpin: currentPin,
                    new_mpin: changedNew,
                    confirm_mpin: changedConfirm,
                  }),
                "Unlock PIN changed",
                "Could not change the PIN."
              )
            }
          >
            Change PIN
          </Button>

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            Remove the PIN
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Without a PIN the dashboard goes back to signing you out when you go
            idle.
          </Typography>
          <Grid container spacing={2} alignItems="flex-start">
            <Grid item xs={12} sm={6}>
              {hasPassword ? (
                <PinField
                  label="Your account password"
                  value={removeProof}
                  onChange={setRemoveProof}
                  numeric={false}
                  disabled={busy || locked}
                />
              ) : (
                <MpinInput
                  label="Current PIN"
                  value={removeProof}
                  onChange={setRemoveProof}
                  size="sm"
                  disabled={busy || locked}
                />
              )}
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button
                variant="outlined"
                color="error"
                sx={{ mt: 1 }}
                disabled={
                  busy ||
                  locked ||
                  (hasPassword
                    ? removeProof.length === 0
                    : removeProof.length !== MPIN_LENGTH)
                }
                onClick={() =>
                  void submit(
                    () =>
                      mpinService.removeMpin(
                        hasPassword
                          ? { current_password: removeProof }
                          : { current_mpin: removeProof }
                      ),
                    "Unlock PIN removed",
                    "Could not remove the PIN."
                  )
                }
              >
                Remove PIN
              </Button>
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}
