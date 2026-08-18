// ============================================================
// WAYTERO ADMIN — BOOKINGS PAGE (Full Premium Implementation)
// Shows: Stats bar, filter bar, master bookings table,
//        service type badges, cab status, quick actions
// Routing: /bookings → list | /bookings/:id/cab/:cabId → detail
// Backend: /admin/bookings  (booking_api.py)
// ============================================================
import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Card, CardContent, Chip, Button, Stack,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Avatar, Tooltip, IconButton, Grid,
  Alert, CircularProgress, Skeleton, Paper, Badge,
  InputAdornment, alpha, useTheme, Divider,
} from "@mui/material";
import {
  DirectionsCar, Hotel, Tour, Search, Refresh, OpenInNew,
  FilterList, PersonAdd, AssignmentInd, CheckCircle, Cancel,
  AccessTime, AttachMoney, CalendarMonth, LocationCity,
  TrendingUp, PendingActions, Assessment, EventBusy, Visibility,
} from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { bookingService, BookingListItem, BookingStats, PaginatedBookings } from "../../services/booking.service";
import { format } from "date-fns";
import { useRealtime } from "../../hooks/useRealtime";

// ── Status Config ─────────────────────────────────────────────
const BOOKING_STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_PAYMENT", label: "Pending Payment" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CLOSED", label: "Closed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const BOOKING_STATUS_CONFIG: Record<string, { color: "default" | "primary" | "success" | "warning" | "error" | "info" | "secondary" }> = {
  DRAFT:           { color: "default" },
  PENDING_PAYMENT: { color: "warning" },
  CONFIRMED:       { color: "primary" },
  IN_PROGRESS:     { color: "info" },
  COMPLETED:       { color: "success" },
  CLOSED:          { color: "success" },
  CANCELLED:       { color: "error" },
};

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

// Hotel reservations carry their own lifecycle (reservation_status) that the
// coarse master booking_status never reflects — surface it here, colours/labels
// kept in sync with HotelBookingDetailPage.
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

// Tour bookings carry their own lifecycle (booking_status) that the coarse
// master booking_status never reflects — surface it here, labels kept in sync
// with TourBookingDetailPage.
const TOUR_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  PENDING_CONFIRMATION: { color: "#F59E0B", label: "Awaiting Accept" },
  CONFIRMED:            { color: "#3B82F6", label: "Confirmed" },
  IN_PROGRESS:          { color: "#06B6D4", label: "In Progress" },
  COMPLETED:            { color: "#10B981", label: "Completed" },
  SETTLEMENT_PENDING:   { color: "#8B5CF6", label: "Settlement Pending" },
  SETTLED:              { color: "#6366F1", label: "Settled" },
  CANCELLED:            { color: "#EF4444", label: "Cancelled" },
};

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  CAB:   <DirectionsCar sx={{ fontSize: 14 }} />,
  HOTEL: <Hotel sx={{ fontSize: 14 }} />,
  TOUR:  <Tour sx={{ fontSize: 14 }} />,
};

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ label, value, icon, color, loading }: {
  label: string; value: number | undefined; icon: React.ReactNode; color: string; loading?: boolean;
}) {
  const theme = useTheme();
  return (
    <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", height: "100%" }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
          <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: alpha(color, 0.1), color }}>{icon}</Box>
        </Stack>
        {loading ? <Skeleton width={60} height={36} /> : (
          <Typography variant="h4" fontWeight={800} sx={{ color, lineHeight: 1 }}>{value?.toLocaleString() ?? 0}</Typography>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>{label}</Typography>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function BookingsPage() {
  const navigate = useNavigate();
  const theme = useTheme();

  // Filters
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [bookingStatus, setBookingStatus] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [journeyDate, setJourneyDate] = useState("");

  // Stats
  const { data: stats, isLoading: statsLoading } = useQuery<BookingStats>({
    queryKey: ["admin-booking-stats"],
    queryFn: () => bookingService.stats(),
    staleTime: 30_000,
  });

  // List
  const { data, isLoading, isError, refetch } = useQuery<PaginatedBookings>({
    queryKey: ["admin-bookings", page + 1, pageSize, bookingStatus, serviceType, search, journeyDate],
    queryFn: () => bookingService.list({
      page: page + 1,
      page_size: pageSize,
      booking_status: bookingStatus || undefined,
      service_type: serviceType || undefined,
      search: search || undefined,
      journey_date: journeyDate || undefined,
    }),
    staleTime: 15_000,
  });

  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    setPage(0);
  }, [searchInput]);

  const handleReset = () => {
    setSearch(""); setSearchInput(""); setBookingStatus("");
    setServiceType(""); setJourneyDate(""); setPage(0);
  };

  // ── Realtime: refetch list + stats when any booking status changes ──
  const { subscribe } = useRealtime();
  const queryClient = useQueryClient();
  useEffect(() => {
    const unsub = subscribe<{ master_booking_id: number }>("BOOKING_UPDATED", () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-booking-stats"] });
    });
    return unsub;
  }, [subscribe, queryClient]);

  const handleViewBooking = (item: BookingListItem) => {
    // If has cab, go to cab detail for first cab
    if (item.services.includes("CAB")) {
      // We need cabId — fetch detail first or navigate to booking detail
      // For now navigate to a booking detail that shows cab list
      navigate(`/bookings/${item.id}`);
    } else {
      navigate(`/bookings/${item.id}`);
    }
  };

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <Box>
      {/* ── Page Header ── */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Bookings</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage all platform bookings — assign partners, drivers, and track trips
          </Typography>
        </Box>
        <Tooltip title="Refresh data">
          <IconButton onClick={() => refetch()} sx={{ border: "1px solid", borderColor: "divider" }}>
            <Refresh fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* ── Stats Row ── */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard label="Total" value={stats?.total} icon={<Assessment fontSize="small" />} color="#3B82F6" loading={statsLoading} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard label="Today" value={stats?.today_bookings} icon={<CalendarMonth fontSize="small" />} color="#8B5CF6" loading={statsLoading} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard label="Pending Assignment" value={stats?.pending_assignment} icon={<PendingActions fontSize="small" />} color="#F59E0B" loading={statsLoading} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard label="Confirmed" value={stats?.confirmed} icon={<CheckCircle fontSize="small" />} color="#06B6D4" loading={statsLoading} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard label="Completed" value={stats?.completed} icon={<TrendingUp fontSize="small" />} color="#22C55E" loading={statsLoading} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard label="Cancelled" value={stats?.cancelled} icon={<EventBusy fontSize="small" />} color="#EF4444" loading={statsLoading} />
        </Grid>
      </Grid>

      {/* ── Filter Bar ── */}
      <Card sx={{ borderRadius: 3, mb: 3, border: "1px solid", borderColor: "divider", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
        <CardContent sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4} md={3}>
              <TextField
                size="small" fullWidth
                placeholder="Search booking #, name, mobile..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>Status</InputLabel>
                <Select value={bookingStatus} label="Status" onChange={(e) => { setBookingStatus(e.target.value); setPage(0); }}>
                  {BOOKING_STATUS_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>Service</InputLabel>
                <Select value={serviceType} label="Service" onChange={(e) => { setServiceType(e.target.value); setPage(0); }}>
                  <MenuItem value="">All Services</MenuItem>
                  <MenuItem value="CAB">Cab</MenuItem>
                  <MenuItem value="HOTEL">Hotel</MenuItem>
                  <MenuItem value="TOUR">Tour</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField
                size="small" fullWidth
                label="Journey Date"
                type="date"
                value={journeyDate}
                onChange={(e) => { setJourneyDate(e.target.value); setPage(0); }}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={12} md={3}>
              <Stack direction="row" gap={1}>
                <Button variant="contained" size="small" onClick={handleSearch} startIcon={<Search />}>Search</Button>
                <Button variant="outlined" size="small" onClick={handleReset} color="inherit">Reset</Button>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ── Table ── */}
      <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
        {isError && (
          <Alert severity="error" sx={{ m: 2 }}>
            Failed to load bookings. <Button size="small" onClick={() => refetch()}>Retry</Button>
          </Alert>
        )}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                {["Booking #", "Customer", "Services", "Journey Date", "Amount", "Payment", "Status", "Service Status", "Action"].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.8rem", py: 1.5, color: "text.secondary", whiteSpace: "nowrap" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((__, j) => (
                    <TableCell key={j}><Skeleton variant="text" /></TableCell>
                  ))}
                </TableRow>
              ))}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                    <Stack alignItems="center" gap={1}>
                      <Assessment sx={{ fontSize: 48, color: "text.disabled" }} />
                      <Typography variant="body1" color="text.secondary" fontWeight={600}>No bookings found</Typography>
                      <Typography variant="body2" color="text.disabled">Try adjusting filters or search</Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              )}
              {rows.map((item) => {
                const bStatusCfg = BOOKING_STATUS_CONFIG[item.booking_status];
                const cabStatusCfg = item.cab_status ? CAB_STATUS_CONFIG[item.cab_status] : null;
                const hotelStatusCfg = item.hotel_status ? HOTEL_STATUS_CONFIG[item.hotel_status] : null;
                const tourStatusCfg = item.tour_status ? TOUR_STATUS_CONFIG[item.tour_status] : null;
                // Fall back to the raw enum (spaced) if an unmapped status ever arrives,
                // so a value always renders rather than silently collapsing to "—".
                const serviceStatus =
                  cabStatusCfg
                    ? { color: cabStatusCfg.color, label: cabStatusCfg.label }
                    : hotelStatusCfg
                    ? { color: hotelStatusCfg.color, label: hotelStatusCfg.label }
                    : tourStatusCfg
                    ? { color: tourStatusCfg.color, label: tourStatusCfg.label }
                    : item.cab_status
                    ? { color: "#6B7280", label: item.cab_status.replace(/_/g, " ") }
                    : item.hotel_status
                    ? { color: "#6B7280", label: item.hotel_status.replace(/_/g, " ") }
                    : item.tour_status
                    ? { color: "#6B7280", label: item.tour_status.replace(/_/g, " ") }
                    : null;
                return (
                  <TableRow
                    key={item.id}
                    hover
                    sx={{ cursor: "pointer", "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.02) } }}
                    onClick={() => handleViewBooking(item)}
                  >
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography variant="body2" fontWeight={700} fontFamily="monospace" color="primary.main">
                        {item.booking_number}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        {format(new Date(item.created_at), "dd MMM yy")}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography variant="body2" fontWeight={600}>{item.customer_name || "—"}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.customer_mobile}</Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Stack direction="row" gap={0.5} flexWrap="wrap">
                        {item.services.map((svc) => (
                          <Chip
                            key={svc}
                            icon={SERVICE_ICONS[svc] as any}
                            label={svc}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: "0.7rem", height: 22 }}
                          />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography variant="body2">{item.journey_start_date || "—"}</Typography>
                      {item.city_name && (
                        <Typography variant="caption" color="text.secondary">{item.city_name}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography variant="body2" fontWeight={700}>₹{item.total_amount.toLocaleString()}</Typography>
                      <Typography variant="caption" color="success.main">Paid: ₹{item.total_paid_amount.toLocaleString()}</Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Chip
                        label={item.payment_status}
                        size="small"
                        color={item.payment_status === "PAID" ? "success" : item.payment_status === "PENDING" ? "warning" : "default"}
                        sx={{ fontSize: "0.7rem", height: 22 }}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      <Chip
                        label={item.booking_status.replace(/_/g, " ")}
                        size="small"
                        color={bStatusCfg?.color || "default"}
                        sx={{ fontSize: "0.7rem", height: 22, fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }}>
                      {serviceStatus ? (
                        <Box sx={{
                          display: "inline-block", px: 1.25, py: 0.375,
                          bgcolor: alpha(serviceStatus.color, 0.12),
                          color: serviceStatus.color,
                          borderRadius: 1.5, fontSize: "0.7rem", fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}>
                          {serviceStatus.label}
                        </Box>
                      ) : "—"}
                    </TableCell>
                    <TableCell sx={{ py: 1.5 }} onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="View & Manage">
                        <IconButton size="small" color="primary" onClick={() => handleViewBooking(item)}>
                          <OpenInNew fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <Divider />
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={pageSize}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      </Card>
    </Box>
  );
}
