// ============================================================
// WAYTERO ADMIN — CUSTOMER CARE SESSION QUOTES
// The price conversation happens before the booking form: the agent picks
// the service, gets a server quote, and only then continues to the full
// booking page (or logs an issue instead).
// ============================================================
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Grid,
  MenuItem, Paper, Stack, TextField, Typography, alpha, useTheme,
} from "@mui/material";
import {
  BookOnline, DirectionsCar, HeadsetMic, Hotel as HotelIcon,
  Refresh, TravelExplore,
} from "@mui/icons-material";
import { addDays, differenceInCalendarDays, format } from "date-fns";

import {
  customerCareService, CabBookingMeta, CabBookingQuote,
  HotelBookingMeta, HotelBookingQuote,
} from "../../../services/customerCare.service";
import { tourService, TourPackage } from "../../../services/tour.service";
import { apiErrorMessage } from "../../../utils/apiError";

export type CareService = "CAB" | "HOTEL" | "TOUR";

interface QuotePanelProps {
  customerId: number;
  onBook: () => void;
  onIssue: () => void;
}

const num = (value: number | string | null | undefined) => Number(value ?? 0);
const money = (value: number | string | null | undefined) =>
  `₹${num(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const localDateTime = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm");

function QuoteActions({
  bookLabel, ready, onBook, onIssue,
}: {
  bookLabel: string;
  ready: boolean;
  onBook: () => void;
  onIssue: () => void;
}) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} gap={1.5}>
      <Button
        variant="outlined"
        startIcon={<HeadsetMic />}
        onClick={onIssue}
        sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700, flex: 1 }}
      >
        Log issue instead
      </Button>
      <Button
        variant="contained"
        startIcon={<BookOnline />}
        onClick={onBook}
        disabled={!ready}
        sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700, flex: 1.4 }}
      >
        {bookLabel}
      </Button>
    </Stack>
  );
}

function PriceLine({
  label, value, strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <Stack direction="row" justifyContent="space-between" gap={2}>
      <Typography fontSize={strong ? 14 : 12.5} color={strong ? "text.primary" : "text.secondary"} fontWeight={strong ? 800 : 500}>
        {label}
      </Typography>
      <Typography fontSize={strong ? 16 : 12.5} fontWeight={strong ? 900 : 700}>
        {value}
      </Typography>
    </Stack>
  );
}

function QuoteCard({
  title, subtitle, children, footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1} mb={1.5}>
        <Box>
          <Typography fontWeight={800} fontSize={15}>{title}</Typography>
          {subtitle && <Typography fontSize={11.5} color="text.secondary">{subtitle}</Typography>}
        </Box>
        <Chip size="small" label="Server price" color="success" variant="outlined" sx={{ fontWeight: 700 }} />
      </Stack>
      <Stack gap={1}>{children}</Stack>
      {footer && (
        <>
          <Divider sx={{ my: 1.5 }} />
          {footer}
        </>
      )}
    </Paper>
  );
}

// ── Cab ───────────────────────────────────────────────────────

export function CabQuotePanel({ customerId, onBook, onIssue }: QuotePanelProps) {
  const [meta, setMeta] = useState<CabBookingMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [cityId, setCityId] = useState<number | "">("");
  const [tripType, setTripType] = useState("LOCAL");
  const [vehicleId, setVehicleId] = useState<number | "">("");
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [pickupAt, setPickupAt] = useState(() => localDateTime(new Date(Date.now() + 2 * 3600_000)));
  const [returnAt, setReturnAt] = useState("");
  const [quote, setQuote] = useState<CabBookingQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    customerCareService.getCabMeta()
      .then(data => {
        setMeta(data);
        if (data.cities[0]) setCityId(data.cities[0].id);
        if (data.vehicle_categories[0]) setVehicleId(data.vehicle_categories[0].id);
        const enabled = data.trip_types?.filter(t => t.enabled).map(t => t.code) ?? [];
        if (enabled[0]) setTripType(enabled[0]);
      })
      .catch(e => setError(apiErrorMessage(e, "Could not load cab pricing data.")))
      .finally(() => setMetaLoading(false));
  }, []);

  useEffect(() => {
    setQuote(null);
    setError("");
  }, [cityId, tripType, vehicleId, pickup, drop, pickupAt, returnAt]);

  const tripTypes = meta?.trip_types?.filter(t => t.enabled) ?? [];
  const roundTrip = tripType === "ROUND_TRIP";

  async function getQuote() {
    if (!cityId || !vehicleId) { setError("Choose a city and vehicle first."); return; }
    if (pickup.trim().length < 3 || drop.trim().length < 3) {
      setError("Enter both pickup and drop locations.");
      return;
    }
    if (!pickupAt) { setError("Choose a pickup date and time."); return; }
    if (roundTrip && !returnAt) { setError("Choose a return date and time for the round trip."); return; }
    setLoading(true);
    setError("");
    try {
      const result = await customerCareService.quoteCabBooking({
        city_id: Number(cityId),
        vehicle_category_id: Number(vehicleId),
        trip_type: tripType,
        pickup_location: pickup.trim(),
        drop_location: drop.trim(),
        pickup_datetime: new Date(pickupAt).toISOString(),
        return_datetime: roundTrip && returnAt ? new Date(returnAt).toISOString() : null,
        customer_id: customerId,
      });
      setQuote(result);
    } catch (e: any) {
      setQuote(null);
      setError(apiErrorMessage(e, "Could not price this cab trip."));
    } finally {
      setLoading(false);
    }
  }

  if (metaLoading) return <Box sx={{ display: "grid", placeItems: "center", py: 6 }}><CircularProgress /></Box>;

  return (
    <Stack gap={2}>
      <Alert severity="info" icon={<DirectionsCar />} sx={{ borderRadius: 2.5 }}>
        Get the live per-km cab price with the customer on the call. Continue to the
        cab desk only when they are ready to book.
      </Alert>

      {error && <Alert severity="error" onClose={() => setError("")} sx={{ borderRadius: 2 }}>{error}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            select fullWidth size="small" label="City"
            value={cityId}
            onChange={e => setCityId(Number(e.target.value))}
          >
            {(meta?.cities ?? []).map(city => (
              <MenuItem key={city.id} value={city.id}>{city.name}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            select fullWidth size="small" label="Trip type"
            value={tripType}
            onChange={e => setTripType(e.target.value)}
          >
            {tripTypes.map(type => (
              <MenuItem key={type.code} value={type.code}>{type.code.replace(/_/g, " ")}</MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            select fullWidth size="small" label="Vehicle"
            value={vehicleId}
            onChange={e => setVehicleId(Number(e.target.value))}
          >
            {(meta?.vehicle_categories ?? []).map(category => (
              <MenuItem key={category.id} value={category.id}>
                {category.category_name}{category.seating_capacity ? ` · ${category.seating_capacity} seats` : ""}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth size="small" type="datetime-local" label="Pickup"
            value={pickupAt} onChange={e => setPickupAt(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth size="small" label="Pickup location"
            value={pickup} onChange={e => setPickup(e.target.value)}
            placeholder="e.g. Bhubaneswar Airport"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth size="small" label="Drop location"
            value={drop} onChange={e => setDrop(e.target.value)}
            placeholder="e.g. Cuttack Bus Stand"
          />
        </Grid>
        {roundTrip && (
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth size="small" type="datetime-local" label="Return"
              value={returnAt} onChange={e => setReturnAt(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        )}
      </Grid>

      <Button
        variant="outlined"
        startIcon={loading ? <CircularProgress size={15} /> : <Refresh />}
        onClick={getQuote}
        disabled={loading}
        sx={{ alignSelf: "flex-start", borderRadius: 2, textTransform: "none", fontWeight: 700 }}
      >
        Get cab price
      </Button>

      {quote && (
        <QuoteCard
          title={`${meta?.vehicle_categories.find(v => v.id === vehicleId)?.category_name ?? "Cab"} · ${tripType.replace(/_/g, " ")}`}
          subtitle={`${num(quote.distance_km).toLocaleString("en-IN", { maximumFractionDigits: 1 })} km · ${num(quote.billable_km).toLocaleString("en-IN", { maximumFractionDigits: 1 })} billable km`}
        >
          <PriceLine label="Base fare" value={money(quote.base_fare)} />
          <PriceLine label="Distance charge" value={money(quote.distance_charge)} />
          <PriceLine label="Driver allowance" value={money(quote.driver_allowance)} />
          <PriceLine label="Night charge" value={money(quote.night_charge)} />
          <PriceLine label="Toll" value={money(quote.toll)} />
          <PriceLine label="Waiting" value={money(quote.waiting)} />
          <Divider />
          <PriceLine label="Estimated total" value={money(quote.total)} strong />
          {quote.notes?.length > 0 && (
            <Alert severity="info" sx={{ mt: 0.5, borderRadius: 2, py: 0.25 }}>
              {quote.notes.map(note => (
                <Typography key={note} variant="caption" display="block">{note}</Typography>
              ))}
            </Alert>
          )}
          <QuoteActions
            bookLabel="Continue to cab booking"
            ready
            onBook={onBook}
            onIssue={onIssue}
          />
        </QuoteCard>
      )}
    </Stack>
  );
}

// ── Tour ──────────────────────────────────────────────────────

export function TourQuotePanel({ customerId, onBook, onIssue }: QuotePanelProps) {
  const [packages, setPackages] = useState<TourPackage[]>([]);
  const [packageId, setPackageId] = useState<number | "">("");
  const [pax, setPax] = useState(2);
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    tourService.getCustomerCareMeta(customerId)
      .then(data => {
        setPackages(data.packages ?? []);
        if (data.packages?.[0]) setPackageId(data.packages[0].id);
      })
      .catch(e => setError(apiErrorMessage(e, "Could not load tour packages.")))
      .finally(() => setLoading(false));
  }, [customerId]);

  const selected = useMemo(
    () => packages.find(pkg => pkg.id === packageId) ?? null,
    [packages, packageId],
  );

  useEffect(() => {
    if (!selected) { setQuote(null); return; }
    let alive = true;
    setQuoteLoading(true);
    setError("");
    tourService.quote(selected.id, pax)
      .then(result => { if (alive) setQuote(result); })
      .catch(e => { if (alive) { setQuote(null); setError(apiErrorMessage(e, "Could not price this tour.")); } })
      .finally(() => { if (alive) setQuoteLoading(false); });
    return () => { alive = false; };
  }, [selected?.id, pax]);

  if (loading) return <Box sx={{ display: "grid", placeItems: "center", py: 6 }}><CircularProgress /></Box>;

  return (
    <Stack gap={2}>
      <Alert severity="info" icon={<TravelExplore />} sx={{ borderRadius: 2.5 }}>
        Show the live package price for the number of travellers. The final travel
        date and participant details are entered on the tour booking page.
      </Alert>

      {error && <Alert severity="error" onClose={() => setError("")} sx={{ borderRadius: 2 }}>{error}</Alert>}

      {packages.length === 0 ? (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          No active tour packages are available. Publish a package first.
        </Alert>
      ) : (
        <>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={8}>
              <TextField
                select fullWidth size="small" label="Tour package"
                value={packageId}
                onChange={e => {
                  const next = Number(e.target.value);
                  setPackageId(next);
                  const pkg = packages.find(p => p.id === next);
                  setPax(Math.max(pkg?.minimum_persons ?? 1, 2));
                }}
              >
                {packages.map(pkg => (
                  <MenuItem key={pkg.id} value={pkg.id}>
                    {pkg.package_name} · {pkg.destination} · {pkg.duration_days}D/{pkg.duration_nights}N
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth size="small" type="number" label="Travellers"
                value={pax}
                onChange={e => setPax(Math.max(1, Number(e.target.value) || 1))}
                inputProps={{ min: 1, max: selected?.maximum_persons ?? 30 }}
              />
            </Grid>
          </Grid>

          {selected && (
            <Box sx={{ p: 1.75, borderRadius: 2.5, bgcolor: alpha("#059669", 0.05), border: "1px solid", borderColor: alpha("#059669", 0.18) }}>
              <Typography fontWeight={800} fontSize={14}>{selected.package_name}</Typography>
              <Stack direction="row" gap={1} flexWrap="wrap" mt={0.5}>
                <Chip size="small" label={selected.destination} />
                <Chip size="small" label={`${selected.duration_days}D/${selected.duration_nights}N`} />
                <Chip size="small" label={`${selected.minimum_persons}–${selected.maximum_persons ?? "∞"} pax`} />
              </Stack>
            </Box>
          )}

          {quoteLoading ? (
            <Box display="flex" alignItems="center" gap={1} py={2}>
              <CircularProgress size={18} /><Typography fontSize={12.5} color="text.secondary">Pricing tour…</Typography>
            </Box>
          ) : quote && (
            <QuoteCard
              title={selected?.package_name ?? "Tour package"}
              subtitle={`${pax} traveller${pax > 1 ? "s" : ""}`}
            >
              <PriceLine label="Package total" value={money(quote.total_amount)} />
              <PriceLine label="Platform commission" value={`${money(quote.platform_commission)} (${quote.commission_percent}%)`} />
              <PriceLine label="Partner payout" value={money(quote.partner_payout)} />
              <Divider />
              <PriceLine label="Customer pays" value={money(quote.total_amount)} strong />
              <QuoteActions
                bookLabel="Continue to tour booking"
                ready={!!quote}
                onBook={onBook}
                onIssue={onIssue}
              />
            </QuoteCard>
          )}
        </>
      )}
    </Stack>
  );
}

// ── Hotel ─────────────────────────────────────────────────────

export function HotelQuotePanel({ onBook, onIssue }: QuotePanelProps) {
  const theme = useTheme();
  const [meta, setMeta] = useState<HotelBookingMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [hotelId, setHotelId] = useState<number | "">("");
  const [roomId, setRoomId] = useState<number | "">("");
  const [checkIn, setCheckIn] = useState(() => format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [checkOut, setCheckOut] = useState(() => format(addDays(new Date(), 2), "yyyy-MM-dd"));
  const [rooms, setRooms] = useState(1);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [quote, setQuote] = useState<HotelBookingQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    customerCareService.getHotelMeta()
      .then(data => {
        setMeta(data);
        const hotel = data.hotels[0];
        if (hotel) {
          setHotelId(hotel.id);
          setRoomId(hotel.room_categories[0]?.id ?? "");
        }
      })
      .catch(e => setError(apiErrorMessage(e, "Could not load hotel pricing data.")))
      .finally(() => setMetaLoading(false));
  }, []);

  useEffect(() => {
    setQuote(null);
    setError("");
  }, [hotelId, roomId, checkIn, checkOut, rooms, adults, children]);

  const selectedHotel = meta?.hotels.find(hotel => hotel.id === hotelId) ?? null;
  const roomsList = selectedHotel?.room_categories ?? [];
  const selectedRoom = roomsList.find(room => room.id === roomId) ?? null;
  const nights = checkIn && checkOut ? differenceInCalendarDays(new Date(checkOut), new Date(checkIn)) : 0;

  async function getQuote() {
    if (!hotelId || !roomId) { setError("Choose a hotel and room first."); return; }
    if (nights < 1) { setError("Check-out must be after check-in."); return; }
    setLoading(true);
    setError("");
    try {
      const result = await customerCareService.getHotelQuote({
        hotel_id: Number(hotelId),
        room_category_id: Number(roomId),
        check_in_date: checkIn,
        check_out_date: checkOut,
        rooms_count: rooms,
        adults_count: adults,
        children_count: children,
      });
      setQuote(result);
    } catch (e: any) {
      setQuote(null);
      setError(apiErrorMessage(e, "Could not price this stay."));
    } finally {
      setLoading(false);
    }
  }

  if (metaLoading) return <Box sx={{ display: "grid", placeItems: "center", py: 6 }}><CircularProgress /></Box>;

  return (
    <Stack gap={2}>
      <Alert severity="info" icon={<HotelIcon />} sx={{ borderRadius: 2.5 }}>
        Price the stay live, including rooms, occupancy and GST. Continue to the
        hotel desk only when the customer is ready to confirm.
      </Alert>

      {error && <Alert severity="error" onClose={() => setError("")} sx={{ borderRadius: 2 }}>{error}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} sm={7}>
          <TextField
            select fullWidth size="small" label="Hotel"
            value={hotelId}
            onChange={e => {
              const next = Number(e.target.value);
              setHotelId(next);
              const hotel = meta?.hotels.find(h => h.id === next);
              setRoomId(hotel?.room_categories[0]?.id ?? "");
            }}
          >
            {(meta?.hotels ?? []).map(hotel => (
              <MenuItem key={hotel.id} value={hotel.id}>
                {hotel.hotel_name}{hotel.city_name ? ` · ${hotel.city_name}` : ""}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={5}>
          <TextField
            select fullWidth size="small" label="Room"
            value={roomId}
            onChange={e => setRoomId(Number(e.target.value))}
            disabled={roomsList.length === 0}
          >
            {roomsList.map(room => (
              <MenuItem key={room.id} value={room.id}>
                {room.category_name} · {room.meal_plan} · {room.max_occupancy} pax
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField
            fullWidth size="small" type="date" label="Check-in"
            value={checkIn} onChange={e => setCheckIn(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField
            fullWidth size="small" type="date" label="Check-out"
            value={checkOut} onChange={e => setCheckOut(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: checkIn }}
          />
        </Grid>
        <Grid item xs={4} sm={2}>
          <TextField
            fullWidth size="small" type="number" label="Rooms"
            value={rooms} onChange={e => setRooms(Math.max(1, Number(e.target.value) || 1))}
            inputProps={{ min: 1, max: 10 }}
          />
        </Grid>
        <Grid item xs={4} sm={2}>
          <TextField
            fullWidth size="small" type="number" label="Adults"
            value={adults} onChange={e => setAdults(Math.max(1, Number(e.target.value) || 1))}
            inputProps={{ min: 1, max: selectedRoom?.max_adults ?? 10 }}
          />
        </Grid>
        <Grid item xs={4} sm={2}>
          <TextField
            fullWidth size="small" type="number" label="Children"
            value={children} onChange={e => setChildren(Math.max(0, Number(e.target.value) || 0))}
            inputProps={{ min: 0, max: selectedRoom?.max_children ?? 10 }}
          />
        </Grid>
      </Grid>

      <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={15} /> : <Refresh />}
          onClick={getQuote}
          disabled={loading}
          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }}
        >
          Get hotel price
        </Button>
        <Typography fontSize={11.5} color="text.secondary">
          {nights > 0 ? `${nights} night${nights > 1 ? "s" : ""} · ${rooms} room${rooms > 1 ? "s" : ""}` : "Choose valid dates"}
        </Typography>
      </Stack>

      {quote && (
        <QuoteCard
          title={quote.hotel_name}
          subtitle={`${quote.room_category_name} · ${quote.nights} night${quote.nights > 1 ? "s" : ""} · ${quote.rooms_count} room${quote.rooms_count > 1 ? "s" : ""}`}
        >
          <PriceLine label="Room charges" value={money(quote.base_amount)} />
          <PriceLine label="Taxable amount" value={money(quote.taxable_amount)} />
          <PriceLine label={`GST (${quote.gst_percent}%)`} value={money(quote.gst_amount)} />
          <PriceLine label="Average nightly" value={money(quote.average_nightly_rate)} />
          <Divider />
          <PriceLine label="Customer pays" value={money(quote.total_amount)} strong />
          <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: alpha(theme.palette.success.main, 0.06) }}>
            <Typography fontSize={11.5} color="text.secondary">
              This is the server quote for the stay. Breakfast/meal plan and extra-bed
              rules come from the selected room category.
            </Typography>
          </Box>
          <QuoteActions
            bookLabel="Continue to hotel booking"
            ready
            onBook={onBook}
            onIssue={onIssue}
          />
        </QuoteCard>
      )}
    </Stack>
  );
}
