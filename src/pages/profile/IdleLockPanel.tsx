// ============================================================
// WAYTERO ADMIN — IDLE LOCK PANEL (profile → Idle lock tab)
// Doc: Admin Portal §39 Security — per-user idle window.
//
// Reduce-only by design: an admin may have their screen lock sooner than the
// platform default, never later. If the own setting could raise the default,
// the idle lock would be opt-out and the daily sign-out would be the last
// control standing. The server enforces the same rule (IDLE_LOCK_TOO_LONG),
// so the list here is a convenience rather than the guarantee.
// ============================================================
import { useState } from "react";
import {
  Alert, Box, Button, MenuItem, Stack, TextField, Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { mpinService } from "../../services/mpin.service";
import { apiErrorMessage } from "../../utils/apiError";
import { useLockStore } from "../../stores/lockStore";

const CHOICES = [1, 2, 3, 5, 10, 15, 30];

export function IdleLockPanel() {
  const { enqueueSnackbar } = useSnackbar();
  const config = useLockStore((s) => s.sessionConfig);

  const defaultMinutes = config?.idle_default_minutes ?? 5;
  const own = config?.idle_lock_minutes ?? null;
  // An existing setting outside the current choices (a default that was later
  // lowered) still has to be selectable, or saving anything would lose it.
  const choices = CHOICES.filter(
    (m) => m <= defaultMinutes || m === own
  ).sort((a, b) => a - b);

  const [value, setValue] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const pending = value === "" ? null : value;
  const changed = pending !== own;

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const next = await mpinService.setIdleLockMinutes(pending);
      useLockStore.getState().setSessionConfig(next);
      enqueueSnackbar("Idle lock updated", { variant: "success" });
    } catch (err) {
      setMessage(apiErrorMessage(err, "Could not save the idle lock."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        Lock after inactivity
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Moving the mouse, scrolling or typing resets this. Nothing you read
        counts as activity — only input does.
      </Typography>

      {!config?.has_mpin && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          You have no unlock PIN, so this window currently signs you out of the
          dashboard instead of locking it. Set a PIN first and the same window
          becomes a lock you can open again.
        </Alert>
      )}

      {message && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {message}
        </Alert>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="flex-start">
        <TextField
          select
          label="Idle window"
          value={value === null ? "" : value}
          onChange={(e) =>
            setValue(e.target.value === "" ? "" : Number(e.target.value))
          }
          sx={{ minWidth: 260 }}
          disabled={busy}
          helperText={
            own === null
              ? `Inheriting the platform default of ${defaultMinutes} minutes.`
              : `Your own setting: locks after ${own} minute${own === 1 ? "" : "s"}.`
          }
        >
          <MenuItem value="">
            <Box component="span">Platform default ({defaultMinutes} min)</Box>
          </MenuItem>
          {choices.map((m) => (
            <MenuItem key={m} value={m}>
              {m} minute{m === 1 ? "" : "s"}
              {m > defaultMinutes ? " (your saved setting)" : ""}
            </MenuItem>
          ))}
        </TextField>

        <Button
          variant="contained"
          onClick={save}
          disabled={busy || !changed}
          sx={{ mt: 0.5 }}
        >
          Save
        </Button>
      </Stack>

      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
        Choices stop at the platform default: you can make the dashboard lock
        sooner, never later.
      </Typography>
    </Box>
  );
}
