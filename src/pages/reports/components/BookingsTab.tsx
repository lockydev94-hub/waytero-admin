// ============================================================
// WAYTERO ADMIN — BOOKING REPORT TAB
// ============================================================
import { useState, useEffect } from "react";
import {
  Box, Grid, Stack, Typography, Button, Chip, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, TablePagination, TextField, MenuItem, Select, FormControl,
  InputLabel, CircularProgress, Alert, alpha, useTheme, Divider,
} from "@mui/material";
import {
  Download, Refresh, ConfirmationNumber, CurrencyRupee,
  Handshake, AccountBalance, CheckCircle, HourglassTop,
} from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { reportsService, BookingReportResponse } from "../../../services/reports.service";
import PeriodFilter, { PeriodType } from "./PeriodFilter";
import SummaryCard from "./SummaryCard";
import { exportCsv } from "./exportCsv";

const fmtINR = (n: number | null | undefined) => {
  if (n == null) return "—";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const STATUS_COLOR: Record<string, "default" | "info" | "success" | "warning" | "error"> = {
  COMPLETED: "success", CONFIRMED: "info", IN_PROGRESS: "warning",
  CANCELLED: "error", SETTLED: "success", CLOSED: "default",
};

const PAYMENT_COLOR: Record<string, "default" | "warning" | "info" | "success"> = {
  CASH: "warning", ONLINE: "info", WALLET: "success",
};

export default function BookingsTab() {
  const theme = useTheme();
  const [period, setPeriod] = useState<PeriodType>("year");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [bookingStatus, setBookingStatus] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(20);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<BookingReportResponse>({
    queryKey: ["report-bookings", period, dateFrom, dateTo, bookingStatus, paymentMode, page],
    queryFn: () => reportsService.bookings({
      period,
      date_from: period === "custom" ? dateFrom : undefined,
      date_to: period === "custom" ? dateTo : undefined,
      booking_status: bookingStatus || undefined,
      payment_mode: paymentMode || undefined,
      page: page + 1,
      page_size: rowsPerPage,
    }),
      staleTime: 0,
    refetchOnMount: "always",
  });

  const summary = data?.summary;

  const handleExport = () => {
    if (!data?.items?.length) return;
    exportCsv(`booking-report-${period}.csv`, [
      { header: "Booking #",      value: r => r.booking_number },
      { header: "Customer",       value: r => r.customer_name ?? "" },
      { header: "Mobile",         value: r => r.customer_mobile ?? "" },
      { header: "City",           value: r => r.city_name ?? "" },
      { header: "Journey Date",   value: r => r.journey_date ?? "" },
      { header: "Partner",        value: r => r.partner_name ?? "" },
      { header: "Trip Type",      value: r => r.trip_type ?? "" },
      { header: "Pickup",         value: r => r.pickup_location ?? "" },
      { header: "Drop",           value: r => r.drop_location ?? "" },
      { header: "Final Amount",   value: r => r.final_amount ?? 0 },
      { header: "GST",            value: r => r.gst_amount ?? 0 },
      { header: "Tax Invoice",    value: r => (r.is_tax_invoice ? "YES" : "NO") },
      { header: "Commission",     value: r => r.platform_commission ?? 0 },
      { header: "Payout",         value: r => r.partner_payout ?? 0 },
      { header: "Payment Mode",   value: r => r.payment_mode ?? "" },
      { header: "Payment Status", value: r => r.payment_status },
      { header: "Booking Status", value: r => r.booking_status },
      { header: "Cab Status",     value: r => r.cab_status ?? "" },
      { header: "Invoice #",      value: r => r.invoice_number ?? "" },
    ], data.items);
  };

  return (
    <Stack gap={2.5}>
      {/* Filters */}
      <Box sx={{ bgcolor: "background.paper", borderRadius: 2, p: 2.5, border: `1px solid ${theme.palette.divider}` }}>
        <Stack gap={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
            <Typography variant="subtitle2" fontWeight={700}>Filter Bookings</Typography>
            <Button size="small" startIcon={isFetching ? <CircularProgress size={14} /> : <Refresh />}
              onClick={() => refetch()} disabled={isFetching}>
              Refresh
            </Button>
          </Stack>
          <PeriodFilter
            value={period} onChange={v => { setPeriod(v); setPage(0); }}
            dateFrom={dateFrom} dateTo={dateTo}
            onDateFromChange={setDateFrom} onDateToChange={setDateTo}
          />
          <Stack direction="row" gap={1.5} flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Booking Status</InputLabel>
              <Select value={bookingStatus} onChange={e => setBookingStatus(e.target.value)} label="Booking Status">
                <MenuItem value="">All</MenuItem>
                <MenuItem value="COMPLETED">Completed</MenuItem>
                <MenuItem value="CLOSED">Closed</MenuItem>
                <MenuItem value="CONFIRMED">Confirmed</MenuItem>
                <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                <MenuItem value="CANCELLED">Cancelled</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Payment Mode</InputLabel>
              <Select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} label="Payment Mode">
                <MenuItem value="">All</MenuItem>
                <MenuItem value="CASH">Cash</MenuItem>
                <MenuItem value="ONLINE">Online</MenuItem>
                <MenuItem value="WALLET">Wallet</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Stack>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2}>
        {[
          { label: "Total Bookings",  value: summary?.total_bookings ?? "—", sub: `${summary?.completed ?? 0} completed`, icon: <ConfirmationNumber />, color: theme.palette.primary.main },
          { label: "Total Revenue",   value: fmtINR(summary?.total_revenue), sub: "Gross collected", icon: <CurrencyRupee />, color: theme.palette.success.main },
          { label: "Platform Commission", value: fmtINR(summary?.total_commission), sub: "Net earnings", icon: <AccountBalance />, color: theme.palette.warning.main },
          { label: "Partner Payout",  value: fmtINR(summary?.total_payout), sub: `${summary?.settled ?? 0} settled`, icon: <Handshake />, color: theme.palette.secondary.main },
        ].map(c => (
          <Grid item xs={6} md={3} key={c.label}>
            <SummaryCard {...c} loading={isLoading} />
          </Grid>
        ))}
      </Grid>

      {/* Table */}
      {isError && <Alert severity="error" sx={{ borderRadius: 2 }}>Failed to load booking report.</Alert>}
      <Paper sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}`, overflow: "hidden" }}>
        <Box sx={{ px: 2.5, py: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="subtitle2" fontWeight={700}>
            Booking Records {data && <Chip label={data.total} size="small" sx={{ ml: 1 }} />}
          </Typography>
          <Button size="small" startIcon={<Download />} variant="outlined"
            onClick={handleExport} disabled={!data?.items?.length}>Export CSV</Button>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Booking #</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>City</TableCell>
                <TableCell>Journey Date</TableCell>
                <TableCell>Partner</TableCell>
                <TableCell>Trip Type</TableCell>
                <TableCell>Final Amount</TableCell>
                <TableCell>Commission</TableCell>
                <TableCell>Payout</TableCell>
                <TableCell>Mode</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Invoice</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 12 }).map((_, j) => (
                      <TableCell key={j}><Box sx={{ height: 16, bgcolor: "grey.100", borderRadius: 1 }} /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data?.items?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 6, color: "text.secondary" }}>
                    No bookings found for this period.
                  </TableCell>
                </TableRow>
              ) : (
                data?.items?.map(r => (
                  <TableRow key={r.booking_number} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} color="primary">{r.booking_number}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{r.customer_name || "—"}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.customer_mobile || ""}</Typography>
                    </TableCell>
                    <TableCell>{r.city_name || "—"}</TableCell>
                    <TableCell>{r.journey_date ? new Date(r.journey_date).toLocaleDateString("en-IN") : "—"}</TableCell>
                    <TableCell>{r.partner_name || "—"}</TableCell>
                    <TableCell>
                      {r.trip_type && <Chip label={r.trip_type} size="small" variant="outlined" />}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{fmtINR(r.final_amount)}</TableCell>
                    <TableCell sx={{ color: theme.palette.warning.main, fontWeight: 600 }}>{fmtINR(r.platform_commission)}</TableCell>
                    <TableCell sx={{ color: theme.palette.secondary.main, fontWeight: 600 }}>{fmtINR(r.partner_payout)}</TableCell>
                    <TableCell>
                      {r.payment_mode && <Chip label={r.payment_mode} size="small" color={PAYMENT_COLOR[r.payment_mode] ?? "default"} />}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={r.booking_status}
                        size="small"
                        color={STATUS_COLOR[r.booking_status] ?? "default"}
                      />
                    </TableCell>
                    <TableCell>
                      {r.invoice_number ? (
                        <Typography variant="caption" fontFamily="monospace">{r.invoice_number}</Typography>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={data?.total ?? 0}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPageOptions={[20]}
        />
      </Paper>
    </Stack>
  );
}
