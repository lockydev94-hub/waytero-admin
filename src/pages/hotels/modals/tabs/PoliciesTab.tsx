// ============================================================
// WAYTERO ADMIN — HOTEL POLICIES TAB
// Doc Ref: 03_FRONTEND_DESIGN.md §5 "Policies"
// Three grouped cards: check-in/out, cancellation ladder, house rules.
// Client-side monotonicity validation mirrors server's.
// ============================================================

import { useState, useEffect } from "react";
import {
  Box, Typography, Stack, Card, CardContent, Button, TextField,
  FormControlLabel, Switch, CircularProgress, Alert, Divider,
  Grid, LinearProgress, alpha, useTheme,
} from "@mui/material";
import { Save } from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import hotelService, { HotelDetail, HotelPolicy } from "../../../../services/hotel.service";
import { HOTEL_QUERY_KEYS, inr, numOrNull, strOrNull } from "../../constants";
import { apiErrorMessage } from "../../../../utils/apiError";

interface Props { hotel: HotelDetail; hotelId: number; onRefresh: () => void; }

const tf = (label: string, key: string, form: Record<string, any>, set: (k: string, v: any) => void, extra: Record<string, any> = {}) => (
  <TextField
    label={label}
    value={form[key] ?? ""}
    onChange={(e) => set(key, e.target.value)}
    size="small"
    fullWidth
    {...extra}
  />
);

export default function PoliciesTab({ hotelId, onRefresh }: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { data: policy, isLoading, isError, refetch } = useQuery<HotelPolicy>({
    queryKey: [HOTEL_QUERY_KEYS.policies, hotelId],
    queryFn: () => hotelService.getPolicies(hotelId),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (policy) {
      setForm({ ...policy });
      setDirty(false);
    }
  }, [policy]);

  const set = (key: string, value: any) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
    setValidationError(null);
  };

  const validateCancellationTiers = (): string | null => {
    const t1 = Number(form.cancellation_free_hours);
    const t2 = Number(form.cancellation_tier_2_hours);
    const t3 = Number(form.cancellation_tier_3_hours);
    if (form.cancellation_free_hours && form.cancellation_tier_2_hours && t2 >= t1) {
      return "Tier 2 hours must be less than Tier 1 hours (closer to check-in = less refund).";
    }
    if (form.cancellation_tier_2_hours && form.cancellation_tier_3_hours && t3 >= t2) {
      return "Tier 3 hours must be less than Tier 2 hours.";
    }
    return null;
  };

  const handleSave = async () => {
    const err = validateCancellationTiers();
    if (err) { setValidationError(err); return; }
    setSaving(true);
    try {
      // The form holds the whole GET response, so a PUT of it verbatim would
      // send read-only keys plus "" for every field the admin cleared — and ""
      // is a 422 on int/Decimal. Build the update explicitly instead.
      await hotelService.updatePolicies(hotelId, {
        check_in_time: strOrNull(form.check_in_time),
        check_out_time: strOrNull(form.check_out_time),
        early_check_in_allowed: !!form.early_check_in_allowed,
        late_check_out_allowed: !!form.late_check_out_allowed,

        cancellation_free_hours: numOrNull(form.cancellation_free_hours),
        refund_percent_tier_1: numOrNull(form.refund_percent_tier_1),
        cancellation_tier_2_hours: numOrNull(form.cancellation_tier_2_hours),
        refund_percent_tier_2: numOrNull(form.refund_percent_tier_2),
        cancellation_tier_3_hours: numOrNull(form.cancellation_tier_3_hours),
        refund_percent_tier_3: numOrNull(form.refund_percent_tier_3),
        refund_percent_same_day: numOrNull(form.refund_percent_same_day),
        no_show_refund_percent: numOrNull(form.no_show_refund_percent),

        couples_allowed: !!form.couples_allowed,
        unmarried_couples_allowed: !!form.unmarried_couples_allowed,
        local_id_accepted: !!form.local_id_accepted,
        pets_allowed: !!form.pets_allowed,
        smoking_allowed: !!form.smoking_allowed,
        alcohol_allowed: !!form.alcohol_allowed,
        min_guest_age: numOrNull(form.min_guest_age),
        extra_bed_charge: numOrNull(form.extra_bed_charge),
        child_free_age_limit: numOrNull(form.child_free_age_limit),
        house_rules: strOrNull(form.house_rules),
        cancellation_policy_text: strOrNull(form.cancellation_policy_text),
      });
      enqueueSnackbar("Policies saved", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.policies, hotelId] });
      queryClient.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.detail, hotelId] });
      setDirty(false);
      onRefresh();
    } catch (e: any) {
      enqueueSnackbar(apiErrorMessage(e, "Save failed"), { variant: "error" });
    } finally { setSaving(false); }
  };

  if (isLoading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress size={28} /></Box>;
  }
  if (isError) {
    return <Alert severity="error" action={<Button size="small" onClick={() => refetch()}>Retry</Button>}>Failed to load policies.</Alert>;
  }

  // Cancellation tier visualisation
  const tiers = [
    { hours: form.cancellation_free_hours, refund: form.refund_percent_tier_1, label: "Full refund" },
    { hours: form.cancellation_tier_2_hours, refund: form.refund_percent_tier_2, label: "Partial refund" },
    { hours: form.cancellation_tier_3_hours, refund: form.refund_percent_tier_3, label: "Minimal refund" },
    { hours: 0, refund: form.refund_percent_same_day, label: "Same-day" },
  ].filter((t) => t.hours !== null && t.hours !== undefined && t.hours !== "");

  return (
    <Box>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save />}
          disabled={!dirty || saving}
          onClick={handleSave}
          sx={{ borderRadius: 2, fontWeight: 700 }}
        >
          Save policies
        </Button>
      </Stack>

      {validationError && (
        <Alert severity="warning" sx={{ mb: 2 }}>{validationError}</Alert>
      )}

      {/* Check-in / Check-out */}
      <Card variant="outlined" sx={{ borderRadius: 2, mb: 2.5 }}>
        <CardContent>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Check-in & Check-out</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              {tf("Check-in time", "check_in_time", form, set, { placeholder: "e.g. 14:00", helperText: "24-hour format" })}
            </Grid>
            <Grid item xs={12} sm={6}>
              {tf("Check-out time", "check_out_time", form, set, { placeholder: "e.g. 11:00", helperText: "24-hour format" })}
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={<Switch checked={!!form.early_check_in_allowed} onChange={(e) => set("early_check_in_allowed", e.target.checked)} />}
                label="Early check-in allowed (chargeable)"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={<Switch checked={!!form.late_check_out_allowed} onChange={(e) => set("late_check_out_allowed", e.target.checked)} />}
                label="Late check-out allowed (chargeable)"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Cancellation */}
      <Card variant="outlined" sx={{ borderRadius: 2, mb: 2.5 }}>
        <CardContent>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Cancellation Policy</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: "block" }}>
            Hours before check-in — higher hours = earlier cancellation = more refund.
          </Typography>

          {/* Visual bar */}
          {tiers.length > 0 && (
            <Box sx={{ mb: 2.5 }}>
              {tiers.map((t, i) => (
                <Stack key={i} direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ width: 110, flexShrink: 0 }}>
                    {t.hours ? `>${t.hours}h before` : "Same day"}
                  </Typography>
                  <Box sx={{ flex: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={Number(t.refund) ?? 0}
                      sx={{
                        height: 8, borderRadius: 4,
                        bgcolor: alpha(theme.palette.success.main, 0.15),
                        "& .MuiLinearProgress-bar": { bgcolor: "success.main" },
                      }}
                    />
                  </Box>
                  <Typography variant="caption" fontWeight={700} sx={{ width: 40, textAlign: "right" }}>
                    {t.refund ?? 0}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{t.label}</Typography>
                </Stack>
              ))}
            </Box>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>{tf("Tier 1: Free cancellation hours", "cancellation_free_hours", form, set, { type: "number", helperText: "E.g. 48" })}</Grid>
            <Grid item xs={12} sm={6}>{tf("Tier 1 refund %", "refund_percent_tier_1", form, set, { type: "number", inputProps: { min: 0, max: 100 } })}</Grid>
            <Grid item xs={12} sm={6}>{tf("Tier 2: hours before check-in", "cancellation_tier_2_hours", form, set, { type: "number" })}</Grid>
            <Grid item xs={12} sm={6}>{tf("Tier 2 refund %", "refund_percent_tier_2", form, set, { type: "number", inputProps: { min: 0, max: 100 } })}</Grid>
            <Grid item xs={12} sm={6}>{tf("Tier 3: hours before check-in", "cancellation_tier_3_hours", form, set, { type: "number" })}</Grid>
            <Grid item xs={12} sm={6}>{tf("Tier 3 refund %", "refund_percent_tier_3", form, set, { type: "number", inputProps: { min: 0, max: 100 } })}</Grid>
            <Grid item xs={12} sm={6}>{tf("Same-day refund %", "refund_percent_same_day", form, set, { type: "number", inputProps: { min: 0, max: 100 } })}</Grid>
            <Grid item xs={12} sm={6}>{tf("No-show refund %", "no_show_refund_percent", form, set, { type: "number", inputProps: { min: 0, max: 100 } })}</Grid>
            <Grid item xs={12}>
              <TextField
                label="Cancellation policy text (customer-facing)"
                value={form.cancellation_policy_text ?? ""}
                onChange={(e) => set("cancellation_policy_text", e.target.value)}
                size="small"
                fullWidth
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* House rules */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>House Rules</Typography>
          <Grid container spacing={1.5}>
            {[
              ["couples_allowed", "Couples allowed"],
              ["unmarried_couples_allowed", "Unmarried couples allowed"],
              ["local_id_accepted", "Local ID accepted"],
              ["pets_allowed", "Pets allowed"],
              ["smoking_allowed", "Smoking allowed"],
              ["alcohol_allowed", "Alcohol allowed"],
            ].map(([key, label]) => (
              <Grid item xs={12} sm={6} key={key}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!form[key]}
                      onChange={(e) => set(key, e.target.checked)}
                    />
                  }
                  label={label}
                />
              </Grid>
            ))}
            <Grid item xs={12}><Divider /></Grid>
            <Grid item xs={12} sm={4}>{tf("Min guest age", "min_guest_age", form, set, { type: "number" })}</Grid>
            <Grid item xs={12} sm={4}>{tf("Child free-stay age (≤)", "child_free_age_limit", form, set, { type: "number" })}</Grid>
            <Grid item xs={12} sm={4}>{tf("Extra bed charge (₹)", "extra_bed_charge", form, set, { type: "number" })}</Grid>
            <Grid item xs={12}>
              <TextField
                label="Additional house rules"
                value={form.house_rules ?? ""}
                onChange={(e) => set("house_rules", e.target.value)}
                size="small"
                fullWidth
                multiline
                rows={3}
                helperText="Shown to guests before booking"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
