// ============================================================
// WAYTERO ADMIN — HOTEL BOOKING PAGE (CUSTOMER CARE)
// Route: /customer-care/hotel-booking/:customerId
//
// Mirrors CabBookingPage's 3-step flow, but hotel money is priced
// SERVER-SIDE (per-night rate plans + tariff GST slabs + commission),
// so the estimate comes from POST /hotel-booking/quote, not a local
// formula.
//   Step 0 — Hotel & Dates     (city filter → hotel → dates → occupancy)
//   Step 1 — Room & Guests     (room category → live quote → guest roster)
//   Step 2 — Confirm & Book    (price breakdown → confirm)
// ============================================================
import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Stack, Typography, Button, TextField, Select,
  MenuItem, FormControl, InputLabel, CircularProgress,
  Alert, Grid, Paper, Chip, Divider, Stepper, Step,
  StepLabel, alpha, useTheme, IconButton, Avatar,
  Card, CardContent, InputAdornment,
} from "@mui/material";
import {
  ArrowBack, Hotel as HotelIcon, CheckCircle, CalendarMonth,
  Info, MeetingRoom, BookOnline, Person, Groups,
  KingBed, Restaurant, LocationOn, ReceiptLong, Warning,
  AccountCircle, PersonAddAlt1,
} from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { format, differenceInCalendarDays, addDays } from "date-fns";

import {
  customerCareService,
  CustomerLookup,
  HotelBookingMeta,
  HotelMetaItem,
  HotelRoomCategoryMeta,
  HotelBookingQuote,
} from "../../services/customerCare.service";

const STEPS = ["Hotel & Dates", "Room & Guests", "Confirm & Book"];

const MEAL_PLAN_LABELS: Record<string, string> = {
  EP: "Room Only",
  CP: "Room + Breakfast",
  MAP: "Breakfast + 1 Meal",
  AP: "All Meals",
};

// A single editable guest row.
interface GuestRow {
  guest_name: string;
  mobile: string;
  gender: string;
  age: string;
  id_type: string;
  id_number: string;
}
const EMPTY_GUEST: GuestRow = { guest_name: "", mobile: "", gender: "", age: "", id_type: "", id_number: "" };

function fmtMoney(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
function fmtDate(d: Date | null): string {
  return d ? format(d, "yyyy-MM-dd") : "";
}

export default function HotelBookingPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();

  // ── UI state
  const [step, setStep] = useState(0);
  const [meta, setMeta] = useState<HotelBookingMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ booking_number: string; reservation_number: string; total_amount: number } | null>(null);

  // Customer profile — used to pre-fill the primary guest when booking for self.
  const [customer, setCustomer] = useState<CustomerLookup | null>(null);
  // "self" → primary guest IS the customer; "other" → agent types guest details.
  const [bookingFor, setBookingFor] = useState<"self" | "other">("self");

  // ── Form — Step 0
  const [cityId, setCityId] = useState<number | "">("");
  const [hotelId, setHotelId] = useState<number | "">("");
  const [checkIn, setCheckIn] = useState<Date | null>(addDays(new Date(), 1));
  const [checkOut, setCheckOut] = useState<Date | null>(addDays(new Date(), 2));
  const [rooms, setRooms] = useState(1);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [extraBeds, setExtraBeds] = useState(0);

  // ── Form — Step 1
  const [roomCategoryId, setRoomCategoryId] = useState<number | "">("");
  const [quote, setQuote] = useState<HotelBookingQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [guests, setGuests] = useState<GuestRow[]>([{ ...EMPTY_GUEST }]);

  // ── Form — Step 2
  const [specialRequests, setSpecialRequests] = useState("");
  const [remarks, setRemarks] = useState("");

  // ── Load hotel meta on mount ─────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const data = await customerCareService.getHotelMeta();
        setMeta(data);
      } catch {
        setError("Failed to load hotel booking metadata.");
      } finally {
        setMetaLoading(false);
      }
    })();
  }, []);

  // ── Load the customer profile (for self-booking prefill) ─────
  useEffect(() => {
    if (!customerId) return;
    (async () => {
      try {
        const c = await customerCareService.getCustomer(Number(customerId));
        setCustomer(c);
      } catch {
        // Non-fatal: fall back to manual guest entry.
        setBookingFor("other");
      }
    })();
  }, [customerId]);

  // Build a guest row from the customer's own details.
  const customerAsGuest = (c: CustomerLookup): GuestRow => ({
    ...EMPTY_GUEST,
    guest_name: (c.full_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`).trim(),
    mobile: c.mobile_number ?? "",
  });

  // When "booking for self" is active, keep the primary guest synced to the customer.
  useEffect(() => {
    if (bookingFor !== "self" || !customer) return;
    setGuests((prev) => [customerAsGuest(customer), ...prev.slice(1)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingFor, customer]);

  // ── Reload hotels when city filter changes ──────────────────
  useEffect(() => {
    if (metaLoading) return;
    (async () => {
      try {
        const data = await customerCareService.getHotelMeta(cityId ? Number(cityId) : undefined);
        setMeta(data);
        // Reset hotel/room if the current hotel is no longer in the list.
        setHotelId((prev) => (data.hotels.some((h) => h.id === prev) ? prev : ""));
        setRoomCategoryId("");
        setQuote(null);
      } catch { /* keep existing meta */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId]);

  const hotels = meta?.hotels ?? [];
  const selectedHotel: HotelMetaItem | undefined = useMemo(
    () => hotels.find((h) => h.id === hotelId),
    [hotels, hotelId],
  );
  const roomCategories: HotelRoomCategoryMeta[] = selectedHotel?.room_categories ?? [];
  const selectedRoom: HotelRoomCategoryMeta | undefined = useMemo(
    () => roomCategories.find((r) => r.id === roomCategoryId),
    [roomCategories, roomCategoryId],
  );

  // Extra beds only make sense for a category that allows them — clear the
  // count when switching to one that doesn't, so a stale value can't be priced.
  useEffect(() => {
    if (selectedRoom && !selectedRoom.extra_bed_allowed && extraBeds !== 0) {
      setExtraBeds(0);
    }
  }, [selectedRoom, extraBeds]);

  const nights = checkIn && checkOut ? differenceInCalendarDays(checkOut, checkIn) : 0;

  // ── Fetch quote whenever the priced inputs change (Step 1) ───
  useEffect(() => {
    if (step !== 1) return;
    if (!hotelId || !roomCategoryId || !checkIn || !checkOut || nights < 1) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setQuoteLoading(true);
      setQuoteError("");
      try {
        const q = await customerCareService.getHotelQuote({
          hotel_id: Number(hotelId),
          room_category_id: Number(roomCategoryId),
          check_in_date: fmtDate(checkIn),
          check_out_date: fmtDate(checkOut),
          rooms_count: rooms,
          adults_count: adults,
          children_count: children,
          extra_beds: extraBeds,
        });
        if (!cancelled) setQuote(q);
      } catch (e: any) {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(e?.response?.data?.detail || "Failed to price this stay.");
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [step, hotelId, roomCategoryId, checkIn, checkOut, rooms, adults, children, extraBeds, nights]);

  // ── Step validation ─────────────────────────────────────────
  function step0Valid() {
    return hotelId !== "" && !!checkIn && !!checkOut && nights >= 1 && rooms >= 1;
  }
  function step1Valid() {
    return roomCategoryId !== "" && !!quote && guests[0]?.guest_name.trim().length > 0;
  }

  // ── Guest row helpers ────────────────────────────────────────
  function updateGuest(idx: number, field: keyof GuestRow, value: string) {
    setGuests((prev) => prev.map((g, i) => (i === idx ? { ...g, [field]: value } : g)));
  }
  function addGuest() {
    setGuests((prev) => [...prev, { ...EMPTY_GUEST }]);
  }
  function removeGuest(idx: number) {
    setGuests((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  // ── Submit ───────────────────────────────────────────────────
  async function handleSubmit() {
    if (!customerId || !step0Valid() || !step1Valid() || !checkIn || !checkOut) return;
    setSubmitting(true);
    setError("");
    try {
      const cleanGuests = guests
        .filter((g) => g.guest_name.trim())
        .map((g, i) => ({
          guest_name: g.guest_name.trim(),
          mobile: g.mobile || null,
          gender: g.gender || null,
          age: g.age ? parseInt(g.age) : null,
          id_type: g.id_type || null,
          id_number: g.id_number || null,
          is_primary: i === 0,
        }));

      const result = await customerCareService.createHotelBooking({
        customer_id: parseInt(customerId),
        hotel_id: Number(hotelId),
        room_category_id: Number(roomCategoryId),
        check_in_date: fmtDate(checkIn),
        check_out_date: fmtDate(checkOut),
        rooms_count: rooms,
        adults_count: adults,
        children_count: children,
        extra_beds: extraBeds,
        guests: cleanGuests,
        special_requests: specialRequests || null,
        remarks: remarks || null,
      });
      setSuccess({
        booking_number: result.booking_number,
        reservation_number: result.reservation_number,
        total_amount: result.total_amount,
      });
      setStep(3);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to create hotel booking");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success screen ───────────────────────────────────────────
  if (success) {
    return (
      <Box maxWidth={600} mx="auto" mt={6} textAlign="center">
        <Box sx={{
          width: 88, height: 88, borderRadius: "50%",
          background: "linear-gradient(135deg, #22C55E20, #16A34A30)",
          border: "2px solid #22C55E40",
          display: "flex", alignItems: "center", justifyContent: "center",
          mx: "auto", mb: 3,
        }}>
          <CheckCircle sx={{ fontSize: 48, color: "#22C55E" }} />
        </Box>
        <Typography variant="h5" fontWeight={800} mb={1}>Hotel Booking Created!</Typography>
        <Typography color="text.secondary" mb={3}>
          Reservation created on behalf of Customer #{customerId}.
        </Typography>
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mb: 3, textAlign: "left" }}>
          <Stack gap={1.5}>
            {[
              ["Booking Number", <Typography fontWeight={800} fontFamily="monospace" color="primary.main">{success.booking_number}</Typography>],
              ["Reservation No.", <Typography fontWeight={800} fontFamily="monospace" color="secondary.main">{success.reservation_number}</Typography>],
              ["Hotel", selectedHotel?.hotel_name],
              ["Room", selectedRoom?.category_name],
              ["Check-in", checkIn ? format(checkIn, "dd MMM yyyy") : "—"],
              ["Check-out", checkOut ? format(checkOut, "dd MMM yyyy") : "—"],
              ["Nights × Rooms", `${nights} × ${rooms}`],
              ["Total Amount", <Typography fontWeight={700} color="success.main">{fmtMoney(success.total_amount)}</Typography>],
            ].filter(Boolean).map((row: any, i) => (
              <Stack key={i} direction="row" justifyContent="space-between" alignItems="center"
                py={1} sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                <Typography color="text.secondary" fontSize={13}>{row[0]}</Typography>
                {typeof row[1] === "string"
                  ? <Typography fontWeight={600} fontSize={13} textAlign="right" maxWidth={280}>{row[1]}</Typography>
                  : row[1]}
              </Stack>
            ))}
            <Stack direction="row" justifyContent="space-between" alignItems="center" pt={0.5}>
              <Typography color="text.secondary" fontSize={13}>Status</Typography>
              <Chip size="small" label="Confirmed" color="success" sx={{ fontWeight: 700 }} />
            </Stack>
          </Stack>
        </Paper>
        <Stack direction="row" gap={2} justifyContent="center">
          <Button variant="outlined" onClick={() => navigate("/customer-care")}
            sx={{ borderRadius: 2, textTransform: "none" }}>
            Back to Customer Care
          </Button>
          <Button variant="contained" onClick={() => navigate("/bookings")}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }}>
            View Bookings
          </Button>
        </Stack>
      </Box>
    );
  }

  // ── Main layout ──────────────────────────────────────────────
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box maxWidth={900} mx="auto">

        {/* Page header */}
        <Stack direction="row" alignItems="center" gap={1.5} mb={3}>
          <IconButton onClick={() => navigate("/customer-care")}
            sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            <ArrowBack />
          </IconButton>
          <Box>
            <Typography variant="h6" fontWeight={800}>Create Hotel Booking</Typography>
            <Typography variant="caption" color="text.secondary">
              Customer Care → Hotel Booking · Customer ID: #{customerId}
            </Typography>
          </Box>
          <Stack direction="row" gap={1} ml="auto" alignItems="center">
            <Chip icon={<HotelIcon sx={{ fontSize: "14px !important" }} />} label="HOTEL" size="small"
              sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.secondary.main, 0.1), color: "secondary.main" }} />
          </Stack>
        </Stack>

        {/* Info notice */}
        <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2.5 }} icon={<Info />}>
          Hotel stays are priced <strong>live from the server</strong> using each night's rate plan and
          the applicable GST slab, so the total reflects exactly what the customer would pay.
        </Alert>

        {/* Stepper */}
        <Stepper activeStep={step} sx={{ mb: 4 }}>
          {STEPS.map((label, i) => (
            <Step key={label} completed={step > i}>
              <StepLabel sx={{ "& .MuiStepLabel-label": { fontWeight: 600, fontSize: 13 } }}>
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        {metaLoading ? (
          <Box display="flex" justifyContent="center" py={10}><CircularProgress /></Box>
        ) : hotels.length === 0 && !cityId ? (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            No active hotels are available to book yet. A hotel must be <strong>ACTIVE</strong> before it
            can be booked here.
          </Alert>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════
                STEP 0 — Hotel & Dates
            ══════════════════════════════════════════════════ */}
            {step === 0 && (
              <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 3 }}>
                <Stack direction="row" alignItems="center" gap={1} mb={3}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: 2,
                    bgcolor: alpha(theme.palette.secondary.main, 0.1),
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <HotelIcon sx={{ color: "secondary.main", fontSize: 20 }} />
                  </Box>
                  <Typography fontWeight={700} fontSize={15}>Select Hotel & Stay Dates</Typography>
                </Stack>

                {/* City filter + hotel */}
                <Grid container spacing={2} mb={1}>
                  <Grid item xs={12} sm={5}>
                    <FormControl fullWidth size="small">
                      <InputLabel>City (filter)</InputLabel>
                      <Select
                        value={cityId}
                        onChange={(e) => setCityId(e.target.value === "" ? "" : Number(e.target.value))}
                        label="City (filter)"
                        sx={{ borderRadius: 2 }}
                      >
                        <MenuItem value=""><em>All cities</em></MenuItem>
                        {meta?.cities.map((c) => (
                          <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={7}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Hotel *</InputLabel>
                      <Select
                        value={hotelId}
                        onChange={(e) => {
                          setHotelId(Number(e.target.value));
                          setRoomCategoryId("");
                          setQuote(null);
                        }}
                        label="Hotel *"
                        sx={{ borderRadius: 2 }}
                      >
                        {hotels.map((h) => (
                          <MenuItem key={h.id} value={h.id}>
                            {h.hotel_name}
                            {h.city_name ? ` · ${h.city_name}` : ""}
                            {h.star_rating ? ` · ${h.star_rating}★` : ""}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                {selectedHotel && (
                  <Stack direction="row" alignItems="center" gap={0.75} mb={2.5} mt={0.5}>
                    <LocationOn sx={{ fontSize: 14, color: "text.secondary" }} />
                    <Typography fontSize={12} color="text.secondary">
                      {selectedHotel.address || "—"} · {roomCategories.length} room type{roomCategories.length !== 1 ? "s" : ""}
                    </Typography>
                  </Stack>
                )}

                <Divider sx={{ my: 2.5 }} />

                {/* Dates */}
                <Typography fontWeight={600} fontSize={12} color="text.secondary" mb={1.5} letterSpacing={0.5}>
                  STAY DATES *
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <DatePicker
                      label="Check-in *"
                      value={checkIn}
                      minDate={new Date()}
                      onChange={(v) => {
                        setCheckIn(v);
                        if (v && checkOut && differenceInCalendarDays(checkOut, v) < 1) {
                          setCheckOut(addDays(v, 1));
                        }
                      }}
                      slotProps={{ textField: { size: "small", fullWidth: true, sx: { "& .MuiOutlinedInput-root": { borderRadius: 2 } } } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <DatePicker
                      label="Check-out *"
                      value={checkOut}
                      minDate={checkIn ? addDays(checkIn, 1) : new Date()}
                      onChange={(v) => setCheckOut(v)}
                      slotProps={{ textField: { size: "small", fullWidth: true, sx: { "& .MuiOutlinedInput-root": { borderRadius: 2 } } } }}
                    />
                  </Grid>
                </Grid>
                {nights >= 1 && (
                  <Chip
                    icon={<CalendarMonth sx={{ fontSize: "16px !important" }} />}
                    label={`${nights} night${nights > 1 ? "s" : ""}`}
                    size="small" color="secondary" variant="outlined"
                    sx={{ mt: 1.5, fontWeight: 600 }}
                  />
                )}

                <Divider sx={{ my: 2.5 }} />

                {/* Occupancy */}
                <Typography fontWeight={600} fontSize={12} color="text.secondary" mb={1.5} letterSpacing={0.5}>
                  ROOMS & OCCUPANCY *
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <TextField
                      label="Rooms" type="number" size="small" fullWidth
                      value={rooms}
                      onChange={(e) => setRooms(Math.max(1, parseInt(e.target.value) || 1))}
                      InputProps={{ inputProps: { min: 1, max: 30 }, startAdornment: <InputAdornment position="start"><MeetingRoom sx={{ fontSize: 18 }} /></InputAdornment> }}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      label="Adults" type="number" size="small" fullWidth
                      value={adults}
                      onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
                      InputProps={{ inputProps: { min: 1 }, startAdornment: <InputAdornment position="start"><Person sx={{ fontSize: 18 }} /></InputAdornment> }}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      label="Children" type="number" size="small" fullWidth
                      value={children}
                      onChange={(e) => setChildren(Math.max(0, parseInt(e.target.value) || 0))}
                      InputProps={{ inputProps: { min: 0 }, startAdornment: <InputAdornment position="start"><Groups sx={{ fontSize: 18 }} /></InputAdornment> }}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                    />
                  </Grid>
                  {selectedRoom?.extra_bed_allowed && (
                    <Grid item xs={4}>
                      <TextField
                        label="Extra beds" type="number" size="small" fullWidth
                        value={extraBeds}
                        onChange={(e) => setExtraBeds(Math.max(0, parseInt(e.target.value) || 0))}
                        InputProps={{ inputProps: { min: 0 }, startAdornment: <InputAdornment position="start"><KingBed sx={{ fontSize: 18 }} /></InputAdornment> }}
                        helperText={selectedRoom.extra_bed_charge != null ? `₹${selectedRoom.extra_bed_charge}/stay each` : undefined}
                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                      />
                    </Grid>
                  )}
                </Grid>

                <Box mt={3} display="flex" justifyContent="flex-end">
                  <Button
                    variant="contained" disabled={!step0Valid()}
                    onClick={() => setStep(1)}
                    sx={{
                      borderRadius: 2, textTransform: "none", fontWeight: 700, px: 3.5,
                      background: step0Valid()
                        ? `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.dark})`
                        : undefined,
                    }}
                  >
                    Next: Room & Guests →
                  </Button>
                </Box>
              </Paper>
            )}

            {/* ══════════════════════════════════════════════════
                STEP 1 — Room & Guests
            ══════════════════════════════════════════════════ */}
            {step === 1 && (
              <Stack gap={2.5}>
                {/* ── Room selection ── */}
                <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 3 }}>
                  <Stack direction="row" alignItems="center" gap={1} mb={2.5}>
                    <Box sx={{
                      width: 36, height: 36, borderRadius: 2,
                      bgcolor: alpha(theme.palette.secondary.main, 0.1),
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <KingBed sx={{ color: "secondary.main", fontSize: 20 }} />
                    </Box>
                    <Typography fontWeight={700} fontSize={15}>Choose Room Type</Typography>
                    <Chip label={selectedHotel?.hotel_name ?? ""} size="small"
                      sx={{ ml: 1, fontWeight: 600, bgcolor: alpha(theme.palette.secondary.main, 0.1), color: "secondary.main" }} />
                  </Stack>

                  {roomCategories.length === 0 ? (
                    <Alert severity="warning" sx={{ borderRadius: 2 }}>
                      This hotel has no active room categories. Add and activate a room type before booking.
                    </Alert>
                  ) : (
                    <Grid container spacing={1.5}>
                      {roomCategories.map((rc) => {
                        const isSelected = roomCategoryId === rc.id;
                        return (
                          <Grid item xs={12} sm={6} key={rc.id}>
                            <Card
                              variant="outlined"
                              onClick={() => setRoomCategoryId(rc.id)}
                              sx={{
                                borderRadius: 2.5, cursor: "pointer", transition: "all 0.15s",
                                borderColor: isSelected ? theme.palette.secondary.main : "divider",
                                borderWidth: isSelected ? 2 : 1,
                                bgcolor: isSelected ? alpha(theme.palette.secondary.main, 0.04) : "background.paper",
                                "&:hover": { boxShadow: 3, transform: "translateY(-1px)" },
                              }}
                            >
                              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                <Stack direction="row" alignItems="flex-start" gap={1.5}>
                                  <Avatar sx={{
                                    bgcolor: isSelected ? alpha(theme.palette.secondary.main, 0.15) : alpha("#6366F1", 0.08),
                                    color: isSelected ? "secondary.main" : "text.secondary",
                                    width: 44, height: 44, borderRadius: 2,
                                  }}>
                                    <KingBed />
                                  </Avatar>
                                  <Box flex={1} minWidth={0}>
                                    <Typography fontWeight={700} fontSize={13.5} noWrap>{rc.category_name}</Typography>
                                    <Stack direction="row" alignItems="center" gap={0.5} mt={0.25} flexWrap="wrap">
                                      <Restaurant sx={{ fontSize: 12, color: "text.secondary" }} />
                                      <Typography fontSize={11} color="text.secondary">
                                        {MEAL_PLAN_LABELS[rc.meal_plan] ?? rc.meal_plan}
                                      </Typography>
                                      <Typography fontSize={11} color="text.secondary">
                                        · Max {rc.max_occupancy}
                                      </Typography>
                                    </Stack>
                                  </Box>
                                  <Box textAlign="right" flexShrink={0}>
                                    <Typography fontWeight={800} fontSize={14} color={isSelected ? "secondary.main" : "text.primary"}>
                                      {fmtMoney(rc.base_price ?? 0)}
                                    </Typography>
                                    <Typography fontSize={11} color="text.secondary">/night base</Typography>
                                  </Box>
                                </Stack>
                              </CardContent>
                            </Card>
                          </Grid>
                        );
                      })}
                    </Grid>
                  )}

                  {/* ── Live quote panel ── */}
                  {roomCategoryId !== "" && (
                    <Box sx={{ mt: 2.5 }}>
                      {quoteLoading ? (
                        <Box display="flex" alignItems="center" gap={1.5} sx={{
                          p: 2.5, borderRadius: 2.5, border: "1px dashed", borderColor: "divider",
                        }}>
                          <CircularProgress size={18} />
                          <Typography fontSize={13} color="text.secondary">Pricing this stay…</Typography>
                        </Box>
                      ) : quoteError ? (
                        <Alert severity="error" sx={{ borderRadius: 2 }}>{quoteError}</Alert>
                      ) : quote ? (
                        <Box sx={{
                          p: 2.5, borderRadius: 2.5,
                          background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.06)}, ${alpha(theme.palette.secondary.dark, 0.04)})`,
                          border: "1px solid", borderColor: alpha(theme.palette.secondary.main, 0.25),
                        }}>
                          <Stack direction="row" alignItems="flex-start" gap={2}>
                            <Box sx={{
                              width: 44, height: 44, borderRadius: 2,
                              bgcolor: alpha(theme.palette.secondary.main, 0.15),
                              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            }}>
                              <ReceiptLong sx={{ color: "secondary.main", fontSize: 22 }} />
                            </Box>
                            <Box flex={1}>
                              <Typography fontSize={12} fontWeight={600} color="text.secondary" mb={0.25}>
                                TOTAL PAYABLE ({quote.nights} night{quote.nights > 1 ? "s" : ""} × {quote.rooms_count} room{quote.rooms_count > 1 ? "s" : ""})
                              </Typography>
                              <Typography fontWeight={900} fontSize={28} color="secondary.main" lineHeight={1}>
                                {fmtMoney(quote.total_amount)}
                              </Typography>
                              <Typography fontSize={12} color="text.secondary" mt={0.75}>
                                Room {fmtMoney(quote.taxable_amount)}
                                {quote.gst_amount > 0 ? ` + GST ${fmtMoney(quote.gst_amount)} (${quote.gst_percent}%)` : " · GST not applicable"}
                                {" · "}avg {fmtMoney(quote.average_nightly_rate)}/night
                              </Typography>
                            </Box>
                          </Stack>
                        </Box>
                      ) : null}
                    </Box>
                  )}
                </Paper>

                {/* ── Guest roster ── */}
                <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 3 }}>
                  <Stack direction="row" alignItems="center" gap={1} mb={2}>
                    <Box sx={{
                      width: 36, height: 36, borderRadius: 2,
                      bgcolor: alpha("#22C55E", 0.1),
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Groups sx={{ color: "#22C55E", fontSize: 20 }} />
                    </Box>
                    <Box>
                      <Typography fontWeight={700} fontSize={15}>Guest Details</Typography>
                      <Typography fontSize={11} color="text.secondary">
                        The first guest is the primary guest for this reservation.
                      </Typography>
                    </Box>
                  </Stack>

                  {/* Who is this booking for? */}
                  <Box sx={{
                    p: 1.75, borderRadius: 2.5, mb: 2.5,
                    border: "1px solid", borderColor: "divider",
                    bgcolor: alpha(theme.palette.primary.main, 0.02),
                  }}>
                    <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={1.25} letterSpacing={0.4}>
                      WHO IS THIS BOOKING FOR?
                    </Typography>
                    <Grid container spacing={1.25}>
                      <Grid item xs={12} sm={6}>
                        <Box
                          onClick={() => customer && setBookingFor("self")}
                          sx={{
                            p: 1.5, borderRadius: 2, border: "1px solid",
                            display: "flex", alignItems: "center", gap: 1.25,
                            cursor: customer ? "pointer" : "not-allowed",
                            opacity: customer ? 1 : 0.5,
                            borderColor: bookingFor === "self" ? theme.palette.primary.main : "divider",
                            borderWidth: bookingFor === "self" ? 2 : 1,
                            bgcolor: bookingFor === "self" ? alpha(theme.palette.primary.main, 0.06) : "background.paper",
                            transition: "all 0.15s",
                          }}
                        >
                          <AccountCircle sx={{ color: bookingFor === "self" ? "primary.main" : "text.secondary" }} />
                          <Box flex={1} minWidth={0}>
                            <Typography fontSize={13} fontWeight={700}>The customer</Typography>
                            <Typography fontSize={11} color="text.secondary" noWrap>
                              {customer?.full_name || (customer ? "This customer" : "Loading…")}
                            </Typography>
                          </Box>
                          {bookingFor === "self" && <CheckCircle sx={{ fontSize: 18, color: "primary.main" }} />}
                        </Box>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Box
                          onClick={() => setBookingFor("other")}
                          sx={{
                            p: 1.5, borderRadius: 2, border: "1px solid",
                            display: "flex", alignItems: "center", gap: 1.25, cursor: "pointer",
                            borderColor: bookingFor === "other" ? theme.palette.primary.main : "divider",
                            borderWidth: bookingFor === "other" ? 2 : 1,
                            bgcolor: bookingFor === "other" ? alpha(theme.palette.primary.main, 0.06) : "background.paper",
                            transition: "all 0.15s",
                          }}
                        >
                          <PersonAddAlt1 sx={{ color: bookingFor === "other" ? "primary.main" : "text.secondary" }} />
                          <Box flex={1} minWidth={0}>
                            <Typography fontSize={13} fontWeight={700}>Someone else</Typography>
                            <Typography fontSize={11} color="text.secondary" noWrap>
                              Enter the guest's details
                            </Typography>
                          </Box>
                          {bookingFor === "other" && <CheckCircle sx={{ fontSize: 18, color: "primary.main" }} />}
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>

                  <Stack gap={2}>
                    {guests.map((g, idx) => {
                      // Primary guest locked to the customer when booking for self.
                      const lockedSelf = idx === 0 && bookingFor === "self" && !!customer;
                      if (lockedSelf) {
                        return (
                          <Box key={idx} sx={{
                            p: 2, borderRadius: 2, border: "1px solid",
                            borderColor: alpha(theme.palette.primary.main, 0.3),
                            bgcolor: alpha(theme.palette.primary.main, 0.04),
                          }}>
                            <Stack direction="row" alignItems="center" gap={1.5}>
                              <Avatar sx={{ bgcolor: "primary.main", width: 44, height: 44, fontWeight: 800 }}>
                                {(g.guest_name || "?")[0]?.toUpperCase()}
                              </Avatar>
                              <Box flex={1} minWidth={0}>
                                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                                  <Typography fontWeight={700} fontSize={14}>{g.guest_name || "—"}</Typography>
                                  <Chip size="small" label="Primary Guest · Customer" color="primary"
                                    sx={{ fontWeight: 600, height: 20, fontSize: 10.5 }} />
                                </Stack>
                                <Typography fontSize={12} color="text.secondary">
                                  {g.mobile || "No mobile on file"}
                                  {customer?.customer_code ? ` · ${customer.customer_code}` : ""}
                                </Typography>
                              </Box>
                              <Button size="small" variant="text" onClick={() => setBookingFor("other")}
                                sx={{ textTransform: "none", fontWeight: 600 }}>
                                Edit details
                              </Button>
                            </Stack>
                          </Box>
                        );
                      }
                      return (
                      <Box key={idx} sx={{
                        p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider",
                        bgcolor: idx === 0 ? alpha("#22C55E", 0.03) : "background.paper",
                      }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                          <Chip
                            size="small"
                            label={idx === 0 ? "Primary Guest" : `Guest ${idx + 1}`}
                            color={idx === 0 ? "success" : "default"}
                            variant={idx === 0 ? "filled" : "outlined"}
                            sx={{ fontWeight: 600 }}
                          />
                          {idx > 0 && (
                            <Button size="small" color="error" onClick={() => removeGuest(idx)}
                              sx={{ textTransform: "none", minWidth: 0 }}>
                              Remove
                            </Button>
                          )}
                        </Stack>
                        <Grid container spacing={1.5}>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              label={idx === 0 ? "Full name *" : "Full name"}
                              value={g.guest_name} size="small" fullWidth
                              onChange={(e) => updateGuest(idx, "guest_name", e.target.value)}
                              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                            />
                          </Grid>
                          <Grid item xs={6} sm={3}>
                            <TextField
                              label="Mobile" value={g.mobile} size="small" fullWidth
                              onChange={(e) => updateGuest(idx, "mobile", e.target.value.replace(/[^0-9]/g, ""))}
                              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                            />
                          </Grid>
                          <Grid item xs={6} sm={3}>
                            <TextField
                              label="Age" type="number" value={g.age} size="small" fullWidth
                              onChange={(e) => updateGuest(idx, "age", e.target.value)}
                              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                            />
                          </Grid>
                          <Grid item xs={6} sm={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Gender</InputLabel>
                              <Select
                                value={g.gender} label="Gender"
                                onChange={(e) => updateGuest(idx, "gender", e.target.value)}
                                sx={{ borderRadius: 2 }}
                              >
                                <MenuItem value=""><em>—</em></MenuItem>
                                <MenuItem value="MALE">Male</MenuItem>
                                <MenuItem value="FEMALE">Female</MenuItem>
                                <MenuItem value="OTHER">Other</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={6} sm={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>ID Type</InputLabel>
                              <Select
                                value={g.id_type} label="ID Type"
                                onChange={(e) => updateGuest(idx, "id_type", e.target.value)}
                                sx={{ borderRadius: 2 }}
                              >
                                <MenuItem value=""><em>—</em></MenuItem>
                                <MenuItem value="AADHAAR">Aadhaar</MenuItem>
                                <MenuItem value="PAN">PAN</MenuItem>
                                <MenuItem value="PASSPORT">Passport</MenuItem>
                                <MenuItem value="DRIVING_LICENSE">Driving License</MenuItem>
                                <MenuItem value="VOTER_ID">Voter ID</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} sm={4}>
                            <TextField
                              label="ID Number" value={g.id_number} size="small" fullWidth
                              onChange={(e) => updateGuest(idx, "id_number", e.target.value)}
                              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                            />
                          </Grid>
                        </Grid>
                      </Box>
                      );
                    })}
                    <Button variant="outlined" onClick={addGuest} startIcon={<Person />}
                      sx={{ borderRadius: 2, textTransform: "none", alignSelf: "flex-start" }}>
                      Add Guest
                    </Button>
                  </Stack>

                  <Stack direction="row" gap={1.5} mt={3} justifyContent="space-between">
                    <Button variant="outlined" onClick={() => setStep(0)}
                      sx={{ borderRadius: 2, textTransform: "none" }}>
                      ← Back
                    </Button>
                    <Button variant="contained" disabled={!step1Valid()} onClick={() => setStep(2)}
                      sx={{
                        borderRadius: 2, textTransform: "none", fontWeight: 700, px: 3.5,
                        background: step1Valid()
                          ? `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.dark})`
                          : undefined,
                      }}>
                      Review Booking →
                    </Button>
                  </Stack>
                </Paper>
              </Stack>
            )}

            {/* ══════════════════════════════════════════════════
                STEP 2 — Confirm
            ══════════════════════════════════════════════════ */}
            {step === 2 && (
              <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 3 }}>
                <Stack direction="row" alignItems="center" gap={1} mb={3}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: 2,
                    bgcolor: alpha("#6366F1", 0.1),
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <BookOnline sx={{ color: "#6366F1", fontSize: 20 }} />
                  </Box>
                  <Typography fontWeight={700} fontSize={15}>Review & Confirm Booking</Typography>
                </Stack>

                {/* Summary */}
                <Stack gap={0} mb={2.5}>
                  {[
                    ["Hotel", selectedHotel?.hotel_name],
                    ["Room Type", selectedRoom?.category_name],
                    ["Meal Plan", selectedRoom ? (MEAL_PLAN_LABELS[selectedRoom.meal_plan] ?? selectedRoom.meal_plan) : "—"],
                    ["Check-in", checkIn ? format(checkIn, "dd MMM yyyy") : "—"],
                    ["Check-out", checkOut ? format(checkOut, "dd MMM yyyy") : "—"],
                    ["Nights", String(nights)],
                    ["Rooms", String(rooms)],
                    ["Occupancy", `${adults} adult${adults > 1 ? "s" : ""}${children > 0 ? `, ${children} child${children > 1 ? "ren" : ""}` : ""}`],
                    ["Primary Guest", guests[0]?.guest_name || "—"],
                  ].filter(Boolean).map((row: any, i) => (
                    <Stack key={i} direction="row" justifyContent="space-between" alignItems="flex-start"
                      py={1.25} sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                      <Typography fontSize={13} color="text.secondary" flexShrink={0} mr={2}>{row[0]}</Typography>
                      <Typography fontSize={13} fontWeight={600} textAlign="right" maxWidth={360}
                        sx={{ wordBreak: "break-word" }}>{row[1] || "—"}</Typography>
                    </Stack>
                  ))}
                </Stack>

                {/* Price breakdown */}
                {quote && (
                  <Box sx={{
                    p: 2.5, borderRadius: 2.5, mb: 3,
                    background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.06)}, ${alpha(theme.palette.secondary.dark, 0.04)})`,
                    border: "1px solid", borderColor: alpha(theme.palette.secondary.main, 0.25),
                  }}>
                    <Typography fontSize={12} fontWeight={700} color="text.secondary" mb={1.5} letterSpacing={0.5}>
                      PRICE BREAKDOWN
                    </Typography>
                    <Stack gap={1}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography fontSize={13} color="text.secondary">Room charges (taxable)</Typography>
                        <Typography fontSize={13} fontWeight={600}>{fmtMoney(quote.taxable_amount)}</Typography>
                      </Stack>
                      {quote.occupancy && quote.occupancy.person_surcharge > 0 && (
                        <Stack direction="row" justifyContent="space-between" sx={{ pl: 1.5 }}>
                          <Typography fontSize={11.5} color="text.secondary">
                            ↳ incl. extra guests ({quote.occupancy.extra_adults} adult{quote.occupancy.extra_adults === 1 ? "" : "s"}
                            {quote.occupancy.extra_children > 0 ? `, ${quote.occupancy.extra_children} child` : ""})
                          </Typography>
                          <Typography fontSize={11.5} color="text.secondary">{fmtMoney(quote.occupancy.person_surcharge)}</Typography>
                        </Stack>
                      )}
                      {quote.occupancy && quote.occupancy.bed_surcharge > 0 && (
                        <Stack direction="row" justifyContent="space-between" sx={{ pl: 1.5 }}>
                          <Typography fontSize={11.5} color="text.secondary">
                            ↳ incl. extra bed{quote.occupancy.extra_beds === 1 ? "" : "s"} ({quote.occupancy.extra_beds})
                          </Typography>
                          <Typography fontSize={11.5} color="text.secondary">{fmtMoney(quote.occupancy.bed_surcharge)}</Typography>
                        </Stack>
                      )}
                      {quote.gst_amount > 0 && (
                        <Stack direction="row" justifyContent="space-between">
                          <Typography fontSize={13} color="text.secondary">GST ({quote.gst_percent}%)</Typography>
                          <Typography fontSize={13} fontWeight={600}>{fmtMoney(quote.gst_amount)}</Typography>
                        </Stack>
                      )}
                      <Divider />
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography fontSize={14} fontWeight={700}>Total Payable</Typography>
                        <Typography fontSize={20} fontWeight={900} color="secondary.main">{fmtMoney(quote.total_amount)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography fontSize={11} color="text.secondary">Platform commission</Typography>
                        <Typography fontSize={11} color="text.secondary">{fmtMoney(quote.platform_commission)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography fontSize={11} color="text.secondary">Partner payout</Typography>
                        <Typography fontSize={11} color="text.secondary">{fmtMoney(quote.partner_payout)}</Typography>
                      </Stack>
                    </Stack>
                  </Box>
                )}

                {/* Special requests + remarks */}
                <TextField
                  label="Special Requests (Optional)"
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  fullWidth size="small" multiline rows={2}
                  placeholder="Early check-in, high floor, airport pickup…"
                  sx={{ mb: 2, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                />
                <TextField
                  label="Admin Remarks (Optional)"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  fullWidth size="small" multiline rows={2}
                  placeholder="Internal notes for this booking…"
                  sx={{ mb: 3, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                />

                <Stack direction="row" gap={1.5} justifyContent="space-between">
                  <Button variant="outlined" onClick={() => setStep(1)}
                    sx={{ borderRadius: 2, textTransform: "none" }}>
                    ← Back
                  </Button>
                  <Button
                    variant="contained" onClick={handleSubmit} disabled={submitting || !quote}
                    startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <BookOnline />}
                    sx={{
                      borderRadius: 2, textTransform: "none", fontWeight: 700, px: 3.5,
                      background: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.dark})`,
                    }}
                  >
                    {submitting ? "Creating Booking…" : "Confirm & Create Booking"}
                  </Button>
                </Stack>
              </Paper>
            )}
          </>
        )}
      </Box>
    </LocalizationProvider>
  );
}
