// ============================================================
// WAYTERO ADMIN — LANDING PAGE EDITOR
// Doc Ref: City + Service-Type Landing Pages §Phase 3
//  Routes: /cms/landing-pages/new  ·  /cms/landing-pages/:id
//
//  One editor for every landing page family. The URL is never typed: the admin
//  picks a page type and a city or state, and the slug, the headline, the stat
//  chips and the price claims all come from the platform's own data. Everything
//  on this form is an override of a value that already has a correct default,
//  which is why each field shows what it would say if left blank.
//
//  Tabs are ordered by how often they are used: copy, imagery, structure, SEO.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowBack, OpenInNew } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import SeoFields, { type SeoValues } from "../../components/forms/SeoFields";
import MediaUploader, { cropForSlot } from "../cms/components/MediaUploader";
import { SITE_URL } from "../../constants";
import {
  landingPagesService,
  PAGE_TYPE_LABELS,
  slotGeometry,
  type LandingBlock,
  type LandingFaq,
  type LandingGalleryTile,
  type LandingHighlight,
  type LandingPage,
  type LandingPageType,
  type LandingStat,
} from "../../services/landingPages.service";
import { apiErrorMessage } from "../../utils/apiError";
import { seoHasError, SEO_LIMITS, slugify } from "../../utils/seoValidation";
import BlockListEditor from "./components/BlockListEditor";
import {
  FaqListEditor,
  GalleryListEditor,
  HighlightListEditor,
  StatListEditor,
} from "./components/ContentLists";
import PublishBlockersDialog, { publishProblems } from "./components/PublishBlockersDialog";

const LANDING_FOLDER = "waytero/landing";

/** The editable surface. Everything else on a record is computed or owned. */
interface FormState {
  page_type: LandingPageType | "";
  city_id: number | null;
  state_id: number | null;
  slug: string;
  display_name: string;
  eyebrow: string;
  headline: string;
  subheadline: string;
  body_text: string;
  banner_image_url: string | null;
  banner_mobile_url: string | null;
  banner_video_url: string | null;
  banner_alt_text: string;
  og_image_url: string | null;
  overlay_opacity: number;
  cta_text: string;
  cta_link: string;
  cta2_text: string;
  cta2_link: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  highlights: LandingHighlight[];
  stats: LandingStat[];
  gallery: LandingGalleryTile[];
  faqs: LandingFaq[];
  blocks: LandingBlock[];
  is_published: boolean;
  display_order: number;
}

const EMPTY: FormState = {
  page_type: "",
  city_id: null,
  state_id: null,
  slug: "",
  display_name: "",
  eyebrow: "",
  headline: "",
  subheadline: "",
  body_text: "",
  banner_image_url: null,
  banner_mobile_url: null,
  banner_video_url: null,
  banner_alt_text: "",
  og_image_url: null,
  overlay_opacity: 0.55,
  cta_text: "",
  cta_link: "",
  cta2_text: "",
  cta2_link: "",
  seo_title: "",
  seo_description: "",
  seo_keywords: "",
  highlights: [],
  stats: [],
  gallery: [],
  faqs: [],
  blocks: [],
  is_published: false,
  display_order: 0,
};

const isCityPage = (pageType: LandingPageType | "") =>
  pageType === "CITY_HUB" || pageType === "CITY_CABS" || pageType === "CITY_HOTELS" || pageType === "CITY_TOURS";

const isStatePage = (pageType: LandingPageType | "") =>
  pageType === "STATE_HOTELS" || pageType === "STATE_TOURS";

// Place pages are provisioned from Places master data (migration 0070) —
// the backend rejects page_type/scope changes on them, so the editor only
// exposes copy, blocks and SEO for these.
const isPlacePage = (pageType: LandingPageType | "") => pageType === "PLACE_CABS";

export default function LandingPageEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new" || !id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [tab, setTab] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [blockers, setBlockers] = useState<string[] | null>(null);

  const { data: specs } = useQuery({
    queryKey: ["landing-page-specs"],
    queryFn: () => landingPagesService.getSpecs(),
    staleTime: 300_000,
  });

  const { data: record, isLoading } = useQuery({
    queryKey: ["landing-page", id],
    queryFn: () => landingPagesService.getPage(Number(id)),
    enabled: !isNew,
  });

  // Hydrate once per record — the server's `derived` copy is deliberately NOT
  // copied into the form: an empty field means "use what the platform computes",
  // and overwriting the blank with the current answer would freeze it.
  useEffect(() => {
    if (!record) return;
    setForm({
      page_type: record.page_type,
      city_id: record.city_id,
      state_id: record.state_id,
      slug: record.slug,
      display_name: record.display_name ?? "",
      eyebrow: record.eyebrow ?? "",
      headline: record.headline ?? "",
      subheadline: record.subheadline ?? "",
      body_text: record.body_text ?? "",
      banner_image_url: record.banner_image_url,
      banner_mobile_url: record.banner_mobile_url,
      banner_video_url: record.banner_video_url,
      banner_alt_text: record.banner_alt_text ?? "",
      og_image_url: record.og_image_url,
      overlay_opacity: record.overlay_opacity ?? 0.55,
      cta_text: record.cta_text ?? "",
      cta_link: record.cta_link ?? "",
      cta2_text: record.cta2_text ?? "",
      cta2_link: record.cta2_link ?? "",
      seo_title: record.seo_title ?? "",
      seo_description: record.seo_description ?? "",
      seo_keywords: record.seo_keywords ?? "",
      highlights: record.highlights ?? [],
      stats: record.stats ?? [],
      gallery: record.gallery ?? [],
      faqs: record.faqs ?? [],
      blocks: record.blocks ?? [],
      is_published: record.is_published,
      display_order: record.display_order ?? 0,
    });
  }, [record]);

  const patch = (p: Partial<FormState>) => setForm((prev) => ({ ...prev, ...p }));

  const scopeName = useMemo(() => {
    if (!specs) return null;
    const options = specs.options;
    if (form.city_id) return options.cities.find((c) => c.id === form.city_id)?.name ?? null;
    if (form.state_id) return options.states.find((s) => s.id === form.state_id)?.name ?? null;
    return null;
  }, [specs, form.city_id, form.state_id]);

  // What the platform would publish if the admin typed nothing — shown as the
  // placeholder in every copy field so "blank" is visibly a choice.
  const { data: suggestion, isFetching: suggesting } = useQuery({
    queryKey: ["landing-page-suggestion", form.page_type, form.city_id, form.state_id],
    queryFn: () =>
      landingPagesService.getSuggestion({
        page_type: form.page_type as LandingPageType,
        city_id: form.city_id,
        state_id: form.state_id,
      }),
    enabled: !!form.page_type && (!!form.city_id || !!form.state_id),
  });

  const derived = suggestion?.derived ?? record?.derived ?? null;

  const slotSpecs = record?.slot_specs ?? specs?.slot_specs ?? {};

  const seoValues: SeoValues = {
    slug: form.slug,
    seo_title: form.seo_title,
    seo_description: form.seo_description,
    seo_keywords: form.seo_keywords,
  };

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      isNew
        ? landingPagesService.createPage(payload as any)
        : landingPagesService.updatePage(Number(id), payload as any),
    onSuccess: (saved) => {
      enqueueSnackbar(isNew ? "Page created" : "Page saved", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["landing-pages"] });
      qc.invalidateQueries({ queryKey: ["landing-page", String(saved.id)] });
      if (isNew) navigate(`/cms/landing-pages/${saved.id}`, { replace: true });
    },
    onError: (err) => enqueueSnackbar(apiErrorMessage(err, "Failed to save"), { variant: "error" }),
  });

  const publishMutation = useMutation({
    mutationFn: ({ published, confirmed }: { published: boolean; confirmed: boolean }) =>
      landingPagesService.setPublished(Number(id), published, confirmed),
    onSuccess: (saved) => {
      setBlockers(null);
      patch({ is_published: saved.is_published });
      enqueueSnackbar(saved.is_published ? "Page published" : "Page unpublished", {
        variant: "success",
      });
      qc.invalidateQueries({ queryKey: ["landing-pages"] });
      qc.invalidateQueries({ queryKey: ["landing-page", id] });
    },
    onError: (err, vars) => {
      const problems = publishProblems(err);
      if (problems && vars.published && !vars.confirmed) {
        setBlockers(problems);
        return;
      }
      setBlockers(null);
      enqueueSnackbar(apiErrorMessage(err, "Failed to update publish status"), {
        variant: "error",
      });
    },
  });

  const buildPayload = (publish: boolean | null) => {
    const payload: Record<string, unknown> = {
      display_name: form.display_name || null,
      eyebrow: form.eyebrow || null,
      headline: form.headline || null,
      subheadline: form.subheadline || null,
      body_text: form.body_text || null,
      banner_image_url: form.banner_image_url,
      banner_mobile_url: form.banner_mobile_url,
      banner_video_url: form.banner_video_url,
      banner_alt_text: form.banner_alt_text || null,
      og_image_url: form.og_image_url,
      overlay_opacity: form.overlay_opacity,
      cta_text: form.cta_text || null,
      cta_link: form.cta_link || null,
      cta2_text: form.cta2_text || null,
      cta2_link: form.cta2_link || null,
      seo_title: form.seo_title || null,
      seo_description: form.seo_description || null,
      seo_keywords: form.seo_keywords || null,
      highlights: form.highlights,
      stats: form.stats,
      gallery: form.gallery,
      faqs: form.faqs,
      blocks: form.blocks,
      display_order: form.display_order,
    };
    if (publish !== null) payload.is_published = publish;

    if (isNew) {
      payload.page_type = form.page_type;
      payload.city_id = form.city_id;
      payload.state_id = form.state_id;
      // The slug is derived on create; only an explicitly typed one is sent.
      if (form.slug.trim()) payload.slug = form.slug.trim();
    } else {
      payload.page_type = form.page_type;
      payload.city_id = form.city_id;
      payload.state_id = form.state_id;
      payload.slug = form.slug.trim();
      // A hand-edited slug has already been warned about by SeoFields
      // (live-entity alert) — that warning *is* the confirmation the backend
      // asks for, so a deliberate rename is possible without a second dialog.
      if (record && form.slug.trim() !== record.slug) payload.slug_confirmed = true;
    }
    return payload;
  };

  const handleSave = (publish: boolean | null) => {
    if (!form.page_type) {
      enqueueSnackbar("Choose a page type", { variant: "error" });
      setTab(0);
      return;
    }
    if ((isCityPage(form.page_type) && !form.city_id) || (isStatePage(form.page_type) && !form.state_id)) {
      enqueueSnackbar(
        isCityPage(form.page_type) ? "Choose a city" : "Choose a state",
        { variant: "error" }
      );
      setTab(0);
      return;
    }
    if (seoHasError(seoValues, { slugMax: SEO_LIMITS.slug })) {
      enqueueSnackbar("Fix the SEO issues before saving", { variant: "error" });
      setTab(3);
      return;
    }
    const emptyGalleryAt = form.gallery.findIndex((tile) => !tile.image_url?.trim());
    if (emptyGalleryAt >= 0) {
      enqueueSnackbar(`Gallery image ${emptyGalleryAt + 1} has no picture`, { variant: "error" });
      setTab(1);
      return;
    }
    if (form.faqs.some((f) => !f.question?.trim() || !f.answer?.trim())) {
      enqueueSnackbar("Every FAQ needs both a question and an answer", { variant: "error" });
      setTab(2);
      return;
    }
    saveMutation.mutate(buildPayload(publish));
  };

  if (!isNew && isLoading) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  const imageryUploaded = !!form.banner_image_url || !!form.banner_mobile_url;

  return (
    <Box>
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        useFlexGap
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <IconButton onClick={() => navigate("/cms/landing-pages")} aria-label="Back to list">
            <ArrowBack />
          </IconButton>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              {isNew ? "New landing page" : record?.display_name || form.slug}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isNew
                ? "Pick a page type and a place — the URL and the claims write themselves."
                : `/${form.slug}`}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          {!isNew && record?.is_published && (
            <Button
              size="small"
              startIcon={<OpenInNew />}
              onClick={() => window.open(`${SITE_URL}/${form.slug}`, "_blank", "noopener,noreferrer")}
            >
              Open in website
            </Button>
          )}
          <Button
            variant="outlined"
            onClick={() => handleSave(null)}
            disabled={saveMutation.isPending}
          >
            Save
          </Button>
          <Button
            variant="contained"
            onClick={() => handleSave(true)}
            disabled={saveMutation.isPending || (!isNew && publishMutation.isPending)}
          >
            {form.is_published ? "Save & keep live" : "Save & publish"}
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Tabs
                value={tab}
                onChange={(_, next) => setTab(next)}
                variant="scrollable"
                scrollButtons
                allowScrollButtonsMobile
                sx={{ mb: 2 }}
              >
                <Tab label="Copy" />
                <Tab label="Imagery" />
                <Tab label="Blocks" />
                <Tab label="SEO" />
              </Tabs>

              {tab === 0 && (
                <Stack spacing={2}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    What this page is about
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      select
                      size="small"
                      label="Page type"
                      value={form.page_type}
                      onChange={(e) => {
                        const next = e.target.value as LandingPageType;
                        patch({
                          page_type: next,
                          // The scope kind follows the page type, so a stale
                          // city selection cannot survive into a state page.
                          city_id: isCityPage(next) ? form.city_id : null,
                          state_id: isStatePage(next) ? form.state_id : null,
                          // A slug typed under the old page type carries the
                          // wrong prefix; a new page starts from derived again.
                          ...(isNew ? { slug: "" } : {}),
                        });
                      }}
                      sx={{ flex: 1 }}
                      SelectProps={{ native: true }}
                      disabled={(!isNew && record?.is_published) || isPlacePage(form.page_type)}
                    >
                      <option value="" />
                      {Object.entries(PAGE_TYPE_LABELS)
                        // Place pages are provisioned from Places master data,
                        // never hand-created — the backend rejects it too.
                        .filter(([value]) => !(isNew && value === "PLACE_CABS"))
                        .map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                    </TextField>

                    {isCityPage(form.page_type) && (
                      <TextField
                        select
                        size="small"
                        label="City"
                        value={form.city_id ?? ""}
                        onChange={(e) =>
                          patch({
                            city_id: Number(e.target.value) || null,
                            state_id: null,
                          })
                        }
                        sx={{ flex: 1 }}
                        SelectProps={{ native: true }}
                        disabled={!isNew && record?.is_published}
                      >
                        <option value="" />
                        {specs?.options.cities
                          .filter(
                            (c) =>
                              !form.state_id ||
                              c.state_id === form.state_id ||
                              !isStatePage(form.page_type)
                          )
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} · {c.state_name}
                            </option>
                          ))}
                      </TextField>
                    )}

                    {isStatePage(form.page_type) && (
                      <TextField
                        select
                        size="small"
                        label="State"
                        value={form.state_id ?? ""}
                        onChange={(e) =>
                          patch({ state_id: Number(e.target.value) || null, city_id: null })
                        }
                        sx={{ flex: 1 }}
                        SelectProps={{ native: true }}
                        disabled={!isNew && record?.is_published}
                      >
                        <option value="" />
                        {specs?.options.states.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </TextField>
                    )}

                    {isPlacePage(form.page_type) && (
                      <TextField
                        size="small"
                        label="Place"
                        value={record?.place_name ?? "—"}
                        InputProps={{ readOnly: true }}
                        sx={{ flex: 1 }}
                        helperText="Managed under Settings → Master Data → Places"
                      />
                    )}
                  </Stack>

                  {isPlacePage(form.page_type) && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      This page is provisioned from a Place row — its place, city and
                      URL are fixed here. Edit copy, blocks and SEO freely; hotel &amp;
                      tour cross-sell sections appear only while real supply matches
                      this place. To retarget the page, edit or delete the Place.
                    </Alert>
                  )}

                  {isNew && suggestion && (
                    <Alert severity={suggestion.reserved ? "error" : "info"}>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                      >
                        <Typography variant="body2">
                          URL will be{" "}
                          <Box component="strong" sx={{ fontFamily: "monospace" }}>
                            /{suggestion.slug}
                          </Box>
                        </Typography>
                        <Button
                          size="small"
                          onClick={() =>
                            patch({
                              slug: suggestion.slug,
                              blocks: suggestion.blocks,
                              display_name: suggestion.display_name,
                            })
                          }
                        >
                          Use this layout
                        </Button>
                      </Stack>
                      {suggestion.reserved && (
                        <Typography variant="caption" display="block">
                          That slug collides with an existing website route.
                        </Typography>
                      )}
                    </Alert>
                  )}

                  <Divider />

                  <TextField
                    size="small"
                    label="Display name"
                    value={form.display_name}
                    placeholder={scopeName ?? ""}
                    onChange={(e) => patch({ display_name: e.target.value })}
                    helperText="Shown in the page title area. Blank uses the city or state name."
                  />

                  {[
                    { key: "eyebrow", label: "Eyebrow", rows: 1, from: derived?.eyebrow },
                    { key: "headline", label: "Headline", rows: 1, from: derived?.headline },
                    { key: "subheadline", label: "Sub-headline", rows: 2, from: derived?.subheadline },
                    { key: "body_text", label: "Intro paragraph", rows: 4, from: derived?.body_text },
                  ].map((field) => (
                    <TextField
                      key={field.key}
                      size="small"
                      multiline
                      minRows={field.rows}
                      label={field.label}
                      value={form[field.key as "eyebrow"] ?? ""}
                      placeholder={field.from ?? ""}
                      onChange={(e) => patch({ [field.key]: e.target.value } as Partial<FormState>)}
                      helperText="Blank = the platform's own wording above, derived from live data."
                    />
                  ))}

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      size="small"
                      label="Button text"
                      value={form.cta_text}
                      placeholder={derived?.cta_text ?? ""}
                      onChange={(e) => patch({ cta_text: e.target.value })}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      size="small"
                      label="Button link"
                      value={form.cta_link}
                      placeholder={derived?.cta_link ?? ""}
                      onChange={(e) => patch({ cta_link: e.target.value })}
                      sx={{ flex: 1 }}
                    />
                  </Stack>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      size="small"
                      label="Second button (optional)"
                      value={form.cta2_text}
                      onChange={(e) => patch({ cta2_text: e.target.value })}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      size="small"
                      label="Second link"
                      value={form.cta2_link}
                      onChange={(e) => patch({ cta2_link: e.target.value })}
                      sx={{ flex: 1 }}
                    />
                  </Stack>
                </Stack>
              )}

              {tab === 1 && (
                <Stack spacing={3}>
                  {!imageryUploaded && (
                    <Alert severity="info">
                      No art yet, so this page renders the brand gradient hero. That is a
                      designed treatment, not a placeholder — add a photo only if it is
                      genuinely of this place.
                    </Alert>
                  )}

                  <Stack spacing={1}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Desktop banner
                    </Typography>
                    <MediaUploader
                      value={form.banner_image_url}
                      onChange={(url) => patch({ banner_image_url: url })}
                      folder={LANDING_FOLDER}
                      kind="image"
                      label="Upload desktop banner"
                      previewHeight={180}
                      slot={slotSpecs.banner_image_url && slotGeometry(slotSpecs.banner_image_url)}
                      crop={
                        slotSpecs.banner_image_url &&
                        cropForSlot(slotGeometry(slotSpecs.banner_image_url))
                      }
                      strict
                    />
                  </Stack>

                  <Stack spacing={1}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Mobile banner
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      A separate portrait crop. Without one the website scales the desktop
                      banner, which is how a hero loses its subject on a phone.
                    </Typography>
                    <MediaUploader
                      value={form.banner_mobile_url}
                      onChange={(url) => patch({ banner_mobile_url: url })}
                      folder={LANDING_FOLDER}
                      kind="image"
                      label="Upload mobile banner"
                      previewHeight={180}
                      slot={slotSpecs.banner_mobile_url && slotGeometry(slotSpecs.banner_mobile_url)}
                      crop={
                        slotSpecs.banner_mobile_url &&
                        cropForSlot(slotGeometry(slotSpecs.banner_mobile_url))
                      }
                      strict
                    />
                  </Stack>

                  <Stack spacing={1}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Social share image
                    </Typography>
                    <MediaUploader
                      value={form.og_image_url}
                      onChange={(url) => patch({ og_image_url: url })}
                      folder={LANDING_FOLDER}
                      kind="image"
                      label="Upload share image"
                      previewHeight={140}
                      slot={slotSpecs.og_image_url && slotGeometry(slotSpecs.og_image_url)}
                      crop={
                        slotSpecs.og_image_url && cropForSlot(slotGeometry(slotSpecs.og_image_url))
                      }
                      strict
                    />
                  </Stack>

                  <Stack spacing={1}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Hero video (optional)
                    </Typography>
                    <MediaUploader
                      value={form.banner_video_url}
                      onChange={(url) => patch({ banner_video_url: url })}
                      folder={LANDING_FOLDER}
                      kind="video"
                      label="Upload hero video"
                      previewHeight={160}
                    />
                  </Stack>

                  <TextField
                    size="small"
                    label="Banner alt text"
                    value={form.banner_alt_text}
                    placeholder={derived?.headline ?? ""}
                    onChange={(e) => patch({ banner_alt_text: e.target.value })}
                    helperText="Screen readers and image search. Blank uses the headline."
                  />

                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                      Text overlay strength
                    </Typography>
                    <Slider
                      value={form.overlay_opacity}
                      min={0}
                      max={1}
                      step={0.05}
                      valueLabelDisplay="auto"
                      onChange={(_, v) => patch({ overlay_opacity: Number(v) })}
                      aria-label="Overlay opacity"
                    />
                    <Typography variant="caption" color="text.secondary">
                      Raise it if white text disappears into a bright photo.
                    </Typography>
                  </Box>

                  <Divider />

                  <GalleryListEditor
                    title="Gallery"
                    addLabel="Add image"
                    items={form.gallery}
                    max={specs?.limits.gallery ?? 12}
                    onChange={(gallery) => patch({ gallery })}
                    tileSlot={slotSpecs.gallery_tile}
                  />
                </Stack>
              )}

              {tab === 2 && (
                <Stack spacing={4}>
                  <BlockListEditor
                    blocks={form.blocks}
                    allowedTypes={
                      (form.page_type && specs?.blocks_by_page_type[form.page_type]) || []
                    }
                    maxBlocks={specs?.limits.blocks ?? 24}
                    onChange={(blocks) => patch({ blocks })}
                  />

                  <Divider />

                  <HighlightListEditor
                    title="Highlights"
                    addLabel="Add highlight"
                    items={form.highlights}
                    max={specs?.limits.highlights ?? 8}
                    onChange={(highlights) => patch({ highlights })}
                    iconSlot={slotSpecs.highlight_icon}
                  />

                  <StatListEditor
                    title="Stat chips"
                    addLabel="Add stat"
                    items={form.stats}
                    max={specs?.limits.stats ?? 6}
                    onChange={(stats) => patch({ stats })}
                  />

                  <FaqListEditor
                    title="FAQs"
                    addLabel="Add question"
                    items={form.faqs}
                    max={specs?.limits.faqs ?? 10}
                    onChange={(faqs) => patch({ faqs })}
                  />
                </Stack>
              )}

              {tab === 3 && (
                <SeoFields
                  value={seoValues}
                  onChange={(p) =>
                    patch({
                      ...(p.slug !== undefined ? { slug: p.slug } : {}),
                      ...(p.seo_title !== undefined ? { seo_title: p.seo_title } : {}),
                      ...(p.seo_description !== undefined
                        ? { seo_description: p.seo_description }
                        : {}),
                      ...(p.seo_keywords !== undefined ? { seo_keywords: p.seo_keywords } : {}),
                    })
                  }
                  urlBase="waytero.com/"
                  fallbackTitle={form.headline || derived?.headline || ""}
                  fallbackDescription={form.subheadline || derived?.subheadline || ""}
                  liveEntity={!!record?.is_published}
                  originalSlug={record?.slug ?? null}
                  slugMax={SEO_LIMITS.slug}
                  showSlug={false}
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Stack spacing={3}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                  URL
                </Typography>
                <TextField
                  size="small"
                  label="Slug"
                  value={form.slug}
                  onChange={(e) => {
                    patch({ slug: slugify(e.target.value, SEO_LIMITS.slug) });
                  }}
                  placeholder={suggestion?.slug || record?.slug || "derived from the scope"}
                  fullWidth
                  helperText={
                    isNew
                      ? "Leave blank to use the derived URL."
                      : "Renaming a live URL breaks whatever already links to it."
                  }
                  InputProps={{
                    startAdornment: <Box sx={{ mr: 0.5, color: "text.secondary" }}>/</Box>,
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                  Status
                </Typography>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      size="small"
                      color={form.is_published ? "success" : "default"}
                      label={form.is_published ? "Live" : "Draft"}
                    />
                    <Chip
                      size="small"
                      color={imageryUploaded ? "success" : "default"}
                      label={imageryUploaded ? "Has art" : "Gradient hero"}
                    />
                  </Stack>
                  {!isNew && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        publishMutation.mutate({
                          published: !form.is_published,
                          confirmed: false,
                        })
                      }
                      disabled={publishMutation.isPending}
                    >
                      {form.is_published ? "Unpublish" : "Publish"}
                    </Button>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    Publishing is checked against the page&rsquo;s own data: an empty FAQ
                    block or a grid that cannot be filled holds it back.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>

            {(suggestion?.prices || record?.derived) && (
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    What the page can claim
                  </Typography>
                  <Stack spacing={0.5}>
                    <Typography variant="body2">
                      Hotels: {suggestion?.prices.hotel_count ?? "—"}
                      {suggestion?.prices.hotel_from
                        ? ` · from ₹${Math.round(suggestion.prices.hotel_from).toLocaleString("en-IN")}`
                        : ""}
                    </Typography>
                    <Typography variant="body2">
                      Tour packages: {suggestion?.prices.tour_count ?? "—"}
                      {suggestion?.prices.tour_from
                        ? ` · from ₹${Math.round(suggestion.prices.tour_from).toLocaleString("en-IN")}`
                        : ""}
                    </Typography>
                    <Typography variant="body2">
                      Vehicles: {suggestion?.prices.vehicle_count ?? "—"}
                      {suggestion?.prices.cab_from
                        ? ` · trip from ₹${Math.round(suggestion.prices.cab_from).toLocaleString("en-IN")}`
                        : ""}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                      These come from the live pricing rules, not from anything typed here.
                      A page never advertises a price it cannot honour.
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>
      </Grid>

      <PublishBlockersDialog
        open={!!blockers}
        problems={blockers ?? []}
        confirming={publishMutation.isPending}
        onCancel={() => setBlockers(null)}
        onConfirm={() => publishMutation.mutate({ published: true, confirmed: true })}
      />
    </Box>
  );
}
