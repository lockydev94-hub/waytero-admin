// ============================================================
// WAYTERO ADMIN — REASON DIALOG
// Doc Ref: 03_FRONTEND_DESIGN.md §2 — adapted from PartnersPage ReasonDialog.
//
// Adds a `required` mode: own-risk approval and rejection must carry a
// justification, since an unexplained control bypass is indistinguishable
// from a mistake later.
// ============================================================
import { useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import type { ButtonProps } from "@mui/material";

interface Props {
  open: boolean;
  title: string;
  /** Shown above the input — explain the consequence, not the mechanics. */
  description?: string;
  warning?: string;
  label?: string;
  required?: boolean;
  presets?: string[];
  loading?: boolean;
  actionColor?: ButtonProps["color"];
  confirmLabel?: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export default function ReasonDialog({
  open,
  title,
  description,
  warning,
  label = "Reason / Remarks",
  required = false,
  presets,
  loading = false,
  actionColor = "primary",
  confirmLabel = "Confirm",
  onConfirm,
  onClose,
}: Props) {
  const [reason, setReason] = useState("");
  const tooShort = required && reason.trim().length < 3;

  const close = () => {
    setReason("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle id="reason-dialog-title" sx={{ fontWeight: 700 }}>
        {title}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          {warning && <Alert severity="warning">{warning}</Alert>}
          {description && <Alert severity="info">{description}</Alert>}
          {presets && presets.length > 0 && (
            <TextField
              select
              SelectProps={{ native: true }}
              label="Common reasons"
              value=""
              onChange={(e) => e.target.value && setReason(e.target.value)}
            >
              <option value="" />
              {presets.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </TextField>
          )}
          <TextField
            autoFocus
            label={required ? `${label} (required)` : `${label} (optional)`}
            multiline
            rows={3}
            fullWidth
            required={required}
            error={required && reason.length > 0 && tooShort}
            helperText={
              required && reason.length > 0 && tooShort ? "Please give at least 3 characters." : " "
            }
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={close} disabled={loading} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          color={actionColor}
          onClick={() => onConfirm(reason.trim())}
          disabled={loading || tooShort}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          sx={{ minWidth: 100 }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
