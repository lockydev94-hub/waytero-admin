// ============================================================
// WAYTERO ADMIN — HOTEL SETTLEMENT MODAL
// Detail:   GET  /admin/settlements/hotel/booking
// Commit:   POST /admin/bookings/{b}/hotel/{h}/settle
// Guard: COMPLETED only, with invoice + balance fully collected.
//
// 3-step wizard that walks the admin through the full settlement
// arithmetic, exactly the way the backend computes it:
//
//   1. Booking details  — who, where, when, invoice
//   2. Payment details  — grand total, advances, balance, custody
//   3. Net settlement   — commission, TDS, partner payout, wallet
//                          direction, with a final confirmation.
//
// A booking can only be settled when all three preconditions are
// met; the modal surfaces any precondition that still fails and
// blocks the "Settle" button until it is green.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, CircularProgress,
  Stack, Avatar, Divider, Alert, Chip, Stepper, Step, StepLabel,
  Paper, List, ListItem, ListItemText,
} from "@mui/material";
import {
  Handshake, Close, CheckCircle, ErrorOutline, InfoOutlined,
  ArrowForward, ArrowBack, AccountBalanceWallet, ReceiptLong,
  PaymentsOutlined, WarningAmber,
} from "@mui/icons-material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { bookingService } from "../../../services/booking.service";

const fmtINR = (n: number | null | undefined) =>
  `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: number;
  hotelId: number;
  reservationNumber: string;
  hotelBookingNumber?: string;
}

export default function HotelSettlementModal({
  open, onClose, bookingId, hotelId, reservationNumber, hotelBookingNumber,
}: Props) {
  const [step, setStep] = useState(0);
  const [confirm, setConfirm] = useState("");

  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (open) {
      setStep(0);
      setConfirm("");
    }
  }, [open]);

  // Read-only enriched detail — same data the Settlements page shows.
  const { data, isLoading, error } = useQuery({
    queryKey: ["hotel-settlement-detail", reservationNumber],
    queryFn: () => bookingService.getHotelSettlementDetail(reservationNumber),
    enabled: open && !!reservationNumber,
    staleTime: 0,
  });

  const settleMutation = useMutation({
    mutationFn: () => bookingService.hotelSettle(bookingId, hotelId),
    onSuccess: (res: any) => {
      enqueueSnackbar(
        `Settled. Partner wallet: ${fmtINR(res?.partner_wallet_balance)} · Payout: ${fmtINR(res?.partner_payout)} · TDS: ${fmtINR(res?.tds_deducted)}.`,
        { variant: "success" },
      );
      qc.invalidateQueries({ queryKey: ["admin-booking", bookingId] });
      qc.invalidateQueries({ queryKey: ["hotel-settlement-detail", reservationNumber] });
      qc.invalidateQueries({ queryKey: ["admin-hotel-settlements"] });
      handleClose();
    },
    onError: (e: any) => {
      const detail = e?.response?.data?.detail;
      enqueueSnackbar(typeof detail === "string" ? detail : "Settlement failed", { variant: "error" });
    },
  });

  const handleClose = () => {
    setStep(0);
    setConfirm("");
    onClose();
  };

  // Precondition checks — the modal guides the admin to fix anything
  // that's red before allowing a click on the "Settle" button.
  const preconditions = useMemo(() => {
    if (!data) return [];
    return [
      {
        key: "status_completed",
        label: "Booking status is COMPLETED",
        ok: data.hotel_status === "COMPLETED",
        hint: `Current status: ${data.hotel_status}. Run "Mark Completed" first.`,
      },
      {
        key: "invoice_generated",
        label: "Invoice generated",
        ok: !!data.invoice_number,
        hint: data.invoice_number ? `Invoice ${data.invoice_number}` : "Generate the invoice from the booking page.",
      },
      {
        key: "balance_paid",
        label: "Balance fully collected",
        ok: (data.balance_due ?? 0) <= 0,
        hint: (data.balance_due ?? 0) <= 0
          ? `Outstanding: ${fmtINR(0)}`
          : `Outstanding: ${fmtINR(data.balance_due)} — collect via "Collect Payment" first.`,
      },
      {
        key: "wallet_balance",
        label: "Partner wallet can absorb the net",
        // True when net is a credit (partner is owed) OR wallet covers the debit.
        ok:
          (data.position?.net_settlement ?? 0) >= 0 ||
          (data.partner_wallet_balance ?? 0) >= Math.abs(data.position?.net_settlement ?? 0),
        hint: data.position?.wallet_direction === "CREDIT"
          ? `Partner is owed ${fmtINR(data.position.net_settlement)} — will be credited.`
          : data.position?.wallet_direction === "DEBIT"
            ? `Partner owes ${fmtINR(Math.abs(data.position.net_settlement))} — wallet has ${fmtINR(data.partner_wallet_balance)}.`
            : "Net position is zero — no wallet movement.",
      },
    ];
  }, [data]);

  const allOk = preconditions.every((p) => p.ok);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: "success.main", width: 36, height: 36 }}>
              <Handshake fontSize="small" />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Settle Hotel Booking</Typography>
              <Typography variant="caption" color="text.secondary">
                {hotelBookingNumber || reservationNumber}
                {data?.hotel_name ? ` · ${data.hotel_name}` : ""}
              </Typography>
            </Box>
          </Stack>
          <Button size="small" onClick={handleClose} sx={{ minWidth: 0 }}><Close fontSize="small" /></Button>
        </Stack>
      </DialogTitle>
      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        {isLoading ? (
          <Box sx={{ py: 4, textAlign: "center" }}><CircularProgress /></Box>
        ) : error ? (
          <Alert severity="error" sx={{ borderRadius: 2 }}>
            Could not load settlement detail. {(error as any)?.response?.data?.detail || ""}
          </Alert>
        ) : data ? (
          <Stack gap={2}>
            <Stepper activeStep={step} alternativeLabel>
              <Step><StepLabel>Booking</StepLabel></Step>
              <Step><StepLabel>Payment</StepLabel></Step>
              <Step><StepLabel>Net Settlement</StepLabel></Step>
            </Stepper>

            {/* ── Step 0: Booking details ─────────────────────── */}
            {step === 0 && (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
                  <ReceiptLong fontSize="small" color="primary" />
                  <Typography variant="subtitle2" fontWeight={700}>Stay details</Typography>
                </Stack>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 1.5,
                  }}
                >
                  <Field label="Master booking" value={data.booking_number} />
                  <Field label="Reservation number" value={data.reservation_number} />
                  <Field label="Hotel" value={data.hotel_name} />
                  <Field label="Customer" value={data.customer_name} />
                  <Field label="Customer mobile" value={data.customer_mobile} />
                  <Field label="Status" value={
                    <Chip
                      size="small"
                      color={data.hotel_status === "COMPLETED" ? "info" : "default"}
                      label={data.hotel_status}
                    />
                  } />
                  <Field label="Check-in" value={fmtDate(data.check_in_date)} />
                  <Field label="Check-out" value={fmtDate(data.check_out_date)} />
                  <Field label="Stay" value={`${data.nights ?? 0} night(s) · ${data.rooms ?? 0} room(s)`} />
                  <Field label="Invoice" value={
                    data.invoice_number
                      ? <Chip size="small" color="success" label={data.invoice_number} />
                      : <Chip size="small" color="warning" label="Not generated" />
                  } />
                </Box>
              </Paper>
            )}

            {/* ── Step 1: Payment details ────────────────────── */}
            {step === 1 && (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
                  <PaymentsOutlined fontSize="small" color="primary" />
                  <Typography variant="subtitle2" fontWeight={700}>Payment & custody</Typography>
                </Stack>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 1.5,
                  }}
                >
                  <Field label="Grand total" value={fmtINR(data.grand_total)} />
                  <Field label="GST amount" value={fmtINR(data.gst_amount)} />
                  <Field label="Coupon discount" value={fmtINR(data.coupon_discount)} />
                  <Field label="Advance paid" value={fmtINR(data.advance_paid)} />
                  <Field label="Balance due" value={
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      color={data.balance_due > 0 ? "warning.main" : "success.main"}
                    >
                      {fmtINR(data.balance_due)}
                    </Typography>
                  } />
                  <Field label="Payment collected by" value={data.payment_collected_by || "—"} />
                  <Field label="Payment mode" value={data.payment_mode || "—"} />
                  <Field label="Status" value={
                    <Chip
                      size="small"
                      color={data.payment_collected_status === "PAID" ? "success" : "warning"}
                      label={data.payment_collected_status}
                    />
                  } />
                </Box>

                <Divider sx={{ my: 1.5 }} />

                <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                  {preconditions.map((p) => (
                    <Chip
                      key={p.key}
                      icon={p.ok ? <CheckCircle /> : <ErrorOutline />}
                      color={p.ok ? "success" : "warning"}
                      label={p.label}
                      sx={{ fontWeight: 600 }}
                    />
                  ))}
                </Stack>
                {!allOk && (
                  <Alert severity="warning" sx={{ mt: 1.5, borderRadius: 2 }}>
                    <Stack gap={0.5}>
                      {preconditions.filter((p) => !p.ok).map((p) => (
                        <Typography key={p.key} variant="body2"><strong>·</strong> {p.hint}</Typography>
                      ))}
                    </Stack>
                  </Alert>
                )}
              </Paper>
            )}

            {/* ── Step 2: Net settlement arithmetic ──────────── */}
            {step === 2 && (
              <Stack gap={1.5}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
                    <AccountBalanceWallet fontSize="small" color="primary" />
                    <Typography variant="subtitle2" fontWeight={700}>Net settlement</Typography>
                  </Stack>

                  <List dense disablePadding>
                    <Row label="Partner payout" value={fmtINR(data.partner_payout)} />
                    <Row
                      label="− Partner-held money"
                      value={`−${fmtINR(data.position?.partner_held)}`}
                      hint="Cash/UPI the partner already collected."
                    />
                    <Row
                      label="− Coupon discount"
                      value={`−${fmtINR(data.position?.coupon_discount)}`}
                      hint="Platform-funded, reimbursed separately."
                    />
                    <Row
                      label="− TDS (Sec 194C, COMPANY only)"
                      value={`−${fmtINR(data.tds_deducted)}`}
                      hint={data.tds_rate_pct ? `${data.tds_rate_pct}% of payout` : "Not applicable."}
                    />
                    <Divider sx={{ my: 0.5 }} />
                    <Row
                      label={<strong>Net settlement</strong>}
                      value={
                        <Typography
                          variant="h6"
                          fontWeight={800}
                          color={
                            (data.position?.net_settlement ?? 0) > 0
                              ? "success.main"
                              : (data.position?.net_settlement ?? 0) < 0
                                ? "error.main"
                                : "text.primary"
                          }
                        >
                          {fmtINR(data.position?.net_settlement)}
                        </Typography>
                      }
                    />
                    <Row
                      label="Wallet direction"
                      value={
                        <Chip
                          size="small"
                          color={
                            data.position?.wallet_direction === "CREDIT"
                              ? "success"
                              : data.position?.wallet_direction === "DEBIT"
                                ? "error"
                                : "default"
                          }
                          label={data.position?.wallet_direction || "NONE"}
                        />
                      }
                    />
                    <Row
                      label="Partner wallet (current)"
                      value={fmtINR(data.partner_wallet_balance)}
                    />
                  </List>

                  <Divider sx={{ my: 1.5 }} />

                  <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                    <Field label="Platform commission" value={fmtINR(data.platform_commission)} />
                    <Field label="Partner" value={data.partner_name} />
                    <Field label="Partner mobile" value={data.partner_mobile} />
                  </Stack>
                </Paper>

                <Alert
                  severity={allOk ? "info" : "error"}
                  icon={allOk ? <InfoOutlined /> : <WarningAmber />}
                  sx={{ borderRadius: 2 }}
                >
                  {allOk ? (
                    <Stack gap={0.5}>
                      <Typography variant="body2">
                        Type <strong>SETTLE</strong> below to confirm. This action is idempotent — if the
                        booking is already settled, the server returns the existing position.
                      </Typography>
                    </Stack>
                  ) : (
                    <Stack gap={0.5}>
                      <Typography variant="body2" fontWeight={700}>
                        Cannot settle yet. Resolve the items above first.
                      </Typography>
                      {preconditions.filter((p) => !p.ok).map((p) => (
                        <Typography key={p.key} variant="caption">· {p.hint}</Typography>
                      ))}
                    </Stack>
                  )}
                </Alert>

                {allOk && (
                  <TextField
                    label='Type "SETTLE" to enable the button'
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    fullWidth
                    size="small"
                    placeholder="SETTLE"
                  />
                )}
              </Stack>
            )}
          </Stack>
        ) : null}
      </DialogContent>

      <Divider />
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined" color="inherit">Cancel</Button>
        {step > 0 && (
          <Button onClick={() => setStep(step - 1)} startIcon={<ArrowBack />}>
            Back
          </Button>
        )}
        {step < 2 && (
          <Button
            onClick={() => setStep(step + 1)}
            variant="contained"
            endIcon={<ArrowForward />}
            disabled={!data}
          >
            Next
          </Button>
        )}
        {step === 2 && (
          <Button
            variant="contained"
            color="success"
            disabled={!allOk || confirm !== "SETTLE" || settleMutation.isPending}
            onClick={() => settleMutation.mutate()}
            startIcon={settleMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <Handshake />}
            sx={{ fontWeight: 700 }}
          >
            {settleMutation.isPending ? "Settling…" : "Settle"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ── Local helpers ─────────────────────────────────────────────
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25 }}>
        {label}
      </Typography>
      {typeof value === "string" || typeof value === "number"
        ? <Typography variant="body2" fontWeight={600}>{value || "—"}</Typography>
        : value}
    </Box>
  );
}

function Row({
  label, value, hint,
}: { label: React.ReactNode; value: React.ReactNode; hint?: string }) {
  return (
    <ListItem
      sx={{
        px: 0, py: 0.75,
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "baseline",
        columnGap: 2,
      }}
    >
      <Box>
        <Typography variant="body2">{label}</Typography>
        {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
      </Box>
      <Box sx={{ textAlign: "right" }}>
        {typeof value === "string" || typeof value === "number"
          ? <Typography variant="body2" fontWeight={700}>{value}</Typography>
          : value}
      </Box>
    </ListItem>
  );
}

// (no local TextField wrapper needed — TextField is imported above)
