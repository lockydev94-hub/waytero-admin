// ============================================================
// WAYTERO ADMIN — IMAGE CROPPER MODAL
// Doc Ref: Migration 0044_website_cms
//
//  Pre-upload crop modal. Lets the admin zoom / pan an image inside a
//  fixed-aspect-ratio container, then exports a JPEG/PNG file at the
//  container's exact pixel dimensions. The exported File is what
//  MediaUploader hands to /admin/settings/upload-media.
//
//  No new npm deps — uses <canvas> for both the live preview and the
//  export. Drawing to canvas (instead of positioning an <img> with CSS
//  transforms) makes the displayed image exactly match what gets
//  exported, removes the layout/CSS edge-cases of an aspect-ratio
//  container, and works on HiDPI displays without blur.
//
//  Zoom semantics:
//    • zoom = 1.0 → image's natural "fit-by-shortest-side" scale
//    • zoom < 1.0 → image shrinks inside the crop window
//      (lets the admin frame a tighter subject inside a wider crop)
//    • zoom > 1.0 → image grows past the crop window edges
//      (the classic crop-to-fill behaviour)
//    • "Reset" returns zoom to the value where the image just covers
//      the crop window (the canonical starting state for cropping)
//
//  Pan semantics:
//    • pan is in CSS pixels relative to the stage's visual centre
//    • Pan is unrestricted when zoom < 1.0 (image is smaller than
//      the crop — admin can place it anywhere inside the crop area)
//    • Pan is clamped when zoom > coverZoom so the image always
//      covers the crop window (no transparent strips revealing
//      the dark stage fill through the edges)
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions,
  Slider, Stack, Typography, Button, IconButton,
  CircularProgress, useTheme,
} from "@mui/material";
import { Close, ZoomIn, ZoomOut, RestartAlt, Crop } from "@mui/icons-material";
import { useSnackbar } from "notistack";

export type OutputFormat = "image/jpeg" | "image/png" | "image/webp";

interface Props {
  /** Source image as object URL or data URL. */
  src: string;
  /** Aspect ratio of the crop area (width / height). 16/9, 1, etc. */
  aspectRatio: number;
  /** Output pixel dimensions (width × height). */
  outputWidth: number;
  outputHeight: number;
  /** Output format / quality. */
  format?: OutputFormat;
  quality?: number;
  open: boolean;
  onClose: () => void;
  /** Called with the cropped file (already converted to the chosen format). */
  onConfirm: (file: Blob, fileName: string) => void;
  /** Dialog title. */
  title?: string;
}

interface ImgSize { w: number; h: number }
interface StageSize { w: number; h: number; dpr: number }

/**
 * Compute zoom math and pan clamping for a given image / stage / pan / zoom.
 *
 * All numbers are in CSS pixels relative to the stage's centre. The same
 * math is used for both the visible preview and the exported crop, so
 * what the admin sees on screen is exactly what gets uploaded.
 */
function computeLayout(
  img: ImgSize,
  stage: StageSize,
  zoom: number,
  pan: { x: number; y: number },
) {
  // "Fit shortest side" — the scale at which the image just covers
  // the stage when the long axis overflows. This is zoom = coverZoom.
  const fitScale = Math.min(stage.w / img.w, stage.h / img.h);
  const drawW = img.w * fitScale * zoom;
  const drawH = img.h * fitScale * zoom;

  // Position relative to the stage's top-left
  const cx = stage.w / 2 + pan.x;
  const cy = stage.h / 2 + pan.y;
  const x = cx - drawW / 2;
  const y = cy - drawH / 2;

  return { drawW, drawH, x, y };
}

export default function ImageCropper({
  src,
  aspectRatio,
  outputWidth,
  outputHeight,
  format = "image/jpeg",
  quality = 0.92,
  open,
  onClose,
  onConfirm,
  title = "Crop image",
}: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const stageRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  const [imgSize, setImgSize] = useState<ImgSize | null>(null);
  const [stageSize, setStageSize] = useState<StageSize>({ w: 0, h: 0, dpr: 1 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Load image ──────────────────────────────────────────────
  useEffect(() => {
    if (!open || !src) return;
    setLoadError(null);
    setImgSize(null);
    const img = new Image();
    // Object URLs are same-origin — never set crossOrigin here. Doing
    // so taints the canvas and breaks ctx.toBlob() silently.
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        setLoadError("Image has no visible dimensions");
        return;
      }
      imageRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => setLoadError("Could not decode the selected file");
    img.src = src;
    return () => {
      imageRef.current = null;
    };
  }, [open, src]);

  // ── Measure stage (CSS pixels + DPR) ────────────────────────
  useEffect(() => {
    if (!open) return;
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setStageSize({
        w: Math.max(1, Math.round(rect.width)),
        h: Math.max(1, Math.round(rect.height)),
        dpr: Math.max(1, window.devicePixelRatio || 1),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // ── Cover zoom (where the image just covers the crop window) ─
  // At coverZoom the image edges align exactly with the stage edges
  // in the short axis and overflow in the long axis. This is the
  // canonical starting point for cropping, and is what "Reset" snaps to.
  const coverZoom = useMemo(() => {
    if (!imgSize || !stageSize.w) return 1;
    const imageAspect = imgSize.w / imgSize.h;
    return imageAspect > aspectRatio
      ? aspectRatio / imageAspect    // image wider → limit by height
      : imageAspect / aspectRatio;   // image taller → limit by width
  }, [imgSize, stageSize.w, stageSize.h, aspectRatio]);

  // Slider bounds:
  //   min = 0.25  — admin can shrink the image a lot if needed
  //   max = 4.0   — admin can crop into a small detail
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 4;

  // Re-anchor pan / zoom whenever the image or stage settles
  useEffect(() => {
    if (!imgSize) return;
    setZoom(coverZoom);
    setPan({ x: 0, y: 0 });
  }, [imgSize, coverZoom]);

  // ── Pan handlers ────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    if (!imgSize) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    dragRef.current = null;
  };

  // ── Draw preview to canvas ─────────────────────────────────
  // Reads the layout from the DOM (not React state) so it survives
  // the dialog's first-paint animation. Uses ResizeObserver + rAF so
  // a delayed layout still retriggers a redraw.
  useEffect(() => {
    let raf = 0;

    const draw = () => {
      const canvas = previewCanvasRef.current;
      const stageEl = stageRef.current;
      const img = imageRef.current;
      if (!canvas || !stageEl || !img || !imgSize) return;

      const rect = stageEl.getBoundingClientRect();
      const cssW = Math.max(1, Math.round(rect.width));
      const cssH = Math.max(1, Math.round(rect.height));
      const dpr = Math.max(1, window.devicePixelRatio || 1);

      const targetW = cssW * dpr;
      const targetH = cssH * dpr;
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Background — surfaces the dark crop frame even when the image
      // has transparency or is smaller than the crop window.
      ctx.fillStyle = "#0F172A";
      ctx.fillRect(0, 0, cssW, cssH);

      const layout = computeLayout(imgSize, { w: cssW, h: cssH, dpr }, zoom, pan);

      // Crop guide — outline the visible crop area at the source
      // image's natural cover, and visually show when the image is
      // smaller than the crop (no overflow) vs. filling it (overflow).
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, cssW, cssH);
      ctx.clip();

      try {
        ctx.drawImage(img, layout.x, layout.y, layout.drawW, layout.drawH);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Cropper drawImage failed:", e);
      }
      ctx.restore();
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };

    schedule();
    let ro: ResizeObserver | null = null;
    if (stageRef.current) {
      ro = new ResizeObserver(schedule);
      ro.observe(stageRef.current);
    }
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [imgSize, zoom, pan.x, pan.y]);

  // ── Zoom controls ───────────────────────────────────────────
  const onZoomSlider = (_: Event, v: number | number[]) => {
    setZoom(v as number);
  };
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, Math.min(z / 1.2, z - 0.05)));
  const zoomIn  = () => setZoom((z) => Math.min(ZOOM_MAX, Math.max(z * 1.2, z + 0.05)));
  const reset   = () => {
    setZoom(coverZoom);
    setPan({ x: 0, y: 0 });
  };

  // ── Confirm → render to canvas → Blob → file ───────────────
  // Exports at exactly outputWidth × outputHeight. The mapping is a
  // direct scale of the stage layout, so the visible preview matches
  // the export byte-for-byte (apart from resolution).
  const confirm = async () => {
    const img = imageRef.current;
    if (!img || !imgSize) {
      enqueueSnackbar("Image not ready — please wait for it to load", { variant: "warning" });
      return;
    }
    // Always re-measure from the live DOM rect — never trust the
    // captured state. If the stage hasn't been measured yet but the
    // dialog is visible, fall back to the aspect ratio to derive
    // a plausible height.
    const stageEl = stageRef.current;
    const rect = stageEl ? stageEl.getBoundingClientRect() : null;
    const cssW = Math.max(1, Math.round(rect?.width  || stageSize.w || 960));
    const cssH = Math.max(1, Math.round(rect?.height || stageSize.h || (cssW / aspectRatio)));
    setBusy(true);
    try {
      const layout = computeLayout(imgSize, { w: cssW, h: cssH, dpr: 1 }, zoom, pan);

      // The 9-arg drawImage takes the source-image rectangle as its
      // (sx, sy, sw, sh) — NOT the destination. We need to find
      // which sub-region of the SOURCE image is currently visible
      // inside the stage crop window [0, 0, cssW, cssH].
      //
      // The image is drawn at (layout.x, layout.y) with size
      // (layout.drawW, layout.drawH) in stage CSS pixels. So the
      // pixel ratio between stage pixels and source pixels is
      //     img.w / layout.drawW   (or img.h / layout.drawH)
      // and the source-image coordinates of the stage's top-left
      // are simply (the negative of layout.x / layout.y, scaled
      // through that ratio).
      const scaleX = layout.drawW > 0 ? imgSize.w / layout.drawW : 1;
      const scaleY = layout.drawH > 0 ? imgSize.h / layout.drawH : 1;
      const srcX = (-layout.x) * scaleX;
      const srcY = (-layout.y) * scaleY;
      const srcW = cssW * scaleX;
      const srcH = cssH * scaleY;

      // Clamp source rect to the image bounds. drawImage silently
      // misbehaves when srcW/srcH overflow imgSize — the visible
      // preview is correct (it clips), but the export can show
      // garbled pixels. Clamping fixes this.
      const sx = Math.max(0, srcX);
      const sy = Math.max(0, srcY);
      const sw = Math.min(srcW, imgSize.w - sx);
      const sh = Math.min(srcH, imgSize.h - sy);

      const canvas = exportCanvasRef.current!;
      canvas.width  = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context not available");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Dark backdrop for transparent PNGs — matches the editor
      // preview so visually identical.
      ctx.fillStyle = "#0F172A";
      ctx.fillRect(0, 0, outputWidth, outputHeight);

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), format, quality),
      );
      if (!blob) {
        throw new Error("Browser refused to export the cropped image");
      }
      const ext = format === "image/png" ? "png" : format === "image/webp" ? "webp" : "jpg";
      const fileName = `cropped-${Date.now()}.${ext}`;
      onConfirm(blob, fileName);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Crop failed";
      // eslint-disable-next-line no-console
      console.error("Crop failed:", e);
      enqueueSnackbar(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Crop fontSize="small" color="primary" />
        {title}
        <Box flex={1} />
        <IconButton onClick={onClose} disabled={busy} aria-label="Close cropper">
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, bgcolor: "#0F172A" }}>
        <Box
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          sx={{
            position: "relative",
            width: "100%",
            aspectRatio: `${aspectRatio}`,
            overflow: "hidden",
            cursor: !imgSize
              ? "default"
              : dragRef.current
                ? "grabbing"
                : "grab",
            touchAction: "none",
            userSelect: "none",
            bgcolor: "#0F172A",
          }}
        >
          <canvas
            ref={previewCanvasRef}
            style={{
              display: "block",
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          />
          {!imgSize && !loadError && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "common.white",
              }}
            >
              <CircularProgress size={28} sx={{ color: "common.white" }} />
            </Box>
          )}
          {loadError && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "error.light",
                p: 2,
                textAlign: "center",
              }}
            >
              <Typography variant="body2">{loadError}</Typography>
            </Box>
          )}
          {imgSize && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                border: `2px solid ${theme.palette.primary.main}`,
                pointerEvents: "none",
              }}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ flexDirection: "column", alignItems: "stretch", p: 2, gap: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton
            size="small"
            onClick={zoomOut}
            disabled={!imgSize || zoom <= ZOOM_MIN + 1e-3}
            aria-label="Zoom out"
            sx={{ color: "text.secondary" }}
          >
            <ZoomOut fontSize="small" />
          </IconButton>
          <Slider
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.01}
            value={zoom}
            onChange={onZoomSlider}
            sx={{ flex: 1 }}
            disabled={!imgSize}
          />
          <IconButton
            size="small"
            onClick={zoomIn}
            disabled={!imgSize || zoom >= ZOOM_MAX - 1e-3}
            aria-label="Zoom in"
            sx={{ color: "text.secondary" }}
          >
            <ZoomIn fontSize="small" />
          </IconButton>
          <IconButton onClick={reset} disabled={!imgSize} aria-label="Reset zoom">
            <RestartAlt fontSize="small" />
          </IconButton>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="caption" color="text.secondary">
            Zoom <strong>{zoom.toFixed(2)}×</strong> · Output{" "}
            <strong>{outputWidth}×{outputHeight}</strong> · aspect{" "}
            <strong>{aspectRatio.toFixed(2)}:1</strong>
          </Typography>
          <Box flex={1} />
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            variant="contained"
            onClick={confirm}
            disabled={busy || !imgSize}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {busy ? "Cropping…" : "Crop & upload"}
          </Button>
        </Stack>
        <canvas ref={exportCanvasRef} style={{ display: "none" }} />
      </DialogActions>
    </Dialog>
  );
}
