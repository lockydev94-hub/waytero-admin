// ============================================================
// WAYTERO ADMIN — UPLOAD LIMITS (single source of truth)
//
//  Every upload surface (MediaPicker, MediaUploader, the service
//  layer that actually posts the file) reads its size/format rules
//  from here, so the hint an admin sees is the rule that is really
//  enforced. Backend mirror: app/modules/admin/api.py UPLOAD_LIMITS.
// ============================================================

export type MediaLimitKind =
  | "image"
  | "photo"
  | "logo"
  | "icon"
  | "payment_icon"
  | "video"
  | "document";

export interface MediaLimits {
  maxBytes: number;
  /** MIME types the file input accepts and the guard allows. */
  mimes: string[];
  /** Formats clause of the hint (the size clause is derived from maxBytes). */
  formats: string;
  /** Advice appended to the hint, e.g. art-direction guidance. */
  note?: string;
  /** One line shown under the upload control. */
  hint: string;
}

const MB = 1024 * 1024;

const IMAGE_MIMES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];

const DEFS: Record<MediaLimitKind, Omit<MediaLimits, "hint">> = {
  image: {
    maxBytes: 8 * MB,
    mimes: IMAGE_MIMES,
    formats: "PNG, JPG, WebP or SVG",
  },
  photo: {
    maxBytes: 8 * MB,
    // Raster only — the crop step needs a browser-decodable image, and a
    // profile/vehicle photo is never vector art.
    mimes: ["image/png", "image/jpeg", "image/jpg", "image/webp"],
    formats: "PNG, JPG or WebP",
  },
  logo: {
    maxBytes: 2 * MB,
    mimes: IMAGE_MIMES,
    formats: "PNG or SVG",
    note: "keep the artwork square or wide",
  },
  icon: {
    maxBytes: 1 * MB,
    mimes: IMAGE_MIMES,
    formats: "PNG or SVG",
  },
  payment_icon: {
    maxBytes: 1 * MB,
    mimes: IMAGE_MIMES,
    formats: "PNG or SVG",
  },
  video: {
    maxBytes: 20 * MB,
    mimes: ["video/mp4", "video/webm", "video/quicktime"],
    formats: "MP4 or WebM",
  },
  document: {
    maxBytes: 20 * MB,
    // Scanned paperwork arrives as a PDF or a photo of the paper — both are
    // accepted everywhere documents are uploaded (KYC, hotel, vehicle, staff).
    mimes: ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"],
    formats: "PDF or image (JPG, PNG, WebP)",
  },
};

function describe(kind: MediaLimitKind, maxBytes: number): string {
  const def = DEFS[kind];
  const size = `max ${formatBytes(maxBytes)}`;
  return [def.formats, size, def.note].filter(Boolean).join(" · ");
}

export const MEDIA_LIMITS: Record<MediaLimitKind, MediaLimits> = Object.fromEntries(
  (Object.keys(DEFS) as MediaLimitKind[]).map((kind) => [
    kind,
    { ...DEFS[kind], hint: describe(kind, DEFS[kind].maxBytes) },
  ])
) as Record<MediaLimitKind, MediaLimits>;

/**
 * Hint for a slot. `maxBytes` is for endpoints that cap tighter than the kind
 * default (e.g. staff documents), so the caption never overstates what the
 * server accepts.
 */
export function mediaHint(kind: MediaLimitKind, maxBytes?: number): string {
  return describe(kind, maxBytes ?? MEDIA_LIMITS[kind].maxBytes);
}

/** Backend `asset_type` form field → the limit set that applies to it. */
export function limitKindForAssetType(
  assetType: "logo" | "favicon" | "og_image" | "general" | "document" | "photo"
): MediaLimitKind {
  if (assetType === "logo") return "logo";
  if (assetType === "favicon") return "icon";
  if (assetType === "document") return "document";
  if (assetType === "photo") return "photo";
  return "image";
}

/**
 * Caps an endpoint enforces on top of the kind default, mirrored from
 * app/modules/admin/api_dashboard.py. Passing one to uploadProblem()/mediaHint()
 * keeps the caption and the server in agreement.
 */
export const STAFF_DOC_MAX_BYTES = 10 * MB;

export function formatBytes(bytes: number): string {
  if (bytes >= MB) return `${Math.round(bytes / MB)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Why this file cannot be uploaded, or null when it can.
 * A file with no MIME type (some drag-drop paths) is not rejected on type
 * alone — the size rule still applies.
 */
export function uploadProblem(file: File, kind: MediaLimitKind, maxBytes?: number): string | null {
  const limits = MEDIA_LIMITS[kind];
  const cap = maxBytes ?? limits.maxBytes;
  if (file.size > cap) {
    return `${file.name} is ${formatBytes(file.size)} — this slot accepts up to ${formatBytes(cap)}.`;
  }
  if (file.type && !limits.mimes.includes(file.type.toLowerCase())) {
    return `${file.name} is a ${file.type} file. ${limits.hint}.`;
  }
  return null;
}
