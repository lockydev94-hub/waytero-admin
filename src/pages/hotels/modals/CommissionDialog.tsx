// ============================================================
// WAYTERO ADMIN — HOTEL COMMISSION DIALOG
// Doc Ref: 03_FRONTEND_DESIGN.md §6 "CommissionDialog"
// PERCENTAGE | FLAT | HYBRID editor with live worked example.
// ============================================================

import { useState, useEffect, useMemo } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, TextField, ToggleButtonGroup, ToggleButton,
  Typography, Box, CircularProgress, Divider, alpha, useTheme,
  Select, MenuItem, FormControl, InputLabel, InputAdornment,
} from "@mui/material";
import { AttachMoney, Percent, Calculate } from "@mui/icons-material";
import { useSnackbar } from "notistack";

import hotelService, { ResolvedCommission } from "../../../services/hotel.service";
import { COMMISSION_TYPES, COMMISSION_APPLIES_TO, inr } from "../constants";
import { apiErrorMessage } from "../../../utils/apiError";

interface Props {
  open: boolean;
  hotelId: number;
  current: ResolvedCommission | null | undefined;
  onClose: () => void;
  onSaved: () => void;
}

const EXAMPLE_RATE = 4000;
const EXAMPLE_ROOMS = 2;
const EXAMPLE_NIGHTS = 3;

function calcExample(
  commType: string,
  commPercent: number,
  commFlat: number,
  appliesTo: string,
  minComm: number | null,
  maxComm: number | null,
): { base: number; commission: number; payout: number } {
  const base = EXAMPLE_RATE * EXAMPLE_ROOMS * EXAMPLE_NIGHTS;
  let rawComm = 0;

  if (appliesTo === "PER_BOOKING") {
    if (commType === "PERCENTAGE") rawComm = (base * commPercent) / 100;
    else if (commType === "FLAT") rawComm = commFlat;
    else rawComm = commFlat + (base * commPercent) / 100;
  } else {
    // PER_ROOM_NIGHT
    const units = EXAMPLE_ROOMS * EXAMPLE_NIGHTS;
    if (commType === "PERCENTAGE") rawComm = (base * commPercent) / 100;
    else if (commType === "FLAT") rawComm = commFlat * units;
    else rawComm = commFlat * units + (base * commPercent) / 100;
  }

  if (minComm !== null && rawComm < minComm) rawComm = minComm;
  if (maxComm !== null && rawComm > maxComm) rawComm = maxComm;
  rawComm = Math.round(rawComm * 100) / 100;

  return { base, commission: rawComm, payout: base - rawComm };
}

export default function CommissionDialog({ open, hotelId, current, onClose, onSaved }: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const [commType, setCommType] = useState("PERCENTAGE");
  const [commPercent, setCommPercent] = useState("");
  const [commFlat, setCommFlat] = useState("");
  const [appliesTo, setAppliesTo] = useState("PER_BOOKING");
  const [minComm, setMinComm] = useState("");
  const [maxComm, setMaxComm] = useState("");
  const [saving, setSaving] = useState(false);

  // Seed from current when dialog opens
  useEffect(() => {
    if (!open) return;
    if (current) {
      setCommType(current.commission_type ?? "PERCENTAGE");
      setCommPercent(current.commission_percent > 0 ? String(current.commission_percent) : "");
      setCommFlat(current.commission_flat > 0 ? String(current.commission_flat) : "");
      setAppliesTo(current.applies_to ?? "PER_BOOKING");
      setMinComm(current.min_commission !== null ? String(current.min_commission) : "");
      setMaxComm(current.max_commission !== null ? String(current.max_commission) : "");
    } else {
      setCommType("PERCENTAGE");
      setCommPercent("");
      setCommFlat("");
      setAppliesTo("PER_BOOKING");
      setMinComm("");
      setMaxComm("");
    }
  }, [open, current]);

  const example = useMemo(() => calcExample(
    commType,
    parseFloat(commPercent) || 0,
    parseFloat(commFlat) || 0,
    appliesTo,
    minComm ? parseFloat(minComm) : null,
    maxComm ? parseFloat(maxComm) : null,
  ), [commType, commPercent, commFlat, appliesTo, minComm, maxComm]);

  const isValid = (): boolean => {
    if (commType === "PERCENTAGE") return (parseFloat(commPercent) || 0) > 0;
    if (commType === "FLAT") return (parseFloat(commFlat) || 0) > 0;
    return (parseFloat(commPercent) || 0) >= 0 && (parseFloat(commFlat) || 0) > 0;
  };

  const handleSave = async () => {
    if (!isValid()) return;
    setSaving(true);
    try {
      await hotelService.setCommission(hotelId, {
        commission_type: commType,
        commission_percent: parseFloat(commPercent) || 0,
        commission_flat: parseFloat(commFlat) || 0,
        applies_to: appliesTo,
        min_commission: minComm ? parseFloat(minComm) : null,
        max_commission: maxComm ? parseFloat(maxComm) : null,
      });
      enqueueSnackbar("Commission override saved", { variant: "success" });
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
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{
        background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
        color: "primary.contrastText",
        fontWeight: 800,
        pb: 2,
      }}>
        Commission Override
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={2.5}>
          {/* Commission type */}
          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 1 }}>
              Commission Type
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={commType}
              onChange={(_, v) => v && setCommType(v)}
              size="small"
              fullWidth
            >
              {COMMISSION_TYPES.map((t) => (
                <ToggleButton key={t} value={t} sx={{ fontWeight: 700, fontSize: 12 }}>
                  {t === "PERCENTAGE" && <Percent sx={{ fontSize: 14, mr: 0.5 }} />}
                  {t === "FLAT" && <AttachMoney sx={{ fontSize: 14, mr: 0.5 }} />}
                  {t === "HYBRID" && <Calculate sx={{ fontSize: 14, mr: 0.5 }} />}
                  {t}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {/* Inputs based on type */}
          <Stack direction="row" spacing={2}>
            {(commType === "PERCENTAGE" || commType === "HYBRID") && (
              <TextField
                label="Commission %"
                value={commPercent}
                onChange={e => setCommPercent(e.target.value)}
                type="number"
                size="small"
                fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                inputProps={{ min: 0, max: 100, step: 0.01 }}
              />
            )}
            {(commType === "FLAT" || commType === "HYBRID") && (
              <TextField
                label={commType === "HYBRID" ? "Flat amount (per unit)" : "Flat amount"}
                value={commFlat}
                onChange={e => setCommFlat(e.target.value)}
                type="number"
                size="small"
                fullWidth
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                inputProps={{ min: 0, step: 0.01 }}
              />
            )}
          </Stack>

          {/* Applies to */}
          <FormControl size="small" fullWidth>
            <InputLabel>Applies to</InputLabel>
            <Select value={appliesTo} onChange={e => setAppliesTo(e.target.value)} label="Applies to">
              {COMMISSION_APPLIES_TO.map(a => (
                <MenuItem key={a} value={a}>{a === "PER_BOOKING" ? "Per Booking" : "Per Room Night"}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Min / Max clamps */}
          <Stack direction="row" spacing={2}>
            <TextField
              label="Min commission (₹)"
              value={minComm}
              onChange={e => setMinComm(e.target.value)}
              type="number"
              size="small"
              fullWidth
              placeholder="No minimum"
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              inputProps={{ min: 0, step: 0.01 }}
            />
            <TextField
              label="Max commission (₹)"
              value={maxComm}
              onChange={e => setMaxComm(e.target.value)}
              type="number"
              size="small"
              fullWidth
              placeholder="No maximum"
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Stack>

          <Divider />

          {/* Live worked example */}
          <Box sx={{ bgcolor: alpha(theme.palette.info.main, 0.06), borderRadius: 1.5, p: 2 }}>
            <Typography variant="caption" fontWeight={800} color="info.main" sx={{ display: "block", mb: 1.5 }}>
              📊 Worked example — {EXAMPLE_ROOMS} rooms × {EXAMPLE_NIGHTS} nights @ {inr(EXAMPLE_RATE)}/night
            </Typography>
            <Stack spacing={0.75}>
              {[
                { label: "Total booking value", value: inr(example.base), bold: false },
                { label: "Platform commission", value: inr(example.commission), bold: true },
                { label: "Hotel payout", value: inr(example.payout), bold: true },
              ].map(({ label, value, bold }) => (
                <Stack key={label} direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="caption" fontWeight={bold ? 800 : 500}>{value}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !isValid()}
          startIcon={saving ? <CircularProgress size={14} /> : undefined}
        >
          Save Override
        </Button>
      </DialogActions>
    </Dialog>
  );
}
