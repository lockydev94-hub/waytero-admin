// WAYTERO ADMIN — TOUR BOOKING DETAIL PAGE
// Full lifecycle page for a tour booking within a master booking.
// Status flow: PENDING_CONFIRMATION → CONFIRMED → IN_PROGRESS → COMPLETED
//              → SETTLEMENT_PENDING → SETTLED  (+ CANCELLED)
// Route: /bookings/:bookingId/tour/:tourId
// Doc Ref: BRD_PART_5_TOUR_PACKAGE_MANAGEMENT §5
// ============================================================
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box, Typography, Card, CardContent, Chip, Button, Stack, Grid, Avatar, Divider,
  Stepper, Step, StepLabel, Alert, CircularProgress, Paper, Table, TableBody, TableCell,
  TableHead, TableRow, alpha, useTheme,
} from "@mui/material";
import {
  ArrowBack, TravelExplore, Person, Payment, Timeline, LocationOn, CalendarMonth,
  People, CheckCircle, Cancel, Refresh, TaskAlt, PlayArrow, AccountBalance, OpenInNew,
  Edit, Description, ReceiptLong, Info, Notes, AccessTime, Badge, Email, Phone,
  HourglassEmpty, PendingActions, Celebration, Send, HistoryEdu,
  EditCalendar, Payments, DirectionsCar, AddCircle,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { tourService, TourBooking, TourManagePayload } from "../../services/tour.service";
import { useRealtime } from "../../hooks/useRealtime";
import ConfirmTourModal from "./modals/ConfirmTourModal";
import CancelTourModal from "./modals/CancelTourModal";
import StartTourModal from "./modals/StartTourModal";
import CompleteTourModal from "./modals/CompleteTourModal";
import {
  TourAdvanceModal, TourFleetModal, TourEditTripModal, TourChargeModal,
} from "./modals/TourManageModals";

// ── Status config ─────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; bg: string; step: number }> = {
  PENDING_CONFIRMATION: { label: "Pending Confirmation", color: "#F59E0B", bg: "#FEF3C7", step: 0 },
  CONFIRMED:            { label: "Confirmed",            color: "#3B82F6", bg: "#DBEAFE", step: 1 },
  IN_PROGRESS:          { label: "In Progress",          color: "#06B6D4", bg: "#CFFAFE", step: 2 },
  COMPLETED:            { label: "Completed",            color: "#10B981", bg: "#D1FAE5", step: 3 },
  SETTLEMENT_PENDING:   { label: "Settlement Pending",   color: "#8B5CF6", bg: "#EDE9FE", step: 4 },
  SETTLED:              { label: "Settled",              color: "#16A34A", bg: "#BBF7D0", step: 5 },
  CANCELLED:            { label: "Cancelled",            color: "#EF4444", bg: "#FEE2E2", step: -1 },
};

const STEPS = ["Pending\nConfirmation", "Confirmed", "In\nProgress", "Completed", "Settlement\nPending", "Settled"];

// ── Reusable sub-components ───────────────────────────────────
function InfoRow({ label, value, icon }: { label: React.ReactNode; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <TableRow sx={{ "&:last-child td": { border: 0 } }}>
      <TableCell sx={{ py: 1.25, pl: 0, color: "text.secondary", width: 180, fontWeight: 500, fontSize: "0.8125rem", border: 0 }}>
        <Stack direction="row" alignItems="center" gap={0.75}>{icon}{label}</Stack>
      </TableCell>
      <TableCell sx={{ py: 1.25, pr: 0, fontWeight: 600, fontSize: "0.875rem", border: 0 }}>{value || "—"}</TableCell>
    </TableRow>
  );
}

function SectionCard({ title, icon, children, action }: { title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
      <CardContent sx={{ p: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" alignItems="center" gap={1}>{icon}<Typography variant="subtitle1" fontWeight={700}>{title}</Typography></Stack>
          {action}
        </Stack>
        <Box sx={{ px: 2.5, py: 2 }}>{children}</Box>
      </CardContent>
    </Card>
  );
}

export default function TourBookingDetailPage() {
  const { bookingId, tourId } = useParams<{ bookingId: string; tourId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  type ModalType = "confirm" | "cancel" | "start" | "complete" | "advance" | "fleet" | "edit" | "charge" | null;
  const [modal, setModal] = useState<ModalType>(null);

  const bId = Number(bookingId);
  const tId = Number(tourId);

  const { data: booking, isLoading, isError, refetch } = useQuery<TourBooking>({
    queryKey: ["admin-tour-booking", tId],
    queryFn: () => tourService.getBooking(tId),
    enabled: !!tId,
  });
  // Manage payload (advances / charges / fleet / money) — loaded alongside.
  const { data: manage, refetch: refetchManage } = useQuery<TourManagePayload>({
    queryKey: ["admin-tour-booking-manage", tId],
    queryFn: () => tourService.getManage(tId),
    enabled: !!tId,
  });
  const [manageSubmitting, setManageSubmitting] = useState(false);

  // ── Realtime: refresh when this tour's status changes (partner lifecycle,
  // admin settle, payment collection) fan out a BOOKING_UPDATED event ──
  const { subscribe } = useRealtime();
  useEffect(() => {
    const unsub = subscribe<{ service_id: number }>("BOOKING_UPDATED", (msg) => {
      if (Number(msg.data.service_id) === tId) {
        refetch();
        refetchManage();
      }
    });
    return unsub;
  }, [subscribe, refetch, refetchManage, tId]);

  const refreshAll = () => { refetch(); refetchManage(); };

  const runManage = async (fn: () => Promise<unknown>, successMsg: string) => {
    setManageSubmitting(true);
    try {
      await fn();
      enqueueSnackbar(successMsg, { variant: "success" });
      setModal(null);
      refreshAll();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.detail ?? e?.response?.data?.message ?? "Action failed", { variant: "error" });
    } finally {
      setManageSubmitting(false);
    }
  };

  if (isLoading) return <Box sx={{ display: "grid", placeItems: "center", minHeight: "60vh", flexDirection: "column", gap: 2 }}><CircularProgress size={40} /><Typography color="text.secondary">Loading tour booking…</Typography></Box>;
  if (isError || !booking) return <Box p={4}><Alert severity="error" action={<Button onClick={() => refetch()}>Retry</Button>}>Failed to load tour booking.</Alert></Box>;

  const status = booking.booking_status;
  const statusCfg = STATUS_META[status] ?? STATUS_META.PENDING_CONFIRMATION;
  const isTerminal = ["CANCELLED", "SETTLED"].includes(status);
  const isActive = !isTerminal && status !== "COMPLETED";

  // Payment state — the trip can only be completed once the full amount is
  // collected, and after completion any remaining balance must still be
  // collectable (money stays open until SETTLED).
  const paymentStatus = manage?.payment_status ?? booking.payment_status;
  const balanceDue = Math.max((manage?.total_amount ?? booking.total_amount) - (manage?.advance_total ?? 0), 0);
  const isPaid = paymentStatus === "PAID";
  const canCollect = !["SETTLED", "CANCELLED"].includes(status);

  // Action guards — lifecycle actions are gated by status AND prerequisites.
  const canConfirm = status === "PENDING_CONFIRMATION";
  // Start trip requires the fleet to be assigned first (vehicle + driver).
  const hasFleet = Boolean(manage?.vehicle && manage?.driver);
  const canStart = status === "CONFIRMED" && hasFleet;
  const canComplete = status === "IN_PROGRESS" && isPaid;
  // Settlement happens on the Settlements page (Tour tab) — this page redirects there.
  const canSettle = status === "COMPLETED";
  const canCancel = !["IN_PROGRESS", "COMPLETED", "SETTLEMENT_PENDING", "SETTLED", "CANCELLED"].includes(status);

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(`/bookings/${bId}`)}>Back to master booking</Button>
        <Typography variant="caption" color="text.secondary">/ {booking.booking_number}</Typography>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} alignItems={{ md: "center" }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.1), display: "grid", placeItems: "center" }}>
            <TravelExplore color="primary" sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>TOUR BOOKING</Typography>
            <Typography variant="h5" fontWeight={900}>{booking.package_name}</Typography>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary" fontFamily="monospace">{booking.booking_number}</Typography>
              <Typography variant="body2" color="text.secondary">·</Typography>
              <Chip label={statusCfg.label} size="small" sx={{ bgcolor: statusCfg.bg, color: statusCfg.color, fontWeight: 700 }} />
              {booking.master_booking_number && <Chip label={`Master ${booking.master_booking_number}`} size="small" variant="outlined" onClick={() => navigate(`/bookings/${bId}`)} sx={{ cursor: "pointer" }} />}
            </Stack>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end">
          <Button startIcon={<Refresh />} onClick={refreshAll}>Refresh</Button>
          {canConfirm && <Button variant="contained" color="success" startIcon={<CheckCircle />} onClick={() => setModal("confirm")}>Confirm</Button>}
          {canStart && <Button variant="contained" color="info" startIcon={<PlayArrow />} onClick={() => setModal("start")}>Start trip</Button>}
          {status === "CONFIRMED" && !hasFleet && (
            <Button variant="contained" color="info" startIcon={<PlayArrow />} disabled
              title="Assign a vehicle and driver first">Start trip</Button>
          )}
          {status === "IN_PROGRESS" && !isPaid && (
            <Button variant="contained" color="warning" startIcon={<Payments />} onClick={() => setModal("advance")}>
              Collect Payment {balanceDue > 0 && `(₹${balanceDue.toLocaleString("en-IN")})`}
            </Button>
          )}
          {canComplete && <Button variant="contained" color="success" startIcon={<TaskAlt />} onClick={() => setModal("complete")}>Complete</Button>}
          {canSettle && <Button variant="contained" color="primary" startIcon={<AccountBalance />} onClick={() => navigate("/settlements?service=TOUR")}>Settle</Button>}
          {canCancel && <Button variant="outlined" color="error" startIcon={<Cancel />} onClick={() => setModal("cancel")}>Cancel</Button>}
        </Stack>
      </Stack>

      {/* Payment required before completing */}
      {status === "IN_PROGRESS" && !isPaid && (
        <Alert severity="warning" icon={<Payments />} sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button size="small" color="warning" startIcon={<Payments fontSize="small" />} onClick={() => setModal("advance")}>
              Collect payment
            </Button>
          }>
          <b>Collect the full payment before completing the tour.</b> Outstanding balance: <b>₹{balanceDue.toLocaleString("en-IN")}</b>. The booking can only be marked completed once the amount is fully paid.
        </Alert>
      )}

      {/* Completed but balance still due — collect before settling */}
      {status === "COMPLETED" && !isPaid && (
        <Alert severity="warning" icon={<Payments />} sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button size="small" color="warning" startIcon={<Payments fontSize="small" />} onClick={() => setModal("advance")}>
              Collect payment
            </Button>
          }>
          <b>Tour completed — {balanceDue > 0 ? `₹${balanceDue.toLocaleString("en-IN")} still outstanding.` : "payment pending."}</b> Collect the remaining balance before settling with the partner.
        </Alert>
      )}

      {/* Prerequisite notice — confirmed but no fleet assigned yet */}
      {status === "CONFIRMED" && !hasFleet && (
        <Alert severity="info" icon={<DirectionsCar />} sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button size="small" color="info" startIcon={<DirectionsCar fontSize="small" />} onClick={() => setModal("fleet")}>
              Assign fleet
            </Button>
          }>
          <b>Assign a vehicle &amp; driver before starting the trip.</b> The trip can only be started once the fleet is set from the package partner's vehicles/drivers.
        </Alert>
      )}

      {/* Status stepper */}
      {!isTerminal && (
        <Card variant="outlined" sx={{ borderRadius: 3, mb: 3, p: 3 }}>
          <Stepper activeStep={statusCfg.step} alternativeLabel>
            {STEPS.map((label, i) => (
              <Step key={label} completed={i < statusCfg.step}>
                <StepLabel>{label.split("\n").map((l, j) => <span key={j} style={{ display: "block", fontSize: 12 }}>{l}</span>)}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Card>
      )}
      {isTerminal && (
        <Alert severity={status === "CANCELLED" ? "error" : "success"} icon={status === "CANCELLED" ? <Cancel /> : <Celebration />} sx={{ mb: 3 }}>
          This tour booking is in terminal state: <b>{statusCfg.label}</b>. No further status changes are possible from this page.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Left column */}
        <Grid item xs={12} md={8}>
          {/* Customer info */}
          <SectionCard title="Customer" icon={<Person color="primary" />}
            action={booking.customer && <Button size="small" onClick={() => navigate(`/bookings/${bId}`)} endIcon={<OpenInNew fontSize="small" />}>Profile</Button>}
          >
            <Table size="small">
              <TableBody>
                <InfoRow label="Name" value={booking.customer?.name || booking.customer_name} icon={<Person fontSize="small" />} />
                <InfoRow label="Mobile" value={booking.customer?.mobile || booking.customer_mobile} icon={<Phone fontSize="small" />} />
                <InfoRow label="Email" value={booking.customer?.email || booking.customer_email} icon={<Email fontSize="small" />} />
                <InfoRow label="Customer ID" value={`#${booking.customer_id}`} icon={<Badge fontSize="small" />} />
              </TableBody>
            </Table>
          </SectionCard>

          {/* Package info */}
          <Box sx={{ mt: 3 }}>
            <SectionCard title="Package" icon={<TravelExplore color="primary" />}
              action={booking.package && <Button size="small" onClick={() => navigate(`/tours/${booking.package!.id}`)} endIcon={<OpenInNew fontSize="small" />}>View package</Button>}
            >
              <Table size="small">
                <TableBody>
                  <InfoRow label="Package" value={booking.package_name} icon={<TravelExplore fontSize="small" />} />
                  <InfoRow label="Destination" value={booking.package?.destination} icon={<LocationOn fontSize="small" />} />
                  <InfoRow label="Duration" value={booking.package ? `${booking.package.duration_days}D / ${booking.package.duration_nights}N` : "—"} icon={<AccessTime fontSize="small" />} />
                  <InfoRow label="Pax range" value={booking.package ? `${booking.package.minimum_persons}–${booking.package.maximum_persons || "∞"}` : "—"} icon={<People fontSize="small" />} />
                </TableBody>
              </Table>
            </SectionCard>
          </Box>

          {/* Travel info */}
          <Box sx={{ mt: 3 }}>
            <SectionCard title="Travel details" icon={<CalendarMonth color="primary" />}
              action={isActive && <Button size="small" startIcon={<EditCalendar />} onClick={() => setModal("edit")}>Edit</Button>}
            >
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>START</Typography>
                  <Typography variant="h6" fontWeight={800}>{booking.travel_start_date}</Typography>
                  <Typography variant="caption" color="text.secondary">{new Date(booking.travel_start_date).toLocaleDateString("en-US", { weekday: "long" })}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>END</Typography>
                  <Typography variant="h6" fontWeight={800}>{booking.travel_end_date}</Typography>
                  <Typography variant="caption" color="text.secondary">{new Date(booking.travel_end_date).toLocaleDateString("en-US", { weekday: "long" })}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>TRAVELLERS</Typography>
                  <Typography variant="h6" fontWeight={800}>{booking.persons_count}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>CREATED</Typography>
                  <Typography variant="body1" fontWeight={700}>{booking.created_at ? new Date(booking.created_at).toLocaleDateString() : "—"}</Typography>
                  <Typography variant="caption" color="text.secondary">{booking.created_at ? new Date(booking.created_at).toLocaleTimeString() : ""}</Typography>
                </Grid>
              </Grid>
            </SectionCard>
          </Box>

          {/* Participants */}
          <Box sx={{ mt: 3 }}>
            <SectionCard title={`Participants (${booking.participants?.length || 0})`} icon={<People color="primary" />}>
              {booking.participants && booking.participants.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Mobile</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Age</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Gender</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {booking.participants.map((p, i) => (
                      <TableRow key={p.id} hover>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell><b>{p.participant_name}</b></TableCell>
                        <TableCell>{p.mobile || "—"}</TableCell>
                        <TableCell>{p.age ?? "—"}</TableCell>
                        <TableCell>{p.gender || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <Alert severity="info">No participants listed.</Alert>}
            </SectionCard>
          </Box>

          {/* Special requests */}
          {booking.special_requests && (
            <Box sx={{ mt: 3 }}>
              <SectionCard title="Special requests" icon={<Notes color="primary" />}>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{booking.special_requests}</Typography>
              </SectionCard>
            </Box>
          )}

          {/* Activity timeline */}
          <Box sx={{ mt: 3 }}>
            <SectionCard title="Activity timeline" icon={<Timeline color="primary" />}>
              <Stack spacing={1.5}>
                <TimelineItem icon={<HourglassEmpty color="warning" />} title="Booking created" date={booking.created_at ? new Date(booking.created_at).toLocaleString() : ""} />
                {["CONFIRMED", "IN_PROGRESS", "COMPLETED", "SETTLEMENT_PENDING", "SETTLED"].includes(status) && (
                  <TimelineItem icon={<CheckCircle color="success" />} title="Confirmed by admin" />
                )}
                {["IN_PROGRESS", "COMPLETED", "SETTLEMENT_PENDING", "SETTLED"].includes(status) && (
                  <TimelineItem icon={<PlayArrow color="info" />} title="Trip started" />
                )}
                {["COMPLETED", "SETTLEMENT_PENDING", "SETTLED"].includes(status) && (
                  <TimelineItem icon={<TaskAlt color="success" />} title="Trip completed" />
                )}
                {status === "SETTLED" && <TimelineItem icon={<AccountBalance color="success" />} title="Settled with partner" />}
                {status === "CANCELLED" && <TimelineItem icon={<Cancel color="error" />} title="Booking cancelled" />}
              </Stack>
            </SectionCard>
          </Box>
        </Grid>

        {/* Right column */}
        <Grid item xs={12} md={4}>
          <SectionCard title="Payment & advance" icon={<Payment color="primary" />}
            action={canCollect && <Button size="small" startIcon={<Payments />} onClick={() => setModal("advance")}>{isPaid ? "Record" : "Collect"}</Button>}
          >
            <Stack spacing={1.5}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Package total (incl. charges)</Typography>
                {/* total_amount already includes additional charges — do not add them again */}
                <Typography variant="body1" fontWeight={800}>₹{(manage?.total_amount ?? booking.total_amount).toLocaleString("en-IN")}</Typography>
              </Stack>
              {manage && manage.additional_amount > 0 && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">incl. additional charges</Typography>
                  <Typography variant="body2" fontWeight={700} color="warning.main">₹{manage.additional_amount.toLocaleString("en-IN")}</Typography>
                </Stack>
              )}
              <Divider />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Platform commission</Typography>
                <Typography variant="body2" fontWeight={700} color="success.main">+ ₹{(manage?.platform_commission ?? booking.platform_commission).toLocaleString("en-IN")}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Partner payout</Typography>
                <Typography variant="body2" fontWeight={700}>₹{(manage?.partner_payout ?? booking.partner_payout).toLocaleString("en-IN")}</Typography>
              </Stack>
              <Divider />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Collected so far</Typography>
                <Typography variant="body2" fontWeight={800} color="primary.main">₹{(manage?.advance_total ?? 0).toLocaleString("en-IN")}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Balance due</Typography>
                <Typography variant="body2" fontWeight={800} color={balanceDue > 0 ? "error.main" : "success.main"}>
                  {balanceDue > 0 ? `₹${balanceDue.toLocaleString("en-IN")}` : "Fully paid"}
                </Typography>
              </Stack>
              {manage?.advance_received_by && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Advance held by</Typography>
                  <Chip label={manage.advance_received_by} size="small" variant="outlined" color="info" sx={{ fontWeight: 700 }} />
                </Stack>
              )}
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Payment status</Typography>
                <Chip label={booking.payment_status} size="small" color={booking.payment_status === "PAID" ? "success" : "warning"} />
              </Stack>
            </Stack>

            {manage && manage.advances.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" fontWeight={800} color="text.secondary">RECEIPTS</Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {manage.advances.map(a => (
                    <Box key={a.id} sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "grey.50" }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="body2" fontWeight={700} fontFamily="monospace">{a.receipt_number}</Typography>
                        <Chip label={a.status} size="small" color={a.status === "ACTIVE" ? "success" : "default"} />
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                        <Typography variant="body2" fontWeight={700}>₹{a.amount.toLocaleString("en-IN")}</Typography>
                        <Typography variant="caption" color="text.secondary">{a.payment_mode} · {a.received_by}</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                        <Button size="small" startIcon={<Description />}
                          onClick={() => tourService.downloadAdvanceReceipt(tId, a.id, a.receipt_number).catch(() => enqueueSnackbar("Could not download receipt", { variant: "error" }))}>
                          Receipt
                        </Button>
                        {a.status === "ACTIVE" && isActive && (
                          <Button size="small" color="error"
                            onClick={() => {
                              const reason = window.prompt("Reason for voiding this advance?");
                              if (reason && reason.trim().length >= 3) {
                                runManage(() => tourService.voidAdvance(tId, a.id, reason.trim()), "Advance voided");
                              } else if (reason) {
                                enqueueSnackbar("Reason must be at least 3 characters", { variant: "error" });
                              }
                            }}>
                            Void
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
          </SectionCard>

          <Box sx={{ mt: 3 }}>
            <SectionCard title="Vehicle & driver" icon={<DirectionsCar color="primary" />}
              action={isActive && <Button size="small" startIcon={<EditCalendar />} onClick={() => setModal("fleet")}>Assign</Button>}
            >
              {manage?.vehicle || manage?.driver ? (
                <Stack spacing={1}>
                  {manage.vehicle && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Vehicle</Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {manage.vehicle.registration_number} — {[manage.vehicle.vehicle_brand, manage.vehicle.vehicle_model].filter(Boolean).join(" ")}
                      </Typography>
                    </Stack>
                  )}
                  {manage.driver && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Driver</Typography>
                      <Typography variant="body2" fontWeight={700}>{manage.driver.full_name}{manage.driver.mobile ? ` · ${manage.driver.mobile}` : ""}</Typography>
                    </Stack>
                  )}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">No vehicle or driver assigned yet. Assign from the package partner's fleet before the trip starts.</Typography>
              )}
              {manage?.pickup_location && (
                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px dashed", borderColor: "divider" }}>
                  <Typography variant="caption" fontWeight={800} color="text.secondary">PICKUP</Typography>
                  <Typography variant="body2">{manage.pickup_location}</Typography>
                  {manage.pickup_datetime && <Typography variant="caption" color="text.secondary">{new Date(manage.pickup_datetime).toLocaleString("en-IN")}</Typography>}
                </Box>
              )}
            </SectionCard>
          </Box>

          <Box sx={{ mt: 3 }}>
            <SectionCard title="Additional charges" icon={<ReceiptLong color="primary" />}
              action={isActive && <Button size="small" startIcon={<AddCircle />} onClick={() => setModal("charge")}>Add</Button>}
            >
              {manage && manage.charges.length > 0 ? (
                <Stack spacing={1}>
                  {manage.charges.map(c => (
                    <Stack key={c.id} direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body2" fontWeight={700}>{c.label}</Typography>
                        <Typography variant="caption" color="text.secondary">{c.reason || "—"} · added by {c.added_by_role}</Typography>
                      </Box>
                      <Typography variant="body2" fontWeight={800}>₹{c.amount.toLocaleString("en-IN")}</Typography>
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">No additional charges. Add one when the trip is modified (extra days, extra stops).</Typography>
              )}
              {manage && manage.additional_amount > 0 && (
                <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.5, pt: 1.5, borderTop: "1px dashed", borderColor: "divider" }}>
                  <Typography variant="body2" color="text.secondary">Total additional</Typography>
                  <Typography variant="body2" fontWeight={800} color="warning.main">₹{manage.additional_amount.toLocaleString("en-IN")}</Typography>
                </Stack>
              )}
            </SectionCard>
          </Box>

          <Box sx={{ mt: 3 }}>
            <SectionCard title="Documents" icon={<ReceiptLong color="primary" />}>
              <Stack spacing={1}>
                <Button fullWidth variant="outlined" startIcon={<HistoryEdu />}
                  onClick={() => tourService.downloadItinerary(tId)
                    .then(() => enqueueSnackbar("Itinerary downloaded", { variant: "success" }))
                    .catch(() => enqueueSnackbar("Could not download itinerary", { variant: "error" }))}>
                  Download itinerary (PDF)
                </Button>
                {manage?.invoice_number ? (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Invoice</Typography>
                    <Typography variant="body2" fontWeight={700} fontFamily="monospace">{manage.invoice_number}</Typography>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">No invoice generated yet. Generate it before settlement.</Typography>
                )}
                <Button fullWidth variant="outlined" startIcon={<Description />}
                  onClick={() => tourService.downloadInvoice(tId)
                    .then(() => { enqueueSnackbar("Invoice downloaded", { variant: "success" }); refetchManage(); })
                    .catch(() => enqueueSnackbar("Could not download invoice", { variant: "error" }))}>
                  {manage?.invoice_number ? "Download invoice" : "Generate & download invoice"}
                </Button>
              </Stack>
            </SectionCard>
          </Box>

          <Box sx={{ mt: 3 }}>
          <SectionCard title="Quick links" icon={<Info color="primary" />}>
            <Stack spacing={1}>
              <Button startIcon={<OpenInNew fontSize="small" />} fullWidth variant="outlined" onClick={() => navigate(`/tours/${booking.package_id}`)}>View tour package</Button>
              <Button startIcon={<OpenInNew fontSize="small" />} fullWidth variant="outlined" onClick={() => navigate(`/bookings/${bId}`)}>Open master booking</Button>
              {canSettle && <Button startIcon={<Send fontSize="small" />} fullWidth variant="contained" color="primary" onClick={() => navigate("/settlements?service=TOUR")}>Settle in Settlements</Button>}
            </Stack>
          </SectionCard>
          </Box>
        </Grid>
      </Grid>

      {/* Modals */}
      <ConfirmTourModal
        open={modal === "confirm"} onClose={() => setModal(null)}
        bookingId={bId} tourId={tId}
        bookingNumber={booking.booking_number}
        packageName={booking.package_name}
        totalAmount={booking.total_amount}
        onSuccess={() => refetch()}
      />
      <CancelTourModal
        open={modal === "cancel"} onClose={() => setModal(null)}
        bookingId={bId} tourId={tId}
        bookingNumber={booking.booking_number}
        packageName={booking.package_name}
        totalAmount={booking.total_amount}
        onSuccess={() => refetch()}
      />
      <StartTourModal
        open={modal === "start"} onClose={() => setModal(null)}
        bookingId={bId} tourId={tId}
        bookingNumber={booking.booking_number}
        packageName={booking.package_name}
        onSuccess={() => refetch()}
      />
      <CompleteTourModal
        open={modal === "complete"} onClose={() => setModal(null)}
        bookingId={bId} tourId={tId}
        bookingNumber={booking.booking_number}
        packageName={booking.package_name}
        partnerPayout={booking.partner_payout}
        onSuccess={() => refetch()}
      />

      {/* ── Manage modals ─────────────────────────────────── */}
      <TourAdvanceModal
        open={modal === "advance"} onClose={() => setModal(null)} submitting={manageSubmitting}
        totalAmount={manage?.total_amount ?? booking.total_amount}
        advanceTotal={manage?.advance_total ?? 0}
        isFullPayment={status === "COMPLETED" || (status === "IN_PROGRESS" && !isPaid)}
        onSubmit={(p) => runManage(() => tourService.collectAdvance(tId, p), isPaid ? "Payment recorded" : "Advance recorded")}
      />
      <TourFleetModal
        open={modal === "fleet"} onClose={() => setModal(null)} submitting={manageSubmitting}
        fleet={manage?.fleet} current={manage}
        onSubmit={(p) => runManage(() => tourService.assignVehicle(tId, p), "Vehicle & driver assigned")}
      />
      <TourEditTripModal
        open={modal === "edit"} onClose={() => setModal(null)} submitting={manageSubmitting}
        booking={manage}
        onSubmit={(p) => runManage(() => tourService.updateTrip(tId, p), "Trip updated")}
      />
      <TourChargeModal
        open={modal === "charge"} onClose={() => setModal(null)} submitting={manageSubmitting}
        onSubmit={(p) => runManage(() => tourService.addCharge(tId, p), "Additional charge added")}
      />

    </Box>
  );
}

function TimelineItem({ icon, title, date }: { icon: React.ReactNode; title: string; date?: string }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: "grey.100", display: "grid", placeItems: "center" }}>{icon}</Box>
      <Box>
        <Typography variant="body2" fontWeight={700}>{title}</Typography>
        {date && <Typography variant="caption" color="text.secondary">{date}</Typography>}
      </Box>
    </Stack>
  );
}
