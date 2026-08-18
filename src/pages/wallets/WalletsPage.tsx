// ============================================================
// WAYTERO ADMIN — WALLETS PAGE
// Route: /wallets
// BRD Part 6 §128-136, §150, §157, §159
//
// Features:
//   • Dashboard summary cards (total balances, counts)
//   • Partner Wallets tab — searchable list, recharge, credit, debit
//   • Customer Wallets tab — searchable list, credit, debit
//   • Wallet detail drawer — full ledger with pagination
//   • Recharge modal (CASH / UPI)
//   • Credit/Debit adjustment modal (cause + remarks)
// ============================================================
import { useState, useCallback } from "react";
import {
  Box, Stack, Typography, Grid, Card, CardContent, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, IconButton, Tooltip, alpha, useTheme,
  CircularProgress, InputAdornment, TextField, Button,
  Drawer, Divider, Dialog, DialogContent, DialogActions,
  Select, MenuItem, FormControl, InputLabel, Alert,
  Avatar, Badge, LinearProgress,
} from "@mui/material";
import {
  AccountBalanceWallet, Search, Refresh, AddCard, ArrowUpward,
  ArrowDownward, Person, Handshake, Close, Receipt,
  TrendingUp, MonetizationOn, CurrencyRupee, History,
  CheckCircle, Warning, Block, ExpandMore,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  walletService,
  PartnerWalletItem, CustomerWalletItem,
  PartnerWalletDetail, CustomerWalletDetail,
  WalletLedgerEntry,
} from "../../services/wallet.service";

// ── Helpers ───────────────────────────────────────────────────
const fmtINR = (n: number) =>
  `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (s: string | null) => {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

const REF_TYPE_META: Record<string, { label: string; color: "default" | "success" | "error" | "info" | "warning" }> = {
  RECHARGE_CASH:      { label: "Recharge (Cash)",  color: "success" },
  RECHARGE_UPI:       { label: "Recharge (UPI)",   color: "success" },
  CREDIT_ADJUSTMENT:  { label: "Credit Adj.",       color: "info"    },
  DEBIT_ADJUSTMENT:   { label: "Debit Adj.",        color: "error"   },
  CAB_COMMISSION:     { label: "Commission",         color: "warning" },
  SETTLEMENT:         { label: "Settlement",         color: "warning" },
  REFUND:             { label: "Refund",             color: "info"    },
  CAB_PAYMENT:        { label: "CAB Payment",        color: "warning" },
};

// ── Summary Cards ─────────────────────────────────────────────
function SummaryCards({ summary }: { summary: any }) {
  const theme = useTheme();

  const cards = [
    {
      label:    "Partner Available Balance",
      value:    fmtINR(summary.partner_wallets.total_available),
      sub:      `${summary.partner_wallets.total_partners} partner wallets`,
      icon:     <Handshake sx={{ fontSize: 28 }} />,
      gradient: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
    },
    {
      label:    "Partner Hold Balance",
      value:    fmtINR(summary.partner_wallets.total_hold),
      sub:      `${summary.partner_wallets.active_count} active · ${summary.partner_wallets.suspended_count} suspended`,
      icon:     <MonetizationOn sx={{ fontSize: 28 }} />,
      gradient: `linear-gradient(135deg, #7C3AED, #9F67FA)`,
    },
    {
      label:    "Customer Available Balance",
      value:    fmtINR(summary.customer_wallets.total_available),
      sub:      `${summary.customer_wallets.total_customers} customer wallets`,
      icon:     <Person sx={{ fontSize: 28 }} />,
      gradient: `linear-gradient(135deg, ${theme.palette.success.dark}, ${theme.palette.success.main})`,
    },
    {
      label:    "Customer Hold Balance",
      value:    fmtINR(summary.customer_wallets.total_hold),
      sub:      "Funds in hold",
      icon:     <AccountBalanceWallet sx={{ fontSize: 28 }} />,
      gradient: `linear-gradient(135deg, #D97706, #F59E0B)`,
    },
  ];

  return (
    <Grid container spacing={2}>
      {cards.map((c) => (
        <Grid item xs={12} sm={6} lg={3} key={c.label}>
          <Card sx={{ borderRadius: 3, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
            <Box sx={{ background: c.gradient, p: 2.5, color: "#fff" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 600, letterSpacing: 0.5 }}>
                    {c.label.toUpperCase()}
                  </Typography>
                  <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5, lineHeight: 1.2 }}>
                    {c.value}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.75, mt: 0.5, display: "block" }}>
                    {c.sub}
                  </Typography>
                </Box>
                <Box sx={{ opacity: 0.25, mt: 0.5 }}>{c.icon}</Box>
              </Stack>
            </Box>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

// ── Ledger Table ──────────────────────────────────────────────
function LedgerTable({
  entries, total, page, totalPages, loading,
  onPageChange,
}: {
  entries: WalletLedgerEntry[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  onPageChange: (p: number) => void;
}) {
  const theme = useTheme();
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ letterSpacing: 1, textTransform: "uppercase" }}>
          Ledger — {total} entries
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <Button size="small" disabled={page <= 1} onClick={() => onPageChange(page - 1)} sx={{ minWidth: 32 }}>‹</Button>
          <Typography variant="caption" color="text.secondary" sx={{ px: 1, py: 0.5 }}>
            {page} / {totalPages}
          </Typography>
          <Button size="small" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} sx={{ minWidth: 32 }}>›</Button>
        </Stack>
      </Stack>
      {loading && <LinearProgress sx={{ mb: 1, borderRadius: 1 }} />}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
              {["Date", "Type", "Credit", "Debit", "Balance", "Reference", "Note"].map(h => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.7rem", letterSpacing: 0.5, color: "text.secondary" }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">No transactions yet</Typography>
                </TableCell>
              </TableRow>
            )}
            {entries.map((e) => {
              const meta = REF_TYPE_META[e.ref_type] ?? { label: e.ref_type, color: "default" as const };
              const isCredit = e.credit > 0;
              return (
                <TableRow key={e.id} hover>
                  <TableCell sx={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>{fmtDate(e.created_at)}</TableCell>
                  <TableCell><Chip label={meta.label} color={meta.color} size="small" sx={{ fontWeight: 700, fontSize: "0.65rem" }} /></TableCell>
                  <TableCell sx={{ color: "success.main", fontWeight: 700, fontSize: "0.8rem" }}>
                    {e.credit > 0 ? `+ ${fmtINR(e.credit)}` : "—"}
                  </TableCell>
                  <TableCell sx={{ color: "error.main", fontWeight: 700, fontSize: "0.8rem" }}>
                    {e.debit > 0 ? `− ${fmtINR(e.debit)}` : "—"}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: "0.82rem" }}>{fmtINR(e.balance_after)}</TableCell>
                  <TableCell sx={{ fontSize: "0.7rem", color: "text.secondary", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.ref}
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.72rem", color: "text.secondary", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.narration}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ── Partner Wallet Drawer ─────────────────────────────────────
function PartnerWalletDrawer({
  partnerId, onClose, onAction,
}: {
  partnerId: number | null;
  onClose: () => void;
  onAction: (type: "recharge" | "credit" | "debit", id: number) => void;
}) {
  const theme = useTheme();
  const [ledgerPage, setLedgerPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["partner-wallet-detail", partnerId, ledgerPage],
    queryFn: () => walletService.getPartnerWallet(partnerId!, { ledger_page: ledgerPage }),
    enabled: !!partnerId,
  });

  if (!partnerId) return null;

  const w = data?.wallet;
  const p = data?.partner;

  return (
    <Drawer anchor="right" open={!!partnerId} onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 560, md: 640 }, p: 0 } }}>
      {/* Header */}
      <Box sx={{
        background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
        px: 3, py: 2.5,
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: alpha("#fff", 0.2), width: 44, height: 44 }}>
              <Handshake sx={{ color: "#fff" }} />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={800} color="white" lineHeight={1.2}>
                {p?.partner_name ?? "Loading..."}
              </Typography>
              <Typography variant="caption" sx={{ color: alpha("#fff", 0.75) }}>
                {p?.partner_code} · {p?.partner_type} · {p?.mobile}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} sx={{ color: alpha("#fff", 0.8) }} size="small">
            <Close />
          </IconButton>
        </Stack>
      </Box>

      <Box sx={{ p: 3, overflow: "auto", flex: 1 }}>
        {isLoading && <CircularProgress size={32} sx={{ display: "block", mx: "auto", my: 4 }} />}
        {data && (
          <Stack spacing={3}>
            {/* Balance Cards */}
            <Grid container spacing={1.5}>
              {[
                { label: "Available", value: w!.available_balance, color: "success.main" },
                { label: "On Hold",   value: w!.hold_balance,      color: "warning.main" },
                { label: "Credit Limit", value: w!.credit_limit,   color: "info.main" },
                { label: "Total",     value: w!.total_balance,      color: "primary.main" },
              ].map(({ label, value, color }) => (
                <Grid item xs={6} key={label}>
                  <Box sx={{
                    p: 1.5, borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                  }}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography variant="h6" fontWeight={800} color={color}>
                      {fmtINR(value)}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>

            {/* Status + type */}
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip label={`Wallet: ${w!.wallet_status}`}
                color={w!.wallet_status === "ACTIVE" ? "success" : "error"}
                size="small" sx={{ fontWeight: 700 }} />
              <Chip label={`Type: ${w!.wallet_type}`} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
              <Chip label={`Partner: ${p!.partner_status}`}
                color={p!.partner_status === "ACTIVE" ? "success" : "warning"}
                size="small" variant="outlined" sx={{ fontWeight: 600 }} />
            </Stack>

            {/* Action Buttons */}
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained" color="success" size="small" startIcon={<AddCard />}
                onClick={() => onAction("recharge", partnerId!)}
                sx={{ fontWeight: 700 }}
              >
                Recharge
              </Button>
              <Button
                variant="outlined" color="primary" size="small" startIcon={<ArrowUpward />}
                onClick={() => onAction("credit", partnerId!)}
                sx={{ fontWeight: 700 }}
              >
                Credit
              </Button>
              <Button
                variant="outlined" color="error" size="small" startIcon={<ArrowDownward />}
                onClick={() => onAction("debit", partnerId!)}
                sx={{ fontWeight: 700 }}
              >
                Debit
              </Button>
              <IconButton size="small" onClick={() => refetch()}>
                <Refresh fontSize="small" />
              </IconButton>
            </Stack>

            <Divider />

            {/* Ledger */}
            <LedgerTable
              entries={data.ledger.entries}
              total={data.ledger.total}
              page={data.ledger.page}
              totalPages={data.ledger.total_pages}
              loading={isLoading}
              onPageChange={setLedgerPage}
            />
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}

// ── Customer Wallet Drawer ────────────────────────────────────
function CustomerWalletDrawer({
  customerId, onClose, onAction,
}: {
  customerId: number | null;
  onClose: () => void;
  onAction: (type: "credit" | "debit", id: number) => void;
}) {
  const theme = useTheme();
  const [ledgerPage, setLedgerPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["customer-wallet-detail", customerId, ledgerPage],
    queryFn: () => walletService.getCustomerWallet(customerId!, { ledger_page: ledgerPage }),
    enabled: !!customerId,
  });

  if (!customerId) return null;

  const w = data?.wallet;
  const c = data?.customer;

  return (
    <Drawer anchor="right" open={!!customerId} onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 560, md: 640 }, p: 0 } }}>
      <Box sx={{
        background: `linear-gradient(135deg, ${theme.palette.success.dark}, ${theme.palette.success.main})`,
        px: 3, py: 2.5,
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: alpha("#fff", 0.2), width: 44, height: 44 }}>
              <Person sx={{ color: "#fff" }} />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={800} color="white" lineHeight={1.2}>
                {c?.name ?? "Loading..."}
              </Typography>
              <Typography variant="caption" sx={{ color: alpha("#fff", 0.75) }}>
                {c?.mobile} {c?.email ? `· ${c.email}` : ""}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} sx={{ color: alpha("#fff", 0.8) }} size="small">
            <Close />
          </IconButton>
        </Stack>
      </Box>

      <Box sx={{ p: 3, overflow: "auto", flex: 1 }}>
        {isLoading && <CircularProgress size={32} sx={{ display: "block", mx: "auto", my: 4 }} />}
        {data && (
          <Stack spacing={3}>
            <Grid container spacing={1.5}>
              {[
                { label: "Available", value: w!.available_balance, color: "success.main" },
                { label: "On Hold",   value: w!.hold_balance,      color: "warning.main" },
                { label: "Total",     value: w!.total_balance,      color: "primary.main" },
              ].map(({ label, value, color }) => (
                <Grid item xs={4} key={label}>
                  <Box sx={{
                    p: 1.5, borderRadius: 2,
                    bgcolor: alpha(theme.palette.success.main, 0.04),
                    border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                  }}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography variant="h6" fontWeight={800} color={color}>{fmtINR(value)}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>

            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip label={`Wallet: ${w!.wallet_status}`}
                color={w!.wallet_status === "ACTIVE" ? "success" : "error"}
                size="small" sx={{ fontWeight: 700 }} />
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined" color="primary" size="small" startIcon={<ArrowUpward />}
                onClick={() => onAction("credit", customerId!)}
                sx={{ fontWeight: 700 }}
              >
                Credit
              </Button>
              <Button
                variant="outlined" color="error" size="small" startIcon={<ArrowDownward />}
                onClick={() => onAction("debit", customerId!)}
                sx={{ fontWeight: 700 }}
              >
                Debit
              </Button>
              <IconButton size="small" onClick={() => refetch()}>
                <Refresh fontSize="small" />
              </IconButton>
            </Stack>

            <Divider />

            <LedgerTable
              entries={data.ledger.entries}
              total={data.ledger.total}
              page={data.ledger.page}
              totalPages={data.ledger.total_pages}
              loading={isLoading}
              onPageChange={setLedgerPage}
            />
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}

// ── Recharge Modal ────────────────────────────────────────────
function RechargeModal({
  partnerId, open, onClose, onDone,
}: {
  partnerId: number | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"CASH" | "UPI">("CASH");
  const [upiRef, setUpiRef] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!partnerId) return;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError("Enter a valid amount (> 0)"); return;
    }
    if (mode === "UPI" && !upiRef.trim()) {
      setError("UPI Reference / UTR number is required for UPI payment"); return;
    }
    setLoading(true); setError("");
    try {
      const res = await walletService.rechargePartner({
        partner_id: partnerId,
        amount: Number(amount),
        payment_mode: mode,
        upi_reference: upiRef || undefined,
        remarks: remarks || undefined,
      });
      enqueueSnackbar(res.message, { variant: "success" });
      qc.invalidateQueries({ queryKey: ["partner-wallet-detail", partnerId] });
      qc.invalidateQueries({ queryKey: ["partner-wallets"] });
      qc.invalidateQueries({ queryKey: ["wallet-summary"] });
      onDone();
      handleClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Recharge failed");
    } finally { setLoading(false); }
  }

  function handleClose() {
    setAmount(""); setMode("CASH"); setUpiRef(""); setRemarks(""); setError("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}>
      <Box sx={{
        background: `linear-gradient(135deg, ${theme.palette.success.dark}, ${theme.palette.success.main})`,
        px: 3, pt: 2.5, pb: 2,
      }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <AddCard sx={{ color: "#fff", fontSize: 26 }} />
          <Box>
            <Typography variant="h6" fontWeight={800} color="white">Recharge Partner Wallet</Typography>
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.75) }}>Admin-recorded recharge</Typography>
          </Box>
        </Stack>
      </Box>
      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={2}>
          <FormControl size="small" fullWidth>
            <InputLabel>Payment Mode</InputLabel>
            <Select value={mode} label="Payment Mode" onChange={e => setMode(e.target.value as any)}>
              <MenuItem value="CASH">Cash</MenuItem>
              <MenuItem value="UPI">UPI / Bank Transfer</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Amount (Rs.)"
            type="number"
            size="small" fullWidth
            value={amount}
            onChange={e => { setAmount(e.target.value); setError(""); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><CurrencyRupee sx={{ fontSize: 18, color: "text.secondary" }} /></InputAdornment> }}
            inputProps={{ min: 1 }}
          />
          {mode === "UPI" && (
            <TextField
              label="UPI Reference / UTR Number *"
              size="small" fullWidth
              value={upiRef}
              onChange={e => { setUpiRef(e.target.value); setError(""); }}
              placeholder="e.g. 426789123456"
            />
          )}
          <TextField
            label="Remarks (optional)"
            size="small" fullWidth multiline rows={2}
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            placeholder="Admin note for this recharge"
          />
          {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={handleClose} disabled={loading} variant="outlined" size="small">Cancel</Button>
        <Button
          onClick={handleSubmit} disabled={loading}
          variant="contained" color="success" size="small"
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <AddCard fontSize="small" />}
          sx={{ fontWeight: 700 }}
        >
          {loading ? "Processing…" : "Recharge Wallet"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Credit / Debit Adjustment Modal ───────────────────────────
function AdjustmentModal({
  open, type, walletType, entityId, onClose, onDone,
}: {
  open: boolean;
  type: "credit" | "debit";
  walletType: "PARTNER" | "CUSTOMER";
  entityId: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [cause, setCause] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isCredit = type === "credit";
  const color = isCredit ? theme.palette.primary.main : theme.palette.error.main;
  const darkColor = isCredit ? theme.palette.primary.dark : theme.palette.error.dark;

  async function handleSubmit() {
    if (!entityId) return;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError("Enter a valid amount (> 0)"); return;
    }
    if (!cause.trim() || cause.trim().length < 3) {
      setError("Cause/reason is required (min 3 characters)"); return;
    }
    setLoading(true); setError("");
    try {
      const fn = isCredit ? walletService.credit : walletService.debit;
      const res = await fn({
        wallet_type: walletType,
        entity_id: entityId,
        amount: Number(amount),
        cause: cause.trim(),
        remarks: remarks || undefined,
      });
      enqueueSnackbar(res.message, { variant: "success" });
      const qKey = walletType === "PARTNER"
        ? ["partner-wallet-detail", entityId]
        : ["customer-wallet-detail", entityId];
      qc.invalidateQueries({ queryKey: qKey });
      qc.invalidateQueries({ queryKey: ["wallet-summary"] });
      onDone();
      handleClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Operation failed");
    } finally { setLoading(false); }
  }

  function handleClose() {
    setAmount(""); setCause(""); setRemarks(""); setError("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}>
      <Box sx={{
        background: `linear-gradient(135deg, ${darkColor}, ${color})`,
        px: 3, pt: 2.5, pb: 2,
      }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {isCredit
            ? <ArrowUpward sx={{ color: "#fff", fontSize: 26 }} />
            : <ArrowDownward sx={{ color: "#fff", fontSize: 26 }} />}
          <Box>
            <Typography variant="h6" fontWeight={800} color="white">
              {isCredit ? "Credit" : "Debit"} {walletType === "PARTNER" ? "Partner" : "Customer"} Wallet
            </Typography>
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.75) }}>
              Manual adjustment — BRD §150
            </Typography>
          </Box>
        </Stack>
      </Box>
      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={2}>
          <TextField
            label={`Amount to ${isCredit ? "Credit" : "Debit"} (Rs.) *`}
            type="number" size="small" fullWidth
            value={amount}
            onChange={e => { setAmount(e.target.value); setError(""); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><CurrencyRupee sx={{ fontSize: 18, color: "text.secondary" }} /></InputAdornment> }}
            inputProps={{ min: 0.01, step: 0.01 }}
          />
          <TextField
            label="Cause / Reason *"
            size="small" fullWidth
            value={cause}
            onChange={e => { setCause(e.target.value); setError(""); }}
            placeholder={isCredit ? "e.g. Promotional credit, Compensation" : "e.g. Penalty, Chargeback"}
            helperText="This is recorded permanently in the ledger"
          />
          <TextField
            label="Additional Remarks (optional)"
            size="small" fullWidth multiline rows={2}
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            placeholder="Admin note for audit trail"
          />
          {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={handleClose} disabled={loading} variant="outlined" size="small">Cancel</Button>
        <Button
          onClick={handleSubmit} disabled={loading}
          variant="contained"
          color={isCredit ? "primary" : "error"}
          size="small"
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : isCredit ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
          sx={{ fontWeight: 700 }}
        >
          {loading ? "Processing…" : `Confirm ${isCredit ? "Credit" : "Debit"}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════
// PARTNER WALLETS TAB
// ════════════════════════════════════════════════════════════════
function PartnerWalletsTab({
  onViewWallet, onAction,
}: {
  onViewWallet: (id: number) => void;
  onAction: (type: "recharge" | "credit" | "debit", id: number) => void;
}) {
  const theme = useTheme();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["partner-wallets", page, search, statusFilter],
    queryFn: () => walletService.listPartnerWallets({ page, page_size: 20, search, status: statusFilter }),
    staleTime: 15_000,
  });

  return (
    <Box>
      <Stack direction="row" spacing={1.5} mb={2} flexWrap="wrap" gap={1}>
        <TextField
          size="small"
          placeholder="Search partner name, mobile, code…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment> }}
          sx={{ width: 280 }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="SUSPENDED">Suspended</MenuItem>
          </Select>
        </FormControl>
        <IconButton onClick={() => refetch()} size="small"><Refresh fontSize="small" /></IconButton>
        {data && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center" }}>
            {data.total} wallets
          </Typography>
        )}
      </Stack>

      {isLoading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      <TableContainer component={Paper} sx={{ borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
              {["Partner", "Type", "Available", "Hold", "Wallet Status", "Actions"].map(h => (
                <TableCell key={h} sx={{ fontWeight: 800, fontSize: "0.72rem", letterSpacing: 0.5, color: "text.secondary" }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {!isLoading && (!data || data.items.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <AccountBalanceWallet sx={{ fontSize: 40, color: "text.disabled", display: "block", mx: "auto", mb: 1 }} />
                  <Typography color="text.secondary">No partner wallets found</Typography>
                </TableCell>
              </TableRow>
            )}
            {data?.items.map(row => (
              <TableRow key={row.wallet_id} hover sx={{ cursor: "pointer" }}
                onClick={() => onViewWallet(row.partner_id)}>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar sx={{ width: 32, height: 32, bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main", fontSize: "0.75rem" }}>
                      {row.partner_name?.[0]?.toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={700}>{row.partner_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{row.partner_code} · {row.mobile}</Typography>
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip label={row.partner_type} size="small" variant="outlined"
                    color={row.partner_type === "COMPANY" ? "primary" : "default"}
                    sx={{ fontWeight: 600, fontSize: "0.65rem" }} />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={800}
                    color={row.available_balance > 0 ? "success.main" : "text.secondary"}>
                    {fmtINR(row.available_balance)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color={row.hold_balance > 0 ? "warning.main" : "text.disabled"}>
                    {fmtINR(row.hold_balance)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={row.wallet_status}
                    size="small"
                    color={row.wallet_status === "ACTIVE" ? "success" : "error"}
                    sx={{ fontWeight: 700, fontSize: "0.65rem" }}
                  />
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Recharge wallet">
                      <IconButton size="small" color="success"
                        onClick={() => onAction("recharge", row.partner_id)}>
                        <AddCard sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Credit adjustment">
                      <IconButton size="small" color="primary"
                        onClick={() => onAction("credit", row.partner_id)}>
                        <ArrowUpward sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Debit adjustment">
                      <IconButton size="small" color="error"
                        onClick={() => onAction("debit", row.partner_id)}>
                        <ArrowDownward sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <Stack direction="row" justifyContent="center" spacing={1} mt={2}>
          <Button size="small" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹ Prev</Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center" }}>
            Page {page} of {data.total_pages}
          </Typography>
          <Button size="small" disabled={page >= data.total_pages} onClick={() => setPage(p => p + 1)}>Next ›</Button>
        </Stack>
      )}
    </Box>
  );
}

// ════════════════════════════════════════════════════════════════
// CUSTOMER WALLETS TAB
// ════════════════════════════════════════════════════════════════
function CustomerWalletsTab({
  onViewWallet, onAction,
}: {
  onViewWallet: (id: number) => void;
  onAction: (type: "credit" | "debit", id: number) => void;
}) {
  const theme = useTheme();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["customer-wallets", page, search],
    queryFn: () => walletService.listCustomerWallets({ page, page_size: 20, search }),
    staleTime: 15_000,
  });

  return (
    <Box>
      <Stack direction="row" spacing={1.5} mb={2} flexWrap="wrap" gap={1}>
        <TextField
          size="small"
          placeholder="Search customer name, mobile, email…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment> }}
          sx={{ width: 300 }}
        />
        <IconButton onClick={() => refetch()} size="small"><Refresh fontSize="small" /></IconButton>
        {data && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center" }}>
            {data.total} wallets
          </Typography>
        )}
      </Stack>

      {isLoading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      <TableContainer component={Paper} sx={{ borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.success.main, 0.05) }}>
              {["Customer", "Available", "Hold", "Status", "Actions"].map(h => (
                <TableCell key={h} sx={{ fontWeight: 800, fontSize: "0.72rem", letterSpacing: 0.5, color: "text.secondary" }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {!isLoading && (!data || data.items.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <Person sx={{ fontSize: 40, color: "text.disabled", display: "block", mx: "auto", mb: 1 }} />
                  <Typography color="text.secondary">No customer wallets found</Typography>
                </TableCell>
              </TableRow>
            )}
            {data?.items.map(row => (
              <TableRow key={row.wallet_id} hover sx={{ cursor: "pointer" }}
                onClick={() => onViewWallet(row.customer_id)}>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar sx={{ width: 32, height: 32, bgcolor: alpha(theme.palette.success.main, 0.12), color: "success.main", fontSize: "0.75rem" }}>
                      {row.customer_name?.[0]?.toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={700}>{row.customer_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{row.mobile}{row.email ? ` · ${row.email}` : ""}</Typography>
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={800}
                    color={row.available_balance > 0 ? "success.main" : "text.secondary"}>
                    {fmtINR(row.available_balance)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color={row.hold_balance > 0 ? "warning.main" : "text.disabled"}>
                    {fmtINR(row.hold_balance)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={row.wallet_status}
                    size="small"
                    color={row.wallet_status === "ACTIVE" ? "success" : "error"}
                    sx={{ fontWeight: 700, fontSize: "0.65rem" }}
                  />
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Credit adjustment">
                      <IconButton size="small" color="primary"
                        onClick={() => onAction("credit", row.customer_id)}>
                        <ArrowUpward sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Debit adjustment">
                      <IconButton size="small" color="error"
                        onClick={() => onAction("debit", row.customer_id)}>
                        <ArrowDownward sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {data && data.total_pages > 1 && (
        <Stack direction="row" justifyContent="center" spacing={1} mt={2}>
          <Button size="small" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹ Prev</Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center" }}>
            Page {page} of {data.total_pages}
          </Typography>
          <Button size="small" disabled={page >= data.total_pages} onClick={() => setPage(p => p + 1)}>Next ›</Button>
        </Stack>
      )}
    </Box>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════
export default function WalletsPage() {
  const theme = useTheme();
  const [mainTab, setMainTab] = useState(0);

  // Drawer state
  const [partnerDrawerId,  setPartnerDrawerId]  = useState<number | null>(null);
  const [customerDrawerId, setCustomerDrawerId] = useState<number | null>(null);

  // Modal state
  type ActionModal = {
    open: boolean;
    type: "recharge" | "credit" | "debit";
    walletType: "PARTNER" | "CUSTOMER";
    entityId: number | null;
  };
  const [actionModal, setActionModal] = useState<ActionModal>({
    open: false, type: "credit", walletType: "PARTNER", entityId: null,
  });

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ["wallet-summary"],
    queryFn: walletService.getSummary,
    staleTime: 30_000,
  });

  function openAction(type: "recharge" | "credit" | "debit", walletType: "PARTNER" | "CUSTOMER", id: number) {
    setActionModal({ open: true, type, walletType, entityId: id });
  }

  function handlePartnerAction(type: "recharge" | "credit" | "debit", id: number) {
    openAction(type, "PARTNER", id);
  }

  function handleCustomerAction(type: "credit" | "debit", id: number) {
    openAction(type, "CUSTOMER", id);
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Page Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center" mb={0.5}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 2,
              background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <AccountBalanceWallet sx={{ color: "#fff", fontSize: 22 }} />
            </Box>
            <Typography variant="h5" fontWeight={800}>Wallet Management</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Manage partner &amp; customer wallets — recharge, credit, debit, and full ledger history.
          </Typography>
        </Box>
        <Tooltip title="Refresh summary">
          <IconButton onClick={() => refetchSummary()} size="small" sx={{ mt: 0.5 }}>
            <Refresh sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack spacing={3}>
        {/* Summary Cards */}
        {summaryLoading && <LinearProgress sx={{ borderRadius: 1 }} />}
        {summary && <SummaryCards summary={summary} />}

        {/* Recent Activity */}
        {summary && (summary.recent_partner_activity.length > 0 || summary.recent_customer_activity.length > 0) && (
          <Grid container spacing={2}>
            {summary.recent_partner_activity.length > 0 && (
              <Grid item xs={12} md={6}>
                <Card sx={{ borderRadius: 3, border: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
                  <CardContent sx={{ pb: "16px !important" }}>
                    <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                      <History sx={{ fontSize: 18, color: "primary.main" }} />
                      <Typography variant="subtitle2" fontWeight={800}>Recent Partner Activity</Typography>
                    </Stack>
                    <Stack spacing={1}>
                      {summary.recent_partner_activity.map(a => {
                        const meta = REF_TYPE_META[a.ref_type] ?? { label: a.ref_type, color: "default" as const };
                        return (
                          <Stack key={a.id} direction="row" justifyContent="space-between" alignItems="center"
                            sx={{ py: 0.75, px: 1, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.03), border: `1px solid ${alpha(theme.palette.divider, 0.4)}` }}>
                            <Box>
                              <Typography variant="caption" fontWeight={700}>{a.partner_name}</Typography>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <Chip label={meta.label} color={meta.color} size="small" sx={{ fontSize: "0.58rem", height: 16 }} />
                                <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.65rem" }}>
                                  {new Date(a.created_at).toLocaleDateString("en-IN")}
                                </Typography>
                              </Stack>
                            </Box>
                            <Typography variant="body2" fontWeight={800}
                              color={a.credit > 0 ? "success.main" : "error.main"}>
                              {a.credit > 0 ? `+${fmtINR(a.credit)}` : `-${fmtINR(a.debit)}`}
                            </Typography>
                          </Stack>
                        );
                      })}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            )}
            {summary.recent_customer_activity.length > 0 && (
              <Grid item xs={12} md={6}>
                <Card sx={{ borderRadius: 3, border: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
                  <CardContent sx={{ pb: "16px !important" }}>
                    <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                      <History sx={{ fontSize: 18, color: "success.main" }} />
                      <Typography variant="subtitle2" fontWeight={800}>Recent Customer Activity</Typography>
                    </Stack>
                    <Stack spacing={1}>
                      {summary.recent_customer_activity.map(a => {
                        const meta = REF_TYPE_META[a.ref_type] ?? { label: a.ref_type, color: "default" as const };
                        return (
                          <Stack key={a.id} direction="row" justifyContent="space-between" alignItems="center"
                            sx={{ py: 0.75, px: 1, borderRadius: 1.5, bgcolor: alpha(theme.palette.success.main, 0.03), border: `1px solid ${alpha(theme.palette.divider, 0.4)}` }}>
                            <Box>
                              <Typography variant="caption" fontWeight={700}>{a.customer_name}</Typography>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <Chip label={meta.label} color={meta.color} size="small" sx={{ fontSize: "0.58rem", height: 16 }} />
                                <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.65rem" }}>
                                  {new Date(a.created_at).toLocaleDateString("en-IN")}
                                </Typography>
                              </Stack>
                            </Box>
                            <Typography variant="body2" fontWeight={800}
                              color={a.credit > 0 ? "success.main" : "error.main"}>
                              {a.credit > 0 ? `+${fmtINR(a.credit)}` : `-${fmtINR(a.debit)}`}
                            </Typography>
                          </Stack>
                        );
                      })}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        )}

        {/* Main Tabs */}
        <Card sx={{ borderRadius: 3, border: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
          <Box sx={{ borderBottom: 1, borderColor: "divider", px: 2, pt: 1 }}>
            <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)}>
              <Tab
                icon={<Handshake sx={{ fontSize: 16 }} />} iconPosition="start"
                label="Partner Wallets"
                sx={{ fontWeight: 700, minHeight: 48, fontSize: "0.82rem" }}
              />
              <Tab
                icon={<Person sx={{ fontSize: 16 }} />} iconPosition="start"
                label="Customer Wallets"
                sx={{ fontWeight: 700, minHeight: 48, fontSize: "0.82rem" }}
              />
            </Tabs>
          </Box>
          <Box sx={{ p: 2.5 }}>
            {mainTab === 0 && (
              <PartnerWalletsTab
                onViewWallet={setPartnerDrawerId}
                onAction={handlePartnerAction}
              />
            )}
            {mainTab === 1 && (
              <CustomerWalletsTab
                onViewWallet={setCustomerDrawerId}
                onAction={handleCustomerAction}
              />
            )}
          </Box>
        </Card>
      </Stack>

      {/* Partner Wallet Drawer */}
      <PartnerWalletDrawer
        partnerId={partnerDrawerId}
        onClose={() => setPartnerDrawerId(null)}
        onAction={(type, id) => {
          handlePartnerAction(type, id);
        }}
      />

      {/* Customer Wallet Drawer */}
      <CustomerWalletDrawer
        customerId={customerDrawerId}
        onClose={() => setCustomerDrawerId(null)}
        onAction={(type, id) => {
          handleCustomerAction(type, id);
        }}
      />

      {/* Recharge Modal */}
      <RechargeModal
        partnerId={actionModal.type === "recharge" ? actionModal.entityId : null}
        open={actionModal.open && actionModal.type === "recharge"}
        onClose={() => setActionModal(s => ({ ...s, open: false }))}
        onDone={() => {
          setPartnerDrawerId(null);
          refetchSummary();
        }}
      />

      {/* Credit / Debit Modal */}
      <AdjustmentModal
        open={actionModal.open && actionModal.type !== "recharge"}
        type={actionModal.type === "credit" ? "credit" : "debit"}
        walletType={actionModal.walletType}
        entityId={actionModal.entityId}
        onClose={() => setActionModal(s => ({ ...s, open: false }))}
        onDone={refetchSummary}
      />
    </Box>
  );
}
