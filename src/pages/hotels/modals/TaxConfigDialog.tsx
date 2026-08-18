// ============================================================
// WAYTERO ADMIN — HOTEL TAX CONFIG DIALOG
// Doc Ref: 03_FRONTEND_DESIGN.md §6 "TaxConfigDialog"
// Tax mode (EXCLUSIVE/INCLUSIVE/EXEMPT) + GST registration.
// Disabled when global GST_ENABLED is false.
// ============================================================

import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, TextField, Select, MenuItem, FormControl,
  InputLabel, FormControlLabel, Switch, Typography, Alert,
  CircularProgress, useTheme,
} from "@mui/material";
import { useSnackbar } from "notistack";

import hotelService, { HotelDetail } from "../../../services/hotel.service";
import { TAX_MODES, TAX_MODE_LABELS } from "../constants";
import { apiErrorMessage } from "../../../utils/apiError";

interface Props {
  open: boolean;
  hotelId: number;
  hotel: HotelDetail;
  onClose: () => void;
  onSaved: () => void;
}

const GST_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/;

export default function TaxConfigDialog({ open, hotelId, hotel, onClose, onSaved }: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const [taxMode, setTaxMode] = useState("EXCLUSIVE");
  const [isGstRegistered, setIsGstRegistered] = useState(false);
  const [gstNumber, setGstNumber] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTaxMode(hotel.tax_mode ?? "EXCLUSIVE");
    setIsGstRegistered(hotel.is_gst_registered ?? false);
    setGstNumber(hotel.gst_number ?? "");
  }, [open, hotel]);

  const gstError = isGstRegistered && gstNumber && !GST_PATTERN.test(gstNumber)
    ? "Invalid GST number format"
    : "";
  const isValid = !gstError && (!isGstRegistered || gstNumber.trim().length > 0 || !hotel.platform_gst_enabled);

  const handleSave = async () => {
    setSaving(true);
    try {
      await hotelService.updateTax(hotelId, {
        tax_mode: taxMode,
        is_gst_registered: isGstRegistered,
        gst_number: isGstRegistered ? gstNumber.trim() || null : null,
      });
      enqueueSnackbar("Tax configuration saved", { variant: "success" });
      onSaved();
      onClose();
    } catch (e: any) {
      enqueueSnackbar(apiErrorMessage(e, "Save failed"), { variant: "error" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{
        background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
        color: "primary.contrastText",
        fontWeight: 800,
      }}>
        Tax Configuration
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={2.5}>
          {!hotel.platform_gst_enabled && (
            <Alert severity="info" sx={{ fontSize: 12 }}>
              Global GST is <strong>disabled</strong> in platform settings. Tax mode is saved but not applied to bookings until GST is enabled globally.
            </Alert>
          )}

          <FormControl size="small" fullWidth>
            <InputLabel>Tax Mode</InputLabel>
            <Select value={taxMode} onChange={e => setTaxMode(e.target.value)} label="Tax Mode">
              {TAX_MODES.map(m => (
                <MenuItem key={m} value={m}>{TAX_MODE_LABELS[m] ?? m}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {taxMode !== "EXEMPT" && (
            <>
              <FormControlLabel
                control={<Switch checked={isGstRegistered} onChange={e => setIsGstRegistered(e.target.checked)} />}
                label={<Typography variant="body2">Hotel is GST registered</Typography>}
              />

              {isGstRegistered && (
                <TextField
                  label="GST Number"
                  value={gstNumber}
                  onChange={e => setGstNumber(e.target.value.toUpperCase())}
                  size="small"
                  fullWidth
                  placeholder="22AAAAA0000A1Z5"
                  error={!!gstError}
                  helperText={gstError || "15-character GST identification number"}
                  inputProps={{ maxLength: 15 }}
                />
              )}
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !isValid}
          startIcon={saving ? <CircularProgress size={14} /> : undefined}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
