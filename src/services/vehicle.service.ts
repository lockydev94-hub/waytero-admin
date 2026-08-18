// ============================================================
// WAYTERO ADMIN — VEHICLE SERVICE
// Doc Ref: Vehicle API §3-24 | Admin API §10 | DB Schema Part 3 §12-18
// Backend routes: /admin/vehicles/* (dashboard router)
// ============================================================
import apiClient from "./api";

// ── Types ────────────────────────────────────────────────────

export interface AdminVehicleListItem {
  id: number;
  vehicle_code: string | null;
  registration_number: string | null;
  make: string | null;
  model: string | null;
  vehicle_category_id: number | null;
  vehicle_category: string | null;   // category name — joined by backend
  status: string;
  partner_id: number | null;
  partner_name: string | null;       // owner_name — joined by backend
  city_id?: number | null;
  created_at: string;
}

export interface AdminVehiclePage {
  items: AdminVehicleListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface PricingRule {
  trip_type: string;
  base_fare: number;
  per_km_rate: number;
  minimum_km: number | null;
  driver_allowance: number;
  driver_allowance_type: string;
  night_charge: number;
}

export interface PricingStructure {
  source: "city" | "default";
  rules: PricingRule[];
}

export interface VehicleDocumentDetail {
  id: number;
  document_type: string;
  file_url: string | null;
  expiry_date: string | null;
  verification_status: string;
  uploaded_at: string;
  verified_at: string | null;
  remarks: string | null;
}

export interface VehiclePhotoDetail {
  id: number;
  photo_type: string;
  file_url: string;
  caption: string | null;
  verification_status: string;
  uploaded_at: string;
}

export interface VehicleDetail {
  id: number;
  uuid: string;
  vehicle_code: string | null;
  registration_number: string;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  manufacturing_year: number | null;
  fuel_type: string | null;
  seating_capacity: number | null;
  city_id: number;
  status: string;
  vehicle_category: string | null;
  vehicle_category_id: number;
  verification_remarks: string | null;
  assigned_officer: { id: string; full_name: string; mobile: string } | null;
  created_at: string;
  updated_at: string;
  partner: {
    id: number;
    owner_name: string;
    business_name: string | null;
    mobile: string | null;
    city_id: number | null;
  };
  documents: VehicleDocumentDetail[];
  photos: VehiclePhotoDetail[];
  pricing_structure: PricingStructure;
  commission_group: { id: number; group_name: string; description: string | null } | null;
}

export interface RegisterVehiclePayload {
  partner_id: number;
  vehicle_category_id: number;
  registration_number: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  manufacturing_year?: number;
  fuel_type?: string;
  seating_capacity?: number;
  city_id: number;
  color?: string;
}

export const VEHICLE_STATUSES = [
  "PENDING", "UNDER_REVIEW", "APPROVED", "ACTIVE",
  "ON_TRIP", "MAINTENANCE", "INACTIVE", "SUSPENDED",
] as const;

export type VehicleStatus = typeof VEHICLE_STATUSES[number];

export const VEHICLE_STATUS_META: Record<string, { label: string; color: "default" | "warning" | "info" | "success" | "error" | "primary" | "secondary" }> = {
  PENDING:      { label: "Pending",      color: "default" },
  UNDER_REVIEW: { label: "Under Review", color: "warning" },
  APPROVED:     { label: "Approved",     color: "info" },
  ACTIVE:       { label: "Active",       color: "success" },
  ON_TRIP:      { label: "On Trip",      color: "primary" },
  MAINTENANCE:  { label: "Maintenance",  color: "warning" },
  INACTIVE:     { label: "Inactive",     color: "default" },
  SUSPENDED:    { label: "Suspended",    color: "error" },
};

export const DOCUMENT_TYPES = ["RC", "INSURANCE", "FITNESS_CERTIFICATE", "PERMIT", "PUC"] as const;
export const PHOTO_TYPES = ["FRONT", "BACK", "LEFT", "RIGHT", "INTERIOR", "ODOMETER", "ENGINE", "OTHER"] as const;
export const FUEL_TYPES = ["PETROL", "DIESEL", "CNG", "ELECTRIC", "HYBRID"] as const;

export const TRIP_TYPE_LABELS: Record<string, string> = {
  LOCAL: "Local",
  AIRPORT: "Airport Transfer",
  OUTSTATION: "Outstation",
  ONE_WAY: "One Way",
  ROUND_TRIP: "Round Trip",
};

// ── Status transition map ─────────────────────────────────────
export const V_TRANSITIONS: Record<string, string[]> = {
  PENDING:      ["UNDER_REVIEW", "SUSPENDED"],
  UNDER_REVIEW: ["APPROVED", "PENDING", "SUSPENDED"],
  APPROVED:     ["ACTIVE", "SUSPENDED"],
  ACTIVE:       ["MAINTENANCE", "SUSPENDED", "INACTIVE"],
  MAINTENANCE:  ["ACTIVE", "SUSPENDED"],
  INACTIVE:     ["ACTIVE", "SUSPENDED"],
  SUSPENDED:    ["ACTIVE", "PENDING"],
};

// ── Partner with CAB type ─────────────────────────────────────
export interface PartnerWithCab {
  id: number;
  owner_name: string;
  business_name: string | null;
  mobile: string | null;
  partner_code: string;
  city_id: number | null;
  status: string;
  has_cab: boolean;           // true if CAB service is active
  active_services: string;   // comma-separated active services e.g. "CAB,HOTEL,TOUR"
}

export interface PartnerWithCabPage {
  items: PartnerWithCab[];
  total: number;
  page: number;
  page_size: number;
}

// ── Service ───────────────────────────────────────────────────
export const vehicleService = {
  /** GET /admin/vehicles/partners-with-cab — partners eligible for vehicle registration */
  listPartnersWithCab: (search?: string, page = 1, page_size = 20) =>
    apiClient.get<PartnerWithCabPage>("/admin/vehicles/partners-with-cab", {
      params: { search: search || undefined, page, page_size },
    }).then((r) => r.data),

  /** GET /admin/vehicles — list with filters */
  listVehicles: (params: Record<string, unknown> = {}) =>
    apiClient.get<AdminVehiclePage>("/admin/vehicles", { params }).then((r) => r.data),

  /** GET /admin/vehicles/{id}/detail — full vehicle detail */
  getVehicleDetail: (id: number) =>
    apiClient.get<VehicleDetail>(`/admin/vehicles/${id}/detail`).then((r) => r.data),

  /** POST /admin/vehicles/register — admin register vehicle for partner */
  registerVehicle: (payload: RegisterVehiclePayload) =>
    apiClient.post("/admin/vehicles/register", payload).then((r) => r.data),

  /** GET /admin/vehicles/pricing-preview — preview pricing for city+category */
  getPricingPreview: (city_id: number, vehicle_category_id: number) =>
    apiClient.get<PricingStructure>("/admin/vehicles/pricing-preview", {
      params: { city_id, vehicle_category_id },
    }).then((r) => r.data),

  /** PATCH /admin/vehicles/{id}/status — status transition */
  changeStatus: (id: number, status: string, remarks?: string) =>
    apiClient.patch(`/admin/vehicles/${id}/status`, { status, remarks }).then((r) => r.data),

  /** POST /admin/vehicles/{id}/assign-officer */
  assignOfficer: (id: number, officer_user_id: string) =>
    apiClient.post(`/admin/vehicles/${id}/assign-officer`, { officer_user_id }).then((r) => r.data),

  /** POST /admin/vehicles/{id}/documents */
  uploadDocument: (id: number, payload: { document_type: string; file_url: string; expiry_date?: string }) =>
    apiClient.post(`/admin/vehicles/${id}/documents`, payload).then((r) => r.data),

  /** PATCH /admin/vehicles/{id}/documents/{doc_id}/verify */
  verifyDocument: (id: number, doc_id: number, payload: { verification_status: string; remarks?: string }) =>
    apiClient.patch(`/admin/vehicles/${id}/documents/${doc_id}/verify`, payload).then((r) => r.data),

  /** POST /admin/vehicles/{id}/photos */
  uploadPhoto: (id: number, payload: { photo_type: string; file_url: string; caption?: string }) =>
    apiClient.post(`/admin/vehicles/${id}/photos`, payload).then((r) => r.data),

  /** PATCH /admin/vehicles/{id}/photos/{photo_id}/verify */
  verifyPhoto: (id: number, photo_id: number, payload: { verification_status: string; remarks?: string }) =>
    apiClient.patch(`/admin/vehicles/${id}/photos/${photo_id}/verify`, payload).then((r) => r.data),
};
