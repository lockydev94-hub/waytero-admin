// ============================================================
// WAYTERO ADMIN — EDIT HOTEL BOOKING MODAL
// Endpoint: PUT /admin/customer-care/hotel-booking/{reservationId}
// Allowed: only while reservation_status = CONFIRMED (stay not yet started).
// Amends dates / rooms / room category / occupancy / extra beds / requests,
// re-pricing the stay server-side and showing a live quote before save.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, CircularProgress,
  Stack, Avatar, Divider, Alert, InputAdornment, Grid,
  MenuItem,
} from "@mui/material";
import { EditCalendar, Close, MeetingRoom, Person, Groups, KingBed } from "@mui/icons-material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { bookingService, type HotelBookingOut } from "../../../services/booking.service";
import {
  customerCareService,
  type HotelBookingQuote,
  type HotelRoomCategoryMeta,
} from "../../../services/customerCare.service";

const fmtINR = (n: number) =>
  `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** hr.check_in_date arrives as "YYYY-MM-DD" (or an ISO string); `<input type=date>` wants "YYYY-MM-DD". */
const toDateInput = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");

const diffNights = (cin: string, cout: string) => {
  if (!cin || !cout) return 0;
  const a = new Date(cin + "T00:00:00");
  const b = new Date(cout + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
};

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: number;
  hotelId: number;               // master-booking-level hotel reservation id (== reservationId)
  hb: HotelBookingOut;
}

export default function EditHotelBookingModal({ open, onClose, bookingId, hotelId, hb }: Props) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [roomCategoryId, setRoomCategoryId] = useState<number | "">("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [rooms, setRooms] = useState(1);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [extraBeds, setExtraBeds] = useState(0);
  const [specialRequests, setSpecialRequests] = useState("");

  // Reset the form to the booking's current state whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setRoomCategoryId(hb.room_category_id ?? "");
    setCheckIn(toDateInput(hb.check_in_date));
    setCheckOut(toDateInput(hb.check_out_date));
    setRooms(hb.num_rooms ?? 1);
    setAdults(hb.adults_count ?? hb.num_guests ?? 1);
    setChildren(hb.children_count ?? 0);
    setExtraBeds(hb.extra_beds ?? 0);
    setSpecialRequests(hb.special_requests ?? "");
  }, [open, hb]);

  // Room categories for this hotel (for the dropdown + re-quote gating).
  const { data: meta } = useQuery({
    queryKey: ["hotel-meta-edit", hb.hotel_id],
    queryFn: () => customerCareService.getHotelMeta(),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const categories: HotelRoomCategoryMeta[] = useMemo(
    () => meta?.hotels.find((h) => h.id === hb.hotel_id)?.room_categories ?? [],
    [meta, hb.hotel_id],
  );
  const selectedCat = useMemo(
    () => categories.find((c) => c.id === roomCategoryId),
    [categories, roomCategoryId],
  );

  const nights = diffNights(checkIn, checkOut);

  // Clear stale extra beds when switching to a category that doesn't allow them.
  useEffect(() => {
    if (selectedCat && !selectedCat.extra_bed_allowed && extraBeds !== 0) setExtraBeds(0);
  }, [selectedCat, extraBeds]);

  // ── Live re-quote ───────────────────────────────────────────
  const [quote, setQuote] = useState<HotelBookingQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (!hb.hotel_id || roomCategoryId === "" || !checkIn || !checkOut || nights < 1) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setQuoteLoading(true);
      setQuoteError("");
      try {
        const q = await customerCareService.getHotelQuote({
          hotel_id: Number(hb.hotel_id),
          room_category_id: Number(roomCategoryId),
          check_in_date: checkIn,
          check_out_date: checkOut,
          rooms_count: rooms,
          adults_count: adults,
          children_count: children,
          extra_beds: extraBeds,
        });
        if (!cancelled) setQuote(q);
      } catch (e: any) {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(e?.response?.data?.detail || "Failed to re-price this stay.");
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, hb.hotel_id, roomCategoryId, checkIn, checkOut, rooms, adults, children, extraBeds, nights]);

  const mutation = useMutation({
    mutationFn: () =>
      bookingService.editHotelDetails(hotelId, {
        room_category_id: Number(roomCategoryId),
        check_in_date: checkIn,
        check_out_date: checkOut,
        rooms_count: rooms,
        adults_count: adults,
        children_count: children,
        extra_beds: extraBeds,
        special_requests: specialRequests || null,
      }),
    onSuccess: (data: any) => {
      enqueueSnackbar(
        `Booking updated — new total ${fmtINR(data?.total_amount ?? 0)}`,
        { variant: "success" },
      );
      qc.invalidateQueries({ queryKey: ["admin-booking", bookingId] });
      onClose();
    },
    onError: (e: any) =>
      enqueueSnackbar(e?.response?.data?.detail || "Failed to update booking", { variant: "error" }),
  });

  const valid =
    roomCategoryId !== "" && !!checkIn && !!checkOut && nights >= 1 && rooms >= 1 && adults >= 1 &&
    !!quote && !quoteError;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: "primary.main", width: 36, height: 36 }}><EditCalendar fontSize="small" /></Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Edit Booking</Typography>
              <Typography variant="caption" color="text.secondary">
                {hb.booking_number} · {hb.hotel_name}
              </Typography>
            </Box>
          </Stack>
          <Button size="small" onClick={onClose} sx={{ minWidth: 0 }}><Close fontSize="small" /></Button>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Stack gap={2}>
          <Alert severity="info" sx={{ py: 0.5 }}>
            Amending a confirmed booking re-prices the stay and moves the room hold to the new dates.
          </Alert>

          <TextField
            select label="Room category" size="small" fullWidth
            value={roomCategoryId}
            onChange={(e) => setRoomCategoryId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            {categories.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.category_name}{c.room_type ? ` · ${c.room_type}` : ""}
              </MenuItem>
            ))}
          </TextField>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                label="Check-in" type="date" size="small" fullWidth
                InputLabelProps={{ shrink: true }}
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Check-out" type="date" size="small" fullWidth
                InputLabelProps={{ shrink: true }}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={selectedCat?.extra_bed_allowed ? 3 : 4}>
              <TextField
                label="Rooms" type="number" size="small" fullWidth
                value={rooms}
                onChange={(e) => setRooms(Math.max(1, parseInt(e.target.value) || 1))}
                InputProps={{ inputProps: { min: 1, max: 30 }, startAdornment: <InputAdornment position="start"><MeetingRoom sx={{ fontSize: 18 }} /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={selectedCat?.extra_bed_allowed ? 3 : 4}>
              <TextField
                label="Adults" type="number" size="small" fullWidth
                value={adults}
                onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
                InputProps={{ inputProps: { min: 1 }, startAdornment: <InputAdornment position="start"><Person sx={{ fontSize: 18 }} /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={selectedCat?.extra_bed_allowed ? 3 : 4}>
              <TextField
                label="Children" type="number" size="small" fullWidth
                value={children}
                onChange={(e) => setChildren(Math.max(0, parseInt(e.target.value) || 0))}
                InputProps={{ inputProps: { min: 0 }, startAdornment: <InputAdornment position="start"><Groups sx={{ fontSize: 18 }} /></InputAdornment> }}
              />
            </Grid>
            {selectedCat?.extra_bed_allowed && (
              <Grid item xs={3}>
                <TextField
                  label="Extra beds" type="number" size="small" fullWidth
                  value={extraBeds}
                  onChange={(e) => setExtraBeds(Math.max(0, parseInt(e.target.value) || 0))}
                  InputProps={{ inputProps: { min: 0 }, startAdornment: <InputAdornment position="start"><KingBed sx={{ fontSize: 18 }} /></InputAdornment> }}
                />
              </Grid>
            )}
          </Grid>

          <TextField
            label="Special requests" size="small" fullWidth multiline rows={2}
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            placeholder="Late check-in, high floor, honeymoon setup…"
          />

          {/* Live re-quote */}
          {quoteError && <Alert severity="error" sx={{ py: 0.5 }}>{quoteError}</Alert>}
          {quoteLoading && (
            <Stack direction="row" alignItems="center" gap={1} color="text.secondary">
              <CircularProgress size={16} /><Typography fontSize={13}>Re-pricing…</Typography>
            </Stack>
          )}
          {quote && !quoteLoading && (
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: "action.hover" }}>
              <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={1} letterSpacing={0.5}>
                NEW PRICE ({quote.nights} night{quote.nights === 1 ? "" : "s"} · {quote.rooms_count} room{quote.rooms_count === 1 ? "" : "s"})
              </Typography>
              <Stack gap={0.75}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography fontSize={13} color="text.secondary">Room charges (taxable)</Typography>
                  <Typography fontSize={13} fontWeight={600}>{fmtINR(quote.taxable_amount)}</Typography>
                </Stack>
                {quote.occupancy && quote.occupancy.person_surcharge > 0 && (
                  <Stack direction="row" justifyContent="space-between" sx={{ pl: 1.5 }}>
                    <Typography fontSize={11.5} color="text.secondary">
                      ↳ extra guests ({quote.occupancy.extra_adults} adult{quote.occupancy.extra_adults === 1 ? "" : "s"}
                      {quote.occupancy.extra_children > 0 ? `, ${quote.occupancy.extra_children} child` : ""})
                    </Typography>
                    <Typography fontSize={11.5} color="text.secondary">{fmtINR(quote.occupancy.person_surcharge)}</Typography>
                  </Stack>
                )}
                {quote.occupancy && quote.occupancy.bed_surcharge > 0 && (
                  <Stack direction="row" justifyContent="space-between" sx={{ pl: 1.5 }}>
                    <Typography fontSize={11.5} color="text.secondary">
                      ↳ extra bed{quote.occupancy.extra_beds === 1 ? "" : "s"} ({quote.occupancy.extra_beds})
                    </Typography>
                    <Typography fontSize={11.5} color="text.secondary">{fmtINR(quote.occupancy.bed_surcharge)}</Typography>
                  </Stack>
                )}
                {quote.gst_amount > 0 && (
                  <Stack direction="row" justifyContent="space-between">
                    <Typography fontSize={13} color="text.secondary">GST ({quote.gst_percent}%)</Typography>
                    <Typography fontSize={13} fontWeight={600}>{fmtINR(quote.gst_amount)}</Typography>
                  </Stack>
                )}
                <Divider />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography fontSize={14} fontWeight={700}>New Total</Typography>
                  <Typography fontSize={18} fontWeight={900} color="primary.main">{fmtINR(quote.total_amount)}</Typography>
                </Stack>
              </Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">Cancel</Button>
        <Button
          variant="contained"
          disabled={!valid || quoteLoading || mutation.isPending}
          onClick={() => mutation.mutate()}
          startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <EditCalendar />}
        >
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
