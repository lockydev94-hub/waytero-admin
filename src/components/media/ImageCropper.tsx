// ============================================================
// WAYTERO ADMIN — ADVANCED IMAGE CROPPER
// Doc Ref: Migration 0044_website_cms (origin) / Media Library
//
//  Pre-upload crop/resize modal. Supports:
//    • Fixed-aspect crop (zoom/pan the image under a locked ratio)
//    • Free crop (drag + resize the crop rectangle any way you like)
//    • Aspect-ratio presets (1:1, 4:3, 16:9, … or "Free")
//    • Output sizing (source resolution or a longest-side preset)
//
//  Rendering is canvas-based so what the admin sees is exactly what
//  gets exported. No new npm deps.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions,
  Slider, Stack, Typography, Button, IconButton,
  CircularProgress, ToggleButton, ToggleButtonGroup, useTheme,
} from "@mui/material";
import { Close, ZoomIn, ZoomOut, RestartAlt, Crop } from "@mui/icons-material";
import { useSnackbar } from "notistack";

export type OutputFormat = "image/jpeg" | "image/png" | "image/webp";

export interface AspectPreset {
  /** Human label shown on the toggle, e.g. "16:9". */
  label: string;
  /** width/height ratio, or null for free-form crop. */
  ratio: number | null;
}

interface Props {
  /** Source image as object URL or data URL. */
  src: string;
  open: boolean;
  onClose: () => void;
  /** Called with the cropped file (already converted to the chosen format). */
  onConfirm: (blob: Blob, fileName: string) => void;
  title?: string;

  // ── Legacy fixed-output mode (kept for MediaUploader compatibility) ──
  aspectRatio?: number;
  outputWidth?: number;
  outputHeight?: number;

  // ── Advanced mode ───────────────────────────────────────────
  /** Aspect presets shown as toggle chips. When omitted, uses `aspectRatio`. */
  presets?: AspectPreset[];
  /** Index of the default-selected preset, or -1 for free. Default 0. */
  defaultPresetIndex?: number;
  /** Longest-side output options in px. 0 = source resolution. */
  outputSizeOptions?: number[];
  /** Default longest-side output in px. Default 0 (source resolution). */
  defaultOutputSize?: number;

  format?: OutputFormat;
  quality?: number;
}

interface ImgSize { w: number; h: number }
interface StageSize { w: number; h: number }
interface CropRect { x: number; y: number; w: number; h: number }

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const MIN_CROP = 48;

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type Handle = typeof HANDLES[number];

/** Common presets offered to callers that don't want to build their own. */
export const DEFAULT_ASPECT_PRESETS: AspectPreset[] = [
  { label: "Free", ratio: null },
  { label: "1:1", ratio: 1 },
  { label: "4:3", ratio: 4 / 3 },
  { label: "3:2", ratio: 3 / 2 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "21:9", ratio: 21 / 9 },
];

/** Common output-size options in px (0 = source resolution). */
export const DEFAULT_OUTPUT_SIZES = [0, 512, 800, 1024, 1280, 1920, 2560];

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/**
 * The image is drawn at (drawX, drawY) with size (drawW, drawH) in stage
 * CSS px. `zoom` is relative to "fit" (image just covers the stage by its
 * shortest side); `pan` is an offset from the stage centre in CSS px.
 */
function imageLayout(
  img: ImgSize,
  stage: StageSize,
  zoom: number,
  pan: { x: number; y: number },
) {
  const fit = Math.min(stage.w / img.w, stage.h / img.h);
  const drawW = img.w * fit * zoom;
  const drawH = img.h * fit * zoom;
  const x = stage.w / 2 + pan.x - drawW / 2;
  const y = stage.h / 2 + pan.y - drawH / 2;
  return { drawW, drawH, x, y, fit };
}

export default function AdvancedImageCropper({
  src,
  open,
  onClose,
  onConfirm,
  title = "Crop image",
  aspectRatio,
  outputWidth,
  outputHeight,
  presets,
  defaultPresetIndex = 0,
  outputSizeOptions,
  defaultOutputSize = 0,
  format = "image/jpeg",
  quality = 0.92,
}: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const stageRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{
    kind: "pan" | "move-crop" | Handle;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
    crop: CropRect;
  } | null>(null);

  const [imgSize, setImgSize] = useState<ImgSize | null>(null);
  const [stageSize, setStageSize] = useState<StageSize>({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [presetIdx, setPresetIdx] = useState(defaultPresetIndex);
  const [outputSize, setOutputSize] = useState(defaultOutputSize);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isFree = (presets ?? []).length > 0 && (presets ?? [])[presetIdx]?.ratio == null;
  const activeRatio =
    (presets && presets[presetIdx]?.ratio) ?? aspectRatio ?? null;

  // ── Load image ──────────────────────────────────────────────
  useEffect(() => {
    if (!open || !src) return;
    setLoadError(null);
    setImgSize(null);
    setCrop(null);
    const img = new Image();
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

  // ── Measure stage ───────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setStageSize({
        w: Math.max(1, Math.round(rect.width)),
        h: Math.max(1, Math.round(rect.height)),
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

  // ── When image+stage settle, seed zoom / crop ──────────────
  useEffect(() => {
    if (!imgSize || !stageSize.w || !stageSize.h) return;
    const lay = imageLayout(imgSize, stageSize, 1, { x: 0, y: 0 });
    const visLeft = clamp(lay.x, 0, stageSize.w);
    const visTop = clamp(lay.y, 0, stageSize.h);
    const visRight = clamp(lay.x + lay.drawW, 0, stageSize.w);
    const visBottom = clamp(lay.y + lay.drawH, 0, stageSize.h);
    const visW = Math.max(MIN_CROP, visRight - visLeft);
    const visH = Math.max(MIN_CROP, visBottom - visTop);

    if (activeRatio) {
      let w = visW * 0.9;
      let h = w / activeRatio;
      if (h > visH * 0.9) {
        h = visH * 0.9;
        w = h * activeRatio;
      }
      const x = (stageSize.w - w) / 2;
      const y = (stageSize.h - h) / 2;
      setCrop({ x, y, w, h });
    } else {
      setCrop({
        x: visLeft + (visW - visW * 0.9) / 2,
        y: visTop + (visH - visH * 0.9) / 2,
        w: visW * 0.9,
        h: visH * 0.9,
      });
    }
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [imgSize, stageSize.w, stageSize.h, activeRatio]);

  // ── Re-shape crop when the active preset changes ───────────
  useEffect(() => {
    if (!crop || !stageSize.w) return;
    if (presets && presets[presetIdx]?.ratio) {
      const r = presets[presetIdx].ratio!;
      let w = crop.w;
      let h = w / r;
      if (h > stageSize.h) {
        h = stageSize.h * 0.9;
        w = h * r;
      }
      const x = clamp(crop.x + (crop.w - w) / 2, 0, Math.max(0, stageSize.w - w));
      const y = clamp(crop.y + (crop.h - h) / 2, 0, Math.max(0, stageSize.h - h));
      setCrop({ x, y, w, h });
    }
  }, [presetIdx, presets, stageSize.h, stageSize.w]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Draw preview ────────────────────────────────────────────
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
      if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
      }
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#0F172A";
      ctx.fillRect(0, 0, cssW, cssH);
      const lay = imageLayout(imgSize, { w: cssW, h: cssH }, zoom, pan);
      try {
        ctx.drawImage(img, lay.x, lay.y, lay.drawW, lay.drawH);
      } catch (e) {
        console.error("Cropper drawImage failed:", e);
      }
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
  }, [imgSize, zoom, pan.x, pan.y, open]);

  // ── Pointer handlers ────────────────────────────────────────
  const clampCropToStage = (c: CropRect, s: StageSize): CropRect => {
    const w = clamp(c.w, MIN_CROP, s.w);
    const h = clamp(c.h, MIN_CROP, s.h);
    const x = clamp(c.x, 0, Math.max(0, s.w - w));
    const y = clamp(c.y, 0, Math.max(0, s.h - h));
    return { x, y, w, h };
  };

  const onPointerDown = (e: React.PointerEvent, handle?: Handle | "move-crop") => {
    if (!imgSize || !crop) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = handle
      ? { kind: handle, startX: e.clientX, startY: e.clientY, panX: 0, panY: 0, crop }
      : { kind: "pan", startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, crop };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (drag.kind === "pan") {
      setPan({ x: drag.panX + dx, y: drag.panY + dy });
      return;
    }

    if (!crop || !stageSize.w) return;
    let c: CropRect = { ...drag.crop };
    const r = activeRatio;

    const setWH = (w: number, h: number) => {
      c.w = Math.max(MIN_CROP, w);
      c.h = Math.max(MIN_CROP, h);
    };

    if (drag.kind === "move-crop") {
      c.x = clamp(drag.crop.x + dx, 0, Math.max(0, stageSize.w - drag.crop.w));
      c.y = clamp(drag.crop.y + dy, 0, Math.max(0, stageSize.h - drag.crop.h));
    } else if (drag.kind === "se") {
      if (r) {
        const w = drag.crop.w + dx;
        setWH(w, w / r);
      } else {
        c.w = drag.crop.w + dx;
        c.h = drag.crop.h + dy;
      }
    } else if (drag.kind === "sw") {
      if (r) {
        const w = drag.crop.w - dx;
        setWH(w, w / r);
        c.x = drag.crop.x + dx;
      } else {
        const w = drag.crop.w - dx;
        const h = drag.crop.h + dy;
        setWH(w, h);
        c.x = drag.crop.x + dx;
      }
    } else if (drag.kind === "ne") {
      if (r) {
        const w = drag.crop.w + dx;
        setWH(w, w / r);
        c.y = drag.crop.y - (c.h - drag.crop.h);
      } else {
        const w = drag.crop.w + dx;
        const h = drag.crop.h - dy;
        setWH(w, h);
        c.y = drag.crop.y + dy;
      }
    } else if (drag.kind === "nw") {
      if (r) {
        const w = drag.crop.w - dx;
        setWH(w, w / r);
        c.x = drag.crop.x + dx;
        c.y = drag.crop.y - (c.h - drag.crop.h);
      } else {
        const w = drag.crop.w - dx;
        const h = drag.crop.h - dy;
        setWH(w, h);
        c.x = drag.crop.x + dx;
        c.y = drag.crop.y + dy;
      }
    } else if (drag.kind === "n") {
      c.h = Math.max(MIN_CROP, drag.crop.h - dy);
      c.y = drag.crop.y + dy;
      if (r) {
        c.w = c.h * r;
      }
    } else if (drag.kind === "s") {
      c.h = Math.max(MIN_CROP, drag.crop.h + dy);
      if (r) {
        c.w = c.h * r;
        c.x = clamp(crop.x + (crop.w - c.w) / 2, 0, Math.max(0, stageSize.w - c.w));
      }
    } else if (drag.kind === "e") {
      c.w = Math.max(MIN_CROP, drag.crop.w + dx);
      if (r) {
        c.h = c.w / r;
        c.y = clamp(crop.y + (crop.h - c.h) / 2, 0, Math.max(0, stageSize.h - c.h));
      }
    } else if (drag.kind === "w") {
      c.w = Math.max(MIN_CROP, drag.crop.w - dx);
      c.x = drag.crop.x + dx;
      if (r) {
        c.h = c.w / r;
        c.y = clamp(crop.y + (crop.h - c.h) / 2, 0, Math.max(0, stageSize.h - c.h));
      }
    }

    setCrop(clampCropToStage(c, stageSize));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    dragRef.current = null;
  };

  // ── Zoom controls ───────────────────────────────────────────
  const onZoomSlider = (_: Event, v: number | number[]) => setZoom(v as number);
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, Math.min(z / 1.2, z - 0.05)));
  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, Math.max(z * 1.2, z + 0.05)));
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // ── Confirm → render crop → blob ────────────────────────────
  const confirm = async () => {
    const img = imageRef.current;
    if (!img || !imgSize || !crop) {
      enqueueSnackbar("Image not ready — please wait for it to load", { variant: "warning" });
      return;
    }
    const stageEl = stageRef.current;
    const rect = stageEl ? stageEl.getBoundingClientRect() : null;
    const cssW = Math.max(1, Math.round(rect?.width || stageSize.w || 960));
    const cssH = Math.max(1, Math.round(rect?.height || stageSize.h || 640));

    setBusy(true);
    try {
      const lay = imageLayout(imgSize, { w: cssW, h: cssH }, zoom, pan);
      // Map crop rect (stage px) → source image px.
      const scaleX = lay.drawW > 0 ? imgSize.w / lay.drawW : 1;
      const scaleY = lay.drawH > 0 ? imgSize.h / lay.drawH : 1;
      const srcX = clamp(crop.x - lay.x, 0, lay.drawW) * scaleX;
      const srcY = clamp(crop.y - lay.y, 0, lay.drawH) * scaleY;
      const srcW = Math.min(crop.w * scaleX, imgSize.w - srcX);
      const srcH = Math.min(crop.h * scaleY, imgSize.h - srcY);

      // Output dimensions.
      let outW: number;
      let outH: number;
      const ratio = crop.w / crop.h;
      if (outputWidth && outputHeight) {
        outW = outputWidth;
        outH = outputHeight;
      } else if (outputSize > 0) {
        if (ratio >= 1) {
          outW = outputSize;
          outH = Math.max(1, Math.round(outputSize / ratio));
        } else {
          outH = outputSize;
          outW = Math.max(1, Math.round(outputSize * ratio));
        }
      } else {
        outW = Math.max(1, Math.round(srcW));
        outH = Math.max(1, Math.round(srcH));
      }

      const canvas = exportCanvasRef.current!;
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context not available");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#0F172A";
      ctx.fillRect(0, 0, outW, outH);
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), format, quality)
      );
      if (!blob) throw new Error("Browser refused to export the cropped image");
      const ext = format === "image/png" ? "png" : format === "image/webp" ? "webp" : "jpg";
      onConfirm(blob, `cropped-${Date.now()}.${ext}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Crop failed";
      console.error("Crop failed:", e);
      enqueueSnackbar(msg, { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const showPresetPicker = (presets ?? []).length > 0;

  const handlePos = (h: Handle): React.CSSProperties => {
    if (!crop) return {};
    const pos: React.CSSProperties = { position: "absolute", width: 18, height: 18, zIndex: 3 };
    if (h.includes("n")) pos.top = -9;
    if (h.includes("s")) pos.bottom = -9;
    if (h.includes("w")) pos.left = -9;
    if (h.includes("e")) pos.right = -9;
    pos.cursor = {
      nw: "nwse-resize", se: "nwse-resize",
      ne: "nesw-resize", sw: "nesw-resize",
      n: "ns-resize", s: "ns-resize",
      e: "ew-resize", w: "ew-resize",
    }[h] as string;
    return pos;
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
          onPointerDown={(e) => onPointerDown(e)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          sx={{
            position: "relative",
            width: "100%",
            height: 480,
            overflow: "hidden",
            cursor: !imgSize ? "default" : dragRef.current?.kind === "pan" ? "grabbing" : "grab",
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
            <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "common.white" }}>
              <CircularProgress size={28} sx={{ color: "common.white" }} />
            </Box>
          )}
          {loadError && (
            <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "error.light", p: 2, textAlign: "center" }}>
              <Typography variant="body2">{loadError}</Typography>
            </Box>
          )}
          {imgSize && crop && (
            <>
              {/* Masked crop frame */}
              <Box
                onPointerDown={(e) => onPointerDown(e, "move-crop")}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                sx={{
                  position: "absolute",
                  left: crop.x,
                  top: crop.y,
                  width: crop.w,
                  height: crop.h,
                  border: `2px solid ${theme.palette.primary.main}`,
                  boxShadow: "0 0 0 9999px rgba(15,23,42,0.55)",
                  cursor: "move",
                  touchAction: "none",
                  zIndex: 2,
                }}
              />
              {HANDLES.map((h) => (
                <Box
                  key={h}
                  onPointerDown={(e) => onPointerDown(e, h)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  sx={{
                    ...handlePos(h),
                    bgcolor: theme.palette.primary.main,
                    border: "2px solid #fff",
                    borderRadius: "50%",
                    boxSizing: "border-box",
                    touchAction: "none",
                  }}
                />
              ))}
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ flexDirection: "column", alignItems: "stretch", p: 2, gap: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton size="small" onClick={zoomOut} disabled={!imgSize || zoom <= ZOOM_MIN + 1e-3} aria-label="Zoom out" sx={{ color: "text.secondary" }}>
            <ZoomOut fontSize="small" />
          </IconButton>
          <Slider min={ZOOM_MIN} max={ZOOM_MAX} step={0.01} value={zoom} onChange={onZoomSlider} sx={{ flex: 1 }} disabled={!imgSize} />
          <IconButton size="small" onClick={zoomIn} disabled={!imgSize || zoom >= ZOOM_MAX - 1e-3} aria-label="Zoom in" sx={{ color: "text.secondary" }}>
            <ZoomIn fontSize="small" />
          </IconButton>
          <IconButton onClick={reset} disabled={!imgSize} aria-label="Reset zoom">
            <RestartAlt fontSize="small" />
          </IconButton>
        </Stack>

        {(showPresetPicker || (outputSizeOptions ?? []).length > 0) && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between">
            {showPresetPicker && (
              <ToggleButtonGroup
                size="small"
                exclusive
                value={presetIdx}
                onChange={(_, v) => { if (v !== null) setPresetIdx(v as number); }}
              >
                {presets!.map((p, i) => (
                  <ToggleButton key={p.label} value={i} sx={{ px: 1.2, fontSize: 12 }}>
                    {p.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            )}
            {(outputSizeOptions ?? []).length > 0 && (
              <ToggleButtonGroup
                size="small"
                exclusive
                value={outputSize}
                onChange={(_, v) => { if (v !== null) setOutputSize(v as number); }}
              >
                {outputSizeOptions!.map((s) => (
                  <ToggleButton key={s} value={s} sx={{ px: 1.2, fontSize: 12 }}>
                    {s === 0 ? "Original" : `${s}px`}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            )}
          </Stack>
        )}

        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="caption" color="text.secondary">
            {crop && imgSize
              ? `Crop ${Math.round(crop.w)}×${Math.round(crop.h)} · Zoom ${zoom.toFixed(2)}× · Output ${outputSize > 0 ? `longest ${outputSize}px` : "source resolution"}`
              : "Loading image…"}
          </Typography>
          <Box flex={1} />
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            variant="contained"
            onClick={confirm}
            disabled={busy || !imgSize || !crop}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {busy ? "Cropping…" : "Crop & continue"}
          </Button>
        </Stack>
        <canvas ref={exportCanvasRef} style={{ display: "none" }} />
      </DialogActions>
    </Dialog>
  );
}