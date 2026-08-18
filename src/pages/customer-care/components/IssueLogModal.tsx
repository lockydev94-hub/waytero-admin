// ============================================================
// CUSTOMER CARE — LOG ISSUE / INQUIRY MODAL
// ============================================================
import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Stack, Typography, TextField, Button, MenuItem,
  Select, InputLabel, FormControl, CircularProgress, Alert,
  IconButton, alpha, useTheme, Chip, Autocomplete,
} from "@mui/material";
import { Close, HeadsetMic, Save, ReportProblem } from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import {
  customerCareService, CustomerLookup, CareLogItem,
} from "../../../services/customerCare.service";

const ISSUE_TYPES = [
  { value: "BOOKING_ISSUE",  label: "Booking Issue",  color: "#8B5CF6" },
  { value: "PAYMENT_ISSUE",  label: "Payment Issue",  color: "#F59E0B" },
  { value: "INQUIRY",        label: "General Inquiry", color: "#3B82F6" },
  { value: "COMPLAINT",      label: "Complaint",       color: "#EF4444" },
  { value: "OTHER",          label: "Other",           color: "#6B7280" },
];

const PRIORITIES = [
  { value: "LOW",    label: "Low",    color: "#6B7280" },
  { value: "MEDIUM", label: "Medium", color: "#3B82F6" },
  { value: "HIGH",   label: "High",   color: "#F59E0B" },
  { value: "URGENT", label: "Urgent", color: "#EF4444" },
];

interface FormData {
  issue_type: string;
  subject: string;
  description: string;
  priority: string;
  booking_id: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  customer: CustomerLookup | null;
  onCreated: (log: CareLogItem) => void;
}

export default function IssueLogModal({ open, onClose, customer, onCreated }: Props) {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { issue_type: "INQUIRY", subject: "", description: "", priority: "MEDIUM", booking_id: "" },
  });

  function handleClose() { reset(); setError(""); onClose(); }

  async function onSubmit(data: FormData) {
    if (!customer?.customer_id) return;
    setLoading(true); setError("");
    try {
      const log = await customerCareService.createLog({
        customer_id: customer.customer_id,
        issue_type: data.issue_type,
        subject: data.subject,
        description: data.description,
        priority: data.priority,
        booking_id: data.booking_id ? Number(data.booking_id) : null,
      });
      onCreated(log);
      handleClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to create log");
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 4 } }}>

      <DialogTitle sx={{
        background: `linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)`,
        color: "#fff", p: 3,
      }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Box sx={{ p: 1, borderRadius: 2, bgcolor: "rgba(255,255,255,0.15)" }}>
              <ReportProblem sx={{ color: "#fff" }} />
            </Box>
            <Box>
              <Typography fontWeight={700} fontSize={18}>Log Issue / Inquiry</Typography>
              <Typography fontSize={12} sx={{ opacity: 0.8 }}>
                {customer?.full_name} · {customer?.mobile_number}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={handleClose} sx={{ color: "rgba(255,255,255,0.7)" }}><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError("")}>{error}</Alert>}

        <Stack gap={2.5} component="form">
          <Stack direction="row" gap={2}>
            <Controller name="issue_type" control={control} render={({ field }) => (
              <FormControl fullWidth size="small">
                <InputLabel>Issue Type *</InputLabel>
                <Select {...field} label="Issue Type *" sx={{ borderRadius: 2 }}>
                  {ISSUE_TYPES.map(it => (
                    <MenuItem key={it.value} value={it.value}>
                      <Stack direction="row" alignItems="center" gap={1}>
                        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: it.color }} />
                        {it.label}
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )} />

            <Controller name="priority" control={control} render={({ field }) => (
              <FormControl fullWidth size="small">
                <InputLabel>Priority *</InputLabel>
                <Select {...field} label="Priority *" sx={{ borderRadius: 2 }}>
                  {PRIORITIES.map(p => (
                    <MenuItem key={p.value} value={p.value}>
                      <Stack direction="row" alignItems="center" gap={1}>
                        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: p.color }} />
                        {p.label}
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )} />
          </Stack>

          <Controller name="subject" control={control}
            rules={{ required: "Subject is required" }}
            render={({ field }) => (
              <TextField {...field} label="Subject *" size="small" fullWidth
                error={!!errors.subject} helperText={errors.subject?.message}
                placeholder="Brief description of the issue"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }} />
            )} />

          <Controller name="description" control={control}
            rules={{ required: "Description is required" }}
            render={({ field }) => (
              <TextField {...field} label="Detailed Description *" size="small" fullWidth multiline rows={4}
                error={!!errors.description} helperText={errors.description?.message}
                placeholder="Describe the issue in detail..."
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }} />
            )} />

          <Controller name="booking_id" control={control} render={({ field }) => (
            <TextField {...field} label="Related Booking ID (Optional)" size="small" fullWidth
              placeholder="Enter booking ID if issue is related to a booking"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }} />
          )} />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0, gap: 1.5 }}>
        <Button onClick={handleClose} variant="outlined"
          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}>
          Cancel
        </Button>
        <Button onClick={handleSubmit(onSubmit)} variant="contained" disabled={loading}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <Save />}
          sx={{
            borderRadius: 2, textTransform: "none", fontWeight: 700,
            background: "linear-gradient(135deg, #8B5CF6, #6D28D9)",
          }}>
          Submit Log
        </Button>
      </DialogActions>
    </Dialog>
  );
}
