// ============================================================
// WAYTERO ADMIN — CAB BOOKING DETAIL PAGE
// Manages full lifecycle of a cab booking within a master booking
// Status flow: PENDING_ASSIGNMENT → ASSIGNED → DRIVER_ASSIGNED →
//              STARTED → COMPLETED → SETTLEMENT_PENDING → SETTLED
// Components: AssignPartnerModal, AssignDriverModal,
//             RescheduleModal, CancelBookingModal
// ============================================================
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Typography, Card, CardContent, Chip, Button, Stack,
  Grid, Avatar, Divider, Stepper, Step, StepLabel, StepConnector,
  Alert, CircularProgress, Paper, Table, TableBody,
  TableCell, TableRow, Tooltip, IconButton, Badge,
  useTheme, alpha, LinearProgress,
} from "@mui/material";
import {
  ArrowBack, DirectionsCar, PersonAdd, AssignmentInd, Edit,
  Schedule, AttachMoney, CheckCircle, Cancel, Timeline,
  LocationOn, AccessTime, SwapHoriz, Person,
  LocalTaxi, Payment, EventNote,
  Refresh, OpenInNew, AccountBalanceWallet, Block, DownloadOutlined,
  AccountBalance, TaskAlt, HourglassTop, Info,
} from "@mui/icons-material";
import { useCountdown } from "../../hooks/useCountdown";
import { useRealtime } from "../../hooks/useRealtime";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { bookingService, BookingDetail, CabBookingOut } from "../../services/booking.service";
import { format } from "date-fns";
import AssignPartnerModal from "./modals/AssignPartnerModal";
import AssignDriverModal from "./modals/AssignDriverModal";
import RescheduleModal from "./modals/RescheduleModal";
import CancelBookingModal from "./modals/CancelBookingModal";
import EditCabDetailsModal from "./modals/EditCabDetailsModal";
import CollectAdvanceModal from "./modals/CollectAdvanceModal";
import VoidAdvanceModal from "./modals/VoidAdvanceModal";
import { advanceService, AdvanceEligibility } from "../../services/advance.service";

// ── Cab Status Config ─────────────────────────────────────────
const CAB_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; step: number }> = {
  PENDING_ASSIGNMENT:         { label: "Pending Assignment",          color: "#F59E0B", bgColor: "#FEF3C7", step: 0 },
  PENDING_PARTNER_ACCEPTANCE: { label: "Awaiting Partner Acceptance", color: "#F59E0B", bgColor: "#FEF3C7", step: 1 },
  ASSIGNED:                   { label: "Partner Assigned",            color: "#3B82F6", bgColor: "#DBEAFE", step: 2 },
  DRIVER_ASSIGNED:            { label: "Driver Assigned",             color: "#8B5CF6", bgColor: "#EDE9FE", step: 3 },
  STARTED:                    { label: "Trip Started",                color: "#06B6D4", bgColor: "#CFFAFE", step: 4 },
  COMPLETED:                  { label: "Completed",                   color: "#22C55E", bgColor: "#DCFCE7", step: 5 },
  SETTLEMENT_PENDING:         { label: "Settlement Pending",          color: "#F97316", bgColor: "#FFEDD5", step: 6 },
  SETTLED:                    { label: "Settled",                     color: "#10B981", bgColor: "#D1FAE5", step: 7 },
  BREAKDOWN_REPORTED:         { label: "Vehicle Breakdown",           color: "#DC2626", bgColor: "#FEE2E2", step: 4 },
  AWAITING_SWAP:              { label: "Awaiting Replacement Vehicle", color: "#EA580C", bgColor: "#FFEDD5", step: 4 },
  CANCELLED:                  { label: "Cancelled",                   color: "#EF4444", bgColor: "#FEE2E2", step: -1 },
};

const CAB_STEPS = ["Pending", "Awaiting\nAcceptance", "Partner\nAssigned", "Driver\nAssigned", "Trip\nStarted", "Completed", "Settlement\nPending", "Settled"];

const BOOKING_STATUS_CONFIG: Record<string, { color: "default" | "primary" | "success" | "warning" | "error" | "info" | "secondary"; label: string }> = {
  DRAFT:           { color: "default", label: "Draft" },
  PENDING_PAYMENT: { color: "warning", label: "Pending Payment" },
  CONFIRMED:       { color: "primary", label: "Confirmed" },
  IN_PROGRESS:     { color: "info",    label: "In Progress" },
  COMPLETED:       { color: "success", label: "Completed" },
  CLOSED:          { color: "success", label: "Closed" },
  CANCELLED:       { color: "error",   label: "Cancelled" },
};

// ── Info Row ──────────────────────────────────────────────────
function InfoRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <TableRow sx={{ "&:last-child td": { border: 0 } }}>
      <TableCell sx={{ py: 1.25, pl: 0, color: "text.secondary", width: 160, fontWeight: 500, fontSize: "0.8125rem", border: 0 }}>
        <Stack direction="row" alignItems="center" gap={0.75}>{icon}{label}</Stack>
      </TableCell>
      <TableCell sx={{ py: 1.25, pr: 0, fontWeight: 600, fontSize: "0.875rem", border: 0 }}>{value || "—"}</TableCell>
    </TableRow>
  );
}

// ── Section Card ──────────────────────────────────────────────
function SectionCard({ title, icon, children, action }: { title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
      <CardContent sx={{ p: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" alignItems="center" gap={1}>
            {icon}
            <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
          </Stack>
          {action}
        </Stack>
        <Box sx={{ px: 2.5, py: 2 }}>{children}</Box>
      </CardContent>
    </Card>
  );
}

// ── Acceptance Countdown Chip ─────────────────────────────────
function AcceptanceCountdownChip({ deadline }: { deadline: string }) {
  const { minutes, seconds, expired } = useCountdown(deadline);
  const label = expired
    ? "Expired"
    : `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")} left`;
  return (
    <Chip
      icon={<HourglassTop sx={{ fontSize: 14 }} />}
      label={label}
      size="small"
      color={expired ? "error" : "warning"}
      sx={{ fontWeight: 700, fontFamily: "monospace" }}
    />
  );
}

// ── Main Component ────────────────────────────────────────────
export default function CabBookingDetailPage() {
  const { bookingId, cabId } = useParams<{ bookingId: string; cabId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const [modal, setModal] = useState<"assign-partner" | "assign-driver" | "reschedule" | "cancel" | "edit-cab" | "collect-advance" | "void-advance" | null>(null);

  const bId = Number(bookingId);
  const cId = Number(cabId);

  const { data: booking, isLoading, isError, refetch } = useQuery<BookingDetail>({
    queryKey: ["admin-booking", bId],
    queryFn: () => bookingService.get(bId),
    enabled: !!bId,
    // Poll every 15s (replaces the previous WebSocket refetch) so admin sees
    // partner accept/reject or sweeper-timeout updates without manual refresh.
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  // ── Realtime: instant refresh when this booking's status changes anywhere ──
  const { subscribe } = useRealtime();
  useEffect(() => {
    const unsub = subscribe<{ master_booking_id: number }>(
      "BOOKING_UPDATED",
      (msg) => {
        if (Number(msg.data.master_booking_id) === bId) refetch();
      }
    );
    return unsub;
  }, [subscribe, refetch, bId]);

  // Advance eligibility — keyed on cab booking number derived from the booking data.
  // Placed AFTER the booking query so `booking` is in scope (no TDZ crash).
  const cabBookingNumber = booking?.cab_bookings.find(c => c.id === cId)?.booking_number;
  const { data: advElig } = useQuery<AdvanceEligibility>({
    queryKey: ["advance-eligibility", cabBookingNumber],
    queryFn: () =>
      cabBookingNumber
        ? advanceService.getEligibility(cabBookingNumber)
        : Promise.reject(new Error("No booking number")),
    enabled: !!cabBookingNumber,
  });

  if (isLoading) return (
    <Box display="flex" alignItems="center" justifyContent="center" minHeight="60vh" flexDirection="column" gap={2}>
      <CircularProgress size={40} />
      <Typography color="text.secondary">Loading booking details...</Typography>
    </Box>
  );

  if (isError || !booking) return (
    <Box p={4}><Alert severity="error">Failed to load booking. <Button onClick={() => refetch()}>Retry</Button></Alert></Box>
  );

  const cab = booking.cab_bookings.find((c) => c.id === cId);
  if (!cab) return (
    <Box p={4}><Alert severity="warning">Cab booking not found in this master booking.</Alert></Box>
  );

  const statusCfg = CAB_STATUS_CONFIG[cab.booking_status] || {
    label: cab.booking_status.replace(/_/g, " "),
    color: "#6B7280",
    bgColor: "#F3F4F6",
    step: -2,
  };
  const currentStep = statusCfg.step;
  const isCancelled = cab.booking_status === "CANCELLED";

  // Action availability guards
  const canAssignPartner  = ["PENDING_ASSIGNMENT"].includes(cab.booking_status);
  // PENDING_PARTNER_ACCEPTANCE was added in migration 0039 — admin can still
  // reassign while the partner is deciding; the previous pending request is
  // auto-closed with reason ADMIN_REASSIGN.
  const canReassignPartner= ["PENDING_PARTNER_ACCEPTANCE", "ASSIGNED", "DRIVER_ASSIGNED"].includes(cab.booking_status);
  const canAssignDriver   = cab.booking_status === "ASSIGNED";
  const canReschedule     = !["STARTED", "COMPLETED", "SETTLEMENT_PENDING", "SETTLED", "CANCELLED"].includes(cab.booking_status);
  const canCancel         = !["IN_PROGRESS", "COMPLETED", "CLOSED", "CANCELLED"].includes(booking.booking_status);
  const canEditCabDetails = ["PENDING_ASSIGNMENT", "ASSIGNED", "DRIVER_ASSIGNED"].includes(cab.booking_status);
  const canGoToSettle     = ["COMPLETED", "SETTLEMENT_PENDING"].includes(cab.booking_status) && !isCancelled;
  const isSettled         = cab.booking_status === "SETTLED";
  // Advance: show button when booking is in a collectable status
  const COLLECTABLE_STATUSES = ["PENDING_ASSIGNMENT", "ASSIGNED", "DRIVER_ASSIGNED", "STARTED"];
  const canManageAdvance = COLLECTABLE_STATUSES.includes(cab.booking_status) && !isCancelled;
  const hasActiveAdvance = !!advElig?.advance;
  const isAwaitingAcceptance = cab.booking_status === "PENDING_PARTNER_ACCEPTANCE";

  const bStatusCfg = BOOKING_STATUS_CONFIG[booking.booking_status];

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      {/* ── Header ── */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <IconButton onClick={() => navigate("/bookings")} sx={{ border: "1px solid", borderColor: "divider" }}>
            <ArrowBack />
          </IconButton>
          <Box>
            <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
              <Typography variant="h5" fontWeight={800}>Cab Booking Detail</Typography>
              <Chip label={booking.booking_number} variant="outlined" size="small" sx={{ fontFamily: "monospace", fontWeight: 700 }} />
              <Chip label={bStatusCfg?.label || booking.booking_status} color={bStatusCfg?.color || "default"} size="small" />
            </Stack>
            <Typography variant="body2" color="text.secondary" mt={0.25}>
              Cab: {cab.booking_number} · {cab.trip_type} · {booking.customer_name}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" gap={1}>
          <Tooltip title="Refresh"><IconButton onClick={() => refetch()} size="small"><Refresh /></IconButton></Tooltip>
          {canCancel && (
            <Button variant="outlined" color="error" size="small" startIcon={<Cancel />} onClick={() => setModal("cancel")}>
              Cancel Booking
            </Button>
          )}
          {canGoToSettle && (
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<AccountBalance />}
              onClick={() => navigate("/settlements")}
              sx={{ fontWeight: 700 }}
            >
              Go to Settlements
            </Button>
          )}
          {isSettled && (
            <Chip
              icon={<TaskAlt sx={{ fontSize: 16 }} />}
              label="Settled"
              color="success"
              sx={{ fontWeight: 700 }}
            />
          )}
        </Stack>
      </Stack>

      {isCancelled && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          This cab booking has been cancelled.
        </Alert>
      )}

      {cab.booking_status === "SETTLEMENT_PENDING" && (
        <Alert
          severity="warning"
          sx={{ mb: 3, borderRadius: 2, fontWeight: 600 }}
          action={
            <Button color="warning" size="small" variant="contained" startIcon={<AccountBalance />} onClick={() => navigate("/settlements")} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
              Settle Now
            </Button>
          }
        >
          This booking is <strong>pending settlement</strong>. Head to the Settlements page to process the partner payout and commission deduction.
        </Alert>
      )}

      {isSettled && (
        <Alert severity="success" sx={{ mb: 3, borderRadius: 2, fontWeight: 600 }}>
          This booking has been <strong>settled</strong>. Commission deducted and partner payout processed.
        </Alert>
      )}

      {/* ── Awaiting Partner Acceptance (Doc Ref: BRD Part 3 §42) ── */}
      {isAwaitingAcceptance && cab.acceptance_deadline && (
        <Alert
          severity="warning"
          icon={<HourglassTop sx={{ fontSize: 22 }} />}
          sx={{ mb: 3, borderRadius: 2, alignItems: "center" }}
          action={
            <Stack direction="row" gap={1}>
              <Button
                color="warning"
                size="small"
                variant="outlined"
                startIcon={<SwapHoriz />}
                onClick={() => setModal("assign-partner")}
                sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
              >
                Reassign Partner
              </Button>
            </Stack>
          }
        >
          <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
            <Box>
              <Typography variant="body2" fontWeight={700}>
                Awaiting <strong style={{ color: "#F59E0B" }}>{cab.assigned_partner_name || "partner"}</strong> to accept this booking.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Partner must accept before a driver can be assigned. Auto-reverts to Pending Assignment if no response.
              </Typography>
            </Box>
            <AcceptanceCountdownChip deadline={cab.acceptance_deadline} />
          </Stack>
        </Alert>
      )}

      {/* ── Status Stepper ── */}
      {!isCancelled && (
        <Card sx={{ borderRadius: 3, mb: 3, border: "1px solid", borderColor: "divider", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <CardContent sx={{ py: 3 }}>
            <Stack direction="row" alignItems="center" gap={1} mb={2.5}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: statusCfg.color }} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: statusCfg.color }}>
                {statusCfg.label}
              </Typography>
            </Stack>
            <Stepper activeStep={currentStep} alternativeLabel sx={{ "& .MuiStepLabel-label": { fontSize: "0.7rem", mt: 0.5 } }}>
              {CAB_STEPS.map((label, i) => (
                <Step key={i} completed={i < currentStep}>
                  <StepLabel
                    sx={{
                      "& .MuiStepLabel-label": { color: i <= currentStep ? "text.primary" : "text.disabled", fontWeight: i === currentStep ? 700 : 400 },
                    }}
                  >
                    {label}
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          </CardContent>
        </Card>
      )}

      {/* ── Lifecycle guide ── */}
      <Alert
        severity="info"
        variant="outlined"
        icon={<Info sx={{ fontSize: 18 }} />}
        sx={{ mb: 3, borderRadius: 2, alignItems: "flex-start", "& .MuiAlert-message": { width: "100%" } }}
      >
        <Typography variant="caption" fontWeight={700} color="info.main" display="block" mb={0.5}>
          CAB LIFECYCLE — WHAT HAPPENS NEXT
        </Typography>
        <Stack spacing={0.5}>
          {[
            ["1 · Assign partner", "Pick an approved partner. They get a push to accept within the deadline — no accept, the cab reverts to Pending Assignment."],
            ["2 · Assign driver + vehicle", "Once the partner accepts, set the driver and vehicle for the trip."],
            ["3 · Start & close trip", "The partner starts the trip (start KM) and closes it (end KM) — closing computes the final amount, commission, payout and GST."],
            ["4 · Collect payment", "Payment is taken by the partner (app) or by you on the Trip Assistance console. This records the mode and generates the tax invoice."],
            ["5 · Settle", "Head to Settlements → settle the cab. The partner wallet is credited net of TDS/commission, coupon is disbursed, and the booking is CLOSED."],
            ["6 · Breakdown / swap", "Mid-trip breakdowns put the cab in Vehicle Breakdown / Awaiting Replacement. Use Trip Assistance to swap the vehicle and continue."],
          ].map(([k, v]) => (
            <Stack key={k} direction="row" gap={1} alignItems="flex-start">
              <Typography variant="caption" fontWeight={700} sx={{ whiteSpace: "nowrap", color: "info.main", minWidth: 128 }}>
                {k}
              </Typography>
              <Typography variant="caption" color="text.secondary">{v}</Typography>
            </Stack>
          ))}
        </Stack>
      </Alert>

      <Grid container spacing={3}>
        {/* ── Left Column ── */}
        <Grid item xs={12} lg={8}>
          <Stack gap={3}>
            {/* ── Trip Details ── */}
            <SectionCard
              title="Trip Details"
              icon={<DirectionsCar sx={{ color: "primary.main" }} />}
              action={
                canEditCabDetails && !isCancelled ? (
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    startIcon={<Edit />}
                    onClick={() => setModal("edit-cab")}
                    sx={{ borderRadius: 2, fontWeight: 700 }}
                  >
                    Edit Details
                  </Button>
                ) : undefined
              }
            >
              <Table size="small">
                <TableBody>
                  <InfoRow label="Trip Type" value={<Chip label={cab.trip_type || "—"} size="small" variant="outlined" />} icon={<LocalTaxi sx={{ fontSize: 14 }} />} />
                  <InfoRow label="Category" value={cab.vehicle_category_name} icon={<DirectionsCar sx={{ fontSize: 14 }} />} />
                  <InfoRow label="Pickup" value={cab.pickup_location} icon={<LocationOn sx={{ fontSize: 14 }} />} />
                  <InfoRow label="Drop" value={cab.drop_location} icon={<LocationOn sx={{ fontSize: 14 }} />} />
                  <InfoRow
                    label="Pickup Time"
                    value={cab.pickup_datetime ? format(new Date(cab.pickup_datetime), "dd MMM yyyy, hh:mm a") : null}
                    icon={<AccessTime sx={{ fontSize: 14 }} />}
                  />
                  <InfoRow label="Est. Distance" value={cab.estimated_distance ? `${cab.estimated_distance} km` : null} icon={<Schedule sx={{ fontSize: 14 }} />} />
                  <InfoRow label="Est. Amount" value={cab.estimated_amount ? `₹${cab.estimated_amount.toLocaleString()}` : null} icon={<AttachMoney sx={{ fontSize: 14 }} />} />
                  <InfoRow
                    label="Final Amount"
                    value={cab.final_amount ? (
                      <Typography variant="body2" fontWeight={700} color="success.main">₹{cab.final_amount.toLocaleString()}</Typography>
                    ) : <Typography variant="body2" color="text.disabled">Not set</Typography>}
                    icon={<Payment sx={{ fontSize: 14 }} />}
                  />
                </TableBody>
              </Table>
            </SectionCard>

            {/* ── Assignment ── */}
            <SectionCard
              title="Assignment"
              icon={<AssignmentInd sx={{ color: "secondary.main" }} />}
            >
              <Grid container spacing={2} mb={2}>
                <Grid item xs={12} sm={4}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: "center" }}>
                    <Avatar sx={{ bgcolor: "primary.50", color: "primary.main", mx: "auto", mb: 1 }}>
                      <PersonAdd />
                    </Avatar>
                    <Typography variant="caption" color="text.secondary" display="block">Partner</Typography>
                    <Typography variant="body2" fontWeight={700}>{cab.assigned_partner_name || "Not Assigned"}</Typography>
                    {cab.assigned_partner_id && (
                      <Typography variant="caption" color="text.secondary">ID #{cab.assigned_partner_id}</Typography>
                    )}
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: "center" }}>
                    <Avatar sx={{ bgcolor: "secondary.50", color: "secondary.main", mx: "auto", mb: 1 }}>
                      <Person />
                    </Avatar>
                    <Typography variant="caption" color="text.secondary" display="block">Driver</Typography>
                    <Typography variant="body2" fontWeight={700}>{cab.assigned_driver_name || "Not Assigned"}</Typography>
                    {cab.assigned_driver_mobile && (
                      <Typography variant="caption" color="text.secondary">{cab.assigned_driver_mobile}</Typography>
                    )}
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: "center" }}>
                    <Avatar sx={{ bgcolor: "success.50", color: "success.main", mx: "auto", mb: 1 }}>
                      <DirectionsCar />
                    </Avatar>
                    <Typography variant="caption" color="text.secondary" display="block">Vehicle</Typography>
                    <Typography variant="body2" fontWeight={700}>{cab.assigned_vehicle_reg || "Not Assigned"}</Typography>
                    {cab.assigned_vehicle_id && (
                      <Typography variant="caption" color="text.secondary">ID #{cab.assigned_vehicle_id}</Typography>
                    )}
                  </Paper>
                </Grid>
              </Grid>

              {/* Assignment Action Buttons */}
              {!isCancelled && (
                <Stack direction="row" flexWrap="wrap" gap={1} mt={1}>
                  {canAssignPartner && (
                    <Button variant="contained" size="small" startIcon={<PersonAdd />} onClick={() => setModal("assign-partner")}>
                      Assign Partner
                    </Button>
                  )}
                  {canReassignPartner && (
                    <Button variant="outlined" color="warning" size="small" startIcon={<SwapHoriz />} onClick={() => setModal("assign-partner")}>
                      Reassign Partner
                    </Button>
                  )}
                  {canAssignDriver && (
                    <Button variant="contained" color="secondary" size="small" startIcon={<AssignmentInd />} onClick={() => setModal("assign-driver")}>
                      Assign Driver & Vehicle
                    </Button>
                  )}
                  {canReschedule && (
                    <Button variant="outlined" color="warning" size="small" startIcon={<Schedule />} onClick={() => setModal("reschedule")}>
                      Reschedule
                    </Button>
                  )}
                </Stack>
              )}
            </SectionCard>


            {/* ── Advance Payment ── */}
            {canManageAdvance && (
              <SectionCard
                title="Advance Payment"
                icon={<AccountBalanceWallet sx={{ color: "warning.main" }} />}
                action={
                  hasActiveAdvance ? (
                    <Stack direction="row" gap={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        startIcon={<DownloadOutlined fontSize="small" />}
                        onClick={async () => {
                          const cab = booking.cab_bookings.find(c => c.id === cId);
                          if (!cab) return;
                          const blob = await advanceService.downloadReceipt(cab.booking_number);
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `Advance_${cab.booking_number}.pdf`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        sx={{ borderRadius: 2 }}
                      >
                        Receipt
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<Block fontSize="small" />}
                        onClick={() => setModal("void-advance")}
                        sx={{ borderRadius: 2 }}
                      >
                        Void
                      </Button>
                    </Stack>
                  ) : (
                    <Button
                      size="small"
                      variant="contained"
                      color="warning"
                      startIcon={<AccountBalanceWallet fontSize="small" />}
                      onClick={() => setModal("collect-advance")}
                      sx={{ borderRadius: 2, fontWeight: 700 }}
                    >
                      Collect Advance
                    </Button>
                  )
                }
              >
                {hasActiveAdvance && advElig?.advance ? (
                  <Stack gap={1.5}>
                    <Paper
                      variant="outlined"
                      sx={{ p: 2, borderRadius: 2, bgcolor: "success.50", border: "1px solid", borderColor: "success.200" }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="caption" color="success.dark">Advance Collected</Typography>
                          <Typography variant="h5" fontWeight={800} color="success.dark">
                            ₹{advElig.advance.amount?.toLocaleString("en-IN")}
                          </Typography>
                        </Box>
                        <Chip label="ACTIVE" color="success" size="small" />
                      </Stack>
                    </Paper>
                    <Table size="small">
                      <TableBody>
                        <InfoRow
                          label="Receipt"
                          value={<Typography variant="body2" fontFamily="monospace" fontWeight={700}>{advElig.advance.receipt_number}</Typography>}
                          icon={<AttachMoney sx={{ fontSize: 14 }} />}
                        />
                        <InfoRow label="Payment Mode" value={advElig.advance.payment_mode} icon={<Payment sx={{ fontSize: 14 }} />} />
                        <InfoRow label="Received By" value={advElig.advance.received_by} icon={<Person sx={{ fontSize: 14 }} />} />
                        {advElig.advance.reference_note && (
                          <InfoRow label="Reference" value={advElig.advance.reference_note} icon={<EventNote sx={{ fontSize: 14 }} />} />
                        )}
                        <InfoRow
                          label="Collected At"
                          value={advElig.advance.collected_at ? format(new Date(advElig.advance.collected_at), "dd MMM yyyy, hh:mm a") : null}
                          icon={<AccessTime sx={{ fontSize: 14 }} />}
                        />
                        <InfoRow
                          label="Balance Due"
                          value={
                            <Typography variant="body2" fontWeight={700} color="error.main">
                              ₹{Math.max(0, (advElig.max_amount ?? 0) - advElig.advance.amount).toLocaleString("en-IN")}
                            </Typography>
                          }
                          icon={<AccountBalanceWallet sx={{ fontSize: 14 }} />}
                        />
                      </TableBody>
                    </Table>
                  </Stack>
                ) : (
                  <Box sx={{ py: 3, textAlign: "center" }}>
                    <AccountBalanceWallet sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                    <Typography variant="body2" color="text.secondary" fontWeight={600}>No advance collected yet</Typography>
                    <Typography variant="caption" color="text.disabled">
                      {advElig?.blocked_reason || "Click Collect Advance to record a customer advance payment."}
                    </Typography>
                  </Box>
                )}
              </SectionCard>
            )}

          </Stack>
        </Grid>

        {/* ── Right Column ── */}
        <Grid item xs={12} lg={4}>
          <Stack gap={3}>
            {/* ── Customer Info ── */}
            <SectionCard title="Customer" icon={<Person sx={{ color: "primary.main" }} />}>
              <Stack alignItems="center" textAlign="center" py={1}>
                <Avatar sx={{ width: 52, height: 52, bgcolor: "primary.main", fontSize: "1.25rem", mb: 1.5, fontWeight: 700 }}>
                  {booking.customer_name?.[0]?.toUpperCase() || "C"}
                </Avatar>
                <Typography variant="subtitle1" fontWeight={700}>{booking.customer_name}</Typography>
                <Typography variant="body2" color="text.secondary">{booking.customer_mobile}</Typography>
                {booking.customer_email && (
                  <Typography variant="caption" color="text.secondary">{booking.customer_email}</Typography>
                )}
              </Stack>
              <Divider sx={{ my: 1.5 }} />
              <Table size="small">
                <TableBody>
                  <InfoRow label="City" value={booking.city_name} icon={<LocationOn sx={{ fontSize: 14 }} />} />
                  <InfoRow
                    label="Journey"
                    value={booking.journey_start_date ? `${booking.journey_start_date}${booking.journey_end_date ? ` → ${booking.journey_end_date}` : ""}` : null}
                    icon={<EventNote sx={{ fontSize: 14 }} />}
                  />
                </TableBody>
              </Table>
            </SectionCard>

            {/* ── Payment ── */}
            <SectionCard title="Payment" icon={<Payment sx={{ color: "success.main" }} />}>
              <Stack gap={1.5}>
                <Box sx={{ p: 2, bgcolor: "success.50", borderRadius: 2, border: "1px solid", borderColor: "success.200" }}>
                  <Typography variant="caption" color="success.dark">Total Amount</Typography>
                  <Typography variant="h5" fontWeight={800} color="success.dark">
                    ₹{booking.total_amount.toLocaleString()}
                  </Typography>
                </Box>
                <Table size="small">
                  <TableBody>
                    <InfoRow label="Paid" value={<Typography variant="body2" fontWeight={700} color="success.main">₹{booking.total_paid_amount.toLocaleString()}</Typography>} icon={<CheckCircle sx={{ fontSize: 14 }} />} />
                    <InfoRow label="Refund" value={booking.total_refund_amount > 0 ? `₹${booking.total_refund_amount.toLocaleString()}` : "—"} icon={<AttachMoney sx={{ fontSize: 14 }} />} />
                    <InfoRow label="Pay Status" value={<Chip label={booking.payment_status} size="small" color={booking.payment_status === "PAID" ? "success" : "warning"} />} icon={<Payment sx={{ fontSize: 14 }} />} />
                  </TableBody>
                </Table>
                {cab.invoice_number && (
                  <Box sx={{ pt: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadOutlined />}
                      onClick={() => bookingService.cabDownloadInvoice(
                        booking.id,
                        cab.id,
                        cab.invoice_number!,
                      )}
                    >
                      Download Invoice (PDF)
                    </Button>
                  </Box>
                )}
              </Stack>
            </SectionCard>

            {/* ── Timeline ── */}
            <SectionCard title="Activity Timeline" icon={<Timeline sx={{ color: "info.main" }} />}>
              <Stack gap={0}>
                {booking.timeline.length === 0 && (
                  <Typography variant="body2" color="text.disabled" textAlign="center" py={2}>No timeline events yet</Typography>
                )}
                {booking.timeline.slice(0, 8).map((t, i) => (
                  <Box key={t.id} sx={{ display: "flex", gap: 1.5, py: 1.25, borderBottom: i < Math.min(booking.timeline.length, 8) - 1 ? "1px solid" : "none", borderColor: "divider" }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "primary.main", mt: 0.75, flexShrink: 0 }} />
                    <Box flex={1}>
                      <Typography variant="caption" fontWeight={700} color="primary.main" display="block">{t.event_type.replace(/_/g, " ")}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.4 }}>{t.event_description}</Typography>
                      <Typography variant="caption" color="text.disabled" display="block" mt={0.25}>
                        {format(new Date(t.event_timestamp), "dd MMM yyyy, hh:mm a")}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>

      {/* ── Modals ── */}
      <AssignPartnerModal
        open={modal === "assign-partner"}
        onClose={() => setModal(null)}
        bookingId={bId}
        cabId={cId}
        cabStatus={cab.booking_status}
        cityId={booking.city_id}
        cabBookingNumber={cab.booking_number}
        vehicleCategoryId={cab.vehicle_category_id}
        vehicleCategoryName={cab.vehicle_category_name}
        tripType={cab.trip_type}
        context={isAwaitingAcceptance ? "REASSIGN_PENDING" : canReassignPartner ? "REASSIGN" : "ASSIGN"}
      />
      <AssignDriverModal
        open={modal === "assign-driver"}
        onClose={() => setModal(null)}
        bookingId={bId}
        cabId={cId}
        partnerId={cab.assigned_partner_id || 0}
        vehicleCategoryId={cab.vehicle_category_id}
        cabBookingNumber={cab.booking_number}
        cab={cab}
      />
      <RescheduleModal
        open={modal === "reschedule"}
        onClose={() => setModal(null)}
        bookingId={bId}
        cabId={cId}
        currentPickup={cab.pickup_datetime}
        cabBookingNumber={cab.booking_number}
      />

      <EditCabDetailsModal
        open={modal === "edit-cab"}
        onClose={() => setModal(null)}
        bookingId={bId}
        cabId={cId}
        cab={cab}
      />
      {/* Advance modals */}
      {(() => {
        const cab_ = booking.cab_bookings.find(c => c.id === cId);
        return cab_ ? (
          <>
            <CollectAdvanceModal
              open={modal === "collect-advance"}
              onClose={() => setModal(null)}
              bookingNumber={cab_.booking_number}
              masterBookingId={bId}
            />
            <VoidAdvanceModal
              open={modal === "void-advance"}
              onClose={() => setModal(null)}
              bookingNumber={cab_.booking_number}
              masterBookingId={bId}
              receiptNumber={advElig?.advance?.receipt_number ?? ""}
              amount={advElig?.advance?.amount ?? 0}
            />
          </>
        ) : null;
      })()}

      <CancelBookingModal
        open={modal === "cancel"}
        onClose={() => setModal(null)}
        bookingId={bId}
        bookingNumber={booking.booking_number}
        totalAmount={booking.total_amount}
      />
    </Box>
  );
}
