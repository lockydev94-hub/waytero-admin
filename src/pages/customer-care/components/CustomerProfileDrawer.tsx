// ============================================================
// CUSTOMER CARE — CUSTOMER PROFILE DRAWER
// Shows profile summary + paginated bookings + paginated issues
// ============================================================
import { useEffect, useState } from "react";
import {
  Drawer, Box, Stack, Typography, Avatar, Chip, Divider,
  IconButton, Tabs, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Button,
  CircularProgress, alpha, useTheme, Tooltip, Badge,
  Pagination, Alert, Menu, MenuItem, ListItemIcon, ListItemText,
} from "@mui/material";
import {
  Close, CheckCircle, DirectionsCar, HeadsetMic,
  CalendarMonth, Email, Phone, Badge as BadgeIcon,
  OpenInNew, AddCircleOutline, ReportProblem, Hotel, TravelExplore, ChevronRight,
} from "@mui/icons-material";
import { format } from "date-fns";
import {
  customerCareService,
  CustomerLookup,
  CustomerPreviousRecords,
  CustomerBookingHistoryItem,
  CareLogItem,
} from "../../../services/customerCare.service";

// ── Status helpers ────────────────────────────────────────────
const BOOKING_STATUS_COLOR: Record<string, "default" | "warning" | "info" | "success" | "error"> = {
  PENDING: "warning", CONFIRMED: "info", IN_PROGRESS: "info",
  COMPLETED: "success", CANCELLED: "error", REFUNDED: "default",
};

const ISSUE_STATUS_COLOR: Record<string, "default" | "warning" | "info" | "success" | "error"> = {
  OPEN: "warning", IN_PROGRESS: "info", RESOLVED: "success",
  CLOSED: "default", CANCELLED: "error",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "#6B7280", MEDIUM: "#3B82F6", HIGH: "#F59E0B", URGENT: "#EF4444",
};

// ── Info Row helper ───────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | undefined | null }) {
  if (!value) return null;
  return (
    <Stack direction="row" alignItems="center" gap={1.5} py={0.75}>
      <Box sx={{ color: "text.secondary", display: "flex" }}>{icon}</Box>
      <Box>
        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">{label}</Typography>
        <Typography fontSize={13} fontWeight={500}>{value}</Typography>
      </Box>
    </Stack>
  );
}

// ── Props ─────────────────────────────────────────────────────
interface Props {
  open: boolean;
  customer: CustomerLookup | null;
  onClose: () => void;
  onCreateBooking: (customer: CustomerLookup, service?: "CAB" | "HOTEL" | "TOUR") => void;
  onLogIssue: (customer: CustomerLookup) => void;
}

export default function CustomerProfileDrawer({ open, customer, onClose, onCreateBooking, onLogIssue }: Props) {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [records, setRecords] = useState<CustomerPreviousRecords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Service-picker menu anchored to whichever "Create Booking" button was clicked.
  const [bookingMenuAnchor, setBookingMenuAnchor] = useState<null | HTMLElement>(null);
  const openBookingMenu = (e: React.MouseEvent<HTMLElement>) => setBookingMenuAnchor(e.currentTarget);
  const pickService = (service: "CAB" | "HOTEL" | "TOUR") => {
    setBookingMenuAnchor(null);
    if (customer) onCreateBooking(customer, service);
  };
  const [bPage, setBPage] = useState(1);
  const [iPage, setIPage] = useState(1);

  const PAGE_SIZE = 8;

  useEffect(() => {
    if (!open || !customer?.customer_id) return;
    setTab(0); setBPage(1); setIPage(1); setRecords(null);
    loadRecords(1, 1);
  }, [open, customer?.customer_id]);

  async function loadRecords(bp: number, ip: number) {
    if (!customer?.customer_id) return;
    setLoading(true); setError("");
    try {
      const data = await customerCareService.getCustomerRecords(customer.customer_id, {
        booking_page: bp, issue_page: ip, page_size: PAGE_SIZE,
      });
      setRecords(data);
    } catch {
      setError("Failed to load customer records.");
    } finally {
      setLoading(false);
    }
  }

  function handleBPageChange(_: any, p: number) { setBPage(p); loadRecords(p, iPage); }
  function handleIPageChange(_: any, p: number) { setIPage(p); loadRecords(bPage, p); }

  const avatarLetter = (customer?.full_name || "?")[0]?.toUpperCase() ?? "?";

  return (
    <Drawer
      anchor="right" open={open} onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100vw", sm: 520 }, borderRadius: "16px 0 0 16px" } }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>

        {/* Header */}
        <Box sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          p: 3, color: "#fff", flexShrink: 0,
        }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={2}>
            <Typography fontWeight={700} fontSize={16} sx={{ opacity: 0.85 }}>Customer Profile</Typography>
            <IconButton onClick={onClose} size="small" sx={{ color: "rgba(255,255,255,0.7)", mt: -0.5 }}>
              <Close fontSize="small" />
            </IconButton>
          </Stack>

          <Stack direction="row" alignItems="center" gap={2}>
            <Avatar sx={{ width: 56, height: 56, fontWeight: 800, fontSize: 22, bgcolor: "rgba(255,255,255,0.22)" }}>
              {avatarLetter}
            </Avatar>
            <Box flex={1}>
              <Typography fontWeight={800} fontSize={20}>{customer?.full_name || "—"}</Typography>
              <Typography fontSize={13} sx={{ opacity: 0.8 }}>{customer?.mobile_number}</Typography>
              {customer?.customer_code && (
                <Typography variant="caption" fontFamily="monospace" sx={{ opacity: 0.7 }}>
                  {customer.customer_code}
                </Typography>
              )}
            </Box>
            <Chip
              size="small"
              icon={<CheckCircle sx={{ fontSize: "13px !important", color: "inherit !important" }} />}
              label={customer?.is_active ? "Active" : "Inactive"}
              sx={{
                fontWeight: 700, fontSize: 11,
                bgcolor: customer?.is_active ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
                color: customer?.is_active ? "#86EFAC" : "#FCA5A5",
                border: "1px solid",
                borderColor: customer?.is_active ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)",
              }}
            />
          </Stack>

          {/* Stats chips */}
          <Stack direction="row" gap={1.5} mt={2}>
            <Box sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: "rgba(255,255,255,0.12)", textAlign: "center", flex: 1 }}>
              <Typography fontWeight={800} fontSize={18}>{customer?.total_bookings ?? 0}</Typography>
              <Typography fontSize={11} sx={{ opacity: 0.75 }}>Bookings</Typography>
            </Box>
            <Box sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: "rgba(255,255,255,0.12)", textAlign: "center", flex: 1 }}>
              <Typography fontWeight={800} fontSize={18}>{customer?.total_issues ?? 0}</Typography>
              <Typography fontSize={11} sx={{ opacity: 0.75 }}>Issues</Typography>
            </Box>
            {customer?.created_at && (
              <Box sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: "rgba(255,255,255,0.12)", textAlign: "center", flex: 1 }}>
                <Typography fontWeight={800} fontSize={14}>{format(new Date(customer.created_at), "MMM yy")}</Typography>
                <Typography fontSize={11} sx={{ opacity: 0.75 }}>Member Since</Typography>
              </Box>
            )}
          </Stack>
        </Box>

        {/* Action buttons */}
        <Stack direction="row" gap={1.5} p={2} sx={{ borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
          <Button
            variant="contained" startIcon={<AddCircleOutline />} fullWidth
            onClick={openBookingMenu}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700, py: 1.25,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})` }}
          >
            Create Booking
          </Button>
          <Button
            variant="outlined" startIcon={<ReportProblem />} fullWidth
            onClick={() => { if (customer) onLogIssue(customer); }}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700, py: 1.25 }}
          >
            Log Issue
          </Button>
        </Stack>

        {/* Contact info */}
        {(customer?.email) && (
          <Box px={2.5} py={1.5} sx={{ borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
            <InfoRow icon={<Email sx={{ fontSize: 16 }} />} label="Email" value={customer?.email} />
          </Box>
        )}

        {/* Tabs: Bookings | Issues */}
        <Box sx={{ borderBottom: "1px solid", borderColor: "divider", flexShrink: 0, px: 1 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
            "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: 13 },
          }}>
            <Tab label={
              <Stack direction="row" alignItems="center" gap={1}>
                <DirectionsCar sx={{ fontSize: 16 }} />
                Bookings
                {records && (
                  <Chip size="small" label={records.booking_total} sx={{ height: 18, fontSize: 11, fontWeight: 700 }} />
                )}
              </Stack>
            } />
            <Tab label={
              <Stack direction="row" alignItems="center" gap={1}>
                <HeadsetMic sx={{ fontSize: 16 }} />
                Issues
                {records && (
                  <Chip size="small" label={records.issue_total}
                    color={records.issue_total > 0 ? "warning" : "default"}
                    sx={{ height: 18, fontSize: 11, fontWeight: 700 }} />
                )}
              </Stack>
            } />
          </Tabs>
        </Box>

        {/* Tab content */}
        <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={6}>
              <CircularProgress size={32} />
            </Box>
          ) : (
            <>
              {/* BOOKINGS TAB */}
              {tab === 0 && (
                <Box>
                  {!records || records.bookings.length === 0 ? (
                    <Box textAlign="center" py={6}>
                      <DirectionsCar sx={{ fontSize: 40, color: "text.disabled" }} />
                      <Typography color="text.secondary" mt={1}>No bookings yet</Typography>
                      <Button variant="outlined" startIcon={<AddCircleOutline />} size="small"
                        onClick={openBookingMenu}
                        sx={{ mt: 1.5, borderRadius: 2, textTransform: "none" }}>
                        Create First Booking
                      </Button>
                    </Box>
                  ) : (
                    <>
                      <Stack gap={1.5}>
                        {records.bookings.map((b) => (
                          <BookingCard key={b.id} booking={b} />
                        ))}
                      </Stack>
                      {records.booking_pages > 1 && (
                        <Box display="flex" justifyContent="center" mt={2}>
                          <Pagination
                            count={records.booking_pages} page={bPage} onChange={handleBPageChange}
                            size="small" color="primary"
                          />
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              )}

              {/* ISSUES TAB */}
              {tab === 1 && (
                <Box>
                  {!records || records.issues.length === 0 ? (
                    <Box textAlign="center" py={6}>
                      <HeadsetMic sx={{ fontSize: 40, color: "text.disabled" }} />
                      <Typography color="text.secondary" mt={1}>No issues logged</Typography>
                      <Button variant="outlined" startIcon={<AddCircleOutline />} size="small"
                        onClick={() => { if (customer) onLogIssue(customer); }}
                        sx={{ mt: 1.5, borderRadius: 2, textTransform: "none" }}>
                        Log First Issue
                      </Button>
                    </Box>
                  ) : (
                    <>
                      <Stack gap={1.5}>
                        {records.issues.map((issue) => (
                          <IssueCard key={issue.id} issue={issue} />
                        ))}
                      </Stack>
                      {records.issue_pages > 1 && (
                        <Box display="flex" justifyContent="center" mt={2}>
                          <Pagination
                            count={records.issue_pages} page={iPage} onChange={handleIPageChange}
                            size="small" color="primary"
                          />
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              )}
            </>
          )}
        </Box>
      </Box>

      {/* Service picker — shared by all "Create Booking" triggers */}
      <Menu
        anchorEl={bookingMenuAnchor}
        open={Boolean(bookingMenuAnchor)}
        onClose={() => setBookingMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 240, mt: 0.5 } }}
      >
        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ px: 2, pt: 1, display: "block" }}>
          SELECT SERVICE
        </Typography>
        <MenuItem onClick={() => pickService("CAB")} sx={{ py: 1.25 }}>
          <ListItemIcon><DirectionsCar sx={{ color: "#2563EB" }} /></ListItemIcon>
          <ListItemText primary="Cab Booking" secondary="Point-to-point, rentals, outstation"
            primaryTypographyProps={{ fontWeight: 700, fontSize: 14 }}
            secondaryTypographyProps={{ fontSize: 11 }} />
          <ChevronRight sx={{ color: "text.disabled" }} />
        </MenuItem>
        <MenuItem onClick={() => pickService("HOTEL")} sx={{ py: 1.25 }}>
          <ListItemIcon><Hotel sx={{ color: "#7C3AED" }} /></ListItemIcon>
          <ListItemText primary="Hotel Booking" secondary="Rooms priced live with taxes"
            primaryTypographyProps={{ fontWeight: 700, fontSize: 14 }}
            secondaryTypographyProps={{ fontSize: 11 }} />
          <ChevronRight sx={{ color: "text.disabled" }} />
        </MenuItem>
        <MenuItem onClick={() => pickService("TOUR")} sx={{ py: 1.25 }}>
          <ListItemIcon><TravelExplore sx={{ color: "#059669" }} /></ListItemIcon>
          <ListItemText primary="Tour Package" secondary="Curated itinerary with package pricing"
            primaryTypographyProps={{ fontWeight: 700, fontSize: 14 }} secondaryTypographyProps={{ fontSize: 11 }} />
        </MenuItem>
      </Menu>
    </Drawer>
  );
}

// ── Booking card ──────────────────────────────────────────────
function BookingCard({ booking }: { booking: CustomerBookingHistoryItem }) {
  const theme = useTheme();
  const sc = BOOKING_STATUS_COLOR[booking.booking_status] ?? "default";
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, "&:hover": { boxShadow: 2 }, transition: "box-shadow 0.15s" }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
        <Box>
          <Typography fontSize={13} fontWeight={700} fontFamily="monospace" color="primary.main">
            {booking.booking_number}
          </Typography>
          {booking.city_name && (
            <Typography fontSize={12} color="text.secondary">{booking.city_name}</Typography>
          )}
        </Box>
        <Chip size="small" label={booking.booking_status.replace(/_/g, " ")} color={sc}
          sx={{ fontWeight: 700, fontSize: 11 }} />
      </Stack>
      <Stack direction="row" justifyContent="space-between" mt={1.5} flexWrap="wrap" gap={1}>
        <Stack direction="row" gap={2}>
          {booking.total_amount != null && (
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>Amount</Typography>
              <Typography fontSize={13} fontWeight={700} color="success.main">
                ₹{booking.total_amount.toLocaleString()}
              </Typography>
            </Box>
          )}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Payment</Typography>
            <Typography fontSize={12} fontWeight={600}>{booking.payment_status}</Typography>
          </Box>
        </Stack>
        <Box textAlign="right">
          <Typography variant="caption" color="text.secondary" fontWeight={600}>Created</Typography>
          <Typography fontSize={12}>{format(new Date(booking.created_at), "dd MMM yy")}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

// ── Issue card ────────────────────────────────────────────────
function IssueCard({ issue }: { issue: CareLogItem }) {
  const sc = ISSUE_STATUS_COLOR[issue.status] ?? "default";
  const pc = PRIORITY_COLORS[issue.priority] ?? "#6B7280";
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, "&:hover": { boxShadow: 2 }, transition: "box-shadow 0.15s" }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
        <Box flex={1} mr={1}>
          <Typography fontSize={12} fontWeight={700} fontFamily="monospace" color="secondary.main">
            {issue.log_number}
          </Typography>
          <Typography fontSize={13} fontWeight={600} noWrap>{issue.subject}</Typography>
          <Typography fontSize={12} color="text.secondary" noWrap>{issue.issue_type.replace(/_/g, " ")}</Typography>
        </Box>
        <Stack alignItems="flex-end" gap={0.5}>
          <Chip size="small" label={issue.status.replace(/_/g, " ")} color={sc}
            sx={{ fontWeight: 700, fontSize: 11 }} />
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: pc }} />
            <Typography fontSize={11} color={pc} fontWeight={600}>{issue.priority}</Typography>
          </Box>
        </Stack>
      </Stack>
      <Typography fontSize={12} color="text.secondary" mt={1}>
        {format(new Date(issue.created_at), "dd MMM yy, HH:mm")}
        {issue.booking_number && ` · ${issue.booking_number}`}
      </Typography>
    </Paper>
  );
}
