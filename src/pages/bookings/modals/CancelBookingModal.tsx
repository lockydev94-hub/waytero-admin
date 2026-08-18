// ============================================================
// WAYTERO ADMIN — CANCEL BOOKING MODAL
// Doc Ref: BRD Part 3 §46/§47
// Now drives the cancellation policy engine — charges and refund are
// auto-computed from the live cab / hotel ladders, not typed by the admin.
// POST /admin/cancellation/cab/{cabId}/cancel
// POST /admin/bookings/{bookingId}/cancel  (master-booking multi-cancel)
// GET  /admin/cancellation/cab/{cabId}/refund-preview
// ============================================================
import { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, CircularProgress,
  Stack, Avatar, Divider, Alert, Grid, Chip,
} from "@mui/material";
import { Cancel, Close, Warning, Info, Schedule, Policy } from "@mui/icons-material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { cancellationService, CabRefundPreview } from "../../../services/cancellation.service";

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: number;
  bookingNumber: string;
  cabId?: number;            // single-cab cancel
  totalAmount: number;       // shown only for context
}

const TIER_LABEL_TEXT: Record<string, string> = {
  free_window: "Free cancellation window",
  tier_1: "Tier 1 (early cancellation)",
  tier_2: "Tier 2 (medium-window)",
  tier_3: "Tier 3 (last-minute)",
  last_minute: "Last minute",
  past_pickup: "Past pickup",
  post_assignment: "Post-assignment (partner notified)",
  same_day: "Same-day",
  no_show: "No-show",
};

export default function CancelBookingModal({ open, onClose, bookingId, bookingNumber, cabId, totalAmount }: Props) {
  const [reason, setReason] = useState("");
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const previewQuery = useQuery<CabRefundPreview>({
    queryKey: ["cab-refund-preview", cabId],
    queryFn: () => cancellationService.previewCab(cabId as number),
    enabled: open && cabId != null,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => {
      if (cabId == null) throw new Error("cabId is required");
      return cancellationService.cancelCab(cabId, reason);
    },
    onSuccess: () => {
      enqueueSnackbar("Cab cancelled. Refund credited to customer wallet.", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin-booking", bookingId] });
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["cab-refund-preview"] });
      handleClose();
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || "Cancellation failed", { variant: "error" }),
  });

  const handleClose = () => { setReason(""); onClose(); };

  const preview = previewQuery.data;
  const tierText = preview ? (TIER_LABEL_TEXT[preview.tier_label] || preview.tier_label) : null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: "error.main", width: 36, height: 36 }}><Cancel fontSize="small" /></Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Cancel Booking</Typography>
              <Typography variant="caption" color="text.secondary">{bookingNumber}</Typography>
            </Box>
          </Stack>
          <Button size="small" onClick={handleClose} sx={{ minWidth: 0 }}><Close fontSize="small" /></Button>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="error" icon={<Warning />} sx={{ mb: 2, borderRadius: 2 }}>
          This action is <strong>irreversible</strong>. The engine will auto-compute the cancellation charge
          and refund, debit any active advance, and credit the refund to the customer wallet.
        </Alert>

        {/* Auto-computed refund preview */}
        <Box p={2} bgcolor="grey.50" borderRadius={2} border="1px solid" borderColor="grey.200" mb={2}>
          <Stack direction="row" alignItems="center" gap={1} mb={1}>
            <Policy fontSize="small" color="primary" />
            <Typography variant="subtitle2" fontWeight={700}>Policy-driven refund preview</Typography>
            {previewQuery.isLoading && <CircularProgress size={14} />}
          </Stack>
          {!previewQuery.isLoading && !preview && (
            <Typography variant="caption" color="text.secondary">
              {cabId == null
                ? "No specific cab selected — pass `cabId` to fetch the per-cab preview."
                : "Preview unavailable."}
            </Typography>
          )}
          {preview && (
            <Stack gap={1}>
              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                <Chip
                  size="small"
                  color="primary"
                  icon={<Schedule />}
                  label={tierText || preview.tier_label}
                />
                {preview.is_post_assignment && (
                  <Chip size="small" color="warning" label="Post-assignment rule applies" />
                )}
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">Fare</Typography>
                  <Typography variant="body2" fontWeight={700}>₹{preview.cab_total_amount.toLocaleString()}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">Advance paid</Typography>
                  <Typography variant="body2" fontWeight={700}>₹{preview.advance_paid_total.toLocaleString()}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">Refund %</Typography>
                  <Typography variant="body2" fontWeight={700}>{preview.refund_percent}%</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Cancellation charge</Typography>
                  <Typography variant="h6" color="error" fontWeight={700}>
                    ₹{preview.charge.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Refund to wallet</Typography>
                  <Typography variant="h6" color="success.main" fontWeight={700}>
                    ₹{preview.refund_amount.toLocaleString()}
                  </Typography>
                </Grid>
              </Grid>
              <Stack direction="row" alignItems="center" gap={0.5}>
                <Info fontSize="inherit" color="action" />
                <Typography variant="caption" color="text.secondary">
                  Refund is capped at the live advance collected — the customer is never refunded more than they paid.
                </Typography>
              </Stack>
            </Stack>
          )}
        </Box>

        <Stack gap={2}>
          <TextField
            label="Cancellation Reason *"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth multiline rows={2}
            placeholder="e.g. Customer request, no-show, duplicate booking"
            required
          />
        </Stack>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined" color="inherit">Go Back</Button>
        <Button
          variant="contained" color="error"
          disabled={!reason.trim() || mutation.isPending || cabId == null}
          onClick={() => mutation.mutate()}
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <Cancel />}
        >
          {mutation.isPending ? "Cancelling..." : "Confirm Cancellation"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
