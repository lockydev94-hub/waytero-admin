// ============================================================
// WAYTERO — COLLECT PAYMENT MODAL (PREMIUM)
// Admin records payment collection after trip completion
// CASH → cash_pending_at = DRIVER; commission calculated at settlement
// WALLET → deduct balance_due from customer wallet (live balance check)
// ONLINE → NOT available here (driver-app only)
// ============================================================
import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogActions,
  Button, Stack, Typography, CircularProgress,
  Box, alpha, useTheme, ToggleButton, ToggleButtonGroup,
  Divider, Chip, LinearProgress,
} from "@mui/material";
import {
  Payments, Money, AccountBalanceWallet, Info,
  Warning, CheckCircleOutline, Lock,
} from "@mui/icons-material";
import { tripAssistanceService, TripDetail } from "../../../services/tripAssistance.service";

interface Props {
  open: boolean;
  detail: TripDetail;
  onClose: () => void;
  onSuccess: () => void;
}

const PAYMENT_MODES = [
  { value: "CASH",   label: "Cash",   icon: <Money /> },
  { value: "WALLET", label: "Wallet", icon: <AccountBalanceWallet /> },
];

const COLLECTORS = ["DRIVER", "PARTNER", "PLATFORM"];

export default function CollectPaymentModal({ open, detail, onClose, onSuccess }: Props) {
  const theme = useTheme();
  const [mode,          setMode]          = useState<"CASH" | "WALLET">("CASH");
  const [collector,     setCollector]     = useState("DRIVER");
  const [commPct,       setCommPct]       = useState(10);
  const [commSource,    setCommSource]    = useState("default");
  const [commLoading,   setCommLoading]   = useState(false);
  const [walletBalance,   setWalletBalance]   = useState<number | null>(null);
  const [walletLoading,   setWalletLoading]   = useState(false);
  const [walletStatus,    setWalletStatus]     = useState<string | null>(null);
  const [walletFound,     setWalletFound]      = useState<boolean | null>(null); // null = not yet fetched
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");

  const finalAmt   = detail.final_amount ?? 0;
  const couponDisc = detail.coupon_discount ?? 0;
  const advancePd  = detail.advance_paid ?? 0;
  const balanceDue = Math.max(0, +(finalAmt - couponDisc - advancePd).toFixed(2));

  // Commission is informational only at this stage (settlement-time deduction)
  const commission    = +(finalAmt * commPct / 100).toFixed(2);
  const partnerPayout = +(finalAmt - commission).toFixed(2);

  // Auto-fetch commission percent when modal opens
  useEffect(() => {
    if (!open) return;
    setCommLoading(true);
    tripAssistanceService.getCommissionPreview(detail.cab_booking_number)
      .then(res => { setCommPct(res.commission_percent); setCommSource(res.rule_source); })
      .catch(() => { setCommPct(10); setCommSource("default"); })
      .finally(() => setCommLoading(false));
  }, [open, detail.cab_booking_number]);

  // Fetch customer wallet balance when WALLET mode selected
  useEffect(() => {
    if (!open || mode !== "WALLET") return;
    setWalletLoading(true);
    setWalletFound(null);
    tripAssistanceService.getCustomerWallet(detail.cab_booking_number)
      .then(res => {
        setWalletFound(res.wallet_found);
        setWalletBalance(res.wallet_found ? (res.available_balance ?? 0) : 0);
        setWalletStatus(res.wallet_status ?? null);
      })
      .catch(() => { setWalletFound(false); setWalletBalance(null); setWalletStatus(null); })
      .finally(() => setWalletLoading(false));
  }, [open, mode, detail.cab_booking_number]);

  function handleClose() { if (loading) return; setError(""); onClose(); }

  async function handleSubmit() {
    if (!finalAmt || finalAmt <= 0) {
      setError("Trip must be closed with a final amount before collecting payment.");
      return;
    }
    if (mode === "WALLET") {
      if (walletFound === false || walletBalance === null) {
        setError("Customer wallet has no balance. Switch to Cash or ask customer to recharge their wallet.");
        return;
      }
      if (walletBalance < balanceDue) {
        setError(`Insufficient wallet balance ₹${walletBalance.toFixed(2)}. Balance due is ₹${balanceDue.toFixed(2)}. Shortfall: ₹${(balanceDue - walletBalance).toFixed(2)}.`);
        return;
      }
    }
    setLoading(true); setError("");
    try {
      await tripAssistanceService.collectPayment({
        booking_number: detail.cab_booking_number,
        payment_mode: mode,
        payment_collected_by: collector as any,
        commission_percent: 0, // Not used at collect-time; deducted at settlement
      });
      onSuccess();
      handleClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to record payment.");
    } finally { setLoading(false); }
  }

  const fmtINR = (n: number) =>
    `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const walletFetched      = mode === "WALLET" && walletFound !== null && !walletLoading;
  const walletInsufficient = walletFetched && (walletFound === false || (walletBalance !== null && walletBalance < balanceDue));
  const walletSufficient   = walletFetched && walletFound === true && walletBalance !== null && walletBalance >= balanceDue;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      {/* Header */}
      <Box sx={{
        background: `linear-gradient(135deg, ${theme.palette.info.dark} 0%, ${theme.palette.info.main} 100%)`,
        px: 3, pt: 2.5, pb: 2,
      }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Payments sx={{ color: "#fff", fontSize: 28 }} />
          <Box>
            <Typography variant="h6" fontWeight={800} color="white">Collect Payment</Typography>
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.75) }}>
              {detail.cab_booking_number} · {detail.customer_name ?? "Customer"}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {(commLoading || walletLoading) && <LinearProgress />}

      <DialogContent sx={{ pt: 3, pb: 1 }}>
        <Stack spacing={3}>

          {/* Amount banner — shows balance_due (net amount to collect) */}
          <Box sx={{
            p: 2.5, borderRadius: 2,
            background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.08)} 0%, ${alpha(theme.palette.success.light, 0.04)} 100%)`,
            border: `1px solid ${alpha(theme.palette.success.main, 0.25)}`,
          }}>
            <Stack spacing={0.5}>
              {/* Full fare */}
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">Trip Fare</Typography>
                <Typography variant="caption" fontWeight={700}>{fmtINR(finalAmt)}</Typography>
              </Stack>
              {couponDisc > 0 && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Coupon Discount</Typography>
                  <Typography variant="caption" fontWeight={700} color="warning.main">− {fmtINR(couponDisc)}</Typography>
                </Stack>
              )}
              {advancePd > 0 && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Advance Paid</Typography>
                  <Typography variant="caption" fontWeight={700} color="info.main">− {fmtINR(advancePd)}</Typography>
                </Stack>
              )}
              {(couponDisc > 0 || advancePd > 0) && <Divider sx={{ my: 0.5 }} />}
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.8, textTransform: "uppercase" }}>
                  Balance Due
                </Typography>
                <Typography variant="h3" fontWeight={900} color="success.main">{fmtINR(balanceDue)}</Typography>
              </Stack>
            </Stack>
          </Box>

          {/* Payment Mode — CASH or WALLET only */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.8, textTransform: "uppercase" }}>
                Payment Mode
              </Typography>
              <Chip
                label="Online: Driver App Only"
                size="small"
                icon={<Lock sx={{ fontSize: "13px !important" }} />}
                sx={{ fontSize: "0.62rem", fontWeight: 600, height: 20, bgcolor: alpha(theme.palette.grey[500], 0.1) }}
              />
            </Stack>
            <ToggleButtonGroup
              value={mode}
              exclusive
              onChange={(_, v) => { if (v) setMode(v); }}
              size="small"
              fullWidth
            >
              {PAYMENT_MODES.map(m => (
                <ToggleButton
                  key={m.value} value={m.value}
                  sx={{
                    flex: 1, gap: 0.5, py: 1.2, fontWeight: 700,
                    "&.Mui-selected": { bgcolor: "primary.main", color: "#fff", "&:hover": { bgcolor: "primary.dark" } },
                  }}
                >
                  {m.icon} {m.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {/* Collected by */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.8, textTransform: "uppercase", display: "block", mb: 1 }}>
              Collected By
            </Typography>
            <ToggleButtonGroup
              value={collector}
              exclusive
              onChange={(_, v) => { if (v) setCollector(v); }}
              size="small"
              fullWidth
            >
              {COLLECTORS.map(c => (
                <ToggleButton
                  key={c} value={c}
                  sx={{
                    flex: 1, py: 1.2, fontWeight: 700,
                    "&.Mui-selected": { bgcolor: "secondary.main", color: "#fff", "&:hover": { bgcolor: "secondary.dark" } },
                  }}
                >
                  {c}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {/* Commission info (read-only, for reference) */}
          <Box sx={{
            p: 2, borderRadius: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.04),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
          }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="caption" fontWeight={800} color="primary.main" sx={{ letterSpacing: 1, textTransform: "uppercase" }}>
                Commission Preview
              </Typography>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Lock sx={{ fontSize: 13, color: "text.disabled" }} />
                <Chip
                  label={commSource === "default" ? "Default Rule" : commSource.startsWith("city") ? "City Rule" : "Group Rule"}
                  size="small"
                  color={commSource === "default" ? "default" : "primary"}
                  variant="outlined"
                  icon={<CheckCircleOutline sx={{ fontSize: "14px !important" }} />}
                  sx={{ fontWeight: 700, height: 20, fontSize: "0.62rem" }}
                />
              </Stack>
            </Stack>
            <Stack spacing={0.8}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Trip Fare</Typography>
                <Typography variant="body2" fontWeight={700}>{fmtINR(finalAmt)}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Commission ({commPct}%)</Typography>
                <Typography variant="body2" fontWeight={700} color="warning.main">− {fmtINR(commission)}</Typography>
              </Stack>
              <Divider sx={{ my: 0.25 }} />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" fontWeight={800}>Est. Partner Payout</Typography>
                <Typography variant="body2" fontWeight={800} color="success.main">{fmtINR(partnerPayout)}</Typography>
              </Stack>
            </Stack>
            <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: "block", lineHeight: 1.5 }}>
              Commission is deducted at settlement time, not now. This is a preview only.
            </Typography>
          </Box>

          {/* CASH info box */}
          {mode === "CASH" && (
            <Box sx={{
              p: 2, borderRadius: 2,
              bgcolor: alpha(theme.palette.warning.main, 0.07),
              border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
              display: "flex", gap: 1.5, alignItems: "flex-start",
            }}>
              <Warning sx={{ color: "warning.main", fontSize: 20, flexShrink: 0, mt: 0.1 }} />
              <Box>
                <Typography variant="body2" fontWeight={700} color="warning.dark" mb={0.5}>
                  Cash Collection Note
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  Cash <strong>{fmtINR(balanceDue)}</strong> collected will be marked pending at <strong>DRIVER</strong>.
                  At settlement time, commission will be deducted from the partner's wallet.
                  The partner must collect remaining cash from the driver via Partner Portal.
                </Typography>
              </Box>
            </Box>
          )}

          {/* WALLET: show customer balance */}
          {mode === "WALLET" && (
            <Box sx={{
              p: 2, borderRadius: 2,
              bgcolor: walletInsufficient
                ? alpha(theme.palette.error.main, 0.07)
                : walletSufficient
                ? alpha(theme.palette.success.main, 0.07)
                : alpha(theme.palette.info.main, 0.06),
              border: `1px solid ${walletInsufficient
                ? alpha(theme.palette.error.main, 0.3)
                : walletSufficient
                ? alpha(theme.palette.success.main, 0.3)
                : alpha(theme.palette.info.main, 0.2)}`,
            }}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <AccountBalanceWallet sx={{
                  color: walletInsufficient ? "error.main" : walletSufficient ? "success.main" : "info.main",
                  fontSize: 20, flexShrink: 0, mt: 0.1,
                }} />
                <Box flex={1}>
                  <Typography variant="body2" fontWeight={700}
                    color={walletInsufficient ? "error.dark" : walletSufficient ? "success.dark" : "info.dark"}
                    mb={0.5}
                  >
                    Customer Wallet
                  </Typography>
                  {walletLoading ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={14} />
                      <Typography variant="caption" color="text.secondary">Fetching wallet balance…</Typography>
                    </Stack>
                  ) : walletFound === false ? (
                    // Wallet missing — backend auto-creates at ₹0 on API call
                    <Stack spacing={0.5}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Available Balance</Typography>
                        <Typography variant="caption" fontWeight={800} color="error.main">₹0.00</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Balance Due</Typography>
                        <Typography variant="caption" fontWeight={700}>{fmtINR(balanceDue)}</Typography>
                      </Stack>
                      <Typography variant="caption" color="error.main" fontWeight={600}>
                        ✗ Customer wallet has ₹0 balance. Customer must recharge before wallet payment.
                      </Typography>
                    </Stack>
                  ) : walletBalance !== null ? (
                    <Stack spacing={0.5}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Available Balance</Typography>
                        <Typography variant="caption" fontWeight={800}
                          color={walletInsufficient ? "error.main" : "success.main"}>
                          {fmtINR(walletBalance)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Balance Due</Typography>
                        <Typography variant="caption" fontWeight={700}>{fmtINR(balanceDue)}</Typography>
                      </Stack>
                      {walletInsufficient && (
                        <Typography variant="caption" color="error.main" fontWeight={600}>
                          ✗ Insufficient — shortfall of {fmtINR(balanceDue - walletBalance)}. Customer must recharge.
                        </Typography>
                      )}
                      {walletSufficient && (
                        <Typography variant="caption" color="success.main" fontWeight={600}>
                          ✓ Sufficient balance. {fmtINR(balanceDue)} will be deducted on confirm.
                        </Typography>
                      )}
                    </Stack>
                  ) : null}
                </Box>
              </Stack>
            </Box>
          )}

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
          disabled={loading || !finalAmt || walletInsufficient || (mode === "WALLET" && walletFound === null && walletLoading)}
          variant="contained"
          size="small"
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <Payments fontSize="small" />}
          sx={{ fontWeight: 700 }}
        >
          {loading
            ? "Recording…"
            : mode === "CASH"
            ? `Record Cash · ${fmtINR(balanceDue)}`
            : `Deduct Wallet · ${fmtINR(balanceDue)}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
