// ============================================================
// WAYTERO ADMIN — TOUR SETTLEMENTS SECTION
// Rendered inside SettlementsPage when the "Tour" service is selected.
//
// Uses the identical net-position arithmetic as the cab/hotel side
// (settlement_api._compute_tour_position): custody (received_by on each
// advance) drives the wallet direction, commission is deducted.
//
//   net = partner_payout − partner_held
//     net > 0  → CREDIT partner wallet   (platform holds money it owes)
//     net < 0  → DEBIT  partner wallet   (partner holds more than owed)
//     net = 0  → no movement
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  Box, Stack, Typography, Button, Chip, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, alpha, useTheme, CircularProgress,
  Dialog, DialogContent, DialogActions,
  Divider, Stepper, Step, StepLabel, LinearProgress,
} from "@mui/material";
import {
  Tour, TaskAlt, Money, AccountBalanceWallet, CreditCard, PhoneAndroid,
  ArrowBack, ArrowForward, CheckCircle, Person,
  ReceiptLong, TrendingUp, TrendingDown, InfoOutlined,
  CalendarMonth, Groups,
} from "@mui/icons-material";
import {
  settlementService,
  TourSettlementItem,
  TourSettlementListResponse,
} from "../../services/settlement.service";

const fmtINR = (n: number | null | undefined) => {
  if (n == null) return "—";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const MODE_ICON: Record<string, React.ReactNode> = {
  CASH:   <Money fontSize="small" />,
  UPI:    <PhoneAndroid fontSize="small" />,
  WALLET: <AccountBalanceWallet fontSize="small" />,
  ONLINE: <CreditCard fontSize="small" />,
};

const MODE_COLOR: Record<string, "default" | "warning" | "info" | "success"> = {
  CASH:   "warning",
  UPI:    "info",
  WALLET: "info",
  ONLINE: "success",
};

const SETTLE_STEPS = ["Tour Details", "Payment Details", "Settlement"];

// ════════════════════════════════════════════════════════════════
// 3-STEP TOUR SETTLE MODAL
// ════════════════════════════════════════════════════════════════

function TourSettleModal({
  open, item, onClose, onSuccess,
}: {
  open: boolean;
  item: TourSettlementItem;
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
      const res = await settlementService.settleTour(item.tour_booking_number);
      onSuccess(res.message ?? "Tour booking settled successfully!");
      handleClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Settlement failed.");
    } finally { setLoading(false); }
  }

  // Net position from backend — the authoritative source. Never re-derive.
  const pos = item.position;
  const net          = pos?.net_settlement ?? 0;
  const direction    = pos?.wallet_direction ?? "NONE";
  const partnerHeld  = pos?.partner_held ?? 0;
  const platformHeld = pos?.platform_held ?? 0;
  const advAmount    = pos?.advance_paid ?? item.advance_paid ?? 0;

  const debitAmount       = direction === "DEBIT" ? Math.abs(net) : 0;
  const partnerSufficient = direction !== "DEBIT" || (item.partner_wallet_balance ?? 0) >= debitAmount;

  const directionColor = direction === "CREDIT"
    ? theme.palette.success.main
    : direction === "DEBIT" ? theme.palette.error.main : theme.palette.text.secondary;
  const directionBg = direction === "CREDIT"
    ? alpha(theme.palette.success.main, 0.07)
    : direction === "DEBIT" ? alpha(theme.palette.error.main, 0.07) : alpha(theme.palette.grey[500], 0.06);
  const directionBorder = direction === "CREDIT"
    ? alpha(theme.palette.success.main, 0.3)
    : direction === "DEBIT" ? alpha(theme.palette.error.main, 0.3) : alpha(theme.palette.divider, 0.4);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      {/* Header */}
      <Box sx={{
        background: `linear-gradient(135deg, ${theme.palette.success.dark} 0%, ${theme.palette.primary.dark} 100%)`,
        px: 3, pt: 2.5, pb: 2,
      }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Tour sx={{ color: "#fff", fontSize: 28 }} />
          <Box flex={1}>
            <Typography variant="h6" fontWeight={800} color="white">Settle Tour Booking</Typography>
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.75) }}>
              {item.tour_booking_number} · {item.partner_name ?? "Partner"}
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
        {/* ── STEP 1: Tour Details ── */}
        {step === 0 && (
          <Stack spacing={2}>
            <Typography variant="overline" color="primary.main" fontWeight={800} sx={{ letterSpacing: 1.5 }}>
              Tour Overview
            </Typography>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.04), border: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Box flex={1} minWidth={120}>
                    <Typography variant="caption" color="text.secondary">Master Booking</Typography>
                    <Typography variant="body2" fontWeight={700}>{item.booking_number ?? "—"}</Typography>
                  </Box>
                  <Box flex={1} minWidth={120}>
                    <Typography variant="caption" color="text.secondary">Tour Booking</Typography>
                    <Typography variant="body2" fontWeight={700} color="primary.main">{item.tour_booking_number}</Typography>
                  </Box>
                </Stack>
                <Box>
                  <Typography variant="caption" color="text.secondary">Package</Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Tour sx={{ fontSize: 14, color: "text.secondary" }} />
                    <Typography variant="body2" fontWeight={700}>{item.package_name ?? "—"}</Typography>
                  </Stack>
                  {item.destination && (
                    <Typography variant="caption" color="text.secondary">{item.destination}</Typography>
                  )}
                </Box>
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
                    <Typography variant="caption" color="text.secondary">Travellers</Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Groups sx={{ fontSize: 14, color: "text.secondary" }} />
                      <Typography variant="body2" fontWeight={600}>{item.persons_count ?? "—"}</Typography>
                    </Stack>
                  </Box>
                </Stack>
                {(item.travel_start_date || item.travel_end_date) && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Travel Dates</Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <CalendarMonth sx={{ fontSize: 14, color: "text.secondary" }} />
                      <Typography variant="body2" fontWeight={600}>
                        {item.travel_start_date ?? "—"} → {item.travel_end_date ?? "—"}
                        {item.duration_days ? ` (${item.duration_days}D / ${item.duration_nights ?? 0}N)` : ""}
                      </Typography>
                    </Stack>
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

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              {item.advance_received_by && (
                <Chip label={`Advance held by: ${item.advance_received_by}`} size="small"
                  color={item.advance_received_by === "ADMIN" ? "info" : "warning"}
                  variant="outlined" sx={{ fontWeight: 700 }} />
              )}
              {pos?.balance_due === 0 ? (
                <Chip label="Fully Paid" size="small" color="success" sx={{ fontWeight: 700 }} />
              ) : (
                <Chip label={`Balance due: ${fmtINR(pos?.balance_due)}`} size="small" color="warning" sx={{ fontWeight: 700 }} />
              )}
            </Stack>

            <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.grey[500], 0.05), border: `1px solid ${alpha(theme.palette.divider, 0.6)}` }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Package Total</Typography>
                  <Typography variant="body2" fontWeight={700}>{fmtINR(item.total_amount)}</Typography>
                </Stack>
                {item.additional_amount > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">incl. additional charges</Typography>
                    <Typography variant="body2" fontWeight={700} color="warning.main">{fmtINR(item.additional_amount)}</Typography>
                  </Stack>
                )}
                <Divider />
                {advAmount > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Payments Received</Typography>
                    <Typography variant="body2" fontWeight={700} color="info.main">{fmtINR(advAmount)}</Typography>
                  </Stack>
                )}
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" fontWeight={800}>Balance Due</Typography>
                  <Typography variant="h6" fontWeight={800} color={(pos?.balance_due ?? 0) > 0 ? "warning.main" : "success.main"}>
                    {fmtINR(pos?.balance_due)}
                  </Typography>
                </Stack>
              </Stack>
            </Box>

            {/* Receipts with custody */}
            {item.advances.length > 0 && (
              <Box>
                <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ letterSpacing: 0.8, textTransform: "uppercase" }}>
                  RECEIPTS & CUSTODY
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {item.advances.map(a => (
                    <Stack key={a.id} direction="row" alignItems="center" justifyContent="space-between"
                      sx={{ p: 1.25, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.6)}`, bgcolor: alpha(theme.palette.grey[500], 0.04) }}>
                      <Box>
                        <Typography variant="body2" fontWeight={700} fontFamily="monospace">{a.receipt_number}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {a.payment_mode} · collected by {a.received_by}{a.collected_by_role ? ` (${a.collected_by_role})` : ""}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Chip
                          icon={MODE_ICON[a.payment_mode] as any}
                          label={a.payment_mode}
                          size="small"
                          color={MODE_COLOR[a.payment_mode] ?? "default"}
                          sx={{ fontWeight: 700, fontSize: "0.62rem" }}
                        />
                        <Typography variant="body2" fontWeight={800}>{fmtINR(a.amount)}</Typography>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Custody note */}
            <Box sx={{ p: 1.5, borderRadius: 2,
              bgcolor: platformHeld >= partnerHeld ? alpha(theme.palette.info.main, 0.07) : alpha(theme.palette.warning.main, 0.07),
              border: `1px solid ${platformHeld >= partnerHeld ? alpha(theme.palette.info.main, 0.25) : alpha(theme.palette.warning.main, 0.25)}`,
            }}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <InfoOutlined sx={{ fontSize: 16, mt: 0.2, flexShrink: 0,
                  color: platformHeld >= partnerHeld ? "info.main" : "warning.main" }} />
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  Platform is holding <strong>{fmtINR(platformHeld)}</strong> and the partner side is holding{" "}
                  <strong>{fmtINR(partnerHeld)}</strong> of the collected payments. Custody drives the settlement
                  direction below.
                </Typography>
              </Stack>
            </Box>
          </Stack>
        )}

        {/* ── STEP 3: Settlement Amounts + Confirm ── */}
        {step === 2 && (
          <Stack spacing={2}>
            <Typography variant="overline" color="primary.main" fontWeight={800} sx={{ letterSpacing: 1.5 }}>
              Settlement Confirmation
            </Typography>

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
                  <Typography variant="body2" color="text.secondary">Package Total</Typography>
                  <Typography variant="body2" fontWeight={700}>{fmtINR(item.total_amount)}</Typography>
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
                {partnerHeld > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Payments held by partner</Typography>
                    <Typography variant="body2" fontWeight={700} color="error.light">− {fmtINR(partnerHeld)}</Typography>
                  </Stack>
                )}
                {platformHeld > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Payments held by platform</Typography>
                    <Typography variant="body2" fontWeight={700} color="info.main">{fmtINR(platformHeld)}</Typography>
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

            {/* Direction card */}
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
                    {direction === "CREDIT" && `${fmtINR(Math.abs(net))} will be CREDITED to partner wallet`}
                    {direction === "DEBIT"  && `${fmtINR(Math.abs(net))} will be DEBITED from partner wallet`}
                    {direction === "NONE"   && "No wallet movement required"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    {direction === "CREDIT" && (
                      <>
                        The platform collected the payments and owes the partner their payout of{" "}
                        <strong>{fmtINR(item.partner_payout)}</strong> less what the partner already holds. The
                        remaining <strong>{fmtINR(Math.abs(net))}</strong> is credited to their wallet.
                      </>
                    )}
                    {direction === "DEBIT" && (
                      <>
                        The partner side is holding <strong>{fmtINR(partnerHeld)}</strong> — more than their payout of{" "}
                        <strong>{fmtINR(item.partner_payout)}</strong>. The difference of{" "}
                        <strong>{fmtINR(Math.abs(net))}</strong> (commission) is debited from their wallet.
                      </>
                    )}
                    {direction === "NONE" && (
                      <>What the partner side holds exactly matches what they are owed. No wallet movement needed.</>
                    )}
                  </Typography>
                </Box>
              </Stack>
            </Box>

            {/* Partner wallet check (DEBIT only) */}
            {direction === "DEBIT" && (
              <Box sx={{
                p: 1.5, borderRadius: 2,
                bgcolor: partnerSufficient ? alpha(theme.palette.success.main, 0.06) : alpha(theme.palette.error.main, 0.08),
                border: `1px solid ${partnerSufficient ? alpha(theme.palette.success.main, 0.25) : alpha(theme.palette.error.main, 0.3)}`,
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
                {!partnerSufficient
                  ? <Typography variant="caption" color="error.main" fontWeight={600} display="block" mt={0.5}>✗ Insufficient wallet balance. Partner must top up before settlement.</Typography>
                  : <Typography variant="caption" color="success.main" fontWeight={600} display="block" mt={0.5}>✓ Wallet balance sufficient for settlement.</Typography>}
              </Box>
            )}

            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.grey[500], 0.06) }}>
              <Typography variant="caption" color="text.secondary">
                This marks the tour booking as <strong>SETTLED</strong> and closes the master booking once all
                services are settled. This cannot be undone.
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
          <Button onClick={() => setStep(s => s - 1)} disabled={loading} variant="outlined" size="small" startIcon={<ArrowBack fontSize="small" />}>
            Back
          </Button>
        )}
        {step < 2 ? (
          <Button onClick={() => setStep(s => s + 1)} variant="contained" size="small" endIcon={<ArrowForward fontSize="small" />} sx={{ fontWeight: 700 }}>
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSettle}
            disabled={loading || (direction === "DEBIT" && !partnerSufficient)}
            variant="contained" color="success" size="small"
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
// TOUR SETTLEMENTS TABLE
// ════════════════════════════════════════════════════════════════

function TourSettlementTable({
  data, loading, statusFilter, onSettle,
}: {
  data: TourSettlementListResponse | null;
  loading: boolean;
  statusFilter: string;
  onSettle: (item: TourSettlementItem) => void;
}) {
  const theme = useTheme();

  return (
    <TableContainer component={Paper} sx={{ borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: alpha(theme.palette.success.main, 0.05) }}>
            {["Tour Booking", "Package / Partner", "Customer", "Payment", "Total", "Commission", "Partner Payout", "Status", ""].map(h => (
              <TableCell key={h} sx={{ fontWeight: 800, fontSize: "0.72rem", letterSpacing: 0.5, py: 1.5, color: "text.secondary" }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading && (
            <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
          )}
          {!loading && (!data || data.items.length === 0) && (
            <TableRow>
              <TableCell colSpan={9} align="center" sx={{ py: 5 }}>
                <Stack alignItems="center" spacing={1}>
                  <Tour sx={{ fontSize: 36, color: "text.disabled" }} />
                  <Typography variant="body2" color="text.secondary">
                    {statusFilter === "PENDING" ? "No tour bookings pending settlement" : "No settled tour bookings"}
                  </Typography>
                </Stack>
              </TableCell>
            </TableRow>
          )}
          {!loading && data?.items.map(row => (
            <TableRow key={row.tour_booking_number} hover
              sx={{ "&:hover": { bgcolor: alpha(theme.palette.success.main, 0.04) } }}
            >
              <TableCell>
                <Typography variant="body2" fontWeight={700} color="success.main">{row.tour_booking_number}</Typography>
                <Typography variant="caption" color="text.secondary">{row.invoice_number ?? "No invoice"}</Typography>
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Tour sx={{ fontSize: 14, color: "text.disabled" }} />
                  <Typography variant="body2" fontWeight={600}>{row.package_name ?? "—"}</Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {row.partner_name ?? "—"} · Wallet: {fmtINR(row.partner_wallet_balance)}
                </Typography>
              </TableCell>
              <TableCell><Typography variant="body2">{row.customer_name ?? "—"}</Typography></TableCell>
              <TableCell>
                {row.advances.length > 0 ? (
                  <Stack spacing={0.25}>
                    <Chip label={`${row.advances.length} payment${row.advances.length > 1 ? "s" : ""}`} size="small"
                      color="info" variant="outlined" sx={{ fontWeight: 700 }} />
                    <Typography variant="caption" color="text.secondary">
                      held by {row.advance_received_by ?? "—"}
                    </Typography>
                  </Stack>
                ) : "—"}
              </TableCell>
              <TableCell><Typography variant="body2" fontWeight={700}>{fmtINR(row.total_amount)}</Typography></TableCell>
              <TableCell><Typography variant="body2" fontWeight={700} color="warning.main">{fmtINR(row.platform_commission)}</Typography></TableCell>
              <TableCell><Typography variant="body2" fontWeight={700} color="success.main">{fmtINR(row.partner_payout)}</Typography></TableCell>
              <TableCell>
                <Chip label={row.tour_status.replace(/_/g, " ")} size="small"
                  color={row.tour_status === "COMPLETED" ? "warning" : "success"}
                  sx={{ fontWeight: 700, fontSize: "0.65rem" }} />
              </TableCell>
              <TableCell>
                {!row.is_settled ? (
                  <Button size="small" variant="contained" color="success" onClick={() => onSettle(row)}
                    startIcon={<TaskAlt sx={{ fontSize: 14 }} />} sx={{ fontWeight: 700, fontSize: "0.7rem" }}>
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
// TOUR SETTLEMENTS SECTION (self-contained: tabs + stats + table + modal)
// ════════════════════════════════════════════════════════════════

export default function TourSettlements({
  showSnack, onSettled,
}: {
  showSnack: (msg: string, sev?: "success" | "error") => void;
  onSettled: () => void;   // parent refreshes coupon badge etc.
}) {
  const theme = useTheme();
  const [tab,        setTab]        = useState(0); // 0=Pending, 1=Settled
  const [data,       setData]       = useState<TourSettlementListResponse | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [settleItem, setSettleItem] = useState<TourSettlementItem | null>(null);

  const statusFilter = tab === 0 ? "PENDING" : "SETTLED";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await settlementService.listTour(statusFilter, 1, 50);
      setData(res);
    } catch { showSnack("Failed to load tour settlements.", "error"); }
    finally { setLoading(false); }
  }, [statusFilter, showSnack]);

  useEffect(() => { load(); }, [load]);

  function handleSettleSuccess(msg: string) {
    showSnack(msg);
    load();
    onSettled();
  }

  return (
    <Box>
      {/* Stats row */}
      {data && (
        <Stack direction="row" spacing={2} mb={3} flexWrap="wrap" gap={2}>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: "background.paper", border: `1px solid ${alpha(theme.palette.divider, 0.5)}`, minWidth: 140 }}>
            <Typography variant="caption" color="text.secondary">{tab === 0 ? "Pending Settlement" : "Total Settled"}</Typography>
            <Typography variant="h4" fontWeight={800} color={tab === 0 ? "warning.main" : "success.main"}>{data.total}</Typography>
          </Box>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: "background.paper", border: `1px solid ${alpha(theme.palette.divider, 0.5)}`, minWidth: 160 }}>
            <Typography variant="caption" color="text.secondary">Total Booking Value</Typography>
            <Typography variant="h5" fontWeight={800}>{fmtINR(data.items.reduce((s, i) => s + (i.total_amount ?? 0), 0))}</Typography>
          </Box>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: "background.paper", border: `1px solid ${alpha(theme.palette.divider, 0.5)}`, minWidth: 160 }}>
            <Typography variant="caption" color="text.secondary">Total Commission</Typography>
            <Typography variant="h5" fontWeight={800} color="warning.main">{fmtINR(data.items.reduce((s, i) => s + (i.platform_commission ?? 0), 0))}</Typography>
          </Box>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: "background.paper", border: `1px solid ${alpha(theme.palette.divider, 0.5)}`, minWidth: 160 }}>
            <Typography variant="caption" color="text.secondary">Total Partner Payout</Typography>
            <Typography variant="h5" fontWeight={800} color="success.main">{fmtINR(data.items.reduce((s, i) => s + (i.partner_payout ?? 0), 0))}</Typography>
          </Box>
        </Stack>
      )}

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)}
        sx={{ mb: 2, "& .MuiTab-root": { fontWeight: 700, fontSize: "0.82rem" }, "& .MuiTabs-indicator": { height: 3, borderRadius: 1.5 } }}>
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

      <TourSettlementTable data={data} loading={loading} statusFilter={statusFilter} onSettle={setSettleItem} />

      {settleItem && (
        <TourSettleModal
          open={!!settleItem}
          item={settleItem}
          onClose={() => setSettleItem(null)}
          onSuccess={handleSettleSuccess}
        />
      )}
    </Box>
  );
}
