// ============================================================
// WAYTERO ADMIN — ASSIGN PARTNER MODAL (Advanced)
// Multi-step: Select Partner → Preview Vehicles → Confirm
// Guards:
//   - Partner must have CAB service registered
//   - Partner must have ≥1 free vehicle matching booking category
//   - Vehicles on active trips are flagged/excluded
//   - Reassign warning when cab already assigned
// Endpoint: POST /admin/bookings/{bookingId}/cab/{cabId}/assign-partner
//           POST /admin/bookings/{bookingId}/cab/{cabId}/reassign
// ============================================================
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Alert, CircularProgress, Chip, Stack,
  Avatar, Divider, LinearProgress, TextField, InputAdornment,
  Radio, RadioGroup, FormControlLabel, Paper, Stepper, Step,
  StepLabel, Tooltip, Badge,
} from "@mui/material";
import {
  PersonAdd, Business, Close, Search, CheckCircle, Warning,
  DirectionsCar, ArrowForward, ArrowBack as ArrowBackIcon,
  SwapHoriz, InfoOutlined, Block,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { bookingService, AssignablePartner, AssignableVehicle } from "../../../services/booking.service";
import { alpha, useTheme } from "@mui/material/styles";

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: number;
  cabId: number;
  cabStatus: string;
  cityId: number;
  cabBookingNumber: string;
  vehicleCategoryId: number | null;
  vehicleCategoryName: string | null;
  tripType: string | null;
  /**
   * What this modal is being opened for. Defaults to "ASSIGN" when the cab is
   * PENDING_ASSIGNMENT; "REASSIGN" when already ASSIGNED/DRIVER_ASSIGNED;
   * "REASSIGN_PENDING" when the partner hasn't accepted yet (the previous
   * assignment gets auto-closed with reason ADMIN_REASSIGN).
   */
  context?: "ASSIGN" | "REASSIGN" | "REASSIGN_PENDING";
}

const STEPS = ["Select Partner", "Preview & Confirm"];

export default function AssignPartnerModal({
  open, onClose, bookingId, cabId, cabStatus,
  cityId, cabBookingNumber, vehicleCategoryId, vehicleCategoryName, tripType,
  context,
}: Props) {
  const theme = useTheme();
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [reasonText, setReasonText] = useState("");
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  // ── Mode detection ────────────────────────────────────────
  // Explicit `context` prop wins (so the parent can force a label even when
  // the status hasn't changed yet). Otherwise infer from cab status.
  const isReassign =
    context === "REASSIGN" || context === "REASSIGN_PENDING" ||
    (context === undefined && ["ASSIGNED", "DRIVER_ASSIGNED", "PENDING_PARTNER_ACCEPTANCE"].includes(cabStatus));
  const isPendingReassign = context === "REASSIGN_PENDING" || cabStatus === "PENDING_PARTNER_ACCEPTANCE";

  // Reset all state when modal opens fresh
  useEffect(() => {
    if (open) {
      setStep(0);
      setSearch("");
      setSelectedPartnerId(null);
      setReasonText("");
    }
  }, [open]);

  // Stable search handler to avoid re-render issues
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  // ── Load partners enriched with vehicle availability ──────
  const { data: partners = [], isLoading: partnersLoading } = useQuery<AssignablePartner[]>({
    queryKey: ["assignable-partners", cityId, vehicleCategoryId],
    queryFn: () => bookingService.getPartners(cityId, vehicleCategoryId),
    enabled: open,
    staleTime: 30_000,
  });

  // ── Load vehicles for selected partner ────────────────────
  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<AssignableVehicle[]>({
    queryKey: ["assignable-vehicles", selectedPartnerId, vehicleCategoryId],
    queryFn: () => bookingService.getVehicles(selectedPartnerId!, vehicleCategoryId ?? undefined),
    enabled: !!selectedPartnerId && step === 1,
    staleTime: 30_000,
  });

  // ── Mutations ─────────────────────────────────────────────
  const assignMutation = useMutation({
    mutationFn: () =>
      isReassign
        ? bookingService.reassignPartner(bookingId, cabId, selectedPartnerId!, reasonText || undefined)
        : bookingService.assignPartner(bookingId, cabId, selectedPartnerId!),
    onSuccess: () => {
      enqueueSnackbar(isReassign ? "Partner reassigned successfully" : "Partner assigned successfully", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin-booking", bookingId] });
      handleClose();
    },
    onError: (e: any) =>
      enqueueSnackbar(e?.response?.data?.detail || "Assignment failed", { variant: "error" }),
  });

  // ── Filtering ─────────────────────────────────────────────
  const filteredPartners = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter(
      (p) => p.name.toLowerCase().includes(q) || p.owner_name?.toLowerCase().includes(q) || p.mobile?.includes(q)
    );
  }, [partners, search]);

  const selectedPartner = partners.find((p) => p.id === selectedPartnerId) ?? null;

  const freeVehicles = vehicles.filter((v) => !v.is_busy);
  const busyVehicles = vehicles.filter((v) => v.is_busy);

  // ── Eligibility helpers ───────────────────────────────────
  const getPartnerStatus = (p: AssignablePartner): "eligible" | "no-cab-service" | "no-vehicles" | "all-busy" => {
    if (!p.has_cab_service) return "no-cab-service";
    if (p.total_vehicles === 0) return "no-vehicles";
    if (p.free_vehicles === 0) return "all-busy";
    return "eligible";
  };

  const STATUS_META = {
    eligible:        { color: "success.main", icon: <CheckCircle sx={{ fontSize: 15 }} />, label: "Available" },
    "no-cab-service":{ color: "error.main",   icon: <Block sx={{ fontSize: 15 }} />,       label: "No CAB Service" },
    "no-vehicles":   { color: "warning.main", icon: <DirectionsCar sx={{ fontSize: 15 }} />, label: "No Vehicles" },
    "all-busy":      { color: "warning.main", icon: <Warning sx={{ fontSize: 15 }} />,     label: "All Busy" },
  };

  const eligibleCount = partners.filter((p) => getPartnerStatus(p) === "eligible").length;

  // ── Handlers ──────────────────────────────────────────────
  const handleClose = () => {
    setStep(0);
    setSearch("");
    setSelectedPartnerId(null);
    setReasonText("");
    onClose();
  };

  const handleNext = () => {
    if (selectedPartnerId) setStep(1);
  };

  const handleBack = () => {
    setStep(0);
  };

  // ── Partner Card ──────────────────────────────────────────
  const PartnerCard = ({ p }: { p: AssignablePartner }) => {
    const pStatus = getPartnerStatus(p);
    const meta = STATUS_META[pStatus];
    const isSelected = selectedPartnerId === p.id;
    const isDisabled = pStatus !== "eligible";

    return (
      <Paper
        key={p.id}
        variant="outlined"
        onClick={() => !isDisabled && setSelectedPartnerId(p.id)}
        sx={{
          p: 2,
          borderRadius: 2,
          cursor: isDisabled ? "not-allowed" : "pointer",
          border: "1.5px solid",
          borderColor: isSelected ? "primary.main" : isDisabled ? "divider" : "divider",
          bgcolor: isSelected
            ? alpha(theme.palette.primary.main, 0.06)
            : isDisabled
            ? alpha(theme.palette.action.disabled, 0.04)
            : "background.paper",
          opacity: isDisabled ? 0.6 : 1,
          transition: "all 0.15s ease",
          "&:hover": !isDisabled ? {
            borderColor: "primary.light",
            bgcolor: alpha(theme.palette.primary.main, 0.04),
          } : {},
        }}
      >
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.5}>
          <Stack direction="row" alignItems="center" gap={1.5} flex={1} minWidth={0}>
            <Radio
              checked={isSelected}
              disabled={isDisabled}
              size="small"
              sx={{ p: 0, flexShrink: 0 }}
            />
            <Avatar sx={{ bgcolor: isSelected ? "primary.main" : "grey.100", color: isSelected ? "white" : "text.secondary", width: 36, height: 36, flexShrink: 0, fontSize: "0.9rem", fontWeight: 700 }}>
              {p.name?.[0]?.toUpperCase() || "P"}
            </Avatar>
            <Box minWidth={0}>
              <Typography variant="body2" fontWeight={700} noWrap>{p.name}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap>{p.owner_name} · {p.mobile}</Typography>
              <Stack direction="row" gap={0.75} mt={0.5} flexWrap="wrap">
                <Chip label={p.partner_type} size="small" variant="outlined" sx={{ height: 18, fontSize: "0.65rem" }} />
                {vehicleCategoryId && (
                  <Chip
                    label={`${p.free_vehicles}/${p.total_vehicles} free`}
                    size="small"
                    color={p.free_vehicles > 0 ? "success" : "warning"}
                    sx={{ height: 18, fontSize: "0.65rem" }}
                  />
                )}
              </Stack>
            </Box>
          </Stack>
          <Tooltip title={isDisabled ? `Cannot assign: ${meta.label}` : meta.label} arrow>
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ color: meta.color, flexShrink: 0 }}>
              {meta.icon}
              <Typography variant="caption" fontWeight={700} sx={{ color: meta.color, display: { xs: "none", sm: "block" } }}>
                {meta.label}
              </Typography>
            </Stack>
          </Tooltip>
        </Stack>
      </Paper>
    );
  };

  // ── Step 0: Partner Selection ─────────────────────────────
  const Step0 = () => (
    <Box>
      {/* Booking context */}
      <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2, mb: 2, bgcolor: alpha(theme.palette.info.main, 0.05), borderColor: "info.light" }}>
        <Stack direction="row" gap={2} flexWrap="wrap">
          <Box>
            <Typography variant="caption" color="text.secondary">Category Required</Typography>
            <Typography variant="body2" fontWeight={700}>{vehicleCategoryName || "Any"}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Trip Type</Typography>
            <Typography variant="body2" fontWeight={700}>{tripType || "—"}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Eligible Partners</Typography>
            <Typography variant="body2" fontWeight={700} color="success.main">{eligibleCount} available</Typography>
          </Box>
        </Stack>
      </Paper>

      {isPendingReassign && (
        <Alert severity="warning" icon={<SwapHoriz />} sx={{ mb: 2, borderRadius: 2 }}>
          <strong>Reassigning while pending acceptance:</strong> The current partner's request will be auto-declined (reason: ADMIN_REASSIGN) and the new partner will be asked to accept.
        </Alert>
      )}
      {isReassign && !isPendingReassign && (
        <Alert severity="warning" icon={<SwapHoriz />} sx={{ mb: 2, borderRadius: 2 }}>
          <strong>Reassignment:</strong> Existing driver assignment will be cleared. New driver must be assigned after.
        </Alert>
      )}

      {/* Search */}
      <TextField
        fullWidth
        size="small"
        placeholder="Search by name, owner, or mobile..."
        value={search}
        onChange={handleSearchChange}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: "text.secondary" }} /></InputAdornment> }}
        sx={{ mb: 1.5, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
      />

      {/* Legend */}
      <Stack direction="row" gap={1.5} mb={1.5} flexWrap="wrap">
        {Object.entries(STATUS_META).map(([key, m]) => (
          <Stack key={key} direction="row" alignItems="center" gap={0.4}>
            <Box sx={{ color: m.color, display: "flex" }}>{m.icon}</Box>
            <Typography variant="caption" color="text.secondary">{m.label}</Typography>
          </Stack>
        ))}
      </Stack>

      {/* Partner list */}
      {partnersLoading ? (
        <Box py={3}><LinearProgress /><Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={1}>Loading partners...</Typography></Box>
      ) : filteredPartners.length === 0 ? (
        <Box py={3} textAlign="center">
          <Business sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
          <Typography color="text.secondary">No approved partners found</Typography>
        </Box>
      ) : (
        <Stack gap={1} sx={{ maxHeight: 340, overflowY: "auto", pr: 0.5 }}>
          {/* Sort: eligible first */}
          {[...filteredPartners]
            .sort((a, b) => {
              const aE = getPartnerStatus(a) === "eligible" ? 0 : 1;
              const bE = getPartnerStatus(b) === "eligible" ? 0 : 1;
              return aE - bE;
            })
            .map((p) => <PartnerCard key={p.id} p={p} />)
          }
        </Stack>
      )}
    </Box>
  );

  // ── Step 1: Preview & Confirm ─────────────────────────────
  const Step1 = () => (
    <Box>
      {selectedPartner && (
        <>
          {/* Selected partner summary */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2.5, bgcolor: alpha(theme.palette.primary.main, 0.05), borderColor: "primary.light" }}>
            <Stack direction="row" alignItems="center" gap={2}>
              <Avatar sx={{ bgcolor: "primary.main", width: 44, height: 44, fontWeight: 700, fontSize: "1.1rem" }}>
                {selectedPartner.name?.[0]?.toUpperCase()}
              </Avatar>
              <Box flex={1}>
                <Typography variant="subtitle1" fontWeight={800}>{selectedPartner.name}</Typography>
                <Typography variant="caption" color="text.secondary">{selectedPartner.owner_name} · {selectedPartner.mobile}</Typography>
                <Stack direction="row" gap={1} mt={0.5}>
                  <Chip label={selectedPartner.partner_type} size="small" variant="outlined" sx={{ height: 20, fontSize: "0.65rem" }} />
                  <Chip label="CAB Service ✓" size="small" color="success" sx={{ height: 20, fontSize: "0.65rem" }} />
                </Stack>
              </Box>
              <CheckCircle sx={{ color: "success.main", fontSize: 28 }} />
            </Stack>
          </Paper>

          {/* Vehicles */}
          <Typography variant="subtitle2" fontWeight={700} mb={1}>
            Vehicles{vehicleCategoryName ? ` (${vehicleCategoryName})` : ""} — {freeVehicles.length} free, {busyVehicles.length} on trip
          </Typography>

          {vehiclesLoading ? (
            <Box py={2}><LinearProgress /><Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={1}>Checking vehicle availability...</Typography></Box>
          ) : vehicles.length === 0 ? (
            <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>
              No {vehicleCategoryName || ""} vehicles found for this partner. Assigning may fail if the category doesn't match.
            </Alert>
          ) : (
            <Stack gap={1} mb={2} sx={{ maxHeight: 200, overflowY: "auto" }}>
              {freeVehicles.map((v) => (
                <Paper key={v.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, borderColor: "success.light", bgcolor: alpha(theme.palette.success.main, 0.04) }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" gap={1}>
                      <DirectionsCar sx={{ color: "success.main", fontSize: 18 }} />
                      <Box>
                        <Typography variant="body2" fontWeight={700}>{v.registration_number}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {[v.vehicle_brand, v.vehicle_model].filter(Boolean).join(" ")}
                          {v.fuel_type ? ` · ${v.fuel_type}` : ""}
                          {v.seating_capacity ? ` · ${v.seating_capacity} seats` : ""}
                        </Typography>
                      </Box>
                    </Stack>
                    <Chip label="Available" size="small" color="success" sx={{ height: 20, fontSize: "0.65rem" }} />
                  </Stack>
                </Paper>
              ))}
              {busyVehicles.map((v) => (
                <Paper key={v.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, borderColor: "warning.light", bgcolor: alpha(theme.palette.warning.main, 0.04) }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" gap={1}>
                      <DirectionsCar sx={{ color: "warning.main", fontSize: 18 }} />
                      <Box>
                        <Typography variant="body2" fontWeight={700} color="text.secondary">{v.registration_number}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {[v.vehicle_brand, v.vehicle_model].filter(Boolean).join(" ")}
                        </Typography>
                      </Box>
                    </Stack>
                    <Chip label="On Trip" size="small" color="warning" sx={{ height: 20, fontSize: "0.65rem" }} />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}

          {freeVehicles.length === 0 && vehicles.length > 0 && (
            <Alert severity="warning" sx={{ borderRadius: 2, mb: 2 }}>
              All matching vehicles are currently on active trips. You may still assign this partner, but vehicle availability must be confirmed.
            </Alert>
          )}

          {/* Reassign reason */}
          {isReassign && (
            <TextField
              fullWidth
              size="small"
              label="Reason for Reassignment"
              placeholder="Briefly explain why you're reassigning..."
              multiline
              rows={2}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              sx={{ mb: 1.5, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            />
          )}

          {/* Final confirmation callout */}
          <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.05), borderColor: "info.light" }}>
            <Stack direction="row" gap={1} alignItems="flex-start">
              <InfoOutlined sx={{ color: "info.main", fontSize: 18, mt: 0.15 }} />
              <Typography variant="caption" color="text.secondary">
                {isPendingReassign
                  ? `Reassigning cab ${cabBookingNumber} to ${selectedPartner.name}. The previous partner's request will be auto-declined and the new partner will be asked to accept.`
                  : isReassign
                  ? `Reassigning cab ${cabBookingNumber} to ${selectedPartner.name}. Previous assignment will be cleared and driver must be re-assigned.`
                  : `Assigning cab ${cabBookingNumber} to ${selectedPartner.name}. The partner will be asked to accept within the configured timeout before you can assign a driver.`
                }
              </Typography>
            </Stack>
          </Paper>
        </>
      )}
    </Box>
  );

  const canProceedToStep1 = !!selectedPartnerId && getPartnerStatus(partners.find(p => p.id === selectedPartnerId)!) === "eligible";

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, maxHeight: "90vh" } }}
    >
      {/* Header */}
      <DialogTitle sx={{ pb: 1.5, pt: 2.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Avatar sx={{ bgcolor: isReassign ? "warning.main" : "primary.main", width: 38, height: 38 }}>
              {isReassign ? <SwapHoriz fontSize="small" /> : <PersonAdd fontSize="small" />}
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={800} lineHeight={1.2}>
                {isPendingReassign ? "Reassign (Pending Acceptance)" : isReassign ? "Reassign Partner" : "Assign Partner"}
              </Typography>
              <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                {cabBookingNumber}
              </Typography>
            </Box>
          </Stack>
          <Button size="small" onClick={handleClose} sx={{ minWidth: 0, p: 0.5, color: "text.secondary" }}>
            <Close fontSize="small" />
          </Button>
        </Stack>
      </DialogTitle>

      {/* Stepper */}
      <Box sx={{ px: 3, pb: 1 }}>
        <Stepper activeStep={step} alternativeLabel sx={{ "& .MuiStepLabel-label": { fontSize: "0.75rem", mt: 0.5 } }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>
      <Divider />

      {/* Content */}
      <DialogContent sx={{ pt: 2.5, pb: 1 }}>
        {step === 0 ? <Step0 /> : <Step1 />}
      </DialogContent>

      <Divider />

      {/* Actions */}
      <DialogActions sx={{ p: 2, gap: 1 }}>
        {step === 0 ? (
          <>
            <Button onClick={handleClose} variant="outlined" color="inherit" sx={{ borderRadius: 2 }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={!canProceedToStep1}
              onClick={handleNext}
              endIcon={<ArrowForward />}
              sx={{ borderRadius: 2 }}
            >
              Preview & Confirm
            </Button>
          </>
        ) : (
          <>
            <Button onClick={handleBack} variant="outlined" color="inherit" startIcon={<ArrowBackIcon />} sx={{ borderRadius: 2 }}>
              Back
            </Button>
            <Button
              variant="contained"
              color={isReassign ? "warning" : "primary"}
              disabled={assignMutation.isPending || (isReassign && !reasonText.trim())}
              onClick={() => assignMutation.mutate()}
              startIcon={assignMutation.isPending ? <CircularProgress size={16} color="inherit" /> : (isReassign ? <SwapHoriz /> : <PersonAdd />)}
              sx={{ borderRadius: 2 }}
            >
              {assignMutation.isPending
                ? "Processing..."
                : isReassign
                ? "Confirm Reassignment"
                : "Assign Partner"
              }
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
