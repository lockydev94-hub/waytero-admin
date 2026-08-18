// ============================================================
// WAYTERO ADMIN — HOTEL SWITCHES PAGE
// Doc Ref: Hotel Switch Spec; Migration 0042_hotel_switch
// Route: /bookings/switches
// Backend: GET /admin/bookings/hotel/switch-events
//          (paginated audit of PRE_CHECKIN_SWITCH + POST_CHECKIN_SPLIT events)
// ============================================================
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Card, CardContent, Chip, Button, Stack,
  TextField, MenuItem, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Alert, CircularProgress,
  InputAdornment, Grid, Divider,
} from "@mui/material";
import {
  SwapHoriz, Search, Refresh, OpenInNew, AttachMoney, Receipt, Event,
} from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { bookingService, type HotelSwitchEvent } from "../../services/booking.service";

const inr = (n: number | null | undefined) =>
  n != null
    ? `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";

const SPLIT_TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "PRE_CHECKIN_SWITCH", label: "Pre-checkin switch" },
  { value: "POST_CHECKIN_SPLIT", label: "Post-checkin split" },
];

const STRATEGY_COLORS: Record<string, "primary" | "warning"> = {
  ROLLOVER: "primary",
  NONE: "warning",
};

const SPLIT_TYPE_LABELS: Record<string, string> = {
  PRE_CHECKIN_SWITCH: "Pre-checkin switch",
  POST_CHECKIN_SPLIT: "Mid-stay split",
};

export default function HotelSwitchesPage() {
  const navigate = useNavigate();

  // Filters
  const [splitType, setSplitType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const params = {
    split_type: splitType ? (splitType as "PRE_CHECKIN_SWITCH" | "POST_CHECKIN_SPLIT") : undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    page: page + 1,
    page_size: pageSize,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-hotel-switches", params],
    queryFn: () => bookingService.listHotelSwitchEvents(params),
  });

  const items: HotelSwitchEvent[] = data?.items ?? [];
  const total = data?.total ?? 0;

  // Client-side search over reservation numbers — small dataset, fine.
  const filtered = search.trim()
    ? items.filter((it) => {
        const q = search.toLowerCase();
        return (
          it.original_reservation_number?.toLowerCase().includes(q) ||
          it.new_reservation_number?.toLowerCase().includes(q) ||
          (it.notes ?? "").toLowerCase().includes(q)
        );
      })
    : items;

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Box sx={{
            p: 1.25, borderRadius: 2,
            bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(99,102,241,0.2)" : "#EEF2FF"),
            color: "#6366F1",
          }}>
            <SwapHoriz />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={800}>Hotel Switches</Typography>
            <Typography variant="body2" color="text.secondary">
              Audit page for hotel switches (pre-checkin) and mid-stay splits (post-checkin).
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" gap={1}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={() => refetch()}>Refresh</Button>
        </Stack>
      </Stack>

      {/* Filters */}
      <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", mb: 2 }}>
        <CardContent sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                size="small"
                label="Type"
                value={splitType}
                onChange={(e) => { setSplitType(e.target.value); setPage(0); }}
              >
                {SPLIT_TYPE_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth size="small"
                label="From" type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth size="small"
                label="To" type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth size="small"
                label="Search reservation / notes"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
                }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>Failed to load switch events.</Alert>
      )}

      {/* Table */}
      <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                <TableCell sx={{ fontWeight: 700 }}>Switch date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Original → New</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Nights moved</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Refund issued</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Advance rollover</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">New reservation total</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Strategy</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No hotel switch events match the current filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.map((it) => (
                <TableRow key={it.id} hover>
                  <TableCell>
                    <Stack direction="row" alignItems="center" gap={0.5}>
                      <Event fontSize="small" color="action" />
                      <Typography variant="body2">
                        {it.created_at ? new Date(it.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.25}>
                      <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                        {it.original_reservation_number}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        → {it.new_reservation_number}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={SPLIT_TYPE_LABELS[it.split_type] ?? it.split_type}
                      color={it.split_type === "POST_CHECKIN_SPLIT" ? "warning" : "secondary"}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.25}>
                      <Typography variant="body2" fontWeight={600}>
                        {it.nights_transferred} night(s)
                      </Typography>
                      {it.original_nights_consumed > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          ({it.original_nights_consumed} already consumed)
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      color={it.refund_issued > 0 ? "warning.main" : "text.secondary"}
                    >
                      {inr(it.refund_issued)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      color={it.advance_redistributed > 0 ? "success.main" : "text.secondary"}
                    >
                      {inr(it.advance_redistributed)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={700}>{inr(it.new_total_amount)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={it.advance_split_strategy}
                      color={STRATEGY_COLORS[it.advance_split_strategy] ?? "default"}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" gap={0.5}>
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<OpenInNew fontSize="small" />}
                        onClick={() => navigate(`/bookings/${(it as any).original_master_booking_id ?? ""}/hotel/${it.original_hotel_id}`)}
                        disabled={!(it as any).original_master_booking_id}
                      >
                        Original
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Divider />
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Card>

      <Stack direction="row" gap={2} alignItems="center" sx={{ mt: 2, color: "text.secondary" }}>
        <Receipt fontSize="small" />
        <Typography variant="caption">
          Tip: a refund issued but advance_redistributed = 0 means admin needs to record the Razorpay refund via the booking's advance panel.
        </Typography>
      </Stack>
    </Box>
  );
}
