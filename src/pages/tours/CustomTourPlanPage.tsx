// ============================================================
// WAYTERO ADMIN — CUSTOM / PRIVATE TOUR PLAN
// Route: /tours/custom-plan
//
// One customer, one private tour. The plan is intentionally not a
// catalog package: it is saved with status CUSTOM, priced after review,
// and then handed to a TOUR-enabled partner through the normal tour
// booking acceptance flow.
//
// Flow:
//   1. Customer      — look up an existing customer or register a new one
//   2. Plan & route  — day-wise places, Google driving KM, optional hotels
//   3. Costs & media — minimum operating estimate, images, inclusions
//   4. Review        — final quoted price + partner + create booking
//
// Backend: /admin/tours/custom-plans (migration 0109)
// Doc Ref: BRD Part 5 — Tour Package Management; BRD Part 6 — Booking
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add,
  ArrowBack,
  ArrowForward,
  AttachMoney,
  CalendarMonth,
  CheckCircle,
  CloudUpload,
  Delete,
  DirectionsCar,
  Hotel,
  Image as ImageIcon,
  LocationOn,
  Lock,
  Person,
  PersonAdd,
  Route,
  Send,
  Visibility,
} from "@mui/icons-material";

import {
  tourService,
  type CustomTourCabOption,
  type CustomTourCostBreakdown,
  type CustomTourDay,
  type CustomTourPartner,
  type CustomTourPlace,
  type CustomTourPlanPayload,
} from "../../services/tour.service";
import {
  customerCareService,
  type CustomerLookup,
} from "../../services/customerCare.service";
import { apiErrorMessage } from "../../utils/apiError";
import MediaPicker from "../../components/media/MediaPicker";
import type { MediaPickerCropSpec } from "../../components/media/MediaPicker";
import type { MediaLibraryItem } from "../../services/media.service";

const TOUR_IMAGE_CROP: MediaPickerCropSpec = {
  presets: [{ label: "Tour card (3:2)", ratio: 3 / 2 }],
  outputWidth: 1200,
  outputHeight: 800,
};

const STEPS = [
  { label: "Customer", icon: <Person /> },
  { label: "Plan & route", icon: <Route /> },
  { label: "Costs & media", icon: <AttachMoney /> },
  { label: "Review & partner", icon: <Visibility /> },
];

const HOTEL_CATEGORIES = ["Budget", "3 Star", "4 Star", "5 Star", "Homestay", "Resort"];
const MAX_DAYS = 30;

interface PlanForm {
  package_name: string;
  destination: string;
  city_id: string;
  travel_start_date: string;
  duration_days: number;
  persons_count: string;
  minimum_persons: string;
  maximum_persons: string;
  pickup_location: string;
  short_description: string;
  description: string;
  cab_category_id: string;
  partner_id: string;
  toll_cost: string;
  other_cost: string;
  quoted_price: string;
  special_requests: string;
}

interface DayDraft {
  day_number: number;
  title: string;
  description: string;
  notes: string;
  places: CustomTourPlace[];
  newPlaceName: string;
  newPlaceTime: string;
  hotelEnabled: boolean;
  hotelName: string;
  hotelAddress: string;
  hotelCategory: string;
  hotelRoomType: string;
  hotelRooms: string;
  hotelNights: string;
  hotelCost: string;
  hotelNotes: string;
  otherCost: string;
}

interface NewCustomerForm {
  first_name: string;
  last_name: string;
  mobile_number: string;
  email: string;
  city_id: string;
}

const today = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60_000).toISOString().slice(0, 10);
};

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const makeDay = (n: number): DayDraft => ({
  day_number: n,
  title: `Day ${n}`,
  description: "",
  notes: "",
  places: [],
  newPlaceName: "",
  newPlaceTime: "",
  hotelEnabled: false,
  hotelName: "",
  hotelAddress: "",
  hotelCategory: "",
  hotelRoomType: "",
  hotelRooms: "1",
  hotelNights: "1",
  hotelCost: "",
  hotelNotes: "",
  otherCost: "",
});

const blankForm = (): PlanForm => ({
  package_name: "",
  destination: "",
  city_id: "",
  travel_start_date: today(),
  duration_days: 2,
  persons_count: "2",
  minimum_persons: "1",
  maximum_persons: "10",
  pickup_location: "",
  short_description: "",
  description: "",
  cab_category_id: "",
  partner_id: "",
  toll_cost: "",
  other_cost: "",
  quoted_price: "",
  special_requests: "",
});

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ py: 0.6 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={strong ? 700 : 500} textAlign="right">
        {value}
      </Typography>
    </Stack>
  );
}

function TagEditor({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (!values.includes(value)) onChange([...values, value]);
    setDraft("");
  };
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth
          size="small"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button variant="outlined" onClick={add}>
          Add
        </Button>
      </Stack>
      <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75} sx={{ mt: 1 }}>
        {values.map((value, index) => (
          <Chip
            key={`${value}-${index}`}
            label={value}
            size="small"
            onDelete={() => onChange(values.filter((_, i) => i !== index))}
          />
        ))}
      </Stack>
    </Box>
  );
}

export default function CustomTourPlanPage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<PlanForm>(blankForm);
  const [days, setDays] = useState<DayDraft[]>([makeDay(1), makeDay(2)]);
  const [inclusions, setInclusions] = useState<string[]>([
    "Private cab for the full tour",
    "Driver allowance and fuel",
  ]);
  const [exclusions, setExclusions] = useState<string[]>([
    "Personal expenses",
    "Monument / activity tickets",
  ]);
  const [media, setMedia] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [estimate, setEstimate] = useState<CustomTourCostBreakdown | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customer, setCustomer] = useState<CustomerLookup | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [newCustomer, setNewCustomer] = useState<NewCustomerForm>({
    first_name: "",
    last_name: "",
    mobile_number: "",
    email: "",
    city_id: "",
  });

  const citiesQuery = useQuery({
    queryKey: ["admin-cities-active"],
    queryFn: () => tourService.getCities(),
  });
  const cities = citiesQuery.data || [];

  const cabOptionsQuery = useQuery({
    queryKey: ["custom-tour-cab-options", form.city_id, form.travel_start_date],
    queryFn: () =>
      tourService.customCabOptions(Number(form.city_id), form.travel_start_date),
    enabled: Boolean(form.city_id),
  });
  const cabOptions: CustomTourCabOption[] = cabOptionsQuery.data || [];

  const partnersQuery = useQuery({
    queryKey: ["custom-tour-partners"],
    queryFn: () => tourService.customPartners(),
  });
  const tourPartners = useMemo<CustomTourPartner[]>(
    () => (partnersQuery.data || []).filter((p) => p.has_tour_service),
    [partnersQuery.data],
  );

  // Keep the selected cab type valid when the city (and therefore the
  // available pricing sheets) changes.
  useEffect(() => {
    if (!form.city_id || cabOptions.length === 0) return;
    const current = Number(form.cab_category_id || 0);
    if (!cabOptions.some((option) => option.id === current)) {
      setForm((prev) => ({ ...prev, cab_category_id: String(cabOptions[0].id) }));
    }
  }, [cabOptions, form.city_id, form.cab_category_id]);

  const selectedCab = cabOptions.find(
    (option) => option.id === Number(form.cab_category_id),
  );
  const selectedPartner = tourPartners.find(
    (partner) => partner.id === Number(form.partner_id),
  );

  const setField = <K extends keyof PlanForm>(key: K, value: PlanForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (
      [
        "city_id",
        "cab_category_id",
        "travel_start_date",
        "toll_cost",
        "other_cost",
        "duration_days",
      ].includes(key)
    ) {
      setEstimate(null);
    }
  };

  const updateDay = (index: number, patch: Partial<DayDraft>) => {
    setDays((prev) =>
      prev.map((day, i) => (i === index ? { ...day, ...patch } : day)),
    );
    setEstimate(null);
  };

  const updatePlace = (
    dayIndex: number,
    placeIndex: number,
    patch: Partial<CustomTourPlace>,
  ) => {
    setDays((prev) =>
      prev.map((day, i) =>
        i === dayIndex
          ? {
              ...day,
              places: day.places.map((place, j) =>
                j === placeIndex ? { ...place, ...patch } : place,
              ),
            }
          : day,
      ),
    );
    setEstimate(null);
  };

  const changeDuration = (next: number) => {
    const duration = Math.max(1, Math.min(MAX_DAYS, next));
    setForm((prev) => ({ ...prev, duration_days: duration }));
    setDays((prev) => {
      if (duration <= prev.length) return prev.slice(0, duration);
      return [
        ...prev,
        ...Array.from({ length: duration - prev.length }, (_, i) =>
          makeDay(prev.length + i + 1),
        ),
      ];
    });
    setEstimate(null);
  };

  const removePlace = (dayIndex: number, placeIndex: number) => {
    setDays((prev) =>
      prev.map((day, i) =>
        i === dayIndex
          ? { ...day, places: day.places.filter((_, j) => j !== placeIndex) }
          : day,
      ),
    );
    setEstimate(null);
  };

  const addPlace = async (dayIndex: number, autoDistance: boolean) => {
    const day = days[dayIndex];
    const name = day.newPlaceName.trim();
    if (!name) {
      enqueueSnackbar("Enter a place name first.", { variant: "warning" });
      return;
    }

    let distance = 0;
    let source = "MANUAL";
    if (autoDistance) {
      // A multi-day route is continuous: the first leg of day N starts where
      // day N-1 ended (its hotel if one was booked, otherwise its last place).
      const previousDay = dayIndex > 0 ? days[dayIndex - 1] : null;
      const previousDayEnd = previousDay
        ? previousDay.hotelEnabled && previousDay.hotelName
          ? previousDay.hotelName
          : previousDay.places[previousDay.places.length - 1]?.name
        : "";
      const origin =
        day.places.length > 0
          ? day.places[day.places.length - 1].name
          : previousDayEnd || form.pickup_location.trim();
      if (!origin) {
        enqueueSnackbar(
          "Add the pickup location on this step (or a previous place) so the first leg can be calculated.",
          { variant: "warning" },
        );
        return;
      }
      try {
        const originCity =
          cities.find((city: any) => String(city.id) === form.city_id)?.name ||
          form.destination ||
          undefined;
        const result = await tourService.customRouteDistance({
          origin,
          destination: name,
          origin_hint: originCity,
          destination_hint: form.destination || undefined,
        });
        distance = result.distance_km;
        source = result.source;
      } catch (err) {
        enqueueSnackbar(
          `Google distance could not be calculated: ${apiErrorMessage(err)}`,
          { variant: "warning" },
        );
      }
    }

    setDays((prev) =>
      prev.map((item, i) =>
        i === dayIndex
          ? {
              ...item,
              places: [
                ...item.places,
                {
                  name,
                  arrival_time: item.newPlaceTime || null,
                  distance_from_previous_km: distance,
                  distance_source: source,
                  notes: null,
                },
              ],
              newPlaceName: "",
              newPlaceTime: "",
            }
          : item,
      ),
    );
    setEstimate(null);
  };

  const toCustomDay = (day: DayDraft): CustomTourDay => ({
    day_number: day.day_number,
    title: day.title.trim() || `Day ${day.day_number}`,
    description: day.description.trim() || null,
    places: day.places.map((place) => ({
      ...place,
      name: place.name.trim(),
      arrival_time: place.arrival_time || null,
      distance_source: place.distance_source || "MANUAL",
      notes: place.notes || null,
    })),
    hotel: day.hotelEnabled
      ? {
          enabled: true,
          hotel_name: day.hotelName.trim(),
          address: day.hotelAddress.trim() || null,
          category: day.hotelCategory || null,
          room_type: day.hotelRoomType.trim() || null,
          rooms: Number(day.hotelRooms) || 1,
          nights: Number(day.hotelNights) || 1,
          cost: Number(day.hotelCost) || 0,
          notes: day.hotelNotes.trim() || null,
        }
      : null,
    other_cost: Number(day.otherCost) || 0,
    notes: day.notes.trim() || null,
  });

  const estimatePayload = () => ({
    city_id: Number(form.city_id),
    travel_start_date: form.travel_start_date,
    duration_days: form.duration_days,
    cab_category_id: Number(form.cab_category_id),
    days: days.map(toCustomDay),
    toll_cost: Number(form.toll_cost) || 0,
    other_cost: Number(form.other_cost) || 0,
  });

  const fetchEstimate = async (): Promise<boolean> => {
    if (!form.city_id || !form.cab_category_id) {
      setError("Select the destination city and a cab type before estimating.");
      return false;
    }
    setEstimating(true);
    setError("");
    try {
      const result = await tourService.estimateCustomPlan(estimatePayload());
      setEstimate(result.breakdown);
      return true;
    } catch (err) {
      setError(apiErrorMessage(err));
      return false;
    } finally {
      setEstimating(false);
    }
  };

  const validateCustomer = () => {
    if (!customer?.customer_id) {
      setError("Choose or register the customer before proceeding.");
      return false;
    }
    return true;
  };

  const validatePlan = () => {
    if (form.package_name.trim().length < 3)
      return fail("Enter a tour name of at least 3 characters.");
    if (form.destination.trim().length < 2)
      return fail("Enter the tour destination.");
    if (!form.city_id) return fail("Select the destination city.");
    if (!form.travel_start_date) return fail("Select the travel start date.");
    if (!form.cab_category_id) return fail("Select a cab type.");
    if (Number(form.persons_count) < Number(form.minimum_persons || 1)) {
      return fail("Traveller count cannot be lower than the minimum persons.");
    }
    if (days.length !== form.duration_days) {
      return fail("The number of itinerary days must match the duration.");
    }
    for (const day of days) {
      if (day.title.trim().length < 2)
        return fail(`Day ${day.day_number} needs a title of at least 2 characters.`);
      if (day.places.length === 0) {
        return fail(`Day ${day.day_number} needs at least one place.`);
      }
      if (day.places.some((place) => !place.name.trim())) {
        return fail(`Day ${day.day_number} has an empty place name.`);
      }
      if (day.hotelEnabled && !day.hotelName.trim()) {
        return fail(`Day ${day.day_number}: enter the hotel name or turn the hotel off.`);
      }
    }
    return true;
  };

  const fail = (message: string) => {
    setError(message);
    return false;
  };

  const lookupCustomer = async () => {
    const mobile = customerMobile.trim();
    if (mobile.length < 10) {
      setError("Enter a 10-digit customer mobile number.");
      return;
    }
    setLookingUp(true);
    setError("");
    try {
      const result = await customerCareService.lookup(mobile);
      if (!result.found || !result.customer_id) {
        setNewCustomer((prev) => ({ ...prev, mobile_number: mobile }));
        setCustomerMode("new");
        setError("No customer found with this mobile. Register them below.");
        return;
      }
      setCustomer(result);
      setNewCustomer((prev) => ({ ...prev, mobile_number: mobile }));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLookingUp(false);
    }
  };

  const registerCustomer = async () => {
    if (!newCustomer.first_name.trim() || !newCustomer.mobile_number.trim()) {
      setError("First name and mobile number are required to register a customer.");
      return;
    }
    setRegistering(true);
    setError("");
    try {
      const result = await customerCareService.registerCustomer({
        first_name: newCustomer.first_name.trim(),
        last_name: newCustomer.last_name.trim() || undefined,
        mobile_number: newCustomer.mobile_number.trim(),
        email: newCustomer.email.trim() || undefined,
        city_id: newCustomer.city_id ? Number(newCustomer.city_id) : undefined,
      });
      setCustomer(result);
      setCustomerMobile(result.mobile_number || newCustomer.mobile_number);
      enqueueSnackbar("Customer registered.", { variant: "success" });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setRegistering(false);
    }
  };

  const handleNext = async () => {
    setError("");
    if (step === 0) {
      if (validateCustomer()) setStep(1);
      return;
    }
    if (step === 1) {
      if (!validatePlan()) return;
      const ok = await fetchEstimate();
      if (ok) setStep(2);
      return;
    }
    if (step === 2) {
      if (!estimate) {
        setError("Recalculate the estimate after your latest changes before review.");
        return;
      }
      setStep(3);
    }
  };

  const handleSubmit = async (bookNow: boolean) => {
    setError("");
    if (!validateCustomer()) {
      setStep(0);
      return;
    }
    if (!form.partner_id) {
      setError("Select the partner who will receive this custom tour.");
      return;
    }
    const quoted = Number(form.quoted_price);
    if (bookNow && (!Number.isFinite(quoted) || quoted <= 0)) {
      setError("Enter the final quoted price before creating the booking.");
      return;
    }

    const payload: CustomTourPlanPayload = {
      customer_id: customer!.customer_id!,
      partner_id: Number(form.partner_id),
      package_name: form.package_name.trim(),
      destination: form.destination.trim(),
      city_id: Number(form.city_id),
      duration_days: form.duration_days,
      duration_nights: Math.max(0, form.duration_days - 1),
      travel_start_date: form.travel_start_date,
      persons_count: Number(form.persons_count) || 1,
      minimum_persons: Number(form.minimum_persons) || 1,
      maximum_persons: form.maximum_persons ? Number(form.maximum_persons) : null,
      pickup_location: form.pickup_location.trim() || null,
      short_description: form.short_description.trim() || null,
      description: form.description.trim() || null,
      cab_category_id: Number(form.cab_category_id),
      days: days.map(toCustomDay),
      inclusions,
      exclusions,
      media,
      toll_cost: Number(form.toll_cost) || 0,
      other_cost: Number(form.other_cost) || 0,
      quoted_price: Number.isFinite(quoted) && quoted > 0 ? quoted : null,
      book_now: bookNow,
      special_requests: form.special_requests.trim() || null,
    };

    setSaving(true);
    try {
      const result = await tourService.createCustomPlan(payload);
      if (result.booking) {
        enqueueSnackbar(
          `Booking ${result.booking.booking_number} sent to ${selectedPartner?.business_name || "the partner"} for acceptance.`,
          { variant: "success" },
        );
        navigate(
          `/bookings/${result.booking.master_booking_id}/tour/${result.booking.tour_booking_id}`,
        );
      } else {
        enqueueSnackbar("Custom tour plan saved as a private draft.", {
          variant: "success",
        });
        navigate(`/tours/${result.package.id}`);
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const showError = error ? (
    <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
      {error}
    </Alert>
  ) : null;

  // ── Step 0: customer ───────────────────────────────────────────
  const customerStep = (
    <Stack spacing={2.5}>
      {customer?.customer_id ? (
        <Card variant="outlined" sx={{ borderColor: "success.main" }}>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 46,
                  height: 46,
                  borderRadius: "50%",
                  bgcolor: "success.50",
                  color: "success.main",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <CheckCircle />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6">
                  {customer.full_name ||
                    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
                    customer.mobile_number}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {customer.mobile_number}
                  {customer.customer_code ? ` · ${customer.customer_code}` : ""}
                  {customer.email ? ` · ${customer.email}` : ""}
                </Typography>
              </Box>
              <Button
                onClick={() => {
                  setCustomer(null);
                  setCustomerMobile("");
                  setCustomerMode("existing");
                }}
              >
                Change
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <>
          <ToggleButtonGroup
            exclusive
            value={customerMode}
            onChange={(_, value: "existing" | "new" | null) => {
              if (value) {
                setCustomerMode(value);
                setError("");
              }
            }}
            size="small"
          >
            <ToggleButton value="existing">
              <Person sx={{ mr: 1, fontSize: 18 }} /> Existing customer
            </ToggleButton>
            <ToggleButton value="new">
              <PersonAdd sx={{ mr: 1, fontSize: 18 }} /> New customer
            </ToggleButton>
          </ToggleButtonGroup>

          {customerMode === "existing" ? (
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Find the customer
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Search by the mobile number used for their WayTero account.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField
                  label="Customer mobile"
                  placeholder="10-digit mobile"
                  value={customerMobile}
                  onChange={(e) => setCustomerMobile(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void lookupCustomer();
                    }
                  }}
                  fullWidth
                  inputProps={{ maxLength: 15 }}
                />
                <Button
                  variant="contained"
                  onClick={() => void lookupCustomer()}
                  disabled={lookingUp}
                  startIcon={lookingUp ? <CircularProgress size={16} /> : <Person />}
                  sx={{ minWidth: 150 }}
                >
                  Look up
                </Button>
              </Stack>
            </Paper>
          ) : (
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Register a new customer
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                This creates a normal WayTero customer account that can be used
                for future bookings too.
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="First name"
                    required
                    fullWidth
                    value={newCustomer.first_name}
                    onChange={(e) =>
                      setNewCustomer((prev) => ({ ...prev, first_name: e.target.value }))
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Last name"
                    fullWidth
                    value={newCustomer.last_name}
                    onChange={(e) =>
                      setNewCustomer((prev) => ({ ...prev, last_name: e.target.value }))
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Mobile"
                    required
                    fullWidth
                    value={newCustomer.mobile_number}
                    onChange={(e) =>
                      setNewCustomer((prev) => ({
                        ...prev,
                        mobile_number: e.target.value,
                      }))
                    }
                    inputProps={{ maxLength: 15 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Email"
                    type="email"
                    fullWidth
                    value={newCustomer.email}
                    onChange={(e) =>
                      setNewCustomer((prev) => ({ ...prev, email: e.target.value }))
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Customer city"
                    fullWidth
                    value={newCustomer.city_id}
                    onChange={(e) =>
                      setNewCustomer((prev) => ({ ...prev, city_id: e.target.value }))
                    }
                  >
                    <MenuItem value="">Not specified</MenuItem>
                    {cities.map((city: any) => (
                      <MenuItem key={city.id} value={String(city.id)}>
                        {city.name}
                        {city.state_name ? `, ${city.state_name}` : ""}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
              <Button
                variant="contained"
                sx={{ mt: 2 }}
                onClick={() => void registerCustomer()}
                disabled={registering}
                startIcon={registering ? <CircularProgress size={16} /> : <PersonAdd />}
              >
                Register customer
              </Button>
            </Paper>
          )}
        </>
      )}
    </Stack>
  );

  // ── Step 1: plan, route and hotels ─────────────────────────────
  const planStep = (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Private tour basics
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Tour name"
              required
              fullWidth
              placeholder="e.g. Rajasthan family tour for Sharma ji"
              value={form.package_name}
              onChange={(e) => setField("package_name", e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Destination"
              required
              fullWidth
              placeholder="e.g. Jaipur · Jodhpur · Udaipur"
              value={form.destination}
              onChange={(e) => setField("destination", e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              label="Origin city"
              required
              fullWidth
              value={form.city_id}
              onChange={(e) => setField("city_id", e.target.value)}
            >
              {cities.map((city: any) => (
                <MenuItem key={city.id} value={String(city.id)}>
                  {city.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Travel start"
              type="date"
              required
              fullWidth
              value={form.travel_start_date}
              onChange={(e) => setField("travel_start_date", e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField
              label="Days"
              type="number"
              fullWidth
              value={form.duration_days}
              onChange={(e) => changeDuration(Number(e.target.value))}
              inputProps={{ min: 1, max: MAX_DAYS }}
              InputProps={{
                endAdornment: <InputAdornment position="end">D</InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField
              label="Nights"
              fullWidth
              value={Math.max(0, form.duration_days - 1)}
              InputProps={{ readOnly: true }}
              helperText="Auto = days − 1"
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField
              label="Travellers"
              type="number"
              fullWidth
              value={form.persons_count}
              onChange={(e) => setField("persons_count", e.target.value)}
              inputProps={{ min: 1, max: 99 }}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={3}>
            <TextField
              label="Minimum persons"
              type="number"
              fullWidth
              value={form.minimum_persons}
              onChange={(e) => setField("minimum_persons", e.target.value)}
              inputProps={{ min: 1 }}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={3}>
            <TextField
              label="Maximum persons"
              type="number"
              fullWidth
              value={form.maximum_persons}
              onChange={(e) => setField("maximum_persons", e.target.value)}
              inputProps={{ min: 1 }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Pickup location"
              fullWidth
              placeholder="Hotel / airport / home address"
              value={form.pickup_location}
              onChange={(e) => setField("pickup_location", e.target.value)}
              helperText="Used as the starting point for the first Google Maps leg."
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Short description"
              fullWidth
              value={form.short_description}
              onChange={(e) => setField("short_description", e.target.value)}
              placeholder="One line shown on the private tour record"
            />
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          spacing={1}
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              Cab & route pricing
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The cab sheet is the minimum operating cost; the final selling price
              is set after review.
            </Typography>
          </Box>
          {cabOptionsQuery.isFetching && <CircularProgress size={20} />}
        </Stack>
        {!form.city_id ? (
          <Alert severity="info">Select the origin city to load cab types.</Alert>
        ) : cabOptions.length === 0 ? (
          <Alert severity="warning">
            No cab pricing is configured for this city. Add round-trip / outstation
            rates in Settings → Vehicle Pricing, then return here.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={5}>
              <TextField
                select
                label="Cab type"
                fullWidth
                value={form.cab_category_id}
                onChange={(e) => setField("cab_category_id", e.target.value)}
              >
                {cabOptions.map((option) => (
                  <MenuItem key={option.id} value={String(option.id)}>
                    {option.category_name}
                    {option.seating_capacity ? ` · ${option.seating_capacity} seats` : ""}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={7}>
              {selectedCab && (
                <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
                  <Chip
                    icon={<DirectionsCar />}
                    label={`${selectedCab.trip_type} sheet`}
                    variant="outlined"
                  />
                  <Chip label={`Base ${money(selectedCab.base_fare)}`} />
                  <Chip label={`${money(selectedCab.per_km_rate)} / km`} />
                  <Chip
                    label={`Min ${selectedCab.minimum_km || 0} km`}
                    variant="outlined"
                  />
                  <Chip
                    label={`Driver ${money(selectedCab.driver_allowance)} ${selectedCab.driver_allowance_type || ""}`}
                    variant="outlined"
                  />
                  {selectedCab.toll > 0 && (
                    <Chip label={`Toll ${money(selectedCab.toll)}`} variant="outlined" />
                  )}
                </Stack>
              )}
            </Grid>
          </Grid>
        )}
      </Paper>

      <Box>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1}
          sx={{ mb: 1.5 }}
        >
          <Box>
            <Typography variant="h6">Day-wise itinerary</Typography>
            <Typography variant="body2" color="text.secondary">
              {days.length} of {form.duration_days} days added. Each day needs at
              least one place.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => changeDuration(form.duration_days - 1)}
              disabled={form.duration_days <= 1}
            >
              Remove day
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Add />}
              onClick={() => changeDuration(form.duration_days + 1)}
              disabled={form.duration_days >= MAX_DAYS}
            >
              Add day
            </Button>
          </Stack>
        </Stack>

        <Stack spacing={2}>
          {days.map((day, dayIndex) => (
            <Paper key={day.day_number} variant="outlined" sx={{ p: 2.5 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                alignItems={{ xs: "stretch", sm: "center" }}
                sx={{ mb: 2 }}
              >
                <Chip
                  label={`Day ${day.day_number}`}
                  color="primary"
                  sx={{ alignSelf: "flex-start", fontWeight: 700 }}
                />
                <TextField
                  label="Day title"
                  size="small"
                  fullWidth
                  value={day.title}
                  onChange={(e) => updateDay(dayIndex, { title: e.target.value })}
                />
              </Stack>

              <Stack spacing={1}>
                {day.places.map((place, placeIndex) => (
                  <Stack
                    key={`${day.day_number}-${placeIndex}`}
                    direction={{ xs: "column", md: "row" }}
                    spacing={1}
                    alignItems={{ xs: "stretch", md: "center" }}
                  >
                    <TextField
                      label="Place"
                      size="small"
                      value={place.name}
                      onChange={(e) =>
                        updatePlace(dayIndex, placeIndex, { name: e.target.value })
                      }
                      sx={{ flex: 2 }}
                    />
                    <TextField
                      label="Time"
                      size="small"
                      placeholder="10:00"
                      value={place.arrival_time || ""}
                      onChange={(e) =>
                        updatePlace(dayIndex, placeIndex, {
                          arrival_time: e.target.value,
                        })
                      }
                      sx={{ width: { md: 120 } }}
                    />
                    <TextField
                      label="KM from previous"
                      size="small"
                      type="number"
                      value={place.distance_from_previous_km || 0}
                      onChange={(e) =>
                        updatePlace(dayIndex, placeIndex, {
                          distance_from_previous_km: Number(e.target.value) || 0,
                          distance_source: "MANUAL",
                        })
                      }
                      inputProps={{ min: 0, step: 0.1 }}
                      sx={{ width: { md: 170 } }}
                    />
                    <Chip
                      label={place.distance_source || "MANUAL"}
                      size="small"
                      variant="outlined"
                      sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
                    />
                    <IconButton
                      aria-label="Remove place"
                      onClick={() => removePlace(dayIndex, placeIndex)}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>

              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1}
                sx={{ mt: 1.5 }}
              >
                <TextField
                  label="Add a place"
                  size="small"
                  fullWidth
                  value={day.newPlaceName}
                  onChange={(e) =>
                    updateDay(dayIndex, { newPlaceName: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addPlace(dayIndex, false);
                    }
                  }}
                />
                <TextField
                  label="Time"
                  size="small"
                  value={day.newPlaceTime}
                  onChange={(e) =>
                    updateDay(dayIndex, { newPlaceTime: e.target.value })
                  }
                  sx={{ width: { md: 120 } }}
                />
                <Button
                  variant="outlined"
                  onClick={() => void addPlace(dayIndex, false)}
                >
                  Add
                </Button>
                <Tooltip title="Use Google Maps driving distance from the previous place (or pickup)">
                  <Button
                    variant="contained"
                    startIcon={<Route />}
                    onClick={() => void addPlace(dayIndex, true)}
                  >
                    Auto KM & add
                  </Button>
                </Tooltip>
              </Stack>

              <Divider sx={{ my: 2 }} />

              <FormControlLabel
                control={
                  <Switch
                    checked={day.hotelEnabled}
                    onChange={(e) =>
                      updateDay(dayIndex, { hotelEnabled: e.target.checked })
                    }
                  />
                }
                label={
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Hotel fontSize="small" />
                    <span>Hotel stay this day (optional)</span>
                  </Stack>
                }
              />
              {day.hotelEnabled && (
                <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                  <Grid item xs={12} md={5}>
                    <TextField
                      label="Hotel name"
                      size="small"
                      fullWidth
                      required
                      value={day.hotelName}
                      onChange={(e) =>
                        updateDay(dayIndex, { hotelName: e.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <TextField
                      select
                      label="Category"
                      size="small"
                      fullWidth
                      value={day.hotelCategory}
                      onChange={(e) =>
                        updateDay(dayIndex, { hotelCategory: e.target.value })
                      }
                    >
                      <MenuItem value="">Not set</MenuItem>
                      {HOTEL_CATEGORIES.map((category) => (
                        <MenuItem key={category} value={category}>
                          {category}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={6} md={4}>
                    <TextField
                      label="Room type"
                      size="small"
                      fullWidth
                      value={day.hotelRoomType}
                      onChange={(e) =>
                        updateDay(dayIndex, { hotelRoomType: e.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <TextField
                      label="Rooms"
                      size="small"
                      type="number"
                      fullWidth
                      value={day.hotelRooms}
                      onChange={(e) =>
                        updateDay(dayIndex, { hotelRooms: e.target.value })
                      }
                      inputProps={{ min: 1 }}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <TextField
                      label="Nights"
                      size="small"
                      type="number"
                      fullWidth
                      value={day.hotelNights}
                      onChange={(e) =>
                        updateDay(dayIndex, { hotelNights: e.target.value })
                      }
                      inputProps={{ min: 1 }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Hotel cost (total)"
                      size="small"
                      type="number"
                      fullWidth
                      value={day.hotelCost}
                      onChange={(e) =>
                        updateDay(dayIndex, { hotelCost: e.target.value })
                      }
                      InputProps={{
                        startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                      }}
                      inputProps={{ min: 0 }}
                    />
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <TextField
                      label="Hotel address"
                      size="small"
                      fullWidth
                      value={day.hotelAddress}
                      onChange={(e) =>
                        updateDay(dayIndex, { hotelAddress: e.target.value })
                      }
                    />
                  </Grid>
                </Grid>
              )}

              <Grid container spacing={1.5} sx={{ mt: 1 }}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Day notes"
                    size="small"
                    fullWidth
                    multiline
                    minRows={2}
                    value={day.notes}
                    onChange={(e) => updateDay(dayIndex, { notes: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Other cost"
                    size="small"
                    type="number"
                    fullWidth
                    value={day.otherCost}
                    onChange={(e) =>
                      updateDay(dayIndex, { otherCost: e.target.value })
                    }
                    InputProps={{
                      startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                    }}
                    inputProps={{ min: 0 }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    label="Day total"
                    size="small"
                    fullWidth
                    value={money(
                      Number(day.otherCost) +
                        (day.hotelEnabled ? Number(day.hotelCost) : 0),
                    )}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
              </Grid>
            </Paper>
          ))}
        </Stack>
      </Box>
    </Stack>
  );

  // ── Step 2: estimate, images, inclusions ───────────────────────
  const costsStep = (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          spacing={1}
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              Minimum operating estimate
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Cab + hotels + toll + other charges. This is the floor, not the
              customer price.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            onClick={() => void fetchEstimate()}
            disabled={estimating}
            startIcon={estimating ? <CircularProgress size={16} /> : <AttachMoney />}
          >
            Recalculate
          </Button>
        </Stack>

        {estimating && <LinearProgress sx={{ mb: 2 }} />}

        {estimate ? (
          <>
            <Grid container spacing={2}>
              <Grid item xs={12} md={8}>
                <SummaryRow
                  label="Route distance"
                  value={`${estimate.total_distance_km.toFixed(1)} km (billed ${estimate.billed_distance_km.toFixed(1)} km)`}
                />
                <SummaryRow label="Cab base fare" value={money(estimate.cab_base_fare)} />
                <SummaryRow
                  label="Distance charge"
                  value={money(estimate.cab_distance_charge)}
                />
                <SummaryRow
                  label="Driver allowance"
                  value={money(estimate.cab_driver_allowance)}
                />
                <SummaryRow
                  label="Night charge"
                  value={money(estimate.cab_night_charge)}
                />
                <SummaryRow
                  label="Toll (sheet + extra)"
                  value={money(estimate.cab_toll + estimate.toll_cost)}
                />
                <SummaryRow label="Hotels" value={money(estimate.hotel_total)} />
                <SummaryRow label="Other charges" value={money(estimate.other_total)} />
                <Divider sx={{ my: 1 }} />
                <SummaryRow
                  label="Estimated minimum expense"
                  value={money(estimate.estimated_cost)}
                  strong
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Alert severity="info">
                  The estimate covers the cab sheet, optional hotels and the
                  charges you entered. Add your margin in the final quoted price
                  on the review step.
                </Alert>
              </Grid>
            </Grid>

            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Extra toll / parking"
                  type="number"
                  fullWidth
                  value={form.toll_cost}
                  onChange={(e) => setField("toll_cost", e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                  }}
                  inputProps={{ min: 0 }}
                  helperText="Added on top of the cab sheet toll."
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Other charges (guide, permits, etc.)"
                  type="number"
                  fullWidth
                  value={form.other_cost}
                  onChange={(e) => setField("other_cost", e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                  }}
                  inputProps={{ min: 0 }}
                />
              </Grid>
            </Grid>
          </>
        ) : (
          <Alert severity="info">
            Recalculate the estimate after adding places, hotels and charges.
          </Alert>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1}
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              Destination images
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Optional, but useful in the private itinerary PDF and customer
              conversation.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<CloudUpload />}
            onClick={() => setPickerOpen(true)}
          >
            Add images
          </Button>
        </Stack>
        {media.length === 0 ? (
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              textAlign: "center",
              borderStyle: "dashed",
              color: "text.secondary",
            }}
          >
            <ImageIcon sx={{ fontSize: 38, mb: 0.5 }} />
            <Typography variant="body2">No destination images yet.</Typography>
          </Paper>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: 1.5,
            }}
          >
            {media.map((url, index) => (
              <Box
                key={`${url}-${index}`}
                sx={{
                  position: "relative",
                  borderRadius: 2,
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: "divider",
                  aspectRatio: "3 / 2",
                  bgcolor: "action.hover",
                }}
              >
                <Box
                  component="img"
                  src={url}
                  alt={`Destination ${index + 1}`}
                  sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <IconButton
                  size="small"
                  onClick={() =>
                    setMedia((prev) => prev.filter((_, i) => i !== index))
                  }
                  sx={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    bgcolor: "background.paper",
                    "&:hover": { bgcolor: "background.paper" },
                  }}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          What the customer gets
        </Typography>
        <Stack spacing={2}>
          <TagEditor
            label="Inclusions"
            values={inclusions}
            onChange={setInclusions}
            placeholder="e.g. Private AC cab, tolls, driver stay"
          />
          <TagEditor
            label="Exclusions"
            values={exclusions}
            onChange={setExclusions}
            placeholder="e.g. Entry tickets, personal expenses"
          />
          <TextField
            label="Full description / notes for the itinerary"
            fullWidth
            multiline
            minRows={4}
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            placeholder="Anything the partner or customer should know about this plan."
          />
        </Stack>
      </Paper>
    </Stack>
  );

  // ── Step 3: quote, partner, book ────────────────────────────────
  const reviewStep = (
    <Stack spacing={2.5}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
              Plan summary
            </Typography>
            <SummaryRow label="Customer" value={customer?.full_name || customer?.mobile_number || ""} />
            <SummaryRow label="Tour" value={form.package_name || "—"} />
            <SummaryRow
              label="Route"
              value={`${form.destination || "—"} · ${form.duration_days}D/${Math.max(0, form.duration_days - 1)}N`}
            />
            <SummaryRow
              label="Travellers"
              value={`${form.persons_count} person(s)`}
            />
            <SummaryRow
              label="Cab"
              value={selectedCab?.category_name || "—"}
            />
            <SummaryRow
              label="Distance"
              value={
                estimate
                  ? `${estimate.total_distance_km.toFixed(1)} km`
                  : "Recalculate estimate"
              }
            />
            <SummaryRow
              label="Estimated minimum"
              value={estimate ? money(estimate.estimated_cost) : "—"}
            />
            <SummaryRow label="Images" value={`${media.length}`} />
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="body2" color="text.secondary">
              {days.map((day) => (
                <Box key={day.day_number} component="span" sx={{ display: "block", mb: 0.5 }}>
                  <strong>Day {day.day_number}:</strong>{" "}
                  {day.places.map((place) => place.name).join(" → ")}
                  {day.hotelEnabled && day.hotelName ? ` · Hotel: ${day.hotelName}` : ""}
                </Box>
              ))}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <AttachMoney color="primary" />
              <Typography variant="subtitle1" fontWeight={600}>
                Final quoted price
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This is the amount the customer pays. It is not the estimate.
            </Typography>
            <TextField
              label="Quoted price"
              type="number"
              fullWidth
              required
              value={form.quoted_price}
              onChange={(e) => setField("quoted_price", e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start">₹</InputAdornment>,
              }}
              inputProps={{ min: 0 }}
            />
            {estimate && (
              <Stack spacing={1} sx={{ mt: 1.5 }}>
                <SummaryRow
                  label="Minimum estimate"
                  value={money(estimate.estimated_cost)}
                />
                {Number(form.quoted_price) > 0 && (
                  <SummaryRow
                    label="Margin over estimate"
                    value={money(Number(form.quoted_price) - estimate.estimated_cost)}
                    strong
                  />
                )}
                {Number(form.quoted_price) > 0 &&
                  Number(form.quoted_price) < estimate.estimated_cost && (
                    <Alert severity="warning">
                      The quoted price is below the minimum operating estimate.
                      Check the margin before sending.
                    </Alert>
                  )}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Lock fontSize="small" color="primary" />
          <Typography variant="subtitle1" fontWeight={600}>
            Assign a TOUR partner
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Only partners with the TOUR service can accept this booking. The package
          stays private and is not published on the website.
        </Typography>
        {partnersQuery.isLoading ? (
          <LinearProgress />
        ) : tourPartners.length === 0 ? (
          <Alert severity="warning">
            No active partner has the TOUR service enabled. Enable TOUR on a
            partner from the Partners page first.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={7}>
              <TextField
                select
                label="Partner"
                fullWidth
                required
                value={form.partner_id}
                onChange={(e) => setField("partner_id", e.target.value)}
              >
                {tourPartners.map((partner) => (
                  <MenuItem key={partner.id} value={String(partner.id)}>
                    {partner.business_name || partner.owner_name || `Partner #${partner.id}`}
                    {partner.city_name ? ` · ${partner.city_name}` : ""}
                  </MenuItem>
                ))}
              </TextField>
              {selectedPartner && (
                <Typography variant="caption" color="text.secondary">
                  {selectedPartner.owner_name}
                  {selectedPartner.mobile ? ` · ${selectedPartner.mobile}` : ""}
                </Typography>
              )}
            </Grid>
            <Grid item xs={12} sm={5}>
              <TextField
                label="Special requests"
                fullWidth
                multiline
                minRows={2}
                value={form.special_requests}
                onChange={(e) => setField("special_requests", e.target.value)}
              />
            </Grid>
          </Grid>
        )}
        <Alert severity="info" sx={{ mt: 2 }}>
          Creating the booking sends it to the partner as{" "}
          <strong>Pending confirmation</strong>. The partner must accept it before
          the tour is confirmed.
        </Alert>
      </Paper>
    </Stack>
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1180, mx: "auto" }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 3 }}>
        <IconButton
          onClick={() => navigate("/tours")}
          sx={{ border: "1px solid", borderColor: "divider" }}
        >
          <ArrowBack />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="h4" fontWeight={700}>
              Custom tour plan
            </Typography>
            <Chip
              icon={<Lock />}
              label="Private · not on website"
              size="small"
              color="primary"
              variant="outlined"
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Build a one-customer itinerary, estimate the real cost, quote the price
            and send it to a partner for acceptance.
          </Typography>
        </Box>
      </Stack>

      <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
        {STEPS.map((item) => (
          <Step key={item.label}>
            <StepLabel>{item.label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {showError}

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          {step === 0 && customerStep}
          {step === 1 && planStep}
          {step === 2 && costsStep}
          {step === 3 && reviewStep}
        </CardContent>
      </Card>

      <Stack
        direction={{ xs: "column-reverse", sm: "row" }}
        justifyContent="space-between"
        spacing={1.5}
      >
        <Button
          startIcon={<ArrowBack />}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || saving}
        >
          Back
        </Button>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          {step === 3 ? (
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} /> : <Send />}
              onClick={() => void handleSubmit(true)}
              disabled={saving || !form.partner_id || tourPartners.length === 0}
            >
              Create booking & send to partner
            </Button>
          ) : (
            <Button
              variant="contained"
              endIcon={step === 1 && estimating ? <CircularProgress size={16} /> : <ArrowForward />}
              onClick={() => void handleNext()}
              disabled={estimating}
            >
              {step === 1 ? "Calculate & continue" : "Continue"}
            </Button>
          )}
        </Stack>
      </Stack>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(items: MediaLibraryItem[]) => {
          setMedia((prev) => [...prev, ...items.map((item) => item.secure_url)]);
          setPickerOpen(false);
        }}
        folder="waytero/tours"
        uploadFolder="waytero/tours"
        kind="image"
        multiple
        crop={TOUR_IMAGE_CROP}
        title="Tour destination images"
      />

      {citiesQuery.isLoading && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
          <CircularProgress size={14} />
          <Typography variant="caption" color="text.secondary">
            Loading cities…
          </Typography>
        </Stack>
      )}
      {form.travel_start_date && (
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 2 }}>
          <CalendarMonth fontSize="small" color="disabled" />
          <Typography variant="caption" color="text.secondary">
            Travel starts {form.travel_start_date} · {form.duration_days} days /{" "}
            {Math.max(0, form.duration_days - 1)} nights
          </Typography>
        </Stack>
      )}
      {form.city_id && (
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
          <LocationOn fontSize="small" color="disabled" />
          <Typography variant="caption" color="text.secondary">
            {cities.find((city: any) => String(city.id) === form.city_id)?.name || "City"}{" "}
            · {selectedCab?.category_name || "Select a cab type"}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
