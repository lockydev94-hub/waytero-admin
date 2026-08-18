// ============================================================
// WAYTERO ADMIN — AUTH MODAL EDITOR (CMS)
// Doc Ref: BRD Part 6 §155 — admin-controlled homepage surfaces
//
//  Manages the promotion images shown in the customer website's
//  login/auth modal (left-side image slider next to the login form).
//  Images are stored as a JSON array of Cloudinary URLs under the
//  AUTH_MODAL_IMAGES system configuration key — the same pattern
//  as PLATFORM_OFFICE_ADDRESSES.
//
//  The website modal is built for PORTRAIT (3:4) artwork — like a
//  travel promotion poster. The uploader crops every image to
//  810×1080 before it reaches Cloudinary so the slider always gets
//  the correct size.
//
//  Public read path: GET /public/auth-modal-images
// ============================================================

import { useEffect, useMemo, useState } from "react";
import {
  Box, Card, CardContent, Stack, Typography, Button, Grid, Divider,
  Alert, CircularProgress, IconButton, Tooltip, Chip, alpha, useTheme,
} from "@mui/material";
import {
  Save, Refresh, Delete, KeyboardArrowUp, KeyboardArrowDown,
  Image as ImageIcon, Login,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { settingsService } from "../../services/settings.service";
import { apiErrorMessage } from "../../utils/apiError";

import MediaUploader, { CropSpec } from "./components/MediaUploader";

// The website auth modal slider is portrait (like the sample travel
// poster). Crop every upload to a clean 3:4 at 810×1080 so it fills
// the slider exactly without letterboxing.
const POSTER_CROP: CropSpec = {
  aspectRatio: 3 / 4,
  outputWidth: 810,
  outputHeight: 1080,
};

const CONFIG_KEY = "AUTH_MODAL_IMAGES";
const UPLOAD_FOLDER = "waytero/cms/auth-modal";

function parseImages(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((u) => String(u)).filter((u) => u.trim() !== "");
    }
  } catch {
    /* malformed config → treat as empty */
  }
  return [];
}

// ── Live preview: mock of the website auth modal ──────────────
function AuthModalPreview({ images }: { images: string[] }) {
  const theme = useTheme();
  const first = images[0];

  return (
    <Box
      sx={{
        borderRadius: 2.5,
        overflow: "hidden",
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: "0 16px 48px rgba(11,27,59,0.18)",
        display: "flex",
        bgcolor: "background.paper",
        maxWidth: 460,
      }}
    >
      {/* Left — image slider panel (portrait) */}
      <Box
        sx={{
          width: 170,
          minHeight: 340,
          flexShrink: 0,
          position: "relative",
          display: { xs: "none", sm: "block" },
        }}
      >
        {first ? (
          <Box
            component="img"
            src={first}
            alt="Auth modal promotion"
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              p: 2,
              textAlign: "center",
              background: `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.12)}, ${alpha(theme.palette.secondary.main, 0.08)})`,
            }}
          >
            <Login sx={{ fontSize: 34, color: "text.disabled" }} />
            <Typography variant="caption" color="text.secondary">
              No promotion image yet — modal shows the form only
            </Typography>
          </Box>
        )}
        {images.length > 1 && (
          <Chip
            size="small"
            label={`1 / ${images.length}`}
            sx={{
              position: "absolute", bottom: 8, left: 8,
              bgcolor: "rgba(11,27,59,0.55)", color: "#fff",
              height: 18, fontSize: "0.62rem", fontWeight: 700,
            }}
          />
        )}
      </Box>

      {/* Right — form column */}
      <Box sx={{ flex: 1, p: 2.5 }}>
        <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }}>Login or Sign Up</Typography>
        <Box
          sx={{
            mt: 1.5, borderRadius: 1, height: 30, bgcolor: alpha(theme.palette.primary.main, 0.08),
            display: "flex", alignItems: "center", px: 1,
          }}
        >
          <Box sx={{ width: 14, height: 14, borderRadius: "50%", bgcolor: "primary.main", mr: 1 }} />
          <Typography variant="caption" fontWeight={700} color="primary.main">Mobile</Typography>
        </Box>
        <Box sx={{ mt: 1.5, borderRadius: 1, height: 32, border: `1px solid ${theme.palette.divider}`, bgcolor: "grey.50" }} />
        <Box
          sx={{
            mt: 1.5, borderRadius: 1, height: 34,
            background: `linear-gradient(135deg, ${theme.palette.warning.main}, ${theme.palette.warning.dark})`,
          }}
        />
      </Box>
    </Box>
  );
}

// ── Main editor ──────────────────────────────────────────────
export default function AuthModalEditor() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const { data: configs, isLoading, refetch } = useQuery({
    queryKey: ["cms-auth-modal-images"],
    queryFn: () => settingsService.getConfigurations(),
    staleTime: 30_000,
  });

  const saved = useMemo(() => {
    const cfg = (configs ?? []).find((c) => c.config_key === CONFIG_KEY);
    return parseImages(cfg?.config_value);
  }, [configs]);

  const [images, setImages] = useState<string[]>([]);
  const [uploadKey, setUploadKey] = useState(0);

  useEffect(() => {
    setImages(saved);
  }, [saved]);

  const save = useMutation({
    mutationFn: (value: string[]) =>
      settingsService.upsertConfiguration(
        CONFIG_KEY,
        JSON.stringify(value),
        "Promotion images for the website login/auth modal (portrait 3:4)"
      ),
    onSuccess: () => {
      enqueueSnackbar("Auth modal images saved", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["cms-auth-modal-images"] });
    },
    onError: (e) => enqueueSnackbar(apiErrorMessage(e, "Save failed"), { variant: "error" }),
  });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
        <CircularProgress />
      </Box>
    );
  }

  const dirty = JSON.stringify(images) !== JSON.stringify(saved);

  const onUploaded = (url: string | null) => {
    if (url) {
      setImages((prev) => (prev.includes(url) ? prev : [...prev, url]));
      enqueueSnackbar("Image added — press Save to publish", { variant: "success" });
    }
    // Remount the uploader so it's ready for the next image.
    setUploadKey((k) => k + 1);
  };

  const move = (idx: number, dir: -1 | 1) => {
    setImages((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const remove = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Auth Modal Promotion Images
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Images shown on the left side of the website login/sign-up modal —
            the login form stays on the right. Upload one or more; they rotate
            in a slider.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<Refresh />}
            onClick={() => {
              refetch();
              setImages(saved);
            }}
          >
            Reset
          </Button>
          <Button
            variant="contained"
            startIcon={save.isPending ? <CircularProgress size={16} color="inherit" /> : <Save />}
            onClick={() => save.mutate(images)}
            disabled={!dirty || save.isPending}
          >
            {save.isPending ? "Saving…" : `Save (${images.length} image${images.length === 1 ? "" : "s"})`}
          </Button>
        </Stack>
      </Stack>

      <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
        The modal is designed for <strong>portrait (3:4)</strong> artwork like a travel
        promotion poster. Every upload is automatically cropped to <strong>810 × 1080</strong>
        so it displays at the correct size in the website auth modal.
      </Alert>

      <Grid container spacing={2}>
        {/* Left: editor */}
        <Grid item xs={12} md={8}>
          <Stack spacing={2}>
            {/* Uploader */}
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
                  Add promotion image
                </Typography>
                <MediaUploader
                  key={uploadKey}
                  label="Upload portrait image (3:4)"
                  hint="PNG / JPG / WebP — travel promotion posters work best"
                  kind="image"
                  folder={UPLOAD_FOLDER}
                  value={null}
                  onChange={onUploaded}
                  previewHeight={150}
                  crop={POSTER_CROP}
                />
              </CardContent>
            </Card>

            {/* Images list */}
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    Uploaded images ({images.length})
                  </Typography>
                  {images.length > 1 && (
                    <Typography variant="caption" color="text.secondary">
                      Order = slider rotation order
                    </Typography>
                  )}
                </Stack>

                {images.length === 0 ? (
                  <Box
                    sx={{
                      p: 4, textAlign: "center", borderRadius: 2,
                      border: `1px dashed ${theme.palette.divider}`,
                      bgcolor: alpha(theme.palette.primary.main, 0.02),
                    }}
                  >
                    <ImageIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No images yet. Upload at least one — the website auth modal will show
                      the slider only when images exist.
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={1}>
                    {images.map((url, idx) => (
                      <Box
                        key={`${url}-${idx}`}
                        sx={{
                          p: 1, borderRadius: 2,
                          display: "flex", alignItems: "center", gap: 1.5,
                          border: `1px solid ${theme.palette.divider}`,
                          bgcolor: idx === 0 ? alpha(theme.palette.primary.main, 0.03) : "transparent",
                        }}
                      >
                        {/* Portrait thumbnail */}
                        <Box
                          component="img"
                          src={url}
                          alt={`Auth modal image ${idx + 1}`}
                          sx={{
                            width: 52, height: 68, borderRadius: 1,
                            objectFit: "cover", flexShrink: 0,
                            border: `1px solid ${theme.palette.divider}`,
                          }}
                        />
                        <Box flex={1} minWidth={0}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Chip
                              size="small"
                              label={`#${idx + 1}`}
                              color={idx === 0 ? "primary" : "default"}
                              sx={{ height: 20, fontSize: "0.68rem", fontWeight: 700 }}
                            />
                            {idx === 0 && (
                              <Typography variant="caption" color="primary.main" fontWeight={700}>
                                Shown first
                              </Typography>
                            )}
                          </Stack>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: "block", mt: 0.5,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              fontFamily: "monospace", fontSize: "0.62rem",
                            }}
                          >
                            {url}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Move earlier">
                            <span>
                              <IconButton size="small" onClick={() => move(idx, -1)} disabled={idx === 0}>
                                <KeyboardArrowUp fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Move later">
                            <span>
                              <IconButton size="small" onClick={() => move(idx, 1)} disabled={idx === images.length - 1}>
                                <KeyboardArrowDown fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Remove">
                            <IconButton size="small" color="error" onClick={() => remove(idx)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* Right: live preview */}
        <Grid item xs={12} md={4}>
          <Card
            variant="outlined"
            sx={{ borderRadius: 2, position: { md: "sticky" }, top: { md: 80 } }}
          >
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Live preview
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
                <AuthModalPreview images={images} />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
                Preview shows how the login modal looks on desktop: portrait images
                on the left, the login form on the right. On mobile the form shows
                full-width without the image panel.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
