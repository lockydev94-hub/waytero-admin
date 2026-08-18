// ============================================================
// WAYTERO ADMIN — NO SHOW MODAL
// Endpoint: POST /admin/bookings/{bookingId}/hotel/{hotelId}/no-show
// Allowed: CONFIRMED, CHECKED_IN, IN_HOUSE
// ============================================================
import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, CircularProgress,
  Stack, Avatar, Divider, Alert, InputAdornment,
} from "@mui/material";
import { PersonOff, Close, Warning } from "@mui/icons-material";
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

export default function NoShowModal({ open, onClose, bookingId, hotelId, hotelBookingNumber, totalAmount }: Props) {
  const [refund, setRefund] = useState("0");
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const mutation = useMutation({
    mutationFn: () => bookingService.hotelNoShow(bookingId, hotelId, Number(refund)),
    onSuccess: () => {
      enqueueSnackbar("Booking marked as no-show", { variant: "warning" });
      qc.invalidateQueries({ queryKey: ["admin-booking", bookingId] });
      handleClose();
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || "Failed", { variant: "error" }),
  });

  const handleClose = () => { setRefund("0"); onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: "grey.600", width: 36, height: 36 }}><PersonOff fontSize="small" /></Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Mark No-Show</Typography>
              <Typography variant="caption" color="text.secondary">{hotelBookingNumber}</Typography>
            </Box>
          </Stack>
          <Button size="small" onClick={handleClose} sx={{ minWidth: 0 }}><Close fontSize="small" /></Button>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="warning" icon={<Warning />} sx={{ mb: 2, borderRadius: 2 }}>
          Guest did not arrive. Refund is governed by the hotel's cancellation policy.
        </Alert>
        <TextField
          label="Refund Amount (₹)"
          value={refund}
          onChange={(e) => setRefund(e.target.value)}
          fullWidth type="number" inputProps={{ min: 0, max: totalAmount }}
          InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
          helperText={`Booking total: ₹${totalAmount.toLocaleString()}. Enter 0 for no refund.`}
        />
      </DialogContent>
      <Divider />
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined" color="inherit">Cancel</Button>
        <Button
          variant="contained" color="inherit"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <PersonOff />}
          sx={{ bgcolor: "grey.600", color: "white", "&:hover": { bgcolor: "grey.700" } }}
        >
          {mutation.isPending ? "Processing..." : "Confirm No-Show"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
