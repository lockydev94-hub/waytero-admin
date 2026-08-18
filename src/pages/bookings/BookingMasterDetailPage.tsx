// ============================================================
// WAYTERO ADMIN — MASTER BOOKING DETAIL PAGE
// Shows all services in a master booking (MTB).
// For CAB: click manage → CabBookingDetailPage
// For HOTEL/TOUR: Coming Soon
// Route: /bookings/:bookingId
// ============================================================
import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import {
  Box, Typography, Card, CardContent, Chip, Button, Stack,
  Grid, Avatar, Divider, CircularProgress, Alert,
  Table, TableBody, TableCell, TableRow, Paper,
  IconButton, Tooltip, useTheme, alpha,
} from "@mui/material";
import {
  ArrowBack, DirectionsCar, Hotel, Tour, LocationOn,
  AccessTime, Payment, OpenInNew, Person, Schedule,
  AttachMoney, Refresh, ConfirmationNumber, KingBed, CalendarMonth,
} from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { bookingService, BookingDetail, CabBookingOut, HotelBookingOut } from "../../services/booking.service";
import { format } from "date-fns";
import { useRealtime } from "../../hooks/useRealtime";

const CAB_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  PENDING_ASSIGNMENT: { color: "#F59E0B", label: "Pending Assignment" },
  ASSIGNED:           { color: "#3B82F6", label: "Partner Assigned" },
  DRIVER_ASSIGNED:    { color: "#8B5CF6", label: "Driver Assigned" },
  STARTED:            { color: "#06B6D4", label: "In Trip" },
  COMPLETED:          { color: "#22C55E", label: "Completed" },
  SETTLEMENT_PENDING: { color: "#F97316", label: "Settlement Pending" },
  SETTLED:            { color: "#10B981", label: "Settled" },
  BREAKDOWN_REPORTED: { color: "#DC2626", label: "Vehicle Breakdown" },
  AWAITING_SWAP:      { color: "#EA580C", label: "Awaiting Replacement" },
  CANCELLED:          { color: "#EF4444", label: "Cancelled" },
};

const HOTEL_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  PENDING_PAYMENT:             { color: "#F59E0B", label: "Pending Payment" },
  AWAITING_HOTEL_CONFIRMATION: { color: "#3B82F6", label: "Awaiting Confirmation" },
  CONFIRMED:                   { color: "#8B5CF6", label: "Confirmed" },
  CHECKED_IN:                  { color: "#06B6D4", label: "Checked In" },
  IN_HOUSE:                    { color: "#0EA5E9", label: "In House" },
  CHECKED_OUT:                 { color: "#22C55E", label: "Checked Out" },
  COMPLETED:                   { color: "#10B981", label: "Completed" },
  SETTLED:                     { color: "#16A34A", label: "Settled" },
  CANCELLED:                   { color: "#EF4444", label: "Cancelled" },
  REJECTED:                    { color: "#DC2626", label: "Rejected" },
  NO_SHOW:                     { color: "#6B7280", label: "No Show" },
};

const BOOKING_STATUS_CONFIG: Record<string, { color: "default" | "primary" | "success" | "warning" | "error" | "info" }> = {
  DRAFT:           { color: "default" },
  PENDING_PAYMENT: { color: "warning" },
  CONFIRMED:       { color: "primary" },
  IN_PROGRESS:     { color: "info" },
  COMPLETED:       { color: "success" },
  CLOSED:          { color: "success" },
  CANCELLED:       { color: "error" },
};

export default function BookingMasterDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const bId = Number(bookingId);

  const { data: booking, isLoading, isError, refetch } = useQuery<BookingDetail>({
    queryKey: ["admin-booking", bId],
    queryFn: () => bookingService.get(bId),
    enabled: !!bId,
  });

  // ── Realtime: refresh when this master booking's services change status ──
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

  if (isLoading) return (
    <Box display="flex" alignItems="center" justifyContent="center" minHeight="60vh" gap={2} flexDirection="column">
      <CircularProgress />
      <Typography color="text.secondary">Loading booking...</Typography>
    </Box>
  );
  if (isError || !booking) return (
    <Box p={4}><Alert severity="error">Failed to load booking. <Button onClick={() => refetch()}>Retry</Button></Alert></Box>
  );

  const bStatus = BOOKING_STATUS_CONFIG[booking.booking_status];

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <IconButton onClick={() => navigate("/bookings")} sx={{ border: "1px solid", borderColor: "divider" }}>
            <ArrowBack />
          </IconButton>
          <Box>
            <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
              <Typography variant="h5" fontWeight={800}>Master Booking</Typography>
              <Chip label={booking.booking_number} variant="outlined" sx={{ fontFamily: "monospace", fontWeight: 700 }} size="small" />
              <Chip label={booking.booking_status.replace(/_/g, " ")} color={bStatus?.color || "default"} size="small" />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {booking.customer_name} · {booking.city_name}
            </Typography>
          </Box>
        </Stack>
        <Tooltip title="Refresh"><IconButton onClick={() => refetch()} size="small"><Refresh /></IconButton></Tooltip>
      </Stack>

      <Grid container spacing={3}>
        {/* Left: Services */}
        <Grid item xs={12} lg={8}>
          <Stack gap={3}>
            {/* Cab Bookings */}
            {(booking.cab_bookings?.length ?? 0) > 0 && (
              <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
                <CardContent sx={{ p: 0 }}>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
                    <DirectionsCar color="primary" />
                    <Typography variant="subtitle1" fontWeight={700}>Cab Bookings</Typography>
                    <Chip label={booking.cab_bookings?.length ?? 0} size="small" color="primary" />
                  </Stack>
                  <Stack divider={<Divider />}>
                    {(booking.cab_bookings ?? []).map((cab) => {
                      const cabCfg = CAB_STATUS_CONFIG[cab.booking_status];
                      return (
                        <Box key={cab.id} sx={{ px: 2.5, py: 2 }}>
                          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2}>
                            <Box flex={1}>
                              <Stack direction="row" alignItems="center" gap={1} mb={1}>
                                <Typography variant="body2" fontWeight={700} fontFamily="monospace" color="primary.main">{cab.booking_number}</Typography>
                                <Chip label={cab.trip_type || "—"} size="small" variant="outlined" sx={{ fontSize: "0.7rem", height: 20 }} />
                                {cabCfg && (
                                  <Box sx={{ px: 1.25, py: 0.25, bgcolor: alpha(cabCfg.color, 0.12), color: cabCfg.color, borderRadius: 1.5, fontSize: "0.7rem", fontWeight: 700 }}>
                                    {cabCfg.label}
                                  </Box>
                                )}
                              </Stack>
                              <Stack direction="row" flexWrap="wrap" gap={2}>
                                <Stack direction="row" alignItems="center" gap={0.5}>
                                  <LocationOn sx={{ fontSize: 14, color: "text.secondary" }} />
                                  <Typography variant="caption" color="text.secondary">{cab.pickup_location} → {cab.drop_location}</Typography>
                                </Stack>
                                {cab.pickup_datetime && (
                                  <Stack direction="row" alignItems="center" gap={0.5}>
                                    <AccessTime sx={{ fontSize: 14, color: "text.secondary" }} />
                                    <Typography variant="caption" color="text.secondary">{format(new Date(cab.pickup_datetime), "dd MMM, hh:mm a")}</Typography>
                                  </Stack>
                                )}
                              </Stack>
                              <Stack direction="row" flexWrap="wrap" gap={2} mt={1}>
                                {cab.assigned_partner_name && (
                                  <Typography variant="caption"><strong>Partner:</strong> {cab.assigned_partner_name}</Typography>
                                )}
                                {cab.assigned_driver_name && (
                                  <Typography variant="caption"><strong>Driver:</strong> {cab.assigned_driver_name}</Typography>
                                )}
                                {cab.assigned_vehicle_reg && (
                                  <Typography variant="caption"><strong>Vehicle:</strong> {cab.assigned_vehicle_reg}</Typography>
                                )}
                              </Stack>
                            </Box>
                            <Stack alignItems="flex-end" gap={1}>
                              {cab.estimated_amount && (
                                <Typography variant="body2" fontWeight={700}>Est. ₹{cab.estimated_amount.toLocaleString()}</Typography>
                              )}
                              <Button
                                variant="contained" size="small" startIcon={<OpenInNew fontSize="small" />}
                                onClick={() => navigate(`/bookings/${bId}/cab/${cab.id}`)}
                              >
                                Manage
                              </Button>
                            </Stack>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Hotel Bookings */}
            {(booking.hotel_bookings?.length ?? 0) > 0 && (
              <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
                <CardContent sx={{ p: 0 }}>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
                    <Hotel color="secondary" />
                    <Typography variant="subtitle1" fontWeight={700}>Hotel Bookings</Typography>
                    <Chip label={booking.hotel_bookings?.length ?? 0} size="small" color="secondary" />
                  </Stack>
                  <Stack divider={<Divider />}>
                    {(booking.hotel_bookings ?? []).map((hb) => {
                      const hCfg = HOTEL_STATUS_CONFIG[hb.booking_status];
                      return (
                        <Box key={hb.id} sx={{ px: 2.5, py: 2 }}>
                          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2}>
                            <Box flex={1}>
                              <Stack direction="row" alignItems="center" gap={1} mb={1}>
                                <Typography variant="body2" fontWeight={700} fontFamily="monospace" color="secondary.main">{hb.booking_number}</Typography>
                                {hb.room_type && (
                                  <Chip label={hb.room_type} size="small" variant="outlined" sx={{ fontSize: "0.7rem", height: 20 }} />
                                )}
                                {hCfg && (
                                  <Box sx={{ px: 1.25, py: 0.25, bgcolor: alpha(hCfg.color, 0.12), color: hCfg.color, borderRadius: 1.5, fontSize: "0.7rem", fontWeight: 700 }}>
                                    {hCfg.label}
                                  </Box>
                                )}
                              </Stack>
                              <Stack direction="row" flexWrap="wrap" gap={2}>
                                {hb.hotel_name && (
                                  <Stack direction="row" alignItems="center" gap={0.5}>
                                    <Hotel sx={{ fontSize: 14, color: "text.secondary" }} />
                                    <Typography variant="caption" color="text.secondary">{hb.hotel_name}</Typography>
                                  </Stack>
                                )}
                                {hb.check_in_date && (
                                  <Stack direction="row" alignItems="center" gap={0.5}>
                                    <CalendarMonth sx={{ fontSize: 14, color: "text.secondary" }} />
                                    <Typography variant="caption" color="text.secondary">
                                      {hb.check_in_date} → {hb.check_out_date || "?"}
                                      {hb.num_nights ? ` (${hb.num_nights}N)` : ""}
                                    </Typography>
                                  </Stack>
                                )}
                                {hb.num_rooms && (
                                  <Stack direction="row" alignItems="center" gap={0.5}>
                                    <KingBed sx={{ fontSize: 14, color: "text.secondary" }} />
                                    <Typography variant="caption" color="text.secondary">{hb.num_rooms} room{hb.num_rooms > 1 ? "s" : ""} · {hb.num_guests} guest{(hb.num_guests ?? 1) > 1 ? "s" : ""}</Typography>
                                  </Stack>
                                )}
                              </Stack>
                            </Box>
                            <Stack alignItems="flex-end" gap={1}>
                              {(hb.final_amount ?? hb.base_amount) && (
                                <Typography variant="body2" fontWeight={700}>
                                  ₹{(hb.final_amount ?? hb.base_amount)?.toLocaleString()}
                                </Typography>
                              )}
                              <Button
                                variant="contained" size="small" color="secondary" startIcon={<OpenInNew fontSize="small" />}
                                onClick={() => navigate(`/bookings/${bId}/hotel/${hb.id}`)}
                              >
                                Manage
                              </Button>
                            </Stack>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Tour package bookings */}
            {(booking.tour_bookings?.length ?? 0) > 0 && (
              <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
                <CardContent sx={{ p: 0 }}>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
                    <Tour color="success" />
                    <Typography variant="subtitle1" fontWeight={700}>Tour package bookings</Typography>
                    <Chip label={booking.tour_bookings.length} size="small" color="success" />
                  </Stack>
                  <Stack divider={<Divider />}>
                    {booking.tour_bookings.map((tour) => (
                      <Box key={tour.id} sx={{ px: 2.5, py: 2 }}>
                        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2}>
                          <Box flex={1}>
                            <Stack direction="row" alignItems="center" gap={1} mb={1}>
                              <Typography variant="body2" fontWeight={700} fontFamily="monospace" color="success.main">{tour.booking_number}</Typography>
                              <Chip label={tour.booking_status.replace(/_/g, " ")} size="small" color={tour.booking_status === "COMPLETED" ? "success" : "warning"} sx={{ fontSize: "0.7rem", height: 20 }} />
                            </Stack>
                            <Typography variant="body2" fontWeight={700}>{tour.package_name}</Typography>
                            <Typography variant="caption" color="text.secondary">{tour.destination} · {tour.travel_start_date} → {tour.travel_end_date} · {tour.persons_count} travellers</Typography>
                          </Box>
                          <Stack alignItems="flex-end" gap={1}>
                            <Typography variant="body2" fontWeight={700}>₹{tour.total_amount.toLocaleString()}</Typography>
                            <Button variant="outlined" size="small" color="success" startIcon={<OpenInNew fontSize="small" />} onClick={() => navigate(`/bookings/${bId}/tour/${tour.id}`)}>Manage</Button>
                          </Stack>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>

        {/* Right: Booking Info */}
        <Grid item xs={12} lg={4}>
          <Stack gap={3}>
            {/* Customer */}
            <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
              <CardContent>
                <Stack direction="row" alignItems="center" gap={1} mb={2}>
                  <Person fontSize="small" color="primary" />
                  <Typography variant="subtitle2" fontWeight={700}>Customer</Typography>
                </Stack>
                <Stack alignItems="center" textAlign="center" mb={2}>
                  <Avatar sx={{ width: 44, height: 44, bgcolor: "primary.main", fontWeight: 700, fontSize: "1.1rem", mb: 1 }}>
                    {booking.customer_name?.[0]?.toUpperCase() || "C"}
                  </Avatar>
                  <Typography variant="body2" fontWeight={700}>{booking.customer_name}</Typography>
                  <Typography variant="caption" color="text.secondary">{booking.customer_mobile}</Typography>
                  {booking.customer_email && <Typography variant="caption" color="text.secondary">{booking.customer_email}</Typography>}
                </Stack>
                <Table size="small">
                  <TableBody>
                    <TableRow sx={{ "& td": { border: 0, py: 0.75, px: 0 } }}>
                      <TableCell sx={{ color: "text.secondary", fontSize: "0.8rem", width: 90 }}>City</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem" }}>{booking.city_name}</TableCell>
                    </TableRow>
                    <TableRow sx={{ "& td": { border: 0, py: 0.75, px: 0 } }}>
                      <TableCell sx={{ color: "text.secondary", fontSize: "0.8rem" }}>Journey</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem" }}>
                        {booking.journey_start_date || "—"}{booking.journey_end_date ? ` → ${booking.journey_end_date}` : ""}
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ "& td": { border: 0, py: 0.75, px: 0 } }}>
                      <TableCell sx={{ color: "text.secondary", fontSize: "0.8rem" }}>Created</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem" }}>
                        {format(new Date(booking.created_at), "dd MMM yyyy")}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Payment Summary */}
            <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
              <CardContent>
                <Stack direction="row" alignItems="center" gap={1} mb={2}>
                  <Payment fontSize="small" color="success" />
                  <Typography variant="subtitle2" fontWeight={700}>Payment</Typography>
                </Stack>
                <Box sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.08), borderRadius: 2, mb: 2 }}>
                  <Typography variant="caption" color="success.dark">Total Amount</Typography>
                  <Typography variant="h5" fontWeight={800} color="success.dark">₹{booking.total_amount.toLocaleString()}</Typography>
                </Box>
                <Table size="small">
                  <TableBody>
                    {[
                      { label: "Paid", value: `₹${booking.total_paid_amount.toLocaleString()}` },
                      { label: "Refund", value: booking.total_refund_amount > 0 ? `₹${booking.total_refund_amount.toLocaleString()}` : "—" },
                      { label: "Status", value: booking.payment_status },
                    ].map((row) => (
                      <TableRow key={row.label} sx={{ "& td": { border: 0, py: 0.75, px: 0 } }}>
                        <TableCell sx={{ color: "text.secondary", fontSize: "0.8rem", width: 80 }}>{row.label}</TableCell>
                        <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem" }}>{row.value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
              <CardContent>
                <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
                  <Schedule fontSize="small" color="info" />
                  <Typography variant="subtitle2" fontWeight={700}>Timeline</Typography>
                </Stack>
                {booking.timeline.length === 0 && (
                  <Typography variant="body2" color="text.disabled" textAlign="center" py={2}>No timeline events</Typography>
                )}
                {booking.timeline.slice(0, 6).map((t, i) => (
                  <Box key={t.id} sx={{ display: "flex", gap: 1.5, py: 1, borderBottom: i < Math.min(booking.timeline.length, 6) - 1 ? "1px solid" : "none", borderColor: "divider" }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "primary.main", mt: 0.7, flexShrink: 0 }} />
                    <Box>
                      <Typography variant="caption" fontWeight={700} color="primary.main" display="block">{t.event_type.replace(/_/g, " ")}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">{t.event_description}</Typography>
                      <Typography variant="caption" color="text.disabled">{format(new Date(t.event_timestamp), "dd MMM, hh:mm a")}</Typography>
                    </Box>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
