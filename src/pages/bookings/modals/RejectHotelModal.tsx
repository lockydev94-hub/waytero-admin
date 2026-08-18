// ============================================================
// WAYTERO ADMIN — REJECT HOTEL MODAL
// Endpoint: POST /admin/bookings/{bookingId}/hotel/{hotelId}/reject
// Guard: AWAITING_HOTEL_CONFIRMATION only
// ============================================================
import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, CircularProgress,
  Stack, Avatar, Divider, Alert, InputAdornment,
} from "@mui/material";
import { Block, Close, Warning } from "@mui/icons-material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { bookingService } from "../../../services/booking.service";

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: number;
  hotelId: number;
  hotelBookingNumber: string;
  totalAmount: number;
}

export default function RejectHotelModal({ open, onClose, bookingId, hotelId, hotelBookingNumber, totalAmount }: Props) {
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState(String(totalAmount));
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const mutation = useMutation({
    mutationFn: () => bookingService.hotelReject(bookingId, hotelId, reason, Number(refund)),
    onSuccess: () => {
      enqueueSnackbar("Hotel booking rejected", { variant: "warning" });
      qc.invalidateQueries({ queryKey: ["admin-booking", bookingId] });
      handleClose();
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || "Rejection failed", { variant: "error" }),
  });

  const handleClose = () => { setReason(""); setRefund(String(totalAmount)); onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: "error.main", width: 36, height: 36 }}><Block fontSize="small" /></Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Reject Hotel Booking</Typography>
              <Typography variant="caption" color="text.secondary">{hotelBookingNumber}</Typography>
            </Box>
          </Stack>
          <Button size="small" onClick={handleClose} sx={{ minWidth: 0 }}><Close fontSize="small" /></Button>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="warning" icon={<Warning />} sx={{ mb: 2, borderRadius: 2 }}>
          Hotel has declined the reservation. This action is irreversible. A full or partial refund will be processed.
        </Alert>
        <Stack gap={2}>
          <TextField
            label="Rejection Reason *"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth multiline rows={2}
            placeholder="e.g. No rooms available, overbooking, maintenance"
            required
          />
          <TextField
            label="Refund Amount (₹)"
            value={refund}
            onChange={(e) => setRefund(e.target.value)}
            fullWidth type="number" inputProps={{ min: 0, max: totalAmount }}
            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
            helperText={`Booking total: ₹${totalAmount.toLocaleString()}`}
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
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <Block />}
        >
          {mutation.isPending ? "Rejecting..." : "Confirm Rejection"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
