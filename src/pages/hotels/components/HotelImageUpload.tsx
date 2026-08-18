// ============================================================
// WAYTERO ADMIN — HOTEL IMAGE UPLOAD
// Doc Ref: 03_FRONTEND_DESIGN.md §5 (Media), §7
//
// Adapted from VehiclesPage CloudinaryFileUpload. Multi-file: hotels are
// photographed in batches, and uploading one at a time is friction for nothing.
// Uses the shared /admin/settings/upload-media transport — no second endpoint.
// ============================================================
import { useRef, useState } from "react";
import { Box, LinearProgress, Stack, Typography, alpha, useTheme } from "@mui/material";
import { CloudUpload } from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { uploadMedia } from "../../../services/settings.service";
import { apiErrorMessage } from "../../../utils/apiError";

interface Props {
  /** Cloudinary folder — see HOTEL_UPLOAD_FOLDERS. */
  folder: string;
  assetType?: "photo" | "document" | "general";
  accept?: string;
  label?: string;
  hint?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Called once per successfully uploaded file. */
  onUploaded: (secureUrl: string, file: File) => void | Promise<void>;
}

export default function HotelImageUpload({
  folder,
  assetType = "photo",
  accept = "image/png,image/jpeg,image/webp",
  label = "Upload images",
  hint = "PNG, JPG or WEBP — drag and drop, or click to browse",
  multiple = true,
  disabled = false,
  onUploaded,
}: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [progress, setProgress] = useState(0);

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    setTotal(files.length);
    setDone(0);
    let ok = 0;
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      setProgress(0);
      try {
        const result = await uploadMedia(file, assetType, {
          folderOverride: folder,
          onProgress: setProgress,
        });
        await onUploaded(result.secure_url, file);
        ok += 1;
      } catch (err: any) {
        // Report per file and keep going — one bad file should not discard
        // the rest of a batch the admin already selected.
        enqueueSnackbar(
          apiErrorMessage(err, `${file.name} failed to upload`),
          { variant: "error" }
        );
      }
      setDone(i + 1);
    }
    if (ok > 0) {
      enqueueSnackbar(`${ok} file${ok > 1 ? "s" : ""} uploaded successfully`, { variant: "success" });
    }
    setBusy(false);
    setTotal(0);
    setDone(0);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  const pick = (list: FileList | null) => handleFiles(Array.from(list ?? []));

  return (
    <Box>
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: "none" }}
        onChange={(e) => pick(e.target.files)}
      />

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
          if (!disabled && !busy) pick(e.dataTransfer.files);
        }}
        sx={{
          border: `2px dashed ${
            dragOver ? theme.palette.primary.main : alpha(theme.palette.divider, 0.6)
          }`,
          borderRadius: 2,
          p: 3,
          textAlign: "center",
          cursor: disabled || busy ? "default" : "pointer",
          opacity: disabled ? 0.6 : 1,
          bgcolor: dragOver ? alpha(theme.palette.primary.main, 0.04) : "transparent",
          transition: "border-color 120ms, background-color 120ms",
        }}
      >
        <Stack spacing={1} alignItems="center">
          <CloudUpload sx={{ fontSize: 36, color: dragOver ? "primary.main" : "text.disabled" }} />
          <Typography variant="body2" fontWeight={700}>
            {busy ? `Uploading ${done + 1} of ${total}…` : label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        </Stack>

        {busy && (
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ mt: 2, height: 6, borderRadius: 3 }}
          />
        )}
      </Box>
    </Box>
  );
}
