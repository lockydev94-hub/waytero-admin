// ============================================================
// WAYTERO ADMIN — CAB BOOKING PAGE (CUSTOMER CARE)
// Route: /customer-care/cab-booking/:customerId
// Features:
//   • Google Maps Places autocomplete (city-biased) when API key active
//   • Map picker modal (click/drag/search on map) for pickup & drop
//   • Fare quoted by the backend (`/cab-booking/quote`) — kilometres,
//     the price sheet in force on the trip day, night charge, toll and
//     waiting are all the server's answer, never typed or mirrored here
//   • Honest coupon suggestions from the same validator that redeems them
// ============================================================
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Stack, Typography, Button, TextField, Select,
  MenuItem, FormControl, InputLabel, CircularProgress,
  Alert, Grid, Paper, Chip, Divider, Stepper, Step,
  StepLabel, alpha, useTheme, IconButton,
  Card, CardContent, Avatar, Radio,
  ToggleButton, ToggleButtonGroup, Dialog, DialogTitle,
  DialogContent, DialogActions, Switch, FormControlLabel,
  Table, TableBody, TableCell, TableHead, TableRow,
} from "@mui/material";
import {
  ArrowBack, DirectionsCar, CheckCircle, LocationOn,
  AccessTime, Info, Calculate, BookOnline,
  AirportShuttle, Route, SwapHoriz, Loop,
  Warning, Verified, Tune, LocalOffer, ErrorOutline,
} from "@mui/icons-material";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { format } from "date-fns";

import {
  customerCareService, CabBookingMeta, CabBookingQuote, CabBookingCreateResult,
  RentalRateCard, RentalQuote, RateClass, CabTripCheck,
} from "../../services/customerCare.service";
import { apiErrorMessage } from "../../utils/apiError";
import { settingsService, ApiIntegration } from "../../services/settings.service";
import LocationAutocomplete from "./components/LocationAutocomplete";
import GoogleMapPickerModal, { PickedLocation } from "./components/GoogleMapPickerModal";

// ── Trip type config ──────────────────────────────────────────
const TRIP_TYPES = [
  { value: "LOCAL",      label: "Local",       icon: <DirectionsCar />,  color: "#3B82F6", desc: "City local trips" },
  { value: "AIRPORT",    label: "Airport",     icon: <AirportShuttle />, color: "#8B5CF6", desc: "Airport pick/drop" },
  { value: "OUTSTATION", label: "Outstation",  icon: <Route />,          color: "#F59E0B", desc: "Inter-city one way" },
  { value: "ONE_WAY",    label: "One Way",     icon: <SwapHoriz />,      color: "#22C55E", desc: "One-way outstation" },
  { value: "ROUND_TRIP", label: "Round Trip",  icon: <Loop />,           color: "#EF4444", desc: "Round trip" },
];

const STEPS = ["Trip Details", "Vehicle & Route", "Confirm & Book"];

// The rate card sells three rental types. The trip-type cards the desk knows are
// kept for the booking record, but a package is quoted on one of these three.
const RENTAL_TYPES = [
  { value: "LOCAL",       label: "Local",       desc: "Same-city hire, fixed hours + km" },
  { value: "OUTSTATION",  label: "Outstation",  desc: "12h / 250km, one side" },
  { value: "DAILY",       label: "Daily",       desc: "12h / 100km per day, driver + halt included" },
];

// A rate-card rental type is sellable while at least one of the trip types it
// prices is enabled in Settings → Cab Booking.
const RENTAL_TYPE_COVERS: Record<string, string[]> = {
  LOCAL: ["LOCAL", "AIRPORT"],
  OUTSTATION: ["OUTSTATION", "ONE_WAY", "ROUND_TRIP"],
  DAILY: ["DAILY"],
};

function rentalTypeForTrip(tripType: string): string {
  return ["OUTSTATION", "ONE_WAY", "ROUND_TRIP"].includes(tripType) ? "OUTSTATION" : "LOCAL";
}

// ── Fare helpers ──────────────────────────────────────────────
// The backend returns Decimal money as JSON strings so nothing gets rounded in
// transit; every figure below is coerced before arithmetic.
const num = (v: number | string | null | undefined): number => Number(v ?? 0);

function distanceSourceLabel(source: string): string {
  switch (source) {
    case "GOOGLE":           return "Google route";
    case "CONFIGURED_ROUTE": return "Configured route";
    case "HAVERSINE":        return "Straight-line estimate";
    default:                 return source;
  }
}

// Single line in the fare breakdown. Right-aligned value, muted label.
function FareLine({ label, value }: { label: string; value: number }) {
  return (
    <Stack direction="row" justifyContent="space-between" gap={1}>
      <Typography fontSize={11.5} color="text.secondary">{label}</Typography>
      <Typography fontSize={11.5} fontWeight={600} color="text.primary">
        ₹{value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </Typography>
    </Stack>
  );
}

// ── Location state ─────────────────────────────────────────────
interface LocationState {
  address: string;
  lat: number | null;
  lng: number | null;
}
const EMPTY_LOC: LocationState = { address: "", lat: null, lng: null };

// ── Maps status type ──────────────────────────────────────────
// "idle"    = not yet checked
// "loading" = script loading
// "ok"      = script loaded AND API calls working
// "billing" = script loaded but billing/auth error on actual API call
// "error"   = script failed to load entirely
type MapsStatus = "idle" | "loading" | "ok" | "billing" | "error";

// ── Google Maps script loader (singleton) ─────────────────────
declare global { interface Window { google: any; _gmapsLoaded?: boolean; _gmapsCallbacks?: (() => void)[]; } }

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) { resolve(); return; }
    if (window._gmapsLoaded === false) {
      (window._gmapsCallbacks ??= []).push(resolve);
      return;
    }
    window._gmapsLoaded = false;
    window._gmapsCallbacks = [resolve];
    (window as any).__gmapsReady = () => {
      window._gmapsLoaded = true;
      (window._gmapsCallbacks ?? []).forEach(cb => cb());
      window._gmapsCallbacks = [];
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&callback=__gmapsReady`;
    script.async = true; script.defer = true;
    script.onerror = () => reject(new Error("script_load_failed"));
    document.head.appendChild(script);
  });
}

// ── Probe: test if Maps API actually works (billing check) ─────
// We do a tiny geocode request. If billing is disabled Google returns
// REQUEST_DENIED or OVER_DAILY_LIMIT instead of OK/ZERO_RESULTS.
function probeMapsApi(): Promise<"ok" | "billing"> {
  return new Promise((resolve) => {
    if (!window.google?.maps?.Geocoder) { resolve("billing"); return; }
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: "India" }, (_: any, status: string) => {
      // OK or ZERO_RESULTS = API is working
      // REQUEST_DENIED / OVER_DAILY_LIMIT / UNKNOWN_ERROR = billing issue
      if (status === "OK" || status === "ZERO_RESULTS") {
        resolve("ok");
      } else {
        resolve("billing");
      }
    });
  });
}

// ── Main Component ─────────────────────────────────────────────
export default function CabBookingPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();

  // ── UI state
  const [step, setStep]           = useState(0);
  const [meta, setMeta]           = useState<CabBookingMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState<CabBookingCreateResult | null>(null);

  // ── Maps API
  const [mapsApiKey, setMapsApiKey] = useState<string>("");
  const [mapsStatus, setMapsStatus] = useState<MapsStatus>("idle");
  // Derived helper
  const mapsOk = mapsStatus === "ok";

  // ── Form — Step 1
  const [cityId,   setCityId]   = useState<number | "">("");
  const [tripType, setTripType] = useState("");
  // PACKAGE prices from the rate card (the platform default); PER_KM is the
  // older distance engine. Package is the default because it is what the
  // supplier sheet sells and what the customer is told down the phone.
  const [pricingMode, setPricingMode] = useState<"PER_KM" | "PACKAGE">("PACKAGE");

  // ── Form — Step 2
  const [vcatId,   setVcatId]   = useState<number | "">("");
  const [pickup,   setPickup]   = useState<LocationState>(EMPTY_LOC);
  const [drop,     setDrop]     = useState<LocationState>(EMPTY_LOC);
  // Places the car visits between pickup and drop. Each is its own leg of the
  // journey, so the quote the customer hears includes them.
  const [stops,    setStops]    = useState<string[]>([]);
  const [newStop,  setNewStop]  = useState("");
  // The server's verdict on whether this trip type matches these places.
  const [tripCheck, setTripCheck] = useState<CabTripCheck | null>(null);
  const [tripCheckLoading, setTripCheckLoading] = useState(false);
  const [pickupDt, setPickupDt] = useState<Date | null>(null);
  const [returnDt, setReturnDt] = useState<Date | null>(null);
  const [quote, setQuote]       = useState<CabBookingQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError]     = useState("");
  const [couponCode, setCouponCode]     = useState("");
  const quoteSeq = useRef(0);
  const [remarks, setRemarks]   = useState("");

  // ── Package pricing state
  const [rateCard, setRateCard] = useState<RentalRateCard | null>(null);
  const [rateCardError, setRateCardError] = useState("");
  const [rateClass, setRateClass] = useState("");
  const [rentalType, setRentalType] = useState("LOCAL");
  const [dutyHours, setDutyHours] = useState<number | "">("");
  const [dutyKm, setDutyKm] = useState<number | "">("");
  const [pkgDays, setPkgDays] = useState<number>(1);
  const [afterMidnight, setAfterMidnight] = useState(false);
  const [rentalQuote, setRentalQuote] = useState<RentalQuote | null>(null);
  // Custom-price dialog: the admin agrees one package price for this customer.
  const [customOpen, setCustomOpen] = useState(false);
  const [customPrice, setCustomPrice] = useState("");
  const [customExtraHour, setCustomExtraHour] = useState("");
  const [customExtraKm, setCustomExtraKm] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [customSaving, setCustomSaving] = useState(false);
  const [customError, setCustomError] = useState("");

  // ── Modal
  const [pickupMapOpen, setPickupMapOpen] = useState(false);
  const [dropMapOpen,   setDropMapOpen]   = useState(false);

  // ── Load API integrations on mount ────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const integrations: ApiIntegration[] = await (settingsService as any).getApiIntegrations();
        const maps = integrations.find(
          (i) => i.service_type === "GOOGLE_MAPS" && i.is_active && i.configuration?.api_key
        );
        if (!maps?.configuration?.api_key) return; // no key → stay in manual mode

        const key = maps.configuration.api_key.trim();
        setMapsApiKey(key);
        setMapsStatus("loading");

        try {
          await loadGoogleMapsScript(key);
          // Script loaded — now probe whether billing/auth actually works
          const probeResult = await probeMapsApi();
          setMapsStatus(probeResult); // "ok" or "billing"
        } catch {
          setMapsStatus("error");
        }
      } catch {
        // Failed to fetch integrations — stay in manual mode silently
      }
    })();
  }, []);

  // ── Load cab meta ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const data = await customerCareService.getCabMeta();
        setMeta(data);
        if (data.cities.length === 1) setCityId(data.cities[0].id);
      } catch { setError("Failed to load booking metadata."); }
      finally { setMetaLoading(false); }
    })();
  }, []);

  // ── Reload pricing when city changes ─────────────────────────
  useEffect(() => {
    if (!cityId) return;
    (async () => {
      try {
        const data = await customerCareService.getCabMeta(Number(cityId));
        setMeta(prev => prev ? { ...prev, pricing: data.pricing } : data);
      } catch {}
    })();
  }, [cityId]);

  // ── Any change to the trip voids the quote ────────────────────
  // A quote is the server's answer about a specific pair of places, a specific
  // cab and a specific time. Editing any of them makes the number stale, so the
  // panel goes blank rather than showing a fare for a trip nobody is booking.
  useEffect(() => {
    quoteSeq.current += 1;
    setQuote(null);
    setQuoteError("");
    setRentalQuote(null);
    setCouponCode("");
  }, [cityId, tripType, vcatId, pickup.address, drop.address, pickupDt, returnDt, stops]);

  // ── Trip-type guard ────────────────────────────────────────────
  // "Local, Bhubaneswar to Puri" is not a local trip, and the desk must hear
  // that before quoting it. The same check gates create-booking server-side,
  // so this is the visible half of one rule, not a second opinion.
  useEffect(() => {
    if (!tripType || !pickup.address) { setTripCheck(null); return; }
    const handle = window.setTimeout(() => {
      setTripCheckLoading(true);
      customerCareService
        .checkCabTrip({
          trip_type: tripType,
          pickup: { name: pickup.address, latitude: pickup.lat, longitude: pickup.lng },
          drop: drop.address
            ? { name: drop.address, latitude: drop.lat, longitude: drop.lng }
            : null,
          stops: stops.map(name => ({ name })),
          pickup_datetime: pickupDt?.toISOString(),
          return_datetime: returnDt?.toISOString(),
        })
        .then(res => setTripCheck(res.data))
        .catch(() => setTripCheck(null))
        .finally(() => setTripCheckLoading(false));
    }, 450);
    return () => window.clearTimeout(handle);
  }, [tripType, pickup.address, pickup.lat, pickup.lng, drop.address, drop.lat, drop.lng, stops, pickupDt, returnDt]);

  // ── Rate card for the city, with this customer's agreed prices ────────
  // `customer_id` is what makes the panel able to show "your price" beside the
  // card price; without it the card is just the card.
  useEffect(() => {
    if (!cityId) { setRateCard(null); return; }
    let alive = true;
    customerCareService.getCabRateCard({
      city_id: Number(cityId),
      customer_id: customerId ? parseInt(customerId, 10) : undefined,
    })
      .then(card => { if (alive) { setRateCard(card); setRateCardError(""); } })
      .catch((e: any) => { if (alive) setRateCardError(apiErrorMessage(e, "Could not load the rate card")); });
    return () => { alive = false; };
  }, [cityId, customerId]);

  // A package is quoted on one of the card's three rental types. Follow the trip
  // type until the admin overrides it, so the default is never "the last one".
  useEffect(() => {
    if (pricingMode === "PACKAGE" && tripType) setRentalType(rentalTypeForTrip(tripType));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripType, pricingMode]);

  // Default the duty from the cheapest package of the chosen class + type, so the
  // desk starts from something sellable instead of empty boxes.
  useEffect(() => {
    if (pricingMode !== "PACKAGE" || !rateCard) return;
    const cls = rateCard.classes.find(c => c.vehicle_class === rateClass);
    const pkg = cls?.packages.find(p => p.rental_type === rentalType);
    if (!pkg) return;
    setDutyHours(prev => (prev === "" ? pkg.included_hours : prev));
    setDutyKm(prev => (prev === "" ? pkg.included_km : prev));
  }, [rateCard, rateClass, rentalType, pricingMode]);

  // A city change can leave a class selected that its card does not sell. Clear
  // it rather than quoting a package that no longer exists here.
  useEffect(() => {
    if (!rateCard || !rateClass) return;
    if (!rateCard.classes.some(c => c.vehicle_class === rateClass)) {
      setRateClass(""); setDutyHours(""); setDutyKm("");
    }
  }, [rateCard, rateClass]);

  const selectedClass: RateClass | null =
    rateCard?.classes.find(c => c.vehicle_class === rateClass) ?? null;
  const classPackages = (selectedClass?.packages ?? []).filter(p => p.rental_type === rentalType);

  // Anything that changes the priced trip invalidates the package quote too.
  useEffect(() => { setRentalQuote(null); }, [rateClass, rentalType, dutyHours, dutyKm, pkgDays, afterMidnight]);

  // ── Quote ─────────────────────────────────────────────────────
  async function handleQuote() {
    if (!step2Valid() || !pickupDt) return;
    // The guard already told the agent this type cannot be right for these
    // places. Quoting it would only produce a fare for the wrong product.
    if ((tripCheck?.errors.length ?? 0) > 0) {
      setQuoteError(tripCheck!.errors[0]);
      return;
    }
    const seq = ++quoteSeq.current;
    setQuoteLoading(true);
    setQuoteError("");
    try {
      if (pricingMode === "PACKAGE") {
        const rq = await customerCareService.quoteRentalBooking({
          city_id: Number(cityId),
          customer_id: customerId ? parseInt(customerId, 10) : null,
          vehicle_class: rateClass,
          rental_type: rentalType,
          hours: Number(dutyHours || 0),
          km: Number(dutyKm || 0),
          days: rentalType === "DAILY" ? Math.max(1, pkgDays) : 1,
          returned_after_midnight: afterMidnight,
          pickup_datetime: pickupDt.toISOString(),
        });
        if (seq === quoteSeq.current) setRentalQuote(rq);
        return;
      }
      const q = await customerCareService.quoteCabBooking({
        city_id: Number(cityId),
        vehicle_category_id: Number(vcatId),
        trip_type: tripType,
        pickup_location: pickup.address.trim(),
        drop_location: drop.address.trim(),
        stops: stops.map(name => ({ name })),
        pickup_datetime: pickupDt.toISOString(),
        return_datetime: tripType === "ROUND_TRIP" && returnDt ? returnDt.toISOString() : null,
        customer_id: customerId ? parseInt(customerId, 10) : null,
      });
      if (seq === quoteSeq.current) setQuote(q);
    } catch (e: any) {
      if (seq === quoteSeq.current) setQuoteError(apiErrorMessage(e, "Could not quote this trip"));
    } finally {
      if (seq === quoteSeq.current) setQuoteLoading(false);
    }
  }

  // The admin's switches decide which products this desk may sell. The
  // backend enforces the same list; filtering here keeps the agent from
  // filling a form that can only end in a rejection.
  const enabledTripCodes = meta?.trip_types?.length
    ? new Set(meta.trip_types.filter(t => t.enabled).map(t => t.code))
    : null;
  const availableTripTypes = TRIP_TYPES.filter(
    tt => !enabledTripCodes || enabledTripCodes.has(tt.value),
  );
  const rentalTypeAvailable = (value: string) =>
    !enabledTripCodes ||
    (RENTAL_TYPE_COVERS[value] ?? []).some(code => enabledTripCodes.has(code));
  const availableRentalTypes = RENTAL_TYPES.filter(rt =>
    rentalTypeAvailable(rt.value),
  );

  const selectedVcat = meta?.vehicle_categories.find(v => v.id === vcatId);
  const selectedCity = meta?.cities.find(c => c.id === cityId);
  const selectedTrip = TRIP_TYPES.find(t => t.value === tripType);

  const selectedCoupon = quote?.coupons.find(c => c.coupon_code === couponCode) ?? null;
  const quoteTotal = quote ? num(quote.total) : null;
  const packageTotal = rentalQuote ? num(rentalQuote.total) : null;
  const standardTotal = rentalQuote ? num(rentalQuote.standard.total) : null;
  const hasCustomPrice = !!rentalQuote?.custom_applied;
  const payableAmount = selectedCoupon
    ? num(selectedCoupon.final_amount)
    : pricingMode === "PACKAGE" ? packageTotal : quoteTotal;

  // If the admin disables the selected product (or all types in a package
  // group), clear the stale choice instead of submitting a disabled booking.
  useEffect(() => {
    if (!meta?.trip_types?.length) return;
    const enabled = new Set(
      meta.trip_types.filter(t => t.enabled).map(t => t.code),
    );
    if (tripType && !enabled.has(tripType)) {
      setTripType("");
      setStep(0);
    }
    if (
      rentalType &&
      !(RENTAL_TYPE_COVERS[rentalType] ?? []).some(code => enabled.has(code))
    ) {
      const fallback = RENTAL_TYPES.find(rt =>
        (RENTAL_TYPE_COVERS[rt.value] ?? []).some(code => enabled.has(code)),
      );
      setRentalType(fallback?.value ?? "");
    }
  }, [meta, tripType, rentalType]);

  // ── Step validation ───────────────────────────────────────────
  function step1Valid() { return cityId !== "" && tripType !== ""; }
  function packageReady() {
    return !!rateClass && !!rentalType && Number(dutyHours) > 0 && Number(dutyKm) > 0;
  }
  function step2Valid() {
    if (!pickup.address.trim() || !drop.address.trim() || !pickupDt) return false;
    return pricingMode === "PACKAGE" ? packageReady() : vcatId !== "";
  }
  // A package quote carries blocking reasons; the booking button stays shut while
  // any exist, because the server would refuse it anyway.
  const quoteBookable = pricingMode === "PACKAGE"
    ? !!rentalQuote && rentalQuote.can_book
    : !!quote;
  const packageErrors = rentalQuote
    ? rentalQuote.validations.filter(v => v.severity === "ERROR")
    : [];

  // ── Agree a customer price for the quoted package ─────────────
  async function handleCustomSave() {
    if (!rentalQuote || !customerId) return;
    const anyPrice = customPrice || customExtraHour || customExtraKm;
    if (!anyPrice) { setCustomError("Set at least one price."); return; }
    setCustomSaving(true); setCustomError("");
    try {
      await customerCareService.createCustomQuote({
        customer_id: parseInt(customerId, 10),
        city_id: Number(cityId),
        vehicle_class: rentalQuote.vehicle_class,
        rental_type: rentalQuote.rental_type,
        included_hours: rentalQuote.package.included_hours,
        package_price: customPrice || null,
        extra_hour_rate: customExtraHour || null,
        extra_km_rate: customExtraKm || null,
        reason: customReason || null,
      });
      setCustomOpen(false);
      setCustomPrice(""); setCustomExtraHour(""); setCustomExtraKm(""); setCustomReason("");
      // Re-quote from the server so the discount on screen is the one stored.
      await handleQuote();
    } catch (e: any) {
      setCustomError(apiErrorMessage(e, "Could not save the customer price"));
    } finally { setCustomSaving(false); }
  }

  // ── Map pick handlers ─────────────────────────────────────────
  const handlePickupMapConfirm = useCallback((loc: PickedLocation) => {
    setPickup({ address: loc.address, lat: loc.lat, lng: loc.lng });
  }, []);

  const handleDropMapConfirm = useCallback((loc: PickedLocation) => {
    setDrop({ address: loc.address, lat: loc.lat, lng: loc.lng });
  }, []);

  // ── Submit ────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!customerId || !cityId || !tripType || !pickup.address || !drop.address || !pickupDt) return;
    if ((tripCheck?.errors.length ?? 0) > 0) {
      setError(tripCheck!.errors[0]);
      setStep(1);
      return;
    }
    if (pricingMode === "PACKAGE" ? !rentalQuote?.can_book : !quote || !vcatId) return;
    setSubmitting(true); setError("");
    try {
      const result = await customerCareService.createCabBooking({
        customer_id: parseInt(customerId, 10),
        city_id: Number(cityId),
        trip_type: pricingMode === "PACKAGE" ? rentalType : tripType,
        pricing_mode: pricingMode,
        ...(pricingMode === "PACKAGE"
          ? {
              vehicle_class: rateClass,
              hours: Number(dutyHours || 0),
              km: Number(dutyKm || 0),
              days: rentalType === "DAILY" ? Math.max(1, pkgDays) : 1,
              returned_after_midnight: afterMidnight,
            }
          : { vehicle_category_id: Number(vcatId) }),
        pickup_location: pickup.address.trim(),
        pickup_latitude:  pickup.lat   ?? undefined,
        pickup_longitude: pickup.lng   ?? undefined,
        drop_location: drop.address.trim(),
        drop_latitude:  drop.lat   ?? undefined,
        drop_longitude: drop.lng   ?? undefined,
        stops: stops.map(name => ({ name })),
        pickup_datetime: pickupDt.toISOString(),
        return_datetime: tripType === "ROUND_TRIP" && returnDt ? returnDt.toISOString() : null,
        coupon_code: selectedCoupon?.coupon_code ?? null,
        remarks: remarks || undefined,
      });
      setSuccess(result);
      setStep(3);
    } catch (e: any) {
      setError(apiErrorMessage(e, "Failed to create booking"));
    } finally { setSubmitting(false); }
  }

  // ── Success screen ────────────────────────────────────────────
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
        <Typography variant="h5" fontWeight={800} mb={1}>Booking Created Successfully!</Typography>
        <Typography color="text.secondary" mb={3}>
          Cab booking created on behalf of Customer #{customerId}.
        </Typography>
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mb: 3, textAlign: "left" }}>
          <Stack gap={1.5}>
            {[
              ["Booking Number", <Typography fontWeight={800} fontFamily="monospace" color="primary.main">{success.booking_number}</Typography>],
              ["City", selectedCity?.name],
              ["Trip Type", selectedTrip?.label],
              ["Vehicle", selectedVcat?.category_name],
              ["Pickup", pickup.address],
              ["Drop", drop.address],
              ["Scheduled", pickupDt ? format(pickupDt, "dd MMM yyyy, hh:mm aa") : "—"],
              ["Distance", `${num(success.distance_km).toLocaleString("en-IN", { maximumFractionDigits: 1 })} km · ${distanceSourceLabel(success.distance_source)}`],
              ["Estimated Fare", <Typography fontWeight={700}>₹{num(success.estimated_amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Typography>],
              num(success.coupon_discount) > 0 && ["Coupon Discount", <Typography fontWeight={700} color="warning.main">− ₹{num(success.coupon_discount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Typography>],
              ["Payable", <Typography fontWeight={800} color="success.main">₹{num(success.payable_amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Typography>],
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
        {success.notes?.length > 0 && (
          <Alert severity="info" sx={{ mb: 3, borderRadius: 2, textAlign: "left" }}>
            {success.notes.map((n, i) => (
              <Typography key={i} variant="caption" display="block">{n}</Typography>
            ))}
          </Alert>
        )}
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

  // ── Main layout ───────────────────────────────────────────────
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
            <Typography variant="h6" fontWeight={800}>Create Cab Booking</Typography>
            <Typography variant="caption" color="text.secondary">
              Customer Care → Cab Booking · Customer ID: #{customerId}
            </Typography>
          </Box>
          <Stack direction="row" gap={1} ml="auto" alignItems="center">
            {mapsApiKey && mapsStatus !== "idle" && (() => {
              const chipMap: Record<MapsStatus, { label: string; color: any; icon: any }> = {
                idle:    { label: "Maps",         color: "default",  icon: <CircularProgress size={10} /> },
                loading: { label: "Maps Loading", color: "default",  icon: <CircularProgress size={10} /> },
                ok:      { label: "Maps Active",  color: "success",  icon: <Verified sx={{ fontSize: "14px !important" }} /> },
                billing: { label: "Maps: Billing Issue", color: "warning", icon: <Warning sx={{ fontSize: "14px !important" }} /> },
                error:   { label: "Maps: Load Error",    color: "error",   icon: <Warning sx={{ fontSize: "14px !important" }} /> },
              };
              const c = chipMap[mapsStatus];
              return (
                <Chip icon={c.icon} label={c.label} size="small"
                  color={c.color} variant="outlined"
                  sx={{ fontWeight: 600 }} />
              );
            })()}
            <Chip icon={<DirectionsCar sx={{ fontSize: "14px !important" }} />} label="CAB" size="small"
              sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.1), color: "primary.main" }} />
          </Stack>
        </Stack>

        {/* Coming soon notice */}
        <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2.5 }} icon={<Info />}>
          <strong>Tour bookings</strong> via Customer Care are <strong>coming soon</strong>.
          Cab and Hotel bookings can be created here today.
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
        ) : (
          <>
            {/* ══════════════════════════════════════════════════
                STEP 0 — Trip Details
            ══════════════════════════════════════════════════ */}
            {step === 0 && (
              <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 3 }}>
                <Stack direction="row" alignItems="center" gap={1} mb={3}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <AccessTime sx={{ color: "primary.main", fontSize: 20 }} />
                  </Box>
                  <Typography fontWeight={700} fontSize={15}>Select City & Trip Type</Typography>
                </Stack>

                {/* City selector */}
                <FormControl fullWidth size="small" sx={{ mb: 3 }}>
                  <InputLabel>City *</InputLabel>
                  <Select
                    value={cityId}
                    onChange={e => { setCityId(Number(e.target.value)); setPickup(EMPTY_LOC); setDrop(EMPTY_LOC); }}
                    label="City *"
                    sx={{ borderRadius: 2 }}
                  >
                    {meta?.cities.map(c => (
                      <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Pricing mode — which sheet answers */}
                <Typography fontWeight={600} fontSize={12} color="text.secondary" mb={1} letterSpacing={0.5}>
                  PRICING
                </Typography>
                <ToggleButtonGroup
                  value={pricingMode}
                  exclusive
                  onChange={(_e, v) => { if (v) setPricingMode(v); }}
                  size="small"
                  sx={{ mb: 3, "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 700, px: 2.5 } }}
                >
                  <ToggleButton value="PACKAGE">
                    <LocalOffer sx={{ fontSize: 18, mr: 1 }} /> Package rate card
                  </ToggleButton>
                  <ToggleButton value="PER_KM">
                    <Route sx={{ fontSize: 18, mr: 1 }} /> Per-km quote
                  </ToggleButton>
                </ToggleButtonGroup>
                <Typography variant="caption" color="text.secondary" display="block" mt={-2} mb={3}>
                  {pricingMode === "PACKAGE"
                    ? "Priced from the supplier rate card: fixed hours + kilometres, with overflow at the class's extra-hour and extra-km rates."
                    : "Priced by distance: base fare + per-km rate + the sheet's allowances. Legacy mode, kept for trips the card does not cover."}
                </Typography>

                {/* Trip type cards */}
                <Typography fontWeight={600} fontSize={12} color="text.secondary" mb={1.5} letterSpacing={0.5}>
                  TRIP TYPE *
                </Typography>
                {availableTripTypes.length === 0 && (
                  <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                    No cab booking types are enabled. An administrator can turn
                    them on in Settings → Cab Booking.
                  </Alert>
                )}
                <Grid container spacing={1.5}>
                  {availableTripTypes.map(tt => (
                    <Grid item xs={6} sm={4} lg={2.4} key={tt.value}>
                      <Card
                        variant="outlined"
                        onClick={() => setTripType(tt.value)}
                        sx={{
                          borderRadius: 2.5, cursor: "pointer", transition: "all 0.15s ease",
                          borderColor: tripType === tt.value ? tt.color : "divider",
                          borderWidth: tripType === tt.value ? 2 : 1,
                          bgcolor: tripType === tt.value ? alpha(tt.color, 0.07) : "background.paper",
                          "&:hover": { borderColor: tt.color, boxShadow: 3, transform: "translateY(-1px)" },
                        }}
                      >
                        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 }, textAlign: "center" }}>
                          <Box sx={{
                            color: tripType === tt.value ? tt.color : "text.secondary",
                            mb: 0.75, "& svg": { fontSize: 28 }, transition: "color 0.15s",
                          }}>
                            {tt.icon}
                          </Box>
                          <Typography fontWeight={700} fontSize={12.5} color={tripType === tt.value ? tt.color : "text.primary"}>
                            {tt.label}
                          </Typography>
                          <Typography fontSize={11} color="text.secondary">{tt.desc}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>

                <Box mt={3} display="flex" justifyContent="flex-end">
                  <Button
                    variant="contained" disabled={!step1Valid()}
                    onClick={() => setStep(1)}
                    sx={{
                      borderRadius: 2, textTransform: "none", fontWeight: 700, px: 3.5,
                      background: step1Valid()
                        ? `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`
                        : undefined,
                    }}
                  >
                    Next: Vehicle & Route →
                  </Button>
                </Box>
              </Paper>
            )}

            {/* ══════════════════════════════════════════════════
                STEP 1 — Vehicle & Route
            ══════════════════════════════════════════════════ */}
            {step === 1 && (
              <Stack gap={2.5}>
                {/* ── Package panel: class, rental type, package, duty ── */}
                {pricingMode === "PACKAGE" && (
                  <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 3 }}>
                    <Stack direction="row" alignItems="center" gap={1} mb={2.5}>
                      <Box sx={{
                        width: 36, height: 36, borderRadius: 2,
                        bgcolor: alpha("#F59E0B", 0.12),
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <LocalOffer sx={{ color: "#F59E0B", fontSize: 20 }} />
                      </Box>
                      <Box flex={1}>
                        <Typography fontWeight={700} fontSize={15}>Package & Vehicle Class</Typography>
                        <Typography fontSize={11.5} color="text.secondary">
                          Prices come from the rate card{rateCard?.classes.some(c => c.rate_source === "PLATFORM") ? " (platform default where this city has none)" : " for this city"}.
                        </Typography>
                      </Box>
                    </Stack>

                    {rateCardError && (
                      <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{rateCardError}</Alert>
                    )}

                    {/* Rental type */}
                    <Typography fontWeight={600} fontSize={12} color="text.secondary" mb={1} letterSpacing={0.5}>
                      RENTAL TYPE *
                    </Typography>
                    {availableRentalTypes.length === 0 && (
                      <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                        Package pricing has no enabled cab type to sell. Turn one
                        on in Settings → Cab Booking or use Per-km quote.
                      </Alert>
                    )}
                    <Grid container spacing={1} mb={2.5}>
                      {availableRentalTypes.map(rt => {
                        const active = rentalType === rt.value;
                        return (
                          <Grid item xs={12} sm={4} key={rt.value}>
                            <Paper
                              variant="outlined"
                              onClick={() => { setRentalType(rt.value); setDutyHours(""); setDutyKm(""); setPkgDays(1); }}
                              sx={{
                                p: 1.5, borderRadius: 2, cursor: "pointer",
                                borderColor: active ? "#F59E0B" : "divider",
                                borderWidth: active ? 2 : 1,
                                bgcolor: active ? alpha("#F59E0B", 0.06) : "background.paper",
                              }}
                            >
                              <Typography fontWeight={700} fontSize={12.5}>{rt.label}</Typography>
                              <Typography fontSize={11} color="text.secondary">{rt.desc}</Typography>
                            </Paper>
                          </Grid>
                        );
                      })}
                    </Grid>

                    {/* Vehicle class */}
                    <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
                      <InputLabel>Vehicle class *</InputLabel>
                      <Select
                        value={rateClass}
                        onChange={e => { setRateClass(String(e.target.value)); setDutyHours(""); setDutyKm(""); }}
                        label="Vehicle class *"
                        sx={{ borderRadius: 2 }}
                      >
                        {(rateCard?.classes ?? []).map(c => {
                          const p = c.packages.find(x => x.rental_type === rentalType);
                          return (
                            <MenuItem key={c.vehicle_class} value={c.vehicle_class}>
                              <Stack direction="row" justifyContent="space-between" width="100%" gap={2}>
                                <span>{c.label}{c.seating_capacity ? ` · ${c.seating_capacity} seats` : ""}</span>
                                <span style={{ color: "#6B7280" }}>
                                  {p ? `₹${num(p.price).toLocaleString("en-IN")}` : `no ${rentalType.toLowerCase()} rate`}
                                </span>
                              </Stack>
                            </MenuItem>
                          );
                        })}
                      </Select>
                    </FormControl>

                    {rateClass && (
                      <>
                        {/* Package chooser — clicking a package sets the duty */}
                        <Typography fontWeight={600} fontSize={12} color="text.secondary" mb={1} letterSpacing={0.5}>
                          PACKAGE
                        </Typography>
                        <Stack direction="row" gap={1} flexWrap="wrap" mb={2.5}>
                          {classPackages.map(p => {
                            const active = Number(dutyHours) === p.included_hours && Number(dutyKm) === p.included_km;
                            return (
                              <Paper
                                key={p.rate_id}
                                variant="outlined"
                                onClick={() => { setDutyHours(p.included_hours); setDutyKm(p.included_km); }}
                                sx={{
                                  px: 1.5, py: 1, borderRadius: 2, cursor: "pointer",
                                  borderColor: active ? "#22C55E" : "divider",
                                  borderWidth: active ? 2 : 1,
                                  bgcolor: active ? alpha("#22C55E", 0.06) : "background.paper",
                                }}
                              >
                                <Typography fontSize={12.5} fontWeight={700}>
                                  {p.included_hours}h / {p.included_km}km
                                </Typography>
                                <Typography fontSize={11.5} color={active ? "#16A34A" : "text.secondary"}>
                                  ₹{num(p.price).toLocaleString("en-IN")}
                                </Typography>
                                {p.custom?.applies && (
                                  <Chip
                                    size="small"
                                    label={`Agreed ₹${num(p.custom.package_price ?? p.price).toLocaleString("en-IN")}`}
                                    sx={{ mt: 0.5, height: 18, fontSize: 10, fontWeight: 700, bgcolor: alpha("#6366F1", 0.12), color: "#4F46E5" }}
                                  />
                                )}
                              </Paper>
                            );
                          })}
                        </Stack>

                        {/* Duty the customer described */}
                        <Grid container spacing={2}>
                          <Grid item xs={6} sm={3}>
                            <TextField
                              label={rentalType === "DAILY" ? "Hours per day" : "Duty hours"}
                              type="number" size="small" fullWidth
                              value={dutyHours}
                              onChange={e => setDutyHours(e.target.value === "" ? "" : Number(e.target.value))}
                              inputProps={{ min: 0, step: 1 }}
                            />
                          </Grid>
                          <Grid item xs={6} sm={3}>
                            <TextField
                              label={rentalType === "DAILY" ? "Km per day" : "Duty km"}
                              type="number" size="small" fullWidth
                              value={dutyKm}
                              onChange={e => setDutyKm(e.target.value === "" ? "" : Number(e.target.value))}
                              inputProps={{ min: 0, step: 1 }}
                            />
                          </Grid>
                          {rentalType === "DAILY" && (
                            <Grid item xs={6} sm={2}>
                              <TextField
                                label="Days" type="number" size="small" fullWidth
                                value={pkgDays}
                                onChange={e => setPkgDays(Math.max(1, Number(e.target.value) || 1))}
                                inputProps={{ min: 1, max: 30 }}
                              />
                            </Grid>
                          )}
                          {rentalType === "OUTSTATION" && (
                            <Grid item xs={12} sm={4} display="flex" alignItems="center">
                              <FormControlLabel
                                control={<Switch checked={afterMidnight} onChange={e => setAfterMidnight(e.target.checked)} size="small" />}
                                label={<Typography fontSize={12}>Returns after midnight</Typography>}
                              />
                            </Grid>
                          )}
                        </Grid>
                      </>
                    )}
                  </Paper>
                )}

                {/* ── Vehicle selection panel ── */}
                {pricingMode === "PER_KM" && (
                <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 3 }}>
                  <Stack direction="row" alignItems="center" gap={1} mb={2.5}>
                    <Box sx={{
                      width: 36, height: 36, borderRadius: 2,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <DirectionsCar sx={{ color: "primary.main", fontSize: 20 }} />
                    </Box>
                    <Typography fontWeight={700} fontSize={15}>Choose Vehicle</Typography>
                    <Chip label={selectedTrip?.label ?? ""} size="small"
                      sx={{ ml: 1, fontWeight: 600, bgcolor: alpha(selectedTrip?.color ?? "#6366F1", 0.1),
                        color: selectedTrip?.color ?? "primary.main" }} />
                  </Stack>

                  <Grid container spacing={1.5}>
                    {meta?.vehicle_categories.map(vc => {
                      const pricing = meta.pricing[String(vc.id)]?.[tripType];
                      const isSelected = vcatId === vc.id;
                      return (
                        <Grid item xs={12} sm={6} key={vc.id}>
                          <Card
                            variant="outlined"
                            onClick={() => setVcatId(vc.id)}
                            sx={{
                              borderRadius: 2.5, cursor: "pointer", transition: "all 0.15s",
                              borderColor: isSelected ? theme.palette.primary.main : "divider",
                              borderWidth: isSelected ? 2 : 1,
                              bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.04) : "background.paper",
                              "&:hover": { boxShadow: 3, transform: "translateY(-1px)" },
                            }}
                          >
                            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                              <Stack direction="row" alignItems="center" gap={1.5}>
                                {vc.icon_url || vc.image_url ? (
                                  <Avatar src={vc.icon_url || vc.image_url || ""} variant="rounded"
                                    sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: "transparent" }} />
                                ) : (
                                  <Avatar sx={{
                                    bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.15) : alpha("#6366F1", 0.08),
                                    color: isSelected ? "primary.main" : "text.secondary",
                                    width: 44, height: 44, borderRadius: 2,
                                  }}>
                                    <DirectionsCar />
                                  </Avatar>
                                )}
                                <Box flex={1} minWidth={0}>
                                  <Typography fontWeight={700} fontSize={13.5} noWrap>{vc.category_name}</Typography>
                                  <Typography fontSize={12} color="text.secondary">
                                    {vc.seating_capacity ? `${vc.seating_capacity} seats` : "Standard"}
                                  </Typography>
                                </Box>
                                {pricing ? (
                                  <Box textAlign="right" flexShrink={0}>
                                    <Typography fontWeight={800} fontSize={14} color={isSelected ? "primary.main" : "text.primary"}>
                                      ₹{pricing.base_fare.toLocaleString()}
                                    </Typography>
                                    <Typography fontSize={11} color="text.secondary">
                                      +₹{pricing.per_km_rate}/km
                                    </Typography>
                                  </Box>
                                ) : (
                                  <Chip label="No pricing" size="small" variant="outlined" color="warning"
                                    sx={{ fontSize: 10 }} />
                                )}
                              </Stack>
                            </CardContent>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Paper>
                )}

                {/* ── Route & schedule panel ── */}
                <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 3 }}>
                  <Stack direction="row" alignItems="center" gap={1} mb={2.5}>
                    <Box sx={{
                      width: 36, height: 36, borderRadius: 2,
                      bgcolor: alpha("#22C55E", 0.1),
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Route sx={{ color: "#22C55E", fontSize: 20 }} />
                    </Box>
                    <Box>
                      <Typography fontWeight={700} fontSize={15}>Route & Schedule</Typography>
                      {(!mapsApiKey || mapsStatus === "billing" || mapsStatus === "error") && (
                        <Typography fontSize={11} color="warning.main" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Warning sx={{ fontSize: 12 }} /> Google Maps not configured — manual entry mode
                        </Typography>
                      )}
                    </Box>
                  </Stack>

                  <Stack gap={2.5}>
                    {/* Pickup location */}
                    <Box>
                      <Typography fontWeight={600} fontSize={12} color="text.secondary" mb={1} letterSpacing={0.5}>
                        PICKUP LOCATION *
                      </Typography>
                      <LocationAutocomplete
                        label="Pickup Location"
                        value={pickup.address}
                        onChange={(val) => setPickup(prev => ({ ...prev, address: val, lat: null, lng: null }))}
                        onCoordinates={(lat, lng, address) => setPickup({ address, lat, lng })}
                        onMapPickClick={mapsOk ? () => setPickupMapOpen(true) : undefined}
                        apiKey={mapsApiKey}
                        cityName={selectedCity?.name}
                        markerColor="green"
                        required
                        placeholder="Enter or search pickup address…"
                      />
                      {pickup.lat && pickup.lng && (
                        <Stack direction="row" alignItems="center" gap={0.5} mt={0.5}>
                          <Verified sx={{ fontSize: 12, color: "success.main" }} />
                          <Typography fontSize={11} color="success.main">
                            Location pinned · {pickup.lat.toFixed(5)}, {pickup.lng.toFixed(5)}
                          </Typography>
                        </Stack>
                      )}
                    </Box>

                    {/* Drop location */}
                    <Box>
                      <Typography fontWeight={600} fontSize={12} color="text.secondary" mb={1} letterSpacing={0.5}>
                        DROP LOCATION *
                      </Typography>
                      <LocationAutocomplete
                        label="Drop Location"
                        value={drop.address}
                        onChange={(val) => setDrop(prev => ({ ...prev, address: val, lat: null, lng: null }))}
                        onCoordinates={(lat, lng, address) => setDrop({ address, lat, lng })}
                        onMapPickClick={mapsOk ? () => setDropMapOpen(true) : undefined}
                        apiKey={mapsApiKey}
                        cityName={selectedCity?.name}
                        markerColor="red"
                        required
                        placeholder="Enter or search drop address…"
                      />
                      {drop.lat && drop.lng && (
                        <Stack direction="row" alignItems="center" gap={0.5} mt={0.5}>
                          <Verified sx={{ fontSize: 12, color: "success.main" }} />
                          <Typography fontSize={11} color="success.main">
                            Location pinned · {drop.lat.toFixed(5)}, {drop.lng.toFixed(5)}
                          </Typography>
                        </Stack>
                      )}
                    </Box>

                    {/* Stops — places visited on the way */}
                    <Box>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                        <Typography fontWeight={600} fontSize={12} color="text.secondary" letterSpacing={0.5}>
                          STOPS{tripCheckLoading ? " …" : ""}
                        </Typography>
                        <Typography fontSize={10.5} color="text.secondary">
                          Each stop adds its own kilometres
                        </Typography>
                      </Stack>
                      {stops.length > 0 && (
                        <Stack gap={1} mb={1}>
                          {stops.map((s, i) => (
                            <Stack key={`${s}-${i}`} direction="row" alignItems="center" gap={1}>
                              <Typography fontSize={11} fontWeight={700} color="text.secondary" sx={{ width: 16 }}>
                                {i + 1}
                              </Typography>
                              <TextField
                                size="small" fullWidth value={s}
                                onChange={e => setStops(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                              />
                              <IconButton size="small" onClick={() => setStops(prev => prev.filter((_, j) => j !== i))}>
                                <ErrorOutline fontSize="small" sx={{ color: "error.main", transform: "rotate(45deg)" }} />
                              </IconButton>
                            </Stack>
                          ))}
                        </Stack>
                      )}
                      <Stack direction="row" gap={1}>
                        <TextField
                          size="small" fullWidth value={newStop}
                          onChange={e => setNewStop(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && newStop.trim()) {
                              e.preventDefault();
                              setStops(prev => [...prev, newStop.trim()]);
                              setNewStop("");
                            }
                          }}
                          placeholder="e.g. Konark"
                          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                        />
                        <Button
                          variant="outlined"
                          disabled={!newStop.trim()}
                          onClick={() => {
                            if (!newStop.trim()) return;
                            setStops(prev => [...prev, newStop.trim()]);
                            setNewStop("");
                          }}
                          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700, whiteSpace: "nowrap" }}
                        >
                          Add stop
                        </Button>
                      </Stack>
                      {tripCheck && (
                        <Alert
                          severity={tripCheck.errors.length ? "error" : "info"}
                          sx={{ mt: 1.5, borderRadius: 2 }}
                          action={
                            tripCheck.detected_type && tripCheck.detected_type !== tripType ? (
                              <Button
                                color="inherit" size="small"
                                onClick={() => setTripType(tripCheck.detected_type!)}
                                sx={{ textTransform: "none", fontWeight: 700 }}
                              >
                                Use {tripCheck.detected_type.replace("_", " ")}
                              </Button>
                            ) : undefined
                          }
                        >
                          <Typography fontSize={12} fontWeight={tripCheck.errors.length ? 600 : 400}>
                            {tripCheck.errors[0]
                              ?? (tripCheck.cities.length
                                ? `Route: ${tripCheck.cities.join(" → ")}`
                                : "Route not placed in a city yet.")}
                          </Typography>
                          {tripCheck.duration.minutes != null && (
                            <Typography fontSize={11} color="text.secondary">
                              Approx {Math.floor(tripCheck.duration.minutes / 60)}h{" "}
                              {String(tripCheck.duration.minutes % 60).padStart(2, "0")}m drive
                              {tripCheck.distance_km != null ? ` over ${tripCheck.distance_km} km` : ""}
                            </Typography>
                          )}
                          {!(tripCheck.errors.length) && [...tripCheck.warnings, ...tripCheck.hints].slice(0, 2).map(m => (
                            <Typography key={m} fontSize={11} color="text.secondary">{m}</Typography>
                          ))}
                        </Alert>
                      )}
                    </Box>

                    {/* Pickup datetime */}
                    <DateTimePicker
                      label="Pickup Date & Time *"
                      value={pickupDt}
                      onChange={v => setPickupDt(v)}
                      slotProps={{
                        textField: {
                          size: "small", fullWidth: true,
                          sx: { "& .MuiOutlinedInput-root": { borderRadius: 2 } },
                        },
                      }}
                    />

                    {/* Return datetime — round trips only; drives PER_DAY allowance */}
                    {tripType === "ROUND_TRIP" && (
                      <DateTimePicker
                        label="Return Date & Time"
                        value={returnDt}
                        onChange={v => setReturnDt(v)}
                        minDateTime={pickupDt ?? undefined}
                        slotProps={{
                          textField: {
                            size: "small", fullWidth: true,
                            helperText: "Used for the day count when the fare sheet charges per day",
                            sx: { "& .MuiOutlinedInput-root": { borderRadius: 2 } },
                          },
                        }}
                      />
                    )}

                    {/* Quote action */}
                    <Box>
                      <Button
                        variant="outlined"
                        onClick={handleQuote}
                        disabled={!step2Valid() || quoteLoading || (tripCheck?.errors.length ?? 0) > 0}
                        startIcon={quoteLoading ? <CircularProgress size={16} /> : <Calculate />}
                        sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }}
                      >
                        {quoteLoading ? "Calculating…" : quote ? "Recalculate Fare" : "Get Fare"}
                      </Button>
                      <Typography variant="caption" color="text.secondary" display="block" mt={0.75}>
                        The fare is calculated by the server from these places and the price
                        sheet in force on the trip day — kilometres, night charge and toll included.
                      </Typography>
                      {quoteError && (
                        <Alert severity="error" sx={{ mt: 1.5, borderRadius: 2 }}>
                          {quoteError}
                        </Alert>
                      )}
                    </Box>
                  </Stack>

                  {/* ── Package quote panel: card price vs customer price ── */}
                  {pricingMode === "PACKAGE" && rentalQuote && (
                    <Box sx={{
                      mt: 2.5, p: 2.5, borderRadius: 2.5,
                      background: `linear-gradient(135deg, ${alpha("#22C55E", 0.06)}, ${alpha("#16A34A", 0.04)})`,
                      border: "1px solid", borderColor: alpha("#22C55E", 0.25),
                    }}>
                      <Stack direction="row" alignItems="flex-start" gap={2} mb={1.5}>
                        <Box sx={{
                          width: 44, height: 44, borderRadius: 2,
                          bgcolor: alpha("#22C55E", 0.15),
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                          <Calculate sx={{ color: "#22C55E", fontSize: 22 }} />
                        </Box>
                        <Box flex={1}>
                          <Typography fontSize={12} fontWeight={600} color="text.secondary">
                            {hasCustomPrice ? "CUSTOMER PRICE" : "PACKAGE PRICE"}
                          </Typography>
                          <Stack direction="row" alignItems="baseline" gap={1} flexWrap="wrap">
                            <Typography fontWeight={900} fontSize={28} color="#22C55E" lineHeight={1}>
                              ₹{packageTotal!.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                            </Typography>
                            <Typography fontSize={12} color="text.secondary">
                              {rentalQuote.vehicle_label} · {rentalQuote.package.included_hours}h / {rentalQuote.package.included_km}km
                              {rentalQuote.package.days > 1 ? ` × ${rentalQuote.package.days} days` : ""}
                              {" · "}{rentalQuote.rate_source === "CITY" ? "city rate card" : "platform rate card"}
                            </Typography>
                          </Stack>
                          {hasCustomPrice && standardTotal != null && (
                            <Stack direction="row" alignItems="center" gap={0.75} mt={0.5}>
                              <Typography fontSize={12} color="text.secondary" sx={{ textDecoration: "line-through" }}>
                                ₹{standardTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })} standard
                              </Typography>
                              <Chip
                                size="small"
                                label={packageTotal! < standardTotal
                                  ? `₹${(standardTotal - packageTotal!).toLocaleString("en-IN", { maximumFractionDigits: 2 })} below card`
                                  : `₹${(packageTotal! - standardTotal).toLocaleString("en-IN", { maximumFractionDigits: 2 })} above card`}
                                sx={{ height: 20, fontSize: 10.5, fontWeight: 700, bgcolor: alpha("#6366F1", 0.12), color: "#4F46E5" }}
                              />
                            </Stack>
                          )}
                        </Box>
                        <Button
                          size="small" variant="outlined" startIcon={<Tune />}
                          onClick={() => {
                            setCustomPrice(rentalQuote.custom_quote?.package_price != null
                              ? String(rentalQuote.custom_quote.package_price) : "");
                            setCustomExtraHour(rentalQuote.custom_quote?.extra_hour_rate != null
                              ? String(rentalQuote.custom_quote.extra_hour_rate) : "");
                            setCustomExtraKm(rentalQuote.custom_quote?.extra_km_rate != null
                              ? String(rentalQuote.custom_quote.extra_km_rate) : "");
                            setCustomReason(rentalQuote.custom_quote?.reason ?? "");
                            setCustomError("");
                            setCustomOpen(true);
                          }}
                          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700, flexShrink: 0 }}
                        >
                          {hasCustomPrice ? "Edit agreed price" : "Set customer price"}
                        </Button>
                      </Stack>

                      {/* Card vs customer, line by line */}
                      <Table size="small" sx={{ bgcolor: "transparent", "& td, & th": { borderColor: alpha("#22C55E", 0.18), py: 0.5 } }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ pl: 0, fontSize: 11, fontWeight: 700 }}>Line</TableCell>
                            <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700 }}>Rate card</TableCell>
                            <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700 }}>
                              {hasCustomPrice ? "Customer" : "Applied"}
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rentalQuote.lines.map(line => (
                            <TableRow key={line.label}>
                              <TableCell sx={{ pl: 0, fontSize: 12, color: line.label === "Total" ? "text.primary" : "text.secondary", fontWeight: line.label === "Total" ? 800 : 400 }}>
                                {line.label}
                              </TableCell>
                              <TableCell align="right" sx={{
                                fontSize: 12,
                                color: "text.secondary",
                                textDecoration: line.changed ? "line-through" : "none",
                              }}>
                                ₹{num(line.standard).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell align="right" sx={{ fontSize: 12, fontWeight: line.changed || line.label === "Total" ? 800 : 500, color: line.changed ? "#4F46E5" : "text.primary" }}>
                                ₹{num(line.applied).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      <Stack gap={0.75} mt={1.5}>
                        {rentalQuote.validations.map(v => (
                          <Box key={v.code + v.message} sx={{ display: "flex", gap: 0.75, alignItems: "flex-start" }}>
                            {v.severity === "ERROR" ? (
                              <ErrorOutline sx={{ fontSize: 14, color: "error.main", mt: "2px" }} />
                            ) : v.severity === "WARNING" ? (
                              <Warning sx={{ fontSize: 14, color: "warning.main", mt: "2px" }} />
                            ) : (
                              <Info sx={{ fontSize: 14, color: "text.disabled", mt: "2px" }} />
                            )}
                            <Typography
                              fontSize={11.5}
                              color={v.severity === "ERROR" ? "error.main" : v.severity === "WARNING" ? "warning.dark" : "text.secondary"}
                            >
                              {v.message}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>

                      {rentalQuote.custom_quote && !rentalQuote.custom_applied && (
                        <Typography fontSize={11} color="warning.main" mt={1}>
                          Agreed price on file is not valid for this trip date; the rate card applies.
                        </Typography>
                      )}
                    </Box>
                  )}

                  {/* ── Quoted fare card ── */}
                  {pricingMode === "PER_KM" && quote && (
                    <Box sx={{
                      mt: 2.5, p: 2.5, borderRadius: 2.5,
                      background: `linear-gradient(135deg, ${alpha("#22C55E", 0.06)}, ${alpha("#16A34A", 0.04)})`,
                      border: "1px solid", borderColor: alpha("#22C55E", 0.25),
                    }}>
                      <Stack direction="row" alignItems="flex-start" gap={2}>
                        <Box sx={{
                          width: 44, height: 44, borderRadius: 2,
                          bgcolor: alpha("#22C55E", 0.15),
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                          <Calculate sx={{ color: "#22C55E", fontSize: 22 }} />
                        </Box>
                        <Box flex={1}>
                          <Typography fontSize={12} fontWeight={600} color="text.secondary" mb={0.25}>
                            QUOTED FARE
                          </Typography>
                          <Stack direction="row" alignItems="baseline" gap={1} flexWrap="wrap">
                            <Typography fontWeight={900} fontSize={28} color="#22C55E" lineHeight={1}>
                              ₹{quoteTotal!.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                            </Typography>
                            <Typography fontSize={12} color="text.secondary">
                              {num(quote.distance_km).toLocaleString("en-IN", { maximumFractionDigits: 1 })} km ·{" "}
                              {distanceSourceLabel(quote.distance_source)}
                            </Typography>
                          </Stack>
                          <Stack gap={0.25} mt={1}>
                            {num(quote.base_fare) !== 0 && (
                              <FareLine label="Base fare" value={num(quote.base_fare)} />
                            )}
                            {num(quote.distance_charge) !== 0 && (
                              <FareLine
                                label={`Distance charge (${num(quote.billable_km).toLocaleString("en-IN", { maximumFractionDigits: 1 })} km)`}
                                value={num(quote.distance_charge)}
                              />
                            )}
                            {num(quote.driver_allowance) !== 0 && (
                              <FareLine label="Driver allowance" value={num(quote.driver_allowance)} />
                            )}
                            {num(quote.night_charge) !== 0 && (
                              <FareLine label="Night charge" value={num(quote.night_charge)} />
                            )}
                            {num(quote.toll) !== 0 && (
                              <FareLine label="Toll" value={num(quote.toll)} />
                            )}
                            {num(quote.waiting) !== 0 && (
                              <FareLine label="Waiting" value={num(quote.waiting)} />
                            )}
                          </Stack>
                          {quote.notes?.length > 0 && (
                            <Alert severity="warning" sx={{ mt: 1.5, py: 0.25, borderRadius: 2 }}>
                              {quote.notes.map((n, i) => (
                                <Typography key={i} variant="caption" display="block">{n}</Typography>
                              ))}
                            </Alert>
                          )}
                        </Box>
                        <Box textAlign="right" flexShrink={0}>
                          <Typography fontSize={11} color="text.secondary">Vehicle</Typography>
                          <Typography fontSize={13} fontWeight={700}>{selectedVcat?.category_name}</Typography>
                        </Box>
                      </Stack>

                      {quote.coupons?.length > 0 && (
                        <Box mt={2}>
                          <Typography variant="caption" fontWeight={700} color="text.secondary"
                            sx={{ textTransform: "uppercase", letterSpacing: 0.7 }}>
                            Coupons this customer can use
                          </Typography>
                          <Stack gap={0.75} mt={0.75}>
                            {quote.coupons.map(c => {
                              const selected = couponCode === c.coupon_code;
                              return (
                                <Paper
                                  key={c.coupon_id}
                                  variant="outlined"
                                  onClick={() => setCouponCode(selected ? "" : c.coupon_code)}
                                  sx={{
                                    p: 1.25, borderRadius: 2, cursor: "pointer",
                                    borderColor: selected ? "warning.main" : "divider",
                                    borderWidth: selected ? 2 : 1,
                                  }}
                                >
                                  <Stack direction="row" alignItems="center" gap={1}>
                                    <Radio checked={selected} size="small" />
                                    <Box flex={1}>
                                      <Typography fontSize={12.5} fontWeight={700}>
                                        {c.coupon_code} · {c.title}
                                      </Typography>
                                      <Typography fontSize={11} color="text.secondary">
                                        Saves ₹{num(c.discount_amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                        {" "}· customer pays ₹{num(c.final_amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                        {c.partner_funded ? " · partner-funded" : ""}
                                      </Typography>
                                    </Box>
                                  </Stack>
                                </Paper>
                              );
                            })}
                          </Stack>
                          <Typography variant="caption" color="text.disabled" display="block" mt={0.75}>
                            Suggested by the same validator that redeems the code; the discount is
                            re-checked when the booking is created.
                          </Typography>
                        </Box>
                      )}

                      <Divider sx={{ my: 1.5 }} />
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography fontSize={12.5} fontWeight={700}>Customer pays</Typography>
                        <Typography fontSize={16} fontWeight={900} color="success.main">
                          ₹{(payableAmount ?? quoteTotal!).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </Typography>
                      </Stack>
                    </Box>
                  )}

                  <Stack direction="row" gap={1.5} mt={3} justifyContent="space-between" alignItems="center">
                    <Button variant="outlined" onClick={() => setStep(0)}
                      sx={{ borderRadius: 2, textTransform: "none" }}>
                      ← Back
                    </Button>
                    <Stack alignItems="flex-end" gap={0.5}>
                      <Button variant="contained" disabled={!step2Valid() || !quoteBookable} onClick={() => setStep(2)}
                        sx={{
                          borderRadius: 2, textTransform: "none", fontWeight: 700, px: 3.5,
                          background: step2Valid() && quoteBookable
                            ? `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`
                            : undefined,
                        }}>
                        Review Booking →
                      </Button>
                      {!quoteBookable && step2Valid() && (
                        <Typography variant="caption" color={pricingMode === "PACKAGE" && packageErrors.length ? "error.main" : "text.secondary"}>
                          {pricingMode === "PACKAGE" && packageErrors.length
                            ? "Fix the errors above before booking."
                            : "Get the fare above to review this booking."}
                        </Typography>
                      )}
                    </Stack>
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

                {/* Summary table */}
                <Stack gap={0} mb={3}>
                  {[
                    ["City",         selectedCity?.name],
                    ["Trip Type",    selectedTrip?.label],
                    ["Pricing",      pricingMode === "PACKAGE" ? "Package rate card" : "Per-km quote"],
                    pricingMode === "PACKAGE"
                      ? ["Vehicle class", selectedClass?.label ?? rateClass]
                      : ["Vehicle", selectedVcat?.category_name],
                    ["Pickup",       pickup.address],
                    pickup.lat ? ["Pickup Coords", `${pickup.lat.toFixed(5)}, ${pickup.lng!.toFixed(5)}`] : null,
                    ["Drop",         drop.address],
                    drop.lat ? ["Drop Coords", `${drop.lat.toFixed(5)}, ${drop.lng!.toFixed(5)}`] : null,
                    ["Date & Time",  pickupDt ? format(pickupDt, "dd MMM yyyy, hh:mm aa") : "—"],
                    tripType === "ROUND_TRIP" && returnDt
                      ? ["Return", format(returnDt, "dd MMM yyyy, hh:mm aa")]
                      : null,
                    pricingMode === "PER_KM" && quote
                      ? ["Distance", `${num(quote.distance_km).toLocaleString("en-IN", { maximumFractionDigits: 1 })} km · ${distanceSourceLabel(quote.distance_source)}`]
                      : null,
                    pricingMode === "PACKAGE" && rentalQuote
                      ? ["Package", `${rentalQuote.package.included_hours}h / ${rentalQuote.package.included_km}km${rentalQuote.package.days > 1 ? ` × ${rentalQuote.package.days} days` : ""} · duty ${num(rentalQuote.hours)}h / ${num(rentalQuote.km)}km`]
                      : null,
                    pricingMode === "PER_KM" && quote
                      ? ["Quoted Fare", `₹${num(quote.total).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`]
                      : null,
                    pricingMode === "PACKAGE" && rentalQuote
                      ? ["Rate card price", `₹${num(rentalQuote.standard.total).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`]
                      : null,
                    pricingMode === "PACKAGE" && rentalQuote?.custom_applied
                      ? ["Customer price", `₹${num(rentalQuote.applied.total).toLocaleString("en-IN", { maximumFractionDigits: 2 })} · agreed${rentalQuote.custom_quote?.reason ? ` — ${rentalQuote.custom_quote.reason}` : ""}`]
                      : null,
                    selectedCoupon
                      ? ["Coupon", `${selectedCoupon.coupon_code} · − ₹${num(selectedCoupon.discount_amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`]
                      : null,
                    payableAmount != null
                      ? ["Customer Pays", `₹${payableAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`]
                      : null,
                  ].filter(Boolean).map((row: any, i) => (
                    <Stack key={i} direction="row" justifyContent="space-between" alignItems="flex-start"
                      py={1.25} sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                      <Typography fontSize={13} color="text.secondary" flexShrink={0} mr={2}>{row[0]}</Typography>
                      <Typography fontSize={13} fontWeight={600} textAlign="right" maxWidth={360}
                        sx={{ wordBreak: "break-word" }}>{row[1] || "—"}</Typography>
                    </Stack>
                  ))}
                </Stack>

                {/* Remarks */}
                <TextField
                  label="Admin Remarks (Optional)"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  fullWidth size="small" multiline rows={2}
                  placeholder="Any special instructions or notes for this booking…"
                  sx={{ mb: 3, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                />

                <Stack direction="row" gap={1.5} justifyContent="space-between">
                  <Button variant="outlined" onClick={() => setStep(1)}
                    sx={{ borderRadius: 2, textTransform: "none" }}>
                    ← Back
                  </Button>
                  <Button
                    variant="contained" onClick={handleSubmit} disabled={submitting}
                    startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <BookOnline />}
                    sx={{
                      borderRadius: 2, textTransform: "none", fontWeight: 700, px: 3.5,
                      background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
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

      {/* ── Agreed customer price dialog ────────────────────── */}
      <Dialog open={customOpen} onClose={() => setCustomOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>
          Agreed price for this customer
        </DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            {rentalQuote?.vehicle_label} · {rentalQuote?.rental_type} {rentalQuote?.package.included_hours}h / {rentalQuote?.package.included_km}km.
            Leave a field blank to keep the rate-card value; the booking will store both prices.
          </Typography>
          <Stack gap={2}>
            <TextField
              label="Package price (₹)" type="number" size="small" fullWidth
              value={customPrice} onChange={e => setCustomPrice(e.target.value)}
              helperText={rentalQuote ? `Rate card: ₹${num(rentalQuote.standard.package_price).toLocaleString("en-IN")}` : undefined}
            />
            <TextField
              label="Extra hour rate (₹)" type="number" size="small" fullWidth
              value={customExtraHour} onChange={e => setCustomExtraHour(e.target.value)}
              helperText={rentalQuote ? `Rate card: ₹${num(rentalQuote.standard.extra_hour_rate).toLocaleString("en-IN")}/hour` : undefined}
            />
            <TextField
              label="Extra km rate (₹)" type="number" size="small" fullWidth
              value={customExtraKm} onChange={e => setCustomExtraKm(e.target.value)}
              helperText={rentalQuote ? `Rate card: ₹${num(rentalQuote.standard.extra_km_rate).toLocaleString("en-IN")}/km` : undefined}
            />
            <TextField
              label="Reason / reference" size="small" fullWidth
              value={customReason} onChange={e => setCustomReason(e.target.value)}
              placeholder="e.g. Annual contract, corporate account"
            />
            {customError && <Alert severity="error" sx={{ borderRadius: 2 }}>{customError}</Alert>}
            <Alert severity="info" sx={{ borderRadius: 2, py: 0.5 }}>
              <Typography variant="caption">
                Applies to this package only, for this customer. The rate card stays the
                standard and the difference is shown on every quote and stored on the booking.
              </Typography>
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCustomOpen(false)} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained" onClick={handleCustomSave} disabled={customSaving}
            startIcon={customSaving ? <CircularProgress size={16} color="inherit" /> : <LocalOffer />}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
          >
            {customSaving ? "Saving…" : "Save agreed price"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Map Picker Modals ───────────────────────────────── */}
      {mapsOk && (
        <>
          <GoogleMapPickerModal
            open={pickupMapOpen}
            onClose={() => setPickupMapOpen(false)}
            onConfirm={handlePickupMapConfirm}
            title="Set Pickup Location"
            apiKey={mapsApiKey}
            cityName={selectedCity?.name}
            initialLat={pickup.lat ?? undefined}
            initialLng={pickup.lng ?? undefined}
            markerColor="green"
          />
          <GoogleMapPickerModal
            open={dropMapOpen}
            onClose={() => setDropMapOpen(false)}
            onConfirm={handleDropMapConfirm}
            title="Set Drop Location"
            apiKey={mapsApiKey}
            cityName={selectedCity?.name}
            initialLat={drop.lat ?? undefined}
            initialLng={drop.lng ?? undefined}
            markerColor="red"
          />
        </>
      )}
    </LocalizationProvider>
  );
}
