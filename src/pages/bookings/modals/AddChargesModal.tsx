// ============================================================
// WAYTERO ADMIN — ADD CHARGES MODAL
// Endpoint: POST /admin/bookings/{bookingId}/hotel/{hotelId}/add-charges
// Allowed: CHECKED_IN, IN_HOUSE, CHECKED_OUT
// ============================================================
import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, CircularProgress,
  Stack, Avatar, Divider, InputAdornment,
} from "@mui/material";
import { AddCircle, Close } from "@mui/icons-material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { bookingService } from "../../../services/booking.service";

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: number;
  hotelId: number;
  hotelBookingNumber: string;
}

export default function AddChargesModal({ open, onClose, bookingId, hotelId, hotelBookingNumber }: Props) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const mutation = useMutation({
    mutationFn: () => bookingService.hotelAddCharges(bookingId, hotelId, Number(amount), description),
    onSuccess: (data: any) => {
      enqueueSnackbar(`Charge added. New final amount: ₹${data?.final_amount?.toLocaleString()}`, { variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin-booking", bookingId] });
      handleClose();
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || "Failed to add charge", { variant: "error" }),
  });

  const handleClose = () => { setAmount(""); setDescription(""); onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: "warning.main", width: 36, height: 36 }}><AddCircle fontSize="small" /></Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Add Charges</Typography>
              <Typography variant="caption" color="text.secondary">{hotelBookingNumber}</Typography>
            </Box>
          </Stack>
          <Button size="small" onClick={handleClose} sx={{ minWidth: 0 }}><Close fontSize="small" /></Button>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Stack gap={2}>
          <TextField
            label="Amount (₹) *"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            fullWidth type="number" inputProps={{ min: 1 }}
            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
          />
          <TextField
            label="Description *"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            placeholder="e.g. Extra bed, food, laundry, damage"
          />
        </Stack>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined" color="inherit">Cancel</Button>
        <Button
          variant="contained" color="warning"
          disabled={!amount || Number(amount) <= 0 || !description.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <AddCircle />}
        >
          {mutation.isPending ? "Adding..." : "Add Charge"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
