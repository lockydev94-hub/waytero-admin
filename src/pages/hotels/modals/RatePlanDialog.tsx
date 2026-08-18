// ============================================================
// WAYTERO ADMIN — RATE PLAN DIALOG
// Doc Ref: 03_FRONTEND_DESIGN.md §6 "RatePlanDialog"
// Create/edit rate plan: type, priority, date range, day-of-week,
// rate mode (ABSOLUTE/PERCENT/DELTA), value, min nights.
// Warns if resolved rate < min_sellable_price.
// ============================================================

import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, TextField, Select, MenuItem, FormControl,
  InputLabel, ToggleButtonGroup, ToggleButton, Typography,
  Box, CircularProgress, Alert, Divider, Chip, alpha, useTheme,
  FormControlLabel, Switch, InputAdornment,
} from "@mui/material";
import { useSnackbar } from "notistack";

import hotelService, { RoomCategory, RatePlan } from "../../../services/hotel.service";
import {
  RATE_PLAN_TYPE_LABELS, DAYS_OF_WEEK, toIsoDate, inr, fmtDate,
} from "../constants";
import { RATE_PLAN_TYPES, RATE_MODES, RATE_MODE_LABELS } from "../../../services/hotel.service";
import { apiErrorMessage } from "../../../utils/apiError";

interface Props {
  open: boolean;
  hotelId: number;
  roomCategory: RoomCategory;
  plan?: RatePlan | null;
  onClose: () => void;
  onSaved: () => void;
}

const today = () => toIsoDate(new Date());
const in30 = () => { const d = new Date(); d.setDate(d.getDate() + 30); return toIsoDate(d); };

const PLAN_TYPE_COLOR: Record<string, "default" | "primary" | "warning" | "success" | "info"> = {
  PROMOTIONAL: "primary", WEEKEND: "info", SEASONAL: "warning", FESTIVAL: "success",
};

export default function RatePlanDialog({
  open, hotelId, roomCategory, plan, onClose, onSaved,
}: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const [name, setName] = useState("");
  const [planType, setPlanType] = useState("PROMOTIONAL");
  const [priority, setPriority] = useState("1");
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(in30());
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([]);
  const [rateMode, setRateMode] = useState("ABSOLUTE");
  const [rateValue, setRateValue] = useState("");
  const [minNights, setMinNights] = useState("1");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const isEditing = !!plan;

  useEffect(() => {
    if (!open) return;
    if (plan) {
      setName(plan.plan_name ?? "");
      setPlanType(plan.plan_type ?? "PROMOTIONAL");
      setPriority(String(plan.priority ?? 1));
      setDateFrom(plan.date_from ?? today());
      setDateTo(plan.date_to ?? in30());
      setDaysOfWeek(plan.day_of_week_mask ? plan.day_of_week_mask.split(",").filter(Boolean) : []);
      setRateMode(plan.rate_mode ?? "ABSOLUTE");
      setRateValue(String(plan.rate_value ?? ""));
      setMinNights(String(plan.min_nights ?? 1));
      setIsActive(plan.is_active ?? true);
    } else {
      setName("");
      setPlanType("PROMOTIONAL");
      setPriority("1");
      setDateFrom(today());
      setDateTo(in30());
      setDaysOfWeek([]);
      setRateMode("ABSOLUTE");
      setRateValue("");
      setMinNights("1");
      setIsActive(true);
    }
  }, [open, plan]);

  // Live resolved rate for first 7 days (best effort)
  const resolvedRate = (): string => {
    const val = parseFloat(rateValue) || 0;
    const base = roomCategory.base_price ?? 0;
    if (rateMode === "ABSOLUTE") return inr(val);
    if (rateMode === "PERCENT") return inr(base * (1 + val / 100));
    return inr(base + val);
  };

  const belowMin = (): boolean => {
    const val = parseFloat(rateValue) || 0;
    const base = roomCategory.base_price ?? 0;
    const min = roomCategory.min_sellable_price ?? 0;
    let effective = base;
    if (rateMode === "ABSOLUTE") effective = val;
    else if (rateMode === "PERCENT") effective = base * (1 + val / 100);
    else effective = base + val;
    return min > 0 && effective < min;
  };

  const isValid = (): boolean =>
    name.trim().length > 0 &&
    (parseFloat(rateValue) || 0) !== 0 &&
    dateFrom <= dateTo;

  const handleSave = async () => {
    setSaving(true);
    const payload: Record<string, unknown> = {
      room_category_id: roomCategory.id,
      plan_name: name.trim(),
      plan_type: planType,
      priority: parseInt(priority) || 1,
      date_from: dateFrom,
      date_to: dateTo,
      day_of_week_mask: planType === "WEEKEND" && daysOfWeek.length ? daysOfWeek.join(",") : null,
      rate_mode: rateMode,
      rate_value: parseFloat(rateValue),
      min_nights: parseInt(minNights) || 1,
      is_active: isActive,
    };
    try {
      if (isEditing && plan) {
        await hotelService.updateRatePlan(hotelId, plan.id, payload);
      } else {
        await hotelService.createRatePlan(hotelId, payload);
      }
      enqueueSnackbar(isEditing ? "Rate plan updated" : "Rate plan created", { variant: "success" });
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
        {isEditing ? "Edit Rate Plan" : "Add Rate Plan"}
        <Typography variant="caption" sx={{ display: "block", opacity: 0.8, mt: 0.25 }}>
          {roomCategory.category_name} · Base: {inr(roomCategory.base_price)}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={2.5}>
          <TextField
            label="Plan name *"
            value={name}
            onChange={e => setName(e.target.value)}
            size="small"
            fullWidth
            placeholder="e.g. Summer Sale, Christmas Special"
            inputProps={{ maxLength: 100 }}
          />

          {/* Plan type */}
          <Stack direction="row" spacing={2}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Plan type</InputLabel>
              <Select value={planType} onChange={e => setPlanType(e.target.value)} label="Plan type">
                {RATE_PLAN_TYPES.map(t => (
                  <MenuItem key={t} value={t}>
                    <Chip label={RATE_PLAN_TYPE_LABELS[t] ?? t} size="small"
                      color={PLAN_TYPE_COLOR[t] ?? "default"} sx={{ height: 20, fontSize: 11 }} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Priority"
              value={priority}
              onChange={e => setPriority(e.target.value)}
              type="number"
              size="small"
              sx={{ width: 120 }}
              helperText="Lower wins"
              inputProps={{ min: 1, max: 99 }}
            />
          </Stack>

          {/* Date range */}
          <Stack direction="row" spacing={2}>
            <TextField label="From *" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              type="date" size="small" fullWidth InputLabelProps={{ shrink: true }} />
            <TextField label="To *" value={dateTo} onChange={e => setDateTo(e.target.value)}
              type="date" size="small" fullWidth InputLabelProps={{ shrink: true }}
              inputProps={{ min: dateFrom }} />
          </Stack>

          {/* Day of week mask — only for WEEKEND plans */}
          {planType === "WEEKEND" && (
            <Box>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 1 }}>
                Apply on specific days
              </Typography>
              <ToggleButtonGroup
                value={daysOfWeek}
                onChange={(_, v) => setDaysOfWeek(v)}
                size="small"
                sx={{ flexWrap: "wrap", gap: 0.5 }}
              >
                {DAYS_OF_WEEK.map(d => (
                  <ToggleButton key={d.value} value={d.value} sx={{ fontWeight: 700, fontSize: 12, py: 0.5 }}>
                    {d.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          )}

          <Divider />

          {/* Rate mode */}
          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 1 }}>
              Rate mode
            </Typography>
            <ToggleButtonGroup exclusive value={rateMode} onChange={(_, v) => v && setRateMode(v)}
              size="small" fullWidth>
              {RATE_MODES.map(m => (
                <ToggleButton key={m} value={m} sx={{ fontWeight: 700, fontSize: 12 }}>
                  {RATE_MODE_LABELS[m] ?? m}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              {rateMode === "ABSOLUTE" ? "Fixed nightly rate" :
               rateMode === "PERCENT" ? "% change from base (use negative for discount)" :
               "Fixed amount added to/subtracted from base (use negative for discount)"}
            </Typography>
          </Box>

          <Stack direction="row" spacing={2}>
            <TextField
              label={rateMode === "ABSOLUTE" ? "Rate (₹) *" : rateMode === "PERCENT" ? "Percent change *" : "Delta amount (₹) *"}
              value={rateValue}
              onChange={e => setRateValue(e.target.value)}
              type="number"
              size="small"
              sx={{ flex: 1 }}
              InputProps={rateMode === "PERCENT"
                ? { endAdornment: <InputAdornment position="end">%</InputAdornment> }
                : { startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              inputProps={{ step: rateMode === "PERCENT" ? 0.1 : 1 }}
            />
            <TextField
              label="Min nights"
              value={minNights}
              onChange={e => setMinNights(e.target.value)}
              type="number"
              size="small"
              sx={{ width: 120 }}
              inputProps={{ min: 1, max: 30 }}
            />
          </Stack>

          {/* Resolved rate preview */}
          {rateValue && (
            <Box sx={{
              bgcolor: alpha(belowMin() ? theme.palette.error.main : theme.palette.success.main, 0.06),
              borderRadius: 1.5, p: 1.5,
            }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">Effective nightly rate</Typography>
                <Typography variant="caption" fontWeight={800}
                  color={belowMin() ? "error.main" : "success.main"}>
                  {resolvedRate()}
                </Typography>
              </Stack>
              {belowMin() && (
                <Typography variant="caption" color="error.main" sx={{ display: "block", mt: 0.5 }}>
                  ⚠ Below min sellable price ({inr(roomCategory.min_sellable_price)}) — server will reject this plan
                </Typography>
              )}
            </Box>
          )}

          <FormControlLabel
            control={<Switch checked={isActive} onChange={e => setIsActive(e.target.checked)} size="small" />}
            label={<Typography variant="body2">Plan active</Typography>}
          />
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
          {isEditing ? "Update Plan" : "Create Plan"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
