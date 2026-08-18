// ============================================================
// WAYTERO — CLOSE TRIP MODAL (PREMIUM)
// Admin closes trip on behalf of driver
// Guard: cab must be STARTED
// Auto-calculates final_amount using city+category pricing rule:
//   base_fare + max(0, actual_km - minimum_km) × per_km_rate
// ============================================================
import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogActions,
  Button, TextField, Stack, Typography, CircularProgress,
  Box, alpha, useTheme, InputAdornment, Divider,
  LinearProgress, Chip, Tooltip,
} from "@mui/material";
import {
  StopCircle, Speed, CurrencyRupee, Calculate,
  InfoOutlined, TrendingUp, CheckCircleOutline, LocalOffer, AccountBalanceWallet,
} from "@mui/icons-material";
import {
  tripAssistanceService, TripDetail, PricingRule,
} from "../../../services/tripAssistance.service";
import { settingsService } from "../../../services/settings.service";

interface Props {
  open: boolean;
  detail: TripDetail;
  onClose: () => void;
  onSuccess: () => void;
}

// Compute amount using pricing rule
function computeAmount(rule: PricingRule, distanceKm: number): number {
  const extraKm = Math.max(0, distanceKm - rule.minimum_km);
  return Math.round((rule.base_fare + extraKm * rule.per_km_rate) * 100) / 100;
}

export default function CloseTripModal({ open, detail, onClose, onSuccess }: Props) {
  const theme = useTheme();

  const [endKm,         setEndKm]         = useState("");
  const [endDt,         setEndDt]         = useState(() => new Date().toISOString().slice(0, 16));
  const [finalAmt,      setFinalAmt]       = useState(String(detail.estimated_amount ?? ""));
  const [amtOverridden, setAmtOverridden]  = useState(false); // user manually changed amount
  const [loading,       setLoading]        = useState(false);
  const [error,         setError]          = useState("");

  // Pricing state
  const [pricingRule,   setPricingRule]   = useState<PricingRule | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [calcAmount,    setCalcAmount]    = useState<number | null>(null);
  const [actualDist,    setActualDist]    = useState<number | null>(null);

  const startKm      = detail.trip_start_km;
  const endKmNum     = endKm !== "" ? Number(endKm) : null;
  const endKmInvalid = endKmNum !== null && startKm !== null && endKmNum < startKm;
  const distKm       = endKm && startKm !== null && !endKmInvalid ? Math.max(0, Number(endKm) - startKm) : null;

  // Coupon & advance — from detail (fetched at booking time)
  const couponDiscount = detail.coupon_discount ?? 0;
  const advancePaid    = detail.advance_paid ?? 0;

  // GST state — loaded from system_configurations
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstRate,    setGstRate]    = useState(0);

  // Live GST amount (calculated from entered final amount)
  const finalAmtNum = parseFloat(finalAmt) || 0;
  const gstAmount   = gstEnabled && gstRate > 0
    ? Math.round(finalAmtNum * gstRate / 100 * 100) / 100
    : 0;
  const grossTotal  = Math.round((finalAmtNum + gstAmount) * 100) / 100;

  // Balance due = gross total − coupon − advance
  const balanceDue = Math.max(0, Math.round((grossTotal - couponDiscount - advancePaid) * 100) / 100);

  // ── Fetch pricing rule + GST config on open ─────────────
  useEffect(() => {
    if (!open) return;
    setPricingLoading(true);
    tripAssistanceService
      .getPricing(detail.cab_booking_number)
      .then(res => { setPricingRule(res.pricing_rule); })
      .catch(() => setPricingRule(null))
      .finally(() => setPricingLoading(false));

    // Load GST settings
    settingsService.getConfigurations().then(configs => {
      const map: Record<string, string> = {};
      configs.forEach((c: any) => { map[c.config_key] = c.config_value ?? ""; });
      setGstEnabled((map["GST_ENABLED"] ?? "false").toLowerCase() === "true");
      setGstRate(parseFloat(map["GST_RATE"] ?? "5") || 5);
    }).catch(() => {});
  }, [open, detail.cab_booking_number]);

  // ── Live price recalculation on endKm change ─────────────
  useEffect(() => {
    if (!endKm || isNaN(Number(endKm)) || startKm === null) {
      setCalcAmount(null);
      setActualDist(null);
      return;
    }
    const dist = Math.max(0, Number(endKm) - startKm);
    setActualDist(dist);
    if (pricingRule) {
      const amt = computeAmount(pricingRule, dist);
      setCalcAmount(amt);
      // Auto-fill final amount only if user hasn't manually overridden
      if (!amtOverridden) {
        setFinalAmt(String(amt));
      }
    }
  }, [endKm, startKm, pricingRule, amtOverridden]);

  function handleClose() {
    if (loading) return;
    setError("");
    setEndKm("");
    setAmtOverridden(false);
    setCalcAmount(null);
    setActualDist(null);
    onClose();
  }

  function handleAmtChange(val: string) {
    setFinalAmt(val);
    setAmtOverridden(true);
  }

  function resetToCalculated() {
    if (calcAmount !== null) {
      setFinalAmt(String(calcAmount));
      setAmtOverridden(false);
    }
  }

  async function handleSubmit() {
    if (!endKm || isNaN(Number(endKm)) || Number(endKm) < 0) {
      setError("Enter a valid end odometer reading."); return;
    }
    if (startKm !== null && Number(endKm) < startKm) {
      setError(`End KM (${endKm}) cannot be less than start KM (${startKm}).`); return;
    }
    if (!finalAmt || isNaN(Number(finalAmt)) || Number(finalAmt) <= 0) {
      setError("Enter a valid final amount (> 0)."); return;
    }
    if (!endDt) { setError("Select trip end date & time."); return; }

    setLoading(true); setError("");
    try {
      await tripAssistanceService.closeTrip({
        booking_number: detail.cab_booking_number,
        end_km: Number(endKm),
        end_datetime: new Date(endDt).toISOString(),
        final_amount: Number(finalAmt),
      });
      onSuccess();
      handleClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to close trip.");
    } finally { setLoading(false); }
  }

  const fmtINR = (n: number) =>
    `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      {/* ── Header ── */}
      <Box sx={{
        background: `linear-gradient(135deg, ${theme.palette.error.dark} 0%, ${theme.palette.error.main} 100%)`,
        px: 3, pt: 2.5, pb: 2,
      }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <StopCircle sx={{ color: "#fff", fontSize: 28 }} />
          <Box>
            <Typography variant="h6" fontWeight={800} color="white">Close Trip</Typography>
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.75) }}>
              {detail.cab_booking_number} · {detail.trip_type ?? ""}
              {detail.vehicle_category_name ? ` · ${detail.vehicle_category_name}` : ""}
              {detail.city_name ? ` · ${detail.city_name}` : ""}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <DialogContent sx={{ pt: 3, pb: 1 }}>
        <Stack spacing={2.5}>

          {/* ── Pricing Rule Banner ── */}
          {pricingLoading && <LinearProgress sx={{ borderRadius: 1 }} />}

          {pricingRule && (
            <Box sx={{
              p: 2, borderRadius: 2,
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.07)} 0%, ${alpha(theme.palette.primary.light, 0.04)} 100%)`,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <TrendingUp sx={{ fontSize: 15, color: "primary.main" }} />
                <Typography variant="caption" fontWeight={800} color="primary.main" sx={{ letterSpacing: 0.8, textTransform: "uppercase" }}>
                  Pricing Rule — {detail.city_name}
                </Typography>
                {detail.trip_type && (
                  <Chip label={detail.trip_type} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700, height: 18, fontSize: "0.62rem" }} />
                )}
              </Stack>
              <Stack direction="row" spacing={3} flexWrap="wrap" gap={1}>
                {[
                  { label: "Base Fare",   val: fmtINR(pricingRule.base_fare) },
                  { label: "Per KM",      val: `${fmtINR(pricingRule.per_km_rate)}/km` },
                  { label: "Min. KM",     val: `${pricingRule.minimum_km} km` },
                  ...(pricingRule.driver_allowance > 0 ? [{ label: "Driver Allow.", val: fmtINR(pricingRule.driver_allowance) }] : []),
                ].map(({ label, val }) => (
                  <Box key={label}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{label}</Typography>
                    <Typography variant="body2" fontWeight={700} color="primary.main">{val}</Typography>
                  </Box>
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block", fontStyle: "italic" }}>
                Formula: Base fare + max(0, actual km − min km) × per km rate
              </Typography>
            </Box>
          )}

          {!pricingRule && !pricingLoading && (
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.warning.main, 0.07), border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`, display: "flex", gap: 1 }}>
              <InfoOutlined sx={{ color: "warning.main", fontSize: 16, flexShrink: 0, mt: 0.1 }} />
              <Typography variant="caption" color="warning.dark">
                No pricing rule found for this city + vehicle category. Enter final amount manually.
              </Typography>
            </Box>
          )}

          {/* ── Start KM Box ── */}
          {startKm !== null && (
            <Box sx={{
              p: 1.5, borderRadius: 2,
              bgcolor: alpha(theme.palette.info.main, 0.06),
              border: `1px solid ${alpha(theme.palette.info.main, 0.15)}`,
            }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="caption" color="text.secondary">Start KM (recorded)</Typography>
                  <Typography variant="h6" fontWeight={800} color="info.main">
                    {startKm.toLocaleString()} km
                  </Typography>
                </Box>
                {detail.trip_started_at && (
                  <Typography variant="caption" color="text.secondary">
                    Started: {new Date(detail.trip_started_at).toLocaleString("en-IN")}
                  </Typography>
                )}
              </Stack>
            </Box>
          )}

          {/* ── End KM ── */}
          <TextField
            label="End Odometer Reading (KM)"
            type="number"
            fullWidth
            value={endKm}
            onChange={e => { setEndKm(e.target.value); setError(""); }}
            error={endKmInvalid}
            InputProps={{ startAdornment: <Speed sx={{ mr: 1, color: endKmInvalid ? "error.main" : "text.secondary", fontSize: 18 }} /> }}
            placeholder={startKm !== null ? `≥ ${startKm}` : "e.g. 45380"}
            size="small"
            inputProps={{ min: startKm ?? 0 }}
            helperText={
              endKmInvalid
                ? `⚠ Must be ≥ start KM (${startKm?.toLocaleString()} km) — cannot close a trip with lower odometer`
                : distKm !== null
                ? `Distance: ${distKm.toFixed(1)} km${actualDist !== null && pricingRule ? ` · Chargeable: ${Math.max(0, actualDist - pricingRule.minimum_km).toFixed(1)} km` : ""}`
                : startKm !== null
                ? `Enter reading ≥ ${startKm.toLocaleString()} km`
                : "Enter end odometer reading"
            }
            FormHelperTextProps={{ sx: endKmInvalid ? { color: "error.main", fontWeight: 600 } : {} }}
          />

          {/* ── End DateTime ── */}
          <TextField
            label="Trip End Date & Time"
            type="datetime-local"
            fullWidth
            value={endDt}
            onChange={e => setEndDt(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
          />

          {/* ── Calculated Amount Preview ── */}
          {calcAmount !== null && pricingRule && (
            <>
              <Divider />
              <Box sx={{
                p: 2, borderRadius: 2,
                background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.08)} 0%, ${alpha(theme.palette.success.light, 0.04)} 100%)`,
                border: `1px solid ${alpha(theme.palette.success.main, 0.25)}`,
              }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                  <Box>
                    <Stack direction="row" spacing={0.5} alignItems="center" mb={0.5}>
                      <Calculate sx={{ fontSize: 14, color: "success.main" }} />
                      <Typography variant="caption" fontWeight={700} color="success.dark" sx={{ letterSpacing: 0.5, textTransform: "uppercase" }}>
                        Auto-Calculated Fare
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={2.5} flexWrap="wrap" gap={0.5}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Base</Typography>
                        <Typography variant="body2" fontWeight={700}>{fmtINR(pricingRule.base_fare)}</Typography>
                      </Box>
                      {actualDist !== null && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            + {Math.max(0, actualDist - pricingRule.minimum_km).toFixed(1)} km × {fmtINR(pricingRule.per_km_rate)}
                          </Typography>
                          <Typography variant="body2" fontWeight={700}>
                            = {fmtINR(Math.max(0, actualDist - pricingRule.minimum_km) * pricingRule.per_km_rate)}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </Box>
                  <Box sx={{ textAlign: "right" }}>
                    <Typography variant="caption" color="text.secondary">Total</Typography>
                    <Typography variant="h5" fontWeight={900} color="success.main">{fmtINR(calcAmount)}</Typography>
                  </Box>
                </Stack>
              </Box>
            </>
          )}

          {/* ── Coupon & Advance Panel ── */}
          {(couponDiscount > 0 || advancePaid > 0) && (
            <Box sx={{
              p: 2, borderRadius: 2,
              background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.06)} 0%, ${alpha(theme.palette.info.main, 0.04)} 100%)`,
              border: `1px solid ${alpha(theme.palette.secondary.main, 0.18)}`,
            }}>
              <Typography variant="caption" fontWeight={800} color="secondary.main" sx={{ letterSpacing: 0.8, textTransform: "uppercase", display: "block", mb: 1.5 }}>
                Applied Discounts & Advance
              </Typography>
              <Stack spacing={1}>
                {couponDiscount > 0 && (
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={0.8} alignItems="center">
                      <LocalOffer sx={{ fontSize: 14, color: "secondary.main" }} />
                      <Typography variant="body2" color="text.secondary">Coupon Discount</Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={700} color="secondary.main">
                      − {fmtINR(couponDiscount)}
                    </Typography>
                  </Stack>
                )}
                {advancePaid > 0 && (
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={0.8} alignItems="center">
                      <AccountBalanceWallet sx={{ fontSize: 14, color: "info.main" }} />
                      <Typography variant="body2" color="text.secondary">Advance Paid</Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={700} color="info.main">
                      − {fmtINR(advancePaid)}
                    </Typography>
                  </Stack>
                )}
                <Divider sx={{ my: 0.5 }} />
                {gstEnabled && gstAmount > 0 && (
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={0.8} alignItems="center">
                      <Typography variant="body2" color="warning.main" fontWeight={700}>
                        GST ({gstRate}%) on Fare
                      </Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={700} color="warning.main">
                      + {fmtINR(gstAmount)}
                    </Typography>
                  </Stack>
                )}
                {gstEnabled && gstAmount > 0 && (
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">Total (incl. GST)</Typography>
                    <Typography variant="body2" fontWeight={800}>{fmtINR(grossTotal)}</Typography>
                  </Stack>
                )}
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" fontWeight={800}>Balance Due from Customer</Typography>
                  <Typography variant="h6" fontWeight={900} color={balanceDue <= 0 ? "success.main" : "error.main"}>
                    {balanceDue <= 0 ? "Fully Paid ✓" : fmtINR(balanceDue)}
                  </Typography>
                </Stack>
              </Stack>
            </Box>
          )}

          {/* ── Final Amount ── */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5, textTransform: "uppercase" }}>
                Final Billing Amount *
              </Typography>
              {amtOverridden && calcAmount !== null && (
                <Tooltip title="Reset to calculated amount">
                  <Button
                    size="small"
                    startIcon={<CheckCircleOutline fontSize="small" />}
                    onClick={resetToCalculated}
                    sx={{ fontSize: "0.68rem", fontWeight: 700, py: 0.2 }}
                  >
                    Use ₹{calcAmount.toLocaleString("en-IN")}
                  </Button>
                </Tooltip>
              )}
            </Stack>
            <TextField
              type="number"
              fullWidth
              value={finalAmt}
              onChange={e => handleAmtChange(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><CurrencyRupee sx={{ fontSize: 18, color: "text.secondary" }} /></InputAdornment> }}
              size="small"
              inputProps={{ min: 1 }}
              helperText={
                amtOverridden && calcAmount !== null
                  ? `ℹ️ You've overridden the calculated amount (₹${calcAmount.toLocaleString("en-IN")})`
                  : detail.estimated_amount
                  ? `Estimated: ₹${detail.estimated_amount.toLocaleString("en-IN")}`
                  : "Enter billing amount"
              }
              sx={{
                "& .MuiOutlinedInput-root": {
                  "& fieldset": {
                    borderColor: amtOverridden
                      ? theme.palette.warning.main
                      : theme.palette.success.main,
                    borderWidth: 2,
                  },
                },
              }}
            />
          </Box>

          {error && (
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.error.main, 0.08), border: `1px solid ${alpha(theme.palette.error.main, 0.2)}` }}>
              <Typography variant="caption" color="error.main" fontWeight={600}>{error}</Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
        <Button onClick={handleClose} disabled={loading} variant="outlined" size="small">Cancel</Button>
        <Button
          onClick={handleSubmit}
          disabled={loading || endKmInvalid}
          variant="contained"
          color="error"
          size="small"
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <StopCircle fontSize="small" />}
          sx={{ fontWeight: 700 }}
        >
          {loading ? "Closing…" : `Close Trip${finalAmt ? ` · ₹${grossTotal.toLocaleString("en-IN")}` : ""}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
