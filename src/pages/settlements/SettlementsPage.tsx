import React from "react";
// ============================================================
// WAYTERO ADMIN — SETTLEMENTS PAGE
// Route: /settlements
//
// Two tabs:
//   1. Pending Settlements — COMPLETED bookings ready to settle
//   2. Settled — already settled bookings
//
// Settle Modal (3 steps):
//   Step 1: Booking details
//   Step 2: Payment details
//   Step 3: Settlement amounts + confirm
//
// Footer link to Coupon Disbursements page.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box, Stack, Typography, Button, Chip, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Tooltip, alpha, useTheme,
  CircularProgress, Snackbar, Alert, Badge,
  Dialog, DialogContent, DialogActions,
  Divider, Stepper, Step, StepLabel,
  LinearProgress, ToggleButton, ToggleButtonGroup,
} from "@mui/material";
import {
  AccountBalance, Refresh, TaskAlt, Visibility,
  Money, AccountBalanceWallet, CreditCard, Warning,
  ArrowBack, ArrowForward, CheckCircle, Person,
  ReceiptLong, LocalOffer, TrendingUp, TrendingDown,
  SwapHoriz, InfoOutlined, DirectionsCar, Hotel, Tour,
} from "@mui/icons-material";
import {
  settlementService,
  SettlementItem,
  SettlementListResponse,
} from "../../services/settlement.service";
import HotelSettlements from "./HotelSettlements";
import TourSettlements from "./TourSettlements";

// ── Helpers ──────────────────────────────────────────────────
const fmtINR = (n: number | null | undefined) => {
  if (n == null) return "—";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const MODE_ICON: Record<string, React.ReactNode> = {
  CASH:   <Money fontSize="small" />,
  WALLET: <AccountBalanceWallet fontSize="small" />,
  ONLINE: <CreditCard fontSize="small" />,
};

const MODE_COLOR: Record<string, "default" | "warning" | "info" | "success"> = {
  CASH:   "warning",
  WALLET: "info",
  ONLINE: "success",
};

// ════════════════════════════════════════════════════════════════
// 3-STEP SETTLE MODAL
// ════════════════════════════════════════════════════════════════

const SETTLE_STEPS = ["Booking Details", "Payment Details", "Settlement"];

function SettleModal({
  open, item, onClose, onSuccess,
}: {
  open: boolean;
  item: SettlementItem;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const theme = useTheme();
  const [step,    setStep]    = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => { if (open) { setStep(0); setError(""); } }, [open]);

  function handleClose() { if (loading) return; onClose(); }

  async function handleSettle() {
    setLoading(true); setError("");
    try {
      const res = await settlementService.settle(item.cab_booking_number);
      onSuccess(res.message ?? "Booking settled successfully!");
      handleClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Settlement failed.");
    } finally { setLoading(false); }
  }

  // ── Net position from backend (the authoritative source) ──────────────────
  // Backend _compute_position() already computed custody-based net arithmetic.
  // We use it directly — never re-derive from payment_mode on the frontend.
  const pos = item.position;
  const net         = pos?.net_settlement ?? 0;
  const direction   = pos?.wallet_direction ?? "NONE";
  const advReceiver = pos?.advance_received_by ?? null;
  const advAmount   = pos?.advance_paid ?? 0;
  const advHeld     = pos?.advance_held_by_partner ?? 0;
  const balHeld     = pos?.balance_held_by_partner ?? 0;
  const partnerHeld = pos?.partner_held ?? 0;

  // For the wallet sufficiency check: only matters when we DEBIT the partner.
  const debitAmount        = direction === "DEBIT" ? Math.abs(net) : 0;
  const partnerSufficient  = direction !== "DEBIT" || (item.partner_wallet_balance ?? 0) >= debitAmount;

  const directionColor = direction === "CREDIT"
    ? theme.palette.success.main
    : direction === "DEBIT"
      ? theme.palette.error.main
      : theme.palette.text.secondary;

  const directionBg = direction === "CREDIT"
    ? alpha(theme.palette.success.main, 0.07)
    : direction === "DEBIT"
      ? alpha(theme.palette.error.main, 0.07)
      : alpha(theme.palette.grey[500], 0.06);

  const directionBorder = direction === "CREDIT"
    ? alpha(theme.palette.success.main, 0.3)
    : direction === "DEBIT"
      ? alpha(theme.palette.error.main, 0.3)
      : alpha(theme.palette.divider, 0.4);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      {/* Header */}
      <Box sx={{
        background: `linear-gradient(135deg, ${theme.palette.success.dark} 0%, ${theme.palette.primary.dark} 100%)`,
        px: 3, pt: 2.5, pb: 2,
      }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <AccountBalance sx={{ color: "#fff", fontSize: 28 }} />
          <Box flex={1}>
            <Typography variant="h6" fontWeight={800} color="white">Settle Booking</Typography>
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.75) }}>
              {item.cab_booking_number} · {item.partner_name ?? "Partner"}
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ mt: 2 }}>
          <Stepper activeStep={step} alternativeLabel
            sx={{
              "& .MuiStepLabel-label": { color: alpha("#fff", 0.6), fontSize: "0.72rem", fontWeight: 600 },
              "& .MuiStepLabel-label.Mui-active": { color: "#fff", fontWeight: 800 },
              "& .MuiStepLabel-label.Mui-completed": { color: alpha("#fff", 0.85), fontWeight: 700 },
              "& .MuiStepIcon-root": { color: alpha("#fff", 0.3) },
              "& .MuiStepIcon-root.Mui-active": { color: "#fff" },
              "& .MuiStepIcon-root.Mui-completed": { color: alpha("#fff", 0.8) },
              "& .MuiStepConnector-line": { borderColor: alpha("#fff", 0.25) },
            }}
          >
            {SETTLE_STEPS.map(label => (
              <Step key={label}><StepLabel>{label}</StepLabel></Step>
            ))}
          </Stepper>
        </Box>
      </Box>

      {loading && <LinearProgress />}

      <DialogContent sx={{ pt: 3, pb: 1, minHeight: 300 }}>

        {/* ── STEP 1: Booking Details ── */}
        {step === 0 && (
          <Stack spacing={2}>
            <Typography variant="overline" color="primary.main" fontWeight={800} sx={{ letterSpacing: 1.5 }}>
              Booking Overview
            </Typography>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.04), border: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Box flex={1} minWidth={120}>
                    <Typography variant="caption" color="text.secondary">Master Booking</Typography>
                    <Typography variant="body2" fontWeight={700}>{item.booking_number}</Typography>
                  </Box>
                  <Box flex={1} minWidth={120}>
                    <Typography variant="caption" color="text.secondary">Cab Booking</Typography>
                    <Typography variant="body2" fontWeight={700} color="primary.main">{item.cab_booking_number}</Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Box flex={1}>
                    <Typography variant="caption" color="text.secondary">Customer</Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Person sx={{ fontSize: 14, color: "text.secondary" }} />
                      <Typography variant="body2" fontWeight={600}>{item.customer_name ?? "—"}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">{item.customer_mobile ?? ""}</Typography>
                  </Box>
                  <Box flex={1}>
                    <Typography variant="caption" color="text.secondary">Trip Type</Typography>
                    <Typography variant="body2" fontWeight={600}>{item.trip_type ?? "—"}</Typography>
                  </Box>
                </Stack>
                {item.pickup_location && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Route</Typography>
                    <Typography variant="body2" fontWeight={600}>{item.pickup_location}</Typography>
                    {item.drop_location && (
                      <Typography variant="body2" color="text.secondary">→ {item.drop_location}</Typography>
                    )}
                  </Box>
                )}
                <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
                  {item.invoice_number && (
                    <Chip icon={<ReceiptLong sx={{ fontSize: "14px !important" }} />}
                      label={`Invoice: ${item.invoice_number}`} size="small" color="success" variant="outlined" sx={{ fontWeight: 700 }} />
                  )}
                  {item.partner_name && (
                    <Chip label={`Partner: ${item.partner_name}`} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
                  )}
                </Stack>
              </Stack>
            </Box>
          </Stack>
        )}

        {/* ── STEP 2: Payment Details ── */}
        {step === 1 && (
          <Stack spacing={2}>
            <Typography variant="overline" color="primary.main" fontWeight={800} sx={{ letterSpacing: 1.5 }}>
              Payment Summary
            </Typography>

            {/* Mode + collector badges */}
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip
                icon={<>{MODE_ICON[item.payment_mode ?? ""] ?? <Money fontSize="small" />}</> as React.ReactElement}
                label={`Balance: ${item.payment_mode ?? "—"}`}
                color={MODE_COLOR[item.payment_mode ?? ""] ?? "default"}
                sx={{ fontWeight: 700 }}
              />
              {item.payment_collected_by && (
                <Chip label={`Collected by: ${item.payment_collected_by}`} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
              )}
              {advAmount > 0 && (
                <Chip
                  icon={<Money fontSize="small" />}
                  label={`Advance by: ${advReceiver ?? "—"}`}
                  size="small"
                  color={advReceiver === "ADMIN" ? "info" : "warning"}
                  variant="outlined"
                  sx={{ fontWeight: 700 }}
                />
              )}
            </Stack>

            {/* Amount breakdown */}
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.grey[500], 0.05), border: `1px solid ${alpha(theme.palette.divider, 0.6)}` }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Trip Fare</Typography>
                  <Typography variant="body2" fontWeight={700}>{fmtINR(item.final_amount)}</Typography>
                </Stack>
                {item.coupon_discount > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <LocalOffer sx={{ fontSize: 14, color: "warning.main" }} />
                      <Typography variant="body2" color="text.secondary">Coupon Discount</Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={700} color="warning.main">− {fmtINR(item.coupon_discount)}</Typography>
                  </Stack>
                )}
                {advAmount > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Money sx={{ fontSize: 14, color: "info.main" }} />
                      <Typography variant="body2" color="text.secondary">
                        Advance ({advReceiver ?? "—"})
                      </Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={700} color="info.main">− {fmtINR(advAmount)}</Typography>
                  </Stack>
                )}
                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" fontWeight={800}>Balance Collected</Typography>
                  <Typography variant="h6" fontWeight={800} color="success.main">{fmtINR(pos?.balance_due ?? item.balance_due)}</Typography>
                </Stack>
              </Stack>
            </Box>

            {/* Advance custody note */}
            {advAmount > 0 && (
              <Box sx={{ p: 1.5, borderRadius: 2,
                bgcolor: advReceiver === "ADMIN"
                  ? alpha(theme.palette.info.main, 0.07)
                  : alpha(theme.palette.warning.main, 0.07),
                border: `1px solid ${advReceiver === "ADMIN"
                  ? alpha(theme.palette.info.main, 0.25)
                  : alpha(theme.palette.warning.main, 0.25)}`,
              }}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <InfoOutlined sx={{ fontSize: 16, mt: 0.2, flexShrink: 0,
                    color: advReceiver === "ADMIN" ? "info.main" : "warning.main"
                  }} />
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    Advance of <strong>{fmtINR(advAmount)}</strong> was received by{" "}
                    <strong>{advReceiver}</strong>.{" "}
                    {advReceiver === "ADMIN"
                      ? "The platform is holding this amount — it will offset the commission at settlement."
                      : "The partner side is holding this advance — it will be netted from their settlement payout."}
                  </Typography>
                </Stack>
              </Box>
            )}

            {item.coupon_discount > 0 && (
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.warning.main, 0.07), border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}` }}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <LocalOffer sx={{ color: "warning.main", fontSize: 16, mt: 0.2, flexShrink: 0 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    A coupon discount of <strong>{fmtINR(item.coupon_discount)}</strong> was applied.
                    After settlement, a <strong>Coupon Disbursement</strong> record will be created —
                    approve it on the Coupon Disbursements page to reimburse the partner.
                  </Typography>
                </Stack>
              </Box>
            )}
          </Stack>
        )}

        {/* ── STEP 3: Settlement Amounts + Confirm ── */}
        {step === 2 && (
          <Stack spacing={2}>
            <Typography variant="overline" color="primary.main" fontWeight={800} sx={{ letterSpacing: 1.5 }}>
              Settlement Confirmation
            </Typography>

            {/* ── Custody arithmetic breakdown ── */}
            <Box sx={{
              p: 2.5, borderRadius: 2,
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.success.main, 0.04)} 100%)`,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
            }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" mb={1.5} sx={{ letterSpacing: 0.8, textTransform: "uppercase" }}>
                Net Position Calculation
              </Typography>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Trip Fare</Typography>
                  <Typography variant="body2" fontWeight={700}>{fmtINR(item.final_amount)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Platform Commission</Typography>
                  <Typography variant="body2" fontWeight={700} color="warning.main">− {fmtINR(item.platform_commission)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Partner Payout (earned)</Typography>
                  <Typography variant="body2" fontWeight={700} color="success.main">{fmtINR(item.partner_payout)}</Typography>
                </Stack>
                <Divider />

                {/* What partner side is already holding */}
                {advHeld > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <SwapHoriz sx={{ fontSize: 13, color: "text.disabled" }} />
                      <Typography variant="body2" color="text.secondary">
                        Advance held by partner ({advReceiver})
                      </Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={700} color="error.light">− {fmtINR(advHeld)}</Typography>
                  </Stack>
                )}
                {advAmount > 0 && advHeld === 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <SwapHoriz sx={{ fontSize: 13, color: "text.disabled" }} />
                      <Typography variant="body2" color="text.secondary">
                        Advance held by ADMIN (offsets commission)
                      </Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={700} color="info.main">{fmtINR(advAmount)}</Typography>
                  </Stack>
                )}
                {balHeld > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <SwapHoriz sx={{ fontSize: 13, color: "text.disabled" }} />
                      <Typography variant="body2" color="text.secondary">
                        Balance held by partner side ({item.payment_collected_by})
                      </Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={700} color="error.light">− {fmtINR(balHeld)}</Typography>
                  </Stack>
                )}
                {item.coupon_discount > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <LocalOffer sx={{ fontSize: 13, color: "warning.main" }} />
                      <Typography variant="body2" color="text.secondary">Coupon (reimbursed separately)</Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={700} color="warning.main">− {fmtINR(item.coupon_discount)}</Typography>
                  </Stack>
                )}

                <Divider />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" fontWeight={800}>Net Settlement</Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {direction === "CREDIT" && <TrendingUp sx={{ color: "success.main", fontSize: 18 }} />}
                    {direction === "DEBIT"  && <TrendingDown sx={{ color: "error.main", fontSize: 18 }} />}
                    <Typography variant="h5" fontWeight={900} color={directionColor}>
                      {direction === "DEBIT" ? "−" : ""}{fmtINR(Math.abs(net))}
                    </Typography>
                  </Stack>
                </Stack>
              </Stack>
            </Box>

            {/* ── Direction card ── */}
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: directionBg, border: `1px solid ${directionBorder}` }}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                {direction === "CREDIT" && <TrendingUp sx={{ color: "success.main", fontSize: 22, mt: 0.2, flexShrink: 0 }} />}
                {direction === "DEBIT"  && <TrendingDown sx={{ color: "error.main", fontSize: 22, mt: 0.2, flexShrink: 0 }} />}
                {direction === "NONE"   && <CheckCircle sx={{ color: "text.secondary", fontSize: 22, mt: 0.2, flexShrink: 0 }} />}
                <Box>
                  <Typography variant="body2" fontWeight={700}
                    color={direction === "CREDIT" ? "success.dark" : direction === "DEBIT" ? "error.dark" : "text.secondary"}
                    mb={0.5}
                  >
                    {direction === "CREDIT" && `₹${Math.abs(net).toFixed(2)} will be CREDITED to partner wallet`}
                    {direction === "DEBIT"  && `₹${Math.abs(net).toFixed(2)} will be DEBITED from partner wallet`}
                    {direction === "NONE"   && "No wallet movement required"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    {direction === "CREDIT" && advAmount > 0 && advHeld === 0 && (
                      <>
                        Admin collected advance ₹{fmtINR(advAmount)} — after deducting commission ₹{fmtINR(item.platform_commission)},
                        the remaining <strong>{fmtINR(Math.abs(net))}</strong> is credited to the partner.
                      </>
                    )}
                    {direction === "CREDIT" && (advAmount === 0 || advHeld > 0) && (
                      <>
                        Partner is owed <strong>{fmtINR(Math.abs(net))}</strong> after all custody offsets. Wallet will be credited.
                      </>
                    )}
                    {direction === "DEBIT" && (
                      <>
                        The partner side is holding <strong>{fmtINR(partnerHeld)}</strong> more than their payout of{" "}
                        <strong>{fmtINR(item.partner_payout)}</strong>. Commission of{" "}
                        <strong>{fmtINR(Math.abs(net))}</strong> will be debited from partner wallet.
                      </>
                    )}
                    {direction === "NONE" && (
                      <>
                        What the partner side holds exactly matches what they are owed. No wallet movement needed.
                      </>
                    )}
                  </Typography>
                </Box>
              </Stack>
            </Box>

            {/* ── Partner wallet check (only shown for DEBIT) ── */}
            {direction === "DEBIT" && (
              <Box sx={{
                p: 1.5, borderRadius: 2,
                bgcolor: partnerSufficient
                  ? alpha(theme.palette.success.main, 0.06)
                  : alpha(theme.palette.error.main, 0.08),
                border: `1px solid ${partnerSufficient
                  ? alpha(theme.palette.success.main, 0.25)
                  : alpha(theme.palette.error.main, 0.3)}`,
              }}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Partner Wallet Balance</Typography>
                  <Typography variant="caption" fontWeight={700} color={partnerSufficient ? "success.main" : "error.main"}>
                    {fmtINR(item.partner_wallet_balance)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Amount to Debit</Typography>
                  <Typography variant="caption" fontWeight={700}>{fmtINR(debitAmount)}</Typography>
                </Stack>
                {!partnerSufficient && (
                  <Typography variant="caption" color="error.main" fontWeight={600} display="block" mt={0.5}>
                    ✗ Insufficient wallet balance. Partner must top up before settlement.
                  </Typography>
                )}
                {partnerSufficient && (
                  <Typography variant="caption" color="success.main" fontWeight={600} display="block" mt={0.5}>
                    ✓ Wallet balance sufficient for settlement.
                  </Typography>
                )}
              </Box>
            )}

            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.grey[500], 0.06) }}>
              <Typography variant="caption" color="text.secondary">
                This action marks the booking as <strong>SETTLED</strong> and closes the master booking. This cannot be undone.
              </Typography>
            </Box>

            {error && (
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.error.main, 0.08), border: `1px solid ${alpha(theme.palette.error.main, 0.2)}` }}>
                <Typography variant="caption" color="error.main" fontWeight={600}>{error}</Typography>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
        <Button onClick={handleClose} disabled={loading} variant="outlined" size="small">Cancel</Button>
        <Box flex={1} />
        {step > 0 && (
          <Button
            onClick={() => setStep(s => s - 1)}
            disabled={loading}
            variant="outlined"
            size="small"
            startIcon={<ArrowBack fontSize="small" />}
          >
            Back
          </Button>
        )}
        {step < 2 ? (
          <Button
            onClick={() => setStep(s => s + 1)}
            variant="contained"
            size="small"
            endIcon={<ArrowForward fontSize="small" />}
            sx={{ fontWeight: 700 }}
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSettle}
            disabled={loading || (direction === "DEBIT" && !partnerSufficient)}
            variant="contained"
            color="success"
            size="small"
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <TaskAlt fontSize="small" />}
            sx={{ fontWeight: 700 }}
          >
            {loading ? "Settling…" : "Confirm Settle"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}



// ════════════════════════════════════════════════════════════════
// SETTLEMENTS TABLE
// ════════════════════════════════════════════════════════════════

function SettlementTable({
  data, loading, statusFilter, onSettle,
}: {
  data: SettlementListResponse | null;
  loading: boolean;
  statusFilter: string;
  onSettle: (item: SettlementItem) => void;
}) {
  const theme = useTheme();

  return (
    <TableContainer component={Paper} sx={{ borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
            {["Booking", "Partner", "Customer", "Payment Mode", "Fare", "Commission", "Partner Payout", "Coupon", ""].map(h => (
              <TableCell key={h} sx={{ fontWeight: 800, fontSize: "0.72rem", letterSpacing: 0.5, py: 1.5, color: "text.secondary" }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                <CircularProgress size={28} />
              </TableCell>
            </TableRow>
          )}
          {!loading && (!data || data.items.length === 0) && (
            <TableRow>
              <TableCell colSpan={9} align="center" sx={{ py: 5 }}>
                <Stack alignItems="center" spacing={1}>
                  <AccountBalance sx={{ fontSize: 36, color: "text.disabled" }} />
                  <Typography variant="body2" color="text.secondary">
                    {statusFilter === "PENDING" ? "No bookings pending settlement" : "No settled bookings"}
                  </Typography>
                </Stack>
              </TableCell>
            </TableRow>
          )}
          {!loading && data?.items.map(row => (
            <TableRow key={row.cab_booking_number} hover
              sx={{ cursor: "pointer", "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.04) } }}
            >
              <TableCell>
                <Typography variant="body2" fontWeight={700} color="primary.main">{row.cab_booking_number}</Typography>
                <Typography variant="caption" color="text.secondary">{row.invoice_number ?? "No invoice"}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" fontWeight={600}>{row.partner_name ?? "—"}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Wallet: {fmtINR(row.partner_wallet_balance)}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{row.customer_name ?? "—"}</Typography>
              </TableCell>
              <TableCell>
                {row.payment_mode ? (
                  <Chip
                    icon={MODE_ICON[row.payment_mode] as any}
                    label={row.payment_mode}
                    size="small"
                    color={MODE_COLOR[row.payment_mode] ?? "default"}
                    sx={{ fontWeight: 700 }}
                  />
                ) : "—"}
              </TableCell>
              <TableCell>
                <Typography variant="body2" fontWeight={700}>{fmtINR(row.final_amount)}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" fontWeight={700} color="warning.main">{fmtINR(row.platform_commission)}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" fontWeight={700} color="success.main">{fmtINR(row.partner_payout)}</Typography>
              </TableCell>
              <TableCell>
                {row.coupon_discount > 0 ? (
                  <Chip
                    icon={<LocalOffer sx={{ fontSize: "13px !important" }} />}
                    label={fmtINR(row.coupon_discount)}
                    size="small"
                    color={row.coupon_disbursement?.status === "DISBURSED" ? "success" : "warning"}
                    variant="outlined"
                    sx={{ fontWeight: 700, fontSize: "0.65rem" }}
                  />
                ) : <Typography variant="caption" color="text.disabled">—</Typography>}
              </TableCell>
              <TableCell>
                {!row.is_settled ? (
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    onClick={() => onSettle(row)}
                    startIcon={<TaskAlt sx={{ fontSize: 14 }} />}
                    sx={{ fontWeight: 700, fontSize: "0.7rem" }}
                  >
                    Settle
                  </Button>
                ) : (
                  <Chip label="Settled" size="small" color="success" sx={{ fontWeight: 700, fontSize: "0.68rem" }} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}


// ════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════

interface SnackState { open: boolean; msg: string; sev: "success" | "error" }

export default function SettlementsPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [tab,            setTab]           = useState(0); // 0=Pending, 1=Settled
  const [service,        setService]       = useState<"CAB" | "HOTEL" | "TOUR">(
    (searchParams.get("service") as "CAB" | "HOTEL" | "TOUR") ?? "CAB"
  );
  const [data,           setData]          = useState<SettlementListResponse | null>(null);
  const [loading,        setLoading]       = useState(false);
  const [settleItem,     setSettleItem]    = useState<SettlementItem | null>(null);
  const [snack,          setSnack]         = useState<SnackState>({ open: false, msg: "", sev: "success" });
  const [pendingCoupons, setPendingCoupons]= useState(0);

  const showSnack = (msg: string, sev: "success" | "error" = "success") =>
    setSnack({ open: true, msg, sev });

  const statusFilter = tab === 0 ? "PENDING" : "SETTLED";

  const load = useCallback(async () => {
    if (service !== "CAB") return;
    setLoading(true);
    try {
      const res = await settlementService.list(statusFilter, 1, 50);
      setData(res);
    } catch { showSnack("Failed to load settlements.", "error"); }
    finally { setLoading(false); }
  }, [statusFilter, service]);

  // Also fetch pending coupon count for badge
  const loadCouponCount = useCallback(async () => {
    try {
      const res = await settlementService.listCouponDisbursements("PENDING", 1, 1);
      setPendingCoupons(res.total);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCouponCount(); }, [loadCouponCount]);

  function handleSettleSuccess(msg: string) {
    showSnack(msg);
    load();
    loadCouponCount();
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Page Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center" mb={0.5}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 2,
              background: `linear-gradient(135deg, ${theme.palette.success.dark} 0%, ${theme.palette.success.main} 100%)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <AccountBalance sx={{ color: "#fff", fontSize: 22 }} />
            </Box>
            <Typography variant="h5" fontWeight={800}>Settlements</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Settle completed bookings — commission deduction & partner payout management.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {pendingCoupons > 0 && (
            <Button
              variant="outlined"
              color="warning"
              size="small"
              startIcon={<LocalOffer fontSize="small" />}
              onClick={() => navigate("/settlements/coupon-disbursements")}
              sx={{ fontWeight: 700 }}
            >
              Coupon Disbursements
              <Badge badgeContent={pendingCoupons} color="warning" sx={{ ml: 1.5 }} />
            </Button>
          )}
          <Tooltip title="Refresh">
            <IconButton onClick={load} disabled={loading} size="small">
              <Refresh sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Service selector — Cab | Hotel | Tour share the same settlement arithmetic */}
      <ToggleButtonGroup
        value={service}
        exclusive
        onChange={(_, v) => v && setService(v)}
        size="small"
        sx={{
          mb: 3,
          "& .MuiToggleButton-root": { fontWeight: 700, px: 2.5, textTransform: "none" },
        }}
      >
        <ToggleButton value="CAB">
          <DirectionsCar sx={{ fontSize: 18, mr: 0.75 }} /> Cab Bookings
        </ToggleButton>
        <ToggleButton value="HOTEL">
          <Hotel sx={{ fontSize: 18, mr: 0.75 }} /> Hotel Bookings
        </ToggleButton>
        <ToggleButton value="TOUR">
          <Tour sx={{ fontSize: 18, mr: 0.75 }} /> Tour Bookings
        </ToggleButton>
      </ToggleButtonGroup>

      {service === "HOTEL" ? (
        <HotelSettlements showSnack={showSnack} onSettled={loadCouponCount} />
      ) : service === "TOUR" ? (
        <TourSettlements showSnack={showSnack} onSettled={loadCouponCount} />
      ) : (
      <>
      {/* Stats row */}
      {data && (
        <Stack direction="row" spacing={2} mb={3} flexWrap="wrap" gap={2}>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: "background.paper", border: `1px solid ${alpha(theme.palette.divider, 0.5)}`, minWidth: 140 }}>
            <Typography variant="caption" color="text.secondary">
              {tab === 0 ? "Pending Settlement" : "Total Settled"}
            </Typography>
            <Typography variant="h4" fontWeight={800} color={tab === 0 ? "warning.main" : "success.main"}>
              {data.total}
            </Typography>
          </Box>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: "background.paper", border: `1px solid ${alpha(theme.palette.divider, 0.5)}`, minWidth: 160 }}>
            <Typography variant="caption" color="text.secondary">Total Fare Value</Typography>
            <Typography variant="h5" fontWeight={800}>
              {fmtINR(data.items.reduce((s, i) => s + (i.final_amount ?? 0), 0))}
            </Typography>
          </Box>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: "background.paper", border: `1px solid ${alpha(theme.palette.divider, 0.5)}`, minWidth: 160 }}>
            <Typography variant="caption" color="text.secondary">Total Commission</Typography>
            <Typography variant="h5" fontWeight={800} color="warning.main">
              {fmtINR(data.items.reduce((s, i) => s + (i.platform_commission ?? 0), 0))}
            </Typography>
          </Box>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: "background.paper", border: `1px solid ${alpha(theme.palette.divider, 0.5)}`, minWidth: 160 }}>
            <Typography variant="caption" color="text.secondary">Total Partner Payout</Typography>
            <Typography variant="h5" fontWeight={800} color="success.main">
              {fmtINR(data.items.reduce((s, i) => s + (i.partner_payout ?? 0), 0))}
            </Typography>
          </Box>
        </Stack>
      )}

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 2,
          "& .MuiTab-root": { fontWeight: 700, fontSize: "0.82rem" },
          "& .MuiTabs-indicator": { height: 3, borderRadius: 1.5 },
        }}
      >
        <Tab label={
          <Stack direction="row" spacing={1} alignItems="center">
            <span>Pending Settlement</span>
            {data && tab === 0 && data.total > 0 && (
              <Chip label={data.total} size="small" color="warning" sx={{ fontWeight: 700, height: 18, fontSize: "0.62rem" }} />
            )}
          </Stack>
        } />
        <Tab label="Settled" />
      </Tabs>

      <SettlementTable
        data={data}
        loading={loading}
        statusFilter={statusFilter}
        onSettle={setSettleItem}
      />

      {/* Coupon disbursements reminder */}
      {pendingCoupons > 0 && (
        <Box sx={{
          mt: 3, p: 2, borderRadius: 2,
          background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.08)} 0%, ${alpha(theme.palette.warning.light, 0.04)} 100%)`,
          border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
          display: "flex", alignItems: "center", gap: 2,
        }}>
          <LocalOffer sx={{ color: "warning.main", fontSize: 26, flexShrink: 0 }} />
          <Box flex={1}>
            <Typography variant="body2" fontWeight={700} color="warning.dark">
              {pendingCoupons} Coupon Disbursement{pendingCoupons > 1 ? "s" : ""} Pending
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Partners are owed coupon discount amounts. Approve them on the Coupon Disbursements page.
            </Typography>
          </Box>
          <Button
            size="small"
            variant="contained"
            color="warning"
            onClick={() => navigate("/settlements/coupon-disbursements")}
            sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
          >
            Review Now
          </Button>
        </Box>
      )}

      {/* Settle Modal */}
      {settleItem && (
        <SettleModal
          open={!!settleItem}
          item={settleItem}
          onClose={() => setSettleItem(null)}
          onSuccess={handleSettleSuccess}
        />
      )}
      </>
      )}

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ fontWeight: 600 }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
