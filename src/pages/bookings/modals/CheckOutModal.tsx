// ============================================================
// WAYTERO ADMIN — CHECK-OUT MODAL (folio / final bill)
// Preview:  GET  /admin/bookings/{b}/hotel/{h}/checkout-preview
// Commit:   POST /admin/bookings/{b}/hotel/{h}/check-out
// Guard: IN_HOUSE only
//
// The admin settles the folio here before releasing the guest, so the modal
// shows the whole bill the way a property-management system does: room tariff,
// late check-out, extras, coupon discount, GST (only when the platform switch
// is on), then advances already received and the balance left at the desk.
//
// Everything is priced server-side by hotel/services/billing.build_bill — the
// preview is a mutation-free dry run of exactly what check-out will persist,
// so what the admin approves is what gets written.
//
// The legacy `datetime-local` field has been replaced by the premium
// DateTimeStepPicker (calendar + 12/24h time grid + timezone chip), so the
// admin always sees the same wall-clock the partner / customer will.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, CircularProgress,
  Stack, Avatar, Divider, Alert, InputAdornment, Chip, Tooltip,
} from "@mui/material";
import {
  Logout, Close, AccessTime, WarningAmber, ReceiptLong, InfoOutlined,
} from "@mui/icons-material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { bookingService, type HotelBill } from "../../../services/booking.service";
import DateTimeStepPicker from "../../../components/forms/DateTimeStepPicker";

const fmtINR = (n: number) =>
  `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }) : "—";

/** "YYYY-MM-DD" + "HH:mm" → UTC ISO. */
const combineLocalToISO = (date: string, time: string): string | undefined => {
  if (!date || !time) return undefined;
  const local = new Date(`${date}T${time}`);
  if (Number.isNaN(local.getTime())) return undefined;
  return local.toISOString();
};

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: number;
  hotelId: number;
  hotelBookingNumber: string;
  /** Platform timezone label (e.g. "Asia/Kolkata") — shown in the picker. */
  platformTimezone?: string | null;
  /** ISO of the recorded check-in stamp — used to seed the picker default. */
  recordedCheckInAt?: string | null;
}

export default function CheckOutModal({
  open, onClose, bookingId, hotelId, hotelBookingNumber,
  platformTimezone, recordedCheckInAt,
}: Props) {
  const [additionalCharges, setAdditionalCharges] = useState("0");
  const [notes, setNotes] = useState("");
  const [checkOutDate, setCheckOutDate] = useState<string>("");
  const [checkOutTime, setCheckOutTime] = useState<string>("");

  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  // Default the check-out stamp to now; the admin can back-date it if the
  // guest actually left earlier, which directly changes the overtime slab.
  useEffect(() => {
    if (!open) return;
    const d = new Date();
    setCheckOutDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
    setCheckOutTime(
      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
    );
    setAdditionalCharges("0");
    setNotes("");
  }, [open]);

  const charges = Number(additionalCharges) || 0;
  const isoCheckOut = useMemo(
    () => combineLocalToISO(checkOutDate, checkOutTime),
    [checkOutDate, checkOutTime],
  );

  const { data: preview, isLoading, isFetching, error } = useQuery({
    queryKey: ["hotel-checkout-preview", bookingId, hotelId, charges, isoCheckOut],
    queryFn: () => bookingService.hotelCheckoutPreview(bookingId, hotelId, charges, isoCheckOut),
    enabled: open && !!isoCheckOut,
    staleTime: 0,
  });

  const bill: HotelBill | undefined = preview?.bill;
  const overtime = bill?.overtime;

  const mutation = useMutation({
    mutationFn: () =>
      bookingService.hotelCheckOut(bookingId, hotelId, charges, notes || undefined, isoCheckOut),
    onSuccess: (data: any) => {
      enqueueSnackbar(
        `Guest checked out. Final bill ${fmtINR(data?.final_amount ?? 0)}` +
        (data?.balance_due > 0 ? ` — ${fmtINR(data.balance_due)} still due.` : " — fully paid."),
        { variant: "success" },
      );
      qc.invalidateQueries({ queryKey: ["admin-booking", bookingId] });
      handleClose();
    },
    onError: (e: any) =>
      enqueueSnackbar(e?.response?.data?.detail || "Check-out failed", { variant: "error" }),
  });

  const handleClose = () => {
    setAdditionalCharges("0");
    setNotes("");
    setCheckOutDate("");
    setCheckOutTime("");
    onClose();
  };

  // Earliest selectable date is the recorded check-in date so the admin can't
  // accidentally check-out before the check-in.
  const minDate = useMemo(() => {
    if (!recordedCheckInAt) return null;
    const d = new Date(recordedCheckInAt);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [recordedCheckInAt]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: "info.main", width: 36, height: 36 }}><Logout fontSize="small" /></Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Record Check-Out</Typography>
              <Typography variant="caption" color="text.secondary">{hotelBookingNumber}</Typography>
            </Box>
          </Stack>
          <Button size="small" onClick={handleClose} sx={{ minWidth: 0 }}><Close fontSize="small" /></Button>
        </Stack>
      </DialogTitle>
      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        <Stack gap={2.5}>
          {/* ── Stay window ───────────────────────────────────── */}
          {preview && (
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "grey.50", border: "1px solid", borderColor: "grey.200" }}>
              <Stack direction="row" justifyContent="space-between" flexWrap="wrap" gap={1}>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">Checked In</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {fmtDateTime(preview.actual_check_in_at)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">Due Out</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {fmtDateTime(overtime?.scheduled_checkout_at)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">Booked</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {preview.nights ?? "—"} night(s) × {preview.rooms ?? 1} room(s)
                  </Typography>
                </Box>
              </Stack>
            </Box>
          )}

          {/* ── Actual check-out — 2-step picker ──────────────── */}
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <AccessTime fontSize="small" color="primary" />
              <Typography variant="subtitle2" fontWeight={700}>
                Actual Check-Out Time *
              </Typography>
            </Stack>
            <DateTimeStepPicker
              valueDate={checkOutDate}
              valueTime={checkOutTime}
              minDate={minDate}
              maxDate={null}
              timezoneLabel={platformTimezone || "Asia/Kolkata"}
              onChange={(next) => {
                setCheckOutDate(next.date);
                setCheckOutTime(next.time);
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              Required — room charges and late check-out are billed from this time;
              adjust it if the guest left earlier.
            </Typography>
          </Box>

          <TextField
            label="Additional Charges (₹)"
            value={additionalCharges}
            onChange={(e) => setAdditionalCharges(e.target.value)}
            fullWidth type="number" size="small" inputProps={{ min: 0, step: "0.01" }}
            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
            helperText="Extra bed, food, laundry, room service, damage, etc."
          />

          {/* ── Overtime ─────────────────────────────────────── */}
          {overtime && (overtime.is_overtime || overtime.raw_hours > 0) && (
            <Box sx={{
              p: 1.5, borderRadius: 2,
              bgcolor: overtime.is_overtime ? "warning.50" : "grey.50",
              border: "1px solid",
              borderColor: overtime.is_overtime ? "warning.200" : "grey.200",
            }}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                {overtime.is_overtime
                  ? <WarningAmber sx={{ fontSize: 18, color: "warning.main", mt: 0.2 }} />
                  : <AccessTime sx={{ fontSize: 18, color: "text.secondary", mt: 0.2 }} />}
                <Box flex={1}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" fontWeight={700}>
                      {overtime.is_overtime ? "Late Check-Out" : "Within Grace Period"}
                    </Typography>
                    {overtime.is_overtime && (
                      <Chip
                        size="small" color="warning"
                        label={overtime.slab === "HALF_DAY" ? "Half Day"
                          : overtime.slab === "FULL_DAY" ? "Full Day"
                          : `${overtime.overtime_hours}h`}
                        sx={{ fontWeight: 700, height: 20 }}
                      />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.6 }}>
                    {overtime.reason}
                  </Typography>
                  {overtime.is_overtime && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {overtime.percent_applied}% of {fmtINR(overtime.nightly_rate)} nightly tariff
                      {" = "}<strong>{fmtINR(overtime.charge)}</strong>
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Box>
          )}

          {/* ── The folio ─────────────────────────────────────── */}
          <Box>
            <Stack direction="row" alignItems="center" gap={0.75} mb={1}>
              <ReceiptLong sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ letterSpacing: 0.5 }}>
                FINAL BILL
              </Typography>
              {isFetching && <CircularProgress size={12} />}
            </Stack>

            {isLoading ? (
              <Box sx={{ py: 3, textAlign: "center" }}><CircularProgress size={22} /></Box>
            ) : error ? (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                Could not price this stay. {(error as any)?.response?.data?.detail || ""}
              </Alert>
            ) : bill ? (
              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
                {bill.lines.map((ln, i) => {
                  const isDiscount = ln.kind === "DISCOUNT";
                  const isPayment = ln.kind === "PAYMENT";
                  const signed = isDiscount || isPayment ? `−${fmtINR(ln.amount)}` : fmtINR(ln.amount);
                  return (
                    <Box key={i} sx={{
                      px: 1.75, py: 1,
                      borderTop: i === 0 ? "none" : "1px solid",
                      borderColor: "divider",
                      bgcolor: isPayment ? "success.50" : ln.kind === "TAX" ? "info.50" : "transparent",
                    }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={1}>
                        <Typography variant="body2" fontWeight={600}>{ln.label}</Typography>
                        <Typography
                          variant="body2" fontWeight={700}
                          color={isDiscount ? "error.main" : isPayment ? "success.main" : "text.primary"}
                          sx={{ whiteSpace: "nowrap" }}
                        >
                          {signed}
                        </Typography>
                      </Stack>
                      {ln.detail && (
                        <Typography variant="caption" color="text.secondary">{ln.detail}</Typography>
                      )}
                    </Box>
                  );
                })}

                {/* Totals */}
                <Box sx={{ px: 1.75, py: 1.25, bgcolor: "grey.50", borderTop: "1px solid", borderColor: "divider" }}>
                  <Stack direction="row" justifyContent="space-between" mb={0.5}>
                    <Typography variant="caption" color="text.secondary">Taxable Amount</Typography>
                    <Typography variant="caption" fontWeight={700}>{fmtINR(bill.taxable_amount)}</Typography>
                  </Stack>
                  {!bill.gst_enabled && (
                    <Stack direction="row" spacing={0.75} alignItems="center" mb={0.5}>
                      <InfoOutlined sx={{ fontSize: 13, color: "text.secondary" }} />
                      <Typography variant="caption" color="text.secondary">
                        GST is disabled in platform settings — no tax applied.
                      </Typography>
                    </Stack>
                  )}
                  {bill.gst_enabled && bill.gst_amount > 0 && (
                    <Stack direction="row" justifyContent="space-between" mb={0.5}>
                      <Tooltip title={bill.tax_source || ""} arrow>
                        <Typography variant="caption" color="text.secondary">
                          GST @ {bill.gst_percent}%
                        </Typography>
                      </Tooltip>
                      <Typography variant="caption" fontWeight={700}>{fmtINR(bill.gst_amount)}</Typography>
                    </Stack>
                  )}
                  <Divider sx={{ my: 1 }} />
                  <Stack direction="row" justifyContent="space-between" mb={0.5}>
                    <Typography variant="body2" fontWeight={800}>Grand Total</Typography>
                    <Typography variant="body2" fontWeight={800}>{fmtINR(bill.grand_total)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" mb={0.5}>
                    <Typography variant="caption" color="text.secondary">Advance Received</Typography>
                    <Typography variant="caption" fontWeight={700} color="success.main">
                      −{fmtINR(bill.advance_paid)}
                    </Typography>
                  </Stack>
                  <Divider sx={{ my: 1 }} />
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" fontWeight={800}>
                      {bill.refund_due > 0 ? "Refund Due" : "Balance Due"}
                    </Typography>
                    <Typography
                      variant="h6" fontWeight={800}
                      color={bill.refund_due > 0 ? "info.main" : bill.balance_due > 0 ? "warning.main" : "success.main"}
                    >
                      {fmtINR(bill.refund_due > 0 ? bill.refund_due : bill.balance_due)}
                    </Typography>
                  </Stack>
                </Box>
              </Box>
            ) : null}
          </Box>

          <TextField
            label="Check-Out Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth multiline rows={2} size="small"
            placeholder="e.g. Early check-out, damages noted, extra meals"
          />

          {bill && bill.balance_due > 0 && (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              {fmtINR(bill.balance_due)} is still outstanding. Check out the guest, then
              generate the invoice and collect the payment from the booking page.
            </Alert>
          )}
          {bill && bill.refund_due > 0 && (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              Advances exceed the final bill by {fmtINR(bill.refund_due)} — a refund is owed to
              the customer after check-out.
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <Divider />
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined" color="inherit">Cancel</Button>
        <Button
          variant="contained" color="info"
          disabled={mutation.isPending || isLoading || !!error || !isoCheckOut}
          onClick={() => mutation.mutate()}
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <Logout />}
          sx={{ fontWeight: 700 }}
        >
          {mutation.isPending
            ? "Checking Out…"
            : bill ? `Check Out · ${fmtINR(bill.grand_total)}` : "Confirm Check-Out"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
