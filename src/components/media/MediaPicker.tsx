// ============================================================
// WAYTERO ADMIN — MEDIA PICKER MODAL (Gallery + Upload)
// Doc Ref: Backend /admin/settings/media-library
//
//  The one modal that powers every image upload in the admin
//  portal. When an admin clicks "upload" the modal opens with two
//  tabs:
//
//    • Gallery — browse every image already in Cloudinary, filter
//      by folder, search by filename, load more with pagination,
//      single or multi select. Optionally delete stale assets.
//    • Upload — pick a file from the device, optionally crop /
//      resize it (AdvancedImageCropper), then push it straight to
//      Cloudinary. The result is added to the selection.
//
//  Callers receive `MediaLibraryItem[]` back via onSelect — the
//  secure_url is what they persist.
//
//  Props are intentionally rich so each page can tune behaviour:
//  crop presets, output sizes, folder filter, multi-select, delete
//  toggle, asset type / accept list.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Tab, Tabs, TextField, InputAdornment, Chip, Stack,
  Typography, IconButton, CircularProgress, Alert, Tooltip,
  Checkbox, Grid, alpha, useTheme, InputLabel, MenuItem, FormControl, Select,
} from "@mui/material";
import {
  PhotoLibrary, CloudUpload, Search, Delete, Close, CheckCircle,
  Folder, Link as LinkIcon, GridView, CheckCircleOutline,
} from "@mui/icons-material";
import { useSnackbar } from "notistack";

import { mediaService, MediaLibraryItem } from "../../services/media.service";
import { uploadMedia, MediaUploadResult } from "../../services/settings.service";
import { apiErrorMessage } from "../../utils/apiError";
import AdvancedImageCropper, {
  AspectPreset, DEFAULT_ASPECT_PRESETS, DEFAULT_OUTPUT_SIZES,
} from "./ImageCropper";

// ── Public types ──────────────────────────────────────────────

export type MediaPickerKind =
  | "image" | "logo" | "icon" | "payment_icon" | "video";

export type PickerAssetType =
  | "logo" | "favicon" | "og_image" | "general" | "document" | "photo";

export interface MediaPickerCropSpec {
  /** Aspect presets shown in the crop step (null ratio = free crop). */
  presets?: AspectPreset[];
  /** Longest-side output sizes in px; 0 = source resolution. */
  outputSizes?: number[];
  /** Fixed output dims — when set, overrides the size picker. */
  outputWidth?: number;
  outputHeight?: number;
}

export interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  /** Called with the selected gallery items (after the user confirms). */
  onSelect: (items: MediaLibraryItem[]) => void;
  /**
   * Called immediately after a new file is uploaded from the Upload tab.
   * Callers that stream results live (e.g. hotel multi-upload) can rely on
   * this instead of waiting for the modal confirm.
   */
  onUploaded?: (result: MediaUploadResult, file: File) => void | Promise<void>;

  /** Default Cloudinary folder filter. Leave empty for the whole library. */
  folder?: string;
  kind?: MediaPickerKind;
  assetType?: PickerAssetType;
  /** Cloudinary folder used for NEW uploads (folderOverride). */
  uploadFolder?: string;
  multiple?: boolean;
  /** Allow deleting assets straight from the gallery. Default false. */
  allowDelete?: boolean;
  /** Crop/resize spec applied to new uploads before they hit Cloudinary. */
  crop?: MediaPickerCropSpec;
  /** Accepted mime types for the Upload tab. */
  accept?: string;
  title?: string;
}

const ASSET_TYPE_FOR: Record<MediaPickerKind, PickerAssetType> = {
  image: "general",
  video: "general",
  logo: "logo",
  icon: "general",
  payment_icon: "general",
};

const ACCEPT_FOR: Record<MediaPickerKind, string> = {
  image: "image/png,image/jpeg,image/webp,image/svg+xml",
  video: "video/mp4,video/webm,video/quicktime",
  logo: "image/png,image/jpeg,image/webp,image/svg+xml",
  icon: "image/png,image/jpeg,image/webp,image/svg+xml",
  payment_icon: "image/png,image/jpeg,image/webp,image/svg+xml",
};

/** Folders commonly used across the portal — gallery filter chips. */
export const KNOWN_FOLDERS = [
  "waytero/platform",
  "waytero/cms",
  "waytero/blog",
  "waytero/hotels",
  "waytero/tours",
  "waytero/vehicles",
  "waytero/partners",
  "waytero/drivers",
  "waytero/users",
];

function shortLabel(folder: string): string {
  const parts = folder.split("/");
  return parts[parts.length - 1] || folder;
}

const RASTER_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const isRaster = (f: File) => RASTER_MIME.has(f.type);

function sizeLabel(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function MediaPicker({
  open,
  onClose,
  onSelect,
  onUploaded,
  folder = "",
  kind = "image",
  assetType,
  uploadFolder,
  multiple = false,
  allowDelete = false,
  crop,
  accept,
  title = "Choose media",
}: MediaPickerProps) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const activeAssetType = assetType ?? ASSET_TYPE_FOR[kind];
  const activeAccept = accept ?? ACCEPT_FOR[kind];

  const [tab, setTab] = useState(0);

  // ── Gallery state ───────────────────────────────────────────
  const [filterFolder, setFilterFolder] = useState(folder);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<MediaLibraryItem[]>([]);
  const [nextCursor, setNextCursor] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MediaLibraryItem[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  // ── Upload state ────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [justUploaded, setJustUploaded] = useState<MediaLibraryItem | null>(null);

  const load = useCallback(async (cursor = "") => {
    setLoading(cursor === "");
    setLoadingMore(cursor !== "");
    setError(null);
    try {
      const res = await mediaService.listMedia({
        folder: filterFolder || undefined,
        query: search || undefined,
        nextCursor: cursor || undefined,
        pageSize: 30,
      });
      setItems((prev) => (cursor ? [...prev, ...res.items] : res.items));
      setNextCursor(res.next_cursor || "");
      loadedOnce.current = true;
    } catch (e: any) {
      setError(apiErrorMessage(e, "Could not load media library"));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filterFolder, search]);

  // Reset when opened.
  useEffect(() => {
    if (open) {
      setSelected([]);
      setTab(0);
      setJustUploaded(null);
      setPendingFile(null);
      setPendingUrl(null);
      setItems([]);
      setNextCursor("");
      loadedOnce.current = false;
    }
  }, [open]);

  // Load gallery on tab switch to 0.
  useEffect(() => {
    if (open && tab === 0 && !loadedOnce.current) {
      load();
    }
  }, [open, tab, load]);

  const toggleSelect = (item: MediaLibraryItem) => {
    setSelected((prev) => {
      const exists = prev.some((i) => i.public_id === item.public_id);
      if (exists) return prev.filter((i) => i.public_id !== item.public_id);
      return multiple ? [...prev, item] : [item];
    });
  };

  const handleDelete = async (item: MediaLibraryItem) => {
    setDeleting(item.public_id);
    try {
      await mediaService.deleteMedia(item.public_id);
      setItems((prev) => prev.filter((i) => i.public_id !== item.public_id));
      setSelected((prev) => prev.filter((i) => i.public_id !== item.public_id));
      enqueueSnackbar("Image deleted", { variant: "success" });
    } catch (e: any) {
      enqueueSnackbar(apiErrorMessage(e, "Delete failed"), { variant: "error" });
    } finally {
      setDeleting(null);
    }
  };

  // ── Upload flow ─────────────────────────────────────────────
  const uploadBlob = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const result = await uploadMedia(file, activeAssetType, {
        folderOverride: uploadFolder || filterFolder || "waytero/platform",
        onProgress: setUploadProgress,
      });
      const item: MediaLibraryItem = {
        public_id: result.public_id,
        secure_url: result.secure_url,
        width: result.width ?? null,
        height: result.height ?? null,
        format: result.format,
        folder: result.public_id.includes("/") ? result.public_id.split("/").slice(0, -1).join("/") : "",
        bytes: file.size,
        created_at: null,
      };
      setJustUploaded(item);
      if (multiple) {
        setSelected((prev) => [...prev, item]);
      } else {
        setSelected([item]);
      }
      if (onUploaded) {
        await onUploaded(result, file);
      }
      enqueueSnackbar("Media uploaded to Cloudinary", { variant: "success" });
    } catch (e: any) {
      enqueueSnackbar(apiErrorMessage(e, "Upload failed"), { variant: "error" });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const onFilesPicked = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    // Raster + crop spec → open the cropper first.
    if (crop && isRaster(f)) {
      const url = URL.createObjectURL(f);
      setPendingFile(f);
      setPendingUrl(url);
      return;
    }
    void uploadBlob(f);
  };

  const onCropConfirm = async (blob: Blob, fileName: string) => {
    const src = pendingUrl;
    setPendingFile(null);
    setPendingUrl(null);
    if (src) URL.revokeObjectURL(src);
    const file = new File([blob], fileName, { type: blob.type || "image/png" });
    await uploadBlob(file);
  };

  const onCropClose = () => {
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    setPendingFile(null);
    setPendingUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const cropSpec = useMemo(() => {
    if (!crop) return null;
    return {
      presets: crop.presets ?? DEFAULT_ASPECT_PRESETS,
      outputSizeOptions: crop.outputSizes ?? DEFAULT_OUTPUT_SIZES,
      outputWidth: crop.outputWidth,
      outputHeight: crop.outputHeight,
      aspectRatio: crop.outputWidth && crop.outputHeight ? crop.outputWidth / crop.outputHeight : undefined,
    };
  }, [crop]);

  const confirmSelection = () => {
    if (selected.length === 0) {
      enqueueSnackbar("Select at least one image", { variant: "warning" });
      return;
    }
    onSelect(selected);
    onClose();
  };

  const thumbUrl = (item: MediaLibraryItem) => item.secure_url;

  return (
    <>
      <Dialog open={open} onClose={uploading ? undefined : onClose} maxWidth="lg" fullWidth
        PaperProps={{ sx: { borderRadius: 3, height: "82vh" } }}>
        <DialogTitle sx={{ px: 3, py: 2, pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.12), display: "grid", placeItems: "center" }}>
              <PhotoLibrary sx={{ color: "primary.main", fontSize: 20 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={700}>{title}</Typography>
              <Typography variant="caption" color="text.secondary">
                Pick an existing image or upload a new one
              </Typography>
            </Box>
            <IconButton onClick={onClose} disabled={uploading} aria-label="Close">
              <Close />
            </IconButton>
          </Stack>

          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mt: 1.5, minHeight: 40 }}>
            <Tab icon={<GridView fontSize="small" />} iconPosition="start" label="Gallery" sx={{ minHeight: 40, fontSize: 13 }} />
            <Tab icon={<CloudUpload fontSize="small" />} iconPosition="start" label="Upload new" sx={{ minHeight: 40, fontSize: 13 }} />
          </Tabs>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0 }}>
          {/* ── Gallery tab ─────────────────────────────────── */}
          {tab === 0 && (
            <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
              {/* Toolbar */}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ p: 2, pb: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
                <TextField
                  size="small"
                  placeholder="Search by filename…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") load(); }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
                  sx={{ minWidth: 240 }}
                />
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Folder</InputLabel>
                  <Select
                    value={filterFolder}
                    label="Folder"
                    onChange={(e) => setFilterFolder(e.target.value)}
                  >
                    <MenuItem value="">
                      <em>All folders</em>
                    </MenuItem>
                    {KNOWN_FOLDERS.map((f) => (
                      <MenuItem key={f} value={f}>{shortLabel(f)}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Box sx={{ flex: 1 }} />
                <Button size="small" variant="outlined" onClick={() => load()} disabled={loading}>
                  {loading ? <CircularProgress size={14} /> : "Refresh"}
                </Button>
              </Stack>

              {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}

              {!error && (loading || items.length > 0) && (
                <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
                  <Grid container spacing={1.5}>
                    {items.map((item) => {
                      const isSel = selected.some((i) => i.public_id === item.public_id);
                      return (
                        <Grid item xs={6} sm={4} md={3} key={item.public_id}>
                          <Box
                            onClick={() => toggleSelect(item)}
                            sx={{
                              position: "relative",
                              aspectRatio: "4/3",
                              borderRadius: 2,
                              overflow: "hidden",
                              border: "1px solid",
                              borderColor: isSel ? "primary.main" : "divider",
                              boxShadow: isSel ? `0 0 0 2px ${theme.palette.primary.main}` : "none",
                              cursor: "pointer",
                              bgcolor: "action.hover",
                              "&:hover .actions": { opacity: 1 },
                            }}
                          >
                            <Box
                              component="img"
                              src={thumbUrl(item)}
                              alt={item.public_id}
                              loading="lazy"
                              sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                              onError={(e: any) => { e.target.style.display = "none"; }}
                            />
                            <Stack direction="row" spacing={0.5} sx={{ position: "absolute", bottom: 0, left: 0, right: 0, px: 0.75, py: 0.5, background: "linear-gradient(transparent, rgba(0,0,0,0.55))" }}>
                              <Typography variant="caption" color="common.white" noWrap sx={{ flex: 1, fontSize: 10 }}>
                                {item.public_id.split("/").pop()}
                              </Typography>
                              <Typography variant="caption" color="rgba(255,255,255,0.7)" sx={{ fontSize: 10, flexShrink: 0 }}>
                                {item.width && item.height ? `${item.width}×${item.height}` : sizeLabel(item.bytes)}
                              </Typography>
                            </Stack>

                            {/* Selection badge */}
                            {isSel && (
                              <Box sx={{ position: "absolute", top: 6, left: 6 }}>
                                <CheckCircle sx={{ color: "primary.main", fontSize: 22, bgcolor: "background.paper", borderRadius: "50%" }} />
                              </Box>
                            )}
                            {!isSel && multiple && (
                              <Checkbox
                                size="small"
                                checked={false}
                                sx={{ position: "absolute", top: 2, left: 2, p: 0.5, "& .MuiSvgIcon-root": { color: "rgba(255,255,255,0.85)" } }}
                              />
                            )}

                            {/* Hover actions */}
                            <Box className="actions" sx={{ position: "absolute", top: 6, right: 6, opacity: 0, transition: "opacity 150ms", display: "flex", gap: 0.5 }}>
                              {allowDelete && (
                                <Tooltip title="Delete from Cloudinary">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                                    disabled={deleting === item.public_id}
                                    sx={{ bgcolor: "background.paper", "&:hover": { bgcolor: "error.main", color: "#fff" } }}
                                  >
                                    {deleting === item.public_id ? <CircularProgress size={14} /> : <Delete fontSize="small" />}
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>

                  {nextCursor && (
                    <Stack alignItems="center" sx={{ mt: 2 }}>
                      <Button variant="outlined" onClick={() => load(nextCursor)} disabled={loadingMore} startIcon={loadingMore ? <CircularProgress size={14} /> : undefined}>
                        {loadingMore ? "Loading…" : "Load more"}
                      </Button>
                    </Stack>
                  )}
                </Box>
              )}

              {!error && !loading && items.length === 0 && loadedOnce.current && (
                <Box sx={{ flex: 1, display: "grid", placeItems: "center", color: "text.disabled", p: 4, textAlign: "center" }}>
                  <Stack spacing={1} alignItems="center">
                    <Folder sx={{ fontSize: 44 }} />
                    <Typography>No images found</Typography>
                    <Typography variant="caption">Switch to the Upload tab to add one, or clear the folder filter.</Typography>
                  </Stack>
                </Box>
              )}

              {!error && loading && (
                <Box sx={{ flex: 1, display: "grid", placeItems: "center" }}>
                  <CircularProgress />
                </Box>
              )}
            </Box>
          )}

          {/* ── Upload tab ───────────────────────────────────── */}
          {tab === 1 && (
            <Box sx={{ height: "100%", overflow: "auto", p: 3 }}>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept={activeAccept}
                onChange={(e) => { onFilesPicked(e.target.files); e.target.value = ""; }}
              />

              {uploading ? (
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, py: 6 }}>
                  <CircularProgress variant="determinate" value={uploadProgress} size={56} />
                  <Typography fontWeight={600}>Uploading to Cloudinary… {uploadProgress}%</Typography>
                </Box>
              ) : (
                <>
                  <Box
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); onFilesPicked(e.dataTransfer.files); }}
                    sx={{
                      border: `2px dashed ${dragOver ? theme.palette.primary.main : alpha(theme.palette.divider, 0.7)}`,
                      borderRadius: 3,
                      py: 6,
                      px: 3,
                      textAlign: "center",
                      cursor: "pointer",
                      bgcolor: dragOver ? alpha(theme.palette.primary.main, 0.04) : "transparent",
                      transition: "border-color 150ms, background-color 150ms",
                    }}
                  >
                    <CloudUpload sx={{ fontSize: 52, color: dragOver ? "primary.main" : "text.disabled", mb: 1 }} />
                    <Typography fontWeight={700}>Click to browse or drag & drop</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {activeAccept.split(",").map((m) => m.split("/").pop()).join(" / ").toUpperCase()} · max 20 MB
                    </Typography>
                  </Box>

                  {crop && (
                    <Alert severity="info" sx={{ mt: 2 }} icon={<CheckCircleOutline />}>
                      Images will open a crop/resize step before upload. You can choose the aspect ratio and output size.
                    </Alert>
                  )}

                  {justUploaded && (
                    <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1.5, p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "success.light", bgcolor: alpha(theme.palette.success.main, 0.06) }}>
                      <Box component="img" src={justUploaded.secure_url} alt="uploaded" sx={{ width: 64, height: 48, objectFit: "cover", borderRadius: 1 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600}>Uploaded successfully</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>{justUploaded.secure_url}</Typography>
                      </Box>
                      {multiple && (
                        <Chip
                          icon={<CheckCircleOutline />}
                          label={selected.some((i) => i.public_id === justUploaded.public_id) ? "Added to selection" : "Selected"}
                          color="success"
                          size="small"
                        />
                      )}
                    </Box>
                  )}

                  {selected.length > 0 && (
                    <Box sx={{ mt: 2.5 }}>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                        Selected ({selected.length})
                      </Typography>
                      <Grid container spacing={1.5}>
                        {selected.map((item) => (
                          <Grid item xs={6} sm={4} md={3} key={item.public_id}>
                            <Box sx={{ position: "relative", aspectRatio: "4/3", borderRadius: 2, overflow: "hidden", border: "1px solid", borderColor: "primary.main" }}>
                              <Box component="img" src={item.secure_url} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              <IconButton
                                size="small"
                                sx={{ position: "absolute", top: 4, right: 4, bgcolor: "background.paper", boxShadow: 1 }}
                                onClick={() => setSelected((prev) => prev.filter((i) => i.public_id !== item.public_id))}
                              >
                                <Close fontSize="small" />
                              </IconButton>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  )}
                </>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 1.5, justifyContent: "space-between" }}>
          <Box>
            {tab === 0 && !multiple && selected[0] && (
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "flex", alignItems: "center", gap: 0.5, maxWidth: 340 }}>
                <LinkIcon fontSize="small" />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selected[0].secure_url}
                </span>
              </Typography>
            )}
            {tab === 0 && multiple && (
              <Chip size="small" label={`${selected.length} selected`} color="primary" variant="outlined" />
            )}
          </Box>
          <Stack direction="row" spacing={1}>
            <Button onClick={onClose} disabled={uploading}>Cancel</Button>
            <Button
              variant="contained"
              onClick={confirmSelection}
              disabled={selected.length === 0 || uploading}
              startIcon={selected.length > 0 ? <CheckCircleOutline /> : undefined}
            >
              {multiple ? `Use ${selected.length} selected` : "Use this image"}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      {/* Crop/resize step */}
      {pendingUrl && cropSpec && (
        <AdvancedImageCropper
          src={pendingUrl}
          open
          onClose={onCropClose}
          onConfirm={onCropConfirm}
          title="Crop & resize image"
          presets={cropSpec.presets}
          outputSizeOptions={cropSpec.outputSizeOptions}
          outputWidth={cropSpec.outputWidth}
          outputHeight={cropSpec.outputHeight}
          aspectRatio={cropSpec.aspectRatio}
        />
      )}
    </>
  );
}