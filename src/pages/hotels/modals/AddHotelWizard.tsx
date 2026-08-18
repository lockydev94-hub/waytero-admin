// ============================================================
// WAYTERO ADMIN — ADD HOTEL WIZARD (C4)
// Doc Ref: BRD Part 4 §57-92 | SRS Part 5 §153-194
//          Docs/21_Hotel_Module_Implementation/03_FRONTEND_DESIGN.md §4
//
// 3-step stepper. On success: closes wizard + opens HotelDetailDialog on Rooms tab.
// ============================================================

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogActions,
  Box, Typography, IconButton, Button,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Stack, Alert, AlertTitle, Autocomplete, CircularProgress,
  Switch, FormControlLabel, Divider, Chip, Rating, Paper,
  InputAdornment, alpha, useTheme,
} from "@mui/material";
import {
  Close, Hotel, LocationCity, ReceiptLong,
  ArrowBack, ArrowForward, Check, PersonSearch,
  MyLocation, WarningAmber,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import apiClient from '../../../services/api';
import { settingsService, ApiIntegration } from "../../../services/settings.service";
import {
  hotelService,
  HotelPartnerOption,
  CreateHotelPayload,
} from "../../../services/hotel.service";
import GoogleMapPickerModal, { PickedLocation } from "../../customer-care/components/GoogleMapPickerModal";
import { apiErrorMessage } from "../../../utils/apiError";

// ── Helpers ──────────────────────────────────────────────────
const GST_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/;
const PAN_REGEX = /^[A-Z]{5}\d{4}[A-Z]$/;
const MOBILE_REGEX = /^[6-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STEPS = ["Partner & Identity", "Location & Contact", "Tax & Review"];
const STEP_ICONS = [<PersonSearch />, <LocationCity />, <ReceiptLong />];

// ── Types ─────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (hotelId: number) => void;
}

// ── Component ─────────────────────────────────────────────────
export default function AddHotelWizard({ open, onClose, onCreated }: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const [step, setStep] = useState(0);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapsApiKey, setMapsApiKey] = useState("");
  const [enablingService, setEnablingService] = useState(false);

  // ── Load Google Maps key ────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    (settingsService as any).getApiIntegrations().then((integrations: ApiIntegration[]) => {
      const maps = integrations.find(
        (i: ApiIntegration) => i.service_type === "GOOGLE_MAPS" && i.is_active && i.configuration?.api_key
      );
      if (maps?.configuration?.api_key) setMapsApiKey(maps.configuration.api_key.trim());
    }).catch(() => {});
  }, [open]);

  // ── Meta (categories, hotel types) ─────────────────────────
  const { data: meta } = useQuery({
    queryKey: ["hotel-meta"],
    queryFn: () => hotelService.getMeta(),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["hotel-categories"],
    queryFn: () => hotelService.listCategories(false),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  // ── Cities ─────────────────────────────────────────────────
  const { data: cities = [] } = useQuery<any[]>({
    queryKey: ["cities"],
    queryFn: () => (settingsService as any).getCities(),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  // ── Partner search ─────────────────────────────────────────
  const [partnerSearch, setPartnerSearch] = useState("");
  const [selectedPartner, setSelectedPartner] = useState<HotelPartnerOption | null>(null);

  const { data: partnerPage, isFetching: partnersLoading } = useQuery({
    queryKey: ["hotel-wizard-partners", partnerSearch],
    queryFn: () => hotelService.listHotelPartners(partnerSearch || undefined, 1, 30),
    staleTime: 30_000,
    enabled: open,
  });
  const partners = partnerPage?.items ?? [];

  // ── Form state ─────────────────────────────────────────────
  const [form, setForm] = useState({
    hotel_name: "",
    hotel_type: "",
    hotel_category_id: "" as string | number,
    star_rating: null as number | null,
    // Step 2
    city_id: "" as string | number,
    address: "",
    address_line_2: "",
    landmark: "",
    postal_code: "",
    latitude: "" as string | number,
    longitude: "" as string | number,
    contact_person: "",
    contact_number: "",
    alternate_number: "",
    email: "",
    website_url: "",
    // Step 3
    gst_number: "",
    pan_number: "",
    is_gst_registered: false,
    tax_mode: "EXCLUSIVE",
  });

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const setVal = (k: keyof typeof form, v: unknown) =>
    setForm((p) => ({ ...p, [k]: v }));

  // ── Step validation ────────────────────────────────────────
  const step0Valid =
    !!selectedPartner &&
    form.hotel_name.trim().length >= 3;

  const step1Valid =
    !!form.city_id &&
    form.address.trim().length >= 5 &&
    (!form.contact_number || MOBILE_REGEX.test(form.contact_number)) &&
    (!form.email || EMAIL_REGEX.test(form.email));

  const gstValid = !form.gst_number || GST_REGEX.test(form.gst_number.toUpperCase());
  const panValid = !form.pan_number || PAN_REGEX.test(form.pan_number.toUpperCase());
  const step2Valid = gstValid && panValid;

  // ── Platform GST check ─────────────────────────────────────
  // Reads the GST_ENABLED system configuration. Defaults to enabled only if the
  // lookup fails; a real "false" value gates the Tax Mode control.
  const [platformGstEnabled, setPlatformGstEnabled] = useState(true);
  useEffect(() => {
    if (!open) return;
    settingsService.getConfigurations().then((configs) => {
      const gst = configs.find((c) => c.config_key === "GST_ENABLED");
      if (gst) setPlatformGstEnabled(String(gst.config_value) !== "false");
    }).catch(() => {});
  }, [open]);

  // ── Enable hotel service ────────────────────────────────────
  const handleEnableHotelService = async () => {
    if (!selectedPartner) return;
    setEnablingService(true);
    try {
      await hotelService.enableHotelService(selectedPartner.id);
      enqueueSnackbar("HOTEL service enabled for partner", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["hotel-wizard-partners"] });
      // Refresh the selected partner info
      setSelectedPartner((p) => p ? { ...p, active_services: p.active_services ? p.active_services + ",HOTEL" : "HOTEL" } : p);
    } catch {
      enqueueSnackbar("Failed to enable HOTEL service", { variant: "error" });
    } finally {
      setEnablingService(false);
    }
  };

  // ── Map location pick ───────────────────────────────────────
  const handleMapConfirm = useCallback((loc: PickedLocation) => {
    setForm((p) => ({
      ...p,
      latitude: loc.lat,
      longitude: loc.lng,
      address: p.address || loc.address,
    }));
    setMapOpen(false);
  }, []);

  // ── Submit ─────────────────────────────────────────────────
  // Stage 1 create is deliberately minimal (see backend HotelCreate). The
  // remaining fields the wizard collects — geo, address detail, contact, tax —
  // live on HotelProfileUpdate / HotelTaxUpdate, so we chain those patches
  // immediately after create. Without this, everything past the create schema
  // is silently dropped.
  const mutation = useMutation({
    mutationFn: async () => {
      const payload: CreateHotelPayload = {
        partner_id: selectedPartner!.id,
        hotel_name: form.hotel_name.trim(),
        hotel_category_id: form.hotel_category_id ? Number(form.hotel_category_id) : undefined,
        hotel_type: form.hotel_type || undefined,
        star_rating: form.star_rating,
        city_id: Number(form.city_id),
        address: form.address.trim() || undefined,
        contact_person: form.contact_person.trim() || undefined,
        contact_number: form.contact_number.trim() || undefined,
        email: form.email.trim() || undefined,
      };
      const created: any = await hotelService.create(payload);
      const hotelId: number | undefined = created?.data?.id ?? created?.id;
      if (!hotelId) return created;

      // Persist the extended profile fields the create schema doesn't carry.
      const profile: Record<string, unknown> = {};
      if (form.address_line_2.trim()) profile.address_line_2 = form.address_line_2.trim();
      if (form.landmark.trim()) profile.landmark = form.landmark.trim();
      if (form.postal_code.trim()) profile.postal_code = form.postal_code.trim();
      if (form.latitude !== "") profile.latitude = Number(form.latitude);
      if (form.longitude !== "") profile.longitude = Number(form.longitude);
      if (form.alternate_number.trim()) profile.alternate_number = form.alternate_number.trim();
      if (form.website_url.trim()) profile.website_url = form.website_url.trim();
      if (form.gst_number.trim()) profile.gst_number = form.gst_number.trim().toUpperCase();
      if (form.pan_number.trim()) profile.pan_number = form.pan_number.trim().toUpperCase();
      if (Object.keys(profile).length) await hotelService.update(hotelId, profile);

      // Tax config is its own endpoint.
      if (form.is_gst_registered || form.gst_number.trim() || form.tax_mode !== "EXCLUSIVE") {
        await hotelService.updateTax(hotelId, {
          tax_mode: form.tax_mode,
          is_gst_registered: form.is_gst_registered,
          gst_number: form.gst_number.trim() ? form.gst_number.trim().toUpperCase() : null,
        });
      }
      return created;
    },
    onSuccess: (res: any) => {
      enqueueSnackbar("Hotel created as DRAFT — add rooms next", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin-hotels"] });
      qc.invalidateQueries({ queryKey: ["hotel-stats"] });
      const newId = res?.data?.id ?? res?.id;
      handleClose();
      if (newId) onCreated(newId);
    },
    onError: (err: any) =>
      enqueueSnackbar(apiErrorMessage(err, "Failed to create hotel"), { variant: "error" }),
  });

  // ── Reset & close ──────────────────────────────────────────
  const handleClose = () => {
    setStep(0);
    setSelectedPartner(null);
    setPartnerSearch("");
    setForm({
      hotel_name: "", hotel_type: "", hotel_category_id: "", star_rating: null,
      city_id: "", address: "", address_line_2: "", landmark: "", postal_code: "",
      latitude: "", longitude: "",
      contact_person: "", contact_number: "", alternate_number: "", email: "", website_url: "",
      gst_number: "", pan_number: "", is_gst_registered: false, tax_mode: "EXCLUSIVE",
    });
    onClose();
  };

  const selectedCity = cities.find((c: any) => c.id === Number(form.city_id));
  const partnerHasHotel = selectedPartner?.active_services?.includes("HOTEL");

  // ── Render ─────────────────────────────────────────────────
  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.2)" },
        }}
      >
        {/* ── Gradient Header ─────────────────────────────────── */}
        <Box
          sx={{
            px: 3, py: 2.5,
            background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 60%, ${alpha(theme.palette.primary.light, 0.9)} 100%)`,
            color: "white",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative circles */}
          <Box sx={{ position: "absolute", top: -24, right: -24, width: 130, height: 130, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.06)" }} />
          <Box sx={{ position: "absolute", bottom: -50, left: "45%", width: 200, height: 200, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.03)" }} />

          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ bgcolor: "rgba(255,255,255,0.15)", borderRadius: 2, p: 1, display: "flex" }}>
                <Hotel sx={{ fontSize: 22 }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={800} letterSpacing={0.3}>
                  Add New Hotel
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.75 }}>
                  Step {step + 1} of {STEPS.length} — {STEPS[step]}
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={handleClose} sx={{ color: "white", mt: -0.5 }} size="small">
              <Close />
            </IconButton>
          </Box>

          {/* Step progress bar */}
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: "flex", gap: 0.75 }}>
              {STEPS.map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    flex: 1, height: 3, borderRadius: 2,
                    bgcolor: i <= step ? "white" : "rgba(255,255,255,0.25)",
                    transition: "background 0.3s",
                  }}
                />
              ))}
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.75 }}>
              {STEPS.map((label, i) => (
                <Typography key={i} variant="caption" sx={{
                  opacity: i <= step ? 1 : 0.45,
                  fontSize: "0.65rem",
                  fontWeight: i === step ? 700 : 400,
                }}>
                  {label}
                </Typography>
              ))}
            </Box>
          </Box>
        </Box>

        {/* ── Content ───────────────────────────────────────────── */}
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, minHeight: 420 }}>

          {/* ─ Step 0: Partner & Identity ──────────────────────── */}
          {step === 0 && (
            <Stack spacing={2.5}>
              {/* Partner picker */}
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.75 }}>
                  <PersonSearch fontSize="small" color="primary" /> Owning Partner
                </Typography>
                <Autocomplete
                  options={partners}
                  value={selectedPartner}
                  onChange={(_, v) => setSelectedPartner(v)}
                  inputValue={partnerSearch}
                  onInputChange={(_, v) => setPartnerSearch(v)}
                  loading={partnersLoading}
                  getOptionLabel={(o) =>
                    `${o.owner_name ?? ""} ${o.business_name ? `(${o.business_name})` : ""} — ${o.partner_code ?? ""}`.trim()
                  }
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Search partner *"
                      size="small"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {partnersLoading && <CircularProgress size={16} />}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.id}>
                      <Box sx={{ width: "100%" }}>
                        <Typography variant="body2" fontWeight={600}>
                          {option.owner_name ?? "—"}
                          {option.business_name && (
                            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
                              {option.business_name}
                            </Typography>
                          )}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 0.25 }}>
                          <Typography variant="caption" color="text.secondary">{option.partner_code}</Typography>
                          <Typography variant="caption" color="text.secondary">·</Typography>
                          <Typography variant="caption" color={option.status === "ACTIVE" ? "success.main" : "text.secondary"}>
                            {option.status}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">·</Typography>
                          <Typography variant="caption" color="text.secondary">{option.hotel_count} hotel{option.hotel_count !== 1 ? "s" : ""}</Typography>
                        </Stack>
                      </Box>
                    </Box>
                  )}
                  noOptionsText="No partners found — try a different search"
                  fullWidth
                />

                {/* HOTEL service enablement inline alert */}
                {selectedPartner && !partnerHasHotel && (
                  <Alert
                    severity="warning"
                    sx={{ mt: 1.5, borderRadius: 2 }}
                    action={
                      <Button
                        size="small"
                        variant="contained"
                        color="warning"
                        onClick={handleEnableHotelService}
                        disabled={enablingService}
                        startIcon={enablingService ? <CircularProgress size={14} color="inherit" /> : undefined}
                        sx={{ whiteSpace: "nowrap" }}
                      >
                        {enablingService ? "Enabling…" : "Enable HOTEL"}
                      </Button>
                    }
                  >
                    <AlertTitle sx={{ fontWeight: 700, mb: 0 }}>HOTEL service not active</AlertTitle>
                    This partner doesn't have the HOTEL service. Enable it before creating a hotel.
                  </Alert>
                )}
                {selectedPartner && partnerHasHotel && (
                  <Alert severity="success" icon={<Check />} sx={{ mt: 1, borderRadius: 2, py: 0.5 }}>
                    HOTEL service active · {selectedPartner.hotel_count} hotel{selectedPartner.hotel_count !== 1 ? "s" : ""} already onboarded
                  </Alert>
                )}
              </Box>

              <Divider />

              {/* Hotel identity */}
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Hotel fontSize="small" color="primary" /> Hotel Identity
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Hotel Name *"
                    value={form.hotel_name}
                    onChange={set("hotel_name")}
                    size="small"
                    fullWidth
                    inputProps={{ maxLength: 200 }}
                    helperText={`${form.hotel_name.length}/200 chars`}
                  />

                  <Stack direction="row" spacing={2}>
                    <FormControl size="small" sx={{ flex: 1 }}>
                      <InputLabel>Hotel Type</InputLabel>
                      <Select
                        value={form.hotel_type}
                        label="Hotel Type"
                        onChange={(e) => setVal("hotel_type", e.target.value)}
                      >
                        <MenuItem value=""><em>Not specified</em></MenuItem>
                        {(meta?.room_types ?? ["HOTEL", "RESORT", "HOMESTAY", "BOUTIQUE", "MOTEL", "SERVICED_APARTMENT", "HOSTEL", "VILLA", "GUESTHOUSE"]).map((t: string) => (
                          <MenuItem key={t} value={t}>{t.replace(/_/g, " ")}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ flex: 1 }}>
                      <InputLabel>Category</InputLabel>
                      <Select
                        value={form.hotel_category_id}
                        label="Category"
                        onChange={(e) => setVal("hotel_category_id", e.target.value)}
                      >
                        <MenuItem value=""><em>None</em></MenuItem>
                        {categories.map((c: any) => (
                          <MenuItem key={c.id} value={c.id}>{c.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>

                  {/* Star rating */}
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                      Star Rating (optional)
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Rating
                        value={form.star_rating}
                        onChange={(_, v) => setVal("star_rating", v)}
                        size="large"
                        precision={1}
                      />
                      {form.star_rating && (
                        <Button size="small" onClick={() => setVal("star_rating", null)} sx={{ fontSize: "0.7rem" }}>
                          Clear
                        </Button>
                      )}
                      {!form.star_rating && (
                        <Typography variant="caption" color="text.secondary">Unrated</Typography>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </Box>
            </Stack>
          )}

          {/* ─ Step 1: Location & Contact ───────────────────────── */}
          {step === 1 && (
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, display: "flex", alignItems: "center", gap: 0.75 }}>
                  <LocationCity fontSize="small" color="primary" /> Location
                </Typography>
                <Stack spacing={2}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>City *</InputLabel>
                    <Select
                      value={form.city_id}
                      label="City *"
                      onChange={(e) => setVal("city_id", e.target.value)}
                    >
                      {cities.map((c: any) => (
                        <MenuItem key={c.id} value={c.id}>{c.name}, {c.state_name ?? ""}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    label="Address *"
                    value={form.address}
                    onChange={set("address")}
                    size="small"
                    fullWidth
                    multiline
                    rows={2}
                  />

                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="Address Line 2"
                      value={form.address_line_2}
                      onChange={set("address_line_2")}
                      size="small"
                      sx={{ flex: 2 }}
                    />
                    <TextField
                      label="Postal Code"
                      value={form.postal_code}
                      onChange={set("postal_code")}
                      size="small"
                      sx={{ flex: 1 }}
                      inputProps={{ maxLength: 10 }}
                    />
                  </Stack>

                  <TextField
                    label="Landmark"
                    value={form.landmark}
                    onChange={set("landmark")}
                    size="small"
                    fullWidth
                    placeholder="e.g. Near City Mall, Opposite Bus Stand"
                  />

                  {/* Lat/Lng with map picker */}
                  <Stack direction="row" spacing={2} alignItems="center">
                    <TextField
                      label="Latitude"
                      value={form.latitude}
                      onChange={set("latitude")}
                      size="small"
                      sx={{ flex: 1 }}
                      placeholder="e.g. 20.2961"
                      type="number"
                    />
                    <TextField
                      label="Longitude"
                      value={form.longitude}
                      onChange={set("longitude")}
                      size="small"
                      sx={{ flex: 1 }}
                      placeholder="e.g. 85.8245"
                      type="number"
                    />
                    {mapsApiKey && (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<MyLocation />}
                        onClick={() => setMapOpen(true)}
                        sx={{ whiteSpace: "nowrap", flexShrink: 0 }}
                      >
                        Pick on map
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                  Contact Details
                </Typography>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="Contact Person"
                      value={form.contact_person}
                      onChange={set("contact_person")}
                      size="small"
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Mobile Number"
                      value={form.contact_number}
                      onChange={set("contact_number")}
                      size="small"
                      sx={{ flex: 1 }}
                      error={!!form.contact_number && !MOBILE_REGEX.test(form.contact_number)}
                      helperText={form.contact_number && !MOBILE_REGEX.test(form.contact_number) ? "Invalid mobile number" : ""}
                      inputProps={{ maxLength: 10 }}
                    />
                  </Stack>
                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="Alternate Number"
                      value={form.alternate_number}
                      onChange={set("alternate_number")}
                      size="small"
                      sx={{ flex: 1 }}
                      inputProps={{ maxLength: 10 }}
                    />
                    <TextField
                      label="Email"
                      value={form.email}
                      onChange={set("email")}
                      size="small"
                      sx={{ flex: 1 }}
                      type="email"
                      error={!!form.email && !EMAIL_REGEX.test(form.email)}
                      helperText={form.email && !EMAIL_REGEX.test(form.email) ? "Invalid email" : ""}
                    />
                  </Stack>
                  <TextField
                    label="Website URL"
                    value={form.website_url}
                    onChange={set("website_url")}
                    size="small"
                    fullWidth
                    placeholder="https://..."
                  />
                </Stack>
              </Box>
            </Stack>
          )}

          {/* ─ Step 2: Tax & Review ─────────────────────────────── */}
          {step === 2 && (
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, display: "flex", alignItems: "center", gap: 0.75 }}>
                  <ReceiptLong fontSize="small" color="primary" /> Tax & Registration
                </Typography>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="GST Number"
                      value={form.gst_number}
                      onChange={(e) => setVal("gst_number", e.target.value.toUpperCase())}
                      size="small"
                      sx={{ flex: 1 }}
                      error={!!form.gst_number && !GST_REGEX.test(form.gst_number.toUpperCase())}
                      helperText={form.gst_number && !GST_REGEX.test(form.gst_number.toUpperCase()) ? "Invalid GST format (e.g. 22AAAAA0000A1Z5)" : ""}
                      inputProps={{ maxLength: 15 }}
                    />
                    <TextField
                      label="PAN Number"
                      value={form.pan_number}
                      onChange={(e) => setVal("pan_number", e.target.value.toUpperCase())}
                      size="small"
                      sx={{ flex: 1 }}
                      error={!!form.pan_number && !PAN_REGEX.test(form.pan_number.toUpperCase())}
                      helperText={form.pan_number && !PAN_REGEX.test(form.pan_number.toUpperCase()) ? "Invalid PAN format (e.g. ABCDE1234F)" : ""}
                      inputProps={{ maxLength: 10 }}
                    />
                  </Stack>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.is_gst_registered}
                        onChange={(e) => setVal("is_gst_registered", e.target.checked)}
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2">GST Registered Property</Typography>
                    }
                  />

                  <FormControl size="small" fullWidth disabled={!platformGstEnabled}>
                    <InputLabel>Tax Mode</InputLabel>
                    <Select
                      value={form.tax_mode}
                      label="Tax Mode"
                      onChange={(e) => setVal("tax_mode", e.target.value)}
                    >
                      <MenuItem value="INCLUSIVE">Inclusive (GST within the displayed rate)</MenuItem>
                      <MenuItem value="EXCLUSIVE">Exclusive (GST added on top)</MenuItem>
                      <MenuItem value="EXEMPT">Exempt</MenuItem>
                    </Select>
                  </FormControl>

                  {!platformGstEnabled && (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                      <strong>Global GST is disabled.</strong> Tax mode will be saved but will have no effect until an admin enables GST in platform settings.
                    </Alert>
                  )}
                </Stack>
              </Box>

              <Divider />

              {/* Review summary */}
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Review</Typography>
                <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
                  <Stack spacing={1}>
                    {[
                      ["Partner", selectedPartner ? `${selectedPartner.owner_name ?? "—"} (${selectedPartner.partner_code})` : "—"],
                      ["Hotel Name", form.hotel_name || "—"],
                      ["Category", categories.find((c: any) => c.id === Number(form.hotel_category_id))?.label ?? "None"],
                      ["Star Rating", form.star_rating ? `${form.star_rating}★` : "Unrated"],
                      ["City", selectedCity?.name ?? "—"],
                      ["Address", form.address || "—"],
                      ["Contact", form.contact_number || "—"],
                    ].map(([label, value]) => (
                      <Stack key={label} direction="row" spacing={1}>
                        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>{label}</Typography>
                        <Typography variant="body2" fontWeight={500}>{value}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Paper>

                <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
                  <AlertTitle sx={{ fontWeight: 700, mb: 0 }}>Creating as DRAFT</AlertTitle>
                  The hotel will be created in Draft status. You'll add rooms, pricing, images, and documents before submitting for verification.
                </Alert>
              </Box>
            </Stack>
          )}
        </DialogContent>

        {/* ── Actions ───────────────────────────────────────────── */}
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
          <Button onClick={handleClose} variant="text" color="inherit">Cancel</Button>
          <Box sx={{ flex: 1 }} />
          {step > 0 && (
            <Button startIcon={<ArrowBack />} onClick={() => setStep((s) => s - 1)} variant="outlined">
              Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button
              endIcon={<ArrowForward />}
              onClick={() => setStep((s) => s + 1)}
              variant="contained"
              disabled={step === 0 ? !step0Valid : step === 1 ? !step1Valid : false}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              color="primary"
              onClick={() => mutation.mutate()}
              disabled={!step2Valid || mutation.isPending}
              startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <Check />}
            >
              {mutation.isPending ? "Creating…" : "Create Hotel"}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Map picker */}
      {mapsApiKey && (
        <GoogleMapPickerModal
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          onConfirm={handleMapConfirm}
          title="Pick Hotel Location"
          apiKey={mapsApiKey}
          cityName={selectedCity?.name}
          initialLat={form.latitude ? Number(form.latitude) : undefined}
          initialLng={form.longitude ? Number(form.longitude) : undefined}
          markerColor="green"
        />
      )}
    </>
  );
}
