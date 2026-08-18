// ============================================================
// WAYTERO ADMIN — GST REPORT TAB  (enhanced)
// India: 5% GST on transport (SAC 9964) = 2.5% CGST + 2.5% SGST
// COMPANY partner  → files own GSTR-1/3B; platform records GST collected.
// INDIVIDUAL       → platform files GST on their behalf.
// Challan = PMT-06 on GST portal; GSTR-3B due 20th of next month.
// ============================================================
import { useState } from "react";
import {
  Box, Stack, Typography, Button, Chip, Grid, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, MenuItem, Select, FormControl, InputLabel,
  CircularProgress, alpha, useTheme, Divider, LinearProgress,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from "@mui/material";
import {
  Receipt, Download, Info, CheckCircle, HourglassTop, Add, Warning, TaskAlt,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { reportsService, GSTReportResponse, GSTRecord } from "../../../services/reports.service";
import { useGstEnabled } from "../../../hooks/useGstEnabled";
import SummaryCard from "./SummaryCard";
import GstChallanModal from "./GstChallanModal";
import GstDisabledState from "./GstDisabledState";

const fmtINR = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

// ── Mark-Filed Dialog ────────────────────────────────────
function MarkFiledDialog({
  open, record, onClose, onFiled,
}: {
  open: boolean;
  record: GSTRecord | null;
  onClose: () => void;
  onFiled: (month: string, filed_date: string, notes: string) => Promise<void>;
}) {
  const [filedDate, setFiledDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  if (!record) return null;
  const handle = async () => {
    setLoading(true);
    try { await onFiled(record.month, filedDate, notes); onClose(); }
    finally { setLoading(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Mark Challan as FILED</DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2.5 }}>
        <Stack gap={2}>
          <Alert severity="success" sx={{ borderRadius: 2 }}>
            <Typography variant="body2">
              Confirm you have paid the GST challan on the GST portal for <strong>{record.month_label}</strong>.
              GST Amount: <strong>{fmtINR(record.gst_amount)}</strong>
              &nbsp;(CGST {fmtINR(record.cgst_amount)} + SGST {fmtINR(record.sgst_amount)})
            </Typography>
          </Alert>
          <TextField type="date" label="Filed Date" value={filedDate}
            onChange={e => setFiledDate(e.target.value)} fullWidth size="small"
            InputLabelProps={{ shrink: true }} />
          <TextField label="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)}
            fullWidth size="small" multiline rows={2} placeholder="Payment reference, portal ARN, etc." />
        </Stack>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button variant="contained" color="success" onClick={handle}
          disabled={loading} startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <TaskAlt />}>
          {loading ? "Saving…" : "Confirm Filed"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main GST Tab ─────────────────────────────────────────
export default function GstTab() {
  const theme = useTheme();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { isGstEnabled, isLoading: gstFlagLoading } = useGstEnabled();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [challanModal, setChallanModal] = useState<GSTRecord | null>(null);
  const [filedModal, setFiledModal] = useState<GSTRecord | null>(null);

  // While the platform GST switch is off there is nothing to report —
  // show a graceful disabled state and skip the (all-zeros) query.
  const { data, isLoading } = useQuery<GSTReportResponse>({
    queryKey: ["report-gst", year],
    queryFn: () => reportsService.gst(year),
    staleTime: 0,
    refetchOnMount: "always",
    enabled: isGstEnabled,
  });

  const currentMonth = new Date().getMonth() + 1;
  const ys = data?.yearly_summary;

  const handleGenerate = async (month: string, challan_number: string) => {
    await reportsService.generateChallan(month, challan_number);
    enqueueSnackbar("GST challan generated and saved!", { variant: "success" });
    qc.invalidateQueries({ queryKey: ["report-gst"] });
    setChallanModal(null);
  };

  const handleMarkFiled = async (month: string, filed_date: string, notes: string) => {
    await reportsService.markChallanFiled(month, filed_date, notes);
    enqueueSnackbar("Challan marked as FILED!", { variant: "success" });
    qc.invalidateQueries({ queryKey: ["report-gst"] });
  };

  if (gstFlagLoading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }
  if (!isGstEnabled) {
    return <GstDisabledState />;
  }

  return (
    <Stack gap={2.5}>
      {/* Header */}
      <Box sx={{ bgcolor: "background.paper", borderRadius: 2, p: 2.5, border: `1px solid ${theme.palette.divider}` }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>GST Report — Platform (GSTR-3B)</Typography>
            <Typography variant="caption" color="text.secondary">
              5% GST on transport services (SAC 9964) · 2.5% CGST + 2.5% SGST · Only tax invoices counted
            </Typography>
          </Box>
          <Stack direction="row" gap={1.5} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel>Year</InputLabel>
              <Select value={year} onChange={e => setYear(Number(e.target.value))} label="Year">
                {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                  <MenuItem key={y} value={y}>{y}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button size="small" startIcon={<Download />} variant="outlined">Export</Button>
          </Stack>
        </Stack>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2}>
        {[
          { label: "Total Taxable (Year)", value: ys ? fmtINR(ys.total_taxable) : "—", sub: "Pre-GST fare", icon: <Receipt />, color: theme.palette.primary.main },
          { label: "Total GST (Year)", value: ys ? fmtINR(ys.total_gst) : "—", sub: "5% on transport", icon: <Receipt />, color: theme.palette.warning.main },
          { label: "CGST (2.5%)", value: ys ? fmtINR(ys.total_cgst) : "—", sub: "Central Govt share", icon: <Receipt />, color: theme.palette.info.main },
          { label: "SGST (2.5%)", value: ys ? fmtINR(ys.total_sgst) : "—", sub: "State Govt share", icon: <Receipt />, color: theme.palette.secondary.main },
        ].map(c => (
          <Grid item xs={12} sm={6} md={3} key={c.label}>
            <SummaryCard {...c} loading={isLoading} />
          </Grid>
        ))}
      </Grid>

      {/* Info */}
      <Alert severity="info" icon={<Info />} sx={{ borderRadius: 2 }}>
        <Typography variant="body2">
          <strong>GST Filing Reminder:</strong> File GSTR-3B by the <strong>20th of each following month</strong>.
          Pay GST via PMT-06 challan on the GST portal. COMPANY partners file their own GSTR-1;
          INDIVIDUAL partners' GST is filed by the platform. TDS on company partner payouts is recorded in the TDS tab.
        </Typography>
      </Alert>

      {/* Monthly Table */}
      <Paper sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}`, overflow: "hidden" }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="subtitle2" fontWeight={700}>Monthly GST Breakdown — {year}</Typography>
        </Box>
        {isLoading && <LinearProgress />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Month</TableCell>
                <TableCell align="right">Invoices</TableCell>
                <TableCell align="right">Taxable</TableCell>
                <TableCell align="right">CGST (2.5%)</TableCell>
                <TableCell align="right">SGST (2.5%)</TableCell>
                <TableCell align="right">Total GST</TableCell>
                <TableCell>Challan Status</TableCell>
                <TableCell>Challan #</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.records?.map((r, idx) => {
                const isPast = idx + 1 < currentMonth || year < currentYear;
                const isCurrent = idx + 1 === currentMonth && year === currentYear;
                const hasTxn = r.total_invoices > 0;
                const isFiled = r.challan_status === "FILED";
                const isGenerated = r.challan_generated && !isFiled;

                return (
                  <TableRow key={r.month} hover sx={{
                    bgcolor: isCurrent ? alpha(theme.palette.primary.main, 0.03) : "inherit",
                    opacity: !hasTxn && !isCurrent ? 0.5 : 1,
                  }}>
                    <TableCell>
                      <Stack direction="row" alignItems="center" gap={1}>
                        <Typography fontWeight={isCurrent ? 700 : 500} fontSize="0.85rem">{r.month_label}</Typography>
                        {isCurrent && <Chip label="Current" size="small" color="primary" sx={{ height: 18, fontSize: "0.68rem" }} />}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{hasTxn ? r.total_invoices : "—"}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>{hasTxn ? fmtINR(r.total_taxable) : "—"}</TableCell>
                    <TableCell align="right" sx={{ color: theme.palette.info.dark }}>
                      {hasTxn ? fmtINR(r.cgst_amount) : "—"}
                    </TableCell>
                    <TableCell align="right" sx={{ color: theme.palette.secondary.dark }}>
                      {hasTxn ? fmtINR(r.sgst_amount) : "—"}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: hasTxn ? theme.palette.warning.dark : "text.disabled" }}>
                      {hasTxn ? fmtINR(r.gst_amount) : "—"}
                    </TableCell>
                    <TableCell>
                      {isFiled ? (
                        <Chip label="FILED" size="small" color="success" icon={<CheckCircle />} />
                      ) : isGenerated ? (
                        <Chip label="Pending Filing" size="small" color="warning" icon={<HourglassTop />} />
                      ) : hasTxn ? (
                        <Chip label="Challan Due" size="small" color="error" icon={<Warning />} />
                      ) : (
                        <Typography variant="caption" color="text.disabled">No transactions</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.challan_number ? (
                        <Tooltip title={r.challan_date ? `Date: ${r.challan_date}` : ""}>
                          <Typography variant="caption" fontFamily="monospace" fontWeight={600}>
                            {r.challan_number}
                          </Typography>
                        </Tooltip>
                      ) : "—"}
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" gap={1} justifyContent="center">
                        {hasTxn && !r.challan_generated && (
                          <Button size="small" variant="contained" color="warning"
                            startIcon={<Add />} sx={{ fontSize: "0.72rem" }}
                            onClick={() => setChallanModal(r)}>
                            Generate
                          </Button>
                        )}
                        {isGenerated && (
                          <>
                            <Button size="small" variant="outlined" color="warning"
                              sx={{ fontSize: "0.72rem" }} onClick={() => setChallanModal(r)}>
                              Edit
                            </Button>
                            <Button size="small" variant="contained" color="success"
                              startIcon={<TaskAlt />} sx={{ fontSize: "0.72rem" }}
                              onClick={() => setFiledModal(r)}>
                              Mark Filed
                            </Button>
                          </>
                        )}
                        {isFiled && (
                          <Tooltip title={`Filed on ${r.challan_date || "—"}`}>
                            <CheckCircle sx={{ color: "success.main", fontSize: 20 }} />
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
      </Paper>

      <GstChallanModal
        open={!!challanModal}
        record={challanModal}
        onClose={() => setChallanModal(null)}
        onGenerate={handleGenerate}
      />

      <MarkFiledDialog
        open={!!filedModal}
        record={filedModal}
        onClose={() => setFiledModal(null)}
        onFiled={handleMarkFiled}
      />
    </Stack>
  );
}
