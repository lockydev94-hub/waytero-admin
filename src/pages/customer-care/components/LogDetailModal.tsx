// ============================================================
// CUSTOMER CARE — LOG DETAIL / UPDATE MODAL
// View full log details and update status/priority/resolution
// ============================================================
import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Stack, Typography, Button, MenuItem,
  Select, InputLabel, FormControl, CircularProgress,
  Alert, IconButton, alpha, useTheme, Chip, Divider,
  TextField, Grid,
} from "@mui/material";
import {
  Close, Save, CheckCircle, Schedule, Cancel,
  HeadsetMic, PriorityHigh, BookOnline,
} from "@mui/icons-material";
import { format } from "date-fns";
import { customerCareService, CareLogItem } from "../../../services/customerCare.service";

const STATUS_OPTIONS = [
  { value: "OPEN",        label: "Open",        color: "#F59E0B" },
  { value: "IN_PROGRESS", label: "In Progress", color: "#3B82F6" },
  { value: "RESOLVED",    label: "Resolved",    color: "#22C55E" },
  { value: "CLOSED",      label: "Closed",      color: "#6B7280" },
];

const PRIORITY_OPTIONS = [
  { value: "LOW",    label: "Low",    color: "#6B7280" },
  { value: "MEDIUM", label: "Medium", color: "#3B82F6" },
  { value: "HIGH",   label: "High",   color: "#F59E0B" },
  { value: "URGENT", label: "Urgent", color: "#EF4444" },
];

const ISSUE_TYPE_LABELS: Record<string, string> = {
  BOOKING_ISSUE: "Booking Issue", PAYMENT_ISSUE: "Payment Issue",
  INQUIRY: "Inquiry", COMPLAINT: "Complaint", OTHER: "Other",
};

interface Props {
  open: boolean;
  log: CareLogItem | null;
  onClose: () => void;
  onUpdated: (log: CareLogItem) => void;
}

export default function LogDetailModal({ open, log, onClose, onUpdated }: Props) {
  const theme = useTheme();
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [resolution, setResolution] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleOpen() {
    if (log) {
      setStatus(log.status);
      setPriority(log.priority);
      setResolution("");
      setError("");
    }
  }

  async function handleSave() {
    if (!log) return;
    setLoading(true); setError("");
    try {
      const updated = await customerCareService.updateLog(log.id, {
        status,
        priority,
        resolution_notes: resolution || undefined,
      });
      onUpdated(updated);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to update log");
    } finally { setLoading(false); }
  }

  const currentStatus = STATUS_OPTIONS.find(s => s.value === (log?.status || "OPEN"));
  const currentPriority = PRIORITY_OPTIONS.find(p => p.value === (log?.priority || "MEDIUM"));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      TransitionProps={{ onEnter: handleOpen }}
      PaperProps={{ sx: { borderRadius: 4 } }}
    >
      {/* Header */}
      <DialogTitle sx={{
        background: `linear-gradient(135deg, #1E293B 0%, #0F172A 100%)`,
        color: "#fff", p: 3,
      }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Box sx={{ p: 1, borderRadius: 2, bgcolor: "rgba(255,255,255,0.1)" }}>
              <HeadsetMic sx={{ color: "#fff" }} />
            </Box>
            <Box>
              <Typography fontWeight={700} fontSize={17}>Care Log Details</Typography>
              <Typography fontSize={12} sx={{ opacity: 0.65, fontFamily: "monospace" }}>
                {log?.log_number}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} sx={{ color: "rgba(255,255,255,0.6)" }}><Close /></IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError("")}>{error}</Alert>}

        {log && (
          <>
            {/* Customer info */}
            <Box sx={{
              p: 2, borderRadius: 2.5, bgcolor: alpha(theme.palette.primary.main, 0.05),
              border: "1px solid", borderColor: alpha(theme.palette.primary.main, 0.12), mb: 2.5,
            }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                <Box>
                  <Typography fontWeight={700} fontSize={15}>{log.customer_name || "Unknown"}</Typography>
                  <Typography fontSize={13} color="text.secondary">{log.customer_mobile}</Typography>
                </Box>
                <Stack direction="row" gap={1} flexWrap="wrap">
                  <Chip size="small"
                    label={ISSUE_TYPE_LABELS[log.issue_type] || log.issue_type}
                    sx={{ fontWeight: 700, fontSize: 11, bgcolor: alpha("#8B5CF6", 0.1), color: "#8B5CF6" }}
                  />
                  <Chip size="small"
                    label={currentPriority?.label || log.priority}
                    sx={{ fontWeight: 700, fontSize: 11, bgcolor: alpha(currentPriority?.color || "#6B7280", 0.12), color: currentPriority?.color }}
                  />
                </Stack>
              </Stack>
            </Box>

            {/* Subject & description */}
            <Box mb={2.5}>
              <Typography fontWeight={700} fontSize={14} mb={0.75}>{log.subject}</Typography>
              <Typography fontSize={13} color="text.secondary" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                {log.description}
              </Typography>
            </Box>

            {/* Booking reference */}
            {log.booking_number && (
              <Box sx={{
                p: 1.5, borderRadius: 2, bgcolor: alpha("#3B82F6", 0.06),
                border: "1px solid", borderColor: alpha("#3B82F6", 0.15), mb: 2.5,
                display: "flex", alignItems: "center", gap: 1,
              }}>
                <BookOnline sx={{ fontSize: 16, color: "#3B82F6" }} />
                <Typography fontSize={13} fontFamily="monospace" fontWeight={600} color="#3B82F6">
                  {log.booking_number}
                </Typography>
              </Box>
            )}

            <Divider sx={{ mb: 2.5 }} />

            {/* Meta */}
            <Grid container spacing={2} mb={2.5}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">Created By</Typography>
                <Typography fontSize={13}>{log.created_by_name || "—"}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">Created At</Typography>
                <Typography fontSize={13}>{format(new Date(log.created_at), "dd MMM yyyy, HH:mm")}</Typography>
              </Grid>
              {log.resolved_at && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">Resolved At</Typography>
                  <Typography fontSize={13} color="success.main">{format(new Date(log.resolved_at), "dd MMM yyyy, HH:mm")}</Typography>
                </Grid>
              )}
            </Grid>

            <Divider sx={{ mb: 2.5 }} />

            {/* Update controls */}
            <Typography fontWeight={700} fontSize={13} color="text.secondary" mb={1.5}>UPDATE LOG</Typography>

            <Stack gap={2}>
              <Stack direction="row" gap={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select value={status} onChange={e => setStatus(e.target.value)} label="Status" sx={{ borderRadius: 2 }}>
                    {STATUS_OPTIONS.map(s => (
                      <MenuItem key={s.value} value={s.value}>
                        <Stack direction="row" alignItems="center" gap={1}>
                          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: s.color }} />
                          {s.label}
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth size="small">
                  <InputLabel>Priority</InputLabel>
                  <Select value={priority} onChange={e => setPriority(e.target.value)} label="Priority" sx={{ borderRadius: 2 }}>
                    {PRIORITY_OPTIONS.map(p => (
                      <MenuItem key={p.value} value={p.value}>
                        <Stack direction="row" alignItems="center" gap={1}>
                          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: p.color }} />
                          {p.label}
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              {status === "RESOLVED" && (
                <TextField
                  label="Resolution Notes"
                  value={resolution}
                  onChange={e => setResolution(e.target.value)}
                  size="small" multiline rows={3} fullWidth
                  placeholder="Describe how the issue was resolved..."
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                />
              )}
            </Stack>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0, gap: 1.5 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <Save />}
          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}
