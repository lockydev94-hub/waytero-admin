// ============================================================
// WAYTERO ADMIN — EDIT CAB DETAILS MODAL
// Endpoint: PUT /admin/customer-care/cab-booking/{cabBookingId}
// The amended trip is re-measured and re-priced by the server; this
// dialog sends places, trip type and category only — never a fare.
// Editable: pickup/drop location, trip type, vehicle category, reason
// Read-only: pickup/return time (use Reschedule), assignment, final amount
// Guards (backend): trip not started, no collected money, coupon not re-valued
// ============================================================
import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent,
  Button, TextField, MenuItem, Typography, Box,
  CircularProgress, Stack, Avatar, Divider, Alert,
  Chip, Grid, Paper, alpha, LinearProgress,
} from "@mui/material";
import {
  Edit, Close, LocationOn, LocalTaxi, DirectionsCar,
  CheckCircle, Info, Warning, EventRepeat,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  bookingService, CabBookingOut, VehicleCategoryOption,
} from "../../../services/booking.service";
import {
  customerCareService, CabBookingAmendPayload, CabBookingAmendResult,
} from "../../../services/customerCare.service";
import { apiErrorMessage } from "../../../utils/apiError";

// ── Constants ──────────────────────────────────────────────────

const TRIP_TYPES = [
  { value: "LOCAL",      label: "Local",             desc: "Within the city" },
  { value: "AIRPORT",    label: "Airport Transfer",  desc: "To/from airport" },
  { value: "OUTSTATION", label: "Outstation",        desc: "Multi-city trip" },
  { value: "ONE_WAY",    label: "One Way",           desc: "One-way intercity" },
  { value: "ROUND_TRIP", label: "Round Trip",        desc: "Return trip included" },
];

// The amendment endpoint re-quotes the trip and closes unaccepted offers, so it
// only accepts these two states. Once a partner has accepted, the job is a
// commitment: changes go through cancel / re-assign.
const EDITABLE_STATUSES = new Set(["PENDING_ASSIGNMENT", "PENDING_PARTNER_ACCEPTANCE"]);

// ── Status badge helper ────────────────────────────────────────

function statusColor(s: string): "warning" | "primary" | "info" | "error" | "default" {
  if (s === "PENDING_ASSIGNMENT") return "warning";
  if (s === "PENDING_PARTNER_ACCEPTANCE") return "info";
  if (s === "ASSIGNED" || s === "DRIVER_ASSIGNED") return "primary";
  if (s === "BREAKDOWN_REPORTED" || s === "AWAITING_SWAP") return "error";
  return "default";
}

// Decimal money arrives as JSON strings; coerce before formatting or math.
const num = (v: number | string | null | undefined): number => Number(v ?? 0);

const fmt = (v: number | string | null | undefined) =>
  `₹${num(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  /** The master booking's city; a super admin's amendment needs it. */
  cityId: number;
}

// ── Main Modal ─────────────────────────────────────────────────

export default function EditCabDetailsModal({ open, onClose, bookingId, cabId, cab, cityId }: Props) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  // ── Form state — initialised from current cab ──────────────
  const [pickupLocation, setPickupLocation]   = useState("");
  const [dropLocation, setDropLocation]       = useState("");
  const [tripType, setTripType]               = useState("");
  const [vehicleCategoryId, setVehicleCategoryId] = useState<number | "">("");
  const [reason, setReason]                   = useState("");
  const [result, setResult]                   = useState<CabBookingAmendResult | null>(null);

  // Populate on open
  useEffect(() => {
    if (open) {
      setPickupLocation(cab.pickup_location || "");
      setDropLocation(cab.drop_location || "");
      setTripType(cab.trip_type || "");
      setVehicleCategoryId(cab.vehicle_category_id ?? "");
      setReason("");
      setResult(null);
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
  const canEdit =
    EDITABLE_STATUSES.has(cab.booking_status) && !!cab.pickup_datetime;

  // ── Dirty detection ────────────────────────────────────────
  const isDirty =
    pickupLocation.trim() !== (cab.pickup_location || "") ||
    dropLocation.trim()   !== (cab.drop_location || "") ||
    tripType !== (cab.trip_type || "") ||
    vehicleCategoryId !== (cab.vehicle_category_id ?? "");

  // ── Changed field summary ─────────────────────────────────
  const changedFields: string[] = [];
  if (pickupLocation.trim() !== (cab.pickup_location || "")) changedFields.push("Pickup Location");
  if (dropLocation.trim()   !== (cab.drop_location || ""))   changedFields.push("Drop Location");
  if (tripType !== (cab.trip_type || "")) changedFields.push("Trip Type");
  if (vehicleCategoryId !== (cab.vehicle_category_id ?? "")) changedFields.push("Vehicle Category");

  // ── Mutation ───────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: () => {
      // An edited place no longer matches the pin it used to carry, so the old
      // coordinates are cleared rather than pointing the driver at the previous
      // address. Untouched places keep their pins.
      const pickupChanged = pickupLocation.trim() !== (cab.pickup_location || "");
      const dropChanged   = dropLocation.trim()   !== (cab.drop_location || "");

      const payload: CabBookingAmendPayload = {
        city_id: cityId,
        trip_type: tripType,
        vehicle_category_id: Number(vehicleCategoryId),
        pickup_location: pickupLocation.trim(),
        pickup_latitude:  pickupChanged ? null : cab.pickup_latitude ?? null,
        pickup_longitude: pickupChanged ? null : cab.pickup_longitude ?? null,
        drop_location: dropLocation.trim(),
        drop_latitude:  dropChanged ? null : cab.drop_latitude ?? null,
        drop_longitude: dropChanged ? null : cab.drop_longitude ?? null,
        pickup_datetime: cab.pickup_datetime as string,
        return_datetime: cab.return_datetime ?? null,
        reason: reason.trim() || undefined,
      };
      return customerCareService.amendCabBooking(cabId, payload);
    },
    onSuccess: (data) => {
      setResult(data);
      enqueueSnackbar(
        `Trip re-priced · ${fmt(data.old_amount)} → ${fmt(data.estimated_amount)}`,
        { variant: "success" },
      );
      qc.invalidateQueries({ queryKey: ["admin-booking", bookingId] });
      qc.invalidateQueries({ queryKey: ["cab-ops-queue"] });
    },
    onError: (e: any) =>
      enqueueSnackbar(apiErrorMessage(e, "Amendment failed"), { variant: "error" }),
  });

  const handleClose = () => { if (!mutation.isPending) onClose(); };
  const formLocked = !canEdit || mutation.isPending || !!result;
  const canSubmit =
    !formLocked && isDirty && !!tripType && vehicleCategoryId !== "";

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
                Amend Cab Trip
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

          {/* Guard alert when amending is blocked */}
          {!canEdit && (
            <Alert severity="error" icon={<Warning />} sx={{ borderRadius: 2 }}>
              <Typography variant="body2" fontWeight={600}>
                {!cab.pickup_datetime
                  ? "This trip has no pickup time on record"
                  : "Amendment not allowed at this stage"}
              </Typography>
              <Typography variant="caption">
                {!cab.pickup_datetime
                  ? "Set the pickup time with Reschedule first; the amended trip is priced on it."
                  : `A trip can be amended only while it is waiting for a partner — this one is ${cab.booking_status.replace(/_/g, " ")}. After a partner accepts, use cancel / re-assign; after the trip runs, use close-trip and add-charges.`}
              </Typography>
            </Alert>
          )}

          {/* What the server decides, and what is not editable here */}
          <Alert
            severity="info"
            icon={<Info fontSize="small" />}
            sx={{ borderRadius: 2, py: 0.75 }}
          >
            <Typography variant="caption">
              The amended trip is <strong>measured and priced by the server</strong> — no fare is
              typed here. <strong>Pickup/return time</strong> → use <em>Reschedule</em>.{" "}
              <strong>Assignment</strong> → use <em>Assign Driver</em>.
            </Typography>
          </Alert>

          {/* Amendment result */}
          {result && (
            <Paper
              elevation={0}
              sx={{
                p: 2.5, borderRadius: 2.5,
                border: "1.5px solid",
                borderColor: "success.main",
                background: (t) => alpha(t.palette.success.main, 0.05),
              }}
            >
              <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
                <CheckCircle sx={{ fontSize: 18, color: "success.main" }} />
                <Typography variant="body2" fontWeight={800} color="success.dark">
                  Trip amended and re-priced
                </Typography>
              </Stack>
              <Stack gap={0.75}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Old fare</Typography>
                  <Typography variant="caption" sx={{ textDecoration: "line-through" }}>
                    {fmt(result.old_amount)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">New fare</Typography>
                  <Typography variant="caption" fontWeight={800}>{fmt(result.estimated_amount)}</Typography>
                </Stack>
                {num(result.coupon_discount) > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">Coupon (kept as booked)</Typography>
                    <Typography variant="caption" fontWeight={700} color="warning.main">
                      − {fmt(result.coupon_discount)}
                    </Typography>
                  </Stack>
                )}
                <Divider sx={{ my: 0.5 }} />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" fontWeight={800}>Customer pays</Typography>
                  <Typography variant="body2" fontWeight={900} color="success.main">
                    {fmt(result.payable_amount)}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {num(result.distance_km).toLocaleString("en-IN", { maximumFractionDigits: 1 })} km ·{" "}
                  {result.distance_source.replace(/_/g, " ").toLowerCase()}
                </Typography>
              </Stack>
              {result.re_offered && (
                <Alert severity="warning" sx={{ mt: 1.5, borderRadius: 2 }}>
                  The open offers were for the old trip, so they were closed. The booking is back
                  in the assignment queue for a partner to be offered the amended fare.
                </Alert>
              )}
              {result.notes?.length > 0 && (
                <Alert severity="info" sx={{ mt: 1.5, borderRadius: 2 }}>
                  {result.notes.map((n, i) => (
                    <Typography key={i} variant="caption" display="block">{n}</Typography>
                  ))}
                </Alert>
              )}
            </Paper>
          )}

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
                required
                disabled={formLocked}
                placeholder="e.g. Bhubaneswar Airport, Odisha"
              />
              <TextField
                label="Drop Location"
                value={dropLocation}
                onChange={(e) => setDropLocation(e.target.value)}
                fullWidth
                multiline
                minRows={2}
                required
                disabled={formLocked}
                placeholder="e.g. Puri Beach, Odisha"
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
                  required
                  disabled={formLocked}
                >
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
                  required
                  disabled={formLocked || loadingCats}
                  helperText={loadingCats ? "Loading categories…" : undefined}
                >
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

          {/* ── Times on record ────────────────────────────── */}
          <FieldSection icon={<EventRepeat sx={{ fontSize: 16 }} />} label="Times on Record">
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Pickup"
                  value={cab.pickup_datetime
                    ? new Date(cab.pickup_datetime).toLocaleString("en-IN")
                    : "—"}
                  fullWidth
                  disabled
                  helperText="Moving the pickup → Reschedule"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Return"
                  value={cab.return_datetime
                    ? new Date(cab.return_datetime).toLocaleString("en-IN")
                    : "Not a return trip"}
                  fullWidth
                  disabled
                  helperText="Kept exactly as booked"
                />
              </Grid>
            </Grid>
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
              The amended trip is re-measured and re-priced on these times; changing them goes
              through Reschedule, before or after this amendment.
            </Typography>
          </FieldSection>

          <Divider />

          {/* ── Reason ─────────────────────────────────────── */}
          <FieldSection icon={<CheckCircle sx={{ fontSize: 16 }} />} label="Reason for Change">
            <TextField
              label="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              fullWidth
              multiline
              minRows={2}
              disabled={formLocked}
              placeholder="e.g. Customer changed the drop to the hotel gate"
              inputProps={{ maxLength: 500 }}
              helperText="Written to the booking audit trail next to the old and new fare."
            />
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
                Saving re-prices the trip on the server. If the new trip differs materially and no
                partner has accepted yet, the outstanding offers are closed and the booking is
                re-offered. A booked coupon is kept as-is — if it no longer covers the new fare,
                the amendment is refused.
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
            {result
              ? "Amendment saved — the timeline has the entry"
              : !canEdit
              ? "Amendment blocked for the current stage"
              : !isDirty
              ? "No changes made"
              : `${changedFields.length} field${changedFields.length !== 1 ? "s" : ""} modified`}
          </Typography>
          <Stack direction="row" gap={1}>
            {result ? (
              <Button
                variant="contained"
                color="success"
                onClick={onClose}
                startIcon={<CheckCircle />}
                sx={{ borderRadius: 2, px: 3, fontWeight: 700 }}
              >
                Done
              </Button>
            ) : (
              <>
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
                  disabled={!canSubmit}
                  onClick={() => mutation.mutate()}
                  startIcon={
                    mutation.isPending
                      ? <CircularProgress size={16} color="inherit" />
                      : <CheckCircle />
                  }
                  sx={{ borderRadius: 2, px: 3, fontWeight: 700 }}
                >
                  {mutation.isPending ? "Re-pricing…" : "Save Amendment"}
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </Box>
    </Dialog>
  );
}
