// WAYTERO ADMIN — COMPLETE TOUR MODAL
// IN_PROGRESS → COMPLETED. Trip is finished; ready for settlement.
// Doc Ref: BRD_PART_5_TOUR_PACKAGE_MANAGEMENT §5
// ============================================================
import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, Avatar, Box, Typography, Divider, Alert, CircularProgress, TextField,
} from "@mui/material";
import { TaskAlt, Close, Info, AccountBalance } from "@mui/icons-material";
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
  partnerPayout: number;
  onSuccess?: () => void;
}

export default function CompleteTourModal({ open, onClose, bookingId, tourId, bookingNumber, packageName, partnerPayout, onSuccess }: Props) {
  const [note, setNote] = useState("");
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const mutation = useMutation({
    mutationFn: () => tourService.setBookingStatus(tourId, "COMPLETED"),
    onSuccess: () => {
      enqueueSnackbar("Tour completed — ready for settlement", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin-tour-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-tour-booking", tourId] });
      qc.invalidateQueries({ queryKey: ["admin-booking", bookingId] });
      onSuccess?.();
      handleClose();
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || "Completion failed", { variant: "error" }),
  });

  const handleClose = () => { setNote(""); onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: "success.main", width: 36, height: 36 }}><TaskAlt fontSize="small" /></Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Complete Tour</Typography>
              <Typography variant="caption" color="text.secondary">{bookingNumber} · {packageName}</Typography>
            </Box>
          </Stack>
          <Button size="small" onClick={handleClose} sx={{ minWidth: 0 }}><Close fontSize="small" /></Button>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="success" icon={<Info />} sx={{ mb: 2, borderRadius: 2 }}>
          Marking the trip as complete unlocks settlement. Partner payout preview: <b>₹{partnerPayout.toLocaleString("en-IN")}</b>.
          After this, route the booking to the Settlements page to record the net transfer.
        </Alert>
        <TextField
          label="Completion note" value={note} onChange={e => setNote(e.target.value)}
          fullWidth multiline rows={2}
          placeholder="e.g. Customer feedback 5/5, no incidents, drop-off on time"
        />
      </DialogContent>
      <Divider />
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined" color="inherit">Go Back</Button>
        <Button
          variant="contained" color="success"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <TaskAlt />}
        >
          {mutation.isPending ? "Completing..." : "Mark as Completed"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
