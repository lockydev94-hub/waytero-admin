// ============================================================
// WAYTERO ADMIN — GENERATE INVOICE MODAL
// Endpoint: POST /admin/bookings/{bookingId}/hotel/{hotelId}/generate-invoice
// Guard: CHECKED_OUT | COMPLETED, invoice not yet generated
//
// Before freezing the bill, the admin reviews the full payment position of
// this booking: every advance receipt collected (mode, who received it,
// reference, date) plus the outstanding balance — so invoicing is an informed
// final step, not a blind click.
// ============================================================
import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, CircularProgress,
  Stack, Avatar, Divider, Alert, Chip, Table, TableBody,
  TableCell, TableHead, TableRow, Tooltip, useTheme, alpha,
} from "@mui/material";
import { ReceiptLong, Close, Payments, LockReset } from "@mui/icons-material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { bookingService, type HotelAdvancePayment } from "../../../services/booking.service";

const fmtINR = (n: number) =>
  `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }) : "—";

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: number;
  hotelId: number;
  hotelBookingNumber: string;
  totalAmount: number;
  advancePaid: number;
  balanceDue: number;
  payments: HotelAdvancePayment[];
  payStatus?: string;
}

export default function GenerateInvoiceModal({
  open, onClose, bookingId, hotelId, hotelBookingNumber,
  totalAmount, advancePaid, balanceDue, payments, payStatus,
}: Props) {
  const theme = useTheme();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const mutation = useMutation({
    mutationFn: () => bookingService.hotelGenerateInvoice(bookingId, hotelId),
    onSuccess: (data: any) => {
      enqueueSnackbar(
        data?.already_generated
          ? `Invoice ${data?.invoice_number} already generated.`
          : `Invoice ${data?.invoice_number} generated.`,
        { variant: "success" },
      );
      qc.invalidateQueries({ queryKey: ["admin-booking", bookingId] });
      onClose();
    },
    onError: (e: any) =>
      enqueueSnackbar(e?.response?.data?.detail || "Failed to generate invoice", { variant: "error" }),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: "primary.main", width: 36, height: 36 }}>
              <ReceiptLong fontSize="small" />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Generate Invoice</Typography>
              <Typography variant="caption" color="text.secondary">
                {hotelBookingNumber}
              </Typography>
            </Box>
          </Stack>
          <Button size="small" onClick={onClose} sx={{ minWidth: 0 }}>
            <Close fontSize="small" />
          </Button>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Stack gap={2.5}>
          {/* ── Bill summary ──────────────────────────────────── */}
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "grey.50", border: "1px solid", borderColor: "grey.200" }}>
            <Stack direction="row" justifyContent="space-between" flexWrap="wrap" gap={1}>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Final Bill</Typography>
                <Typography variant="h6" fontWeight={800}>{fmtINR(totalAmount)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Advance Received</Typography>
                <Typography variant="body2" fontWeight={700} color="success.main">
                  −{fmtINR(advancePaid)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Balance Due</Typography>
                <Typography variant="body2" fontWeight={800} color={balanceDue > 0 ? "warning.main" : "success.main"}>
                  {fmtINR(balanceDue)}
                </Typography>
              </Box>
              {payStatus && (
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">Collection</Typography>
                  <Chip
                    size="small"
                    label={payStatus}
                    color={payStatus === "PAID" ? "success" : payStatus === "PARTIAL" ? "warning" : "default"}
                    sx={{ fontWeight: 700, height: 20, mt: 0.25 }}
                  />
                </Box>
              )}
            </Stack>
          </Box>

          {/* ── Payment details ───────────────────────────────── */}
          <Box>
            <Stack direction="row" alignItems="center" gap={0.75} mb={1}>
              <Payments sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ letterSpacing: 0.5 }}>
                PAYMENT DETAILS
              </Typography>
            </Stack>

            {payments.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: 2, py: 0.5 }}>
                No payments collected yet on this booking. The invoice will show the full amount as balance due.
              </Alert>
            ) : (
              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.text.primary, 0.04) }}>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>Receipt</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>Mode</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>Received By</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.72rem" }}>Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id} sx={{ "&:last-child td": { borderBottom: "none" } }}>
                        <TableCell>
                          <Tooltip
                            title={
                              <>
                                <div>{p.receipt_number}</div>
                                {p.reference_number && <div>Ref: {p.reference_number}</div>}
                                {p.collected_at && <div>{fmtDateTime(p.collected_at)}</div>}
                                {p.notes && <div>{p.notes}</div>}
                              </>
                            }
                            arrow
                          >
                            <Typography variant="caption" fontFamily="monospace" fontWeight={700}>
                              {p.receipt_number}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Chip label={p.payment_mode} size="small" sx={{ height: 18, fontSize: "0.65rem" }} />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={p.received_by}
                            size="small"
                            variant="outlined"
                            color={p.received_by === "ADMIN" ? "info" : "warning"}
                            sx={{ height: 18, fontSize: "0.65rem" }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={700} color="success.main">
                            {fmtINR(p.amount)}
                            {p.refunded_amount > 0 && (
                              <Typography component="span" variant="caption" color="error.main">
                                {" "}(−{fmtINR(p.refunded_amount)})
                              </Typography>
                            )}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Box>

          <Alert severity="info" sx={{ borderRadius: 2 }} icon={<LockReset fontSize="small" />}>
            Generating the invoice freezes this bill at <strong>{fmtINR(totalAmount)}</strong>.
            No further charges can be added after invoicing, and the balance due becomes payable.
          </Alert>
        </Stack>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">Cancel</Button>
        <Button
          variant="contained" color="primary"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <ReceiptLong />}
          sx={{ fontWeight: 700 }}
        >
          {mutation.isPending ? "Generating…" : `Generate Invoice · ${fmtINR(totalAmount)}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
