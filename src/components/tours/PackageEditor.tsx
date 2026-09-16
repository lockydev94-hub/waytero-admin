// WAYTERO ADMIN — TOUR PACKAGE EDITOR
// Multi-step visual editor for creating/editing a tour package on behalf
// of a partner. Mirrors the hotel wizard pattern but condensed to fit
// inside a single Dialog with a stepper. Each step validates its own
// fields and only the final Review step allows saving.
// Doc Ref: BRD_PART_5_TOUR_PACKAGE_MANAGEMENT §2-§4
// ============================================================
import { useEffect, useMemo, useState } from "react";
import {
  Box, Typography, Stack, Stepper, Step, StepLabel, Grid, TextField, MenuItem,
  Button, IconButton, Divider, Card, CardContent, Chip, Alert, Tooltip, Avatar,
  Switch, FormControlLabel, InputAdornment,
} from "@mui/material";
import {
  Add, Delete, ArrowBack, ArrowForward, CheckCircle, LocationOn,
  CalendarMonth, People, AccessTime, Image as ImageIcon, Visibility,
  Schedule, AttachMoney, LocalActivity, Bookmark, Star, Hotel, Flight,
  Restaurant, DirectionsBus, CameraAlt, Museum, BeachAccess, Hiking,
  Groups, Verified, Save, Send, Description, ListAlt, StarBorder, StarRate,
  CloudUpload,
} from "@mui/icons-material";
import { tourService, TourPackage } from "../../services/tour.service";
import { apiErrorMessage } from "../../utils/apiError";
import MediaPicker from "../media/MediaPicker";
import type { MediaLibraryItem } from "../../services/media.service";

const PACKAGE_TYPES = [
  { value: "FIXED", label: "Fixed Departure", icon: <Schedule /> },
  { value: "PRIVATE", label: "Private Tour", icon: <Verified /> },
  { value: "GROUP", label: "Group Tour", icon: <Groups /> },
  { value: "PILGRIMAGE", label: "Pilgrimage", icon: <Bookmark /> },
  { value: "CORPORATE", label: "Corporate / MICE", icon: <LocalActivity /> },
];

const STEPS = [
  { key: "basics", label: "Basics", icon: <Description /> },
  { key: "itinerary", label: "Itinerary", icon: <ListAlt /> },
  { key: "inclusions", label: "Inclusions", icon: <CheckCircle /> },
  { key: "pricing", label: "Pricing", icon: <AttachMoney /> },
  { key: "media", label: "Media", icon: <ImageIcon /> },
  { key: "review", label: "Review", icon: <Visibility /> },
];

interface Partner { id: number; business_name?: string; owner_name?: string; partner_code?: string; }
interface City { id: number; name: string; state_name?: string; }

interface PackageEditorProps {
  open: boolean;
  initial: TourPackage | null;
  partners: Partner[];
  cities: City[];
  onClose: () => void;
  onSaved: () => void;
}

// ── Activity input ──────────────────────────────────────────────
// Small controlled component for the per-day activity tag input.
// Previously the Add button read its sibling TextField via
// `previousSibling`, which breaks with MUI's nested DOM (the input is
// not a direct sibling of the button), so clicking Add silently did
// nothing. Keeping the value in state makes both Enter and the Add
// button behave identically.
function ActivityInput({ onAdd }: { onAdd: (value: string) => void }) {
  const [value, setValue] = useState("");
  const submit = () => {
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue("");
  };
  return (
    <Stack direction="row" spacing={1}>
      <TextField
        fullWidth
        size="small"
        placeholder="Add an activity (e.g. Visit Amber Fort)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
      />
      <Button onClick={submit}>Add</Button>
    </Stack>
  );
}

const blankForm = () => ({
  partner_id: "",
  package_name: "",
  package_type: "FIXED",
  destination: "",
  city_id: "",
  duration_days: 3,
  duration_nights: 2,
  minimum_persons: 1,
  maximum_persons: 12,
  short_description: "",
  description: "",
  terms_and_conditions: "",
  itinerary: [] as Array<{ day_number: number; title: string; description: string; activities: string[] }>,
  inclusions: [] as string[],
  exclusions: [] as string[],
  pricing: [] as Array<{ persons_count: number; package_price: number; effective_from: string; effective_to: string }>,
  media: [] as Array<{ media_url: string; caption: string; is_primary: boolean }>,
});

function fromPackage(p: TourPackage) {
  return {
    partner_id: String(p.partner_id || ""),
    package_name: p.package_name || "",
    package_type: p.package_type || "FIXED",
    destination: p.destination || "",
    city_id: String(p.city_id || ""),
    duration_days: p.duration_days || 1,
    duration_nights: p.duration_nights || 0,
    minimum_persons: p.minimum_persons || 1,
    maximum_persons: p.maximum_persons || 12,
    short_description: p.short_description || "",
    description: p.description || "",
    terms_and_conditions: p.terms_and_conditions || "",
    itinerary: (p.itinerary || []).map(d => ({
      day_number: d.day_number, title: d.title || "", description: d.description || "", activities: d.activities || [],
    })),
    inclusions: (p.inclusions || []).map(x => x.text),
    exclusions: (p.exclusions || []).map(x => x.text),
    pricing: (p.pricing || []).map(x => ({
      persons_count: x.persons_count, package_price: x.package_price,
      effective_from: x.effective_from || "", effective_to: x.effective_to || "",
    })),
    media: (p.media || []).map(m => ({ media_url: m.media_url, caption: m.caption || "", is_primary: !!m.is_primary })),
  };
}

export default function PackageEditor({ open, initial, partners, cities, onClose, onSaved }: PackageEditorProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<any>(blankForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setError(null);
      setSuccess(false);
      setForm(initial ? fromPackage(initial) : blankForm());
    }
  }, [open, initial]);

  const update = (k: string, v: any) => setForm((s: any) => ({ ...s, [k]: v }));
  const isEdit = !!initial;

  // ── Step validation ───────────────────────────────────────────
  const stepValid = useMemo(() => {
    if (step === 0) {
      if (!form.partner_id) return "Select a partner";
      if (!form.package_name.trim() || form.package_name.trim().length < 3) return "Package name is required (min 3 chars)";
      if (!form.destination.trim()) return "Destination is required";
      if (!form.city_id) return "Pick a primary city";
      if (form.duration_days < 1) return "Duration must be at least 1 day";
      if (form.duration_nights < 0) return "Nights cannot be negative";
      if (form.maximum_persons && form.maximum_persons < form.minimum_persons) return "Max pax must be ≥ min pax";
      if (!form.short_description.trim()) return "Short description helps travellers decide — add one";
    }
    if (step === 1) {
      if (form.itinerary.length === 0) return "Add at least one day to the itinerary";
    }
    if (step === 3) {
      if (form.pricing.length === 0) return "Add at least one pricing slab";
      const sorted = [...form.pricing].sort((a, b) => a.persons_count - b.persons_count);
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].package_price <= 0) return "All pricing slabs must have a positive price";
      }
    }
    if (step === 4) {
      if (form.media.length === 0) return "Add at least one image (mark one as primary)";
      if (!form.media.some((m: any) => m.is_primary)) return "Mark one image as primary";
    }
    return null;
  }, [step, form]);

  // ── Itinerary helpers ────────────────────────────────────────
  const addDay = () => setForm((s: any) => ({ ...s, itinerary: [...s.itinerary, { day_number: s.itinerary.length + 1, title: "", description: "", activities: [] }] }));
  const removeDay = (idx: number) => setForm((s: any) => ({ ...s, itinerary: s.itinerary.filter((_: any, i: number) => i !== idx).map((d: any, i: number) => ({ ...d, day_number: i + 1 })) }));
  const updateDay = (idx: number, k: string, v: any) => setForm((s: any) => ({ ...s, itinerary: s.itinerary.map((d: any, i: number) => i === idx ? { ...d, [k]: v } : d) }));
  const addActivity = (idx: number, a: string) => { if (!a.trim()) return; setForm((s: any) => ({ ...s, itinerary: s.itinerary.map((d: any, i: number) => i === idx ? { ...d, activities: [...d.activities, a.trim()] } : d) })); };
  const removeActivity = (idx: number, ai: number) => setForm((s: any) => ({ ...s, itinerary: s.itinerary.map((d: any, i: number) => i === idx ? { ...d, activities: d.activities.filter((_: any, j: number) => j !== ai) } : d) }));

  // ── Inclusions/exclusions helpers ────────────────────────────
  const addListItem = (k: "inclusions" | "exclusions", value: string) => {
    if (!value.trim()) return;
    setForm((s: any) => ({ ...s, [k]: [...s[k], value.trim()] }));
  };
  const removeListItem = (k: "inclusions" | "exclusions", idx: number) => {
    setForm((s: any) => ({ ...s, [k]: s[k].filter((_: any, i: number) => i !== idx) }));
  };

  // ── Pricing helpers ──────────────────────────────────────────
  const addPrice = () => setForm((s: any) => {
    const last = s.pricing[s.pricing.length - 1];
    return { ...s, pricing: [...s.pricing, { persons_count: last ? last.persons_count + 2 : 2, package_price: 0, effective_from: "", effective_to: "" }] };
  });
  const removePrice = (idx: number) => setForm((s: any) => ({ ...s, pricing: s.pricing.filter((_: any, i: number) => i !== idx) }));
  const updatePrice = (idx: number, k: string, v: any) => setForm((s: any) => ({ ...s, pricing: s.pricing.map((p: any, i: number) => i === idx ? { ...p, [k]: v } : p) }));

  // ── Media helpers ────────────────────────────────────────────
  const addMedia = (url: string, caption: string) => {
    if (!url.trim()) return;
    setForm((s: any) => ({ ...s, media: [...s.media, { media_url: url.trim(), caption: caption.trim(), is_primary: s.media.length === 0 }] }));
  };
  const removeMedia = (idx: number) => setForm((s: any) => {
    const next = s.media.filter((_: any, i: number) => i !== idx);
    if (next.length && !next.some((m: any) => m.is_primary)) next[0].is_primary = true;
    return { ...s, media: next };
  });
  const setPrimary = (idx: number) => setForm((s: any) => ({ ...s, media: s.media.map((m: any, i: number) => ({ ...m, is_primary: i === idx })) }));
  const handlePicked = (items: MediaLibraryItem[]) => {
    if (!items.length) return;
    items.forEach((item) => addMedia(item.secure_url, ""));
  };

  // ── Save ─────────────────────────────────────────────────────
  const buildPayload = (submitForReview: boolean) => ({
    partner_id: Number(form.partner_id),
    package_name: form.package_name.trim(),
    package_type: form.package_type,
    destination: form.destination.trim(),
    city_id: Number(form.city_id),
    duration_days: Number(form.duration_days),
    duration_nights: Number(form.duration_nights),
    minimum_persons: Number(form.minimum_persons),
    maximum_persons: form.maximum_persons ? Number(form.maximum_persons) : null,
    short_description: form.short_description.trim() || null,
    description: form.description.trim() || null,
    terms_and_conditions: form.terms_and_conditions.trim() || null,
    itinerary: form.itinerary.map((d: any) => ({
      day_number: d.day_number, title: d.title, description: d.description || null, activities: d.activities,
    })),
    inclusions: form.inclusions,
    exclusions: form.exclusions,
    pricing: form.pricing.map((p: any) => ({
      persons_count: Number(p.persons_count), package_price: Number(p.package_price),
      effective_from: p.effective_from || null, effective_to: p.effective_to || null,
    })),
    media: form.media.map((m: any, i: number) => ({
      media_url: m.media_url, caption: m.caption || null, is_primary: m.is_primary, display_order: i, media_type: "IMAGE",
    })),
    ...(submitForReview ? { status: "PENDING_APPROVAL" } : {}),
  });

  const save = async (submitForReview = false) => {
    setError(null);
    // Walk all step validations to make sure nothing is missed.
    for (let i = 0; i <= 4; i++) {
      const v = [null,
        form.partner_id && form.package_name.trim().length >= 3 && form.destination.trim() && form.city_id ? null : "Fix Basics",
        form.itinerary.length === 0 ? "Add at least one itinerary day" : null,
        form.inclusions.length === 0 ? "Add at least one inclusion" : null,
        form.pricing.length === 0 || form.pricing.some((p: any) => !p.package_price) ? "Fix pricing" : null,
      ][i];
      if (v) { setStep(i); setError(v); return; }
    }
    setSaving(true);
    try {
      // Mirror the hotel wizard: make sure the selected partner has the TOUR
      // service enabled before saving. Idempotent + additive on the backend,
      // so this is safe to call on every save.
      await tourService.enableTourService(Number(form.partner_id));
      const payload = buildPayload(submitForReview);
      let saved: TourPackage;
      if (isEdit) saved = await tourService.updatePackage(initial!.id, payload);
      else saved = await tourService.createPackage(payload);
      if (submitForReview && saved.id) {
        await tourService.setPackageStatus(saved.id, "PENDING_APPROVAL");
      }
      setSuccess(true);
      setTimeout(() => onSaved(), 800);
    } catch (e: any) {
      // apiErrorMessage renders FastAPI 422 detail arrays ("field: message")
      // and the WayTero envelope — a bare fallback hides the actual reason.
      setError(apiErrorMessage(e, "Could not save this package"));
    } finally {
      setSaving(false);
    }
  };

  const partnerName = (id: string) => partners.find(p => String(p.id) === id)?.business_name || partners.find(p => String(p.id) === id)?.owner_name || "—";
  const cityName = (id: string) => cities.find(c => String(c.id) === id)?.name || "—";
  const startingPrice = useMemo(() => {
    if (form.pricing.length === 0) return 0;
    return Math.min(...form.pricing.map((p: any) => Number(p.package_price) || 0));
  }, [form.pricing]);

  return (
    <Box>
      {/* Stepper header */}
      <Box sx={{ px: 1, pt: 1 }}>
        <Stepper activeStep={step} alternativeLabel>
          {STEPS.map((s, i) => (
            <Step key={s.key} completed={step > i}>
              <StepLabel icon={s.icon}>{s.label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <Divider sx={{ my: 2 }} />

      {error && <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>Saved successfully. Closing editor…</Alert>}

      {/* ── Step 1: Basics ────────────────────────────────────── */}
      {step === 0 && (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="subtitle2" fontWeight={800}>Package type</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
              {PACKAGE_TYPES.map(pt => (
                <Chip
                  key={pt.value}
                  icon={pt.icon as any}
                  label={pt.label}
                  onClick={() => update("package_type", pt.value)}
                  color={form.package_type === pt.value ? "primary" : "default"}
                  variant={form.package_type === pt.value ? "filled" : "outlined"}
                  sx={{ fontWeight: 700 }}
                />
              ))}
            </Stack>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField select fullWidth label="Partner" value={form.partner_id} onChange={e => update("partner_id", e.target.value)} disabled={isEdit} required>
              <MenuItem value="">Select a partner</MenuItem>
              {partners.map(p => <MenuItem key={p.id} value={String(p.id)}>{p.business_name || p.owner_name} · {p.partner_code}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Package name" placeholder="e.g. Royal Rajasthan Heritage Tour" value={form.package_name} onChange={e => update("package_name", e.target.value)} required />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Destination" placeholder="e.g. Rajasthan" value={form.destination} onChange={e => update("destination", e.target.value)} required
              InputProps={{ startAdornment: <InputAdornment position="start"><LocationOn fontSize="small" /></InputAdornment> }} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField select fullWidth label="Primary city" value={form.city_id} onChange={e => update("city_id", e.target.value)} required>
              <MenuItem value="">Select city</MenuItem>
              {cities.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}{c.state_name ? `, ${c.state_name}` : ""}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField fullWidth type="number" label="Days" value={form.duration_days} onChange={e => update("duration_days", Number(e.target.value))} InputProps={{ startAdornment: <InputAdornment position="start"><CalendarMonth fontSize="small" /></InputAdornment> }} />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField fullWidth type="number" label="Nights" value={form.duration_nights} onChange={e => update("duration_nights", Number(e.target.value))} />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField fullWidth type="number" label="Min pax" value={form.minimum_persons} onChange={e => update("minimum_persons", Number(e.target.value))} InputProps={{ startAdornment: <InputAdornment position="start"><People fontSize="small" /></InputAdornment> }} />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField fullWidth type="number" label="Max pax" value={form.maximum_persons} onChange={e => update("maximum_persons", Number(e.target.value))} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth multiline minRows={2} maxRows={4} label="Short description" placeholder="One-line pitch shown on the listing card (max 500 chars)" value={form.short_description} onChange={e => update("short_description", e.target.value)} helperText={`${form.short_description.length}/500`} inputProps={{ maxLength: 500 }} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth multiline minRows={5} label="Full description" placeholder="Tell the story of the trip — highlights, what makes it special, vibe, who it's for" value={form.description} onChange={e => update("description", e.target.value)} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth multiline minRows={5} label="Terms & conditions" placeholder="Cancellation policy, payment terms, inclusions/exclusions summary" value={form.terms_and_conditions} onChange={e => update("terms_and_conditions", e.target.value)} />
          </Grid>
        </Grid>
      )}

      {/* ── Step 2: Itinerary ─────────────────────────────────── */}
      {step === 1 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>Day-by-day itinerary</Typography>
              <Typography variant="body2" color="text.secondary">Break the trip into days. Each day can have activities shown as tags.</Typography>
            </Box>
            <Button startIcon={<Add />} variant="contained" onClick={addDay}>Add day</Button>
          </Stack>
          {form.itinerary.length === 0 && (
            <Alert severity="info">No days yet. Add the first day of the trip — usually arrival & check-in.</Alert>
          )}
          <Stack spacing={1.5}>
            {form.itinerary.map((day: any, idx: number) => (
              <Card key={idx} variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: "primary.main", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800 }}>{day.day_number}</Box>
                    <TextField fullWidth size="small" label="Day title" placeholder="e.g. Arrival in Jaipur & city tour" value={day.title} onChange={e => updateDay(idx, "title", e.target.value)} />
                    <IconButton onClick={() => removeDay(idx)} color="error"><Delete /></IconButton>
                  </Stack>
                  <TextField fullWidth size="small" multiline minRows={2} label="Description" placeholder="What happens on this day" value={day.description} onChange={e => updateDay(idx, "description", e.target.value)} sx={{ mb: 1.5 }} />
                  <Box>
                    <Typography variant="caption" fontWeight={700} color="text.secondary">ACTIVITIES</Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5, mb: 1, gap: 0.5 }}>
                      {day.activities.map((a: string, ai: number) => (
                        <Chip key={ai} label={a} onDelete={() => removeActivity(idx, ai)} size="small" />
                      ))}
                    </Stack>
                    <ActivityInput onAdd={(a) => addActivity(idx, a)} />
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      )}

      {/* ── Step 3: Inclusions / Exclusions ───────────────────── */}
      {step === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" fontWeight={800}>What's included</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>List every benefit that comes with the package.</Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <TextField fullWidth size="small" id="incl-input" placeholder="e.g. 3 nights hotel stay" onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addListItem("inclusions", (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ""; }
              }} />
              <Button onClick={() => {
                const el = document.getElementById("incl-input") as HTMLInputElement;
                addListItem("inclusions", el.value); el.value = "";
              }} variant="contained" startIcon={<Add />}>Add</Button>
            </Stack>
            <Stack spacing={1}>
              {form.inclusions.map((x: string, i: number) => (
                <Stack key={i} direction="row" alignItems="center" spacing={1} sx={{ p: 1, bgcolor: "success.50", borderRadius: 1 }}>
                  <CheckCircle color="success" fontSize="small" />
                  <Typography sx={{ flex: 1, fontSize: 14 }}>{x}</Typography>
                  <IconButton size="small" onClick={() => removeListItem("inclusions", i)}><Delete fontSize="small" /></IconButton>
                </Stack>
              ))}
              {form.inclusions.length === 0 && <Alert severity="info">No inclusions yet.</Alert>}
            </Stack>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" fontWeight={800}>What's not included</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Be transparent about what travellers pay extra for.</Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <TextField fullWidth size="small" id="excl-input" placeholder="e.g. Air tickets" onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addListItem("exclusions", (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ""; }
              }} />
              <Button onClick={() => {
                const el = document.getElementById("excl-input") as HTMLInputElement;
                addListItem("exclusions", el.value); el.value = "";
              }} variant="outlined" color="error" startIcon={<Add />}>Add</Button>
            </Stack>
            <Stack spacing={1}>
              {form.exclusions.map((x: string, i: number) => (
                <Stack key={i} direction="row" alignItems="center" spacing={1} sx={{ p: 1, bgcolor: "error.50", borderRadius: 1 }}>
                  <Box sx={{ width: 20, height: 20, borderRadius: "50%", bgcolor: "error.main", color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800 }}>×</Box>
                  <Typography sx={{ flex: 1, fontSize: 14 }}>{x}</Typography>
                  <IconButton size="small" onClick={() => removeListItem("exclusions", i)}><Delete fontSize="small" /></IconButton>
                </Stack>
              ))}
              {form.exclusions.length === 0 && <Alert severity="info">No exclusions yet.</Alert>}
            </Stack>
          </Grid>
        </Grid>
      )}

      {/* ── Step 4: Pricing ───────────────────────────────────── */}
      {step === 3 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>Pricing slabs</Typography>
              <Typography variant="body2" color="text.secondary">Define price per pax for different group sizes. Sorted ascending by pax on save.</Typography>
            </Box>
            <Button startIcon={<Add />} variant="contained" onClick={addPrice}>Add slab</Button>
          </Stack>
          {form.pricing.length === 0 && <Alert severity="info" sx={{ mb: 2 }}>No pricing yet — add at least one slab.</Alert>}
          <Stack spacing={1.5}>
            {[...form.pricing].sort((a: any, b: any) => a.persons_count - b.persons_count).map((p: any, idx: number) => {
              const realIdx = form.pricing.findIndex((x: any) => x === p);
              return (
                <Card key={idx} variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={6} sm={2}>
                        <TextField fullWidth size="small" type="number" label="Pax" value={p.persons_count} onChange={e => updatePrice(realIdx, "persons_count", Number(e.target.value))} />
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <TextField fullWidth size="small" type="number" label="Total price" value={p.package_price} onChange={e => updatePrice(realIdx, "package_price", Number(e.target.value))}
                          InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} />
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <TextField fullWidth size="small" type="date" label="Effective from" InputLabelProps={{ shrink: true }} value={p.effective_from} onChange={e => updatePrice(realIdx, "effective_from", e.target.value)} />
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <TextField fullWidth size="small" type="date" label="Effective to" InputLabelProps={{ shrink: true }} value={p.effective_to} onChange={e => updatePrice(realIdx, "effective_to", e.target.value)} />
                      </Grid>
                      <Grid item xs={12} sm={1} sx={{ textAlign: "right" }}>
                        <IconButton onClick={() => removePrice(realIdx)} color="error"><Delete /></IconButton>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
          {startingPrice > 0 && (
            <Alert severity="success" sx={{ mt: 2 }}>Starting price: <b>₹{startingPrice.toLocaleString("en-IN")}</b> per package</Alert>
          )}
        </Box>
      )}

      {/* ── Step 5: Media ─────────────────────────────────────── */}
      {step === 4 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>Media gallery</Typography>
              <Typography variant="body2" color="text.secondary">Upload images from your device or paste an image URL. Mark one as the primary hero image.</Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button variant="contained" startIcon={<CloudUpload />} onClick={() => setPickerOpen(true)}>
              Upload from device
            </Button>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center">
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>or add by URL:</Typography>
            <TextField fullWidth size="small" id="media-url" placeholder="https://... (image URL)" />
            <TextField size="small" id="media-cap" placeholder="Caption (optional)" sx={{ minWidth: 220 }} />
            <Button onClick={() => {
              const url = (document.getElementById("media-url") as HTMLInputElement).value;
              const cap = (document.getElementById("media-cap") as HTMLInputElement).value;
              addMedia(url, cap);
              (document.getElementById("media-url") as HTMLInputElement).value = "";
              (document.getElementById("media-cap") as HTMLInputElement).value = "";
            }} variant="outlined" startIcon={<Add />}>Add</Button>
          </Stack>
          {form.media.length === 0 && <Alert severity="info">No images yet. Upload at least one.</Alert>}
          <Grid container spacing={2}>
            {form.media.map((m: any, idx: number) => (
              <Grid item xs={12} sm={6} md={4} key={idx}>
                <Card variant="outlined" sx={{ borderRadius: 2, borderColor: m.is_primary ? "primary.main" : "divider", borderWidth: m.is_primary ? 2 : 1 }}>
                  <Box sx={{ position: "relative", aspectRatio: "4/3", bgcolor: "grey.100" }}>
                    <img src={m.media_url} alt={m.caption || `image ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    {m.is_primary && <Chip label="Primary" color="primary" size="small" sx={{ position: "absolute", top: 8, left: 8 } as any} />}
                  </Box>
                  <CardContent sx={{ p: 1.5 }}>
                    <Typography variant="body2" noWrap>{m.caption || m.media_url.split("/").pop()}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      {!m.is_primary && <Button size="small" startIcon={<StarBorder />} onClick={() => setPrimary(idx)}>Set primary</Button>}
                      <IconButton size="small" onClick={() => removeMedia(idx)} color="error"><Delete fontSize="small" /></IconButton>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* ── Step 6: Review ────────────────────────────────────── */}
      {step === 5 && (
        <Box>
          <Card variant="outlined" sx={{ borderRadius: 2, mb: 2, overflow: "hidden" }}>
            {form.media.find((m: any) => m.is_primary) && (
              <Box sx={{ aspectRatio: "21/9", bgcolor: "grey.100" }}>
                <img src={form.media.find((m: any) => m.is_primary).media_url} alt="hero" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </Box>
            )}
            <CardContent>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <Chip label={PACKAGE_TYPES.find(t => t.value === form.package_type)?.label || form.package_type} size="small" color="primary" />
                <Chip label={`${form.duration_days}D/${form.duration_nights}N`} size="small" icon={<AccessTime />} />
                <Chip label={`${form.minimum_persons}–${form.maximum_persons || "∞"} pax`} size="small" icon={<People />} />
              </Stack>
              <Typography variant="h5" fontWeight={900}>{form.package_name || "Untitled package"}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{partnerName(form.partner_id)} · {cityName(form.city_id)} · {form.destination}</Typography>
              {form.short_description && <Typography sx={{ mb: 2 }}>{form.short_description}</Typography>}
              {startingPrice > 0 && (
                <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 2 }}>
                  <Typography variant="h4" fontWeight={900} color="primary.main">₹{startingPrice.toLocaleString("en-IN")}</Typography>
                  <Typography variant="body2" color="text.secondary">starting from per package</Typography>
                </Stack>
              )}
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>Itinerary — {form.itinerary.length} days</Typography>
              <Stack spacing={1} sx={{ mb: 2 }}>
                {form.itinerary.map((d: any, i: number) => (
                  <Stack key={i} direction="row" spacing={1.5} alignItems="flex-start">
                    <Box sx={{ minWidth: 28, height: 28, borderRadius: 1.5, bgcolor: "primary.main", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12 }}>{d.day_number}</Box>
                    <Box>
                      <Typography variant="body2" fontWeight={700}>{d.title}</Typography>
                      {d.description && <Typography variant="caption" color="text.secondary">{d.description}</Typography>}
                    </Box>
                  </Stack>
                ))}
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" fontWeight={800} color="success.main">✓ Included ({form.inclusions.length})</Typography>
                  {form.inclusions.map((x: string, i: number) => <Typography key={i} variant="body2" sx={{ pl: 2 }}>• {x}</Typography>)}
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" fontWeight={800} color="error.main">✗ Not included ({form.exclusions.length})</Typography>
                  {form.exclusions.map((x: string, i: number) => <Typography key={i} variant="body2" sx={{ pl: 2 }}>• {x}</Typography>)}
                </Grid>
              </Grid>
            </CardContent>
          </Card>
          <Alert severity="info">Click <b>Save package</b> to publish live on the website immediately. Admins can deactivate any time.</Alert>
        </Box>
      )}

      {/* Footer actions */}
      <Divider sx={{ my: 2 }} />
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Button startIcon={<ArrowBack />} onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0 || saving}>Back</Button>
        <Stack direction="row" spacing={1}>
          {step < STEPS.length - 1 ? (
            <Button endIcon={<ArrowForward />} variant="contained" onClick={() => { if (stepValid) { setError(stepValid); return; } setError(null); setStep(s => s + 1); }}>Continue</Button>
          ) : (
            <>
              <Button startIcon={<Save />} onClick={() => save(false)} disabled={saving || success} variant="outlined">Save package</Button>
            </>
          )}
        </Stack>
      </Stack>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePicked}
        folder="waytero/tours"
        uploadFolder="waytero/tours"
        kind="image"
        assetType="general"
        multiple
        title="Upload package images"
      />
    </Box>
  );
}
