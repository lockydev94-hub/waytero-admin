// ============================================================
// WAYTERO ADMIN — HOTEL SERVICE
// Doc Ref: BRD Part 4 §57-92 | SRS Part 5 §153-194 | API Doc 09_HOTEL_API
//          Docs/21_Hotel_Module_Implementation/02_BACKEND_API.md
// Backend routes: /admin/hotels/*
//
// Reads type the bare payload; writes return {success, message, data}.
// Uploads reuse settings.service uploadMedia — there is no hotel upload transport.
// ============================================================
import apiClient from "./api";

// ── Types ────────────────────────────────────────────────────

export interface HotelListItem {
  id: number;
  uuid: string;
  hotel_code: string;
  hotel_name: string;
  status: string;
  star_rating: number | null;
  city_id: number;
  city_name: string | null;
  state_name: string | null;
  partner_id: number;
  partner_name: string | null;
  hotel_category_id: number | null;
  category_label: string | null;
  total_rooms: number;
  room_category_count: number;
  primary_image_url: string | null;
  is_own_risk_approved: boolean;
  is_featured: boolean;
  completeness_percent: number;
  assigned_officer_name: string | null;
  created_at: string;
}

export interface HotelPage {
  items: HotelListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface HotelStats {
  total: number;
  draft: number;
  pending: number;
  under_review: number;
  document_pending: number;
  approved: number;
  active: number;
  rejected: number;
  inactive: number;
  suspended: number;
  blocked: number;
  own_risk_approved: number;
  unassigned_in_pipeline: number;
}

export interface ReadinessCheck {
  key: string;
  label: string;
  passed: boolean;
  blocks_submit: boolean;
  blocks_approve: boolean;
  hint: string | null;
}

export interface ReadinessReport {
  hotel_id: number;
  status: string;
  completeness_percent: number;
  can_submit: boolean;
  can_approve: boolean;
  checks: ReadinessCheck[];
}

export interface HotelImage {
  id: number;
  hotel_id: number;
  image_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  image_type: string | null;
  display_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface HotelDocument {
  id: number;
  hotel_id: number;
  document_type: string;
  document_number: string | null;
  file_url: string;
  issue_date: string | null;
  expiry_date: string | null;
  verification_status: string;
  remarks: string | null;
  uploaded_at: string;
  verified_at: string | null;
}

export interface HotelPolicy {
  id: number;
  hotel_id: number;
  check_in_time: string | null;
  check_out_time: string | null;
  early_check_in_allowed: boolean;
  late_check_out_allowed: boolean;
  cancellation_free_hours: number | null;
  refund_percent_tier_1: number | null;
  cancellation_tier_2_hours: number | null;
  refund_percent_tier_2: number | null;
  cancellation_tier_3_hours: number | null;
  refund_percent_tier_3: number | null;
  refund_percent_same_day: number | null;
  no_show_refund_percent: number | null;
  couples_allowed: boolean;
  unmarried_couples_allowed: boolean;
  local_id_accepted: boolean;
  pets_allowed: boolean;
  smoking_allowed: boolean;
  alcohol_allowed: boolean;
  min_guest_age: number | null;
  extra_bed_charge: number | null;
  child_free_age_limit: number | null;
  house_rules: string | null;
  cancellation_policy_text: string | null;
}

export interface CommissionExample {
  [k: string]: number | string;
}

export interface ResolvedCommission {
  commission_type: string;
  commission_percent: number;
  commission_flat: number;
  applies_to: string;
  /** HOTEL_OVERRIDE | CITY_RULE | GLOBAL_RULE | SYSTEM_DEFAULT */
  source: string;
  min_commission: number | null;
  max_commission: number | null;
  config_id: number | null;
  example: CommissionExample | null;
}

export interface VerificationAssignment {
  id: number;
  hotel_id: number;
  officer_id: string;
  assigned_by: string | null;
  assigned_at: string;
  unassigned_at: string | null;
  is_active: boolean;
  notes: string | null;
  officer_name: string | null;
  officer_mobile: string | null;
}

export interface HotelDetail {
  id: number;
  uuid: string;
  hotel_code: string;
  partner_id: number;
  partner_name: string | null;
  hotel_name: string;
  hotel_type: string | null;
  hotel_category_id: number | null;
  category_label: string | null;
  star_rating: number | null;
  description: string | null;
  short_description: string | null;
  gst_number: string | null;
  pan_number: string | null;
  city_id: number;
  city_name: string | null;
  state_id: number | null;
  state_name: string | null;
  address: string | null;
  address_line_2: string | null;
  landmark: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  contact_person: string | null;
  contact_number: string | null;
  alternate_number: string | null;
  email: string | null;
  website_url: string | null;
  total_rooms: number;
  confirmation_mode: string;
  room_allocation_mode: string;
  tax_mode: string;
  is_gst_registered: boolean;
  /** Global GST_ENABLED. When false, tax_mode is inert. */
  platform_gst_enabled: boolean;
  slug: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  is_featured: boolean;
  display_order: number;
  status: string;
  rejection_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  activated_at: string | null;
  is_own_risk_approved: boolean;
  amenity_ids: number[];
  images: HotelImage[];
  documents: HotelDocument[];
  policy: HotelPolicy | null;
  commission: ResolvedCommission | null;
  assigned_officer: VerificationAssignment | null;
  readiness: ReadinessReport | null;
  allowed_transitions: string[];
  created_at: string;
  updated_at: string;
}

export interface RoomCategoryImage {
  id: number;
  room_category_id: number;
  image_url: string;
  caption: string | null;
  display_order: number;
  is_primary: boolean;
}

export interface RoomCategory {
  id: number;
  hotel_id: number;
  category_name: string;
  room_type: string | null;
  description: string | null;
  base_occupancy: number;
  max_adults: number;
  max_children: number;
  max_occupancy: number;
  extra_bed_allowed: boolean;
  extra_bed_charge: number;
  extra_adult_charge: number;
  extra_child_charge: number;
  bed_type: string | null;
  room_size_sqft: number | null;
  view_type: string | null;
  floor_range: string | null;
  base_price: number;
  published_price: number | null;
  min_sellable_price: number | null;
  meal_plan: string;
  is_refundable: boolean;
  total_rooms: number;
  display_order: number;
  is_active: boolean;
  images: RoomCategoryImage[];
  amenity_ids: number[];
  rate_plan_count: number;
  physical_room_count: number;
}

export interface Room {
  id: number;
  hotel_id: number;
  room_category_id: number;
  room_number: string;
  floor_number: number | null;
  room_status: string;
  remarks: string | null;
  is_active: boolean;
}

export interface RatePlan {
  id: number;
  hotel_id: number;
  room_category_id: number;
  plan_name: string;
  plan_type: string;
  priority: number;
  date_from: string;
  date_to: string;
  day_of_week_mask: string | null;
  rate_mode: string;
  rate_value: number;
  min_nights: number;
  is_active: boolean;
  created_at: string;
}

export interface InventoryDay {
  id: number;
  hotel_id: number;
  room_category_id: number;
  inventory_date: string;
  total_rooms: number;
  booked_rooms: number;
  blocked_rooms: number;
  held_rooms: number;
  available_rooms: number;
  rate_override: number | null;
  is_stop_sell: boolean;
}

export interface RatePreviewNight {
  date: string;
  rate: number;
  /** BASE | PLAN | OVERRIDE — where the winning rate came from. */
  source: string;
  plan_id: number | null;
  plan_name: string | null;
  gst_percent: number;
  gst_amount: number;
  total_with_tax: number;
}

export interface RatePreview {
  room_category_id: number;
  date_from: string;
  date_to: string;
  base_price: number;
  tax_mode: string;
  platform_gst_enabled: boolean;
  nights: RatePreviewNight[];
  total: number;
  total_with_tax: number;
}

export interface HotelCategory {
  id: number;
  category_code: string;
  label: string;
  description: string | null;
  image_url: string | null;
  icon_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  display_order: number;
  is_active: boolean;
}

export interface HotelAmenity {
  id: number;
  amenity_code: string;
  amenity_name: string;
  icon_name: string | null;
  amenity_group: string | null;
  display_order: number;
  is_active: boolean;
}

export interface GstSlab {
  id: number;
  slab_name: string;
  tariff_from: number;
  tariff_to: number | null;
  gst_percent: number;
  has_input_credit: boolean;
  hsn_code: string | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  notes: string | null;
}

export interface HotelPartnerOption {
  id: number;
  owner_name: string | null;
  business_name: string | null;
  mobile: string | null;
  partner_code: string | null;
  city_id: number | null;
  status: string;
  has_hotel: boolean;
  /** Comma-separated active service types, e.g. "CAB,HOTEL". */
  active_services: string;
  hotel_count: number;
}

export interface HotelPartnerPage {
  items: HotelPartnerOption[];
  total: number;
  page: number;
  page_size: number;
}

export interface VerificationOfficer {
  id: string;
  name: string | null;
  mobile_number: string | null;
  email: string | null;
  /** VERIFICATION_OFFICER | ADMIN | SUPER_ADMIN — admins verify at their own risk. */
  user_type: string;
  /** Hotels currently in their pipeline — lets the picker distribute on evidence. */
  active_hotel_count: number;
}

export interface HotelLog {
  id: number;
  hotel_id: number;
  action: string;
  from_status: string | null;
  to_status: string | null;
  remarks: string | null;
  performed_by: string | null;
  performed_by_name: string | null;
  created_at: string;
}

export interface HotelMeta {
  statuses: string[];
  transitions: Record<string, string[]>;
  document_types: string[];
  required_document_types: string[];
  image_types: string[];
  room_types: string[];
  bed_types: string[];
  view_types: string[];
  meal_plans: string[];
  physical_room_statuses: string[];
  rate_plan_types: string[];
  rate_modes: string[];
  commission_types: string[];
  commission_applies_to: string[];
  tax_modes: string[];
  confirmation_modes: string[];
  room_allocation_modes: string[];
}

export interface CreateHotelPayload {
  partner_id: number;
  hotel_name: string;
  hotel_category_id?: number | null;
  hotel_type?: string | null;
  star_rating?: number | null;
  city_id: number;
  state_id?: number | null;
  address?: string | null;
  contact_person?: string | null;
  contact_number?: string | null;
  email?: string | null;
}

export interface HotelListParams {
  search?: string;
  status?: string;
  city_id?: number;
  state_id?: number;
  partner_id?: number;
  hotel_category_id?: number;
  star_rating?: number;
  officer_id?: string;
  is_featured?: boolean;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_dir?: string;
}

// ── Constants ────────────────────────────────────────────────

type ChipColor = "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning";

/** Drives every status chip and every status Select. */
export const HOTEL_STATUS_META: Record<string, { label: string; color: ChipColor; icon: string }> = {
  DRAFT: { label: "Draft", color: "default", icon: "EditNote" },
  PENDING: { label: "Pending", color: "warning", icon: "HourglassEmpty" },
  UNDER_REVIEW: { label: "Under Review", color: "info", icon: "FactCheck" },
  DOCUMENT_PENDING: { label: "Document Pending", color: "warning", icon: "Description" },
  APPROVED: { label: "Approved", color: "primary", icon: "TaskAlt" },
  ACTIVE: { label: "Active", color: "success", icon: "CheckCircle" },
  INACTIVE: { label: "Inactive", color: "default", icon: "PauseCircle" },
  SUSPENDED: { label: "Suspended", color: "warning", icon: "PauseCircle" },
  BLOCKED: { label: "Blocked", color: "error", icon: "Block" },
  REJECTED: { label: "Rejected", color: "error", icon: "Cancel" },
};

/**
 * Mirrors the backend VALID_HOTEL_TRANSITIONS so illegal actions can be
 * disabled client-side. The server stays authoritative — this only spares
 * the user a round-trip that ends in an error toast.
 */
export const H_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PENDING"],
  PENDING: ["UNDER_REVIEW", "APPROVED", "REJECTED"],
  UNDER_REVIEW: ["DOCUMENT_PENDING", "APPROVED", "REJECTED"],
  DOCUMENT_PENDING: ["UNDER_REVIEW", "APPROVED", "REJECTED"],
  REJECTED: ["DRAFT", "PENDING"],
  APPROVED: ["ACTIVE", "SUSPENDED", "BLOCKED"],
  ACTIVE: ["INACTIVE", "SUSPENDED", "BLOCKED"],
  INACTIVE: ["ACTIVE", "SUSPENDED", "BLOCKED"],
  SUSPENDED: ["ACTIVE", "INACTIVE", "BLOCKED"],
  BLOCKED: [],
};

export const HOTEL_STATUSES = [
  "DRAFT", "PENDING", "UNDER_REVIEW", "DOCUMENT_PENDING", "APPROVED",
  "REJECTED", "ACTIVE", "INACTIVE", "SUSPENDED", "BLOCKED",
];

/** Statuses where profile edits are accepted by the server. */
export const HOTEL_EDITABLE_STATUSES = ["DRAFT", "REJECTED", "DOCUMENT_PENDING"];

export const HOTEL_PIPELINE_STATUSES = ["PENDING", "UNDER_REVIEW", "DOCUMENT_PENDING"];

/**
 * hotel_type is a free VARCHAR(100) server-side — this list is a UI
 * convenience only, not a server-enforced enum.
 */
export const HOTEL_TYPES = [
  "HOTEL", "RESORT", "VILLA", "APARTMENT", "GUEST_HOUSE",
  "HOMESTAY", "HOSTEL", "LODGE", "COTTAGE",
];

export const HOTEL_DOC_TYPES = [
  "GST_CERTIFICATE", "PAN_CARD", "TRADE_LICENSE", "BANK_PROOF",
  "FIRE_SAFETY_CERTIFICATE", "FSSAI_LICENSE", "PROPERTY_OWNERSHIP_PROOF",
  "TOURISM_REGISTRATION", "OTHER",
];

export const HOTEL_REQUIRED_DOC_TYPES = ["PAN_CARD", "TRADE_LICENSE", "BANK_PROOF"];

export const HOTEL_IMAGE_TYPES = [
  "EXTERIOR", "LOBBY", "ROOM", "BATHROOM", "RESTAURANT", "AMENITY", "GALLERY",
];

export const ROOM_TYPES = [
  "STANDARD", "DELUXE", "SUPER_DELUXE", "EXECUTIVE",
  "SUITE", "FAMILY", "DORMITORY", "COTTAGE", "TENT",
];

export const MEAL_PLANS = ["EP", "CP", "MAP", "AP"];

export const MEAL_PLAN_LABELS: Record<string, string> = {
  EP: "EP — Room only",
  CP: "CP — With breakfast",
  MAP: "MAP — Breakfast + 1 meal",
  AP: "AP — All meals",
};

export const BED_TYPES = ["SINGLE", "TWIN", "DOUBLE", "QUEEN", "KING", "BUNK", "SOFA_CUM_BED"];

export const VIEW_TYPES = [
  "CITY_VIEW", "SEA_VIEW", "MOUNTAIN_VIEW", "GARDEN_VIEW",
  "POOL_VIEW", "LAKE_VIEW", "NO_VIEW",
];

export const PHYSICAL_ROOM_STATUSES = ["AVAILABLE", "OCCUPIED", "MAINTENANCE", "BLOCKED"];

export const RATE_PLAN_TYPES = ["PROMOTIONAL", "WEEKEND", "SEASONAL", "FESTIVAL"];

/** ABSOLUTE = set rate; PERCENT = ±% of base; DELTA = ±flat amount. */
export const RATE_MODES = ["ABSOLUTE", "PERCENT", "DELTA"];

export const RATE_MODE_LABELS: Record<string, string> = {
  ABSOLUTE: "Absolute — set the nightly rate",
  PERCENT: "Percent — adjust base by %",
  DELTA: "Delta — adjust base by amount",
};

export const COMMISSION_TYPES = ["PERCENTAGE", "FLAT", "HYBRID"];

export const COMMISSION_APPLIES_TO = ["PER_BOOKING", "PER_ROOM_NIGHT"];

export const CONFIRMATION_MODES = ["INSTANT_CONFIRMATION", "MANUAL_CONFIRMATION"];

export const ROOM_ALLOCATION_MODES = ["AT_BOOKING", "AT_CHECK_IN"];

export const COMMISSION_SOURCE_LABELS: Record<string, string> = {
  HOTEL_OVERRIDE: "This hotel's own override",
  CITY_RULE: "City commission rule",
  GLOBAL_RULE: "Global commission rule",
  SYSTEM_DEFAULT: "Platform default",
};

export const TAX_MODES = ["EXCLUSIVE", "INCLUSIVE", "EXEMPT"];

export const DOC_VERIFICATION_STATUSES = ["PENDING", "VERIFIED", "REJECTED"];

/** Upload folders — passed as folderOverride to the shared uploadMedia. */
export const HOTEL_UPLOAD_FOLDERS = {
  images: "waytero/hotels/images",
  documents: "waytero/hotels/documents",
  rooms: "waytero/hotels/rooms",
} as const;

// ── Service ──────────────────────────────────────────────────

export const hotelService = {
  // ---- Meta & masters ----

  /** GET /admin/hotels/meta — enum values the forms need */
  getMeta: () => apiClient.get<HotelMeta>("/admin/hotels/meta").then((r) => r.data),

  /** GET /admin/hotels/stats — pipeline KPI counts */
  getStats: () => apiClient.get<HotelStats>("/admin/hotels/stats").then((r) => r.data),

  /** GET /admin/hotels/categories */
  listCategories: (include_inactive = false) =>
    apiClient
      .get<HotelCategory[]>("/admin/hotels/categories", { params: { include_inactive } })
      .then((r) => r.data),

  /** POST /admin/hotels/categories */
  createCategory: (payload: Partial<HotelCategory> & { category_code: string; label: string }) =>
    apiClient.post("/admin/hotels/categories", payload).then((r) => r.data),

  /** PATCH /admin/hotels/categories/{id} */
  updateCategory: (id: number, payload: Partial<HotelCategory>) =>
    apiClient.patch(`/admin/hotels/categories/${id}`, payload).then((r) => r.data),

  /** GET /admin/hotels/amenities */
  listAmenities: (include_inactive = false) =>
    apiClient
      .get<HotelAmenity[]>("/admin/hotels/amenities", { params: { include_inactive } })
      .then((r) => r.data),

  /** POST /admin/hotels/amenities */
  createAmenity: (payload: Partial<HotelAmenity> & { amenity_code: string; amenity_name: string }) =>
    apiClient.post("/admin/hotels/amenities", payload).then((r) => r.data),

  /** PATCH /admin/hotels/amenities/{id} */
  updateAmenity: (id: number, payload: Partial<HotelAmenity>) =>
    apiClient.patch(`/admin/hotels/amenities/${id}`, payload).then((r) => r.data),

  /** GET /admin/hotels/gst-slabs */
  listGstSlabs: (include_inactive = false) =>
    apiClient
      .get<GstSlab[]>("/admin/hotels/gst-slabs", { params: { include_inactive } })
      .then((r) => r.data),

  /** POST /admin/hotels/gst-slabs */
  createGstSlab: (payload: Partial<GstSlab>) =>
    apiClient.post("/admin/hotels/gst-slabs", payload).then((r) => r.data),

  /** PATCH /admin/hotels/gst-slabs/{id} */
  updateGstSlab: (id: number, payload: Partial<GstSlab>) =>
    apiClient.patch(`/admin/hotels/gst-slabs/${id}`, payload).then((r) => r.data),

  /** DELETE /admin/hotels/gst-slabs/{id} */
  deleteGstSlab: (id: number) =>
    apiClient.delete(`/admin/hotels/gst-slabs/${id}`).then((r) => r.data),

  /** GET /admin/hotels/partners-with-hotel — partner picker source, paginated */
  listHotelPartners: (search?: string, page = 1, page_size = 50) =>
    apiClient
      .get<HotelPartnerPage>("/admin/hotels/partners-with-hotel", {
        params: { search, page, page_size },
      })
      .then((r) => r.data),

  /** POST /admin/hotels/partners/{id}/enable-hotel-service */
  enableHotelService: (partner_id: number) =>
    apiClient.post(`/admin/hotels/partners/${partner_id}/enable-hotel-service`).then((r) => r.data),

  /** GET /admin/hotels/verification-officers — with current load */
  listOfficers: () =>
    apiClient.get<VerificationOfficer[]>("/admin/hotels/verification-officers").then((r) => r.data),

  // ---- Hotel CRUD ----

  /** GET /admin/hotels — paginated list */
  list: (params: HotelListParams) =>
    apiClient.get<HotelPage>("/admin/hotels", { params }).then((r) => r.data),

  /** POST /admin/hotels — Stage 1, creates a DRAFT */
  create: (payload: CreateHotelPayload) =>
    apiClient.post("/admin/hotels", payload).then((r) => r.data),

  /** GET /admin/hotels/{id} */
  get: (id: number) => apiClient.get<HotelDetail>(`/admin/hotels/${id}`).then((r) => r.data),

  /** GET /admin/hotels/{id}/full — detail + images, docs, policy, commission, readiness */
  getFull: (id: number) =>
    apiClient.get<HotelDetail>(`/admin/hotels/${id}/full`).then((r) => r.data),

  /** PATCH /admin/hotels/{id} — profile update */
  update: (id: number, payload: Record<string, unknown>) =>
    apiClient.patch(`/admin/hotels/${id}`, payload).then((r) => r.data),

  /** DELETE /admin/hotels/{id} — DRAFT only */
  remove: (id: number) => apiClient.delete(`/admin/hotels/${id}`).then((r) => r.data),

  /** GET /admin/hotels/{id}/readiness — server-computed submit gate */
  getReadiness: (id: number) =>
    apiClient.get<ReadinessReport>(`/admin/hotels/${id}/readiness`).then((r) => r.data),

  /** PATCH /admin/hotels/{id}/amenities */
  updateAmenities: (id: number, amenity_ids: number[]) =>
    apiClient.patch(`/admin/hotels/${id}/amenities`, { amenity_ids }).then((r) => r.data),

  /** PATCH /admin/hotels/{id}/seo */
  updateSeo: (id: number, payload: Record<string, unknown>) =>
    apiClient.patch(`/admin/hotels/${id}/seo`, payload).then((r) => r.data),

  /** PATCH /admin/hotels/{id}/tax */
  updateTax: (id: number, payload: { tax_mode: string; is_gst_registered: boolean; gst_number?: string | null }) =>
    apiClient.patch(`/admin/hotels/${id}/tax`, payload).then((r) => r.data),

  // ---- Images ----

  /** GET /admin/hotels/{id}/images */
  listImages: (id: number) =>
    apiClient.get<HotelImage[]>(`/admin/hotels/${id}/images`).then((r) => r.data),

  /** POST /admin/hotels/{id}/images */
  addImage: (id: number, payload: { image_url: string; caption?: string; image_type?: string; is_primary?: boolean }) =>
    apiClient.post(`/admin/hotels/${id}/images`, payload).then((r) => r.data),

  /** PATCH /admin/hotels/{id}/images/{image_id} */
  updateImage: (id: number, image_id: number, payload: { caption?: string; image_type?: string }) =>
    apiClient.patch(`/admin/hotels/${id}/images/${image_id}`, payload).then((r) => r.data),

  /** PATCH /admin/hotels/{id}/images/{image_id}/primary */
  setPrimaryImage: (id: number, image_id: number) =>
    apiClient.patch(`/admin/hotels/${id}/images/${image_id}/primary`).then((r) => r.data),

  /** PATCH /admin/hotels/{id}/images/reorder */
  reorderImages: (id: number, ordered_ids: number[]) =>
    apiClient.patch(`/admin/hotels/${id}/images/reorder`, { ordered_ids }).then((r) => r.data),

  /** DELETE /admin/hotels/{id}/images/{image_id} */
  deleteImage: (id: number, image_id: number) =>
    apiClient.delete(`/admin/hotels/${id}/images/${image_id}`).then((r) => r.data),

  // ---- Documents ----

  /** GET /admin/hotels/{id}/documents */
  listDocuments: (id: number) =>
    apiClient.get<HotelDocument[]>(`/admin/hotels/${id}/documents`).then((r) => r.data),

  /** POST /admin/hotels/{id}/documents */
  addDocument: (
    id: number,
    payload: {
      document_type: string;
      file_url: string;
      document_number?: string;
      issue_date?: string;
      expiry_date?: string;
    }
  ) => apiClient.post(`/admin/hotels/${id}/documents`, payload).then((r) => r.data),

  /** PATCH /admin/hotels/{id}/documents/{doc_id}/verify */
  verifyDocument: (
    id: number,
    doc_id: number,
    payload: { verification_status: string; remarks?: string }
  ) => apiClient.patch(`/admin/hotels/${id}/documents/${doc_id}/verify`, payload).then((r) => r.data),

  /** DELETE /admin/hotels/{id}/documents/{doc_id} */
  deleteDocument: (id: number, doc_id: number) =>
    apiClient.delete(`/admin/hotels/${id}/documents/${doc_id}`).then((r) => r.data),

  // ---- Policies ----

  /** GET /admin/hotels/{id}/policies */
  getPolicies: (id: number) =>
    apiClient.get<HotelPolicy>(`/admin/hotels/${id}/policies`).then((r) => r.data),

  /** PUT /admin/hotels/{id}/policies */
  updatePolicies: (id: number, payload: Record<string, unknown>) =>
    apiClient.put(`/admin/hotels/${id}/policies`, payload).then((r) => r.data),

  // ---- Commission ----

  /** GET /admin/hotels/{id}/commission — resolved, with source */
  getCommission: (id: number) =>
    apiClient.get(`/admin/hotels/${id}/commission`).then((r) => r.data.resolved),

  /** PUT /admin/hotels/{id}/commission — set per-hotel override */
  setCommission: (id: number, payload: Record<string, unknown>) =>
    apiClient.put(`/admin/hotels/${id}/commission`, payload).then((r) => r.data),

  /** DELETE /admin/hotels/{id}/commission — revert to inherited */
  removeCommission: (id: number) =>
    apiClient.delete(`/admin/hotels/${id}/commission`).then((r) => r.data),

  // ---- Room categories ----

  /** GET /admin/hotels/{id}/room-categories */
  listRoomCategories: (id: number) =>
    apiClient.get<RoomCategory[]>(`/admin/hotels/${id}/room-categories`).then((r) => r.data),

  /** POST /admin/hotels/{id}/room-categories — materialises inventory */
  createRoomCategory: (id: number, payload: Record<string, unknown>) =>
    apiClient.post(`/admin/hotels/${id}/room-categories`, payload).then((r) => r.data),

  /** PATCH /admin/hotels/{id}/room-categories/{cat_id} */
  updateRoomCategory: (id: number, cat_id: number, payload: Record<string, unknown>) =>
    apiClient.patch(`/admin/hotels/${id}/room-categories/${cat_id}`, payload).then((r) => r.data),

  /** DELETE /admin/hotels/{id}/room-categories/{cat_id} */
  deleteRoomCategory: (id: number, cat_id: number) =>
    apiClient.delete(`/admin/hotels/${id}/room-categories/${cat_id}`).then((r) => r.data),

  /** POST /admin/hotels/{id}/room-categories/{cat_id}/images */
  addRoomCategoryImage: (
    id: number,
    cat_id: number,
    payload: { image_url: string; caption?: string; is_primary?: boolean }
  ) => apiClient.post(`/admin/hotels/${id}/room-categories/${cat_id}/images`, payload).then((r) => r.data),

  /** DELETE /admin/hotels/{id}/room-categories/{cat_id}/images/{image_id} */
  deleteRoomCategoryImage: (id: number, cat_id: number, image_id: number) =>
    apiClient
      .delete(`/admin/hotels/${id}/room-categories/${cat_id}/images/${image_id}`)
      .then((r) => r.data),

  /** GET /admin/hotels/{id}/room-categories/{cat_id}/rate-preview — resolved nightly rates */
  getRatePreview: (id: number, cat_id: number, date_from: string, date_to: string) =>
    apiClient
      .get<RatePreview>(`/admin/hotels/${id}/room-categories/${cat_id}/rate-preview`, {
        params: { date_from, date_to },
      })
      .then((r) => r.data),

  // ---- Physical rooms ----

  /** GET /admin/hotels/{id}/rooms */
  listRooms: (id: number, room_category_id?: number) =>
    apiClient
      .get<Room[]>(`/admin/hotels/${id}/rooms`, { params: { room_category_id } })
      .then((r) => r.data),

  /** POST /admin/hotels/{id}/rooms */
  createRoom: (id: number, payload: Record<string, unknown>) =>
    apiClient.post(`/admin/hotels/${id}/rooms`, payload).then((r) => r.data),

  /** POST /admin/hotels/{id}/rooms/bulk — prefix + count generation */
  bulkCreateRooms: (
    id: number,
    payload: {
      room_category_id: number;
      /** Non-Optional str on the server — send "" to omit, never null. */
      prefix?: string;
      start_number: number;
      count: number;
      /** String column on the server (floor "G", "LG"), not a number. */
      floor_number?: string;
      pad_width?: number;
    }
  ) => apiClient.post(`/admin/hotels/${id}/rooms/bulk`, payload).then((r) => r.data),

  /** PATCH /admin/hotels/{id}/rooms/{room_id} */
  updateRoom: (id: number, room_id: number, payload: Record<string, unknown>) =>
    apiClient.patch(`/admin/hotels/${id}/rooms/${room_id}`, payload).then((r) => r.data),

  /** DELETE /admin/hotels/{id}/rooms/{room_id} */
  deleteRoom: (id: number, room_id: number) =>
    apiClient.delete(`/admin/hotels/${id}/rooms/${room_id}`).then((r) => r.data),

  // ---- Rate plans ----

  /** GET /admin/hotels/{id}/rate-plans */
  listRatePlans: (id: number, room_category_id?: number) =>
    apiClient
      .get<RatePlan[]>(`/admin/hotels/${id}/rate-plans`, { params: { room_category_id } })
      .then((r) => r.data),

  /** POST /admin/hotels/{id}/rate-plans */
  createRatePlan: (id: number, payload: Record<string, unknown>) =>
    apiClient.post(`/admin/hotels/${id}/rate-plans`, payload).then((r) => r.data),

  /** PATCH /admin/hotels/{id}/rate-plans/{plan_id} */
  updateRatePlan: (id: number, plan_id: number, payload: Record<string, unknown>) =>
    apiClient.patch(`/admin/hotels/${id}/rate-plans/${plan_id}`, payload).then((r) => r.data),

  /** DELETE /admin/hotels/{id}/rate-plans/{plan_id} */
  deleteRatePlan: (id: number, plan_id: number) =>
    apiClient.delete(`/admin/hotels/${id}/rate-plans/${plan_id}`).then((r) => r.data),

  // ---- Inventory ----

  /** GET /admin/hotels/{id}/inventory — room_category_id optional */
  getInventory: (id: number, date_from: string, date_to: string, room_category_id?: number) =>
    apiClient
      .get<InventoryDay[]>(`/admin/hotels/${id}/inventory`, {
        params: { date_from, date_to, room_category_id },
      })
      .then((r) => r.data),

  /** POST /admin/hotels/{id}/inventory/generate — materialise the horizon */
  generateInventory: (
    id: number,
    payload: { room_category_id: number; date_from: string; date_to: string }
  ) => apiClient.post(`/admin/hotels/${id}/inventory/generate`, payload).then((r) => r.data),

  /**
   * PATCH /admin/hotels/{id}/inventory/bulk — bulk edit a date range.
   * booked_rooms is derived from reservations and is not writable.
   */
  bulkUpdateInventory: (
    id: number,
    payload: {
      room_category_id: number;
      date_from: string;
      date_to: string;
      days_of_week?: string[] | null;
      total_rooms?: number | null;
      blocked_rooms?: number | null;
      rate_override?: number | null;
      is_stop_sell?: boolean | null;
    }
  ) => apiClient.patch(`/admin/hotels/${id}/inventory/bulk`, payload).then((r) => r.data),

  /** DELETE /admin/hotels/{id}/inventory/rate-override — query params, not a body */
  clearRateOverride: (id: number, room_category_id: number, date_from: string, date_to: string) =>
    apiClient
      .delete(`/admin/hotels/${id}/inventory/rate-override`, {
        params: { room_category_id, date_from, date_to },
      })
      .then((r) => r.data),

  // ---- Verification lifecycle ----

  /** POST /admin/hotels/{id}/submit — DRAFT → PENDING, gated on readiness */
  submit: (id: number) => apiClient.post(`/admin/hotels/${id}/submit`).then((r) => r.data),

  /** GET /admin/hotels/{id}/assignment */
  getAssignment: (id: number) =>
    apiClient.get<VerificationAssignment | null>(`/admin/hotels/${id}/assignment`).then((r) => r.data),

  /** POST /admin/hotels/{id}/assign-officer */
  assignOfficer: (id: number, officer_id: string, notes?: string) =>
    apiClient.post(`/admin/hotels/${id}/assign-officer`, { officer_id, notes }).then((r) => r.data),

  /** POST /admin/hotels/{id}/unassign-officer */
  unassignOfficer: (id: number) =>
    apiClient.post(`/admin/hotels/${id}/unassign-officer`).then((r) => r.data),

  /** PATCH /admin/hotels/{id}/review — → UNDER_REVIEW */
  moveToReview: (id: number) =>
    apiClient.patch(`/admin/hotels/${id}/review`).then((r) => r.data),

  /** PATCH /admin/hotels/{id}/document-pending */
  markDocumentPending: (id: number, remarks?: string) =>
    apiClient.patch(`/admin/hotels/${id}/document-pending`, { remarks }).then((r) => r.data),

  /**
   * PATCH /admin/hotels/{id}/approve
   * own_risk bypasses the officer check and requires a justification remark.
   */
  approve: (id: number, payload: { own_risk?: boolean; remarks?: string }) =>
    apiClient.patch(`/admin/hotels/${id}/approve`, payload).then((r) => r.data),

  /** PATCH /admin/hotels/{id}/reject */
  reject: (id: number, reason: string) =>
    apiClient.patch(`/admin/hotels/${id}/reject`, { reason }).then((r) => r.data),

  /** PATCH /admin/hotels/{id}/activate — APPROVED → ACTIVE, goes live */
  activate: (id: number) => apiClient.patch(`/admin/hotels/${id}/activate`).then((r) => r.data),

  /** PATCH /admin/hotels/{id}/deactivate */
  deactivate: (id: number, remarks?: string) =>
    apiClient.patch(`/admin/hotels/${id}/deactivate`, { remarks }).then((r) => r.data),

  /** PATCH /admin/hotels/{id}/suspend */
  suspend: (id: number, remarks?: string) =>
    apiClient.patch(`/admin/hotels/${id}/suspend`, { remarks }).then((r) => r.data),

  /** PATCH /admin/hotels/{id}/unsuspend — SUSPENDED → ACTIVE */
  unsuspend: (id: number) => apiClient.patch(`/admin/hotels/${id}/unsuspend`).then((r) => r.data),

  /** PATCH /admin/hotels/{id}/block — terminal */
  block: (id: number, remarks?: string) =>
    apiClient.patch(`/admin/hotels/${id}/block`, { remarks }).then((r) => r.data),

  /** GET /admin/hotels/{id}/logs — verification audit timeline, newest first */
  getLogs: (id: number, limit = 200) =>
    apiClient.get<HotelLog[]>(`/admin/hotels/${id}/logs`, { params: { limit } }).then((r) => r.data),

  /** GET /admin/hotels/commission-audit — platform-wide resolved commission */
  commissionAudit: (params: {
    source?: string;
    city_id?: number;
    search?: string;
    page?: number;
    page_size?: number;
  } = {}) =>
    apiClient
      .get<{
        items: Array<{
          hotel_id: number;
          hotel_code: string;
          hotel_name: string;
          status: string;
          city_id: number | null;
          city_name: string | null;
          partner_id: number | null;
          partner_name: string | null;
          partner_code: string | null;
          has_override: boolean;
          override_commission_type: string | null;
          override_commission_percent: number | null;
          override_commission_flat: number | null;
          resolved_source: string | null;
        }>;
        total: number;
        page: number;
        page_size: number;
      }>("/admin/hotels/commission-audit", { params })
      .then((r) => r.data),
};

export default hotelService;
