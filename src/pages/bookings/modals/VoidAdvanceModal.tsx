// ============================================================
// WAYTERO ADMIN — VOID ADVANCE PAYMENT MODAL
// Endpoint: POST /admin/advance/void
// Admin-only: releases the one-advance-per-booking lock so a
// corrected advance can be recorded.
// Doc Ref: BRD Part 3 §45
// ============================================================
import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, CircularProgress, Stack,
  Avatar, Divider, Alert, TextField,
} from "@mui/material";
import { Block, Close, Warning } from "@mui/icons-material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { advanceService } from "../../../services/advance.service";

interface Props {
  open: boolean;
  onClose: () => void;
  bookingNumber: string;
  masterBookingId: number;
  receiptNumber: string;
  amount: number;
}

export default function VoidAdvanceModal({
  open, onClose, bookingNumber, masterBookingId, receiptNumber, amount,
}: Props) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [reason, setReason] = useState("");

  const voidMut = useMutation({
    mutationFn: () => advanceService.voidAdvance({ booking_number: bookingNumber, reason }),
    onSuccess: () => {
      enqueueSnackbar("Advance voided — a corrected advance can now be recorded.", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["advance-eligibility", bookingNumber] });
      qc.invalidateQueries({ queryKey: ["admin-booking", masterBookingId] });
      setReason("");
      onClose();
    },
    onError: (e: any) =>
      enqueueSnackbar(e?.response?.data?.detail || "Void failed", { variant: "error" }),
  });

  const handleClose = () => { setReason(""); onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Avatar sx={{ bgcolor: "error.main", width: 40, height: 40 }}><Block /></Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Void Advance Payment</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                {receiptNumber}
              </Typography>
            </Box>
          </Stack>
          <Button size="small" onClick={handleClose} sx={{ minWidth: 0 }}><Close fontSize="small" /></Button>
        </Stack>
      </DialogTitle>
      <Divider />

      <DialogContent sx={{ pt: 2.5 }}>
        <Stack gap={2.5}>
          <Alert severity="warning" icon={<Warning />} sx={{ borderRadius: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              This will cancel advance of ₹{amount?.toLocaleString("en-IN")}.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              The booking will be unlocked so a corrected advance can be recorded.
              This action cannot be undone.
            </Typography>
          </Alert>

          <TextField
            label="Reason for voiding *"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
            multiline
            rows={3}
            placeholder="e.g. Wrong amount keyed, customer cancelled advance..."
            error={!!reason && reason.trim().length < 3}
            helperText="Minimum 3 characters"
          />
        </Stack>
      </DialogContent>

      <Divider />
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined" color="inherit">Cancel</Button>
        <Button
          variant="contained"
          color="error"
          disabled={reason.trim().length < 3 || voidMut.isPending}
          onClick={() => voidMut.mutate()}
          startIcon={voidMut.isPending ? <CircularProgress size={16} color="inherit" /> : <Block />}
          sx={{ fontWeight: 700 }}
        >
          {voidMut.isPending ? "Voiding..." : "Void Advance"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
