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
  Star, StarBorder, Schedule, Refresh,
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
import SectionContentEditor from "./components/content/SectionContentEditor";
import { SECTION_CONTENT_SCHEMA, STRING_ROW_KEY } from "./components/content/sectionContentSchema";
import {
  blockingIssues, emptyContentState, emptyItem, hydrateContent, serializeContent,
  validateContent, type ContentState, type ItemState,
} from "./components/content/sectionContentState";

// ── Per-section slot templates ─────────────────────────────────
// The common slot set is used for every variant. Section key
// just adds metadata (icon hint / a default tag suggestion).

const SECTION_HINT: Record<string, string> = {
  HERO:          "Full-width banner at the very top of the homepage.",
  SERVICES:      "Grid of service cards (Cabs / Hotels / Tours).",
  RIDE_TYPES:    "Row of cab trip-type cards (local, airport, one-way, outstation, round trip) under the services band.",
  WHY_US:        "Trust signals — why customers should choose WayTero.",
  TOUR_PACKAGES: "Four-up tour-package cards with the \"View All Packages\" link. The cards themselves come from the Tours page — only the header copy and that link live here.",
  TESTIMONIALS:  "Customer reviews / quotes. The heading, the aggregate stars and the prev/next controls sit in a left column beside the cards.",
  STATS:         "Big-number platform stats (rides, cities, partners).",
  PARTNERS:      "Showcase of partner brands / fleet operators.",
  CTA:           "Closing call-to-action banner.",
  OFFERS:        "Coupon cards under the hero. The cards themselves come from the Offers page — only the header copy lives here.",
  POPULAR_DESTINATIONS: "Trending destinations grid.",
  POPULAR_ROUTES: "Inter-city cab route pills. Route data lives on the Cab Routes page — only the header copy lives here.",
  POPULAR_CITIES: "City pills from the database, each linking to its published landing page.",
  HOW_IT_WORKS:  "Step-by-step guide to booking with WayTero.",
  FEATURED_HOTELS: "Handpicked partner hotels.",
  FAQ:           "Accordion of frequently asked questions. Each question's Category groups it under a tab on the left of the band.",
  NEWSLETTER:    "Email-capture band.",
  APP_DOWNLOAD:  "Mobile app promo band.",
  BLOG:          "Latest travel-stories / blog band.",
};

// ── Eyebrow prefill for a new variant ──────────────────────────
// `variant_tag` is not an internal code — it is the small line the
// renderer prints ABOVE the heading, so this map has to hold real site
// copy. Values are the eyebrows migration 0055 / 0080 seeded, so a new
// variant starts looking like the band it replaces. "" means the
// renderer falls back to its own default; a blank trims to null on save.
const SECTION_DEFAULT_TAG: Record<string, string> = {
  HERO:          "India's Travel Operating System",
  SERVICES:      "What we offer",
  RIDE_TYPES:    "",  // no eyebrow in this band's design
  WHY_US:        "",  // no eyebrow — the heading sits inside the pastel panel
  TOUR_PACKAGES: "",  // no eyebrow in this band's design (dashes flank the title)
  TESTIMONIALS:  "",  // no eyebrow — the heading sits in the band's left column
  STATS:         "",  // was "Trusted across India" — a coverage claim the
                     // platform cannot prove; the band prints its own
                     // "By the numbers" instead (StatsSection.tsx:20).
  PARTNERS:      "Trusted partners",
  CTA:           "",
  OFFERS:        "Limited-time deals",
  POPULAR_DESTINATIONS: "Where to next",
  POPULAR_ROUTES: "Where people travel",
  POPULAR_CITIES: "Where we operate",
  HOW_IT_WORKS:  "",  // no eyebrow — orange dashes flank the title instead
  FEATURED_HOTELS: "Where to stay",
  FAQ:           "",  // no eyebrow — the heading sits between two orange dashes
  NEWSLETTER:    "Stay in the loop",
  APP_DOWNLOAD:  "On the go",
  BLOG:          "Travel stories",
};

// ── Structured content ─────────────────────────────────────────
// Each band's JSONB shape lives in components/content/sectionContentSchema.ts,
// which drives the typed rows, the database picker, the save-time validation
// and the read-only preview. There is no raw-JSON textarea in this dialog any
// more — admins type values and pick records, and the schema converts.
//
// Bands whose cards come from a live table (FEATURED_HOTELS,
// POPULAR_DESTINATIONS, TOUR_PACKAGES, OFFERS, BLOG, POPULAR_ROUTES,
// POPULAR_CITIES) deliberately have no editor: the homepage fetches their cards
// as it renders, so the backend rejects a content array for them and only the
// copy fields above do anything. They get an explainer instead.

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
  const [content, setContent] = useState<ContentState>(() => emptyContentState(sectionKey));
  const [quarantineAck, setQuarantineAck] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Which array a database picker fills is declared by the band's schema,
  // not by a map that can drift from it.
  const pickerTarget = useMemo(() => {
    for (const a of SECTION_CONTENT_SCHEMA[sectionKey]?.arrays ?? []) {
      if (a.picker) return { spec: a, picker: a.picker };
    }
    return null;
  }, [sectionKey]);

  const pickerConfig: ContentPickerConfig | null = pickerTarget
    ? {
        type: pickerTarget.picker.type,
        label: pickerTarget.picker.label,
        help: pickerTarget.picker.help,
      }
    : null;

  const contentIssues = useMemo(
    () => validateContent(sectionKey, content, quarantineAck),
    [sectionKey, content, quarantineAck],
  );
  const contentErrors = blockingIssues(contentIssues);

  // Navigating between two section pages reuses this component; stale rows
  // from the previous band must not be written into this one.
  useEffect(() => {
    setContent(emptyContentState(sectionKey));
    setQuarantineAck(false);
  }, [sectionKey]);

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
    setContent(emptyContentState(sectionKey));
    setQuarantineAck(false);
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
      service_type:        v.service_type ?? null,
      starts_at:           v.starts_at ?? null,
      ends_at:             v.ends_at ?? null,
    });
    setContent(hydrateContent(sectionKey, v.content));
    setQuarantineAck(false);
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

    // Keys the site cannot use are only removable with an explicit nod, so a
    // save can never quietly delete something an admin authored earlier.
    const quarantined = Object.keys(content.quarantined).length + (content.unparseable !== null ? 1 : 0);
    if (quarantined > 0 && !quarantineAck) {
      enqueueSnackbar("Confirm removing the unsupported content keys first", { variant: "warning" });
      return;
    }
    if (contentErrors.length > 0) {
      enqueueSnackbar(
        contentErrors[0].message.replace(/[.]+$/, ""),
        { variant: "error" },
      );
      return;
    }

    const parsedContent = serializeContent(sectionKey, content);

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

  // Merge records picked from the database into the typed rows. Each record is
  // projected through the band's field list, so a picker cannot smuggle its
  // dialog-only display keys (a rating badge, say) into stored content.
  const applyPickedItems = (picked: CmsPickerItem[]) => {
    if (!pickerTarget) return;
    const { spec, picker } = pickerTarget;
    const rows = content.arrays[spec.key] ?? [];
    const room = spec.max - rows.length;
    if (room <= 0) {
      enqueueSnackbar(`This band holds at most ${spec.max} ${spec.itemLabel}s`, { variant: "warning" });
      return;
    }

    const textOf = (row: ItemState) => (
      spec.rowKind === "string"
        ? String(row.values[STRING_ROW_KEY] ?? "")
        : String(row.values[spec.keyField ?? spec.fields[0]?.key ?? ""] ?? "")
    ).trim().toLowerCase();
    const taken = new Set(rows.map(textOf).filter(Boolean));

    const added: ItemState[] = [];
    let skipped = 0;
    for (const item of picked) {
      if (added.length >= room) { skipped += 1; continue; }
      const base = emptyItem(spec);
      if (spec.rowKind === "string") {
        const text = String(item[picker.stringField ?? "name"] ?? "").trim();
        if (!text || taken.has(text.toLowerCase())) { skipped += 1; continue; }
        base.values[STRING_ROW_KEY] = text;
        taken.add(text.toLowerCase());
        added.push(base);
        continue;
      }
      for (const field of spec.fields) {
        const v = item[field.key];
        if (typeof v === "string" || typeof v === "number") base.values[field.key] = v;
      }
      const fingerprint = textOf(base);
      if (fingerprint && taken.has(fingerprint)) { skipped += 1; continue; }
      if (fingerprint) taken.add(fingerprint);
      added.push(base);
    }

    if (added.length === 0) {
      enqueueSnackbar("Those records are already in this list", { variant: "info" });
      return;
    }
    setContent({
      ...content,
      arrays: { ...content.arrays, [spec.key]: [...rows, ...added] },
    });
    enqueueSnackbar(
      `${added.length} added${skipped ? `, ${skipped} already present` : ""}`,
      { variant: "success" },
    );
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
                fullWidth size="small" label="Eyebrow (small line above the heading)"
                value={form.variant_tag ?? ""}
                onChange={(e) => setForm({ ...form, variant_tag: e.target.value })}
                helperText="Printed on the site, in caps above the section heading — leave blank to use this band's default"
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
                fullWidth size="small" label="Section heading (H2 shown on site)"
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
                fullWidth size="small" label="Sub-heading (line under the section heading)"
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

            {/* ── Structured content ───────────────────────────────
                The band's schema decides what appears here: typed rows
                for the sections that store content arrays, an explainer
                for the bands whose cards the homepage fetches live. On
                save the rows are converted back into the JSONB shape the
                public renderer reads. */}
            <Grid item xs={12}>
              <Divider>
                <Typography variant="caption" color="text.secondary">
                  Structured content
                </Typography>
              </Divider>
            </Grid>
            <Grid item xs={12}>
              <SectionContentEditor
                sectionKey={sectionKey}
                state={content}
                issues={contentIssues}
                onBrowse={pickerConfig ? () => setPickerOpen(true) : undefined}
                quarantineAck={quarantineAck}
                onQuarantineAck={setQuarantineAck}
                onChange={setContent}
              />
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