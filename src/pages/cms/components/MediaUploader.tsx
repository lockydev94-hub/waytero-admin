// ============================================================
// WAYTERO ADMIN — CMS MEDIA UPLOADER
// Doc Ref: Migration 0044_website_cms
//
//  Reusable single-file media picker for CMS section / header / footer
//  editors. Routes through the shared /admin/settings/upload-media
//  endpoint with folder = waytero/cms/{section_key}/ so all assets live
//  under the CMS namespace in Cloudinary.
//
//  Two-step flow when cropAspectRatio is set on raster images:
//    1. Admin picks a file (click or drag-drop).
//    2. ImageCropper modal opens with the file. Admin zooms / pans
//       inside the required aspect ratio and exports the cropped
//       blob at outputWidth × outputHeight.
//    3. The cropped blob is uploaded to Cloudinary, and the resulting
//       secure_url is emitted via onChange.
//
//  SVG / video / no-crop kinds skip step 2 and upload the file directly.
// ============================================================

import { useMemo, useRef, useState } from "react";
import {
  Box, IconButton, LinearProgress, Stack, Typography, alpha, useTheme,
} from "@mui/material";
import { CloudUpload, Close } from "@mui/icons-material";
import { useSnackbar } from "notistack";

import { uploadMedia } from "../../../services/settings.service";
import { apiErrorMessage } from "../../../utils/apiError";
import ImageCropper, { OutputFormat } from "./ImageCropper";

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

/** Raster mime types that the canvas-based cropper understands. */
const CROPPABLE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

const isCroppable = (file: File): boolean => CROPPABLE_MIME.has(file.type);

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
}: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  // Crop flow state — pending holds the picked file waiting to be
  // cropped; once the cropper confirms, the resulting blob is uploaded.
  const [pending, setPending] = useState<{ url: string; file: File } | null>(null);

  const isVideo = kind === "video";

  const upload = async (file: File | Blob, originalName: string) => {
    setBusy(true);
    setProgress(0);
    try {
      // uploadMedia expects a File; Blob works but its name is empty.
      // Use the original name (with new extension if the cropper changed it).
      const asFile =
        file instanceof File
          ? file
          : new File([file], originalName, {
              type: file.type || "application/octet-stream",
            });
      const r = await uploadMedia(asFile, ASSET_TYPE_FOR[kind], {
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
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onCropConfirm = async (blob: Blob, fileName: string) => {
    if (!pending) return;
    const srcUrl = pending.url;
    setPending(null);
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    await upload(blob, fileName);
  };

  const onCropClose = () => {
    if (pending) URL.revokeObjectURL(pending.url);
    setPending(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const pick = (file: File) => {
    // Raster + crop spec → open the cropper; upload happens after confirm.
    if (crop && isCroppable(file)) {
      const url = URL.createObjectURL(file);
      setPending({ url, file });
      return;
    }
    void upload(file, file.name);
  };

  const onFiles = (list: FileList | null) => {
    const f = list?.[0];
    if (f) pick(f);
  };

  // Memoize the crop spec so the modal doesn't reopen on every keystroke.
  const cropSpec = useMemo(() => crop, [crop]);

  return (
    <Box>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_FOR[kind]}
        style={{ display: "none" }}
        onChange={(e) => onFiles(e.target.files)}
      />

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
        </Box>
      ) : (
        <Box
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={label}
          onClick={() => !busy && !disabled && fileRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !busy && !disabled) fileRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!busy && !disabled) onFiles(e.dataTransfer.files);
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

      {pending && cropSpec && (
        <ImageCropper
          src={pending.url}
          aspectRatio={cropSpec.aspectRatio}
          outputWidth={cropSpec.outputWidth}
          outputHeight={cropSpec.outputHeight}
          format={cropSpec.format ?? "image/jpeg"}
          quality={cropSpec.quality ?? 0.92}
          open
          onClose={onCropClose}
          onConfirm={onCropConfirm}
          title={`Crop to ${cropSpec.outputWidth}×${cropSpec.outputHeight}`}
        />
      )}
    </Box>
  );
}
