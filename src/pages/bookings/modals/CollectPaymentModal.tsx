// ============================================================
// WAYTERO ADMIN — COLLECT HOTEL PAYMENT MODAL
// Endpoint: POST /admin/bookings/{bookingId}/hotel/{hotelId}/collect-payment
// Allowed: CHECKED_OUT / COMPLETED, and only once an invoice exists.
//
// This is the post-invoice settlement of the balance, not an advance.
// ONLINE lands in the platform account, so the collector is locked to ADMIN
// (the server enforces the same rule). CASH and UPI can be taken at the
// property, so the admin must state who actually holds the money — that
// custody flag is what drives the direction of the later settlement.
// ============================================================
import { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, CircularProgress,
  Stack, Avatar, Divider, Alert, InputAdornment, Chip,
  ToggleButtonGroup, ToggleButton, alpha, useTheme,
} from "@mui/material";
import {
  ReceiptLong, Close, CreditCard, Money, PhoneAndroid, InfoOutlined,
} from "@mui/icons-material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { bookingService } from "../../../services/booking.service";

type PayMode = "ONLINE" | "UPI" | "CASH";
type Collector = "ADMIN" | "PARTNER";

// ONLINE settles straight into the platform account — nobody "collects" it.
const PLATFORM_ONLY: PayMode[] = ["ONLINE"];

const MODES: { value: PayMode; label: string; icon: React.ReactNode }[] = [
  { value: "ONLINE", label: "Online", icon: <CreditCard sx={{ fontSize: 16 }} /> },
  { value: "UPI",    label: "UPI",    icon: <PhoneAndroid sx={{ fontSize: 16 }} /> },
  { value: "CASH",   label: "Cash",   icon: <Money sx={{ fontSize: 16 }} /> },
];

const fmtINR = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: number;
  hotelId: number;
  hotelBookingNumber: string;
  invoiceNumber: string | null;
  grandTotal: number;
  advancePaid: number;
  balanceDue: number;
}

export default function CollectPaymentModal({
  open, onClose, bookingId, hotelId, hotelBookingNumber,
  invoiceNumber, grandTotal, advancePaid, balanceDue,
}: Props) {
  const theme = useTheme();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PayMode>("ONLINE");
  const [collector, setCollector] = useState<Collector>("ADMIN");
  const [reference, setReference] = useState("");

  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  // Default the field to the outstanding balance each time the modal opens —
  // full settlement is the common case; part-payment is the exception.
  useEffect(() => {
    if (open) setAmount(balanceDue > 0 ? String(balanceDue) : "");
  }, [open, balanceDue]);

  const platformOnly = PLATFORM_ONLY.includes(mode);
  const effectiveCollector: Collector = platformOnly ? "ADMIN" : collector;

  const numAmount = Number(amount) || 0;
  const exceedsBalance = balanceDue > 0 && numAmount > balanceDue;
  const valid = numAmount > 0 && !exceedsBalance && !!invoiceNumber;
  const isPartial = numAmount > 0 && !exceedsBalance && numAmount < balanceDue;

  const mutation = useMutation({
    mutationFn: () =>
      bookingService.hotelCollectPayment(
        bookingId, hotelId, numAmount, mode, effectiveCollector,
        reference.trim() || undefined,
      ),
    onSuccess: (data: any) => {
      enqueueSnackbar(
        data?.fully_paid
          ? `Payment ${fmtINR(numAmount)} collected — invoice fully paid.`
          : `Payment ${fmtINR(numAmount)} collected. Balance: ${fmtINR(data?.balance_due ?? 0)}`,
        { variant: "success" },
      );
      qc.invalidateQueries({ queryKey: ["admin-booking", bookingId] });
      handleClose();
    },
    onError: (e: any) =>
      enqueueSnackbar(e?.response?.data?.detail || "Failed to collect payment", { variant: "error" }),
  });

  function handleClose() {
    setAmount(""); setMode("ONLINE"); setCollector("ADMIN"); setReference("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: "success.main", width: 36, height: 36 }}>
              <ReceiptLong fontSize="small" />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Collect Payment</Typography>
              <Typography variant="caption" color="text.secondary">{hotelBookingNumber}</Typography>
            </Box>
          </Stack>
          <Button size="small" onClick={handleClose} sx={{ minWidth: 0 }}><Close fontSize="small" /></Button>
        </Stack>
      </DialogTitle>
      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        <Stack gap={2.5}>
          {!invoiceNumber && (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              Generate the invoice before collecting payment — the invoice freezes the
              amounts this payment is applied against.
            </Alert>
          )}

          {/* Invoice position */}
          <Box sx={{
            p: 2, borderRadius: 2,
            bgcolor: alpha(theme.palette.success.main, 0.05),
            border: `1px solid ${alpha(theme.palette.success.main, 0.15)}`,
          }}>
            {invoiceNumber && (
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="caption" color="text.secondary">Invoice</Typography>
                <Chip label={invoiceNumber} size="small" color="success" variant="outlined"
                  sx={{ fontWeight: 700, height: 22 }} />
              </Stack>
            )}
            <Stack direction="row" justifyContent="space-between" mb={0.5}>
              <Typography variant="caption" color="text.secondary">Invoice Total</Typography>
              <Typography variant="caption" fontWeight={700}>{fmtINR(grandTotal)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between" mb={0.5}>
              <Typography variant="caption" color="text.secondary">Advance Received</Typography>
              <Typography variant="caption" fontWeight={700} color="success.main">
                −{fmtINR(advancePaid)}
              </Typography>
            </Stack>
            <Divider sx={{ my: 1 }} />
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" fontWeight={800}>Balance Due</Typography>
              <Typography variant="body2" fontWeight={800} color="warning.main">
                {fmtINR(balanceDue)}
              </Typography>
            </Stack>
          </Box>

          <TextField
            label="Amount to Collect (₹) *"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            fullWidth type="number" autoFocus
            disabled={!invoiceNumber}
            inputProps={{ min: 1, step: "0.01" }}
            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
            error={exceedsBalance}
            helperText={
              exceedsBalance
                ? `Cannot exceed the outstanding balance of ${fmtINR(balanceDue)}`
                : isPartial
                  ? `Part payment — ${fmtINR(balanceDue - numAmount)} will remain outstanding.`
                  : "Defaults to the full outstanding balance."
            }
          />

          {/* Payment mode */}
          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary"
              display="block" mb={1} sx={{ letterSpacing: 0.5 }}>
              PAYMENT MODE
            </Typography>
            <ToggleButtonGroup
              value={mode} exclusive fullWidth size="small"
              onChange={(_, v) => v && setMode(v)}
              disabled={!invoiceNumber}
            >
              {MODES.map((m) => (
                <ToggleButton key={m.value} value={m.value} sx={{ fontWeight: 700, gap: 0.5, py: 1 }}>
                  {m.icon}{m.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {/* Custody */}
          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary"
              display="block" mb={1} sx={{ letterSpacing: 0.5 }}>
              COLLECTED BY
            </Typography>
            <ToggleButtonGroup
              value={effectiveCollector} exclusive fullWidth size="small"
              onChange={(_, v) => v && setCollector(v)}
              disabled={platformOnly || !invoiceNumber}
            >
              <ToggleButton value="ADMIN" sx={{ fontWeight: 700, py: 1 }}>Admin / Platform</ToggleButton>
              <ToggleButton value="PARTNER" sx={{ fontWeight: 700, py: 1 }}>Hotel Partner</ToggleButton>
            </ToggleButtonGroup>

            <Box sx={{
              mt: 1.5, p: 1.5, borderRadius: 2,
              bgcolor: alpha(
                effectiveCollector === "ADMIN" ? theme.palette.info.main : theme.palette.warning.main,
                0.07,
              ),
              border: `1px solid ${alpha(
                effectiveCollector === "ADMIN" ? theme.palette.info.main : theme.palette.warning.main,
                0.25,
              )}`,
            }}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <InfoOutlined sx={{
                  fontSize: 15, mt: 0.2, flexShrink: 0,
                  color: effectiveCollector === "ADMIN" ? "info.main" : "warning.main",
                }} />
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  {platformOnly ? (
                    <>An <strong>online</strong> payment is received by the platform directly,
                    so the collector is locked to <strong>Admin</strong>.</>
                  ) : effectiveCollector === "ADMIN" ? (
                    <>The platform is holding this {mode.toLowerCase()} — the partner's commission
                    will be deducted from it at settlement.</>
                  ) : (
                    <>The hotel partner took this {mode.toLowerCase()} at the property — it will be
                    netted off their settlement payout.</>
                  )}
                </Typography>
              </Stack>
            </Box>
          </Box>

          <TextField
            label="Reference Number"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            fullWidth size="small"
            disabled={!invoiceNumber}
            placeholder="Gateway txn id, UPI reference, receipt no."
          />

          {balanceDue <= 0 && (
            <Alert severity="success" sx={{ borderRadius: 2 }}>
              This invoice is already fully paid.
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <Divider />
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined" color="inherit">Cancel</Button>
        <Button
          variant="contained" color="success"
          disabled={!valid || mutation.isPending}
          onClick={() => mutation.mutate()}
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <ReceiptLong />}
          sx={{ fontWeight: 700 }}
        >
          {mutation.isPending ? "Collecting…" : "Collect Payment"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
