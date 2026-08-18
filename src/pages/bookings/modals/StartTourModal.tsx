// WAYTERO ADMIN — START TOUR MODAL
// CONFIRMED → IN_PROGRESS. Confirms the trip is underway.
// Doc Ref: BRD_PART_5_TOUR_PACKAGE_MANAGEMENT §5
// ============================================================
import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, Avatar, Box, Typography, Divider, Alert, CircularProgress, TextField,
} from "@mui/material";
import { PlayArrow, Close, Info, CheckCircle } from "@mui/icons-material";
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
  onSuccess?: () => void;
}

export default function StartTourModal({ open, onClose, bookingId, tourId, bookingNumber, packageName, onSuccess }: Props) {
  const [note, setNote] = useState("");
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const mutation = useMutation({
    mutationFn: () => tourService.setBookingStatus(tourId, "IN_PROGRESS"),
    onSuccess: () => {
      enqueueSnackbar("Tour marked as in-progress", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin-tour-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-tour-booking", tourId] });
      qc.invalidateQueries({ queryKey: ["admin-booking", bookingId] });
      onSuccess?.();
      handleClose();
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || "Update failed", { variant: "error" }),
  });

  const handleClose = () => { setNote(""); onClose(); };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: "info.main", width: 36, height: 36 }}><PlayArrow fontSize="small" /></Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Start Trip</Typography>
              <Typography variant="caption" color="text.secondary">{bookingNumber} · {packageName}</Typography>
            </Box>
          </Stack>
          <Button size="small" onClick={handleClose} sx={{ minWidth: 0 }}><Close fontSize="small" /></Button>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Alert severity="info" icon={<Info />} sx={{ mb: 2, borderRadius: 2 }}>
          Mark this tour as in-progress once the customer has arrived and the trip has started. Settlements remain blocked until completion.
        </Alert>
        <TextField
          label="Note (optional)" value={note} onChange={e => setNote(e.target.value)}
          fullWidth multiline rows={2}
          placeholder="e.g. Customer arrived on time, hotel check-in completed"
        />
      </DialogContent>
      <Divider />
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined" color="inherit">Go Back</Button>
        <Button
          variant="contained" color="info"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <PlayArrow />}
        >
          {mutation.isPending ? "Starting..." : "Mark as Started"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
