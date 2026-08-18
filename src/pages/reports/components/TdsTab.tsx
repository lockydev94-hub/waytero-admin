// ============================================================
// WAYTERO ADMIN — TDS REPORT TAB (enhanced)
// TDS @ 1% under Section 194C — Company (B2B) partners only.
// Shows FY, Quarter, Form 26Q filing indicator.
// ============================================================
import { useState } from "react";
import {
  Box, Stack, Typography, Button, Chip, Grid, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, MenuItem, Select, FormControl, InputLabel,
  LinearProgress, CircularProgress, alpha, useTheme, Tooltip,
} from "@mui/material";
import { Download, Info, Business, CurrencyRupee, Receipt, VerifiedUser, AssignmentLate } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { reportsService, TDSReportResponse } from "../../../services/reports.service";
import { useGstEnabled } from "../../../hooks/useGstEnabled";
import SummaryCard from "./SummaryCard";
import { exportCsv } from "./exportCsv";
import GstDisabledState from "./GstDisabledState";

const fmtINR = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

/** Derive Indian FY string from year + month */
function financialYear(year: number, month: number): string {
  if (month < 4) return `${year - 1}-${String(year).slice(2)}`;
  return `${year}-${String(year + 1).slice(2)}`;
}

/** Derive quarter from month (Indian FY: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar) */
function quarter(month: number): string {
  if (month >= 4 && month <= 6)  return "Q1";
  if (month >= 7 && month <= 9)  return "Q2";
  if (month >= 10 && month <= 12) return "Q3";
  return "Q4";
}

export default function TdsTab() {
  const theme = useTheme();
  const { isGstEnabled, isLoading: gstFlagLoading } = useGstEnabled();
  const now = new Date();
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  // Tax reports are gated on the platform GST switch: when it is off the
  // tab shows the "GST is not enabled" state (no tax, no report).
  const { data, isLoading } = useQuery<TDSReportResponse>({
    queryKey: ["report-tds", period, year, month],
    queryFn: () => reportsService.tds({ period, year, month: period === "month" ? month : undefined }),
    staleTime: 0,
    refetchOnMount: "always",
    enabled: isGstEnabled,
  });

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentYear = now.getFullYear();

  const fy = financialYear(year, period === "month" ? month : 4);
  const q  = period === "month" ? quarter(month) : null;

  const tdsRate = data?.tds_rate ?? 1;
  const tdsDisabled = data ? !data.tds_enabled : false;

  const handleExport = () => {
    if (!data?.records?.length) return;
    exportCsv(`tds-report-${data.period}.csv`, [
      { header: "Partner",        value: r => r.partner_name },
      { header: "Partner Code",   value: r => r.partner_code },
      { header: "PAN",            value: r => r.pan_number ?? "" },
      { header: "GST Number",     value: r => r.gst_number ?? "" },
      { header: "Bookings",       value: r => r.total_bookings },
      { header: "Total Payout",   value: r => r.total_payout },
      { header: `TDS Due (${tdsRate}%)`, value: r => r.tds_amount },
      { header: "TDS Deducted",   value: r => r.tds_deducted },
      { header: "Gap",            value: r => r.tds_gap },
      { header: "Net Payout",     value: r => r.net_payout },
      { header: "Financial Year", value: r => r.financial_year ?? fy },
      { header: "Quarter",        value: r => r.quarter ?? q ?? "" },
    ], data.records);
  };

  if (gstFlagLoading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }
  if (!isGstEnabled) {
    return <GstDisabledState />;
  }

  return (
    <Stack gap={2.5}>
      {/* Controls */}
      <Box sx={{ bgcolor: "background.paper", borderRadius: 2, p: 2.5, border: `1px solid ${theme.palette.divider}` }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>TDS Report — Company Partners (B2B)</Typography>
            <Typography variant="caption" color="text.secondary">
              TDS @ {tdsRate}% under Section 194C · FY {fy}{q ? ` · ${q}` : ""} · File quarterly via Form 26Q
            </Typography>
          </Box>
          <Stack direction="row" gap={1.5} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel>Period</InputLabel>
              <Select value={period} onChange={e => setPeriod(e.target.value as any)} label="Period">
                <MenuItem value="month">Monthly</MenuItem>
                <MenuItem value="year">Yearly</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Year</InputLabel>
              <Select value={year} onChange={e => setYear(Number(e.target.value))} label="Year">
                {[currentYear, currentYear - 1].map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
              </Select>
            </FormControl>
            {period === "month" && (
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>Month</InputLabel>
                <Select value={month} onChange={e => setMonth(Number(e.target.value))} label="Month">
                  {MONTHS.map((m, i) => <MenuItem key={i + 1} value={i + 1}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            <Button size="small" startIcon={<Download />} variant="outlined"
              onClick={handleExport} disabled={!data?.records?.length}>Export</Button>
          </Stack>
        </Stack>
      </Box>

      {/* Summary */}
      <Grid container spacing={2}>
        {[
          { label: "Total Partner Payout",  value: data ? fmtINR(data.total_payout) : "—",   sub: "B2B company partners only",       icon: <CurrencyRupee />, color: theme.palette.primary.main },
          { label: "TDS Due",               value: data ? fmtINR(data.total_tds) : "—",      sub: `${tdsRate}% of payout (194C)`,    icon: <Receipt />,       color: theme.palette.warning.main },
          { label: "TDS Actually Deducted", value: data ? fmtINR(data.total_deducted) : "—", sub: "Withheld at settlement",          icon: <VerifiedUser />,  color: theme.palette.success.main },
          { label: "Un-deducted Gap",       value: data ? fmtINR(data.total_gap) : "—",      sub: "Due but never withheld",          icon: <AssignmentLate />, color: theme.palette.error.main },
        ].map(c => (
          <Grid item xs={6} md={3} key={c.label}>
            <SummaryCard {...c} loading={isLoading} />
          </Grid>
        ))}
      </Grid>

      {tdsDisabled && (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          <strong>TDS is disabled</strong> in platform settings, so no TDS is being withheld and this report is empty.
          Enable <strong>TDS_ENABLED</strong> on the Settings page to start deducting TDS at settlement.
        </Alert>
      )}

      {!tdsDisabled && data && data.total_gap > 0 && (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          <strong>{fmtINR(data.total_gap)}</strong> of TDS is due under Section 194C but was never withheld at settlement.
          These bookings were settled without a TDS deduction — the platform still owes this to the government.
          Newly settled bookings will deduct TDS automatically while TDS is enabled.
        </Alert>
      )}

      {/* FY / Quarter Badge */}
      {data && data.records.length > 0 && (
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Chip
            icon={<VerifiedUser />}
            label={`Financial Year: ${fy}`}
            color="primary" variant="outlined" size="small"
          />
          {q && <Chip label={`Quarter: ${q}`} color="info" variant="outlined" size="small" />}
          <Chip
            icon={<AssignmentLate />}
            label="Form 26Q filing due by last day of month following quarter end"
            size="small" variant="outlined"
            sx={{ color: "text.secondary", borderColor: "divider" }}
          />
        </Stack>
      )}

      {/* Info */}
      <Alert severity="info" icon={<Info />} sx={{ borderRadius: 2 }}>
        <Typography variant="body2">
          <strong>TDS Note (Section 194C):</strong> {tdsRate}% TDS applies only to <strong>company (B2B) partners</strong> with PAN.
          Individual partners are excluded from TDS. TDS is deducted at settlement time and credited to the government.
          File quarterly TDS returns using <strong>Form 26Q</strong> and issue <strong>Form 16A</strong> TDS certificates to partners.
          Form 26Q is due by the last day of the month following the end of each quarter.
        </Typography>
      </Alert>

      {/* Table */}
      <Paper sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}`, overflow: "hidden" }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2" fontWeight={700}>
              Company Partner TDS — {data?.period}
            </Typography>
            {data && data.records.length > 0 && q && (
              <Chip
                size="small"
                label={`FY ${fy} ${q} · Form 26Q`}
                color="warning"
                sx={{ fontWeight: 700, fontSize: "0.72rem" }}
              />
            )}
          </Stack>
        </Box>
        {isLoading && <LinearProgress />}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Partner</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>PAN</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>GST Number</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Bookings</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Total Payout</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>TDS Due ({tdsRate}%)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>TDS Deducted</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Gap</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Net Payout</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>FY / Quarter</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Form 26Q</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!isLoading && data?.records?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 6, color: "text.secondary" }}>
                    {tdsDisabled
                      ? "TDS is disabled in platform settings."
                      : "No company partners with TDS data for this period."}
                  </TableCell>
                </TableRow>
              )}
              {data?.records?.map(r => (
                <TableRow key={r.partner_id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{r.partner_name}</Typography>
                    <Typography variant="caption" color="text.secondary">{r.partner_code}</Typography>
                  </TableCell>
                  <TableCell>
                    {r.pan_number ? (
                      <Tooltip title="Required for Form 26Q / 16A">
                        <Typography variant="body2" fontFamily="monospace" fontWeight={600}>{r.pan_number}</Typography>
                      </Tooltip>
                    ) : (
                      <Chip label="PAN Missing" size="small" color="error" />
                    )}
                  </TableCell>
                  <TableCell>
                    {r.gst_number ? (
                      <Typography variant="caption" fontFamily="monospace">{r.gst_number}</Typography>
                    ) : "—"}
                  </TableCell>
                  <TableCell align="right">{r.total_bookings}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{fmtINR(r.total_payout)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: theme.palette.warning.main }}>{fmtINR(r.tds_amount)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: theme.palette.success.main }}>
                    {fmtINR(r.tds_deducted)}
                    <Typography variant="caption" color="text.secondary" display="block">
                      {r.deducted_bookings}/{r.total_bookings} bookings
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: r.tds_gap > 0 ? theme.palette.error.main : "text.secondary" }}>
                    {fmtINR(r.tds_gap)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{fmtINR(r.net_payout)}</TableCell>
                  <TableCell>
                    <Typography variant="caption" fontWeight={600} color="text.secondary">
                      {r.financial_year || fy}
                      {r.quarter || q ? ` · ${r.quarter || q}` : ""}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={r.pan_number ? "Include in Form 26Q quarterly return" : "PAN required for Form 26Q"}>
                      <Chip
                        size="small"
                        label={r.pan_number ? "Eligible" : "PAN Missing"}
                        color={r.pan_number ? "success" : "error"}
                        variant="outlined"
                        sx={{ fontSize: "0.68rem" }}
                      />
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {data && data.records.length > 0 && (
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                  <TableCell colSpan={4} sx={{ fontWeight: 700 }}>Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtINR(data.total_payout)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: theme.palette.warning.main }}>{fmtINR(data.total_tds)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: theme.palette.success.main }}>{fmtINR(data.total_deducted)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: data.total_gap > 0 ? theme.palette.error.main : "text.secondary" }}>{fmtINR(data.total_gap)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtINR(data.total_payout - data.total_deducted)}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Stack>
  );
}
