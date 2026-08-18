// ============================================================
// WAYTERO ADMIN — CUSTOMER REPORT TAB
// ============================================================
import { useState } from "react";
import {
  Box, Stack, Typography, Button, Chip, Grid, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, TablePagination, TextField, InputAdornment,
  alpha, useTheme, Tooltip,
} from "@mui/material";
import { Download, Search, Person, CurrencyRupee, TrendingUp, ConfirmationNumber } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { reportsService, CustomerReportResponse } from "../../../services/reports.service";
import PeriodFilter, { PeriodType } from "./PeriodFilter";
import SummaryCard from "./SummaryCard";

const fmtINR = (n: number | null | undefined) => {
  if (n == null) return "—";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
};

const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString("en-IN") : "—";

export default function CustomerReportTab() {
  const theme = useTheme();
  const [period, setPeriod] = useState<PeriodType>("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [minBookings, setMinBookings] = useState<number | undefined>();
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery<CustomerReportResponse>({
    queryKey: ["report-customers", period, dateFrom, dateTo, search, minBookings, page],
    queryFn: () => reportsService.customers({
      period,
      date_from: period === "custom" ? dateFrom : undefined,
      date_to: period === "custom" ? dateTo : undefined,
      search: search || undefined,
      min_bookings: minBookings || undefined,
      page: page + 1,
      page_size: 20,
    }),
      staleTime: 0,
    refetchOnMount: "always",
  });

  const sum = data?.summary;

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(0);
  };

  return (
    <Stack gap={2.5}>
      {/* Filters */}
      <Box sx={{ bgcolor: "background.paper", borderRadius: 2, p: 2.5, border: `1px solid ${theme.palette.divider}` }}>
        <Stack gap={2}>
          <Typography variant="subtitle2" fontWeight={700}>Customer Filters</Typography>
          <PeriodFilter
            value={period} onChange={v => { setPeriod(v); setPage(0); }}
            dateFrom={dateFrom} dateTo={dateTo}
            onDateFromChange={setDateFrom} onDateToChange={setDateTo}
          />
          <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="flex-end">
            <TextField
              size="small"
              placeholder="Search by name, mobile, email…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              sx={{ minWidth: 260 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
              }}
            />
            <TextField
              size="small"
              type="number"
              label="Min Bookings"
              value={minBookings ?? ""}
              onChange={e => setMinBookings(e.target.value ? Number(e.target.value) : undefined)}
              sx={{ width: 130 }}
              inputProps={{ min: 1 }}
            />
            <Button variant="contained" size="small" onClick={handleSearch}>Search</Button>
            <Button variant="outlined" size="small" startIcon={<Download />}>Export CSV</Button>
          </Stack>
        </Stack>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2}>
        {[
          { label: "Unique Customers", value: sum?.unique_customers ?? "—", sub: "Active in period", icon: <Person />, color: theme.palette.primary.main },
          { label: "Total Revenue",    value: fmtINR(sum?.total_revenue),  sub: "From all bookings",  icon: <CurrencyRupee />, color: theme.palette.success.main },
          { label: "Avg Booking Value", value: fmtINR(sum?.avg_booking_value), sub: "Per booking", icon: <TrendingUp />, color: theme.palette.secondary.main },
        ].map(c => (
          <Grid item xs={12} sm={4} key={c.label}>
            <SummaryCard {...c} loading={isLoading} />
          </Grid>
        ))}
      </Grid>

      {/* Table */}
      <Paper sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}`, overflow: "hidden" }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="subtitle2" fontWeight={700}>
            Customer Records {data && <Chip label={data.total} size="small" sx={{ ml: 1 }} />}
          </Typography>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>City</TableCell>
                <TableCell align="right">Total Bookings</TableCell>
                <TableCell align="right">Completed</TableCell>
                <TableCell align="right">Total Spent</TableCell>
                <TableCell align="right">Avg Booking</TableCell>
                <TableCell>First Booking</TableCell>
                <TableCell>Last Booking</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Box sx={{ height: 16, bgcolor: "grey.100", borderRadius: 1 }} /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data?.items?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6, color: "text.secondary" }}>
                    No customers found for this period.
                  </TableCell>
                </TableRow>
              ) : (
                data?.items?.map((r, idx) => (
                  <TableRow key={r.customer_id} hover>
                    <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>
                      {(page * 20) + idx + 1}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{r.customer_name || "—"}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.customer_mobile || ""}</Typography>
                      {r.customer_email && (
                        <Typography variant="caption" color="text.secondary" display="block">{r.customer_email}</Typography>
                      )}
                    </TableCell>
                    <TableCell>{r.city_name || "—"}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{r.total_bookings}</TableCell>
                    <TableCell align="right">
                      <Chip label={r.completed_bookings} size="small" color="success" />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
                      {fmtINR(r.total_spent)}
                    </TableCell>
                    <TableCell align="right">{fmtINR(r.avg_booking_value)}</TableCell>
                    <TableCell>{fmtDate(r.first_booking_date)}</TableCell>
                    <TableCell>{fmtDate(r.last_booking_date)}</TableCell>
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
          rowsPerPage={20}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPageOptions={[20]}
        />
      </Paper>
    </Stack>
  );
}
