// ============================================================
// WAYTERO ADMIN — HOTEL BOOKING DETAIL PAGE
// Manages full lifecycle of a hotel booking within a master booking.
// Status flow: PENDING_PAYMENT → AWAITING_HOTEL_CONFIRMATION → CONFIRMED
//              → CHECKED_IN → IN_HOUSE → CHECKED_OUT → COMPLETED → SETTLED
//              (+ CANCELLED, NO_SHOW, REJECTED)
// Route: /bookings/:bookingId/hotel/:hotelId
// ============================================================
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Typography, Card, CardContent, Chip, Button, Stack,
  Grid, Avatar, Divider, Stepper, Step, StepLabel,
  Alert, CircularProgress, Paper, Table, TableBody,
  TableCell, TableRow, Tooltip, IconButton,
  useTheme, alpha,
} from "@mui/material";
import {
  ArrowBack, Hotel, Person, Payment, Timeline,
  LocationOn, CalendarMonth, KingBed, CheckCircle, Cancel,
  Refresh, AccountBalance, TaskAlt, Login, Logout,
  PersonOff, AddCircle, Block, ConfirmationNumber, People,
  RestaurantMenu, ReceiptLong, Download, Savings, EditCalendar,
  SwapHoriz,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { bookingService, BookingDetail, HotelBookingOut } from "../../services/booking.service";
import { useRealtime } from "../../hooks/useRealtime";
import { format } from "date-fns";
import ConfirmHotelModal from "./modals/ConfirmHotelModal";
import RejectHotelModal from "./modals/RejectHotelModal";
import CheckInModal from "./modals/CheckInModal";
import CheckOutModal from "./modals/CheckOutModal";
import AddChargesModal from "./modals/AddChargesModal";
import NoShowModal from "./modals/NoShowModal";
import CancelHotelModal from "./modals/CancelHotelModal";
import RecordAdvanceModal from "./modals/RecordAdvanceModal";
import HotelCollectPaymentModal from "./modals/HotelCollectPaymentModal";
import HotelSettlementModal from "./modals/HotelSettlementModal";
import GenerateInvoiceModal from "./modals/GenerateInvoiceModal";
import EditHotelBookingModal from "./modals/EditHotelBookingModal";
import SwitchHotelModal from "./modals/SwitchHotelModal";
import SplitStayModal from "./modals/SplitStayModal";

// ── Status config ─────────────────────────────────────────────
const HOTEL_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; step: number }> = {
  PENDING_PAYMENT:             { label: "Pending Payment",       color: "#F59E0B", bgColor: "#FEF3C7", step: 0 },
  AWAITING_HOTEL_CONFIRMATION: { label: "Awaiting Confirmation", color: "#3B82F6", bgColor: "#DBEAFE", step: 1 },
  CONFIRMED:                   { label: "Confirmed",             color: "#8B5CF6", bgColor: "#EDE9FE", step: 2 },
  CHECKED_IN:                  { label: "Checked In",            color: "#06B6D4", bgColor: "#CFFAFE", step: 3 },
  IN_HOUSE:                    { label: "In House",              color: "#0EA5E9", bgColor: "#E0F2FE", step: 4 },
  CHECKED_OUT:                 { label: "Checked Out",           color: "#22C55E", bgColor: "#DCFCE7", step: 5 },
  COMPLETED:                   { label: "Completed",             color: "#10B981", bgColor: "#D1FAE5", step: 6 },
  SETTLED:                     { label: "Settled",               color: "#16A34A", bgColor: "#BBF7D0", step: 7 },
  CANCELLED:                   { label: "Cancelled",             color: "#EF4444", bgColor: "#FEE2E2", step: -1 },
  REJECTED:                    { label: "Rejected",              color: "#DC2626", bgColor: "#FEE2E2", step: -1 },
  NO_SHOW:                     { label: "No Show",               color: "#6B7280", bgColor: "#F3F4F6", step: -1 },
};

const HOTEL_STEPS = ["Pending\nPayment", "Awaiting\nConfirmation", "Confirmed", "Checked\nIn", "In\nHouse", "Checked\nOut", "Completed", "Settled"];

const BOOKING_STATUS_CONFIG: Record<string, { color: "default"|"primary"|"success"|"warning"|"error"|"info"; label: string }> = {
  DRAFT:           { color: "default",  label: "Draft" },
  PENDING_PAYMENT: { color: "warning",  label: "Pending Payment" },
  CONFIRMED:       { color: "primary",  label: "Confirmed" },
  IN_PROGRESS:     { color: "info",     label: "In Progress" },
  COMPLETED:       { color: "success",  label: "Completed" },
  CLOSED:          { color: "success",  label: "Closed" },
  CANCELLED:       { color: "error",    label: "Cancelled" },
};

// ── Reusable sub-components ───────────────────────────────────
function InfoRow({ label, value, icon }: { label: React.ReactNode; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <TableRow sx={{ "&:last-child td": { border: 0 } }}>
      <TableCell sx={{ py: 1.25, pl: 0, color: "text.secondary", width: 160, fontWeight: 500, fontSize: "0.8125rem", border: 0 }}>
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

// ── Main ──────────────────────────────────────────────────────
export default function HotelBookingDetailPage() {
  const { bookingId, hotelId } = useParams<{ bookingId: string; hotelId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  type ModalType =
    | "confirm" | "reject" | "check-in" | "check-out" | "add-charges"
    | "no-show" | "cancel" | "record-advance" | "collect-payment"
    | "settle" | "generate-invoice" | "edit"
    | "switch-hotel" | "split-stay" | null;
  const [modal, setModal] = useState<ModalType>(null);

  const bId = Number(bookingId);
  const hId = Number(hotelId);

  const { data: booking, isLoading, isError, refetch } = useQuery<BookingDetail>({
    queryKey: ["admin-booking", bId],
    queryFn: () => bookingService.get(bId),
    enabled: !!bId,
  });

  // Realtime refresh: any lifecycle change to this hotel reservation
  // (partner confirm/check-in/collect, or another admin tab) fans out a
  // HOTEL_BOOKING_UPDATED event via /ws. Refetch so this page always shows
  // the live status/payment state without the user pressing Refresh.
  const { subscribe } = useRealtime();
  useEffect(() => {
    if (!bId || !hId) return;
    const unsub = subscribe<{ master_booking_id: number; reservation_id: number }>(
      "HOTEL_BOOKING_UPDATED",
      (msg) => {
        const d = msg?.data ?? {};
        if (Number(d.master_booking_id) === bId && Number(d.reservation_id) === hId) {
          qc.invalidateQueries({ queryKey: ["admin-booking", bId] });
        }
      },
    );
    return unsub;
  }, [bId, hId, subscribe, qc]);

  // Generic fan-out (BOOKING_UPDATED): catches master-level mutations not
  // covered by HOTEL_BOOKING_UPDATED (e.g. admin force-cancel, settlement).
  useEffect(() => {
    if (!bId) return;
    const unsub = subscribe<{ master_booking_id: number }>(
      "BOOKING_UPDATED",
      (msg) => {
        if (Number(msg.data.master_booking_id) === bId) {
          qc.invalidateQueries({ queryKey: ["admin-booking", bId] });
        }
      },
    );
    return unsub;
  }, [bId, subscribe, qc]);

  // One-click actions (no modal needed)
  const inHouseMutation = useMutation({
    mutationFn: () => bookingService.hotelInHouse(bId, hId),
    onSuccess: () => { enqueueSnackbar("Marked as In-House", { variant: "success" }); qc.invalidateQueries({ queryKey: ["admin-booking", bId] }); },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || "Failed", { variant: "error" }),
  });
  const completeMutation = useMutation({
    mutationFn: () => bookingService.hotelComplete(bId, hId),
    onSuccess: () => { enqueueSnackbar("Booking completed", { variant: "success" }); qc.invalidateQueries({ queryKey: ["admin-booking", bId] }); },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || "Failed", { variant: "error" }),
  });
  // NOTE: Settlement is deliberately NOT actionable from this page. It must be
  // performed on the Settlements page (/settlements → Hotel), where the full
  // net-position calculation — commission, TDS, custody, coupon disbursement —
  // is reviewed before the admin confirms. This page only routes there.
  const downloadInvoiceMutation = useMutation({
    mutationFn: (invoiceNumber: string) => bookingService.hotelDownloadInvoice(bId, hId, invoiceNumber),
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || "Failed to download invoice", { variant: "error" }),
  });

  if (isLoading) return (
    <Box display="flex" alignItems="center" justifyContent="center" minHeight="60vh" flexDirection="column" gap={2}>
      <CircularProgress size={40} /><Typography color="text.secondary">Loading booking details...</Typography>
    </Box>
  );
  if (isError || !booking) return (
    <Box p={4}><Alert severity="error">Failed to load booking. <Button onClick={() => refetch()}>Retry</Button></Alert></Box>
  );

  const hb = booking.hotel_bookings.find((h) => h.id === hId);
  if (!hb) return (
    <Box p={4}><Alert severity="warning">Hotel booking not found in this master booking.</Alert></Box>
  );

  const statusCfg = HOTEL_STATUS_CONFIG[hb.booking_status] ?? HOTEL_STATUS_CONFIG.CANCELLED;
  const currentStep = statusCfg.step;
  const isTerminal = ["CANCELLED", "REJECTED", "NO_SHOW"].includes(hb.booking_status);
  const isSettled = hb.booking_status === "SETTLED";

  // Action guards
  const canConfirm    = hb.booking_status === "AWAITING_HOTEL_CONFIRMATION";
  const canReject     = hb.booking_status === "AWAITING_HOTEL_CONFIRMATION";
  const canEdit       = hb.booking_status === "CONFIRMED";
  const canCheckIn    = hb.booking_status === "CONFIRMED";
  const canMarkInHouse= hb.booking_status === "CHECKED_IN";
  const canCheckOut   = hb.booking_status === "IN_HOUSE";
  const canAddCharges = ["CHECKED_IN", "IN_HOUSE", "CHECKED_OUT"].includes(hb.booking_status);
  const canComplete   = hb.booking_status === "CHECKED_OUT";
  const canNoShow     = ["CONFIRMED", "CHECKED_IN", "IN_HOUSE"].includes(hb.booking_status);
  const canCancel     = !["CHECKED_IN", "IN_HOUSE", "CHECKED_OUT", "COMPLETED", "SETTLED", "CANCELLED", "REJECTED", "NO_SHOW"].includes(hb.booking_status);
  // Hotel switch / split-stay (Doc Ref: Hotel Switch Spec; Migration 0042)
  // Pre-checkin switch: status before guest arrives. Post-checkin split: guest
  // already in-house. Both locked out once the stay is settled / closed.
  const canSwitchHotel = ["PENDING_PAYMENT", "AWAITING_HOTEL_CONFIRMATION", "CONFIRMED"].includes(hb.booking_status);
  const canSplitStay   = ["CHECKED_IN", "IN_HOUSE"].includes(hb.booking_status);

  const bStatusCfg = BOOKING_STATUS_CONFIG[booking.booking_status];
  const totalAmount = hb.final_amount ?? hb.base_amount ?? 0;

  // ── Billing / invoice / payment (migration 0035) ──────────────
  const advancePaid = hb.total_advance_paid ?? 0;
  const balanceDue = hb.balance_due ?? Math.max(totalAmount - advancePaid, 0);
  const hasInvoice = !!hb.invoice_number;
  const payStatus = hb.payment_collected_status ?? "PENDING";
  // Advances: from confirmation up to the moment the bill is closed.
  const canRecordAdvance = ["PENDING_PAYMENT", "AWAITING_HOTEL_CONFIRMATION", "CONFIRMED", "CHECKED_IN", "IN_HOUSE", "CHECKED_OUT"].includes(hb.booking_status) && balanceDue > 0;
  // Invoice + final collection: only after the guest has checked out.
  const canInvoiceStage = ["CHECKED_OUT", "COMPLETED"].includes(hb.booking_status);
  const canGenerateInvoice = canInvoiceStage && !hasInvoice;
  const canCollectPayment = canInvoiceStage && hasInvoice && payStatus !== "PAID";

  // ── Room-charge breakdown ─────────────────────────────────────
  // base_amount lumps the room tariff together with any extra-person / extra-bed
  // surcharge frozen at booking time. When the backend surfaces the occupancy
  // split, itemise it here exactly like the check-out bill (extra adult/child are
  // per-night, extra bed is one-time); otherwise fall back to a single "Base" row.
  const occ = hb.occupancy ?? null;
  const roomTariff = hb.room_tariff ?? null;
  const nights = hb.num_nights ?? 1;
  const occLines: { label: string; amount: number; detail: string | null }[] | null =
    occ && roomTariff != null
      ? [
          { label: "Room Tariff", amount: roomTariff, detail: `${nights} night(s) × ${hb.num_rooms ?? 1} room(s)` },
          ...((occ.extra_adults ?? 0) > 0
            ? [{
                label: `Extra Adult × ${occ.extra_adults}`,
                amount: (occ.extra_adults ?? 0) * (occ.extra_adult_charge ?? 0) * nights,
                detail: `₹${(occ.extra_adult_charge ?? 0).toLocaleString()}/night × ${nights} night(s)`,
              }]
            : []),
          ...((occ.extra_children ?? 0) > 0
            ? [{
                label: `Extra Child × ${occ.extra_children}`,
                amount: (occ.extra_children ?? 0) * (occ.extra_child_charge ?? 0) * nights,
                detail: `₹${(occ.extra_child_charge ?? 0).toLocaleString()}/night × ${nights} night(s)`,
              }]
            : []),
          ...((occ.extra_beds ?? 0) > 0
            ? [{
                label: `Extra Bed × ${occ.extra_beds}`,
                amount: (occ.extra_beds ?? 0) * (occ.extra_bed_charge ?? 0),
                detail: `₹${(occ.extra_bed_charge ?? 0).toLocaleString()} one-time`,
              }]
            : []),
        ]
      : null;

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <IconButton onClick={() => navigate(`/bookings/${bId}`)} sx={{ border: "1px solid", borderColor: "divider" }}>
            <ArrowBack />
          </IconButton>
          <Box>
            <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
              <Typography variant="h5" fontWeight={800}>Hotel Booking Detail</Typography>
              <Chip label={booking.booking_number} variant="outlined" size="small" sx={{ fontFamily: "monospace", fontWeight: 700 }} />
              <Chip label={bStatusCfg?.label || booking.booking_status} color={bStatusCfg?.color || "default"} size="small" />
            </Stack>
            <Typography variant="body2" color="text.secondary" mt={0.25}>
              Hotel: {hb.booking_number} · {booking.customer_name}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Tooltip title="Refresh"><IconButton onClick={() => refetch()} size="small"><Refresh /></IconButton></Tooltip>
          {canEdit && (
            <Button variant="outlined" color="primary" size="small" startIcon={<EditCalendar />} onClick={() => setModal("edit")}>Edit</Button>
          )}
          {canSwitchHotel && (
            <Button
              variant="outlined"
              color="secondary"
              size="small"
              startIcon={<SwapHoriz />}
              onClick={() => setModal("switch-hotel")}
            >
              Switch Hotel
            </Button>
          )}
          {canSplitStay && (
            <Button
              variant="outlined"
              color="warning"
              size="small"
              startIcon={<SwapHoriz />}
              onClick={() => setModal("split-stay")}
            >
              Split Stay
            </Button>
          )}
          {canNoShow && (
            <Button variant="outlined" color="inherit" size="small" startIcon={<PersonOff />} onClick={() => setModal("no-show")}>No-Show</Button>
          )}
          {canCancel && (
            <Button variant="outlined" color="error" size="small" startIcon={<Cancel />} onClick={() => setModal("cancel")}>Cancel</Button>
          )}
          {hb.booking_status === "COMPLETED" && (
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<AccountBalance />}
              onClick={() => setModal("settle")}
            >
              Settle Booking
            </Button>
          )}
          {isSettled && <Chip icon={<TaskAlt sx={{ fontSize: 16 }} />} label="Settled" color="success" sx={{ fontWeight: 700 }} />}
        </Stack>
      </Stack>

      {/* Status alerts */}
      {isTerminal && (
        <Alert severity={hb.booking_status === "NO_SHOW" ? "warning" : "error"} sx={{ mb: 3, borderRadius: 2 }}>
          This hotel booking is <strong>{statusCfg.label}</strong>.
          {hb.cancellation_reason && ` Reason: ${hb.cancellation_reason}`}
          {hb.refund_amount ? ` Refund: ₹${hb.refund_amount.toLocaleString()}` : ""}
        </Alert>
      )}
      {hb.booking_status === "COMPLETED" && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 2, fontWeight: 600 }}
          action={<Button color="info" size="small" variant="contained" startIcon={<AccountBalance />}
            onClick={() => navigate("/settlements")} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
            Go to Settlements
          </Button>}
        >
          Stay completed and ready for settlement. The payout is finalised on the{" "}
          <strong>Settlements</strong> page (Hotel), where the full calculation — commission,
          TDS and partner wallet movement — is shown for review before you confirm.
        </Alert>
      )}
      {isSettled && (
        <Alert severity="success" sx={{ mb: 3, borderRadius: 2, fontWeight: 600 }}>
          This hotel booking has been <strong>settled</strong>. Commission, partner payout and any
          TDS were processed on the Settlements page.
        </Alert>
      )}

      {/* Status Stepper */}
      {!isTerminal && (
        <Card sx={{ borderRadius: 3, mb: 3, border: "1px solid", borderColor: "divider", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <CardContent sx={{ py: 3 }}>
            <Stack direction="row" alignItems="center" gap={1} mb={2.5}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: statusCfg.color }} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: statusCfg.color }}>{statusCfg.label}</Typography>
            </Stack>
            <Stepper activeStep={currentStep} alternativeLabel sx={{ "& .MuiStepLabel-label": { fontSize: "0.7rem", mt: 0.5 } }}>
              {HOTEL_STEPS.map((label, i) => (
                <Step key={i} completed={i < currentStep}>
                  <StepLabel sx={{ "& .MuiStepLabel-label": { color: i <= currentStep ? "text.primary" : "text.disabled", fontWeight: i === currentStep ? 700 : 400 } }}>
                    {label}
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={3}>
        {/* Left column */}
        <Grid item xs={12} lg={8}>
          <Stack gap={3}>
            {/* Hotel Details */}
            <SectionCard title="Hotel Details" icon={<Hotel sx={{ color: "secondary.main" }} />}>
              <Table size="small">
                <TableBody>
                  <InfoRow label="Hotel" value={hb.hotel_name} icon={<Hotel sx={{ fontSize: 14 }} />} />
                  <InfoRow label="Address" value={hb.hotel_address} icon={<LocationOn sx={{ fontSize: 14 }} />} />
                  <InfoRow label="Room Type" value={hb.room_category_name || hb.room_type} icon={<KingBed sx={{ fontSize: 14 }} />} />
                  <InfoRow label="Meal Plan" value={hb.meal_plan} icon={<RestaurantMenu sx={{ fontSize: 14 }} />} />
                  <InfoRow label="Check-In" value={hb.check_in_date ? format(new Date(hb.check_in_date), "dd MMM yyyy") : null} icon={<CalendarMonth sx={{ fontSize: 14 }} />} />
                  <InfoRow label="Check-Out" value={hb.check_out_date ? format(new Date(hb.check_out_date), "dd MMM yyyy") : null} icon={<CalendarMonth sx={{ fontSize: 14 }} />} />
                  <InfoRow label="Duration" value={hb.num_nights ? `${hb.num_nights} night${hb.num_nights > 1 ? "s" : ""}` : null} icon={<CalendarMonth sx={{ fontSize: 14 }} />} />
                  <InfoRow label="Rooms" value={hb.num_rooms ? `${hb.num_rooms} room${hb.num_rooms > 1 ? "s" : ""}` : null} icon={<KingBed sx={{ fontSize: 14 }} />} />
                  <InfoRow label="Guests" value={hb.num_guests ? `${hb.num_guests} guest${(hb.num_guests ?? 1) > 1 ? "s" : ""}` : null} icon={<People sx={{ fontSize: 14 }} />} />
                  {hb.hotel_confirmation_number && (
                    <InfoRow label="Hotel Ref #" value={<Typography variant="body2" fontFamily="monospace" fontWeight={700}>{hb.hotel_confirmation_number}</Typography>} icon={<ConfirmationNumber sx={{ fontSize: 14 }} />} />
                  )}
                </TableBody>
              </Table>
            </SectionCard>

            {/* Actions */}
            <SectionCard title="Actions" icon={<CheckCircle sx={{ color: "primary.main" }} />}>
              {isTerminal ? (
                <Typography variant="body2" color="text.disabled" py={1}>No further actions available — booking is {statusCfg.label}.</Typography>
              ) : (
                <Stack direction="row" flexWrap="wrap" gap={1.5}>
                  {canConfirm && (
                    <Button variant="contained" color="success" startIcon={<CheckCircle />} onClick={() => setModal("confirm")}>
                      Record Confirmation
                    </Button>
                  )}
                  {canReject && (
                    <Button variant="outlined" color="error" startIcon={<Block />} onClick={() => setModal("reject")}>
                      Record Rejection
                    </Button>
                  )}
                  {canCheckIn && (
                    <Button variant="contained" color="primary" startIcon={<Login />} onClick={() => setModal("check-in")}>
                      Record Check-In
                    </Button>
                  )}
                  {canMarkInHouse && (
                    <Button variant="contained" color="info" startIcon={<Hotel />}
                      disabled={inHouseMutation.isPending}
                      onClick={() => inHouseMutation.mutate()}
                    >
                      {inHouseMutation.isPending ? "Processing..." : "Mark In-House"}
                    </Button>
                  )}
                  {canCheckOut && (
                    <Button variant="contained" color="secondary" startIcon={<Logout />} onClick={() => setModal("check-out")}>
                      Record Check-Out
                    </Button>
                  )}
                  {canAddCharges && (
                    <Button variant="outlined" color="warning" startIcon={<AddCircle />} onClick={() => setModal("add-charges")}>
                      Add Charges
                    </Button>
                  )}
                  {canComplete && (
                    <Button variant="contained" color="success" startIcon={<TaskAlt />}
                      disabled={completeMutation.isPending}
                      onClick={() => completeMutation.mutate()}
                    >
                      {completeMutation.isPending ? "Processing..." : "Mark Completed"}
                    </Button>
                  )}
                  {canRecordAdvance && (
                    <Button variant="outlined" color="info" startIcon={<Savings />} onClick={() => setModal("record-advance")}>
                      Record Advance
                    </Button>
                  )}
                  {canGenerateInvoice && (
                    <Button variant="contained" color="primary" startIcon={<ReceiptLong />}
                      onClick={() => setModal("generate-invoice")}
                    >
                      Generate Invoice
                    </Button>
                  )}
                  {canCollectPayment && (
                    <Button variant="contained" color="success" startIcon={<Payment />} onClick={() => setModal("collect-payment")}>
                      Collect Payment
                    </Button>
                  )}
                  {hasInvoice && (
                    <Button variant="outlined" color="secondary" startIcon={<Download />}
                      disabled={downloadInvoiceMutation.isPending}
                      onClick={() => downloadInvoiceMutation.mutate(hb.invoice_number!)}
                    >
                      {downloadInvoiceMutation.isPending ? "Downloading..." : "Download Invoice"}
                    </Button>
                  )}
                </Stack>
              )}
            </SectionCard>

            {/* Stay Record */}
            {(hb.actual_check_in_at || hb.actual_check_out_at || hb.allocated_rooms) && (
              <SectionCard title="Stay Record" icon={<CalendarMonth sx={{ color: "info.main" }} />}>
                {(hb as any).platform_timezone && (
                  <Stack direction="row" alignItems="center" gap={0.75} mb={1}>
                    <Chip
                      label={`Times shown in ${(hb as any).platform_timezone}`}
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                )}
                <Table size="small">
                  <TableBody>
                    {hb.actual_check_in_at && (
                      <InfoRow label="Checked In At" value={format(new Date(hb.actual_check_in_at), "dd MMM yyyy, hh:mm a")} icon={<Login sx={{ fontSize: 14 }} />} />
                    )}
                    {(hb as any).check_in_at_local && (hb as any).check_in_at_local !== hb.actual_check_in_at && (
                      <InfoRow
                        label={`Check-In (platform) · ${(hb as any).platform_timezone || "local"}`}
                        value={format(new Date((hb as any).check_in_at_local), "dd MMM yyyy, hh:mm a")}
                        icon={<Login sx={{ fontSize: 14 }} />}
                      />
                    )}
                    {hb.check_in_id_proof && (
                      <InfoRow label="ID Proof" value={`${hb.check_in_id_proof}`} icon={<Person sx={{ fontSize: 14 }} />} />
                    )}
                    {hb.allocated_rooms && (() => {
                      try {
                        const rooms: string[] = JSON.parse(hb.allocated_rooms);
                        if (rooms.length > 0) {
                          return (
                            <InfoRow
                              label="Assigned Rooms"
                              icon={<KingBed sx={{ fontSize: 14 }} />}
                              value={
                                <Stack direction="row" flexWrap="wrap" gap={0.5}>
                                  {rooms.map((r) => (
                                    <Chip key={r} label={`Room ${r}`} size="small" color="primary" variant="outlined"
                                      sx={{ height: 22, fontWeight: 700, fontSize: "0.75rem" }} />
                                  ))}
                                </Stack>
                              }
                            />
                          );
                        }
                      } catch { /* malformed JSON — skip */ }
                      return null;
                    })()}
                    {hb.actual_check_out_at && (
                      <InfoRow label="Checked Out At" value={format(new Date(hb.actual_check_out_at), "dd MMM yyyy, hh:mm a")} icon={<Logout sx={{ fontSize: 14 }} />} />
                    )}
                    {(hb as any).check_out_at_local && (hb as any).check_out_at_local !== hb.actual_check_out_at && (
                      <InfoRow
                        label={`Check-Out (platform) · ${(hb as any).platform_timezone || "local"}`}
                        value={format(new Date((hb as any).check_out_at_local), "dd MMM yyyy, hh:mm a")}
                        icon={<Logout sx={{ fontSize: 14 }} />}
                      />
                    )}
                  </TableBody>
                </Table>
              </SectionCard>
            )}
          </Stack>
        </Grid>

        {/* Right column */}
        <Grid item xs={12} lg={4}>
          <Stack gap={3}>
            {/* Customer */}
            <SectionCard title="Customer" icon={<Person sx={{ color: "primary.main" }} />}>
              <Stack alignItems="center" textAlign="center" py={1}>
                <Avatar sx={{ width: 52, height: 52, bgcolor: "primary.main", fontSize: "1.25rem", mb: 1.5, fontWeight: 700 }}>
                  {booking.customer_name?.[0]?.toUpperCase() || "C"}
                </Avatar>
                <Typography variant="subtitle1" fontWeight={700}>{booking.customer_name}</Typography>
                <Typography variant="body2" color="text.secondary">{booking.customer_mobile}</Typography>
                {booking.customer_email && <Typography variant="caption" color="text.secondary">{booking.customer_email}</Typography>}
              </Stack>
              <Divider sx={{ my: 1.5 }} />
              <Table size="small">
                <TableBody>
                  <InfoRow label="City" value={booking.city_name} icon={<LocationOn sx={{ fontSize: 14 }} />} />
                  <InfoRow label="Journey"
                    value={booking.journey_start_date ? `${booking.journey_start_date}${booking.journey_end_date ? ` → ${booking.journey_end_date}` : ""}` : null}
                    icon={<CalendarMonth sx={{ fontSize: 14 }} />}
                  />
                </TableBody>
              </Table>
            </SectionCard>

            {/* Payment */}
            <SectionCard title="Payment" icon={<Payment sx={{ color: "success.main" }} />}
              action={hasInvoice ? <Chip label={hb.invoice_number} size="small" color="success" variant="outlined" sx={{ fontFamily: "monospace", fontWeight: 700 }} /> : undefined}
            >
              <Stack gap={1.5}>
                <Box sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.08), borderRadius: 2, border: "1px solid", borderColor: "success.200" }}>
                  <Typography variant="caption" color="success.dark">
                    {hb.final_amount != null ? "Final Amount" : "Base Amount"}
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="success.dark">
                    ₹{totalAmount.toLocaleString()}
                  </Typography>
                </Box>
                <Table size="small">
                  <TableBody>
                    {occLines
                      ? occLines.map((ln, i) => (
                          <InfoRow
                            key={i}
                            label={
                              <Stack>
                                <span>{ln.label}</span>
                                {ln.detail && (
                                  <Typography variant="caption" color="text.disabled">{ln.detail}</Typography>
                                )}
                              </Stack>
                            }
                            value={`₹${ln.amount.toLocaleString()}`}
                          />
                        ))
                      : hb.base_amount != null && <InfoRow label="Base" value={`₹${hb.base_amount.toLocaleString()}`} />}
                    {(hb.taxes_amount ?? 0) > 0 && <InfoRow label="Taxes" value={`₹${hb.taxes_amount!.toLocaleString()}`} />}
                    {(hb.additional_charges ?? 0) > 0 && <InfoRow label="Extra Charges" value={<Typography variant="body2" fontWeight={700} color="warning.main">₹{hb.additional_charges!.toLocaleString()}</Typography>} />}
                    {(hb.overtime_charge ?? 0) > 0 && <InfoRow label="Overtime" value={<Typography variant="body2" fontWeight={700} color="warning.main">₹{hb.overtime_charge!.toLocaleString()}{hb.overtime_hours ? ` (${hb.overtime_hours}h)` : ""}</Typography>} />}
                    {(hb.coupon_discount ?? 0) > 0 && <InfoRow label={`Coupon${hb.coupon_code ? ` (${hb.coupon_code})` : ""}`} value={<Typography variant="body2" fontWeight={700} color="error.main">−₹{hb.coupon_discount!.toLocaleString()}</Typography>} />}
                    <InfoRow label="Advance Received" value={<Typography variant="body2" fontWeight={700} color="success.main">₹{advancePaid.toLocaleString()}</Typography>} />
                    <InfoRow label="Balance Due" value={<Typography variant="body2" fontWeight={800} color={balanceDue > 0 ? "warning.main" : "success.main"}>₹{balanceDue.toLocaleString()}</Typography>} />
                    <InfoRow label="Collection" value={<Chip label={payStatus} size="small" color={payStatus === "PAID" ? "success" : payStatus === "PARTIAL" ? "warning" : "default"} />} />
                    {hb.payment_collected_by && <InfoRow label="Held By" value={<Chip label={hb.payment_collected_by} size="small" variant="outlined" color={hb.payment_collected_by === "ADMIN" ? "info" : "warning"} />} />}
                  </TableBody>
                </Table>

                {(hb.advance_payments?.length ?? 0) > 0 && (
                  <>
                    <Divider sx={{ my: 0.5 }} />
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ letterSpacing: 0.5 }}>
                      PAYMENT RECEIPTS
                    </Typography>
                    <Stack gap={0.75}>
                      {hb.advance_payments!.map((p) => (
                        <Box key={p.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 1, borderRadius: 1.5, bgcolor: alpha(theme.palette.text.primary, 0.03) }}>
                          <Box>
                            <Typography variant="caption" fontFamily="monospace" fontWeight={700} display="block">{p.receipt_number}</Typography>
                            <Stack direction="row" gap={0.5} mt={0.25}>
                              <Chip label={p.payment_mode} size="small" sx={{ height: 18, fontSize: "0.65rem" }} />
                              <Chip label={p.received_by} size="small" variant="outlined" color={p.received_by === "ADMIN" ? "info" : "warning"} sx={{ height: 18, fontSize: "0.65rem" }} />
                            </Stack>
                          </Box>
                          <Typography variant="body2" fontWeight={700} color="success.main">
                            ₹{p.amount.toLocaleString()}
                            {p.refunded_amount > 0 && <Typography component="span" variant="caption" color="error.main"> (−₹{p.refunded_amount.toLocaleString()})</Typography>}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </>
                )}
              </Stack>
            </SectionCard>

            {/* Timeline */}
            <SectionCard title="Activity Timeline" icon={<Timeline sx={{ color: "info.main" }} />}>
              <Stack gap={0}>
                {booking.timeline.length === 0 && (
                  <Typography variant="body2" color="text.disabled" textAlign="center" py={2}>No timeline events yet</Typography>
                )}
                {booking.timeline.slice(0, 8).map((t, i) => (
                  <Box key={t.id} sx={{ display: "flex", gap: 1.5, py: 1.25, borderBottom: i < Math.min(booking.timeline.length, 8) - 1 ? "1px solid" : "none", borderColor: "divider" }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "secondary.main", mt: 0.75, flexShrink: 0 }} />
                    <Box flex={1}>
                      <Typography variant="caption" fontWeight={700} color="secondary.main" display="block">{t.event_type.replace(/_/g, " ")}</Typography>
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

      {/* Modals */}
      <EditHotelBookingModal
        open={modal === "edit"} onClose={() => setModal(null)}
        bookingId={bId} hotelId={hId} hb={hb}
      />
      <ConfirmHotelModal
        open={modal === "confirm"} onClose={() => setModal(null)}
        bookingId={bId} hotelId={hId}
        hotelBookingNumber={hb.booking_number} hotelName={hb.hotel_name}
      />
      <RejectHotelModal
        open={modal === "reject"} onClose={() => setModal(null)}
        bookingId={bId} hotelId={hId}
        hotelBookingNumber={hb.booking_number} totalAmount={totalAmount}
      />
      <CheckInModal
        open={modal === "check-in"} onClose={() => setModal(null)}
        bookingId={bId} hotelId={hId}
        hotelBookingNumber={hb.booking_number} hotelName={hb.hotel_name}
        guestName={booking.customer_name}
        numRooms={hb.num_rooms}
        bookedCheckInDate={hb.check_in_date}
        platformTimezone={(hb as any).platform_timezone}
      />
      <CheckOutModal
        open={modal === "check-out"} onClose={() => setModal(null)}
        bookingId={bId} hotelId={hId}
        hotelBookingNumber={hb.booking_number}
        platformTimezone={(hb as any).platform_timezone}
        recordedCheckInAt={hb.actual_check_in_at}
      />
      <AddChargesModal
        open={modal === "add-charges"} onClose={() => setModal(null)}
        bookingId={bId} hotelId={hId}
        hotelBookingNumber={hb.booking_number}
      />
      <NoShowModal
        open={modal === "no-show"} onClose={() => setModal(null)}
        bookingId={bId} hotelId={hId}
        hotelBookingNumber={hb.booking_number} totalAmount={totalAmount}
      />
      <CancelHotelModal
        open={modal === "cancel"} onClose={() => setModal(null)}
        bookingId={bId} hotelId={hId}
        hotelBookingNumber={hb.booking_number} totalAmount={totalAmount}
      />
      <RecordAdvanceModal
        open={modal === "record-advance"} onClose={() => setModal(null)}
        bookingId={bId} hotelId={hId}
        hotelBookingNumber={hb.booking_number}
        totalAmount={totalAmount} advancePaid={advancePaid} balanceDue={balanceDue}
      />
      <HotelCollectPaymentModal
        open={modal === "collect-payment"} onClose={() => setModal(null)}
        bookingId={bId} hotelId={hId}
        hotelBookingNumber={hb.booking_number}
        invoiceNumber={hb.invoice_number ?? null}
        grandTotal={totalAmount} advancePaid={advancePaid} balanceDue={balanceDue}
      />
      <HotelSettlementModal
        open={modal === "settle"} onClose={() => setModal(null)}
        bookingId={bId} hotelId={hId}
        reservationNumber={hb.booking_number}
        hotelBookingNumber={hb.booking_number}
      />
      <GenerateInvoiceModal
        open={modal === "generate-invoice"} onClose={() => setModal(null)}
        bookingId={bId} hotelId={hId}
        hotelBookingNumber={hb.booking_number}
        totalAmount={totalAmount} advancePaid={advancePaid} balanceDue={balanceDue}
        payments={hb.advance_payments ?? []}
        payStatus={payStatus}
      />

      <SwitchHotelModal
        open={modal === "switch-hotel"} onClose={() => setModal(null)}
        bookingId={bId} hotelId={hId} hb={hb}
        onDone={() => refetch()}
      />
      <SplitStayModal
        open={modal === "split-stay"} onClose={() => setModal(null)}
        bookingId={bId} hotelId={hId} hb={hb}
        onDone={() => refetch()}
      />
    </Box>
  );
}
