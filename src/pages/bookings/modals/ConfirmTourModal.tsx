// WAYTERO ADMIN — CONFIRM TOUR BOOKING MODAL
// Transitions a PENDING_CONFIRMATION tour booking to CONFIRMED.
// One-click action; only an optional admin note.
// Doc Ref: BRD_PART_5_TOUR_PACKAGE_MANAGEMENT §5
// ============================================================
import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, Avatar, Box, Typography, Divider, Alert, CircularProgress,
} from "@mui/material";
import { CheckCircle, Close, Info } from "@mui/icons-material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { tourService } from "../../../services/tour.service";

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: number;
  tourId: number;
  bookingNumber: string;
  packageName: string;
  totalAmount: number;
  onSuccess?: () => void;
}

export default function ConfirmTourModal({ open, onClose, bookingId, tourId, bookingNumber, packageName, totalAmount, onSuccess }: Props) {
  const [note, setNote] = useState("");
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const mutation = useMutation({
    mutationFn: () => tourService.setBookingStatus(tourId, "CONFIRMED"),
    onSuccess: () => {
      enqueueSnackbar("Tour booking confirmed", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin-tour-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-tour-booking", tourId] });
      qc.invalidateQueries({ queryKey: ["admin-booking", bookingId] });
      onSuccess?.();
      handleClose();
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || "Confirmation failed", { variant: "error" }),
  });

  const handleClose = () => { setNote(""); onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: "success.main", width: 36, height: 36 }}><CheckCircle fontSize="small" /></Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Confirm Tour Booking</Typography>
              <Typography variant="caption" color="text.secondary">{bookingNumber} · {packageName}</Typography>
            </Box>
          </Stack>
          <Button size="small" onClick={handleClose} sx={{ minWidth: 0 }}><Close fontSize="small" /></Button>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="info" icon={<Info />} sx={{ mb: 2, borderRadius: 2 }}>
          Confirming will lock the booking at <b>₹{totalAmount.toLocaleString("en-IN")}</b>, mark seats as held, and notify the customer that the trip is on.
        </Alert>
        <TextField
          label="Internal note (optional)"
          value={note} onChange={e => setNote(e.target.value)}
          fullWidth multiline rows={2}
          placeholder="e.g. Verified advance payment via UPI ref ABC123"
        />
      </DialogContent>
      <Divider />
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined" color="inherit">Go Back</Button>
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
