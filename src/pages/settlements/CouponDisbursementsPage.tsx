// ============================================================
// WAYTERO ADMIN — COUPON DISBURSEMENTS PAGE
// Route: /settlements/coupon-disbursements
//
// Admin sees all pending coupon amounts owed to partners.
// When a coupon was applied on a booking, the partner should
// not bear that discount — platform owes it back to the partner.
//
// Flow:
//   1. Table lists all pending coupon disbursements
//   2. Admin clicks "Disburse" → 2-step modal opens
//      Step 1: Booking + Payment details
//      Step 2: Transfer details → confirm → credits partner wallet
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Stack, Typography, Button, Chip, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Tooltip, alpha, useTheme,
  CircularProgress, Snackbar, Alert,
  Dialog, DialogContent, DialogActions,
  Divider, Stepper, Step, StepLabel,
  LinearProgress,
} from "@mui/material";
import {
  LocalOffer, Refresh, AccountBalanceWallet, ArrowBack, ArrowForward,
  CheckCircle, TaskAlt, ReceiptLong, Person, ArrowBack as Back,
} from "@mui/icons-material";
import {
  settlementService,
  CouponDisbursementItem,
  CouponDisbursementListResponse,
} from "../../services/settlement.service";

const fmtINR = (n: number | null | undefined) => {
  if (n == null) return "—";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ════════════════════════════════════════════════════════════════
// DISBURSE MODAL — 2 steps
// ════════════════════════════════════════════════════════════════

const DISBURSE_STEPS = ["Booking & Payment", "Confirm Transfer"];

function DisburseModal({
  open, item, onClose, onSuccess,
}: {
  open: boolean;
  item: CouponDisbursementItem;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const theme = useTheme();
  const [step,    setStep]    = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => { if (open) { setStep(0); setError(""); } }, [open]);

  function handleClose() { if (loading) return; onClose(); }

  async function handleDisburse() {
    setLoading(true); setError("");
    try {
      const res = await settlementService.disburseCoupon(item.id);
      onSuccess(res.message ?? `₹${item.coupon_discount_amount.toFixed(2)} credited to partner wallet.`);
      handleClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Disbursement failed.");
    } finally { setLoading(false); }
  }

  const balanceAfter = item.partner_wallet_balance + item.coupon_discount_amount;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      {/* Header */}
      <Box sx={{
        background: `linear-gradient(135deg, ${theme.palette.warning.dark} 0%, ${theme.palette.warning.main} 100%)`,
        px: 3, pt: 2.5, pb: 2,
      }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <LocalOffer sx={{ color: "#fff", fontSize: 28 }} />
          <Box flex={1}>
            <Typography variant="h6" fontWeight={800} color="white">Coupon Disbursement</Typography>
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.75) }}>
              {item.booking_number} · {item.partner_name}
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ mt: 2 }}>
          <Stepper activeStep={step} alternativeLabel
            sx={{
              "& .MuiStepLabel-label": { color: alpha("#fff", 0.6), fontSize: "0.72rem", fontWeight: 600 },
              "& .MuiStepLabel-label.Mui-active": { color: "#fff", fontWeight: 800 },
              "& .MuiStepLabel-label.Mui-completed": { color: alpha("#fff", 0.85) },
              "& .MuiStepIcon-root": { color: alpha("#fff", 0.3) },
              "& .MuiStepIcon-root.Mui-active": { color: "#fff" },
              "& .MuiStepConnector-line": { borderColor: alpha("#fff", 0.25) },
            }}
          >
            {DISBURSE_STEPS.map(l => <Step key={l}><StepLabel>{l}</StepLabel></Step>)}
          </Stepper>
        </Box>
      </Box>

      {loading && <LinearProgress />}

      <DialogContent sx={{ pt: 3, pb: 1, minHeight: 240 }}>
        {/* STEP 1 */}
        {step === 0 && (
          <Stack spacing={2}>
            <Typography variant="overline" color="warning.main" fontWeight={800} sx={{ letterSpacing: 1.5 }}>
              Booking & Payment Details
            </Typography>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.grey[500], 0.05), border: `1px solid ${alpha(theme.palette.divider, 0.6)}` }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Box flex={1}>
                    <Typography variant="caption" color="text.secondary">Booking</Typography>
                    <Typography variant="body2" fontWeight={700} color="primary.main">{item.booking_number ?? "—"}</Typography>
                  </Box>
                  <Box flex={1}>
                    <Typography variant="caption" color="text.secondary">Invoice</Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <ReceiptLong sx={{ fontSize: 14, color: "success.main" }} />
                      <Typography variant="body2" fontWeight={700} color="success.main">{item.invoice_number ?? "—"}</Typography>
                    </Stack>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Box flex={1}>
                    <Typography variant="caption" color="text.secondary">Partner</Typography>
                    <Typography variant="body2" fontWeight={600}>{item.partner_name ?? "—"}</Typography>
                    {item.partner_mobile && (
                      <Typography variant="caption" color="text.secondary">{item.partner_mobile}</Typography>
                    )}
                  </Box>
                </Stack>
                <Divider />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <LocalOffer sx={{ fontSize: 16, color: "warning.main" }} />
                    <Typography variant="body2" fontWeight={700}>Coupon Discount Applied</Typography>
                  </Stack>
                  <Typography variant="h5" fontWeight={900} color="warning.main">
                    {fmtINR(item.coupon_discount_amount)}
                  </Typography>
                </Stack>
              </Stack>
            </Box>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.06), border: `1px solid ${alpha(theme.palette.info.main, 0.2)}` }}>
              <Typography variant="caption" color="info.dark" sx={{ lineHeight: 1.7 }}>
                When this coupon was used, the partner's trip earnings were reduced by the discount amount.
                Disbursing restores the partner's earnings by crediting their wallet with{" "}
                <strong>{fmtINR(item.coupon_discount_amount)}</strong>.
              </Typography>
            </Box>
          </Stack>
        )}

        {/* STEP 2 */}
        {step === 1 && (
          <Stack spacing={2}>
            <Typography variant="overline" color="warning.main" fontWeight={800} sx={{ letterSpacing: 1.5 }}>
              Transfer Confirmation
            </Typography>

            {/* Transfer breakdown */}
            <Box sx={{
              p: 2.5, borderRadius: 2,
              background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.07)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
            }}>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Recipient</Typography>
                  <Typography variant="body2" fontWeight={700}>{item.partner_name}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Current Wallet Balance</Typography>
                  <Typography variant="body2" fontWeight={700}>{fmtINR(item.partner_wallet_balance)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <LocalOffer sx={{ fontSize: 14, color: "warning.main" }} />
                    <Typography variant="body2" color="text.secondary">Coupon Disbursement</Typography>
                  </Stack>
                  <Typography variant="body2" fontWeight={700} color="success.main">+ {fmtINR(item.coupon_discount_amount)}</Typography>
                </Stack>
                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" fontWeight={800}>Balance After Transfer</Typography>
                  <Typography variant="h5" fontWeight={900} color="success.main">{fmtINR(balanceAfter)}</Typography>
                </Stack>
              </Stack>
            </Box>

            <Box sx={{
              p: 2, borderRadius: 2,
              bgcolor: alpha(theme.palette.success.main, 0.07),
              border: `1px solid ${alpha(theme.palette.success.main, 0.25)}`,
              display: "flex", gap: 1.5, alignItems: "flex-start",
            }}>
              <CheckCircle sx={{ color: "success.main", fontSize: 20, mt: 0.2, flexShrink: 0 }} />
              <Box>
                <Typography variant="body2" fontWeight={700} color="success.dark" mb={0.5}>
                  Ready to Disburse
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  Clicking Confirm will credit <strong>{fmtINR(item.coupon_discount_amount)}</strong> to{" "}
                  <strong>{item.partner_name}</strong>'s wallet. This action is immediate and cannot be undone.
                </Typography>
              </Box>
            </Box>

            {error && (
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.error.main, 0.08), border: `1px solid ${alpha(theme.palette.error.main, 0.2)}` }}>
                <Typography variant="caption" color="error.main" fontWeight={600}>{error}</Typography>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
        <Button onClick={handleClose} disabled={loading} variant="outlined" size="small">Cancel</Button>
        <Box flex={1} />
        {step > 0 && (
          <Button onClick={() => setStep(0)} disabled={loading} variant="outlined" size="small" startIcon={<ArrowBack fontSize="small" />}>
            Back
          </Button>
        )}
        {step === 0 ? (
          <Button onClick={() => setStep(1)} variant="contained" color="warning" size="small" endIcon={<ArrowForward fontSize="small" />} sx={{ fontWeight: 700 }}>
            Review Transfer
          </Button>
        ) : (
          <Button
            onClick={handleDisburse}
            disabled={loading}
            variant="contained"
            color="success"
            size="small"
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <TaskAlt fontSize="small" />}
            sx={{ fontWeight: 700 }}
          >
            {loading ? "Processing…" : `Confirm · ${fmtINR(item.coupon_discount_amount)}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}


// ════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════

interface SnackState { open: boolean; msg: string; sev: "success" | "error" }

export default function CouponDisbursementsPage() {
  const theme = useTheme();
  const navigate = useNavigate();

  const [tab,          setTab]          = useState(0); // 0=Pending, 1=Disbursed
  const [data,         setData]         = useState<CouponDisbursementListResponse | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [disburseItem, setDisburseItem] = useState<CouponDisbursementItem | null>(null);
  const [snack,        setSnack]        = useState<SnackState>({ open: false, msg: "", sev: "success" });

  const showSnack = (msg: string, sev: "success" | "error" = "success") =>
    setSnack({ open: true, msg, sev });

  const statusFilter = tab === 0 ? "PENDING" : "DISBURSED";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await settlementService.listCouponDisbursements(statusFilter, 1, 50);
      setData(res);
    } catch { showSnack("Failed to load disbursements.", "error"); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Button
            size="small"
            startIcon={<Back fontSize="small" />}
            onClick={() => navigate("/settlements")}
            sx={{ mb: 1, fontWeight: 600, color: "text.secondary" }}
          >
            Back to Settlements
          </Button>
          <Stack direction="row" spacing={1.5} alignItems="center" mb={0.5}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 2,
              background: `linear-gradient(135deg, ${theme.palette.warning.dark} 0%, ${theme.palette.warning.main} 100%)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <LocalOffer sx={{ color: "#fff", fontSize: 22 }} />
            </Box>
            <Typography variant="h5" fontWeight={800}>Coupon Disbursements</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Partners are owed these coupon discount amounts. Approve each to credit their wallet.
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={load} disabled={loading} size="small">
            <Refresh sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Stats */}
      {data && tab === 0 && (
        <Stack direction="row" spacing={2} mb={3} flexWrap="wrap" gap={2}>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: "background.paper", border: `1px solid ${alpha(theme.palette.divider, 0.5)}`, minWidth: 140 }}>
            <Typography variant="caption" color="text.secondary">Pending</Typography>
            <Typography variant="h4" fontWeight={800} color="warning.main">{data.total}</Typography>
          </Box>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: "background.paper", border: `1px solid ${alpha(theme.palette.divider, 0.5)}`, minWidth: 180 }}>
            <Typography variant="caption" color="text.secondary">Total Amount Owed</Typography>
            <Typography variant="h5" fontWeight={800} color="warning.dark">
              {fmtINR(data.items.reduce((s, i) => s + i.coupon_discount_amount, 0))}
            </Typography>
          </Box>
        </Stack>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)}
        sx={{ mb: 2, "& .MuiTab-root": { fontWeight: 700 }, "& .MuiTabs-indicator": { height: 3, borderRadius: 1.5 } }}
      >
        <Tab label={
          <Stack direction="row" spacing={1} alignItems="center">
            <span>Pending</span>
            {data && tab === 0 && data.total > 0 && (
              <Chip label={data.total} size="small" color="warning" sx={{ fontWeight: 700, height: 18, fontSize: "0.62rem" }} />
            )}
          </Stack>
        } />
        <Tab label="Disbursed" />
      </Tabs>

      <TableContainer component={Paper} sx={{ borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.warning.main, 0.05) }}>
              {["Booking", "Partner", "Coupon Amount", "Partner Wallet", "Status", "Created", ""].map(h => (
                <TableCell key={h} sx={{ fontWeight: 800, fontSize: "0.72rem", letterSpacing: 0.5, py: 1.5, color: "text.secondary" }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}><CircularProgress size={28} /></TableCell></TableRow>
            )}
            {!loading && (!data || data.items.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                  <Stack alignItems="center" spacing={1}>
                    <LocalOffer sx={{ fontSize: 36, color: "text.disabled" }} />
                    <Typography variant="body2" color="text.secondary">
                      {tab === 0 ? "No pending coupon disbursements" : "No disbursed coupons yet"}
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            )}
            {!loading && data?.items.map(row => (
              <TableRow key={row.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={700} color="primary.main">{row.booking_number ?? "—"}</Typography>
                  <Typography variant="caption" color="text.secondary">{row.invoice_number ?? ""}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{row.partner_name ?? "—"}</Typography>
                  <Typography variant="caption" color="text.secondary">{row.partner_mobile ?? ""}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={700} color="warning.main">{fmtINR(row.coupon_discount_amount)}</Typography>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <AccountBalanceWallet sx={{ fontSize: 14, color: "text.secondary" }} />
                    <Typography variant="body2">{fmtINR(row.partner_wallet_balance)}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip
                    label={row.status}
                    size="small"
                    color={row.status === "DISBURSED" ? "success" : "warning"}
                    sx={{ fontWeight: 700 }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {row.created_at ? new Date(row.created_at).toLocaleDateString("en-IN") : "—"}
                  </Typography>
                  {row.disbursed_at && (
                    <Typography variant="caption" color="success.main" display="block">
                      Disbursed: {new Date(row.disbursed_at).toLocaleDateString("en-IN")}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {row.status === "PENDING" && (
                    <Button
                      size="small"
                      variant="contained"
                      color="warning"
                      onClick={() => setDisburseItem(row)}
                      startIcon={<AccountBalanceWallet sx={{ fontSize: 14 }} />}
                      sx={{ fontWeight: 700, fontSize: "0.7rem" }}
                    >
                      Disburse
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Disburse Modal */}
      {disburseItem && (
        <DisburseModal
          open={!!disburseItem}
          item={disburseItem}
          onClose={() => setDisburseItem(null)}
          onSuccess={msg => { showSnack(msg); load(); setDisburseItem(null); }}
        />
      )}

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ fontWeight: 600 }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
