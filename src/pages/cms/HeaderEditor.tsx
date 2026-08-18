// ============================================================
// WAYTERO ADMIN — HEADER EDITOR
// Doc Ref: Migration 0044_website_cms
//
//  Edits the singleton SiteHeaderConfig:
//    • Logo (image), alt text, tagline
//    • Visibility toggles (search bar, login button)
//    • Header CTA (text + link)
//    • Support phone + contact email
//    • Navigation links (ordered list)
//    • Social links (per platform)
//    • Background / text colours
//
//  Saves with a single PATCH /admin/settings/cms/header.
//  Hero/preview shows the live state.
// ============================================================

import { useEffect, useState } from "react";
import {
  Box, Card, CardContent, Stack, Typography, TextField, Switch,
  FormControlLabel, Button, CircularProgress, Grid, Divider,
  Alert, alpha, useTheme,
} from "@mui/material";
import { Save, Refresh } from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import {
  cmsService, SiteHeader, SiteHeaderUpdatePayload,
} from "../../services/cms.service";
import { apiErrorMessage } from "../../utils/apiError";

import MediaUploader, { CropSpec } from "./components/MediaUploader";

// Header logo is rendered in the navbar — typically wide-aspect
// (think "logo + wordmark"). A 4:1 box at 480×120 is a sensible
// target: tall enough for the navbar, roomy enough for a wordmark.
const LOGO_CROP: CropSpec = {
  aspectRatio: 4,
  outputWidth: 480,
  outputHeight: 120,
};
import LinkListEditor from "./components/LinkListEditor";
import SocialLinksEditor from "./components/SocialLinksEditor";

export default function HeaderEditor() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const { data: header, isLoading, refetch } = useQuery({
    queryKey: ["cms-header"],
    queryFn: cmsService.getHeader,
    staleTime: 30_000,
  });

  // Local draft state — copy server data into here on first load so the
  // admin can fiddle with it freely without every keystroke triggering PATCH.
  const [draft, setDraft] = useState<SiteHeader | null>(null);
  useEffect(() => {
    if (header && !draft) setDraft(header);
  }, [header, draft]);

  const save = useMutation({
    mutationFn: (payload: SiteHeaderUpdatePayload) =>
      cmsService.updateHeader(payload),
    onSuccess: (next) => {
      enqueueSnackbar("Header saved", { variant: "success" });
      qc.setQueryData(["cms-header"], next);
      setDraft(next);
    },
    onError: (e) => enqueueSnackbar(apiErrorMessage(e, "Save failed"), { variant: "error" }),
  });

  if (isLoading || !draft) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
        <CircularProgress />
      </Box>
    );
  }

  const set = <K extends keyof SiteHeader>(k: K, v: SiteHeader[K]) =>
    setDraft({ ...draft, [k]: v });

  const onSave = () => save.mutate(draft);

  const dirty = JSON.stringify(draft) !== JSON.stringify(header);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Global Header
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Controls the website header shown on every page. There is exactly one row;
            changes apply as soon as you save.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<Refresh />} onClick={() => { refetch(); if (header) setDraft(header); }}>
            Reset
          </Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={onSave}
            disabled={!dirty || save.isPending}
          >
            {save.isPending ? "Saving…" : "Save header"}
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        {/* Left: editor */}
        <Grid item xs={12} md={8}>
          <Stack spacing={2}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} mb={2}>
                  Brand
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <MediaUploader
                      label="Upload logo"
                      hint="PNG/SVG with transparent background. Stored under waytero/cms/header."
                      kind="logo"
                      folder="waytero/cms/header"
                      value={draft.logo_url}
                      onChange={(v) => set("logo_url", v)}
                      previewHeight={120}
                      crop={LOGO_CROP}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Stack spacing={1.5}>
                      <TextField
                        size="small" label="Logo alt text"
                        value={draft.logo_alt_text ?? ""}
                        onChange={(e) => set("logo_alt_text", e.target.value || null)}
                      />
                      <TextField
                        size="small" label="Tagline"
                        value={draft.tagline ?? ""}
                        onChange={(e) => set("tagline", e.target.value || null)}
                        helperText="Short text shown next to / below the logo"
                      />
                    </Stack>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} mb={2}>
                  Visibility
                </Typography>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={draft.show_search_bar}
                        onChange={(e) => set("show_search_bar", e.target.checked)}
                      />
                    }
                    label="Show search bar"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={draft.show_login_button}
                        onChange={(e) => set("show_login_button", e.target.checked)}
                      />
                    }
                    label="Show login button"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={draft.is_active}
                        onChange={(e) => set("is_active", e.target.checked)}
                      />
                    }
                    label="Header live on site"
                  />
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} mb={2}>
                  Header CTA
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      size="small" fullWidth label="CTA text"
                      placeholder="Book a ride"
                      value={draft.cta_text ?? ""}
                      onChange={(e) => set("cta_text", e.target.value || null)}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      size="small" fullWidth label="CTA link"
                      placeholder="/book or https://…"
                      value={draft.cta_link ?? ""}
                      onChange={(e) => set("cta_link", e.target.value || null)}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} mb={2}>
                  Contact
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      size="small" fullWidth label="Support phone"
                      value={draft.support_phone ?? ""}
                      onChange={(e) => set("support_phone", e.target.value || null)}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      size="small" fullWidth label="Contact email"
                      value={draft.contact_email ?? ""}
                      onChange={(e) => set("contact_email", e.target.value || null)}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <LinkListEditor
                  label="Navigation links"
                  hint="Order is the order they appear in the header"
                  value={draft.nav_links ?? []}
                  onChange={(next) => set("nav_links", next)}
                />
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <SocialLinksEditor
                  value={draft.social_links ?? {}}
                  onChange={(next) => set("social_links", next)}
                />
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} mb={2}>
                  Colours
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      size="small" fullWidth label="Background colour"
                      placeholder="#FFFFFF or rgba(…)"
                      value={draft.background_color ?? ""}
                      onChange={(e) => set("background_color", e.target.value || null)}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      size="small" fullWidth label="Text colour"
                      placeholder="#0F172A"
                      value={draft.text_color ?? ""}
                      onChange={(e) => set("text_color", e.target.value || null)}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* Right: live preview */}
        <Grid item xs={12} md={4}>
          <Card
            variant="outlined"
            sx={{
              borderRadius: 2,
              position: { md: "sticky" },
              top: { md: 80 },
              bgcolor: draft.background_color || alpha(theme.palette.primary.main, 0.02),
            }}
          >
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Preview
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" alignItems="center" spacing={2} sx={{ py: 1.5 }}>
                {draft.logo_url ? (
                  <Box
                    component="img"
                    src={draft.logo_url}
                    alt={draft.logo_alt_text ?? ""}
                    sx={{ height: 36, objectFit: "contain" }}
                  />
                ) : (
                  <Box sx={{ width: 36, height: 36, borderRadius: 1, bgcolor: "primary.main" }} />
                )}
                <Box flex={1} minWidth={0}>
                  <Typography
                    variant="subtitle1"
                    fontWeight={700}
                    noWrap
                    sx={{ color: draft.text_color || "text.primary" }}
                  >
                    WayTero
                  </Typography>
                  {draft.tagline && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {draft.tagline}
                    </Typography>
                  )}
                </Box>
                {draft.cta_text && (
                  <Button size="small" variant="contained" disabled>
                    {draft.cta_text}
                  </Button>
                )}
              </Stack>
              {draft.nav_links?.length > 0 && (
                <Stack direction="row" spacing={1.5} sx={{ pt: 1, flexWrap: "wrap" }}>
                  {draft.nav_links.slice(0, 5).map((l, i) => (
                    <Typography
                      key={i}
                      variant="caption"
                      sx={{
                        color: draft.text_color || "text.secondary",
                        fontWeight: 500,
                      }}
                    >
                      {l.label || "(label)"}
                    </Typography>
                  ))}
                </Stack>
              )}
              {!draft.is_active && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Header is hidden from the live site.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}