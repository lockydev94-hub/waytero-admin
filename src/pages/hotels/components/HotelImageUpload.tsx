// ============================================================
// WAYTERO ADMIN — HOTEL IMAGE UPLOAD
// Doc Ref: 03_FRONTEND_DESIGN.md §5 (Media), §7
//
// Multi-file image upload for hotels. Hotels are photographed in
// batches, so this opens the shared MediaPicker modal in multi-select
// mode — the admin can pick from the Cloudinary gallery and/or upload
// new images (with an optional crop step) in one pass. Each confirmed
// image is streamed to the caller via onUploaded.
// ============================================================
import { useState } from "react";
import { Box, LinearProgress, Stack, Typography, alpha, useTheme } from "@mui/material";
import { CloudUpload } from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { uploadMedia } from "../../../services/settings.service";
import { apiErrorMessage } from "../../../utils/apiError";
import MediaPicker from "../../../components/media/MediaPicker";

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [progress, setProgress] = useState(0);

  const uploadFile = async (file: File) => {
    try {
      const result = await uploadMedia(file, assetType, {
        folderOverride: folder,
        onProgress: setProgress,
      });
      await onUploaded(result.secure_url, file);
      return true;
    } catch (err: any) {
      enqueueSnackbar(
        apiErrorMessage(err, `${file.name} failed to upload`),
        { variant: "error" }
      );
      return false;
    }
  };

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    setTotal(files.length);
    setDone(0);
    let ok = 0;
    for (let i = 0; i < files.length; i += 1) {
      setProgress(0);
      if (await uploadFile(files[i])) ok += 1;
      setDone(i + 1);
    }
    if (ok > 0) {
      enqueueSnackbar(`${ok} file${ok > 1 ? "s" : ""} uploaded successfully`, { variant: "success" });
    }
    setBusy(false);
    setTotal(0);
    setDone(0);
    setProgress(0);
  };

  const onPickerSelect = (items: { secure_url: string }[]) => {
    // Gallery picks are already in Cloudinary — emit the URL directly.
    items.forEach((item) => {
      void onUploaded(item.secure_url, new File([], "gallery.jpg", { type: "image/jpeg" }));
    });
  };

  const onPickerUploaded = async (result: { secure_url: string }, file: File) => {
    await onUploaded(result.secure_url, file);
  };

  const openPicker = () => {
    if (disabled || busy) return;
    setPickerOpen(true);
  };

  return (
    <Box>
      <Box
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        onClick={openPicker}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled && !busy) openPicker();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled && !busy) handleFiles(Array.from(e.dataTransfer.files ?? []));
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

      {pickerOpen && (
        <MediaPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={onPickerSelect}
          onUploaded={onPickerUploaded}
          folder={folder}
          uploadFolder={folder}
          assetType={assetType}
          accept={accept}
          multiple
          crop={{
            presets: [{ label: "Free", ratio: null }],
            outputSizes: [0, 1024, 1600, 2048],
          }}
          title="Add hotel images"
        />
      )}
    </Box>
  );
}