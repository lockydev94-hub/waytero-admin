// ============================================================
// WAYTERO ADMIN — FOOTER EDITOR
// Doc Ref: Migration 0044_website_cms
//
//  Edits the singleton SiteFooterConfig:
//    • Logo, description, copyright
//    • Company address, support phone, contact email
//    • Quick links (ordered)
//    • Legal links (ordered)
//    • Social links
//    • Payment icons (label + image)
//    • App store links (android + ios)
//    • Background / text colours
//
//  Saves with a single PATCH /admin/settings/cms/footer.
// ============================================================

import { useEffect, useState } from "react";
import {
  Box, Card, CardContent, Stack, Typography, TextField, Switch,
  FormControlLabel, Button, CircularProgress, Grid, Divider,
  Alert, alpha, useTheme,
  IconButton,
} from "@mui/material";
import { Save, Refresh, Add, Delete } from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import {
  cmsService, SiteFooter, SiteFooterUpdatePayload, PaymentIconItem,
} from "../../services/cms.service";
import { apiErrorMessage } from "../../utils/apiError";

import MediaUploader, { CropSpec } from "./components/MediaUploader";

// Footer logo: same proportions as the header logo so the brand
// looks identical at top and bottom of the page.
const LOGO_CROP: CropSpec = {
  aspectRatio: 4,
  outputWidth: 480,
  outputHeight: 120,
};

// Payment-method icons render as small squares in a row.
const PAYMENT_ICON_CROP: CropSpec = {
  aspectRatio: 1,
  outputWidth: 256,
  outputHeight: 256,
};
import LinkListEditor from "./components/LinkListEditor";
import SocialLinksEditor from "./components/SocialLinksEditor";

export default function FooterEditor() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const { data: footer, isLoading, refetch } = useQuery({
    queryKey: ["cms-footer"],
    queryFn: cmsService.getFooter,
    staleTime: 30_000,
  });

  const [draft, setDraft] = useState<SiteFooter | null>(null);
  useEffect(() => {
    if (footer && !draft) setDraft(footer);
  }, [footer, draft]);

  const save = useMutation({
    mutationFn: (payload: SiteFooterUpdatePayload) =>
      cmsService.updateFooter(payload),
    onSuccess: (next) => {
      enqueueSnackbar("Footer saved", { variant: "success" });
      qc.setQueryData(["cms-footer"], next);
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

  const set = <K extends keyof SiteFooter>(k: K, v: SiteFooter[K]) =>
    setDraft({ ...draft, [k]: v });

  const dirty = JSON.stringify(draft) !== JSON.stringify(footer);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Global Footer
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Controls the website footer shown on every page. There is exactly one row;
            changes apply as soon as you save.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<Refresh />} onClick={() => { refetch(); if (footer) setDraft(footer); }}>
            Reset
          </Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={() => save.mutate(draft)}
            disabled={!dirty || save.isPending}
          >
            {save.isPending ? "Saving…" : "Save footer"}
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Stack spacing={2}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} mb={2}>
                  Brand & description
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <MediaUploader
                      label="Upload footer logo"
                      kind="logo"
                      folder="waytero/cms/footer"
                      value={draft.logo_url}
                      onChange={(v) => set("logo_url", v)}
                      previewHeight={100}
                      crop={LOGO_CROP}
                    />
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <Stack spacing={1.5}>
                      <TextField
                        size="small" fullWidth label="Description"
                        multiline minRows={2}
                        value={draft.description ?? ""}
                        onChange={(e) => set("description", e.target.value || null)}
                      />
                      <TextField
                        size="small" fullWidth label="Copyright text"
                        placeholder="© 2026 WayTero Technologies Pvt Ltd"
                        value={draft.copyright_text ?? ""}
                        onChange={(e) => set("copyright_text", e.target.value || null)}
                      />
                      <TextField
                        size="small" fullWidth label="Company address"
                        multiline minRows={2}
                        value={draft.company_address ?? ""}
                        onChange={(e) => set("company_address", e.target.value || null)}
                      />
                    </Stack>
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
                  label="Quick links"
                  hint="Top-of-footer link column"
                  value={draft.quick_links ?? []}
                  onChange={(next) => set("quick_links", next)}
                />
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <LinkListEditor
                  label="Legal links"
                  hint="Terms, privacy, refund policy…"
                  value={draft.legal_links ?? []}
                  onChange={(next) => set("legal_links", next)}
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
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Payment icons
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Card networks and wallets displayed in the footer.
                    </Typography>
                  </Box>
                  <Button
                    size="small" variant="outlined" startIcon={<Add />}
                    onClick={() =>
                      set("payment_icons", [
                        ...(draft.payment_icons ?? []),
                        { label: "", image_url: "" },
                      ])
                    }
                  >
                    Add icon
                  </Button>
                </Stack>

                {(draft.payment_icons ?? []).length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                    No payment icons yet.
                  </Typography>
                )}

                <Stack spacing={1.5}>
                  {(draft.payment_icons ?? []).map((p: PaymentIconItem, idx: number) => (
                    <Card key={idx} variant="outlined" sx={{ borderRadius: 2 }}>
                      <CardContent sx={{ display: "flex", gap: 2, alignItems: "flex-start", py: 1.5, "&:last-child": { pb: 1.5 } }}>
                        <MediaUploader
                          label="Icon"
                          kind="payment_icon"
                          folder="waytero/cms/footer/payment"
                          value={p.image_url}
                          onChange={(v) => {
                            const next = (draft.payment_icons ?? []).map(
                              (it, i) => (i === idx ? { ...it, image_url: v ?? "" } : it)
                            );
                            set("payment_icons", next);
                          }}
                          previewHeight={64}
                          crop={PAYMENT_ICON_CROP}
                        />
                        <TextField
                          size="small" label="Label"
                          value={p.label}
                          onChange={(e) => {
                            const next = (draft.payment_icons ?? []).map(
                              (it, i) => (i === idx ? { ...it, label: e.target.value } : it)
                            );
                            set("payment_icons", next);
                          }}
                          sx={{ flex: 1 }}
                        />
                        <IconButton
                          color="error"
                          onClick={() =>
                            set(
                              "payment_icons",
                              (draft.payment_icons ?? []).filter((_, i) => i !== idx),
                            )
                          }
                          aria-label="Remove payment icon"
                        >
                          <Delete />
                        </IconButton>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} mb={2}>
                  App store badges
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      size="small" fullWidth label="Google Play URL"
                      placeholder="https://play.google.com/…"
                      value={draft.app_store_links?.android ?? ""}
                      onChange={(e) =>
                        set("app_store_links", {
                          ...(draft.app_store_links ?? {}),
                          android: e.target.value,
                        })
                      }
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      size="small" fullWidth label="App Store URL"
                      placeholder="https://apps.apple.com/…"
                      value={draft.app_store_links?.ios ?? ""}
                      onChange={(e) =>
                        set("app_store_links", {
                          ...(draft.app_store_links ?? {}),
                          ios: e.target.value,
                        })
                      }
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={draft.is_active}
                        onChange={(e) => set("is_active", e.target.checked)}
                      />
                    }
                    label="Footer live on site"
                  />
                </Stack>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" fontWeight={700} mb={2}>
                  Colours
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      size="small" fullWidth label="Background colour"
                      value={draft.background_color ?? ""}
                      onChange={(e) => set("background_color", e.target.value || null)}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      size="small" fullWidth label="Text colour"
                      value={draft.text_color ?? ""}
                      onChange={(e) => set("text_color", e.target.value || null)}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card
            variant="outlined"
            sx={{
              borderRadius: 2,
              position: { md: "sticky" },
              top: { md: 80 },
              bgcolor: draft.background_color || alpha(theme.palette.primary.main, 0.04),
            }}
          >
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Preview
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" alignItems="center" spacing={2} sx={{ py: 1 }}>
                {draft.logo_url ? (
                  <Box
                    component="img"
                    src={draft.logo_url}
                    alt=""
                    sx={{ height: 32, objectFit: "contain" }}
                  />
                ) : (
                  <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: "primary.main" }} />
                )}
                <Box flex={1} minWidth={0}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: draft.text_color || "text.primary" }}>
                    WayTero
                  </Typography>
                  {draft.description && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {draft.description.slice(0, 60)}
                    </Typography>
                  )}
                </Box>
              </Stack>
              {draft.quick_links?.length > 0 && (
                <Stack direction="row" spacing={1.5} sx={{ pt: 1, flexWrap: "wrap" }}>
                  {draft.quick_links.slice(0, 5).map((l, i) => (
                    <Typography
                      key={i}
                      variant="caption"
                      sx={{ color: draft.text_color || "text.secondary", fontWeight: 500 }}
                    >
                      {l.label || "(label)"}
                    </Typography>
                  ))}
                </Stack>
              )}
              <Typography
                variant="caption"
                sx={{ display: "block", mt: 2, color: draft.text_color || "text.secondary" }}
              >
                {draft.copyright_text ?? "© WayTero"}
              </Typography>
              {!draft.is_active && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Footer is hidden from the live site.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}