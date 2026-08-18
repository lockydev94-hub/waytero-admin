// ============================================================
// WAYTERO ADMIN — SWITCH HOTEL MODAL
// Doc Ref: Hotel Switch Spec; Migration 0042_hotel_switch
// Endpoint: POST /admin/bookings/hotel/{reservation_id}/switch
//           (backend branches PRE_CHECKIN_SWITCH vs POST_CHECKIN_SPLIT)
// ============================================================
import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, CircularProgress,
  Stack, Alert, InputAdornment, Grid, MenuItem, Divider, Chip, Stepper,
  Step, StepLabel, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio,
} from "@mui/material";
import { SwapHoriz, Close, Hotel, KingBed, AttachMoney, Warning, Receipt } from "@mui/icons-material";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  bookingService, type HotelBookingOut, type HotelSwitchQuote,
} from "../../../services/booking.service";
import { customerCareService, type HotelMetaItem } from "../../../services/customerCare.service";

const fmtINR = (n: number) =>
  `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toDateInput = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");
const diffNights = (cin: string, cout: string) => {
  if (!cin || !cout) return 0;
  const a = new Date(cin + "T00:00:00");
  const b = new Date(cout + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
};

const REASONS = [
  { value: "GUEST_REQUEST", label: "Guest requested change" },
  { value: "QUALITY_ISSUE", label: "Quality issue at original hotel" },
  { value: "OVERBOOKING", label: "Overbooking at original hotel" },
  { value: "PARTNER_ADVICE", label: "Partner advised relocation" },
  { value: "OTHER", label: "Other" },
];

const STEPS = ["Target hotel", "Room & dates", "Price preview", "Confirm"];

interface Props {
  open: boolean;
  onClose: () => void;
  /** When provided the modal runs the mid-stay split flow (status ∈
   *  CHECKED_IN | IN_HOUSE); otherwise it runs the pre-checkin switch flow. */
  isSplitMode?: boolean;
  bookingId: number;
  hotelId: number;
  hb: HotelBookingOut;
  onDone?: () => void;
}

export default function SwitchHotelModal({
  open, onClose, isSplitMode, bookingId, hotelId, hb, onDone,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();

  const [step, setStep] = useState(0);
  const [targetHotelId, setTargetHotelId] = useState<number | "">("");
  const [targetRoomCategoryId, setTargetRoomCategoryId] = useState<number | "">("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [extraBeds, setExtraBeds] = useState(0);
  const [strategy, setStrategy] = useState<"ROLLOVER" | "NONE">("ROLLOVER");
  const [reason, setReason] = useState("GUEST_REQUEST");
  const [notes, setNotes] = useState("");

  // Default dates: split → tomorrow/original checkout, switch → original dates.
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setTargetHotelId("");
    setTargetRoomCategoryId("");
    setStrategy("ROLLOVER");
    setReason("GUEST_REQUEST");
    setNotes("");
    setAdults(hb.adults_count ?? 1);
    setChildren(hb.children_count ?? 0);
    setExtraBeds(hb.extra_beds ?? 0);
    if (isSplitMode) {
      // Default to "the rest of the stay": today+1 → original check_out.
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setCheckIn(tomorrow.toISOString().slice(0, 10));
      setCheckOut(toDateInput(hb.check_out_date));
    } else {
      setCheckIn(toDateInput(hb.check_in_date));
      setCheckOut(toDateInput(hb.check_out_date));
    }
  }, [open, hb, isSplitMode]);

  // Active hotels for the picker.
  const { data: meta, isLoading: metaLoading } = useQuery({
    queryKey: ["hotel-meta-switch", targetHotelId],
    queryFn: () => customerCareService.getHotelMeta(),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const hotels: HotelMetaItem[] = meta?.hotels ?? [];
  const targetHotel = useMemo(
    () => hotels.find((h) => h.id === targetHotelId) ?? null,
    [hotels, targetHotelId],
  );
  const targetCategories = targetHotel?.room_categories ?? [];

  // Live preview — runs as soon as step 1 inputs are valid.
  const canQuote = !!targetHotelId && targetRoomCategoryId !== ""
    && !!checkIn && !!checkOut && diffNights(checkIn, checkOut) >= 1
    && targetHotelId !== hb.hotel_id; // no-op: don't bother quoting same-hotel switch

  const [quote, setQuote] = useState<HotelSwitchQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (!canQuote) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setQuoteLoading(true);
      setQuoteError("");
      try {
        const q = await bookingService.getHotelSwitchPreview(hotelId, {
          target_hotel_id: Number(targetHotelId),
          target_room_category_id: Number(targetRoomCategoryId),
          target_check_in: checkIn,
          target_check_out: checkOut,
          adults_count: adults,
          children_count: children,
          extra_beds: extraBeds,
        });
        if (!cancelled) {
          setQuote(q);
          // Adopt the server's suggested strategy unless the user has already
          // manually chosen one on a later step.
          if (q?.money_moves?.suggested_strategy) {
            setStrategy(q.money_moves.suggested_strategy);
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(e?.response?.data?.detail ?? "Failed to fetch quote");
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, canQuote, targetHotelId, targetRoomCategoryId, checkIn, checkOut,
      adults, children, extraBeds, hotelId]);

  // ── Commit ───────────────────────────────────────────────────
  const commitMutation = useMutation({
    mutationFn: () => bookingService.switchHotel(hotelId, {
      target_hotel_id: Number(targetHotelId),
      target_room_category_id: Number(targetRoomCategoryId),
      target_check_in: checkIn,
      target_check_out: checkOut,
      strategy, reason, notes: notes || null,
      adults_count: adults,
      children_count: children,
      extra_beds: extraBeds,
    }),
    onSuccess: (res: any) => {
      const splitType = res?.split_type === "POST_CHECKIN_SPLIT" ? "mid-stay split" : "switch";
      enqueueSnackbar(`Hotel ${splitType} committed: ${res?.new_reservation_number}`, { variant: "success" });
      onDone?.();
      onClose();
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail ?? "Switch failed", { variant: "error" }),
  });

  const titleSuffix = isSplitMode ? "Split Stay" : "Switch Hotel";
  const stepValid = (s: number): boolean => {
    if (s === 0) return !!targetHotelId && targetHotelId !== hb.hotel_id;
    if (s === 1) return canQuote && diffNights(checkIn, checkOut) >= 1 && Boolean(targetRoomCategoryId);
    if (s === 2) return !!quote && quote.inventory_available;
    if (s === 3) return !!reason;
    return false;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <SwapHoriz color="primary" />
          {titleSuffix} — reservation {hb.booking_number ?? hb.id}
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={step} sx={{ mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>

        {isSplitMode && (
          <Alert severity="warning" icon={<Warning />} sx={{ mb: 2 }}>
            Guest has already checked in. Switching will truncate the original bill to consumed nights,
            release inventory for the rest, and create a new reservation at the chosen hotel.
          </Alert>
        )}

        {/* ── Step 0: pick target hotel ── */}
        {step === 0 && (
          <Stack spacing={2}>
            <Typography variant="subtitle2" color="text.secondary">
              Choose a different hotel for {isSplitMode ? "the remainder of" : ""} this stay.
            </Typography>
            <TextField
              select
              label="Target hotel"
              value={targetHotelId}
              onChange={(e) => { setTargetHotelId(e.target.value ? Number(e.target.value) : ""); setTargetRoomCategoryId(""); }}
              fullWidth
              disabled={metaLoading}
              InputProps={{ startAdornment: <InputAdornment position="start"><Hotel fontSize="small" /></InputAdornment> }}
            >
              <MenuItem value="">— Select —</MenuItem>
              {hotels.map((h) => (
                <MenuItem key={h.id} value={h.id} disabled={h.id === hb.hotel_id}>
                  {h.hotel_name} ({h.city_name ?? "—"})
                  {h.id === hb.hotel_id ? " — current hotel" : ""}
                </MenuItem>
              ))}
            </TextField>
            {hb.hotel_name && (
              <Typography variant="caption" color="text.secondary">
                Original hotel: <b>{hb.hotel_name}</b>. Pick a different property.
              </Typography>
            )}
          </Stack>
        )}

        {/* ── Step 1: dates + room category ── */}
        {step === 1 && targetHotel && (
          <Stack spacing={2}>
            <Typography variant="subtitle2" color="text.secondary">
              At <b>{targetHotel.hotel_name}</b>. Dates default to {isSplitMode ? "the remainder of the stay" : "the original booking window"}.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Check-in" type="date" fullWidth size="small"
                  value={checkIn} onChange={(e) => setCheckIn(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Check-out" type="date" fullWidth size="small"
                  value={checkOut} onChange={(e) => setCheckOut(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
            <TextField
              select
              label="Room category"
              value={targetRoomCategoryId}
              onChange={(e) => setTargetRoomCategoryId(e.target.value ? Number(e.target.value) : "")}
              fullWidth size="small"
              InputProps={{ startAdornment: <InputAdornment position="start"><KingBed fontSize="small" /></InputAdornment> }}
            >
              <MenuItem value="">— Select —</MenuItem>
              {targetCategories.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.category_name} · ₹{c.base_price ?? 0}/night
                </MenuItem>
              ))}
            </TextField>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <TextField label="Adults" type="number" size="small" fullWidth
                  value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))} />
              </Grid>
              <Grid item xs={4}>
                <TextField label="Children" type="number" size="small" fullWidth
                  value={children} onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))} />
              </Grid>
              <Grid item xs={4}>
                <TextField label="Extra beds" type="number" size="small" fullWidth
                  value={extraBeds} onChange={(e) => setExtraBeds(Math.max(0, Number(e.target.value) || 0))} />
              </Grid>
            </Grid>
            <Typography variant="caption" color="text.secondary">
              {diffNights(checkIn, checkOut)} night(s)
              {isSplitMode && quote && (
                <> · {quote.nights_remaining} night(s) remaining on the original</>
              )}
            </Typography>
          </Stack>
        )}

        {/* ── Step 2: price preview ── */}
        {step === 2 && (
          <Stack spacing={2}>
            {quoteLoading && (
              <Stack direction="row" gap={1} alignItems="center"><CircularProgress size={18} /><Typography>Fetching preview…</Typography></Stack>
            )}
            {quoteError && <Alert severity="error">{quoteError}</Alert>}
            {quote && !quoteLoading && (
              <>
                <Alert severity={quote.inventory_available ? "success" : "error"}>
                  {quote.inventory_available
                    ? `Inventory available at ${quote.target_quote.hotel_name} for all ${quote.target_quote.nights} night(s).`
                    : `Some dates are unavailable: ${quote.unavailable_dates.join(", ")}.`}
                </Alert>
                <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Base amount</Typography>
                      <Typography variant="body2">{fmtINR(quote.target_quote.base_amount)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Taxable</Typography>
                      <Typography variant="body2">{fmtINR(quote.target_quote.taxable_amount)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">GST</Typography>
                      <Typography variant="body2">{fmtINR(quote.target_quote.gst_amount)}</Typography>
                    </Stack>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="subtitle2">New reservation total</Typography>
                      <Typography variant="subtitle2" fontWeight={700}>{fmtINR(quote.target_quote.total_amount)}</Typography>
                    </Stack>
                  </Stack>
                </Box>

                <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    <AttachMoney fontSize="small" sx={{ verticalAlign: "middle" }} /> Advance redistribution
                  </Typography>
                  <Stack spacing={0.5}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Net advance on original</Typography>
                      <Typography variant="body2">{fmtINR(quote.money_moves.advance_net)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Rollover into new reservation</Typography>
                      <Typography variant="body2" color="success.main">{fmtINR(quote.money_moves.rollover_amount)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Refund to customer (if any)</Typography>
                      <Typography variant="body2" color="warning.main">{fmtINR(quote.money_moves.refund_preview)}</Typography>
                    </Stack>
                  </Stack>
                </Box>

                <FormControl>
                  <FormLabel>Strategy</FormLabel>
                  <RadioGroup
                    row
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value as "ROLLOVER" | "NONE")}
                  >
                    <FormControlLabel
                      value="ROLLOVER"
                      control={<Radio />}
                      label={
                        <Stack>
                          <Typography variant="body2" fontWeight={600}>ROLLOVER</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Move the original's advance into the new reservation up to its total; refund the rest.
                          </Typography>
                        </Stack>
                      }
                    />
                    <FormControlLabel
                      value="NONE"
                      control={<Radio />}
                      label={
                        <Stack>
                          <Typography variant="body2" fontWeight={600}>NONE (full refund)</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Mark the original's advance as fully refunded; customer pays the new reservation fresh.
                          </Typography>
                        </Stack>
                      }
                    />
                  </RadioGroup>
                </FormControl>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {isSplitMode && (
                    <Chip size="small" label="Mid-stay split" color="warning" />
                  )}
                  {quote.nights_consumed > 0 && (
                    <Chip size="small" label={`${quote.nights_consumed} night(s) already consumed`} />
                  )}
                  <Chip size="small" label={`${quote.target_quote.nights} night(s) transferred`} color="primary" />
                </Stack>
              </>
            )}
          </Stack>
        )}

        {/* ── Step 3: reason + notes ── */}
        {step === 3 && (
          <Stack spacing={2}>
            <TextField
              select
              label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              fullWidth size="small"
            >
              {REASONS.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
            </TextField>
            <TextField
              label="Internal notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth multiline minRows={3} size="small"
              placeholder="What triggered this change? Any follow-up actions?"
            />
            {quote && (
              <Box sx={{ p: 2, border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  <Receipt fontSize="small" sx={{ verticalAlign: "middle" }} /> Summary
                </Typography>
                <Stack spacing={0.5}>
                  <Typography variant="body2">
                    Move guest from <b>{hb.hotel_name}</b> → <b>{quote.target_quote.hotel_name}</b>{" "}
                    ({quote.target_quote.nights} night(s)).
                  </Typography>
                  <Typography variant="body2">
                    New reservation total: <b>{fmtINR(quote.target_quote.total_amount)}</b>.
                  </Typography>
                  <Typography variant="body2">
                    Strategy: <b>{strategy}</b> — {strategy === "ROLLOVER"
                      ? `rollover ${fmtINR(quote.money_moves.rollover_amount)}, refund ${fmtINR(quote.money_moves.refund_preview)}.`
                      : `full refund of ${fmtINR(quote.money_moves.advance_net)}.`}
                  </Typography>
                </Stack>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={commitMutation.isPending} startIcon={<Close />}>
          Cancel
        </Button>
        {step > 0 && (
          <Button onClick={() => setStep(step - 1)} disabled={commitMutation.isPending}>
            Back
          </Button>
        )}
        {step < STEPS.length - 1 && (
          <Button
            variant="contained"
            onClick={() => setStep(step + 1)}
            disabled={!stepValid(step)}
          >
            Next
          </Button>
        )}
        {step === STEPS.length - 1 && (
          <Button
            variant="contained"
            color="primary"
            onClick={() => commitMutation.mutate()}
            disabled={!stepValid(step) || commitMutation.isPending}
            startIcon={commitMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <SwapHoriz />}
          >
            Confirm {titleSuffix}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

