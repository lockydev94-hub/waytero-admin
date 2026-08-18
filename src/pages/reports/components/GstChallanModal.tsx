// ============================================================
// WAYTERO ADMIN — GST CHALLAN GENERATION MODAL (enhanced)
// Shows full CGST + SGST breakdown + GST portal filing steps.
// ============================================================
import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, Divider,
  CircularProgress, Alert, Stack, Grid, alpha, useTheme,
} from "@mui/material";
import { Receipt, Info, CheckCircle, AccountBalance, CurrencyRupee } from "@mui/icons-material";
import { GSTRecord } from "../../../services/reports.service";

const fmtINR = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

interface Props {
  open: boolean;
  record: GSTRecord | null;
  onClose: () => void;
  onGenerate: (month: string, challan_number: string) => Promise<void>;
}

export default function GstChallanModal({ open, record, onClose, onGenerate }: Props) {
  const theme = useTheme();
  const [challanNo, setChallanNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!challanNo.trim() || !record) return;
    setLoading(true);
    setError("");
    try {
      await onGenerate(record.month, challanNo.trim().toUpperCase());
      setSuccess(true);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to generate challan.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setChallanNo("");
    setSuccess(false);
    setError("");
    onClose();
  };

  if (!record) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
            <Receipt sx={{ color: theme.palette.warning.main }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700}>Generate GST Challan (PMT-06)</Typography>
            <Typography variant="body2" color="text.secondary">{record.month_label}</Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 2.5 }}>
        {success ? (
          <Box sx={{ textAlign: "center", py: 3 }}>
            <CheckCircle sx={{ fontSize: 56, color: theme.palette.success.main, mb: 2 }} />
            <Typography variant="h6" fontWeight={700}>Challan Generated Successfully!</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Challan <strong>{challanNo.toUpperCase()}</strong> recorded for {record.month_label}.
            </Typography>
            <Stack direction="row" gap={2} justifyContent="center" sx={{ mt: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Total GST</Typography>
                <Typography fontWeight={700} color="warning.main">{fmtINR(record.gst_amount)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">CGST</Typography>
                <Typography fontWeight={700} color="info.main">{fmtINR(record.cgst_amount)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">SGST</Typography>
                <Typography fontWeight={700} color="secondary.main">{fmtINR(record.sgst_amount)}</Typography>
              </Box>
            </Stack>
          </Box>
        ) : (
          <Stack gap={2.5}>
            {/* Full GST Breakdown */}
            <Box sx={{
              bgcolor: alpha(theme.palette.warning.main, 0.04),
              borderRadius: 2, p: 2,
              border: `1px solid ${alpha(theme.palette.warning.main, 0.15)}`,
            }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700}
                sx={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
                GST Summary — {record.month_label}
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {[
                  { label: "Tax Invoices",    value: record.total_invoices.toString(),   icon: <Receipt sx={{ fontSize: 15 }} />,         color: theme.palette.text.primary },
                  { label: "Taxable Amount",  value: fmtINR(record.total_taxable),        icon: <CurrencyRupee sx={{ fontSize: 15 }} />,   color: theme.palette.text.primary },
                  { label: "CGST (2.5%)",     value: fmtINR(record.cgst_amount),          icon: <AccountBalance sx={{ fontSize: 15 }} />,  color: theme.palette.info.main },
                  { label: "SGST (2.5%)",     value: fmtINR(record.sgst_amount),          icon: <AccountBalance sx={{ fontSize: 15 }} />,  color: theme.palette.secondary.main },
                  { label: "Total GST (5%)",  value: fmtINR(record.gst_amount),           icon: <Receipt sx={{ fontSize: 15 }} />,         color: theme.palette.warning.main },
                ].map(item => (
                  <Grid item xs={6} sm={4} key={item.label}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                      <Typography fontWeight={700} sx={{ color: item.color, fontSize: "0.95rem" }}>
                        {item.value}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>

            {/* GST Filing Steps */}
            <Alert severity="info" icon={<Info />} sx={{ borderRadius: 2 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>GST Portal Steps (PMT-06)</Typography>
              <Typography variant="body2" component="div">
                1. Log in to <strong>gst.gov.in</strong> → Services → Payments → Create Challan<br />
                2. Enter CGST: <strong>{fmtINR(record.cgst_amount)}</strong> + SGST: <strong>{fmtINR(record.sgst_amount)}</strong><br />
                3. Pay via net banking / NEFT. Note the <strong>Challan Identification Number (CIN)</strong><br />
                4. Enter CIN below, then file GSTR-3B by the <strong>20th of next month</strong>
              </Typography>
            </Alert>

            {/* Challan Number Input */}
            <TextField
              label="Challan Reference / CIN Number"
              placeholder="e.g. GST-CHALLAN-202506-001"
              value={challanNo}
              onChange={e => setChallanNo(e.target.value)}
              fullWidth
              helperText="Enter the CIN / ARN from the GST portal after successful payment"
              inputProps={{ style: { textTransform: "uppercase", fontFamily: "monospace" } }}
            />

            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
          </Stack>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} color="inherit" sx={{ fontWeight: 600 }}>
          {success ? "Close" : "Cancel"}
        </Button>
        {!success && (
          <Button
            variant="contained" color="warning"
            disabled={!challanNo.trim() || loading}
            onClick={handleGenerate}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Receipt />}
          >
            {loading ? "Saving…" : "Record Challan"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
