// ============================================================
// WAYTERO ADMIN — RESCHEDULE MODAL
// Endpoint: POST /admin/bookings/{bookingId}/cab/{cabId}/reschedule
// Guard: trip must not have STARTED
// ============================================================
import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, CircularProgress,
  Stack, Avatar, Divider, Alert,
} from "@mui/material";
import { Schedule, Close } from "@mui/icons-material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { bookingService } from "../../../services/booking.service";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: number;
  cabId: number;
  currentPickup: string | null;
  cabBookingNumber: string;
}

export default function RescheduleModal({ open, onClose, bookingId, cabId, currentPickup, cabBookingNumber }: Props) {
  const [newDatetime, setNewDatetime] = useState("");
  const [reason, setReason] = useState("");
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const mutation = useMutation({
    mutationFn: () => bookingService.reschedule(bookingId, cabId, new Date(newDatetime).toISOString(), reason || undefined),
    onSuccess: () => {
      enqueueSnackbar("Pickup rescheduled successfully", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin-booking", bookingId] });
      handleClose();
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || "Reschedule failed", { variant: "error" }),
  });

  const handleClose = () => { setNewDatetime(""); setReason(""); onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: "warning.main", width: 36, height: 36 }}><Schedule fontSize="small" /></Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Reschedule Pickup</Typography>
              <Typography variant="caption" color="text.secondary">{cabBookingNumber}</Typography>
            </Box>
          </Stack>
          <Button size="small" onClick={handleClose} sx={{ minWidth: 0 }}><Close fontSize="small" /></Button>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        {currentPickup && (
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
            Current pickup: <strong>{format(new Date(currentPickup), "dd MMM yyyy, hh:mm a")}</strong>
          </Alert>
        )}
        <Stack gap={2}>
          <TextField
            label="New Pickup Date & Time"
            type="datetime-local"
            value={newDatetime}
            onChange={(e) => setNewDatetime(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="e.g. Customer requested change"
          />
        </Stack>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined" color="inherit">Cancel</Button>
        <Button
          variant="contained" color="warning"
          disabled={!newDatetime || mutation.isPending}
          onClick={() => mutation.mutate()}
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <Schedule />}
        >
          {mutation.isPending ? "Rescheduling..." : "Confirm Reschedule"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
