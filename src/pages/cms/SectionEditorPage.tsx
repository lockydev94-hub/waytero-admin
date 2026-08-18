// ============================================================
// WAYTERO ADMIN — SECTION EDITOR PAGE
// Doc Ref: Migration 0044_website_cms
//
//  Route: /cms/sections/:sectionKey
//
//  Manages every variant of one homepage section (e.g. HERO).
//  Each variant is one row in section_variants; the editor here
//  uses the section_key to render the right typed slot set.
//
//  Per-section template (drives which slots the form shows):
//    HERO          — bg image / video, headline, sub, CTA, accent, mobile img
//    SERVICES      — grid icon, headline, body, CTA
//    WHY_US        — icon, headline, body, accent colour
//    TOUR_PACKAGES — icon, headline, body, CTA link
//    TESTIMONIALS  — icon, headline, body, accent
//    STATS         — icon, body (numbers)
//    PARTNERS      — icon, headline, CTA
//    CTA           — bg image, headline, body, CTA, accent
//
//  Schedule window (starts_at / ends_at) is supported on every variant.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Card, CardContent, Stack, Typography, Button, IconButton,
  Chip, CircularProgress, Tooltip, Switch, FormControlLabel,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, InputLabel, FormControl,
  Alert, Grid, Divider, alpha, useTheme,
} from "@mui/material";
import {
  ArrowBack, Add, Edit, Delete, PowerSettingsNew,
  Star, StarBorder, Schedule, Refresh, Storage,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import {
  cmsService, SectionVariant, SectionVariantCreatePayload,
  PageSection, ANIMATION_STYLES, TEXT_ALIGNMENTS, CmsPickerItem,
} from "../../services/cms.service";
import { apiErrorMessage } from "../../utils/apiError";

import MediaUploader, { CropSpec } from "./components/MediaUploader";
import ContentDataPicker, { ContentPickerConfig } from "./components/ContentDataPicker";

// ── Per-section slot templates ─────────────────────────────────
// The common slot set is used for every variant. Section key
// just adds metadata (icon hint / a default tag suggestion).

const SECTION_HINT: Record<string, string> = {
  HERO:          "Full-width banner at the very top of the homepage.",
  SERVICES:      "Grid of service cards (Cabs / Hotels / Tours).",
  WHY_US:        "Trust signals — why customers should choose WayTero.",
  TOUR_PACKAGES: "Featured tour packages.",
  TESTIMONIALS:  "Customer reviews / quotes.",
  STATS:         "Big-number platform stats (rides, cities, partners).",
  PARTNERS:      "Showcase of partner brands / fleet operators.",
  CTA:           "Closing call-to-action banner.",
  OFFERS:        "Limited-time deals / promotional banners.",
  POPULAR_DESTINATIONS: "Trending destinations grid.",
  HOW_IT_WORKS:  "Step-by-step guide to booking with WayTero.",
  FEATURED_HOTELS: "Handpicked partner hotels.",
  FAQ:           "Accordion of frequently asked questions.",
  NEWSLETTER:    "Email-capture band.",
  APP_DOWNLOAD:  "Mobile app promo band.",
  BLOG:          "Latest travel-stories / blog band.",
};

const SECTION_DEFAULT_TAG: Record<string, string> = {
  HERO:          "DEFAULT",
  SERVICES:      "DEFAULT",
  WHY_US:        "DEFAULT",
  TOUR_PACKAGES: "DEFAULT",
  TESTIMONIALS:  "DEFAULT",
  STATS:         "DEFAULT",
  PARTNERS:      "DEFAULT",
  CTA:           "DEFAULT",
  OFFERS:        "DEFAULT",
  POPULAR_DESTINATIONS: "DEFAULT",
  HOW_IT_WORKS:  "DEFAULT",
  FEATURED_HOTELS: "DEFAULT",
  FAQ:           "DEFAULT",
  NEWSLETTER:    "DEFAULT",
  APP_DOWNLOAD:  "DEFAULT",
  BLOG:          "DEFAULT",
};

// ── Content schema hints ───────────────────────────────────────
// These sections read a JSONB `content` column; the editor below
// exposes a monospace JSON field so admins can author the structured
// payload. The hint shows the exact shape the renderer expects.
const CONTENT_SCHEMA_HINT: Record<string, string> = {
  HOW_IT_WORKS:
    '{"steps": [{"title": "…", "description": "…", "icon": "Search | CalendarCheck | ShieldCheck | Plane | Car | Wallet | …"}]}',
  OFFERS:
    '{"offers": [{"title": "…", "description": "…", "badge": "…", "cta_text": "…", "cta_link": "/cabs"}]}',
  FAQ:
    '{"faqs": [{"question": "…", "answer": "…"}]}',
  STATS:
    '{"stats": [{"value": 50000, "suffix": "+", "label": "Happy Travelers"}]}',
  POPULAR_DESTINATIONS:
    '{"destinations": [{"name": "Goa", "state": "Goa", "starting_price": 4999, "trending": true, "image_url": null}]}',
  FEATURED_HOTELS:
    '{"hotels": [{"name": "…", "city": "…", "rating": 4.9, "reviews": 1200, "price": 9500, "old_price": null, "amenities": ["Wifi","Pool"], "tag": null, "image_url": null}]}',
};

// ── Content data pickers ───────────────────────────────────────
// Sections backed by live DB records get a "browse database" button in
// the modal. `type` hits GET /cms/picker-items?type=… and `key` is the
// content JSON array the selected records are appended to.
const CONTENT_PICKERS: Record<string, ContentPickerConfig> = {
  FEATURED_HOTELS: {
    type: "HOTELS",
    key: "hotels",
    label: "Hotels",
    help: "Pulls ACTIVE/APPROVED hotels from the database.",
  },
  OFFERS: {
    type: "COUPONS",
    key: "offers",
    label: "Coupons",
    help: "Pulls currently-valid active coupons from the database.",
  },
  POPULAR_DESTINATIONS: {
    type: "DESTINATIONS",
    key: "destinations",
    label: "Cities",
    help: "Pulls active cities (with state names) from the database.",
  },
  SERVICES: {
    type: "SERVICES",
    key: "items",
    label: "Service types",
    help: "Pulls active service types (Cab / Hotel / Tour) from the database.",
  },
};

// ── Crop specs ─────────────────────────────────────────────────
// Each MediaUploader accepts an optional CropSpec. When set, the
// picker pops a crop modal before uploading so the asset matches the
// container dimensions exactly. Values come from the section template:
//   HERO bg          16:9  desktop banner
//   HERO mobile      9:16  portrait phone
//   icon             1:1   square icon
//   CTA bg           21:9  wide cinematic
//   other bg         16:9  landscape
const CROP_BG:      CropSpec = { aspectRatio: 16 / 9,  outputWidth: 1920, outputHeight: 1080 };
const CROP_MOBILE:  CropSpec = { aspectRatio:  9 / 16, outputWidth:  720, outputHeight: 1280 };
const CROP_ICON:    CropSpec = { aspectRatio:  1,      outputWidth:  512, outputHeight:  512 };
const CROP_CTA:     CropSpec = { aspectRatio: 21 / 9,  outputWidth: 2100, outputHeight:  900 };

// ── Service type binding ───────────────────────────────────────
// Used by HERO/CTA: when set, customer-web injects the matching
// inline search form and routes submissions to the dedicated page.
// CAB  → /cabs (cab search)
// HOTEL → /hotels (hotel search)
// TOUR → /tours (tour search)
// ALL  → no inline search, just a static CTA
const SERVICE_TYPE_OPTIONS: Array<{ value: string; label: string; help: string }> = [
  { value: "",    label: "None (decorative)",     help: "No inline search — section is purely visual" },
  { value: "CAB",   label: "Cab booking (CAB)",   help: "Injects cab search form, submits to /cabs" },
  { value: "HOTEL", label: "Hotel booking (HOTEL)", help: "Injects hotel search form, submits to /hotels" },
  { value: "TOUR",  label: "Tour booking (TOUR)", help: "Injects tour search form, submits to /tours" },
  { value: "ALL",   label: "All services (ALL)",  help: "Generic CTA only — no inline search" },
];

// ── Form state ─────────────────────────────────────────────────

type FormState = SectionVariantCreatePayload;

const EMPTY_FORM: FormState = {
  variant_name: "",
  variant_tag: "",
  display_order: 0,
  is_active: false,
  headline: "",
  subheadline: "",
  body_text: "",
  cta_text: "",
  cta_link: "",
  background_image_url: "",
  background_video_url: "",
  mobile_image_url: "",
  icon_url: "",
  accent_color: "",
  animation_style: "NONE",
  text_alignment: "LEFT",
  overlay_opacity: 0.4,
  content: null,
  service_type: null,
  starts_at: null,
  ends_at: null,
};

// ──────────────────────────────────────────────────────────────
// SectionEditorPage
// ──────────────────────────────────────────────────────────────

export default function SectionEditorPage() {
  const { sectionKey = "" } = useParams<{ sectionKey: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const { data: sections = [] } = useQuery({
    queryKey: ["cms-sections"],
    queryFn: cmsService.listSections,
  });
  const section: PageSection | undefined = useMemo(
    () => sections.find((s) => s.section_key === sectionKey),
    [sections, sectionKey],
  );

  const { data: variants = [], isLoading, refetch } = useQuery({
    queryKey: ["cms-variants", sectionKey],
    queryFn: () => cmsService.listVariants(sectionKey),
    enabled: !!section,
  });

  // ── Dialog state ─────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SectionVariant | null>(null);
  const [contentText, setContentText] = useState<string>("");
  const [contentError, setContentError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerConfig = CONTENT_PICKERS[sectionKey];

  useEffect(() => {
    if (section) document.title = `CMS — ${section.display_name}`;
  }, [section]);

  // ── Mutations ────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (payload: SectionVariantCreatePayload) =>
      cmsService.createVariant(sectionKey, payload),
    onSuccess: () => {
      enqueueSnackbar("Variant created", { variant: "success" });
      closeDialog();
      qc.invalidateQueries({ queryKey: ["cms-variants", sectionKey] });
      qc.invalidateQueries({ queryKey: ["cms-sections"] });
    },
    onError: (e) => enqueueSnackbar(apiErrorMessage(e, "Create failed"), { variant: "error" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SectionVariantCreatePayload }) =>
      cmsService.updateVariant(id, payload),
    onSuccess: () => {
      enqueueSnackbar("Variant saved", { variant: "success" });
      closeDialog();
      qc.invalidateQueries({ queryKey: ["cms-variants", sectionKey] });
      qc.invalidateQueries({ queryKey: ["cms-sections"] });
    },
    onError: (e) => enqueueSnackbar(apiErrorMessage(e, "Save failed"), { variant: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => cmsService.deleteVariant(id),
    onSuccess: () => {
      enqueueSnackbar("Variant deleted", { variant: "success" });
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["cms-variants", sectionKey] });
      qc.invalidateQueries({ queryKey: ["cms-sections"] });
    },
    onError: (e) => enqueueSnackbar(apiErrorMessage(e, "Delete failed"), { variant: "error" }),
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => cmsService.activateVariant(id),
    onSuccess: () => {
      enqueueSnackbar("Variant activated on the homepage", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["cms-variants", sectionKey] });
      qc.invalidateQueries({ queryKey: ["cms-sections"] });
    },
    onError: (e) => enqueueSnackbar(apiErrorMessage(e, "Activate failed"), { variant: "error" }),
  });

  // ── Dialog helpers ───────────────────────────────────────────

  const openNew = () => {
    setForm({
      ...EMPTY_FORM,
      variant_tag: SECTION_DEFAULT_TAG[sectionKey] ?? "",
    });
    setEditingId(null);
    setContentText("");
    setContentError(null);
    setOpen(true);
  };

  const openEdit = (v: SectionVariant) => {
    setForm({
      variant_name:        v.variant_name,
      variant_tag:         v.variant_tag ?? "",
      display_order:       v.display_order,
      is_active:           v.is_active,
      headline:            v.headline ?? "",
      subheadline:         v.subheadline ?? "",
      body_text:           v.body_text ?? "",
      cta_text:            v.cta_text ?? "",
      cta_link:            v.cta_link ?? "",
      background_image_url: v.background_image_url ?? "",
      background_video_url: v.background_video_url ?? "",
      mobile_image_url:    v.mobile_image_url ?? "",
      icon_url:            v.icon_url ?? "",
      accent_color:        v.accent_color ?? "",
      animation_style:     v.animation_style ?? "NONE",
      text_alignment:      v.text_alignment ?? "LEFT",
      overlay_opacity:     v.overlay_opacity ?? 0.4,
      content:             v.content ?? null,
      service_type:        v.service_type ?? null,
      starts_at:           v.starts_at ?? null,
      ends_at:             v.ends_at ?? null,
    });
    setContentText(v.content ? JSON.stringify(v.content, null, 2) : "");
    setContentError(null);
    setEditingId(v.id);
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
  };

  const onSubmit = () => {
    if (!form.variant_name.trim()) {
      enqueueSnackbar("Variant name is required", { variant: "error" });
      return;
    }

    // Structured content — parse the JSON textarea into an object (or null).
    let parsedContent: Record<string, unknown> | null = null;
    if (contentText.trim()) {
      try {
        const parsed = JSON.parse(contentText);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          setContentError("Content must be a JSON object, e.g. { \"steps\": [...] }");
          return;
        }
        parsedContent = parsed as Record<string, unknown>;
      } catch {
        setContentError("Content is not valid JSON — fix the syntax before saving.");
        return;
      }
    }
    setContentError(null);

    const payload: SectionVariantCreatePayload = {
      ...form,
      // Strip empties → null
      variant_tag:          form.variant_tag?.trim()          || null,
      headline:             form.headline?.trim()             || null,
      subheadline:          form.subheadline?.trim()          || null,
      body_text:            form.body_text?.trim()            || null,
      cta_text:             form.cta_text?.trim()             || null,
      cta_link:             form.cta_link?.trim()             || null,
      background_image_url: form.background_image_url?.trim() || null,
      background_video_url: form.background_video_url?.trim() || null,
      mobile_image_url:     form.mobile_image_url?.trim()     || null,
      icon_url:             form.icon_url?.trim()             || null,
      accent_color:         form.accent_color?.trim()         || null,
      content:              parsedContent,
      service_type:         form.service_type?.trim()         || null,
    };
    if (editingId != null) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Merge records picked from the database into the content JSON editor.
  const applyPickedItems = (items: CmsPickerItem[]) => {
    if (!pickerConfig) return;
    let parsed: Record<string, unknown> = {};
    if (contentText.trim()) {
      try {
        parsed = JSON.parse(contentText) as Record<string, unknown>;
      } catch {
        enqueueSnackbar("Content JSON is invalid — fix it before adding records.", {
          variant: "error",
        });
        return;
      }
    }
    const key = pickerConfig.key;
    const existing = Array.isArray(parsed[key]) ? (parsed[key] as unknown[]) : [];
    parsed[key] = [...existing, ...items];
    setContentText(JSON.stringify(parsed, null, 2));
    setContentError(null);
    enqueueSnackbar(`${items.length} record(s) added to the “${key}” array`, {
      variant: "success",
    });
  };

  // ── Render ───────────────────────────────────────────────────

  if (!section) {
    return (
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate("/cms")}>
            Back to CMS
          </Button>
        </Stack>
        <Alert severity="info">
          Section <strong>{sectionKey}</strong> is not registered.
          New section types are added by migrations — see <code>0044_website_cms</code>.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate("/cms")}>
          All sections
        </Button>
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {section.display_name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {SECTION_HINT[sectionKey] ?? section.description ?? "Manage variants of this section."}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={() => refetch()}><Refresh /></IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<Add />} onClick={openNew}>
            New variant
          </Button>
        </Stack>
      </Stack>

      {isLoading ? (
        <Box display="flex" justifyContent="center" minHeight={300}>
          <CircularProgress />
        </Box>
      ) : variants.length === 0 ? (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography color="text.secondary" align="center">
              No variants yet. Create your first design — Default Hero, Festival Hero,
              Outstation Hero — and mark one active to show it on the homepage.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {variants.map((v) => (
            <VariantRow
              key={v.id}
              variant={v}
              onEdit={() => openEdit(v)}
              onDelete={() => setConfirmDelete(v)}
              onActivate={() => activateMutation.mutate(v.id)}
              activating={activateMutation.isPending}
            />
          ))}
        </Stack>
      )}

      {/* ── Add / Edit dialog ──────────────────────────────── */}
      <Dialog open={open} onClose={closeDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingId != null ? `Edit variant #${editingId}` : `New variant — ${section.display_name}`}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth size="small" label="Variant name (internal)"
                value={form.variant_name}
                onChange={(e) => setForm({ ...form, variant_name: e.target.value })}
                helperText="Shown in the variant list — not on the public site"
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth size="small" label="Tag"
                value={form.variant_tag ?? ""}
                onChange={(e) => setForm({ ...form, variant_tag: e.target.value })}
                helperText="e.g. FESTIVAL_DIWALI, OUTSTATION"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth size="small" type="number" label="Display order"
                value={form.display_order ?? 0}
                onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Text alignment</InputLabel>
                <Select
                  label="Text alignment"
                  value={form.text_alignment ?? "LEFT"}
                  onChange={(e) => setForm({ ...form, text_alignment: e.target.value as any })}
                >
                  {TEXT_ALIGNMENTS.map((a) => (
                    <MenuItem key={a} value={a}>{a}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Animation</InputLabel>
                <Select
                  label="Animation"
                  value={form.animation_style ?? "NONE"}
                  onChange={(e) => setForm({ ...form, animation_style: e.target.value as any })}
                >
                  {ANIMATION_STYLES.map((a) => (
                    <MenuItem key={a} value={a}>{a}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Divider><Typography variant="caption" color="text.secondary">Content</Typography></Divider>
            </Grid>

            <Grid item xs={12} md={8}>
              <TextField
                fullWidth size="small" label="Headline"
                value={form.headline ?? ""}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth size="small" label="Accent colour"
                value={form.accent_color ?? ""}
                onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                placeholder="#0F6FFF"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth size="small" label="Subheadline"
                value={form.subheadline ?? ""}
                onChange={(e) => setForm({ ...form, subheadline: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth size="small" label="Body text"
                multiline minRows={2}
                value={form.body_text ?? ""}
                onChange={(e) => setForm({ ...form, body_text: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth size="small" label="CTA text"
                value={form.cta_text ?? ""}
                onChange={(e) => setForm({ ...form, cta_text: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth size="small" label="CTA link"
                value={form.cta_link ?? ""}
                onChange={(e) => setForm({ ...form, cta_link: e.target.value })}
                placeholder="/book or https://…"
              />
            </Grid>

            {/* ── Structured content (JSON) ────────────────────────
                Sections with a content schema (HOW_IT_WORKS, OFFERS, FAQ,
                STATS, POPULAR_DESTINATIONS, FEATURED_HOTELS) store their
                items here. Admin authors the JSON directly; the public
                homepage spreads it into the variant payload. */}
            <Grid item xs={12}>
              <Divider>
                <Typography variant="caption" color="text.secondary">
                  Structured content (JSON)
                </Typography>
              </Divider>
            </Grid>
            {CONTENT_SCHEMA_HINT[sectionKey] && (
              <Grid item xs={12}>
                <Alert severity="info" sx={{ "& code": { fontSize: 12 } }}>
                  Expected shape for <strong>{sectionKey}</strong>:{" "}
                  <code>{CONTENT_SCHEMA_HINT[sectionKey]}</code>
                </Alert>
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Content (JSON)"
                multiline
                minRows={4}
                maxRows={14}
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                error={!!contentError}
                helperText={contentError || "JSON object or empty. Used for steps, offers, faqs, stats, destinations, hotels — depending on the section."}
                sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 12 }}
              />
            </Grid>
            <Grid item xs={12}>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  onClick={() => {
                    try {
                      setContentText(JSON.stringify(JSON.parse(contentText || "{}"), null, 2));
                      setContentError(null);
                    } catch {
                      setContentError("Cannot prettify — content is not valid JSON.");
                    }
                  }}
                >
                  Prettify JSON
                </Button>
                {pickerConfig && (
                  <Button size="small" variant="outlined" startIcon={<Storage />} onClick={() => setPickerOpen(true)}>
                    Browse database…
                  </Button>
                )}
              </Stack>
            </Grid>

            <Grid item xs={12}>
              <Divider><Typography variant="caption" color="text.secondary">Media</Typography></Divider>
            </Grid>

            <Grid item xs={12} md={6}>
              <MediaUploader
                label="Background image"
                kind="image"
                folder={`waytero/cms/${sectionKey.toLowerCase()}`}
                value={form.background_image_url || null}
                onChange={(v) => setForm({ ...form, background_image_url: v ?? "" })}
                previewHeight={140}
                crop={sectionKey === "CTA" ? CROP_CTA : CROP_BG}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <MediaUploader
                label="Mobile background image"
                hint="Optional — falls back to the desktop image"
                kind="image"
                folder={`waytero/cms/${sectionKey.toLowerCase()}/mobile`}
                value={form.mobile_image_url || null}
                onChange={(v) => setForm({ ...form, mobile_image_url: v ?? "" })}
                previewHeight={140}
                crop={CROP_MOBILE}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <MediaUploader
                label="Background video"
                kind="video"
                folder={`waytero/cms/${sectionKey.toLowerCase()}/video`}
                value={form.background_video_url || null}
                onChange={(v) => setForm({ ...form, background_video_url: v ?? "" })}
                previewHeight={140}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <MediaUploader
                label="Icon"
                kind="icon"
                folder={`waytero/cms/${sectionKey.toLowerCase()}/icon`}
                value={form.icon_url || null}
                onChange={(v) => setForm({ ...form, icon_url: v ?? "" })}
                previewHeight={80}
                crop={CROP_ICON}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth size="small" type="number" label="Overlay opacity"
                value={form.overlay_opacity ?? 0}
                inputProps={{ step: 0.05, min: 0, max: 1 }}
                onChange={(e) =>
                  setForm({ ...form, overlay_opacity: Number(e.target.value) })
                }
                helperText="0.00 (clear) — 1.00 (opaque). Applied over background media."
              />
            </Grid>

            {/* Service-type binding — only relevant for hero/cta sections
                that should inject a search form. Hidden for plain content
                sections (STATS, TESTIMONIALS, PARTNERS, …). */}
            {(sectionKey === "HERO" || sectionKey === "CTA") && (
              <Grid item xs={12}>
                <Divider>
                  <Typography variant="caption" color="text.secondary">
                    Service-type binding (optional)
                  </Typography>
                </Divider>
              </Grid>
            )}
            {(sectionKey === "HERO" || sectionKey === "CTA") && (
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Service type</InputLabel>
                  <Select
                    label="Service type"
                    value={form.service_type ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        service_type: (e.target.value as string) || null,
                      })
                    }
                  >
                    {SERVICE_TYPE_OPTIONS.map((o) => (
                      <MenuItem key={o.value} value={o.value}>
                        {o.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                  {SERVICE_TYPE_OPTIONS.find((o) => o.value === (form.service_type ?? ""))?.help}
                </Typography>
              </Grid>
            )}
            {(sectionKey === "HERO" || sectionKey === "CTA") && (
              <Grid item xs={12} md={6}>
                {form.service_type && form.service_type !== "ALL" ? (
                  <Alert severity="info" sx={{ py: 0.5 }}>
                    When this variant is active, the public homepage will inject the{" "}
                    <strong>{form.service_type}</strong> search form into this section.
                    Form submissions route to{" "}
                    <code>
                      {form.service_type === "CAB" && "/cabs"}
                      {form.service_type === "HOTEL" && "/hotels"}
                      {form.service_type === "TOUR" && "/tours"}
                    </code>
                    .
                  </Alert>
                ) : (
                  <Alert severity="info" sx={{ py: 0.5 }}>
                    No inline search will be rendered. The section is decorative or uses a generic CTA.
                  </Alert>
                )}
              </Grid>
            )}

            <Grid item xs={12}>
              <Divider>
                <Typography variant="caption" color="text.secondary">
                  Schedule window (optional)
                </Typography>
              </Divider>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth size="small" type="datetime-local" label="Starts at"
                InputLabelProps={{ shrink: true }}
                value={form.starts_at ? form.starts_at.slice(0, 16) : ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    starts_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth size="small" type="datetime-local" label="Ends at"
                InputLabelProps={{ shrink: true }}
                value={form.ends_at ? form.ends_at.slice(0, 16) : ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    ends_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={!!form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                }
                label="Activate this variant on save"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={onSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {editingId != null ? "Save changes" : "Create variant"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Content data picker ───────────────────────────── */}
      {pickerConfig && (
        <ContentDataPicker
          open={pickerOpen}
          config={pickerConfig}
          onClose={() => setPickerOpen(false)}
          onApply={applyPickedItems}
        />
      )}

      {/* ── Confirm delete dialog ──────────────────────────── */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Delete variant?</DialogTitle>
        <DialogContent>
          <Typography>
            Permanently delete <strong>{confirmDelete?.variant_name}</strong>?
            This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button
            color="error" variant="contained"
            onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
            disabled={deleteMutation.isPending}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────
// VariantRow
// ──────────────────────────────────────────────────────────────

function VariantRow({
  variant,
  onEdit,
  onDelete,
  onActivate,
  activating,
}: {
  variant: SectionVariant;
  onEdit: () => void;
  onDelete: () => void;
  onActivate: () => void;
  activating: boolean;
}) {
  const theme = useTheme();

  // Detect in-window status from the dates we have
  const now = Date.now();
  const startsAt = variant.starts_at ? new Date(variant.starts_at).getTime() : null;
  const endsAt   = variant.ends_at   ? new Date(variant.ends_at).getTime()   : null;
  const scheduled = startsAt !== null || endsAt !== null;
  const inWindow  = !scheduled || (
    (startsAt === null || now >= startsAt) &&
    (endsAt   === null || now <= endsAt)
  );

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        borderColor: variant.is_active ? "success.main" : alpha(theme.palette.divider, 0.6),
        bgcolor: variant.is_active
          ? alpha(theme.palette.success.main, 0.04)
          : "background.paper",
        transition: "border-color 120ms, background-color 120ms",
      }}
    >
      <CardContent sx={{ display: "flex", gap: 2, py: 1.5, "&:last-child": { pb: 1.5 } }}>
        {variant.background_image_url ? (
          <Box
            component="img"
            src={variant.background_image_url}
            alt=""
            sx={{
              width: 96, height: 64, objectFit: "cover",
              borderRadius: 1, flexShrink: 0,
              border: `1px solid ${theme.palette.divider}`,
            }}
          />
        ) : variant.icon_url ? (
          <Box
            component="img"
            src={variant.icon_url}
            alt=""
            sx={{ width: 64, height: 64, objectFit: "contain", flexShrink: 0 }}
          />
        ) : (
          <Box
            sx={{
              width: 64, height: 64, borderRadius: 1.5,
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, color: "primary.main", flexShrink: 0,
            }}
          >
            {variant.variant_name.slice(0, 2).toUpperCase()}
          </Box>
        )}

        <Box flex={1} minWidth={0}>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
            <Typography variant="subtitle1" fontWeight={600}>
              {variant.variant_name}
            </Typography>
            {variant.variant_tag && (
              <Chip size="small" variant="outlined" label={variant.variant_tag} />
            )}
            {variant.is_active ? (
              <Chip
                size="small"
                color="success"
                icon={<Star />}
                label="Active on homepage"
                sx={{ height: 22, fontSize: 11 }}
              />
            ) : (
              <Chip
                size="small"
                variant="outlined"
                icon={<StarBorder />}
                label="Inactive"
                sx={{ height: 22, fontSize: 11 }}
              />
            )}
            {scheduled && (
              <Chip
                size="small"
                color={inWindow ? "info" : "default"}
                icon={<Schedule />}
                label={inWindow ? "In schedule window" : "Outside schedule"}
                sx={{ height: 22, fontSize: 11 }}
              />
            )}
          </Stack>
          {variant.headline && (
            <Typography variant="body2" sx={{ mt: 0.5 }} noWrap>
              {variant.headline}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
            Order #{variant.display_order}
            {variant.animation_style && variant.animation_style !== "NONE" && (
              <> · {variant.animation_style}</>
            )}
            {variant.cta_text && <> · CTA: {variant.cta_text}</>}
            {variant.content && <> · Content: {Object.keys(variant.content).join(", ")}</>}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.5} alignItems="center">
          {!variant.is_active && (
            <Tooltip title="Activate on homepage">
              <span>
                <IconButton
                  color="success"
                  onClick={onActivate}
                  disabled={activating}
                  aria-label="Activate variant"
                >
                  <PowerSettingsNew />
                </IconButton>
              </span>
            </Tooltip>
          )}
          <Tooltip title="Edit">
            <IconButton onClick={onEdit} aria-label="Edit variant">
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip
            title={
              variant.is_active
                ? "Cannot delete the active variant — activate another first"
                : "Delete"
            }
          >
            <span>
              <IconButton
                color="error"
                onClick={onDelete}
                disabled={variant.is_active}
                aria-label="Delete variant"
              >
                <Delete />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </CardContent>
    </Card>
  );
}