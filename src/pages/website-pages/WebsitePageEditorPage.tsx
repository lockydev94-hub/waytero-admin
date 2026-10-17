// ============================================================
// WAYTERO ADMIN — WEBSITE PAGE EDITOR
// Doc Ref: Round 6 · Website → Pages
//  Route: /cms/pages/:slug
//
//  The whole of one public page's prose: the headline it opens with, the
//  paragraphs under it, its FAQ, and the two strings Google shows for it. It
//  writes two `system_configurations` rows and nothing else — no table, no
//  endpoint, no migration — because the website already resolves
//  `LEGAL_PAGE_{SLUG}` as a generic published-body namespace.
//
//  Three rules this screen exists to enforce:
//
//  1. There is no raw JSON anywhere. A policy page that fails to parse falls
//     back silently on the public site, which is the worst possible outcome
//     for the one document type that has to be right.
//  2. The rail says which copy the reader is actually getting. "I saved it"
//     and "the site serves it" are different facts, and an admin is entitled
//     to know which one they are looking at.
//  3. Deleting a body is allowed and means something: the page returns to the
//     copy shipped with the website, which is vetted text, not a blank screen.
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { ArrowBack, OpenInNew, RestoreFromTrash } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import SeoFields, { type SeoValues } from "../../components/forms/SeoFields";
import { FaqListEditor } from "../landing-pages/components/ContentLists";
import { SITE_URL } from "../../constants";
import {
  emptyBody,
  MAX_FAQS,
  PAGE_REGISTRY,
  pagesService,
  STATE_HINT,
  STATE_LABEL,
  type PageBody,
  type PageSeo,
} from "../../services/pages.service";
import { apiErrorMessage } from "../../utils/apiError";
import PageSectionListEditor from "./components/PageSectionListEditor";

interface Draft {
  body: PageBody;
  seo: PageSeo;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function WebsitePageEditorPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const registry = useMemo(() => PAGE_REGISTRY.find((p) => p.slug === slug) ?? null, [slug]);

  const [tab, setTab] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["website-page", slug],
    queryFn: () => pagesService.getPage(slug),
    enabled: !!registry,
  });

  // First load seeds both the working copy and the comparison copy. `saved` is
  // what the server holds, so "unsaved changes" means exactly that.
  useEffect(() => {
    if (!data || !registry || draft) return;
    const seeded: Draft = {
      body: data.body ?? emptyBody(slug, registry.label),
      seo: { title: data.seo.title, description: data.seo.description },
    };
    setDraft(seeded);
    setSaved(seeded);
  }, [data, draft, registry, slug]);

  const dirty = useMemo(
    () => (draft && saved ? JSON.stringify(draft) !== JSON.stringify(saved) : false),
    [draft, saved]
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["website-pages"] });
    qc.invalidateQueries({ queryKey: ["website-page", slug] });
  };

  const saveMutation = useMutation({
    mutationFn: (payload: Draft) => pagesService.savePage(slug, payload.body, payload.seo),
    onSuccess: () => {
      setSaved(draft);
      invalidate();
      enqueueSnackbar("Saved. The website picks this up within about five minutes.", {
        variant: "success",
      });
    },
    onError: (err) => enqueueSnackbar(apiErrorMessage(err, "Save failed"), { variant: "error" }),
  });

  const resetMutation = useMutation({
    mutationFn: () => pagesService.resetPage(slug),
    onSuccess: () => {
      setResetOpen(false);
      setDraft(null);
      setSaved(null);
      invalidate();
      enqueueSnackbar("Page copy reset — the site is back on its built-in text.", {
        variant: "info",
      });
    },
    onError: (err) => enqueueSnackbar(apiErrorMessage(err, "Reset failed"), { variant: "error" }),
  });

  if (!registry) {
    return (
      <Alert severity="error" sx={{ mt: 3 }}>
        Unknown page <code>{slug}</code>. This screen only edits the pages the website resolves as
        <code> LEGAL_PAGE_* </code> — go back to the list and pick one.
        <Button size="small" onClick={() => navigate("/cms/pages")} sx={{ ml: 1 }}>
          Back to pages
        </Button>
      </Alert>
    );
  }

  if (isLoading || !draft) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (isError) {
    return <Alert severity="error">{apiErrorMessage(error, "Could not load this page.")}</Alert>;
  }

  const state = data?.state ?? "built-in";
  const patchBody = (patch: Partial<PageBody>) =>
    setDraft((d) => (d ? { ...d, body: { ...d.body, ...patch } } : d));
  const patchSeo = (patch: Partial<PageSeo>) =>
    setDraft((d) => (d ? { ...d, seo: { ...d.seo, ...patch } } : d));

  const filledSections = draft.body.sections.filter(
    (s) => s.heading.trim() && s.body.trim()
  );
  const faqs = (draft.body.faq ?? []).filter((f) => f.question.trim() && f.answer.trim());

  const onSubmit = () => {
    if (!draft.body.title.trim()) {
      enqueueSnackbar("The page needs a title — the headline an <h1> prints.", { variant: "error" });
      setTab(0);
      return;
    }
    // A half-typed row is not a section: dropping it is kinder than printing
    // an empty heading on a policy page.
    saveMutation.mutate({
      body: {
        ...draft.body,
        title: draft.body.title.trim(),
        eyebrow: draft.body.eyebrow?.trim() || null,
        description: draft.body.description?.trim() || null,
        sections: filledSections,
        faq: registry.hasFaq ? faqs : [],
      },
      seo: draft.seo,
    });
  };

  const seoValues: SeoValues = {
    slug: registry.path.replace(/^\//, ""),
    seo_title: draft.seo.title,
    seo_description: draft.seo.description,
    seo_keywords: "",
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={8}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
          <Button size="small" startIcon={<ArrowBack />} onClick={() => navigate("/cms/pages")}>
            Pages
          </Button>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h5" fontWeight={700} noWrap>
              {registry.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {SITE_URL}
              {registry.path}
            </Typography>
          </Box>
          {dirty && <Chip size="small" color="warning" label="Unsaved changes" />}
        </Stack>

        <Card>
          <CardContent>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
              <Tab label="Body" />
              {registry.hasFaq && <Tab label="FAQ" />}
              <Tab label="SEO" />
            </Tabs>

            {tab === 0 && (
              <Stack spacing={2.5}>
                <TextField
                  size="small"
                  label="Page title"
                  value={draft.body.title}
                  onChange={(e) => patchBody({ title: e.target.value })}
                  fullWidth
                  required
                  inputProps={{ maxLength: 120 }}
                  helperText="The <h1> at the top of the page, and what the browser tab shows when no SEO title is set."
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    size="small"
                    label="Eyebrow"
                    value={draft.body.eyebrow ?? ""}
                    onChange={(e) => patchBody({ eyebrow: e.target.value })}
                    fullWidth
                    inputProps={{ maxLength: 40 }}
                    helperText="Small caps above the title — “Legal”, “Policy”, “Guide”. Leave blank for none."
                  />
                  <TextField
                    size="small"
                    label="Effective date"
                    type="date"
                    value={draft.body.effective_date ?? ""}
                    onChange={(e) => patchBody({ effective_date: e.target.value || null })}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    helperText="Printed as “Effective …”. Blank prints nothing."
                  />
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    size="small"
                    label="Last updated"
                    type="date"
                    value={draft.body.updated_at ?? ""}
                    onChange={(e) => patchBody({ updated_at: e.target.value || null })}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    helperText="Printed as “Last updated …” — a date the reader can hold you to."
                  />
                  <Button
                    size="small"
                    onClick={() => patchBody({ updated_at: today() })}
                    sx={{ alignSelf: "flex-end", mb: 1 }}
                  >
                    Set to today
                  </Button>
                </Stack>
                <TextField
                  size="small"
                  label="Standfirst"
                  value={draft.body.description ?? ""}
                  onChange={(e) => patchBody({ description: e.target.value })}
                  multiline
                  minRows={2}
                  fullWidth
                  inputProps={{ maxLength: 400 }}
                  helperText="The sentence under the headline. Used as the default search description if the SEO tab is left empty."
                />

                <Divider />

                <PageSectionListEditor
                  items={draft.body.sections}
                  onChange={(sections) => patchBody({ sections })}
                />

                {filledSections.length === 0 && (
                  <Alert severity="warning">
                    Nothing filled in yet. Saving like this puts the page back on the website's
                    built-in copy — useful, but not what the switch next to “Published” suggests.
                  </Alert>
                )}

                <Divider />

                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Switch
                    checked={draft.body.is_published !== false}
                    onChange={(e) => patchBody({ is_published: e.target.checked })}
                    inputProps={{ "aria-label": "Publish this page body" }}
                  />
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      Published
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Off means the public page shows the copy shipped with the website instead of
                      what you wrote here.
                    </Typography>
                  </Box>
                </Stack>
              </Stack>
            )}

            {registry.hasFaq && tab === 1 && (
              <FaqListEditor
                title="FAQs"
                addLabel="Add question"
                caption="The page renders these as an accordion and search engines read them as a rich result. A question with no answer is dropped on save."
                items={draft.body.faq ?? []}
                max={MAX_FAQS}
                onChange={(faq) => patchBody({ faq })}
              />
            )}

            {tab === (registry.hasFaq ? 2 : 1) && (
              <SeoFields
                value={seoValues}
                onChange={(patch) =>
                  patchSeo({
                    title: patch.seo_title ?? draft.seo.title,
                    description: patch.seo_description ?? draft.seo.description,
                  })
                }
                urlBase={`${SITE_URL}`}
                fallbackTitle={draft.body.title || registry.label}
                fallbackDescription={draft.body.description ?? ""}
                showSlug={false}
                showKeywords={false}
                keywordsHiddenNote="Meta keywords for these pages are fixed in the website's code, so there is nothing to set here. The title and description above are what Google shows."
              />
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Stack spacing={2} sx={{ position: { md: "sticky" }, top: 24 }}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                The live page is serving
              </Typography>
              <Chip
                size="small"
                label={STATE_LABEL[state]}
                color={state === "live" ? "success" : state === "corrupt" ? "error" : "warning"}
                sx={{ mt: 0.5, mb: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                {STATE_HINT[state]}
              </Typography>
              {registry.dataSource && (
                <Alert severity="info" sx={{ mt: 2, py: 0 }}>
                  The numbers on this page come from {registry.dataSource}. Editing them here would
                  only make the text disagree with the engine.
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={1.25}>
                <Button
                  variant="contained"
                  onClick={onSubmit}
                  disabled={saveMutation.isPending || !dirty}
                  startIcon={saveMutation.isPending ? <CircularProgress size={16} /> : undefined}
                  fullWidth
                >
                  Save page
                </Button>
                <Tooltip title={dirty ? "Save or discard first — the preview shows what is live, not what is typed" : ""}>
                  <span>
                    <Button
                      variant="outlined"
                      startIcon={<OpenInNew />}
                      fullWidth
                      onClick={() => window.open(`${SITE_URL}${registry.path}`, "_blank", "noopener,noreferrer")}
                    >
                      Preview on site
                    </Button>
                  </span>
                </Tooltip>
                <Button
                  color="warning"
                  variant="text"
                  startIcon={<RestoreFromTrash />}
                  fullWidth
                  disabled={state === "built-in" || resetMutation.isPending}
                  onClick={() => setResetOpen(true)}
                >
                  Reset to built-in copy
                </Button>
                <Typography variant="caption" color="text.secondary">
                  The website caches page text for five minutes, so a save shows up on the public
                  page after that window — not the moment you press Save.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Grid>

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)}>
        <DialogTitle>Reset {registry.label}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This deletes the saved body for {registry.path}. The page does not go blank — it goes
            back to the copy that ships with the website. Its search title and description are left
            as they are.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)}>Cancel</Button>
          <Button color="warning" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
            {resetMutation.isPending ? "Resetting…" : "Reset to built-in copy"}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
