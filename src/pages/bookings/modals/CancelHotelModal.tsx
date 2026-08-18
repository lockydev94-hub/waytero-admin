// ============================================================
// WAYTERO ADMIN — CANCEL HOTEL MODAL
// Doc Ref: BRD Part 4 §82
// Now drives the cancellation policy engine — charge/refund auto-computed.
// POST /admin/cancellation/hotel/{reservationId}/cancel
// GET  /admin/cancellation/hotel/{reservationId}/refund-preview
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
import { cancellationService, HotelRefundPreview } from "../../../services/cancellation.service";

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: number;
  hotelId: number;
  hotelBookingNumber: string;
  totalAmount: number;
}

const TIER_LABEL_TEXT: Record<string, string> = {
  free_window: "Free cancellation window",
  tier_2: "Tier 2",
  tier_3: "Tier 3",
  same_day: "Same-day (no refund)",
  no_show: "No-show",
  no_checkin_date: "No check-in date set",
};

export default function CancelHotelModal({ open, onClose, bookingId, hotelId, hotelBookingNumber, totalAmount }: Props) {
  const [reason, setReason] = useState("");
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const previewQuery = useQuery<HotelRefundPreview>({
    queryKey: ["hotel-refund-preview", hotelId],
    queryFn: () => cancellationService.previewHotel(hotelId),
    enabled: open,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => cancellationService.cancelHotel(hotelId, reason),
    onSuccess: () => {
      enqueueSnackbar("Hotel reservation cancelled. Refund credited to customer wallet.", { variant: "warning" });
      qc.invalidateQueries({ queryKey: ["admin-booking", bookingId] });
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["hotel-refund-preview"] });
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
              <Typography variant="h6" fontWeight={700}>Cancel Hotel Reservation</Typography>
              <Typography variant="caption" color="text.secondary">{hotelBookingNumber}</Typography>
            </Box>
          </Stack>
          <Button size="small" onClick={handleClose} sx={{ minWidth: 0 }}><Close fontSize="small" /></Button>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="error" icon={<Warning />} sx={{ mb: 2, borderRadius: 2 }}>
          This will cancel the hotel reservation. The refund is auto-computed from the hotel's
          cancellation policy and credited to the customer wallet.
        </Alert>

        <Box p={2} bgcolor="grey.50" borderRadius={2} border="1px solid" borderColor="grey.200" mb={2}>
          <Stack direction="row" alignItems="center" gap={1} mb={1}>
            <Policy fontSize="small" color="primary" />
            <Typography variant="subtitle2" fontWeight={700}>Hotel policy refund preview</Typography>
            {previewQuery.isLoading && <CircularProgress size={14} />}
          </Stack>
          {!previewQuery.isLoading && !preview && (
            <Typography variant="caption" color="text.secondary">Preview unavailable.</Typography>
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
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">Total bill</Typography>
                  <Typography variant="body2" fontWeight={700}>₹{preview.hotel_total_amount.toLocaleString()}</Typography>
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
                  Per-hotel ladder: free / tier-2 / tier-3 / same-day windows. Refund capped at advance collected.
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
            placeholder="e.g. Customer request, alternative arranged, emergency"
            required
          />
        </Stack>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined" color="inherit">Go Back</Button>
        <Button
          variant="contained" color="error"
          disabled={!reason.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <Cancel />}
        >
          {mutation.isPending ? "Cancelling..." : "Confirm Cancellation"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
