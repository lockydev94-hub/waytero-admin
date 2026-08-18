// ============================================================
// WAYTERO ADMIN — ASSIGN DRIVER + VEHICLE MODAL (PREMIUM)
// Endpoint: POST /admin/bookings/{bookingId}/cab/{cabId}/assign-driver
// Shows: partner details → available drivers → available vehicles
//        (unavailable/busy drivers & vehicles are shown disabled, not hidden)
// Guards (backend): cab must be ASSIGNED, driver/vehicle must be APPROVED,
//                   vehicle must belong to assigned partner
// ============================================================
import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, CircularProgress, Stack, Avatar,
  Divider, Alert, Chip, Grid, Paper, Tooltip,
  LinearProgress, alpha,
} from "@mui/material";
import {
  DirectionsCar, Close, AssignmentInd, Person, Phone,
  CheckCircle, Block, AccessTime, LocalGasStation,
  AirlineSeatReclineNormal, Business, Badge, CalendarMonth,
  LocationOn, Info, EventSeat,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  bookingService,
  AssignableDriver,
  AssignableVehicle,
  PartnerDetail,
  CabBookingOut,
} from "../../../services/booking.service";

// ── Helpers ────────────────────────────────────────────────────

function availColor(status: string, isBusy: boolean) {
  if (isBusy) return "error";
  if (status === "ONLINE") return "success";
  if (status === "OFFLINE") return "default";
  if (status === "BREAK") return "warning";
  return "default";
}

function availLabel(status: string, isBusy: boolean) {
  if (isBusy) return "On Trip";
  return status.charAt(0) + status.slice(1).toLowerCase().replace("_", " ");
}

// ── Sub-components ─────────────────────────────────────────────

function PartnerCard({ partner }: { partner: PartnerDetail }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2.5,
        border: "1.5px solid",
        borderColor: "primary.200",
        background: (t) => alpha(t.palette.primary.main, 0.04),
      }}
    >
      <Stack direction="row" alignItems="center" gap={2}>
        <Avatar
          sx={{
            width: 48, height: 48,
            bgcolor: "primary.main",
            fontWeight: 700, fontSize: 18,
          }}
        >
          {partner.name.charAt(0)}
        </Avatar>
        <Box flex={1} minWidth={0}>
          <Typography fontWeight={700} variant="body1" noWrap>{partner.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {partner.partner_code} · {partner.city_name || `City #${partner.city_id}`}
          </Typography>
        </Box>
        <Chip label={partner.status} size="small" color="success" variant="outlined" />
      </Stack>
      <Stack direction="row" flexWrap="wrap" gap={2} mt={1.5}>
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Person sx={{ fontSize: 14, color: "text.secondary" }} />
          <Typography variant="caption" color="text.secondary">{partner.owner_name}</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Phone sx={{ fontSize: 14, color: "text.secondary" }} />
          <Typography variant="caption" color="text.secondary">{partner.mobile}</Typography>
        </Stack>
        {partner.email && (
          <Typography variant="caption" color="text.secondary">{partner.email}</Typography>
        )}
      </Stack>
    </Paper>
  );
}

function BookingSummaryCard({ cab }: { cab: CabBookingOut }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2.5,
        border: "1.5px solid",
        borderColor: "divider",
        background: (t) => alpha(t.palette.background.paper, 0.6),
      }}
    >
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.8 }}>
        Booking Summary
      </Typography>
      <Stack gap={1} mt={1}>
        <Stack direction="row" alignItems="flex-start" gap={1}>
          <LocationOn sx={{ fontSize: 16, color: "success.main", mt: 0.2 }} />
          <Box>
            <Typography variant="caption" color="text.secondary">Pickup</Typography>
            <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>{cab.pickup_location || "—"}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" alignItems="flex-start" gap={1}>
          <LocationOn sx={{ fontSize: 16, color: "error.main", mt: 0.2 }} />
          <Box>
            <Typography variant="caption" color="text.secondary">Drop</Typography>
            <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>{cab.drop_location || "—"}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" gap={3} mt={0.5}>
          <Box>
            <Typography variant="caption" color="text.secondary">Date & Time</Typography>
            <Typography variant="body2" fontWeight={600}>
              {cab.pickup_datetime
                ? new Date(cab.pickup_datetime).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                : "—"}
            </Typography>
          </Box>
          {cab.trip_type && (
            <Box>
              <Typography variant="caption" color="text.secondary">Trip Type</Typography>
              <Typography variant="body2" fontWeight={600}>{cab.trip_type}</Typography>
            </Box>
          )}
          {cab.vehicle_category_name && (
            <Box>
              <Typography variant="caption" color="text.secondary">Category</Typography>
              <Typography variant="body2" fontWeight={600}>{cab.vehicle_category_name}</Typography>
            </Box>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

function DriverCard({
  driver, selected, onSelect,
}: {
  driver: AssignableDriver; selected: boolean; onSelect: () => void;
}) {
  const disabled = driver.is_busy;
  return (
    <Tooltip
      title={disabled ? "This driver is currently on a trip" : ""}
      placement="top"
      arrow
    >
      <Paper
        onClick={disabled ? undefined : onSelect}
        elevation={0}
        sx={{
          p: 1.5,
          borderRadius: 2,
          border: "1.5px solid",
          borderColor: selected ? "secondary.main" : disabled ? "divider" : "divider",
          background: selected
            ? (t) => alpha(t.palette.secondary.main, 0.08)
            : disabled
            ? (t) => alpha(t.palette.action.disabledBackground, 0.4)
            : "background.paper",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          transition: "all 0.15s ease",
          "&:hover": !disabled ? {
            borderColor: "secondary.main",
            background: (t) => alpha(t.palette.secondary.main, 0.04),
            transform: "translateY(-1px)",
            boxShadow: 2,
          } : {},
        }}
      >
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Avatar
            sx={{
              bgcolor: selected ? "secondary.main" : "grey.100",
              color: selected ? "white" : "grey.600",
              width: 38, height: 38, fontWeight: 700,
            }}
          >
            {selected ? <CheckCircle fontSize="small" /> : <AssignmentInd fontSize="small" />}
          </Avatar>
          <Box flex={1} minWidth={0}>
            <Typography variant="body2" fontWeight={700} noWrap>{driver.name}</Typography>
            <Typography variant="caption" color="text.secondary">{driver.mobile}</Typography>
          </Box>
          <Stack alignItems="flex-end" gap={0.5}>
            <Chip
              label={availLabel(driver.availability_status, driver.is_busy)}
              color={availColor(driver.availability_status, driver.is_busy)}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
              {driver.license_number}
            </Typography>
          </Stack>
        </Stack>
        {driver.license_expiry_date && (
          <Stack direction="row" alignItems="center" gap={0.5} mt={0.8}>
            <Badge sx={{ fontSize: 11, color: "text.secondary" }} />
            <Typography variant="caption" color="text.secondary">
              License exp: {new Date(driver.license_expiry_date).toLocaleDateString("en-IN")}
            </Typography>
          </Stack>
        )}
      </Paper>
    </Tooltip>
  );
}

function VehicleCard({
  vehicle, selected, onSelect,
}: {
  vehicle: AssignableVehicle; selected: boolean; onSelect: () => void;
}) {
  const disabled = vehicle.is_busy;
  return (
    <Tooltip
      title={disabled ? "This vehicle is currently on a trip" : ""}
      placement="top"
      arrow
    >
      <Paper
        onClick={disabled ? undefined : onSelect}
        elevation={0}
        sx={{
          p: 1.5,
          borderRadius: 2,
          border: "1.5px solid",
          borderColor: selected ? "primary.main" : "divider",
          background: selected
            ? (t) => alpha(t.palette.primary.main, 0.07)
            : disabled
            ? (t) => alpha(t.palette.action.disabledBackground, 0.4)
            : "background.paper",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          transition: "all 0.15s ease",
          "&:hover": !disabled ? {
            borderColor: "primary.main",
            background: (t) => alpha(t.palette.primary.main, 0.04),
            transform: "translateY(-1px)",
            boxShadow: 2,
          } : {},
        }}
      >
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Avatar
            sx={{
              bgcolor: selected ? "primary.main" : "grey.100",
              color: selected ? "white" : "grey.600",
              width: 38, height: 38,
            }}
          >
            {selected ? <CheckCircle fontSize="small" /> : <DirectionsCar fontSize="small" />}
          </Avatar>
          <Box flex={1} minWidth={0}>
            <Typography variant="body2" fontWeight={700} noWrap>{vehicle.registration_number}</Typography>
            <Typography variant="caption" color="text.secondary">
              {[vehicle.make, vehicle.model, vehicle.manufacturing_year].filter(Boolean).join(" · ")}
            </Typography>
          </Box>
          <Stack alignItems="flex-end" gap={0.5}>
            <Chip
              label={vehicle.is_busy ? "On Trip" : vehicle.vehicle_category_name || "Vehicle"}
              color={vehicle.is_busy ? "error" : "default"}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
            />
            {vehicle.seating_capacity && (
              <Stack direction="row" alignItems="center" gap={0.3}>
                <EventSeat sx={{ fontSize: 10, color: "text.secondary" }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                  {vehicle.seating_capacity} seats
                </Typography>
              </Stack>
            )}
          </Stack>
        </Stack>
        {vehicle.fuel_type && (
          <Stack direction="row" alignItems="center" gap={0.5} mt={0.8}>
            <LocalGasStation sx={{ fontSize: 11, color: "text.secondary" }} />
            <Typography variant="caption" color="text.secondary">
              {vehicle.fuel_type}
            </Typography>
          </Stack>
        )}
      </Paper>
    </Tooltip>
  );
}

// ── Props ──────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: number;
  cabId: number;
  partnerId: number;
  vehicleCategoryId: number | null;
  cabBookingNumber: string;
  cab?: CabBookingOut | null;
}

// ── Main Modal ─────────────────────────────────────────────────

export default function AssignDriverModal({
  open, onClose, bookingId, cabId, partnerId,
  vehicleCategoryId, cabBookingNumber, cab,
}: Props) {
  const [driverId, setDriverId] = useState<number | null>(null);
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  // Reset on open/close
  useEffect(() => {
    if (!open) { setDriverId(null); setVehicleId(null); }
  }, [open]);

  const { data: partner, isLoading: loadingPartner } = useQuery<PartnerDetail>({
    queryKey: ["partner-detail", partnerId],
    queryFn: () => bookingService.getPartnerDetail(partnerId),
    enabled: open && !!partnerId,
  });

  const { data: drivers = [], isLoading: loadingDrivers } = useQuery<AssignableDriver[]>({
    queryKey: ["assignable-drivers", partnerId],
    queryFn: () => bookingService.getDrivers(partnerId),
    enabled: open && !!partnerId,
  });

  const { data: vehicles = [], isLoading: loadingVehicles } = useQuery<AssignableVehicle[]>({
    queryKey: ["assignable-vehicles", partnerId, vehicleCategoryId],
    queryFn: () => bookingService.getVehicles(partnerId, vehicleCategoryId || undefined),
    enabled: open && !!partnerId,
  });

  const mutation = useMutation({
    mutationFn: () =>
      bookingService.assignDriver(bookingId, cabId, driverId!, vehicleId!),
    onSuccess: () => {
      enqueueSnackbar("Driver & vehicle assigned successfully", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin-booking", bookingId] });
      onClose();
    },
    onError: (e: any) =>
      enqueueSnackbar(e?.response?.data?.detail || "Assignment failed", { variant: "error" }),
  });

  const isLoading = loadingPartner || loadingDrivers || loadingVehicles;
  const canAssign = !!driverId && !!vehicleId && !mutation.isPending;

  // Selected summaries
  const selectedDriver = drivers.find((d) => d.id === driverId);
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  const availableDrivers = drivers.filter((d) => !d.is_busy);
  const busyDrivers = drivers.filter((d) => d.is_busy);
  const availableVehicles = vehicles.filter((v) => !v.is_busy);
  const busyVehicles = vehicles.filter((v) => v.is_busy);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
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
      {/* Header */}
      <DialogTitle
        sx={{
          pb: 1.5,
          background: (t) => `linear-gradient(135deg, ${alpha(t.palette.secondary.main, 0.1)}, ${alpha(t.palette.primary.main, 0.06)})`,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Avatar sx={{ bgcolor: "secondary.main", width: 42, height: 42 }}>
              <AssignmentInd />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                Assign Driver & Vehicle
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                {cabBookingNumber}
              </Typography>
            </Box>
          </Stack>
          <Button
            size="small"
            onClick={onClose}
            sx={{ minWidth: 0, color: "text.secondary", p: 0.5 }}
          >
            <Close />
          </Button>
        </Stack>
        {isLoading && <LinearProgress sx={{ mt: 1.5, borderRadius: 1 }} color="secondary" />}
      </DialogTitle>

      {/* Body */}
      <DialogContent sx={{ p: 2.5, flex: 1, overflowY: "auto" }}>
        <Stack gap={2.5}>

          {/* Partner Details */}
          {partner && <PartnerCard partner={partner} />}

          {/* Booking Summary */}
          {cab && <BookingSummaryCard cab={cab} />}

          {/* Vehicle category filter note */}
          {vehicleCategoryId && (
            <Alert
              severity="info"
              icon={<Info fontSize="small" />}
              sx={{ borderRadius: 2, py: 0.5 }}
            >
              <Typography variant="caption">
                Vehicles are filtered to match booking category:{" "}
                <strong>{vehicles[0]?.vehicle_category_name || `Category #${vehicleCategoryId}`}</strong>
              </Typography>
            </Alert>
          )}

          {/* Drivers Section */}
          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.2}>
              <Typography variant="subtitle2" fontWeight={800} color="text.primary">
                Select Driver
              </Typography>
              <Stack direction="row" gap={0.8}>
                <Chip label={`${availableDrivers.length} Available`} size="small" color="success" variant="outlined" sx={{ height: 22, fontSize: 11 }} />
                {busyDrivers.length > 0 && (
                  <Chip label={`${busyDrivers.length} On Trip`} size="small" color="error" variant="outlined" sx={{ height: 22, fontSize: 11 }} />
                )}
              </Stack>
            </Stack>

            {!loadingDrivers && drivers.length === 0 && (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                No approved drivers found for this partner.
              </Alert>
            )}

            <Stack gap={1}>
              {/* Available drivers first */}
              {availableDrivers.map((d) => (
                <DriverCard
                  key={d.id}
                  driver={d}
                  selected={driverId === d.id}
                  onSelect={() => setDriverId(driverId === d.id ? null : d.id)}
                />
              ))}
              {/* Busy drivers shown but disabled */}
              {busyDrivers.map((d) => (
                <DriverCard key={d.id} driver={d} selected={false} onSelect={() => {}} />
              ))}
            </Stack>
          </Box>

          <Divider />

          {/* Vehicles Section */}
          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.2}>
              <Typography variant="subtitle2" fontWeight={800} color="text.primary">
                Select Vehicle
              </Typography>
              <Stack direction="row" gap={0.8}>
                <Chip label={`${availableVehicles.length} Available`} size="small" color="success" variant="outlined" sx={{ height: 22, fontSize: 11 }} />
                {busyVehicles.length > 0 && (
                  <Chip label={`${busyVehicles.length} On Trip`} size="small" color="error" variant="outlined" sx={{ height: 22, fontSize: 11 }} />
                )}
              </Stack>
            </Stack>

            {!loadingVehicles && vehicles.length === 0 && (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                No approved vehicles found for this partner{vehicleCategoryId ? " in the required category" : ""}.
              </Alert>
            )}

            <Stack gap={1}>
              {availableVehicles.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  selected={vehicleId === v.id}
                  onSelect={() => setVehicleId(vehicleId === v.id ? null : v.id)}
                />
              ))}
              {busyVehicles.map((v) => (
                <VehicleCard key={v.id} vehicle={v} selected={false} onSelect={() => {}} />
              ))}
            </Stack>
          </Box>

          {/* Assignment Preview */}
          {(selectedDriver || selectedVehicle) && (
            <Paper
              elevation={0}
              sx={{
                p: 2, borderRadius: 2.5,
                border: "1.5px solid",
                borderColor: "secondary.200",
                background: (t) => `linear-gradient(135deg, ${alpha(t.palette.secondary.main, 0.06)}, ${alpha(t.palette.primary.main, 0.04)})`,
              }}
            >
              <Typography variant="caption" fontWeight={800} color="secondary.main" sx={{ textTransform: "uppercase", letterSpacing: 0.8 }}>
                Assignment Preview
              </Typography>
              <Grid container spacing={2} mt={0.3}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Driver</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {selectedDriver ? selectedDriver.name : <span style={{ color: "#aaa" }}>Not selected</span>}
                  </Typography>
                  {selectedDriver && (
                    <Typography variant="caption" color="text.secondary">{selectedDriver.mobile}</Typography>
                  )}
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Vehicle</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {selectedVehicle ? selectedVehicle.registration_number : <span style={{ color: "#aaa" }}>Not selected</span>}
                  </Typography>
                  {selectedVehicle && (
                    <Typography variant="caption" color="text.secondary">
                      {[selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(" ")}
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </Paper>
          )}
        </Stack>
      </DialogContent>

      {/* Footer */}
      <Box
        sx={{
          p: 2,
          borderTop: "1px solid",
          borderColor: "divider",
          background: (t) => alpha(t.palette.background.paper, 0.95),
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            {!driverId && !vehicleId
              ? "Select a driver and vehicle to continue"
              : !driverId
              ? "Select a driver"
              : !vehicleId
              ? "Select a vehicle"
              : "Ready to assign"}
          </Typography>
          <Stack direction="row" gap={1}>
            <Button onClick={onClose} variant="outlined" color="inherit" sx={{ borderRadius: 2 }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="secondary"
              disabled={!canAssign}
              onClick={() => mutation.mutate()}
              startIcon={
                mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />
              }
              sx={{ borderRadius: 2, px: 3, fontWeight: 700 }}
            >
              {mutation.isPending ? "Assigning…" : "Confirm Assignment"}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Dialog>
  );
}
