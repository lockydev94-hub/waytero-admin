// ============================================================
// WAYTERO ADMIN — MEDIA UPLOADER (MediaPicker-powered)
// Doc Ref: Migration 0044_website_cms
//
//  Reusable single-file media picker for CMS section / header / footer
//  editors (and blog). Routes through the shared /admin/settings/upload-media
//  endpoint with folder = waytero/cms/{section_key}/ so all assets live
//  under the CMS namespace in Cloudinary.
//
//  Clicking the drop zone opens the shared MediaPicker modal instead of a
//  raw file input — the admin can either:
//    1. Pick an image already in Cloudinary (gallery tab), or
//    2. Upload a new file, with an optional crop/resize step.
//
//  SVG / video kinds skip the crop step and upload the file directly.
// ============================================================

import { useMemo, useState } from "react";
import {
  Box, Button, IconButton, LinearProgress, Stack, Typography, alpha, useTheme,
} from "@mui/material";
import { CloudUpload, Close } from "@mui/icons-material";
import { useSnackbar } from "notistack";

import MediaPicker from "../../../components/media/MediaPicker";
import type { MediaLibraryItem } from "../../../services/media.service";
import { uploadMedia } from "../../../services/settings.service";
import { apiErrorMessage } from "../../../utils/apiError";
import { OutputFormat } from "./ImageCropper";

export type CmsMediaKind = "image" | "video" | "logo" | "icon" | "payment_icon";

/**
 * Optional crop spec. When set on a raster image (jpg/png/webp), the
 * picker pops a crop modal before uploading so the asset matches the
 * container dimensions exactly.
 */
export interface CropSpec {
  /** Aspect ratio of the crop window (width / height). */
  aspectRatio: number;
  /** Output dimensions in pixels. */
  outputWidth: number;
  outputHeight: number;
  /** Output format / quality. Defaults to JPEG / 0.92. */
  format?: OutputFormat;
  quality?: number;
}

/**
 * Geometry a slot enforces when `strict` is on. Normally you do not hand-write
 * this — it comes from the backend `slot_specs`, which is also what the crop
 * modal and the website layout are built against, so all three agree by
 * construction.
 */
export interface SlotGeometry {
  minWidth: number;
  minHeight: number;
  /** Target aspect ratio (width / height). */
  aspect: number;
  /** Exact output the crop step produces; used for the hint text. */
  width?: number;
  height?: number;
}

/**
 * Aspect is compared with relative tolerance, not equality: Cloudinary reports
 * 1920×800 for the slot and 1919×800 for a re-encode, and rejecting the second
 * one teaches admins to stop trusting the uploader.
 */
const ASPECT_TOLERANCE = 0.06;

/**
 * Natural pixel size of a raster file. `null` means the browser could not
 * decode it — which is treated as "cannot verify", not "invalid", so an exotic
 * format never locks the admin out of a slot it may well fit.
 */
async function readImageSize(
  file: File
): Promise<{ width: number | null; height: number | null } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

export function geometryProblem(
  item: Pick<MediaLibraryItem, "width" | "height">,
  slot: SlotGeometry,
  label: string
): string | null {
  const { width, height } = item;
  if (!width || !height) {
    return `${label}: Cloudinary has no stored dimensions for this asset. Upload the file again so it goes through the crop step.`;
  }
  const problems: string[] = [];
  if (width < slot.minWidth || height < slot.minHeight) {
    problems.push(
      `it is ${width}×${height} and this slot needs at least ${slot.minWidth}×${slot.minHeight}`
    );
  }
  const ratio = width / height;
  if (Math.abs(ratio - slot.aspect) / slot.aspect > ASPECT_TOLERANCE) {
    problems.push(`its ratio is ${ratio.toFixed(2)}:1, this slot is ${slot.aspect}:1`);
  }
  if (!problems.length) return null;
  return `${label}: ${problems.join("; ")}. Crop it to size, or pick a larger file.`;
}

/**
 * The crop the upload modal should force for a slot, so an upload lands at the
 * exact geometry the website's container is built for.
 */
export function cropForSlot(geometry: SlotGeometry): CropSpec {
  return {
    aspectRatio: geometry.aspect,
    outputWidth: geometry.width ?? geometry.minWidth,
    outputHeight: geometry.height ?? geometry.minHeight,
  };
}

interface Props {
  /** Current URL — used to render preview and to support clear. */
  value: string | null;
  /** Called with the new Cloudinary secure_url after a successful upload. */
  onChange: (url: string | null) => void;
  /** Cloudinary folder (e.g. waytero/cms/hero or waytero/cms/header). */
  folder: string;
  /** What kind of asset — drives accept & asset_type. */
  kind?: CmsMediaKind;
  /** Optional label / hint override. */
  label?: string;
  hint?: string;
  /** Height of the preview area, in px. */
  previewHeight?: number;
  disabled?: boolean;
  /**
   * Optional crop spec. When set on a raster image, a crop modal opens
   * after the file is picked. SVG / video / logo (when SVG) skip the crop.
   */
  crop?: CropSpec;
  /**
   * Reject gallery picks that cannot fill the slot instead of accepting them
   * silently. A cropped upload always satisfies it — the check only bites on
   * an existing library asset chosen as-is, which is exactly how a stretched
   * or letterboxed hero reaches production. Default false so blog/CMS/hotel
   * behaviour is untouched.
   */
  strict?: boolean;
  /** Geometry `strict` enforces. Falls back to `crop` output size. */
  slot?: SlotGeometry;
}

const ASSET_TYPE_FOR: Record<CmsMediaKind, "logo" | "general"> = {
  image: "general",
  video: "general",
  logo: "logo",
  icon: "general",
  payment_icon: "general",
};

const ACCEPT_FOR: Record<CmsMediaKind, string> = {
  image: "image/png,image/jpeg,image/webp,image/svg+xml",
  video: "video/mp4,video/webm,video/quicktime",
  logo: "image/png,image/jpeg,image/webp,image/svg+xml",
  icon: "image/png,image/jpeg,image/webp,image/svg+xml",
  payment_icon: "image/png,image/jpeg,image/webp,image/svg+xml",
};

export default function MediaUploader({
  value,
  onChange,
  folder,
  kind = "image",
  label = "Upload media",
  hint,
  previewHeight = 140,
  disabled,
  crop,
  strict,
  slot,
}: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  const isVideo = kind === "video";

  // A slot without an explicit geometry still has one: whatever the crop step
  // is configured to output. Keeping that here means a caller sets `strict`
  // and gets the same number in the modal and in the rejection message.
  const geometry = useMemo<SlotGeometry | undefined>(() => {
    if (slot) return slot;
    if (!crop) return undefined;
    return {
      minWidth: crop.outputWidth,
      minHeight: crop.outputHeight,
      aspect: crop.aspectRatio,
      width: crop.outputWidth,
      height: crop.outputHeight,
    };
  }, [slot, crop]);

  const upload = async (file: File) => {
    // A dropped file skips the crop modal, so it is measured here instead —
    // otherwise the drop zone would be a way to bypass the slot rules.
    if (strict && geometry && !isVideo && file.type !== "image/svg+xml") {
      const size = await readImageSize(file);
      const problem = size ? geometryProblem(size, geometry, label) : null;
      if (problem) {
        enqueueSnackbar(problem, { variant: "error" });
        return;
      }
    }
    setBusy(true);
    setProgress(0);
    try {
      const r = await uploadMedia(file, ASSET_TYPE_FOR[kind], {
        folderOverride: folder,
        onProgress: setProgress,
      });
      onChange(r.secure_url);
      enqueueSnackbar("Media uploaded", { variant: "success" });
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e, "Upload failed"), { variant: "error" });
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const onPickerSelect = (items: MediaLibraryItem[]) => {
    const first = items[0];
    if (!first) return;
    if (strict && geometry && first.format !== "svg") {
      const problem = geometryProblem(first, geometry, label);
      if (problem) {
        enqueueSnackbar(problem, { variant: "error" });
        return;
      }
    }
    onChange(first.secure_url);
  };

  // Translate the legacy fixed CropSpec into the MediaPicker crop spec.
  const pickerCrop = useMemo(() => {
    if (!crop) return undefined;
    return {
      presets: [{ label: "Fixed", ratio: crop.aspectRatio }],
      outputWidth: crop.outputWidth,
      outputHeight: crop.outputHeight,
    };
  }, [crop]);

  const openPicker = () => {
    if (disabled || busy) return;
    setPickerOpen(true);
  };

  return (
    <Box>
      {value ? (
        <Box
          sx={{
            position: "relative",
            height: previewHeight,
            borderRadius: 2,
            overflow: "hidden",
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: alpha(theme.palette.primary.main, 0.04),
          }}
        >
          {isVideo ? (
            <video
              src={value}
              controls
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Box
              component="img"
              src={value}
              alt=""
              sx={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                bgcolor: "#fff",
              }}
            />
          )}
          <IconButton
            size="small"
            onClick={() => onChange(null)}
            disabled={disabled}
            sx={{
              position: "absolute",
              top: 6,
              right: 6,
              bgcolor: "background.paper",
              boxShadow: 1,
              "&:hover": { bgcolor: "background.paper" },
            }}
            aria-label="Remove media"
          >
            <Close fontSize="small" />
          </IconButton>
          <Button
            size="small"
            variant="outlined"
            onClick={openPicker}
            disabled={disabled || busy}
            sx={{ position: "absolute", bottom: 6, left: 6, bgcolor: "background.paper", boxShadow: 1 }}
          >
            Replace
          </Button>
        </Box>
      ) : (
        <Box
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={label}
          onClick={openPicker}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !busy && !disabled) openPicker();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!busy && !disabled) {
              const f = e.dataTransfer.files?.[0];
              if (f) void upload(f);
            }
          }}
          sx={{
            height: previewHeight,
            border: `2px dashed ${
              dragOver ? theme.palette.primary.main : alpha(theme.palette.divider, 0.6)
            }`,
            borderRadius: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: disabled || busy ? "default" : "pointer",
            bgcolor: dragOver ? alpha(theme.palette.primary.main, 0.04) : "transparent",
            transition: "border-color 120ms, background-color 120ms",
          }}
        >
          <Stack spacing={0.5} alignItems="center">
            <CloudUpload sx={{ fontSize: 32, color: "text.disabled" }} />
            <Typography variant="body2" fontWeight={600}>
              {label}
            </Typography>
            {hint && (
              <Typography variant="caption" color="text.secondary">
                {hint}
              </Typography>
            )}
            {crop && kind !== "video" && (
              <Typography variant="caption" color="primary.main">
                Will be cropped to {crop.outputWidth}×{crop.outputHeight} before upload
              </Typography>
            )}
            {strict && geometry && !crop && kind !== "video" && (
              <Typography variant="caption" color="primary.main">
                Needs at least {geometry.minWidth}×{geometry.minHeight} at {geometry.aspect}:1
              </Typography>
            )}
          </Stack>
        </Box>
      )}

      {busy && (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ mt: 1, height: 4, borderRadius: 2 }}
        />
      )}

      {pickerOpen && (
        <MediaPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={onPickerSelect}
          folder={folder}
          kind={kind}
          assetType={ASSET_TYPE_FOR[kind]}
          uploadFolder={folder}
          accept={ACCEPT_FOR[kind]}
          crop={pickerCrop}
        />
      )}
    </Box>
  );
}