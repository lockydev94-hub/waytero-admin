// ============================================================
// WAYTERO — INVOICE MODAL (Download Invoice PDF)
//
// Flow:
//   • If invoice_number already exists (set at payment time) → show Download button.
//   • If invoice_number is null (older booking before auto-generate was deployed)
//     → call generate-invoice first, then download.
//   • Backend generates a premium ReportLab PDF on demand, pulling platform
//     branding from system_configurations (logo, GST, address, etc.)
// ============================================================
import { useState } from "react";
import {
  Dialog, DialogContent, DialogActions,
  Button, Stack, Typography, CircularProgress,
  Box, alpha, useTheme, Chip, Divider,
} from "@mui/material";
import {
  Receipt, Download, CheckCircle, Info, AutoFixHigh,
} from "@mui/icons-material";
import { tripAssistanceService, TripDetail } from "../../../services/tripAssistance.service";

interface Props {
  open: boolean;
  detail: TripDetail;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InvoiceModal({ open, detail, onClose, onSuccess }: Props) {
  const theme = useTheme();
  const [busy,        setBusy]        = useState(false);
  const [error,       setError]       = useState("");
  const [downloaded,  setDownloaded]  = useState(false);
  // Local invoice number — may be generated on-the-fly for older bookings
  const [localInvoiceNumber, setLocalInvoiceNumber] = useState<string | null>(null);

  const invoiceNumber  = localInvoiceNumber ?? detail.invoice_number;
  const finalAmount    = detail.final_amount ?? 0;
  const gstAmount      = detail.gst_amount ?? 0;
  const gstRate        = detail.gst_rate ?? 0;
  const isTaxInvoice   = detail.is_tax_invoice ?? false;
  const couponDiscount = detail.coupon_discount ?? 0;
  const advancePaid    = detail.advance_paid ?? 0;
  const grossTotal     = finalAmount + (isTaxInvoice ? gstAmount : 0);
  const balanceDue     = Math.max(0, grossTotal - couponDiscount - advancePaid);

  function handleClose() {
    if (busy) return;
    setError("");
    setDownloaded(false);
    setLocalInvoiceNumber(null);
    onClose();
  }

  async function handleDownload() {
    setBusy(true);
    setError("");

    try {
      let invNum = invoiceNumber;

      // Step 1: Generate invoice number if missing (older booking)
      if (!invNum) {
        const genRes = await tripAssistanceService.generateInvoice(detail.cab_booking_number);
        invNum = genRes.invoice_number;
        setLocalInvoiceNumber(invNum);
      }

      // Step 2: Download PDF
      await tripAssistanceService.downloadInvoice(detail.cab_booking_number, invNum!);
      setDownloaded(true);
      onSuccess();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to download invoice. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}
    >
      {/* Header */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.warning.dark} 0%, ${theme.palette.warning.main} 100%)`,
          px: 3, pt: 2.5, pb: 2.5,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 44, height: 44, borderRadius: 2,
              bgcolor: alpha("#fff", 0.15),
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Receipt sx={{ color: "#fff", fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={800} color="white" lineHeight={1.2}>
              Invoice
            </Typography>
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.8) }}>
              {detail.cab_booking_number}
            </Typography>
          </Box>
          <Box flex={1} />
          <Chip
            label={invoiceNumber ?? "Auto-generate on download"}
            size="small"
            sx={{
              bgcolor: alpha("#fff", 0.2),
              color: "white",
              fontWeight: 700,
              fontSize: "0.68rem",
              letterSpacing: 0.3,
              maxWidth: 200,
            }}
          />
        </Stack>
      </Box>

      <DialogContent sx={{ pt: 3, pb: 1 }}>
        <Stack spacing={2.5}>

          {/* Invoice status */}
          {invoiceNumber ? (
            <Box
              sx={{
                p: 2.5, borderRadius: 2,
                background: `linear-gradient(135deg,
                  ${alpha(theme.palette.success.main, 0.07)} 0%,
                  ${alpha(theme.palette.primary.main, 0.04)} 100%)`,
                border: `1.5px solid ${alpha(theme.palette.success.main, 0.3)}`,
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <CheckCircle sx={{ color: "success.main", fontSize: 22, mt: 0.2, flexShrink: 0 }} />
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Invoice Number
                  </Typography>
                  <Typography variant="h6" fontWeight={800} color="success.main" lineHeight={1.2}>
                    {invoiceNumber}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {localInvoiceNumber
                      ? "Invoice number generated — PDF downloading next."
                      : "Auto-generated when payment was collected."}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ) : (
            <Box
              sx={{
                p: 2, borderRadius: 2,
                bgcolor: alpha(theme.palette.info.main, 0.06),
                border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <AutoFixHigh sx={{ fontSize: 18, color: "info.main", flexShrink: 0 }} />
                <Typography variant="body2" color="info.main" fontWeight={600}>
                  Invoice number will be generated automatically when you click Download.
                </Typography>
              </Stack>
            </Box>
          )}

          <Divider />

          {/* Billing summary */}
          <Box
            sx={{
              p: 2, borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
            }}
          >
            <Typography
              variant="overline"
              color="primary.main"
              fontWeight={800}
              sx={{ letterSpacing: 1.5, display: "block", mb: 1.5 }}
            >
              Billing Summary
            </Typography>
            <Stack spacing={0.8}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Customer</Typography>
                <Typography variant="body2" fontWeight={700}>{detail.customer_name ?? "—"}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Trip Fare</Typography>
                <Typography variant="body2" fontWeight={700}>
                  Rs.{finalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Typography>
              </Stack>
              {isTaxInvoice && gstAmount > 0 && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="info.main">
                    GST ({gstRate.toFixed(0)}%)
                  </Typography>
                  <Typography variant="body2" fontWeight={700} color="info.main">
                    + ₹{gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </Typography>
                </Stack>
              )}
              {couponDiscount > 0 && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="success.main">Coupon Discount</Typography>
                  <Typography variant="body2" fontWeight={700} color="success.main">
                    − Rs.{couponDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </Typography>
                </Stack>
              )}
              {advancePaid > 0 && (
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Advance Paid</Typography>
                  <Typography variant="body2" color="text.secondary">
                    − ₹{advancePaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </Typography>
                </Stack>
              )}
              <Divider sx={{ my: 0.5 }} />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" fontWeight={800}>
                  {isTaxInvoice ? "Total (incl. GST)" : "Total Payable"}
                </Typography>
                <Typography variant="body2" fontWeight={800}>
                  ₹{grossTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" fontWeight={800}>Balance Due</Typography>
                <Typography
                  variant="body2"
                  fontWeight={800}
                  color={balanceDue <= 0 ? "success.main" : "warning.main"}
                >
                  {balanceDue <= 0
                    ? "FULLY PAID"
                    : `₹${balanceDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" color="text.secondary">Payment Mode</Typography>
                <Chip
                  label={detail.payment_mode ?? "—"}
                  size="small"
                  color="info"
                  sx={{ fontWeight: 700, fontSize: "0.68rem" }}
                />
              </Stack>
              {detail.cash_pending_at === "DRIVER" && (
                <Box
                  sx={{
                    mt: 0.5, p: 1, borderRadius: 1.5,
                    bgcolor: alpha(theme.palette.warning.main, 0.08),
                    border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
                  }}
                >
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Info sx={{ fontSize: 14, color: "warning.main" }} />
                    <Typography variant="caption" color="warning.dark" fontWeight={600}>
                      Cash collected by driver — pending handover to partner. Settlement tracked on Settlements page.
                    </Typography>
                  </Stack>
                </Box>
              )}
            </Stack>
          </Box>

          {/* Download success */}
          {downloaded && (
            <Box
              sx={{
                p: 1.5, borderRadius: 2,
                bgcolor: alpha(theme.palette.success.main, 0.08),
                border: `1px solid ${alpha(theme.palette.success.main, 0.25)}`,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Download sx={{ fontSize: 16, color: "success.main" }} />
                <Typography variant="caption" color="success.main" fontWeight={700}>
                  Invoice downloaded successfully!
                </Typography>
              </Stack>
            </Box>
          )}

          {/* Error */}
          {error && (
            <Box
              sx={{
                p: 1.5, borderRadius: 2,
                bgcolor: alpha(theme.palette.error.main, 0.08),
                border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
              }}
            >
              <Typography variant="caption" color="error.main" fontWeight={600}>
                {error}
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5, gap: 1 }}>
        <Button onClick={handleClose} disabled={busy} variant="outlined" size="small">
          Close
        </Button>
        <Button
          onClick={handleDownload}
          disabled={busy}
          variant="contained"
          color="warning"
          size="small"
          startIcon={
            busy
              ? <CircularProgress size={14} color="inherit" />
              : <Download fontSize="small" />
          }
          sx={{ fontWeight: 700, minWidth: 180 }}
        >
          {busy
            ? (invoiceNumber ? "Downloading…" : "Generating & Downloading…")
            : "Download Invoice PDF"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
