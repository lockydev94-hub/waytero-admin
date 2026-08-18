// ============================================================
// WAYTERO ADMIN — PAYMENTS PAGE (Full Implementation)
// Route: /payments
// Doc Ref: Payment API §6, §15, §19, §25, §28
//          DB Schema Part 7 §3,§7
//          Admin payment_api.py
//
// Components:
//   PaymentStatsBar      — 5 KPI cards across the top
//   PaymentFiltersBar    — search + 5 filter dropdowns
//   PaymentTable         — paginated table with inline badge chips
//   PaymentDetailDrawer  — full side drawer with audit trail
//   RefundDialog         — confirm + amount input refund modal
//   DuplicatesPanel      — tab showing duplicate analysis
// ============================================================

import { useState, useCallback, useEffect } from "react";
import {
  Box, Stack, Typography, Grid, Card, CardContent, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, IconButton, Tooltip, alpha, useTheme,
  CircularProgress, InputAdornment, TextField, Button,
  Drawer, Divider, Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, FormControl, InputLabel, Alert,
  Avatar, LinearProgress, Badge, Collapse,
} from "@mui/material";
import {
  CurrencyRupee, Search, Refresh, Close, Receipt,
  Warning, CheckCircle, ErrorOutline, Info,
  ArrowForwardIos, ContentCopy, FilterAlt, ReportProblem,
  Undo, CalendarToday, Person, AccountBalanceWallet,
  SwapHoriz, VisibilityOutlined, History,
  TrendingUp, MonetizationOn, HourglassEmpty,
  KeyboardArrowDown, KeyboardArrowRight,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  paymentService,
  PaymentListFilters,
  PaymentListItem,
  PaymentDetail,
  DuplicateAnalysis,
  IndexViolation,
  RapidRepeatCharge,
} from "../../services/payment.service";

// ─────────────────────────── Helpers ────────────────────────────

const fmtINR = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (s: string | null | undefined) => {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

const copyText = (t: string) => navigator.clipboard.writeText(t).catch(() => {});

const BOOKING_STATUS_META: Record<string, { color: "default" | "warning" | "error" | "success" | "info" | "secondary"; label: string }> = {
  DRAFT:            { color: "default",   label: "Draft"           },
  PENDING_PAYMENT:  { color: "warning",   label: "Pending Payment" },
  CONFIRMED:        { color: "info",      label: "Confirmed"       },
  ASSIGNED:         { color: "info",      label: "Assigned"        },
  IN_PROGRESS:      { color: "secondary", label: "In Progress"     },
  COMPLETED:        { color: "success",   label: "Completed"       },
  CANCELLED:        { color: "error",     label: "Cancelled"       },
  CLOSED:           { color: "default",   label: "Closed"          },
};

const ADVANCE_STATUS_META: Record<string, { color: "success" | "error" | "default"; label: string }> = {
  ACTIVE: { color: "success", label: "Active"  },
  VOIDED: { color: "error",   label: "Voided"  },
};

const MODE_META: Record<string, { color: string; label: string }> = {
  CASH:   { color: "#16A34A", label: "Cash"   },
  UPI:    { color: "#7C3AED", label: "UPI"    },
  ONLINE: { color: "#0369A1", label: "Online" },
};

const BY_META: Record<string, { color: string; label: string }> = {
  ADMIN:   { color: "#0F172A", label: "Admin"   },
  PARTNER: { color: "#B45309", label: "Partner" },
  DRIVER:  { color: "#1D4ED8", label: "Driver"  },
};

// ─────────────────────── PaymentStatsBar ────────────────────────

function PaymentStatsBar({ stats }: { stats: any }) {
  const theme = useTheme();
  const cards = [
    {
      label: "Total Advance Collected",
      value: fmtINR(stats.total_advance_collected),
      sub: `${stats.total_active_advances} active advances`,
      icon: <MonetizationOn />,
      gradient: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
    },
    {
      label: "Today's Collection",
      value: fmtINR(stats.today_advance_collected),
      sub: "Collected today",
      icon: <TrendingUp />,
      gradient: "linear-gradient(135deg, #059669, #10B981)",
    },
    {
      label: "Pending Refunds",
      value: String(stats.pending_refund_count),
      sub: fmtINR(stats.pending_refund_amount) + " refundable",
      icon: <HourglassEmpty />,
      gradient: "linear-gradient(135deg, #B45309, #F59E0B)",
    },
    {
      label: "Admin Held Advances",
      value: String(stats.admin_held_advances),
      sub: `${stats.voided_advances} voided`,
      icon: <AccountBalanceWallet />,
      gradient: "linear-gradient(135deg, #7C3AED, #A78BFA)",
    },
    {
      label: "Duplicate Flags",
      value: String(stats.duplicate_advance_bookings),
      sub: stats.duplicate_advance_bookings > 0 ? "Review needed" : "All clear",
      icon: stats.duplicate_advance_bookings > 0 ? <Warning /> : <CheckCircle />,
      gradient: stats.duplicate_advance_bookings > 0
        ? "linear-gradient(135deg, #DC2626, #EF4444)"
        : "linear-gradient(135deg, #0F766E, #14B8A6)",
    },
  ];

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {cards.map((c) => (
        <Grid item xs={12} sm={6} lg key={c.label}>
          <Card sx={{ borderRadius: 3, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
            <Box sx={{ background: c.gradient, p: 2.5, color: "#fff" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", fontSize: 10 }}>
                    {c.label}
                  </Typography>
                  <Typography variant="h5" fontWeight={800} sx={{ mt: 0.25, lineHeight: 1.2 }}>
                    {c.value}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8, mt: 0.25, display: "block" }}>
                    {c.sub}
                  </Typography>
                </Box>
                <Box sx={{ opacity: 0.3, mt: 0.5, fontSize: 30 }}>{c.icon}</Box>
              </Stack>
            </Box>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

// ─────────────────────── FiltersBar ─────────────────────────────

interface FiltersBarProps {
  filters: PaymentListFilters;
  onChange: (f: Partial<PaymentListFilters>) => void;
  onRefresh: () => void;
  loading: boolean;
}

const FILTER_LABELS: Record<string, string> = {
  status: "Advance Status",
  received_by: "Received By",
  payment_mode: "Mode",
  booking_status: "Booking Status",
  payment_status: "Payment Status",
  start_date: "From",
  end_date: "To",
  search: "Search",
};

const CLEARED_FILTERS: Partial<PaymentListFilters> = {
  search: undefined, status: undefined, received_by: undefined,
  payment_mode: undefined, booking_status: undefined, payment_status: undefined,
  start_date: undefined, end_date: undefined, page: 1,
};

function FiltersBar({ filters, onChange, onRefresh, loading }: FiltersBarProps) {
  const theme = useTheme();
  const [search, setSearch] = useState(filters.search ?? "");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { setSearch(filters.search ?? ""); }, [filters.search]);

  const handleSearchSubmit = () => onChange({ search: search.trim() || undefined, page: 1 });

  const active = (Object.keys(FILTER_LABELS) as (keyof PaymentListFilters)[])
    .filter((k) => filters[k] != null && filters[k] !== "");

  return (
    <Card sx={{ mb: 2, borderRadius: 2, border: `1px solid ${theme.palette.divider}`, boxShadow: "none" }}>
      <CardContent sx={{ py: 1.75, "&:last-child": { pb: 1.75 } }}>
        {/* Row 1 — search + actions */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ sm: "center" }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Search by booking no, receipt no, customer name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" sx={{ color: "text.disabled" }} />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => { setSearch(""); onChange({ search: undefined, page: 1 }); }}>
                    <Close sx={{ fontSize: 15 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
              sx: { borderRadius: 2, bgcolor: alpha(theme.palette.action.hover, 0.4) },
            }}
          />
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button size="small" variant="contained" onClick={handleSearchSubmit} disabled={loading} sx={{ borderRadius: 2, px: 2 }}>
              Search
            </Button>
            <Button
              size="small"
              variant={active.length ? "contained" : "outlined"}
              color={active.length ? "primary" : "inherit"}
              onClick={() => setExpanded((v) => !v)}
              startIcon={<FilterAlt fontSize="small" />}
              endIcon={expanded ? <KeyboardArrowDown fontSize="small" /> : <KeyboardArrowRight fontSize="small" />}
              sx={{ borderRadius: 2, whiteSpace: "nowrap" }}
            >
              Filters{active.length ? ` (${active.length})` : ""}
            </Button>
            <Tooltip title="Refresh">
              <span>
                <IconButton size="small" onClick={onRefresh} disabled={loading} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                  <Refresh fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Row 2 — collapsible filter grid */}
        <Collapse in={expanded} unmountOnExit>
          <Divider sx={{ my: 1.75 }} />
          <Grid container spacing={1.5}>
            {([
              ["status", "Advance Status", [["ACTIVE", "Active"], ["VOIDED", "Voided"]]],
              ["received_by", "Received By", [["ADMIN", "Admin"], ["PARTNER", "Partner"], ["DRIVER", "Driver"]]],
              ["payment_mode", "Mode", [["CASH", "Cash"], ["UPI", "UPI"], ["ONLINE", "Online"]]],
              ["booking_status", "Booking Status", Object.entries(BOOKING_STATUS_META).map(([k, v]) => [k, v.label])],
              ["payment_status", "Payment Status", [["PENDING", "Pending"], ["PAID", "Paid"], ["PARTIAL", "Partial"], ["FAILED", "Failed"], ["REFUNDED", "Refunded"]]],
            ] as [keyof PaymentListFilters, string, string[][]][]).map(([key, label, options]) => (
              <Grid item xs={6} sm={4} md={3} key={key}>
                <FormControl size="small" fullWidth>
                  <InputLabel>{label}</InputLabel>
                  <Select
                    label={label}
                    value={(filters[key] as string) ?? ""}
                    onChange={(e) => onChange({ [key]: e.target.value || undefined, page: 1 })}
                    sx={{ borderRadius: 2 }}
                  >
                    <MenuItem value="">All</MenuItem>
                    {options.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            ))}
            <Grid item xs={6} sm={4} md={3}>
              <TextField
                size="small" fullWidth label="From" type="date"
                value={filters.start_date ?? ""}
                onChange={(e) => onChange({ start_date: e.target.value || undefined, page: 1 })}
                InputLabelProps={{ shrink: true }}
                InputProps={{ sx: { borderRadius: 2 } }}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={3}>
              <TextField
                size="small" fullWidth label="To" type="date"
                value={filters.end_date ?? ""}
                onChange={(e) => onChange({ end_date: e.target.value || undefined, page: 1 })}
                InputLabelProps={{ shrink: true }}
                InputProps={{ sx: { borderRadius: 2 } }}
                error={!!filters.start_date && !!filters.end_date && filters.end_date < filters.start_date}
                helperText={
                  !!filters.start_date && !!filters.end_date && filters.end_date < filters.start_date
                    ? "Must be after From"
                    : undefined
                }
              />
            </Grid>
          </Grid>
        </Collapse>

        {/* Row 3 — active filter chips */}
        {active.length > 0 && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mr: 0.5 }}>
                Active:
              </Typography>
              {active.map((k) => (
                <Chip
                  key={k}
                  size="small"
                  label={`${FILTER_LABELS[k]}: ${filters[k]}`}
                  onDelete={() => onChange({ [k]: undefined, page: 1 })}
                  sx={{ fontWeight: 600, fontSize: 11, borderRadius: 1.5 }}
                />
              ))}
              <Button size="small" variant="text" onClick={() => { setSearch(""); onChange(CLEARED_FILTERS); }} sx={{ ml: 0.5 }}>
                Clear all
              </Button>
            </Stack>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────── PaymentTable ───────────────────────────

interface PaymentTableProps {
  items: PaymentListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  loading: boolean;
  onPageChange: (p: number) => void;
  onSelectRow: (item: PaymentListItem) => void;
  onInitiateRefund: (item: PaymentListItem) => void;
}

function PaymentTable({
  items, total, page, pageSize, totalPages,
  loading, onPageChange, onSelectRow, onInitiateRefund,
}: PaymentTableProps) {
  const theme = useTheme();

  return (
    <Card sx={{ borderRadius: 2, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
      {loading && <LinearProgress />}
      <Box sx={{ px: 2, py: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="body2" color="text.secondary">
          {total} payment{total !== 1 ? "s" : ""} found
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button size="small" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</Button>
          <Typography variant="caption" color="text.secondary">
            Page {page} / {totalPages}
          </Typography>
          <Button size="small" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</Button>
        </Stack>
      </Box>
      <Divider />
      <TableContainer>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.05), fontSize: 12, py: 1.5 } }}>
              <TableCell>Receipt / Booking</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Mode / By</TableCell>
              <TableCell>Adv. Status</TableCell>
              <TableCell>Booking Status</TableCell>
              <TableCell>Journey Date</TableCell>
              <TableCell>Collected At</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 6, color: "text.disabled" }}>
                  <Stack spacing={1} alignItems="center">
                    <Receipt sx={{ fontSize: 40, opacity: 0.3 }} />
                    <Typography variant="body2">No payments found</Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            )}
            {items.map((row) => {
              const bsMeta = BOOKING_STATUS_META[row.booking_status] ?? { color: "default", label: row.booking_status };
              const asMeta = ADVANCE_STATUS_META[row.advance_status] ?? { color: "default", label: row.advance_status };
              const modeMeta = MODE_META[row.payment_mode] ?? { color: "#555", label: row.payment_mode };
              const byMeta = BY_META[row.received_by] ?? { color: "#555", label: row.received_by };
              return (
                <TableRow
                  key={row.id}
                  hover
                  sx={{
                    cursor: "pointer",
                    "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.03) },
                    ...(row.advance_status === "VOIDED" ? { opacity: 0.55 } : {}),
                  }}
                  onClick={() => onSelectRow(row)}
                >
                  <TableCell>
                    <Stack spacing={0.25}>
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Typography variant="caption" fontWeight={700} color="primary">
                          {row.receipt_number}
                        </Typography>
                        <IconButton
                          size="small"
                          sx={{ p: 0.25, opacity: 0.4 }}
                          onClick={(e) => { e.stopPropagation(); copyText(row.receipt_number); }}
                        >
                          <ContentCopy sx={{ fontSize: 11 }} />
                        </IconButton>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                        {row.master_booking_number}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.1}>
                      <Typography variant="caption" fontWeight={600}>{row.customer_name}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{row.customer_mobile}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={700} color={row.advance_status === "VOIDED" ? "text.disabled" : "text.primary"}>
                      {fmtINR(row.amount)}
                    </Typography>
                    {row.refunded_amount > 0 && (
                      <Typography variant="caption" color="error.main" sx={{ fontSize: 10, fontWeight: 600 }}>
                        −{fmtINR(row.refunded_amount)} refunded
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.4}>
                      <Chip
                        label={modeMeta.label}
                        size="small"
                        sx={{ bgcolor: alpha(modeMeta.color, 0.1), color: modeMeta.color, fontWeight: 700, fontSize: 10, height: 18 }}
                      />
                      <Chip
                        label={byMeta.label}
                        size="small"
                        sx={{ bgcolor: alpha(byMeta.color, 0.1), color: byMeta.color, fontWeight: 600, fontSize: 10, height: 18 }}
                      />
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={asMeta.label}
                      color={asMeta.color}
                      size="small"
                      variant={row.advance_status === "VOIDED" ? "outlined" : "filled"}
                      sx={{ fontWeight: 700, fontSize: 10 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={bsMeta.label}
                      color={bsMeta.color}
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight: 600, fontSize: 10 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {row.journey_start_date
                        ? new Date(row.journey_start_date).toLocaleDateString("en-IN", { dateStyle: "medium" })
                        : "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {fmtDate(row.collected_at)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                    <Stack direction="row" spacing={0.5} justifyContent="center">
                      <Tooltip title="View Detail">
                        <IconButton size="small" onClick={() => onSelectRow(row)}>
                          <VisibilityOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {row.refund_eligible && (
                        <Tooltip title="Initiate Refund">
                          <IconButton size="small" color="error" onClick={() => onInitiateRefund(row)}>
                            <Undo fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {!row.refund_eligible && row.advance_status === "ACTIVE" && (
                        <Tooltip title={row.refund_block_reason ?? "Refund not available"}>
                          <IconButton size="small" disabled>
                            <Undo fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}

// ─────────────────────── PaymentDetailDrawer ────────────────────

interface DetailDrawerProps {
  advanceId: number | null;
  onClose: () => void;
  onInitiateRefund: (item: PaymentDetail) => void;
}

function PaymentDetailDrawer({ advanceId, onClose, onInitiateRefund }: DetailDrawerProps) {
  const theme = useTheme();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["payment-detail", advanceId],
    queryFn: () => paymentService.getDetail(advanceId!),
    enabled: advanceId != null,
  });

  const d = data;

  return (
    <Drawer anchor="right" open={advanceId != null} onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100vw", md: 560 }, p: 3, bgcolor: "background.default" } }}
    >
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack>
          <Typography variant="h6" fontWeight={700}>Payment Detail</Typography>
          {d && (
            <Typography variant="caption" color="text.secondary">{d.receipt_number}</Typography>
          )}
        </Stack>
        <IconButton onClick={onClose}><Close /></IconButton>
      </Stack>
      <Divider sx={{ mb: 2 }} />

      {isLoading && <CircularProgress sx={{ display: "block", mx: "auto", mt: 4 }} />}

      {isError && (
        <Alert
          severity="error"
          icon={<ErrorOutline />}
          action={<Button size="small" onClick={() => refetch()}>Retry</Button>}
        >
          <Typography variant="body2" fontWeight={600}>Could not load payment detail</Typography>
          <Typography variant="caption">
            {(error as any)?.response?.data?.message ?? "Please retry, or contact support if this persists."}
          </Typography>
        </Alert>
      )}

      {d && (
        <Stack spacing={2.5}>
          {/* Refund eligibility alert */}
          {d.advance_status === "ACTIVE" && (
            d.refund_eligible ? (
              <Alert
                severity="success"
                icon={<CheckCircle />}
                action={
                  <Button
                    size="small"
                    color="error"
                    variant="contained"
                    startIcon={<Undo />}
                    onClick={() => onInitiateRefund(d)}
                    sx={{ fontWeight: 700 }}
                  >
                    Refund
                  </Button>
                }
              >
                This advance is eligible for refund.
              </Alert>
            ) : (
              <Alert severity="warning" icon={<Warning />}>
                <Typography variant="body2" fontWeight={600}>Refund Not Available</Typography>
                <Typography variant="caption">{d.refund_block_reason}</Typography>
              </Alert>
            )
          )}
          {d.advance_status === "VOIDED" && (
            <Alert severity="info" icon={<Info />}>
              This advance has been voided.{d.void_reason && ` Reason: ${d.void_reason}`}
            </Alert>
          )}

          {/* Payment info */}
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ "&:last-child": { pb: 2 } }}>
              <Typography variant="subtitle2" fontWeight={700} color="primary" gutterBottom>
                Advance Payment
              </Typography>
              <Grid container spacing={1.5}>
                {[
                  ["Receipt", d.receipt_number],
                  ["Amount", fmtINR(d.amount)],
                  ...(d.refunded_amount > 0
                    ? [
                        ["Refunded", fmtINR(d.refunded_amount)],
                        ["Refundable Balance", fmtINR(d.refundable_balance)],
                      ]
                    : []),
                  ["Mode", d.payment_mode],
                  ["Received By", d.received_by],
                  ["Status", d.advance_status],
                  ["Collected By Role", d.collected_by_role],
                  ["Collected At", fmtDate(d.collected_at)],
                  ...(d.reference_note ? [["Reference Note", d.reference_note]] : []),
                  ...(d.voided_at ? [["Voided At", fmtDate(d.voided_at)]] : []),
                ].map(([label, val]) => (
                  <Grid item xs={6} key={label}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>
                      {label}
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>{val}</Typography>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* Booking info */}
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ "&:last-child": { pb: 2 } }}>
              <Typography variant="subtitle2" fontWeight={700} color="primary" gutterBottom>
                Booking — {d.master_booking_number}
              </Typography>
              <Grid container spacing={1.5}>
                {[
                  ["Booking Status", d.booking.booking_status],
                  ["Payment Status", d.booking.payment_status],
                  ["Cab Status", d.booking.cab_status],
                  ["Trip Type", d.booking.trip_type ?? "—"],
                  ["Vehicle Category", d.booking.vehicle_category_name ?? "—"],
                  ["Total Fare", fmtINR(d.booking.total_amount)],
                  ["Total Paid", fmtINR(d.booking.total_paid_amount)],
                  ["Total Refunded", fmtINR(d.booking.total_refund_amount)],
                  ["Pickup", d.booking.pickup_location],
                  ["Drop", d.booking.drop_location],
                  ["Journey Start", d.booking.journey_start_date ?? "—"],
                  ["Journey End", d.booking.journey_end_date ?? "—"],
                ].map(([label, val]) => (
                  <Grid item xs={6} key={label}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>
                      {label}
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>{val}</Typography>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* Customer info */}
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ "&:last-child": { pb: 2 } }}>
              <Typography variant="subtitle2" fontWeight={700} color="primary" gutterBottom>
                Customer
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 36, height: 36 }}>
                  <Person />
                </Avatar>
                <Box>
                  <Typography variant="body2" fontWeight={700}>{d.customer.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{d.customer.mobile}</Typography>
                  {d.customer.email && (
                    <Typography variant="caption" color="text.secondary" display="block">{d.customer.email}</Typography>
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* All advances audit trail */}
          {d.all_advances_on_booking.length > 1 && (
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ "&:last-child": { pb: 2 } }}>
                <Typography variant="subtitle2" fontWeight={700} color="primary" gutterBottom>
                  <History sx={{ fontSize: 14, mr: 0.5, verticalAlign: "middle" }} />
                  All Advances on This Booking ({d.all_advances_on_booking.length})
                </Typography>
                <Stack spacing={1}>
                  {d.all_advances_on_booking.map((a) => (
                    <Box key={a.id} sx={{
                      p: 1, borderRadius: 1,
                      bgcolor: a.id === d.id ? alpha(theme.palette.primary.main, 0.07) : "transparent",
                      border: `1px solid ${a.id === d.id ? theme.palette.primary.light : theme.palette.divider}`,
                    }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack>
                          <Typography variant="caption" fontWeight={700}>{a.receipt_number}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                            {a.payment_mode} · {a.received_by} · {fmtDate(a.collected_at)}
                          </Typography>
                        </Stack>
                        <Stack alignItems="flex-end" spacing={0.25}>
                          <Typography variant="caption" fontWeight={700}>{fmtINR(a.amount)}</Typography>
                          <Chip
                            label={a.status}
                            size="small"
                            color={a.status === "ACTIVE" ? "success" : "error"}
                            variant="outlined"
                            sx={{ fontSize: 9, height: 16 }}
                          />
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Recent Notes */}
          {d.recent_notes.length > 0 && (
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ "&:last-child": { pb: 2 } }}>
                <Typography variant="subtitle2" fontWeight={700} color="primary" gutterBottom>
                  Recent Notes
                </Typography>
                <Stack spacing={1}>
                  {d.recent_notes.map((n, i) => (
                    <Box key={i} sx={{ p: 1, bgcolor: alpha(theme.palette.warning.main, 0.05), borderRadius: 1, borderLeft: `3px solid ${theme.palette.warning.main}` }}>
                      <Typography variant="caption" fontWeight={700} color="warning.dark">
                        {n.type} · {n.author ?? "System"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">{fmtDate(n.created_at)}</Typography>
                      <Typography variant="body2" sx={{ mt: 0.25, fontSize: 12 }}>{n.text}</Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}
        </Stack>
      )}
    </Drawer>
  );
}

// ─────────────────────── RefundDialog ───────────────────────────

interface RefundDialogProps {
  open: boolean;
  advanceId: number | null;
  advanceAmount: number;
  receiptNumber: string;
  onClose: () => void;
  onSuccess: () => void;
}

function RefundDialog({ open, advanceId, advanceAmount, receiptNumber, onClose, onSuccess }: RefundDialogProps) {
  const [reason, setReason] = useState("");
  const [refundAmount, setRefundAmount] = useState<string>("");
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      paymentService.initiateRefund({
        advance_payment_id: advanceId!,
        reason,
        refund_amount: refundAmount ? parseFloat(refundAmount) : undefined,
      }),
    onSuccess: (res) => {
      enqueueSnackbar(res.message, { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["payment-stats"] });
      queryClient.invalidateQueries({ queryKey: ["payment-detail", advanceId] });
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      enqueueSnackbar(err?.response?.data?.detail ?? "Refund failed", { variant: "error" });
    },
  });

  const parsedAmount = parseFloat(refundAmount) || 0;
  const isPartial = parsedAmount > 0 && parsedAmount < advanceAmount;
  const isValid =
    reason.trim().length >= 5 &&
    parsedAmount <= advanceAmount &&
    (refundAmount === "" || parsedAmount > 0);

  const handleClose = () => {
    if (!mutation.isPending) { setReason(""); setRefundAmount(""); onClose(); }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Undo color="error" />
          <span>Initiate Refund</span>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2.5}>
          <Alert severity="warning" icon={<Warning />}>
            <Typography variant="body2" fontWeight={600}>Advance: {receiptNumber}</Typography>
            <Typography variant="caption">
              Refundable balance: <strong>{fmtINR(advanceAmount)}</strong>. Leave the amount empty to refund the full balance.
            </Typography>
          </Alert>

          <TextField
            label="Refund Amount (optional — leave empty for full balance)"
            type="number"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            inputProps={{ min: 1, max: advanceAmount, step: 0.01 }}
            helperText={isPartial ? `Partial refund: ${fmtINR(parsedAmount)}` : `Full balance refund: ${fmtINR(advanceAmount)}`}
            fullWidth
          />

          <TextField
            label="Reason for Refund *"
            multiline
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={reason.length > 0 && reason.trim().length < 5}
            helperText={reason.length > 0 && reason.trim().length < 5 ? "Minimum 5 characters required" : ""}
            fullWidth
          />

          {parsedAmount > advanceAmount && (
            <Alert severity="error">Refund amount cannot exceed the refundable balance of {fmtINR(advanceAmount)}.</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={handleClose} disabled={mutation.isPending}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          disabled={!isValid || mutation.isPending}
          onClick={() => mutation.mutate()}
          startIcon={mutation.isPending ? <CircularProgress size={14} /> : <Undo />}
        >
          {mutation.isPending ? "Processing…" : `Confirm Refund ${refundAmount ? fmtINR(parsedAmount) : fmtINR(advanceAmount)}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────── DuplicatesPanel ────────────────────────

function DuplicatesPanel() {
  const theme = useTheme();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["payment-duplicates"],
    queryFn: paymentService.getDuplicates,
    staleTime: 60_000,
  });

  if (isLoading) return <CircularProgress sx={{ display: "block", mx: "auto", mt: 4 }} />;
  if (!data) return null;

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2" color="text.secondary">
          Automated duplicate detection — runs on all ACTIVE advances
        </Typography>
        <Button size="small" startIcon={<Refresh />} onClick={() => refetch()}>Refresh</Button>
      </Stack>

      {!data.has_issues && (
        <Alert severity="success" icon={<CheckCircle />}>
          No duplicate advances detected. All payment records appear clean.
        </Alert>
      )}

      {/* Index violations */}
      {data.index_violations.length > 0 && (
        <Card variant="outlined" sx={{ borderRadius: 2, borderColor: "error.main" }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <ReportProblem color="error" />
              <Typography variant="subtitle2" fontWeight={700} color="error">
                Index Violations ({data.index_violations.length})
              </Typography>
              <Chip label="Critical" color="error" size="small" />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: "block" }}>
              Same cab booking has multiple ACTIVE advances — should never happen. Immediate review required.
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, fontSize: 11 } }}>
                  <TableCell>Cab Booking #</TableCell>
                  <TableCell align="right">Duplicates</TableCell>
                  <TableCell align="right">Total Amount</TableCell>
                  <TableCell>Receipts</TableCell>
                  <TableCell>First At</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.index_violations.map((v) => (
                  <TableRow key={v.cab_booking_number}>
                    <TableCell><Typography variant="caption" fontWeight={700}>{v.cab_booking_number}</Typography></TableCell>
                    <TableCell align="right"><Chip label={v.duplicate_count} color="error" size="small" /></TableCell>
                    <TableCell align="right">{fmtINR(v.total_amount)}</TableCell>
                    <TableCell>
                      <Stack spacing={0.25}>
                        {v.receipts.map((r) => <Typography key={r} variant="caption">{r}</Typography>)}
                      </Stack>
                    </TableCell>
                    <TableCell><Typography variant="caption">{fmtDate(v.first_collected_at)}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Rapid repeats */}
      {data.rapid_repeat_charges.length > 0 && (
        <Card variant="outlined" sx={{ borderRadius: 2, borderColor: "warning.main" }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Warning color="warning" />
              <Typography variant="subtitle2" fontWeight={700} color="warning.dark">
                Rapid Repeat Charges ({data.rapid_repeat_charges.length})
              </Typography>
              <Chip label="Suspected Fraud" color="warning" size="small" />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: "block" }}>
              Same customer · same amount · same mode · different bookings · within 5 minutes.
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, fontSize: 11 } }}>
                  <TableCell>Customer</TableCell>
                  <TableCell>Receipts</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Mode</TableCell>
                  <TableCell>Seconds Apart</TableCell>
                  <TableCell>Collected At</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.rapid_repeat_charges.map((r) => (
                  <TableRow key={`${r.id1}-${r.id2}`}>
                    <TableCell>
                      <Typography variant="caption" fontWeight={700}>{r.customer_name}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">{r.customer_mobile}</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.25}>
                        <Typography variant="caption">{r.receipt1}</Typography>
                        <Typography variant="caption">{r.receipt2}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{fmtINR(r.amount)}</TableCell>
                    <TableCell>{r.payment_mode}</TableCell>
                    <TableCell>
                      <Chip
                        label={`${r.seconds_apart}s`}
                        color={r.seconds_apart < 60 ? "error" : "warning"}
                        size="small"
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell><Typography variant="caption">{fmtDate(r.t1)}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

// ─────────────────────── Main Page ──────────────────────────────

const DEFAULT_FILTERS: PaymentListFilters = { page: 1, page_size: 20 };

export default function PaymentsPage() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [activeTab, setActiveTab] = useState(0);
  const [filters, setFilters] = useState<PaymentListFilters>(DEFAULT_FILTERS);

  // Detail drawer
  const [detailId, setDetailId] = useState<number | null>(null);

  // Refund dialog — may be opened from table row OR detail drawer
  const [refundTarget, setRefundTarget] = useState<{
    advanceId: number;
    advanceAmount: number;
    receiptNumber: string;
  } | null>(null);

  // ── Data Queries ──────────────────────────────────────────────

  const statsQuery = useQuery({
    queryKey: ["payment-stats"],
    queryFn: paymentService.getStats,
    staleTime: 30_000,
  });

  const listQuery = useQuery({
    queryKey: ["payments", filters],
    queryFn: () => paymentService.list(filters),
    staleTime: 20_000,
    placeholderData: (prev) => prev,
  });

  // ── Handlers ─────────────────────────────────────────────────

  const handleFiltersChange = useCallback((partial: Partial<PaymentListFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["payments"] });
    queryClient.invalidateQueries({ queryKey: ["payment-stats"] });
  }, [queryClient]);

  const handleSelectRow = useCallback((row: PaymentListItem) => {
    setDetailId(row.id);
  }, []);

  const handleInitiateRefundFromRow = useCallback((row: PaymentListItem) => {
    setRefundTarget({ advanceId: row.id, advanceAmount: row.refundable_balance, receiptNumber: row.receipt_number });
  }, []);

  const handleInitiateRefundFromDetail = useCallback((detail: PaymentDetail) => {
    setRefundTarget({ advanceId: detail.id, advanceAmount: detail.refundable_balance, receiptNumber: detail.receipt_number });
    setDetailId(null); // close drawer
  }, []);

  const list = listQuery.data;

  return (
    <Box>
      {/* Page Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Payments</Typography>
          <Typography variant="body2" color="text.secondary">
            Full platform payment overview — advances, refunds, duplicate detection
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {!!statsQuery.data && statsQuery.data.pending_refund_count > 0 && (
            <Chip
              label={`${statsQuery.data.pending_refund_count} Refunds Pending`}
              color="error"
              icon={<HourglassEmpty />}
              sx={{ fontWeight: 700 }}
            />
          )}
          {!!statsQuery.data && statsQuery.data.duplicate_advance_bookings > 0 && (
            <Chip
              label={`${statsQuery.data.duplicate_advance_bookings} Duplicates`}
              color="warning"
              icon={<Warning />}
              sx={{ fontWeight: 700 }}
              onClick={() => setActiveTab(1)}
            />
          )}
        </Stack>
      </Stack>

      {/* Stats Bar */}
      {statsQuery.isLoading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
      {statsQuery.data && <PaymentStatsBar stats={statsQuery.data} />}

      {/* Booking payment status breakdown */}
      {statsQuery.data?.booking_payment_status_breakdown && (
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 3 }}>
          {statsQuery.data.booking_payment_status_breakdown.map((b) => (
            <Chip
              key={b.status}
              label={`${b.status}: ${b.count}`}
              size="small"
              color={filters.payment_status === b.status ? "primary" : "default"}
              variant={filters.payment_status === b.status ? "filled" : "outlined"}
              sx={{ fontWeight: 600, fontSize: 11 }}
              onClick={() => {
                setActiveTab(0);
                handleFiltersChange({
                  payment_status: filters.payment_status === b.status ? undefined : b.status,
                  page: 1,
                });
              }}
            />
          ))}
        </Stack>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{
          mb: 2,
          "& .MuiTabs-indicator": { height: 3, borderRadius: 2 },
          "& .MuiTab-root": { fontWeight: 700, textTransform: "none", minWidth: 140 },
        }}
      >
        <Tab
          label={
            <Stack direction="row" alignItems="center" spacing={1}>
              <Receipt fontSize="small" />
              <span>All Payments</span>
              {list && <Chip label={list.total} size="small" sx={{ height: 18, fontSize: 10 }} />}
            </Stack>
          }
        />
        <Tab
          label={
            <Stack direction="row" alignItems="center" spacing={1}>
              <Badge badgeContent={statsQuery.data?.duplicate_advance_bookings || 0} color="error">
                <ReportProblem fontSize="small" />
              </Badge>
              <span>Duplicates</span>
            </Stack>
          }
        />
      </Tabs>

      {/* Tab: All Payments */}
      {activeTab === 0 && (
        <>
          <FiltersBar
            filters={filters}
            onChange={handleFiltersChange}
            onRefresh={handleRefresh}
            loading={listQuery.isFetching}
          />
          {listQuery.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Failed to load payments. Please try refreshing.
            </Alert>
          )}
          {list && (
            <PaymentTable
              items={list.items}
              total={list.total}
              page={list.page}
              pageSize={list.page_size}
              totalPages={list.total_pages}
              loading={listQuery.isFetching}
              onPageChange={(p) => handleFiltersChange({ page: p })}
              onSelectRow={handleSelectRow}
              onInitiateRefund={handleInitiateRefundFromRow}
            />
          )}
        </>
      )}

      {/* Tab: Duplicates */}
      {activeTab === 1 && <DuplicatesPanel />}

      {/* Detail Drawer */}
      <PaymentDetailDrawer
        advanceId={detailId}
        onClose={() => setDetailId(null)}
        onInitiateRefund={handleInitiateRefundFromDetail}
      />

      {/* Refund Dialog */}
      <RefundDialog
        open={refundTarget != null}
        advanceId={refundTarget?.advanceId ?? null}
        advanceAmount={refundTarget?.advanceAmount ?? 0}
        receiptNumber={refundTarget?.receiptNumber ?? ""}
        onClose={() => setRefundTarget(null)}
        onSuccess={handleRefresh}
      />
    </Box>
  );
}
