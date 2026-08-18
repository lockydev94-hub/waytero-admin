// ============================================================
// WAYTERO ADMIN — RECORD HOTEL ADVANCE MODAL
// Endpoint: POST /admin/bookings/{bookingId}/hotel/{hotelId}/record-advance
// Allowed: PENDING_PAYMENT → CHECKED_OUT (multiple advances permitted)
//
// received_by is custody, not bookkeeping colour. ONLINE and WALLET always
// land in the platform account, so the receiver is locked to ADMIN for them
// (the server enforces this too). CASH and UPI can genuinely be taken at the
// property by the partner, which the settlement step later nets back.
// ============================================================
import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, CircularProgress,
  Stack, Avatar, Divider, Alert, InputAdornment,
  ToggleButtonGroup, ToggleButton, alpha, useTheme,
} from "@mui/material";
import {
  Payment, Close, CreditCard, AccountBalanceWallet,
  Money, PhoneAndroid, InfoOutlined,
} from "@mui/icons-material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { bookingService } from "../../../services/booking.service";

type PayMode = "UPI" | "ONLINE" | "CASH" | "WALLET";
type Receiver = "ADMIN" | "PARTNER";

// ONLINE and WALLET settle straight into the platform account.
const PLATFORM_ONLY: PayMode[] = ["ONLINE", "WALLET"];

const MODES: { value: PayMode; label: string; icon: React.ReactNode }[] = [
  { value: "UPI",    label: "UPI",    icon: <PhoneAndroid sx={{ fontSize: 16 }} /> },
  { value: "ONLINE", label: "Online", icon: <CreditCard sx={{ fontSize: 16 }} /> },
  { value: "CASH",   label: "Cash",   icon: <Money sx={{ fontSize: 16 }} /> },
  { value: "WALLET", label: "Wallet", icon: <AccountBalanceWallet sx={{ fontSize: 16 }} /> },
];

const fmtINR = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: number;
  hotelId: number;
  hotelBookingNumber: string;
  totalAmount: number;
  advancePaid: number;
  balanceDue: number;
}

export default function RecordAdvanceModal({
  open, onClose, bookingId, hotelId, hotelBookingNumber,
  totalAmount, advancePaid, balanceDue,
}: Props) {
  const theme = useTheme();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PayMode>("UPI");
  const [receiver, setReceiver] = useState<Receiver>("ADMIN");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const platformOnly = PLATFORM_ONLY.includes(mode);
  const effectiveReceiver: Receiver = platformOnly ? "ADMIN" : receiver;

  const numAmount = Number(amount) || 0;
  const exceedsBalance = balanceDue > 0 && numAmount > balanceDue;
  const valid = numAmount > 0 && !exceedsBalance;

  const mutation = useMutation({
    mutationFn: () =>
      bookingService.hotelRecordAdvance(
        bookingId, hotelId, numAmount, mode, effectiveReceiver,
        reference.trim() || undefined, notes.trim() || undefined,
      ),
    onSuccess: (data: any) => {
      enqueueSnackbar(
        `Advance ${fmtINR(numAmount)} recorded (${data?.receipt_number ?? "—"}). ` +
        `Balance: ${fmtINR(data?.balance_due ?? 0)}`,
        { variant: "success" },
      );
      qc.invalidateQueries({ queryKey: ["admin-booking", bookingId] });
      handleClose();
    },
    onError: (e: any) =>
      enqueueSnackbar(e?.response?.data?.detail || "Failed to record advance", { variant: "error" }),
  });

  function handleClose() {
    setAmount(""); setMode("UPI"); setReceiver("ADMIN");
    setReference(""); setNotes("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: "info.main", width: 36, height: 36 }}>
              <Payment fontSize="small" />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Record Advance</Typography>
              <Typography variant="caption" color="text.secondary">{hotelBookingNumber}</Typography>
            </Box>
          </Stack>
          <Button size="small" onClick={handleClose} sx={{ minWidth: 0 }}><Close fontSize="small" /></Button>
        </Stack>
      </DialogTitle>
      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        <Stack gap={2.5}>
          {/* Running position */}
          <Box sx={{
            p: 2, borderRadius: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.05),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
          }}>
            <Stack direction="row" justifyContent="space-between" mb={0.5}>
              <Typography variant="caption" color="text.secondary">Booking Total</Typography>
              <Typography variant="caption" fontWeight={700}>{fmtINR(totalAmount)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between" mb={0.5}>
              <Typography variant="caption" color="text.secondary">Already Received</Typography>
              <Typography variant="caption" fontWeight={700} color="success.main">
                {fmtINR(advancePaid)}
              </Typography>
            </Stack>
            <Divider sx={{ my: 1 }} />
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" fontWeight={800}>Balance</Typography>
              <Typography variant="body2" fontWeight={800} color="warning.main">
                {fmtINR(balanceDue)}
              </Typography>
            </Stack>
          </Box>

          <TextField
            label="Advance Amount (₹) *"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            fullWidth type="number" autoFocus
            inputProps={{ min: 1, step: "0.01" }}
            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
            error={exceedsBalance}
            helperText={
              exceedsBalance
                ? `Cannot exceed the outstanding balance of ${fmtINR(balanceDue)}`
                : "Several advances can be recorded across the stay."
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
              RECEIVED BY
            </Typography>
            <ToggleButtonGroup
              value={effectiveReceiver} exclusive fullWidth size="small"
              onChange={(_, v) => v && setReceiver(v)}
              disabled={platformOnly}
            >
              <ToggleButton value="ADMIN" sx={{ fontWeight: 700, py: 1 }}>Admin / Platform</ToggleButton>
              <ToggleButton value="PARTNER" sx={{ fontWeight: 700, py: 1 }}>Hotel Partner</ToggleButton>
            </ToggleButtonGroup>

            <Box sx={{
              mt: 1.5, p: 1.5, borderRadius: 2,
              bgcolor: alpha(
                effectiveReceiver === "ADMIN" ? theme.palette.info.main : theme.palette.warning.main,
                0.07,
              ),
              border: `1px solid ${alpha(
                effectiveReceiver === "ADMIN" ? theme.palette.info.main : theme.palette.warning.main,
                0.25,
              )}`,
            }}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <InfoOutlined sx={{
                  fontSize: 15, mt: 0.2, flexShrink: 0,
                  color: effectiveReceiver === "ADMIN" ? "info.main" : "warning.main",
                }} />
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  {platformOnly ? (
                    <><strong>{mode}</strong> settles directly into the platform account, so custody
                    is locked to <strong>Admin</strong>.</>
                  ) : effectiveReceiver === "ADMIN" ? (
                    <>The platform holds this money — it will offset the commission at settlement.</>
                  ) : (
                    <>The hotel partner is holding this money — it will be netted from their
                    settlement payout.</>
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
            placeholder="UPI txn id, gateway reference, receipt no."
          />
          <TextField
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth size="small" multiline rows={2}
          />

          {balanceDue <= 0 && (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              This booking has no outstanding balance.
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <Divider />
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined" color="inherit">Cancel</Button>
        <Button
          variant="contained" color="info"
          disabled={!valid || mutation.isPending}
          onClick={() => mutation.mutate()}
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <Payment />}
          sx={{ fontWeight: 700 }}
        >
          {mutation.isPending ? "Recording…" : "Record Advance"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
