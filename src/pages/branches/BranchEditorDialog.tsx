// ============================================================
// WAYTERO ADMIN — BRANCH EDITOR DIALOG
// Register an office, or edit one. Backend: /admin/branches
// (branch_api.py → services/branches.py)
//
// The form sends every field it shows. An update is a partial patch on the
// server, so sending the whole record is simply "these are the values".
// ============================================================
import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, Stack, Switch, TextField, Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";

import { branchService, type Branch } from "../../services/branch.service";
import { CitySelect } from "../../components/forms/CitySelect";
import { apiErrorMessage } from "../../utils/apiError";

interface BranchEditorDialogProps {
  open: boolean;
  branch: Branch | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function BranchEditorDialog({ open, branch, onClose, onSaved }: BranchEditorDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [cityId, setCityId] = useState<number | "">("");
  const [address, setAddress] = useState("");
  const [isHeadquarters, setIsHeadquarters] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(branch?.name ?? "");
    setCode(branch?.code ?? "");
    setCityId(branch?.city_id ?? "");
    setAddress(branch?.address ?? "");
    setIsHeadquarters(branch?.is_headquarters ?? false);
    setIsActive(branch?.is_active ?? true);
    setError(null);
  }, [open, branch]);

  async function save() {
    const trimmedCode = code.trim().toUpperCase();
    if (!name.trim() || trimmedCode.length < 2 || cityId === "") {
      setError("A name, a code of at least 2 characters and a city are needed before this can be saved.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      code: trimmedCode,
      city_id: Number(cityId),
      address: address.trim() || null,
      is_headquarters: isHeadquarters,
      is_active: isActive,
    };
    try {
      if (branch) await branchService.update(branch.id, payload);
      else await branchService.create(payload);
      enqueueSnackbar(branch ? "Branch updated" : `${payload.name} registered`, { variant: "success" });
      onSaved();
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{branch ? `Edit ${branch.name}` : "Register a branch office"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Office name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            size="small"
            inputProps={{ maxLength: 120 }}
          />

          <TextField
            label="Code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            fullWidth
            size="small"
            helperText="Short and unique — the server stores it in upper case, and no two offices may share one."
            inputProps={{ maxLength: 20 }}
          />

          <Box>
            <CitySelect value={cityId} onChange={(id) => setCityId(id)} label="City" required />
            <Typography variant="caption" color="text.secondary">
              One office per city. A city that already has a branch cannot get a second one —
              bookings reach their office through their city, so two offices on one city would
              split every queue with no rule for which half is whose.
            </Typography>
          </Box>

          <TextField
            label="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            fullWidth
            size="small"
            inputProps={{ maxLength: 255 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={isHeadquarters}
                onChange={(e) => setIsHeadquarters(e.target.checked)}
              />
            }
            label="Head office"
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
            The head office also sees the leads, chats and care logs that no one has assigned a
            city to yet. Only one office in the platform can hold this.
          </Typography>

          <FormControlLabel
            control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
            label="Open"
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
            Closing an office signs its staff out on their next request and hides it from the
            switcher. Nothing is deleted.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving}>
          {saving ? "Saving…" : branch ? "Save changes" : "Register"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
