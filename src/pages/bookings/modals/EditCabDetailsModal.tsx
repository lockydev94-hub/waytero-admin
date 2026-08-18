// ============================================================
// WAYTERO ADMIN — EDIT CAB DETAILS MODAL
// Endpoint: PATCH /admin/bookings/{bookingId}/cab/{cabId}/edit
// Editable: pickup_location, drop_location, estimated_distance,
//           estimated_amount, trip_type, vehicle_category_id
// Guard (backend): blocked when status is STARTED or beyond
// NOT editable: pickup_datetime (use RescheduleModal)
//               assignment fields (partner/driver/vehicle)
//               final_amount (use SetFinalAmountModal)
// ============================================================
import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, Typography, Box,
  CircularProgress, Stack, Avatar, Divider, Alert,
  Chip, Grid, Paper, InputAdornment, alpha, LinearProgress,
} from "@mui/material";
import {
  Edit, Close, LocationOn, Straighten, AttachMoney,
  LocalTaxi, DirectionsCar, CheckCircle, Info, Warning,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { bookingService, CabBookingOut, VehicleCategoryOption } from "../../../services/booking.service";

// ── Constants ──────────────────────────────────────────────────

const TRIP_TYPES = [
  { value: "LOCAL",      label: "Local",             desc: "Within the city" },
  { value: "AIRPORT",    label: "Airport Transfer",  desc: "To/from airport" },
  { value: "OUTSTATION", label: "Outstation",        desc: "Multi-city trip" },
  { value: "ONE_WAY",    label: "One Way",           desc: "One-way intercity" },
  { value: "ROUND_TRIP", label: "Round Trip",        desc: "Return trip included" },
];

// Statuses that allow editing
const EDITABLE_STATUSES = new Set(["PENDING_ASSIGNMENT", "ASSIGNED", "DRIVER_ASSIGNED"]);

// ── Status badge helper ────────────────────────────────────────

function statusColor(s: string): "warning" | "primary" | "secondary" | "error" | "default" {
  if (s === "PENDING_ASSIGNMENT") return "warning";
  if (s === "ASSIGNED") return "primary";
  if (s === "DRIVER_ASSIGNED") return "secondary";
  if (s === "BREAKDOWN_REPORTED" || s === "AWAITING_SWAP") return "error";
  return "default";
}

// ── Field Row wrapper ──────────────────────────────────────────

function FieldSection({ icon, label, children }: {
  icon: React.ReactNode; label: string; children: React.ReactNode;
}) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" gap={0.75} mb={1}>
        <Box sx={{ color: "text.secondary", display: "flex" }}>{icon}</Box>
        <Typography variant="caption" fontWeight={700} color="text.secondary"
          sx={{ textTransform: "uppercase", letterSpacing: 0.7 }}>
          {label}
        </Typography>
      </Stack>
      {children}
    </Box>
  );
}

// ── Props ──────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: number;
  cabId: number;
  cab: CabBookingOut;
}

// ── Main Modal ─────────────────────────────────────────────────

export default function EditCabDetailsModal({ open, onClose, bookingId, cabId, cab }: Props) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  // ── Form state — initialised from current cab ──────────────
  const [pickupLocation, setPickupLocation]   = useState("");
  const [dropLocation, setDropLocation]       = useState("");
  const [estimatedDistance, setEstimatedDistance] = useState("");
  const [estimatedAmount, setEstimatedAmount] = useState("");
  const [tripType, setTripType]               = useState("");
  const [vehicleCategoryId, setVehicleCategoryId] = useState<number | "">("");

  // Populate on open
  useEffect(() => {
    if (open) {
      setPickupLocation(cab.pickup_location || "");
      setDropLocation(cab.drop_location || "");
      setEstimatedDistance(cab.estimated_distance != null ? String(cab.estimated_distance) : "");
      setEstimatedAmount(cab.estimated_amount != null ? String(cab.estimated_amount) : "");
      setTripType(cab.trip_type || "");
      setVehicleCategoryId(cab.vehicle_category_id ?? "");
    }
  }, [open, cab]);

  // ── Vehicle categories ─────────────────────────────────────
  const { data: categories = [], isLoading: loadingCats } = useQuery<VehicleCategoryOption[]>({
    queryKey: ["vehicle-categories-active"],
    queryFn: () => bookingService.getVehicleCategories(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // ── Edit allowed? ──────────────────────────────────────────
  const canEdit = EDITABLE_STATUSES.has(cab.booking_status);

  // ── Dirty detection ────────────────────────────────────────
  const isDirty =
    pickupLocation !== (cab.pickup_location || "") ||
    dropLocation   !== (cab.drop_location || "") ||
    estimatedDistance !== (cab.estimated_distance != null ? String(cab.estimated_distance) : "") ||
    estimatedAmount   !== (cab.estimated_amount != null ? String(cab.estimated_amount) : "") ||
    tripType !== (cab.trip_type || "") ||
    vehicleCategoryId !== (cab.vehicle_category_id ?? "");

  // ── Changed field summary for preview ─────────────────────
  const changedFields: string[] = [];
  if (pickupLocation !== (cab.pickup_location || "")) changedFields.push("Pickup Location");
  if (dropLocation   !== (cab.drop_location || ""))   changedFields.push("Drop Location");
  if (estimatedDistance !== (cab.estimated_distance != null ? String(cab.estimated_distance) : "")) changedFields.push("Est. Distance");
  if (estimatedAmount   !== (cab.estimated_amount != null ? String(cab.estimated_amount) : ""))     changedFields.push("Est. Amount");
  if (tripType !== (cab.trip_type || "")) changedFields.push("Trip Type");
  if (vehicleCategoryId !== (cab.vehicle_category_id ?? "")) changedFields.push("Vehicle Category");

  // ── Mutation ───────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {};
      if (pickupLocation !== (cab.pickup_location || ""))
        payload.pickup_location = pickupLocation.trim();
      if (dropLocation !== (cab.drop_location || ""))
        payload.drop_location = dropLocation.trim();
      if (estimatedDistance !== (cab.estimated_distance != null ? String(cab.estimated_distance) : ""))
        payload.estimated_distance = estimatedDistance ? Number(estimatedDistance) : undefined;
      if (estimatedAmount !== (cab.estimated_amount != null ? String(cab.estimated_amount) : ""))
        payload.estimated_amount = estimatedAmount ? Number(estimatedAmount) : undefined;
      if (tripType !== (cab.trip_type || ""))
        payload.trip_type = tripType || undefined;
      if (vehicleCategoryId !== (cab.vehicle_category_id ?? ""))
        payload.vehicle_category_id = vehicleCategoryId !== "" ? vehicleCategoryId : undefined;
      return bookingService.editCabDetails(bookingId, cabId, payload as any);
    },
    onSuccess: (data: any) => {
      enqueueSnackbar(
        `Cab details updated · ${data.changes?.length ?? 0} change(s) saved`,
        { variant: "success" }
      );
      qc.invalidateQueries({ queryKey: ["admin-booking", bookingId] });
      onClose();
    },
    onError: (e: any) =>
      enqueueSnackbar(e?.response?.data?.detail || "Update failed", { variant: "error" }),
  });

  const handleClose = () => { if (!mutation.isPending) onClose(); };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: "92dvh",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {/* ── Header ───────────────────────────────────────── */}
      <DialogTitle
        sx={{
          pb: 1.5,
          background: (t) =>
            `linear-gradient(135deg, ${alpha(t.palette.warning.main, 0.08)}, ${alpha(t.palette.primary.main, 0.05)})`,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Avatar sx={{ bgcolor: "warning.main", width: 42, height: 42 }}>
              <Edit />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                Edit Cab Details
              </Typography>
              <Stack direction="row" alignItems="center" gap={1} mt={0.3}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {cab.booking_number}
                </Typography>
                <Chip
                  label={cab.booking_status.replace(/_/g, " ")}
                  color={statusColor(cab.booking_status)}
                  size="small"
                  variant="outlined"
                  sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
                />
              </Stack>
            </Box>
          </Stack>
          <Button
            size="small"
            onClick={handleClose}
            disabled={mutation.isPending}
            sx={{ minWidth: 0, color: "text.secondary", p: 0.5 }}
          >
            <Close />
          </Button>
        </Stack>
        {mutation.isPending && <LinearProgress sx={{ mt: 1.5, borderRadius: 1 }} color="warning" />}
      </DialogTitle>

      {/* ── Body ─────────────────────────────────────────── */}
      <DialogContent sx={{ p: 2.5, flex: 1, overflowY: "auto" }}>
        <Stack gap={3}>

          {/* Guard alert when editing is blocked */}
          {!canEdit && (
            <Alert severity="error" icon={<Warning />} sx={{ borderRadius: 2 }}>
              <Typography variant="body2" fontWeight={600}>
                Editing not allowed
              </Typography>
              <Typography variant="caption">
                Cab details cannot be changed once the trip has started (status:{" "}
                <strong>{cab.booking_status}</strong>).
              </Typography>
            </Alert>
          )}

          {/* Info: what is NOT editable here */}
          <Alert
            severity="info"
            icon={<Info fontSize="small" />}
            sx={{ borderRadius: 2, py: 0.75 }}
          >
            <Typography variant="caption">
              <strong>Pickup date/time</strong> → use <em>Reschedule</em>. &nbsp;
              <strong>Final amount</strong> → use <em>Set Final Amount</em>. &nbsp;
              <strong>Assignment</strong> → use <em>Assign Driver</em>.
            </Typography>
          </Alert>

          {/* ── Locations ──────────────────────────────────── */}
          <FieldSection icon={<LocationOn sx={{ fontSize: 16 }} />} label="Locations">
            <Stack gap={2}>
              <TextField
                label="Pickup Location"
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                fullWidth
                multiline
                minRows={2}
                disabled={!canEdit || mutation.isPending}
                placeholder="e.g. Bhubaneswar Airport, Odisha"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LocationOn sx={{ color: "success.main", fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ "& .MuiInputAdornment-root": { alignSelf: "flex-start", mt: 1.5 } }}
              />
              <TextField
                label="Drop Location"
                value={dropLocation}
                onChange={(e) => setDropLocation(e.target.value)}
                fullWidth
                multiline
                minRows={2}
                disabled={!canEdit || mutation.isPending}
                placeholder="e.g. Puri Beach, Odisha"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LocationOn sx={{ color: "error.main", fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ "& .MuiInputAdornment-root": { alignSelf: "flex-start", mt: 1.5 } }}
              />
            </Stack>
          </FieldSection>

          <Divider />

          {/* ── Trip Type & Category ───────────────────────── */}
          <FieldSection icon={<LocalTaxi sx={{ fontSize: 16 }} />} label="Trip Type & Category">
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Trip Type"
                  value={tripType}
                  onChange={(e) => setTripType(e.target.value)}
                  fullWidth
                  disabled={!canEdit || mutation.isPending}
                >
                  <MenuItem value=""><em>— Not Set —</em></MenuItem>
                  {TRIP_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{t.label}</Typography>
                        <Typography variant="caption" color="text.secondary">{t.desc}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Vehicle Category"
                  value={vehicleCategoryId}
                  onChange={(e) => setVehicleCategoryId(e.target.value as number | "")}
                  fullWidth
                  disabled={!canEdit || mutation.isPending || loadingCats}
                  helperText={loadingCats ? "Loading categories…" : undefined}
                >
                  <MenuItem value=""><em>— Not Set —</em></MenuItem>
                  {categories.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      <Stack direction="row" alignItems="center" gap={1}>
                        <DirectionsCar sx={{ fontSize: 16, color: "text.secondary" }} />
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{c.category_name}</Typography>
                          {c.seating_capacity && (
                            <Typography variant="caption" color="text.secondary">
                              {c.seating_capacity} seats
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
          </FieldSection>

          <Divider />

          {/* ── Distance & Amount ──────────────────────────── */}
          <FieldSection icon={<Straighten sx={{ fontSize: 16 }} />} label="Distance & Estimated Amount">
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Estimated Distance"
                  value={estimatedDistance}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setEstimatedDistance(v);
                  }}
                  fullWidth
                  disabled={!canEdit || mutation.isPending}
                  inputProps={{ inputMode: "decimal" }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">km</InputAdornment>,
                    startAdornment: (
                      <InputAdornment position="start">
                        <Straighten sx={{ fontSize: 16, color: "text.secondary" }} />
                      </InputAdornment>
                    ),
                  }}
                  helperText="Approximate route distance"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Estimated Amount"
                  value={estimatedAmount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setEstimatedAmount(v);
                  }}
                  fullWidth
                  disabled={!canEdit || mutation.isPending}
                  inputProps={{ inputMode: "decimal" }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <AttachMoney sx={{ fontSize: 16, color: "text.secondary" }} />
                      </InputAdornment>
                    ),
                  }}
                  helperText="Customer-facing estimate (not final)"
                />
              </Grid>
            </Grid>
          </FieldSection>

          {/* ── Change Summary Preview ─────────────────────── */}
          {isDirty && changedFields.length > 0 && (
            <Paper
              elevation={0}
              sx={{
                p: 2, borderRadius: 2.5,
                border: "1.5px solid",
                borderColor: "warning.300",
                background: (t) => alpha(t.palette.warning.main, 0.05),
              }}
            >
              <Stack direction="row" alignItems="center" gap={1} mb={1}>
                <CheckCircle sx={{ fontSize: 16, color: "warning.main" }} />
                <Typography variant="caption" fontWeight={800} color="warning.dark"
                  sx={{ textTransform: "uppercase", letterSpacing: 0.7 }}>
                  Pending Changes
                </Typography>
              </Stack>
              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                {changedFields.map((f) => (
                  <Chip
                    key={f}
                    label={f}
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ fontWeight: 700, fontSize: 11 }}
                  />
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                A timeline entry will be created for each change.
              </Typography>
            </Paper>
          )}
        </Stack>
      </DialogContent>

      {/* ── Footer ───────────────────────────────────────── */}
      <Box
        sx={{
          p: 2,
          borderTop: "1px solid",
          borderColor: "divider",
          background: (t) => alpha(t.palette.background.paper, 0.97),
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            {!canEdit
              ? "Editing blocked for current status"
              : !isDirty
              ? "No changes made"
              : `${changedFields.length} field${changedFields.length !== 1 ? "s" : ""} modified`}
          </Typography>
          <Stack direction="row" gap={1}>
            <Button
              onClick={handleClose}
              variant="outlined"
              color="inherit"
              disabled={mutation.isPending}
              sx={{ borderRadius: 2 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="warning"
              disabled={!canEdit || !isDirty || mutation.isPending}
              onClick={() => mutation.mutate()}
              startIcon={
                mutation.isPending
                  ? <CircularProgress size={16} color="inherit" />
                  : <CheckCircle />
              }
              sx={{ borderRadius: 2, px: 3, fontWeight: 700 }}
            >
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Dialog>
  );
}
