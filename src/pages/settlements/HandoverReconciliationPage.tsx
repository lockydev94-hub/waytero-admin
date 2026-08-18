// ============================================================
// WAYTERO ADMIN — HANDOVER RECONCILIATION PAGE
// Route: /settlements/handover-reconciliation
// Doc Ref: Spec — Handover Reconciliation (post-breakdown cash tracking)
//
// After a vehicle swap / handover (migration 0041), the original
// (broken-down) partner physically holds the cash / advance payments
// that the customer paid before the swap happened. That cash does NOT
// get auto-settled — finance / ops must reconcile it offline with the
// partner and zero out the partner's wallet accordingly.
//
// This page surfaces exactly that outstanding amount per booking,
// grouped by original partner, so finance knows who to chase.
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Card, CardContent, Stack, Typography, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Skeleton, Alert,
  IconButton, Tooltip, Grid, Divider, Avatar, Button,
} from "@mui/material";
import {
  Refresh, OpenInNew, SwapHoriz, WarningAmber, AccountBalance,
  ReceiptLong, BuildCircle, Handshake,
} from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";

import breakdownService from "../../services/breakdown.service";
import { apiErrorMessage } from "../../utils/apiError";

const QUERY_KEY = "handover-reconciliation";

interface ReconciliationRow {
  cab_booking_id: number;
  booking_number: string;
  cab_status: string;
  original_partner_id: number;
  original_partner_name: string;
  original_partner_mobile: string | null;
  swap_count: number;
  last_swap_at: string | null;
  outstanding_cash: number;
  outstanding_advance: number;
  voided_on_handover_advance: number;
  total_outstanding: number;
  active_partner_side_advance_receipts: string[];
}

export default function HandoverReconciliationPage() {
  const navigate = useNavigate();
  const [partnerFilter, setPartnerFilter] = useState<number | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [QUERY_KEY, partnerFilter],
    queryFn: () =>
      breakdownService.listHandoverReconciliation({ partner_id: partnerFilter ?? undefined, limit: 200 }),
    staleTime: 30_000,
  });
  const items: ReconciliationRow[] = data?.items ?? [];

  const totalCash = items.reduce((s, r) => s + r.outstanding_cash, 0);
  const totalAdvance = items.reduce((s, r) => s + r.outstanding_advance, 0);
  const totalVoided = items.reduce((s, r) => s + r.voided_on_handover_advance, 0);
  const totalOutstanding = items.reduce((s, r) => s + r.total_outstanding, 0);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={800}>Handover Reconciliation</Typography>
        <Typography variant="body2" color="text.secondary">
          Cash + advance payments physically held by partners whose vehicle broke down
          mid-trip. These don't get auto-settled — chase the partner offline and zero
          out their wallet accordingly.
        </Typography>
      </Box>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load reconciliation data: {apiErrorMessage(error)}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar sx={{ bgcolor: "error.main" }}><AccountBalance /></Avatar>
                <Box>
                  <Typography variant="caption" color="text.secondary">Outstanding cash</Typography>
                  <Typography variant="h6" fontWeight={700}>
                    ₹{totalCash.toLocaleString("en-IN")}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar sx={{ bgcolor: "warning.main" }}><ReceiptLong /></Avatar>
                <Box>
                  <Typography variant="caption" color="text.secondary">Outstanding advance</Typography>
                  <Typography variant="h6" fontWeight={700}>
                    ₹{totalAdvance.toLocaleString("en-IN")}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar sx={{ bgcolor: "info.main" }}><Handshake /></Avatar>
                <Box>
                  <Typography variant="caption" color="text.secondary">Voided on handover</Typography>
                  <Typography variant="h6" fontWeight={700}>
                    ₹{totalVoided.toLocaleString("en-IN")}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined" sx={{ borderRadius: 2, borderColor: "error.light" }}>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar sx={{ bgcolor: "error.dark" }}><WarningAmber /></Avatar>
                <Box>
                  <Typography variant="caption" color="text.secondary">Total to recover</Typography>
                  <Typography variant="h6" fontWeight={700} color="error.main">
                    ₹{totalOutstanding.toLocaleString("en-IN")}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {items.length} booking{items.length !== 1 ? "s" : ""} awaiting reconciliation
            </Typography>
            <Tooltip title="Refresh">
              <IconButton onClick={() => refetch()}><Refresh /></IconButton>
            </Tooltip>
          </Stack>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Booking</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Original partner</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Cab status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Cash</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Advance</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Voided</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Total</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(8)].map((__, j) => (
                        <TableCell key={j}><Skeleton animation="wave" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                      <Stack alignItems="center" spacing={1}>
                        <BuildCircle sx={{ fontSize: 40, color: "text.disabled" }} />
                        <Typography variant="body2" color="text.secondary">
                          No outstanding handover reconciliations.
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ) : items.map((r) => (
                  <TableRow key={r.cab_booking_id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{r.booking_number}</Typography>
                      <Typography variant="caption" color="text.disabled">
                        {r.swap_count} swap{r.swap_count !== 1 ? "s" : ""}
                        {r.last_swap_at && ` · ${new Date(r.last_swap_at).toLocaleDateString()}`}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{r.original_partner_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.original_partner_mobile ?? "—"}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={r.cab_status} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color={r.outstanding_cash > 0 ? "error.main" : "text.secondary"}>
                        ₹{r.outstanding_cash.toLocaleString("en-IN")}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color={r.outstanding_advance > 0 ? "warning.main" : "text.secondary"}>
                        ₹{r.outstanding_advance.toLocaleString("en-IN")}
                      </Typography>
                      {r.active_partner_side_advance_receipts.length > 0 && (
                        <Typography variant="caption" color="text.disabled">
                          {r.active_partner_side_advance_receipts.join(", ")}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="text.disabled">
                        ₹{r.voided_on_handover_advance.toLocaleString("en-IN")}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={700} color="error.main">
                        ₹{r.total_outstanding.toLocaleString("en-IN")}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Open booking">
                        <IconButton size="small" onClick={() => navigate(`/cab-ops`)}>
                          <OpenInNew fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
