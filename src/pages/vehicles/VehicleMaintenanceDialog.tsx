// ============================================================
// WAYTERO ADMIN — VEHICLE MAINTENANCE DIALOG
// Doc Ref: BRD Part 3 §133-138
//
// Modal that lists, creates, edits and deletes maintenance records for
// one vehicle. Opens from the Vehicles page row menu. Does NOT mutate
// vehicle.status — maintenance is a side log, not a state transition
// (those live on the /vehicles detail or trip-assistance flow).
// ============================================================

import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Stack, Button, IconButton, Skeleton, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, TextField, MenuItem, Tooltip, Divider, alpha, useTheme,
} from "@mui/material";
import {
  Close, Add, Edit, Delete, Build, Warning, CheckCircle, Save,
} from "@mui/icons-material";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { format, parseISO } from "date-fns";

import { vehicleMaintenanceService, MaintenanceRecord } from "../../services/vehicleMaintenance.service";
import { apiErrorMessage } from "../../utils/apiError";

const MAINTENANCE_TYPES = [
  "ROUTINE_SERVICE", "OIL_CHANGE", "TYRE", "BRAKE", "BATTERY",
  "ENGINE", "TRANSMISSION", "AC", "BODY_WORK", "ACCIDENT_REPAIR",
  "INSPECTION", "OTHER",
];

interface Props {
  open: boolean;
  onClose: () => void;
  vehicleId: number;
  vehicleLabel: string;
}

function DueChip({ record }: { record: MaintenanceRecord }) {
  if (record.next_due_date == null) return <Typography variant="caption" color="text.disabled">—</Typography>;
  if (record.is_overdue) {
    const d = Math.abs(record.days_until_due ?? 0);
    return <Chip label={`Overdue ${d}d`} size="small" color="error" icon={<Warning />} sx={{ fontWeight: 700 }} />;
  }
  const d = record.days_until_due ?? 0;
  if (d <= 7) return <Chip label={`Due in ${d}d`} size="small" color="warning" sx={{ fontWeight: 700 }} />;
  if (d <= 30) return <Chip label={`Due in ${d}d`} size="small" color="info" variant="outlined" />;
  return <Chip label={`Due in ${d}d`} size="small" variant="outlined" />;
}

export default function VehicleMaintenanceDialog({ open, onClose, vehicleId, vehicleLabel }: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceRecord | null>(null);
  const [form, setForm] = useState({
    maintenance_type: "ROUTINE_SERVICE",
    service_date: format(new Date(), "yyyy-MM-dd"),
    next_due_date: "",
    cost: "",
    remarks: "",
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["vehicle-maintenance", vehicleId],
    queryFn: () => vehicleMaintenanceService.listForVehicle(vehicleId),
    enabled: open && vehicleId > 0,
    staleTime: 30_000,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["vehicle-maintenance", vehicleId] });

  const create = useMutation({
    mutationFn: () =>
      vehicleMaintenanceService.create(vehicleId, {
        maintenance_type: form.maintenance_type,
        service_date: form.service_date,
        next_due_date: form.next_due_date || null,
        cost: form.cost ? Number(form.cost) : null,
        remarks: form.remarks || null,
      }),
    onSuccess: () => {
      enqueueSnackbar("Maintenance entry added", { variant: "success" });
      invalidate();
      setFormOpen(false);
    },
    onError: (e) => enqueueSnackbar(apiErrorMessage(e, "Create failed"), { variant: "error" }),
  });

  const update = useMutation({
    mutationFn: () =>
      vehicleMaintenanceService.update(vehicleId, editing!.id, {
        maintenance_type: form.maintenance_type,
        service_date: form.service_date,
        next_due_date: form.next_due_date || null,
        cost: form.cost ? Number(form.cost) : null,
        remarks: form.remarks || null,
      }),
    onSuccess: () => {
      enqueueSnackbar("Maintenance entry updated", { variant: "success" });
      invalidate();
      setFormOpen(false);
      setEditing(null);
    },
    onError: (e) => enqueueSnackbar(apiErrorMessage(e, "Update failed"), { variant: "error" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => vehicleMaintenanceService.remove(vehicleId, id),
    onSuccess: () => {
      enqueueSnackbar("Entry removed", { variant: "success" });
      invalidate();
    },
    onError: (e) => enqueueSnackbar(apiErrorMessage(e, "Delete failed"), { variant: "error" }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      maintenance_type: "ROUTINE_SERVICE",
      service_date: format(new Date(), "yyyy-MM-dd"),
      next_due_date: "",
      cost: "",
      remarks: "",
    });
    setFormOpen(true);
  };

  const openEdit = (rec: MaintenanceRecord) => {
    setEditing(rec);
    setForm({
      maintenance_type: rec.maintenance_type ?? "ROUTINE_SERVICE",
      service_date: rec.service_date ?? format(new Date(), "yyyy-MM-dd"),
      next_due_date: rec.next_due_date ?? "",
      cost: rec.cost != null ? String(rec.cost) : "",
      remarks: rec.remarks ?? "",
    });
    setFormOpen(true);
  };

  const submit = () => {
    if (!form.service_date) {
      enqueueSnackbar("Service date is required", { variant: "error" });
      return;
    }
    if (editing) update.mutate();
    else create.mutate();
  };

  const items: MaintenanceRecord[] = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3, maxHeight: "90vh" } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
              <Build sx={{ color: "primary.main" }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700}>Maintenance · {vehicleLabel}</Typography>
              <Typography variant="caption" color="text.secondary">
                {total} service entr{total !== 1 ? "ies" : "y"}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" size="small" startIcon={<Add />} onClick={openCreate}>
              Add entry
            </Button>
            <IconButton onClick={onClose} size="small"><Close /></IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0 }}>
          {isError && <Alert severity="error" sx={{ m: 2 }}>Failed to load maintenance log.</Alert>}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Serviced</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Next due</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Cost</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(6)].map((__, j) => (
                        <TableCell key={j}><Skeleton animation="wave" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                      <Stack alignItems="center" spacing={1}>
                        <CheckCircle sx={{ fontSize: 36, color: "success.main" }} />
                        <Typography variant="body2" color="text.secondary">No maintenance recorded yet.</Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ) : items.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Chip
                        label={(r.maintenance_type ?? "—").replace(/_/g, " ")}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {r.service_date ? format(parseISO(r.service_date), "dd MMM yyyy") : "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Typography variant="body2">
                          {r.next_due_date ? format(parseISO(r.next_due_date), "dd MMM yyyy") : "—"}
                        </Typography>
                        <DueChip record={r} />
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600}>
                        {r.cost != null ? `₹${r.cost.toLocaleString("en-IN")}` : "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" sx={{
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                        overflow: "hidden", maxWidth: 200,
                      }}>
                        {r.remarks ?? "—"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(r)}><Edit fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          disabled={remove.isPending}
                          onClick={() => {
                            if (window.confirm("Remove this maintenance entry?")) remove.mutate(r.id);
                          }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>

        <DialogActions sx={{ px: 3 }}>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Add / edit form */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {editing ? <Edit color="primary" /> : <Add color="primary" />}
          {editing ? "Edit maintenance entry" : "New maintenance entry"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              select
              label="Type"
              value={form.maintenance_type}
              onChange={(e) => setForm((f) => ({ ...f, maintenance_type: e.target.value }))}
              size="small"
              fullWidth
            >
              {MAINTENANCE_TYPES.map((t) => (
                <MenuItem key={t} value={t}>{t.replace(/_/g, " ")}</MenuItem>
              ))}
            </TextField>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Service date"
                type="date"
                size="small"
                value={form.service_date}
                onChange={(e) => setForm((f) => ({ ...f, service_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
                required
              />
              <TextField
                label="Next due"
                type="date"
                size="small"
                value={form.next_due_date}
                onChange={(e) => setForm((f) => ({ ...f, next_due_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
                helperText="Optional — when to remind"
              />
            </Stack>
            <TextField
              label="Cost (₹)"
              type="number"
              size="small"
              value={form.cost}
              onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
              fullWidth
              inputProps={{ min: 0, step: 0.01 }}
              helperText="Leave empty for warranty / recall work"
            />
            <TextField
              label="Remarks"
              size="small"
              value={form.remarks}
              onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              multiline
              rows={2}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            disabled={create.isPending || update.isPending}
            onClick={submit}
          >
            {editing ? "Update" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
