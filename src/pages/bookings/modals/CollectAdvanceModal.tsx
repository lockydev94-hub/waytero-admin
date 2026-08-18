// ============================================================
// WAYTERO ADMIN — COLLECT ADVANCE PAYMENT MODAL
// Endpoints:
//   GET  /admin/advance/{booking_number}   — eligibility + existing advance
//   POST /admin/advance/collect            — record advance
// Doc Ref: BRD Part 3 §45 — Advance collection & settlement custody
// ============================================================
import { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, CircularProgress, Stack,
  Avatar, Divider, Alert, InputAdornment, TextField,
  ToggleButtonGroup, ToggleButton, Chip, Paper, Skeleton,
} from "@mui/material";
import {
  AccountBalanceWallet, Close, CurrencyRupee, CheckCircle,
  Warning, Person, DirectionsCar, AdminPanelSettings,
  LocalAtm, PhoneAndroid, CreditCard,
} from "@mui/icons-material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { advanceService, AdvanceEligibility } from "../../../services/advance.service";

interface Props {
  open: boolean;
  onClose: () => void;
  bookingNumber: string;   // cab booking number, e.g. WT-CAB-202506-00001
  masterBookingId: number; // for query cache invalidation
}

const RECEIVER_ICONS: Record<string, React.ReactNode> = {
  ADMIN:   <AdminPanelSettings sx={{ fontSize: 18 }} />,
  PARTNER: <Person sx={{ fontSize: 18 }} />,
  DRIVER:  <DirectionsCar sx={{ fontSize: 18 }} />,
};

const RECEIVER_LABELS: Record<string, string> = {
  ADMIN:   "Platform (Admin)",
  PARTNER: "Partner",
  DRIVER:  "Driver",
};

const MODE_ICONS: Record<string, React.ReactNode> = {
  CASH:   <LocalAtm sx={{ fontSize: 18 }} />,
  UPI:    <PhoneAndroid sx={{ fontSize: 18 }} />,
  ONLINE: <CreditCard sx={{ fontSize: 18 }} />,
};

export default function CollectAdvanceModal({ open, onClose, bookingNumber, masterBookingId }: Props) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [receiver, setReceiver] = useState<string>("");
  const [mode,     setMode]     = useState<string>("");
  const [amount,   setAmount]   = useState<string>("");
  const [refNote,  setRefNote]  = useState<string>("");

  // ── Eligibility query ────────────────────────────────────
  const { data: elig, isLoading, isError } = useQuery<AdvanceEligibility>({
    queryKey: ["advance-eligibility", bookingNumber],
    queryFn:  () => advanceService.getEligibility(bookingNumber),
    enabled:  open && !!bookingNumber,
  });

  // Reset form whenever modal re-opens
  useEffect(() => {
    if (open) {
      setReceiver("");
      setMode("");
      setAmount("");
      setRefNote("");
    }
  }, [open]);

  // Auto-select single receiver
  useEffect(() => {
    if (elig?.allowed_receivers?.length === 1) {
      setReceiver(elig.allowed_receivers[0]);
    }
  }, [elig]);

  // Reset mode when receiver changes
  useEffect(() => { setMode(""); }, [receiver]);

  const availableModes: string[] = (receiver ? elig?.modes_by_receiver?.[receiver] : undefined) ?? [];

  // ── Collect mutation ─────────────────────────────────────
  const collectMut = useMutation({
    mutationFn: () => advanceService.collect({
      booking_number: bookingNumber,
      amount: Number(amount),
      payment_mode: mode,
      received_by: receiver,
      reference_note: refNote.trim() || undefined,
    }),
    onSuccess: (res) => {
      enqueueSnackbar(
        `Advance ₹${Number(amount).toLocaleString()} recorded — Receipt ${res.data.receipt_number}`,
        { variant: "success" }
      );
      qc.invalidateQueries({ queryKey: ["advance-eligibility", bookingNumber] });
      qc.invalidateQueries({ queryKey: ["admin-booking", masterBookingId] });
      onClose();
    },
    onError: (e: any) =>
      enqueueSnackbar(e?.response?.data?.detail || "Failed to record advance", { variant: "error" }),
  });

  const amtNum    = parseFloat(amount) || 0;
  const maxAmt    = elig?.max_amount ?? 0;
  const amtValid  = amtNum > 0 && amtNum <= maxAmt;
  const canSubmit = !!receiver && !!mode && amtValid && !collectMut.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Avatar sx={{ bgcolor: "warning.main", width: 40, height: 40 }}>
              <AccountBalanceWallet />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Collect Advance Payment</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                {bookingNumber}
              </Typography>
            </Box>
          </Stack>
          <Button size="small" onClick={onClose} sx={{ minWidth: 0 }}><Close fontSize="small" /></Button>
        </Stack>
      </DialogTitle>
      <Divider />

      <DialogContent sx={{ pt: 2.5 }}>
        {isLoading && (
          <Stack gap={2}>
            <Skeleton variant="rounded" height={60} />
            <Skeleton variant="rounded" height={80} />
            <Skeleton variant="rounded" height={56} />
          </Stack>
        )}

        {isError && (
          <Alert severity="error" sx={{ borderRadius: 2 }}>
            Failed to load booking advance details. Please close and retry.
          </Alert>
        )}

        {elig && (
          <Stack gap={2.5}>
            {/* ── Existing advance ── */}
            {elig.advance && (
              <Alert
                severity="success"
                icon={<CheckCircle />}
                sx={{ borderRadius: 2 }}
              >
                <Typography variant="body2" fontWeight={700}>
                  Advance already collected — ₹{elig.advance.amount?.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Receipt {elig.advance.receipt_number} · via {elig.advance.payment_mode}
                  · received by {elig.advance.received_by}
                </Typography>
              </Alert>
            )}

            {/* ── Blocked reason ── */}
            {!elig.can_collect && !elig.advance && (
              <Alert severity="warning" icon={<Warning />} sx={{ borderRadius: 2 }}>
                {elig.blocked_reason}
              </Alert>
            )}

            {/* ── Fare summary ── */}
            <Paper
              variant="outlined"
              sx={{ p: 2, borderRadius: 2, bgcolor: "grey.50", display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary">Booking Fare</Typography>
                <Typography variant="h5" fontWeight={800} color="success.dark">
                  ₹{elig.max_amount?.toLocaleString("en-IN")}
                </Typography>
              </Box>
              <Chip
                label={elig.is_assigned ? (elig.has_driver ? "Driver Assigned" : "Partner Assigned") : "Unassigned"}
                color={elig.has_driver ? "success" : elig.is_assigned ? "primary" : "default"}
                size="small"
              />
            </Paper>

            {/* ── Collection form (only if collectable) ── */}
            {elig.can_collect && (
              <>
                {/* Receiver */}
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                    Who received the money?
                  </Typography>
                  <ToggleButtonGroup
                    value={receiver}
                    exclusive
                    onChange={(_, v) => v && setReceiver(v)}
                    fullWidth
                    size="small"
                    sx={{ gap: 1, "& .MuiToggleButtonGroup-grouped": { borderRadius: "10px !important", border: "1px solid !important", borderColor: "divider !important" } }}
                  >
                    {elig.allowed_receivers.map((r) => (
                      <ToggleButton
                        key={r}
                        value={r}
                        sx={{
                          flex: 1,
                          py: 1.25,
                          gap: 0.75,
                          fontWeight: 600,
                          fontSize: "0.78rem",
                          "&.Mui-selected": { bgcolor: "warning.50", color: "warning.dark", borderColor: "warning.main !important" },
                        }}
                      >
                        {RECEIVER_ICONS[r]}
                        {RECEIVER_LABELS[r]}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>

                {/* Payment mode */}
                {receiver && (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                      Payment Mode
                    </Typography>
                    <ToggleButtonGroup
                      value={mode}
                      exclusive
                      onChange={(_, v) => v && setMode(v)}
                      fullWidth
                      size="small"
                      sx={{ gap: 1, "& .MuiToggleButtonGroup-grouped": { borderRadius: "10px !important", border: "1px solid !important", borderColor: "divider !important" } }}
                    >
                      {availableModes.map((m) => (
                        <ToggleButton
                          key={m}
                          value={m}
                          sx={{
                            flex: 1,
                            py: 1.25,
                            gap: 0.75,
                            fontWeight: 600,
                            fontSize: "0.78rem",
                            "&.Mui-selected": { bgcolor: "primary.50", color: "primary.dark", borderColor: "primary.main !important" },
                          }}
                        >
                          {MODE_ICONS[m]}
                          {m}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Box>
                )}

                {/* Amount */}
                {mode && (
                  <TextField
                    label="Advance Amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    type="number"
                    fullWidth
                    inputProps={{ min: 1, max: maxAmt, step: 0.01 }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><CurrencyRupee fontSize="small" /></InputAdornment>,
                    }}
                    helperText={
                      amtNum > maxAmt
                        ? `Cannot exceed fare ₹${maxAmt.toLocaleString("en-IN")}`
                        : `Max: ₹${maxAmt.toLocaleString("en-IN")}`
                    }
                    error={!!amount && (!amtValid)}
                  />
                )}

                {/* Reference note (optional, shown for UPI/ONLINE) */}
                {(mode === "UPI" || mode === "ONLINE") && (
                  <TextField
                    label="Transaction Reference (optional)"
                    value={refNote}
                    onChange={(e) => setRefNote(e.target.value)}
                    fullWidth
                    placeholder="UPI Ref ID / Gateway transaction ID"
                    size="small"
                  />
                )}

                {/* Balance preview */}
                {amtValid && (
                  <Paper
                    variant="outlined"
                    sx={{ p: 2, borderRadius: 2, bgcolor: "info.50", border: "1px solid", borderColor: "info.200" }}
                  >
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Advance</Typography>
                      <Typography variant="body2" fontWeight={700} color="warning.main">₹{amtNum.toLocaleString("en-IN")}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" mt={0.5}>
                      <Typography variant="body2" color="text.secondary">Balance Due</Typography>
                      <Typography variant="body2" fontWeight={700} color="error.main">
                        ₹{Math.max(0, maxAmt - amtNum).toLocaleString("en-IN")}
                      </Typography>
                    </Stack>
                  </Paper>
                )}
              </>
            )}
          </Stack>
        )}
      </DialogContent>

      <Divider />
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">Close</Button>
        {elig?.can_collect && (
          <Button
            variant="contained"
            color="warning"
            disabled={!canSubmit}
            onClick={() => collectMut.mutate()}
            startIcon={collectMut.isPending ? <CircularProgress size={16} color="inherit" /> : <AccountBalanceWallet />}
            sx={{ fontWeight: 700, px: 3 }}
          >
            {collectMut.isPending ? "Recording..." : "Record Advance"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
