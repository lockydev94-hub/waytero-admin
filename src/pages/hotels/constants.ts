// ============================================================
// WAYTERO ADMIN — HOTELS PAGE CONSTANTS
// Doc Ref: Docs/21_Hotel_Module_Implementation/03_FRONTEND_DESIGN.md §2
//
// Presentation-only lookups. Anything the server enforces lives in
// hotel.service.ts and is re-exported there, so there is one source per value.
// ============================================================

/** Human labels for the document type codes the server accepts. */
export const DOC_TYPE_LABELS: Record<string, string> = {
  GST_CERTIFICATE: "GST Certificate",
  PAN_CARD: "PAN Card",
  TRADE_LICENSE: "Trade License",
  BANK_PROOF: "Bank Proof",
  FIRE_SAFETY_CERTIFICATE: "Fire Safety Certificate",
  FSSAI_LICENSE: "FSSAI License",
  PROPERTY_OWNERSHIP_PROOF: "Property Ownership Proof",
  TOURISM_REGISTRATION: "Tourism Registration",
  OTHER: "Other",
};

export const ROOM_TYPE_LABELS: Record<string, string> = {
  STANDARD: "Standard",
  DELUXE: "Deluxe",
  SUPER_DELUXE: "Super Deluxe",
  EXECUTIVE: "Executive",
  SUITE: "Suite",
  FAMILY: "Family",
  DORMITORY: "Dormitory",
  COTTAGE: "Cottage",
  TENT: "Tent",
};

export const VIEW_TYPE_LABELS: Record<string, string> = {
  CITY_VIEW: "City view",
  SEA_VIEW: "Sea view",
  MOUNTAIN_VIEW: "Mountain view",
  GARDEN_VIEW: "Garden view",
  POOL_VIEW: "Pool view",
  LAKE_VIEW: "Lake view",
  NO_VIEW: "No view",
};

export const BED_TYPE_LABELS: Record<string, string> = {
  SINGLE: "Single",
  TWIN: "Twin",
  DOUBLE: "Double",
  QUEEN: "Queen",
  KING: "King",
  BUNK: "Bunk",
  SOFA_CUM_BED: "Sofa cum bed",
};

export const IMAGE_TYPE_LABELS: Record<string, string> = {
  EXTERIOR: "Exterior",
  LOBBY: "Lobby",
  ROOM: "Room",
  BATHROOM: "Bathroom",
  RESTAURANT: "Restaurant",
  AMENITY: "Amenity",
  GALLERY: "Gallery",
};

export const CONFIRMATION_MODE_LABELS: Record<string, string> = {
  INSTANT_CONFIRMATION: "Instant — booking confirms immediately",
  MANUAL_CONFIRMATION: "Manual — hotel confirms each booking",
};

export const ROOM_ALLOCATION_MODE_LABELS: Record<string, string> = {
  AT_BOOKING: "At booking — room number assigned when booked",
  AT_CHECK_IN: "At check-in — room number assigned on arrival",
};

export const RATE_PLAN_TYPE_LABELS: Record<string, string> = {
  PROMOTIONAL: "Promotional",
  WEEKEND: "Weekend",
  SEASONAL: "Seasonal",
  FESTIVAL: "Festival",
};

export const TAX_MODE_LABELS: Record<string, string> = {
  EXCLUSIVE: "Exclusive — GST added on top of the rate",
  INCLUSIVE: "Inclusive — rate already contains GST",
  EXEMPT: "Exempt — no GST on this property",
};

export const DAYS_OF_WEEK = [
  { value: "MON", label: "Mon" },
  { value: "TUE", label: "Tue" },
  { value: "WED", label: "Wed" },
  { value: "THU", label: "Thu" },
  { value: "FRI", label: "Fri" },
  { value: "SAT", label: "Sat" },
  { value: "SUN", label: "Sun" },
];

/** Presets offered in the reject dialog — free text stays available. */
export const REJECTION_PRESETS = [
  "Mandatory documents missing or illegible",
  "Property details do not match submitted documents",
  "Location could not be verified",
  "Duplicate property already listed on the platform",
  "Property does not meet platform quality standards",
];

export const HOTEL_QUERY_KEYS = {
  list: "admin-hotels",
  stats: "admin-hotels-stats",
  meta: "admin-hotels-meta",
  categories: "admin-hotel-categories",
  amenities: "admin-hotel-amenities",
  gstSlabs: "admin-hotel-gst-slabs",
  partners: "admin-hotel-partners",
  officers: "admin-hotel-officers",
  detail: "admin-hotel-detail",
  readiness: "admin-hotel-readiness",
  roomCategories: "admin-hotel-room-categories",
  ratePlans: "admin-hotel-rate-plans",
  inventory: "admin-hotel-inventory",
  ratePreview: "admin-hotel-rate-preview",
  rooms: "admin-hotel-rooms",
  documents: "admin-hotel-documents",
  images: "admin-hotel-images",
  policies: "admin-hotel-policies",
  commission: "admin-hotel-commission",
  logs: "admin-hotel-logs",
} as const;

/** Formats paise-free rupee amounts for dense table cells. */
export const inr = (v: number | string | null | undefined): string => {
  const n = typeof v === "string" ? Number(v) : v;
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

export const fmtDate = (v: string | null | undefined): string =>
  v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const fmtDateTime = (v: string | null | undefined): string =>
  v
    ? new Date(v).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/** YYYY-MM-DD in local time — toISOString() would shift across the IST boundary. */
export const toIsoDate = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/;
export const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
export const MOBILE_RE = /^[6-9]\d{9}$/;
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const DOC_STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error"> = {
  PENDING: "warning",
  VERIFIED: "success",
  REJECTED: "error",
};

export const COMMISSION_TYPES = ["PERCENTAGE", "FLAT", "HYBRID"];
export const COMMISSION_APPLIES_TO = ["PER_BOOKING", "PER_ROOM_NIGHT"];
export const TAX_MODES = ["EXCLUSIVE", "INCLUSIVE", "EXEMPT"];

// ── Form → payload coercion ──────────────────────────────────
// MUI TextField always yields a string, and an emptied numeric field yields "".
// Pydantic rejects "" for int/Decimal with a 422, so a cleared optional field
// must go over the wire as null (clear it) and a cleared required field must be
// omitted entirely (keep the server default) — never as "".

/** Optional number: "" / null / undefined / NaN → null, else Number. */
export const numOrNull = (v: unknown): number | null => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Required number: anything unparseable falls back to `fallback`. */
export const numOr = (v: unknown, fallback: number): number => {
  if (v === "" || v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Optional string: "" → null (so the server clears rather than 422s). */
export const strOrNull = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

/** Optional string that must be omitted rather than nulled. */
export const strOrUndef = (v: unknown): string | undefined => {
  const s = strOrNull(v);
  return s === null ? undefined : s;
};

/** Drop keys whose value is undefined so PATCH stays a true partial update. */
export const pruneUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

