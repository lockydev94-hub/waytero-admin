// ============================================================
// WAYTERO ADMIN — PARTNER REPORT TAB
// ============================================================
import { useState } from "react";
import {
  Box, Stack, Typography, Button, Chip, Grid, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, TablePagination, MenuItem, Select, FormControl, InputLabel,
  CircularProgress, alpha, useTheme, Divider, Autocomplete, TextField, Card, CardContent,
  Tooltip,
} from "@mui/material";
import {
  Download, Handshake, CurrencyRupee, AccountBalance,
  ConfirmationNumber, CheckCircle, Cancel, HourglassTop,
} from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { reportsService, PartnerOption, PartnerReportResponse } from "../../../services/reports.service";
import PeriodFilter, { PeriodType } from "./PeriodFilter";
import SummaryCard from "./SummaryCard";
import { exportCsv } from "./exportCsv";

const fmtINR = (n: number | null | undefined) => {
  if (n == null) return "—";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
};

const CAB_STATUS_COLOR: Record<string, "default" | "success" | "error" | "warning" | "info"> = {
  SETTLED: "success", COMPLETED: "info", CANCELLED: "error", PENDING_ASSIGNMENT: "warning",
  BREAKDOWN_REPORTED: "error", AWAITING_SWAP: "warning",
};

export default function PartnerReportTab() {
  const theme = useTheme();
  const [selectedPartner, setSelectedPartner] = useState<PartnerOption | null>(null);
  const [period, setPeriod] = useState<PeriodType>("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);

  const { data: partnerOptions, isLoading: loadingOptions } = useQuery<PartnerOption[]>({
    queryKey: ["partner-options-report"],
    queryFn: () => reportsService.partnerOptions(),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data, isLoading } = useQuery<PartnerReportResponse>({
    queryKey: ["report-partner", selectedPartner?.id, period, dateFrom, dateTo, page],
    queryFn: () => reportsService.partnerReport(selectedPartner!.id, {
      period,
      date_from: period === "custom" ? dateFrom : undefined,
      date_to: period === "custom" ? dateTo : undefined,
      page: page + 1,
      page_size: 20,
    }),
    enabled: !!selectedPartner,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const s = data?.summary;

  const handleExport = () => {
    if (!data?.items?.length || !s) return;
    exportCsv(`partner-report-${s.partner_code}-${period}.csv`, [
      { header: "Booking #",     value: r => r.booking_number },
      { header: "Cab Booking #", value: r => r.cab_booking_number ?? "" },
      { header: "Journey Date",  value: r => r.journey_date ?? "" },
      { header: "Trip Type",     value: r => r.trip_type ?? "" },
      { header: "Pickup",        value: r => r.pickup_location ?? "" },
      { header: "Drop",          value: r => r.drop_location ?? "" },
      { header: "Final Amount",  value: r => r.final_amount ?? 0 },
      { header: "GST",           value: r => r.gst_amount ?? 0 },
      { header: "Tax Invoice",   value: r => (r.is_tax_invoice ? "YES" : "NO") },
      { header: "Commission",    value: r => r.platform_commission ?? 0 },
      { header: "Payout",        value: r => r.partner_payout ?? 0 },
      { header: "Payment Mode",  value: r => r.payment_mode ?? "" },
      { header: "Status",        value: r => r.cab_status ?? "" },
      { header: "Invoice #",     value: r => r.invoice_number ?? "" },
    ], data.items);
  };

  return (
    <Stack gap={2.5}>
      {/* Partner Selector */}
      <Box sx={{ bgcolor: "background.paper", borderRadius: 2, p: 2.5, border: `1px solid ${theme.palette.divider}` }}>
        <Stack gap={2}>
          <Typography variant="subtitle2" fontWeight={700}>Select Partner & Period</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} gap={2} alignItems={{ sm: "flex-end" }}>
            <Autocomplete
              options={partnerOptions ?? []}
              getOptionLabel={o => `${o.name} (${o.code})`}
              value={selectedPartner}
              onChange={(_, v) => { setSelectedPartner(v); setPage(0); }}
              loading={loadingOptions}
              sx={{ minWidth: 280 }}
              renderInput={p => <TextField {...p} label="Select Partner" size="small" />}
              renderOption={(props, o) => (
                <Box component="li" {...props} key={o.id}>
                  <Stack>
                    <Typography variant="body2" fontWeight={600}>{o.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{o.code} · {o.type}</Typography>
                  </Stack>
                </Box>
              )}
            />
            <PeriodFilter
              value={period} onChange={v => { setPeriod(v); setPage(0); }}
              dateFrom={dateFrom} dateTo={dateTo}
              onDateFromChange={setDateFrom} onDateToChange={setDateTo}
            />
          </Stack>
        </Stack>
      </Box>

      {!selectedPartner && (
        <Alert severity="info" sx={{ borderRadius: 2 }}>Select a partner to view their detailed report.</Alert>
      )}

      {selectedPartner && (
        <>
          {/* Partner Summary Cards */}
          <Grid container spacing={2}>
            {[
              { label: "Total Bookings", value: s?.total_bookings ?? "—", sub: `${s?.completed_bookings ?? 0} completed`, icon: <ConfirmationNumber />, color: theme.palette.primary.main },
              { label: "Total Revenue",  value: fmtINR(s?.total_revenue),  sub: "Gross amount",   icon: <CurrencyRupee />, color: theme.palette.success.main },
              { label: "Commission",     value: fmtINR(s?.total_commission), sub: "Platform cut",  icon: <AccountBalance />, color: theme.palette.warning.main },
              { label: "Partner Payout", value: fmtINR(s?.total_payout),   sub: `${s?.settled_bookings ?? 0} settled`, icon: <Handshake />, color: theme.palette.secondary.main },
            ].map(c => (
              <Grid item xs={6} md={3} key={c.label}>
                <SummaryCard {...c} loading={isLoading} />
              </Grid>
            ))}
          </Grid>

          {/* Partner Info Card */}
          {s && (
            <Card sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>{s.partner_name}</Typography>
                    <Stack direction="row" gap={1} mt={0.5}>
                      <Chip label={s.partner_code} size="small" variant="outlined" />
                      <Chip label={s.partner_type} size="small" color={s.partner_type === "COMPANY" ? "info" : "default"} />
                      {s.city_name && <Chip label={s.city_name} size="small" />}
                    </Stack>
                  </Box>
                  <Stack direction="row" gap={3}>
                    <Box textAlign="center">
                      <Typography variant="h5" fontWeight={700} color="success.main">{s.completed_bookings}</Typography>
                      <Typography variant="caption" color="text.secondary">Completed</Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h5" fontWeight={700} color="error.main">{s.cancelled_bookings}</Typography>
                      <Typography variant="caption" color="text.secondary">Cancelled</Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h5" fontWeight={700} color="secondary.main">{fmtINR(s.average_trip_amount)}</Typography>
                      <Typography variant="caption" color="text.secondary">Avg Trip</Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" gap={1}>
                    <Button size="small" variant="outlined" startIcon={<Download />}
                      onClick={handleExport} disabled={!data?.items?.length}>Export CSV</Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Booking List */}
          <Paper sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}`, overflow: "hidden" }}>
            <Box sx={{ px: 2.5, py: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="subtitle2" fontWeight={700}>
                Booking Details {data && <Chip label={data.total} size="small" sx={{ ml: 1 }} />}
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Booking #</TableCell>
                    <TableCell>Journey Date</TableCell>
                    <TableCell>Trip Type</TableCell>
                    <TableCell>Pickup</TableCell>
                    <TableCell>Drop</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">Commission</TableCell>
                    <TableCell align="right">Payout</TableCell>
                    <TableCell>Mode</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Invoice</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 11 }).map((_, j) => (
                          <TableCell key={j}><Box sx={{ height: 16, bgcolor: "grey.100", borderRadius: 1 }} /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : data?.items?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} align="center" sx={{ py: 5, color: "text.secondary" }}>
                        No bookings for this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.items?.map(r => (
                      <TableRow key={r.booking_number} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600} color="primary">{r.booking_number}</Typography>
                          {r.cab_booking_number && (
                            <Typography variant="caption" color="text.secondary">{r.cab_booking_number}</Typography>
                          )}
                        </TableCell>
                        <TableCell>{r.journey_date ? new Date(r.journey_date).toLocaleDateString("en-IN") : "—"}</TableCell>
                        <TableCell>{r.trip_type ? <Chip label={r.trip_type} size="small" variant="outlined" /> : "—"}</TableCell>
                        <TableCell sx={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <Tooltip title={r.pickup_location || ""}><span>{r.pickup_location || "—"}</span></Tooltip>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <Tooltip title={r.drop_location || ""}><span>{r.drop_location || "—"}</span></Tooltip>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{fmtINR(r.final_amount)}</TableCell>
                        <TableCell align="right" sx={{ color: theme.palette.warning.main, fontWeight: 600 }}>{fmtINR(r.platform_commission)}</TableCell>
                        <TableCell align="right" sx={{ color: theme.palette.success.main, fontWeight: 600 }}>{fmtINR(r.partner_payout)}</TableCell>
                        <TableCell>{r.payment_mode ? <Chip label={r.payment_mode} size="small" /> : "—"}</TableCell>
                        <TableCell>
                          <Chip label={r.cab_status || "—"} size="small" color={CAB_STATUS_COLOR[r.cab_status || ""] ?? "default"} />
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
              rowsPerPage={20}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPageOptions={[20]}
            />
          </Paper>
        </>
      )}
    </Stack>
  );
}
