// ============================================================
// WAYTERO ADMIN — CAB BOOKING PAGE (CUSTOMER CARE)
// Route: /customer-care/cab-booking/:customerId
// Features:
//   • Google Maps Places autocomplete (city-biased) when API key active
//   • Map picker modal (click/drag/search on map) for pickup & drop
//   • Distance Matrix auto-fill via Google Maps
//   • Fallback to manual text input when Maps not configured
//   • Dynamic fare estimate using effective pricing rules
// ============================================================
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Stack, Typography, Button, TextField, Select,
  MenuItem, FormControl, InputLabel, CircularProgress,
  Alert, Grid, Paper, Chip, Divider, Stepper, Step,
  StepLabel, alpha, useTheme, IconButton, Tooltip,
  Card, CardContent, Avatar, Badge,
} from "@mui/material";
import {
  ArrowBack, DirectionsCar, CheckCircle, LocationOn,
  AccessTime, Info, Calculate, BookOnline,
  AirportShuttle, Route, SwapHoriz, Loop,
  MyLocation, Warning, Verified,
} from "@mui/icons-material";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { format } from "date-fns";

import { customerCareService, CabBookingMeta } from "../../services/customerCare.service";
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

// ── Fare helper ───────────────────────────────────────────────
// MIRRORS: Backend/app/modules/booking/services/fare.py — keep in sync.
// Both sides agree on base + max(0, dist − min_km) × per_km_rate + driver_allowance
// + night_charge (22:00–06:00 Asia/Kolkata).
const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR   = 6;

interface PricingRule {
  base_fare: number;
  per_km_rate: number;
  minimum_km: number;
  driver_allowance: number;
  night_charge: number;
}

function isNightTrip(startDt?: Date | null, endDt?: Date | null): boolean {
  if (!startDt || !endDt) return false;
  // Compare in the user's local time. The helper stays in sync with the
  // backend by using hour-of-day checks only.
  const startHour = startDt.getHours();
  const endHour = endDt.getHours();
  const inWindow = (h: number) =>
    h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR;
  return inWindow(startHour) || inWindow(endHour);
}

function computeFareBreakdown(
  rule: PricingRule,
  distKm: number,
  startDt?: Date | null,
  endDt?: Date | null,
): { base: number; distance: number; allowance: number; night: number; total: number } {
  const safeKm = Math.max(0, distKm);
  const extraKm = Math.max(0, safeKm - (rule.minimum_km ?? 0));
  const base = rule.base_fare ?? 0;
  const distance = extraKm * (rule.per_km_rate ?? 0);
  const allowance = rule.driver_allowance ?? 0;
  const night = isNightTrip(startDt, endDt) ? (rule.night_charge ?? 0) : 0;
  const total = Math.round((base + distance + allowance + night) * 100) / 100;
  return {
    base,
    distance: Math.round(distance * 100) / 100,
    allowance,
    night,
    total,
  };
}

function computeFare(rule: PricingRule, distKm: number, startDt?: Date | null, endDt?: Date | null): number {
  return computeFareBreakdown(rule, distKm, startDt, endDt).total;
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

// ── Distance Matrix via Google Maps JS API ─────────────────────
async function computeDrivingDistance(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<number | null> {
  return new Promise((resolve) => {
    if (!window.google?.maps?.DistanceMatrixService) { resolve(null); return; }
    const svc = new window.google.maps.DistanceMatrixService();
    svc.getDistanceMatrix(
      {
        origins: [origin],
        destinations: [destination],
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.METRIC,
      },
      (response: any, status: string) => {
        if (status !== "OK") { resolve(null); return; }
        const elem = response?.rows?.[0]?.elements?.[0];
        if (elem?.status === "OK" && elem?.distance?.value) {
          resolve(Math.round(elem.distance.value / 100) / 10); // metres → km (1 dp)
        } else {
          resolve(null);
        }
      }
    );
  });
}

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
  const [success, setSuccess]     = useState<{ booking_number: string; estimated_amount: number } | null>(null);

  // ── Maps API
  const [mapsApiKey, setMapsApiKey] = useState<string>("");
  const [mapsStatus, setMapsStatus] = useState<MapsStatus>("idle");
  // Derived helpers
  const mapsOk      = mapsStatus === "ok";
  const mapsLoading = mapsStatus === "loading";

  // ── Form — Step 1
  const [cityId,   setCityId]   = useState<number | "">("");
  const [tripType, setTripType] = useState("");

  // ── Form — Step 2
  const [vcatId,   setVcatId]   = useState<number | "">("");
  const [pickup,   setPickup]   = useState<LocationState>(EMPTY_LOC);
  const [drop,     setDrop]     = useState<LocationState>(EMPTY_LOC);
  const [pickupDt, setPickupDt] = useState<Date | null>(null);
  const [distance, setDistance] = useState<string>("");
  const [distanceAuto, setDistanceAuto] = useState(false); // true = auto-computed
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [remarks, setRemarks]   = useState("");

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

  // ── Auto-compute distance when both coords available ──────────
  useEffect(() => {
    if (!mapsOk || !pickup.lat || !pickup.lng || !drop.lat || !drop.lng) return;
    (async () => {
      setDistanceLoading(true);
      try {
        const km = await computeDrivingDistance(
          { lat: pickup.lat!, lng: pickup.lng! },
          { lat: drop.lat!, lng: drop.lng! }
        );
        if (km !== null) {
          setDistance(String(km));
          setDistanceAuto(true);
        }
      } catch {} finally { setDistanceLoading(false); }
    })();
  }, [mapsOk, pickup.lat, pickup.lng, drop.lat, drop.lng]);

  // ── Estimated amount ──────────────────────────────────────────
  const estimatedAmount = (() => {
    if (!meta || !vcatId || !tripType || !distance) return null;
    const pricing = meta.pricing[String(vcatId)]?.[tripType];
    if (!pricing) return null;
    const actualDist = parseFloat(distance) || 0;
    // MIRRORS backend calculate_fare — see fare.py.
    return computeFare(pricing, actualDist, pickupDt, pickupDt);
  })();

  const selectedVcat = meta?.vehicle_categories.find(v => v.id === vcatId);
  const selectedCity = meta?.cities.find(c => c.id === cityId);
  const selectedTrip = TRIP_TYPES.find(t => t.value === tripType);

  // ── Step validation ───────────────────────────────────────────
  function step1Valid() { return cityId !== "" && tripType !== ""; }
  function step2Valid() {
    return vcatId !== "" && pickup.address.trim() && drop.address.trim() && !!pickupDt;
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
    if (!customerId || !cityId || !tripType || !vcatId || !pickup.address || !drop.address || !pickupDt) return;
    setSubmitting(true); setError("");
    try {
      const result = await customerCareService.createCabBooking({
        customer_id: parseInt(customerId),
        city_id: Number(cityId),
        trip_type: tripType,
        vehicle_category_id: Number(vcatId),
        pickup_location: pickup.address,
        pickup_latitude:  pickup.lat   ?? undefined,
        pickup_longitude: pickup.lng   ?? undefined,
        drop_location: drop.address,
        drop_latitude:  drop.lat   ?? undefined,
        drop_longitude: drop.lng   ?? undefined,
        pickup_datetime: pickupDt.toISOString(),
        estimated_distance: distance ? parseFloat(distance) : null,
        remarks: remarks || undefined,
      });
      setSuccess({ booking_number: result.booking_number, estimated_amount: result.estimated_amount });
      setStep(3);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to create booking");
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
              estimatedAmount != null && ["Estimated Fare", <Typography fontWeight={700} color="success.main">₹{estimatedAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</Typography>],
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

                {/* Trip type cards */}
                <Typography fontWeight={600} fontSize={12} color="text.secondary" mb={1.5} letterSpacing={0.5}>
                  TRIP TYPE *
                </Typography>
                <Grid container spacing={1.5}>
                  {TRIP_TYPES.map(tt => (
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
                {/* ── Vehicle selection panel ── */}
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

                    {/* Distance field */}
                    <Box>
                      <TextField
                        label="Estimated Distance (km)"
                        value={distance}
                        onChange={e => { setDistance(e.target.value.replace(/[^0-9.]/g, "")); setDistanceAuto(false); }}
                        fullWidth size="small"
                        placeholder="e.g. 25"
                        InputProps={{
                          endAdornment: distanceLoading
                            ? <CircularProgress size={14} />
                            : distanceAuto && distance
                              ? <Chip label="Auto" size="small" color="success" sx={{ fontSize: 10, height: 20 }} />
                              : null,
                        }}
                        helperText={
                          distanceLoading
                            ? "Computing driving distance via Google Maps…"
                            : distanceAuto && distance
                              ? `Road distance auto-computed (${distance} km). You can override.`
                              : "Used for fare estimate. Will be auto-computed when both locations are pinned on map."
                        }
                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                      />
                    </Box>
                  </Stack>

                  {/* ── Fare estimate card ── */}
                  {estimatedAmount != null && (() => {
                    const pricing = meta?.pricing[String(vcatId)]?.[tripType];
                    const actualDist = parseFloat(distance) || 0;
                    const breakdown = pricing
                      ? computeFareBreakdown(pricing, actualDist, pickupDt, pickupDt)
                      : null;
                    return (
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
                              ESTIMATED FARE
                            </Typography>
                            <Typography fontWeight={900} fontSize={28} color="#22C55E" lineHeight={1}>
                              ₹{estimatedAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                            </Typography>
                            {breakdown && (
                              <Stack gap={0.25} mt={1}>
                                <FareLine label="Base fare" value={breakdown.base} />
                                {breakdown.distance > 0 && (
                                  <FareLine
                                    label={`Distance (${actualDist} − ${pricing?.minimum_km ?? 0} km) × ₹${pricing?.per_km_rate}/km`}
                                    value={breakdown.distance}
                                  />
                                )}
                                {breakdown.allowance > 0 && (
                                  <FareLine label="Driver allowance" value={breakdown.allowance} />
                                )}
                                {breakdown.night > 0 && (
                                  <FareLine label="Night charge (22:00–06:00)" value={breakdown.night} />
                                )}
                              </Stack>
                            )}
                          </Box>
                          <Box textAlign="right" flexShrink={0}>
                            <Typography fontSize={11} color="text.secondary">Vehicle</Typography>
                            <Typography fontSize={13} fontWeight={700}>{selectedVcat?.category_name}</Typography>
                          </Box>
                        </Stack>
                      </Box>
                    );
                  })()}

                  <Stack direction="row" gap={1.5} mt={3} justifyContent="space-between">
                    <Button variant="outlined" onClick={() => setStep(0)}
                      sx={{ borderRadius: 2, textTransform: "none" }}>
                      ← Back
                    </Button>
                    <Button variant="contained" disabled={!step2Valid()} onClick={() => setStep(2)}
                      sx={{
                        borderRadius: 2, textTransform: "none", fontWeight: 700, px: 3.5,
                        background: step2Valid()
                          ? `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`
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

                {/* Summary table */}
                <Stack gap={0} mb={3}>
                  {[
                    ["City",         selectedCity?.name],
                    ["Trip Type",    selectedTrip?.label],
                    ["Vehicle",      selectedVcat?.category_name],
                    ["Pickup",       pickup.address],
                    pickup.lat ? ["Pickup Coords", `${pickup.lat.toFixed(5)}, ${pickup.lng!.toFixed(5)}`] : null,
                    ["Drop",         drop.address],
                    drop.lat ? ["Drop Coords", `${drop.lat.toFixed(5)}, ${drop.lng!.toFixed(5)}`] : null,
                    ["Date & Time",  pickupDt ? format(pickupDt, "dd MMM yyyy, hh:mm aa") : "—"],
                    ["Distance",     distance ? `${distance} km${distanceAuto ? " (auto)" : ""}` : "Not provided"],
                    ["Est. Fare",    estimatedAmount != null ? `₹${estimatedAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"],
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
