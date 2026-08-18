// ============================================================
// WAYTERO ADMIN — CONFIRM HOTEL MODAL
// Endpoint: POST /admin/bookings/{bookingId}/hotel/{hotelId}/confirm
// Guard: AWAITING_HOTEL_CONFIRMATION only
// ============================================================
import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, CircularProgress,
  Stack, Avatar, Divider, Alert,
} from "@mui/material";
import { CheckCircle, Close, Hotel } from "@mui/icons-material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { bookingService } from "../../../services/booking.service";

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: number;
  hotelId: number;
  hotelBookingNumber: string;
  hotelName: string | null;
}

export default function ConfirmHotelModal({ open, onClose, bookingId, hotelId, hotelBookingNumber, hotelName }: Props) {
  const [confirmationNumber, setConfirmationNumber] = useState("");
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const mutation = useMutation({
    mutationFn: () => bookingService.hotelConfirm(bookingId, hotelId, confirmationNumber || undefined),
    onSuccess: () => {
      enqueueSnackbar("Hotel booking confirmed", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin-booking", bookingId] });
      handleClose();
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || "Confirmation failed", { variant: "error" }),
  });

  const handleClose = () => { setConfirmationNumber(""); onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: "success.main", width: 36, height: 36 }}><CheckCircle fontSize="small" /></Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Confirm Hotel Booking</Typography>
              <Typography variant="caption" color="text.secondary">{hotelBookingNumber}</Typography>
            </Box>
          </Stack>
          <Button size="small" onClick={handleClose} sx={{ minWidth: 0 }}><Close fontSize="small" /></Button>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          Recording hotel acceptance for <strong>{hotelName || hotelBookingNumber}</strong>. This will move the booking to CONFIRMED status.
        </Alert>
        <TextField
          label="Hotel Confirmation Number (optional)"
          value={confirmationNumber}
          onChange={(e) => setConfirmationNumber(e.target.value)}
          fullWidth
          placeholder="e.g. HTL-2026-001234"
          helperText="Enter the reference number provided by the hotel"
        />
      </DialogContent>
      <Divider />
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined" color="inherit">Cancel</Button>
        <Button
          variant="contained" color="success"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
        >
          {mutation.isPending ? "Confirming..." : "Confirm Booking"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
