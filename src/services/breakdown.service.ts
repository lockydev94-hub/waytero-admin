// ============================================================
// WAYTERO ADMIN — CAB BREAKDOWN / SWAP SERVICE
// Base URL: /admin/cab-ops/breakdown + /admin/settlements/handover-reconciliation
// Doc Ref: Spec section "Cab Breakdown → Vehicle Swap (in-trip)"
// ============================================================

import apiClient from "./api";

// ── Reason catalogue ─────────────────────────────────────────────
export interface BreakdownReason {
  code: string;
  label: string;
}

export interface BreakdownReasonsResponse {
  items: BreakdownReason[];
}

// ── Active breakdowns (the dashboard list) ──────────────────────
export interface ActiveBreakdownItem {
  cab_booking_id: number;
  booking_number: string;
  master_booking_id: number;
  cab_status: "BREAKDOWN_REPORTED" | "AWAITING_SWAP";
  breakdown_reason: string | null;
  breakdown_reported_at: string | null;
  breakdown_reported_by: "DRIVER" | "PARTNER" | "ADMIN" | null;
  breakdown_latitude: number | null;
  breakdown_longitude: number | null;
  pre_swap_actual_km: number | null;
  swap_count: number;
  is_breakdown_swap: boolean;
  pickup_location: string | null;
  drop_location: string | null;
  estimated_amount: number | null;
  customer_name: string | null;
  customer_mobile: string | null;
  city_id: number | null;
  city_name: string | null;
  original_partner_id: number | null;
  original_partner_name: string | null;
  active_partner_id: number | null;
  active_partner_name: string | null;
  active_driver_id: number | null;
  active_driver_name: string | null;
  active_driver_mobile: string | null;
  active_vehicle_id: number | null;
  active_vehicle_number: string | null;
  acceptance_deadline: string | null;
  last_swap_at: string | null;
}

export interface ActiveBreakdownsResponse {
  items: ActiveBreakdownItem[];
  total: number;
}

// ── Available vehicles for swap ──────────────────────────────────
export interface AvailableVehicle {
  vehicle_id: number;
  registration_number: string;
  make: string | null;
  model: string | null;
  color: string | null;
  vehicle_category_id: number | null;
  vehicle_category_name: string | null;
  partner_id: number;
  partner_name: string;
  driver_id: number | null;
  driver_name: string | null;
  driver_mobile: string | null;
  seats: number | null;
}

export interface AvailableVehiclesResponse {
  same_partner: AvailableVehicle[];
  other_partners: AvailableVehicle[];
}

// ── Available partners for handover ──────────────────────────────
export interface AvailablePartner {
  partner_id: number;
  business_name: string;
  partner_code: string | null;
  mobile: string | null;
  free_vehicle_count: number;
  city_id: number | null;
  city_name: string | null;
}

export interface AvailablePartnersResponse {
  items: AvailablePartner[];
}

// ── Request payloads ─────────────────────────────────────────────
export interface ReportBreakdownRequest {
  reason_code: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
}

export interface SwapSamePartnerRequest {
  new_vehicle_id: number;
  new_driver_id: number;
  notes?: string | null;
}

export interface HandoverRequest {
  new_partner_id: number;
  acceptance_deadline_minutes?: number | null;
  notes?: string | null;
}

// ── Handover reconciliation report ───────────────────────────────
export interface HandoverReconciliationItem {
  cab_booking_id: number;
  booking_number: string;
  cab_status: string;
  original_partner_id: number;
  original_partner_name: string;
  original_partner_mobile: string | null;
  swap_count: number;
  last_swap_at: string | null;
  outstanding_cash: number;
  outstanding_advance: number;
  voided_on_handover_advance: number;
  total_outstanding: number;
  active_partner_side_advance_receipts: string[];
}

export const breakdownService = {
  /** GET /admin/cab-ops/breakdown/reasons */
  listReasons: () =>
    apiClient.get<BreakdownReasonsResponse>("/admin/cab-ops/breakdown/reasons").then((r) => r.data),

  /** GET /admin/cab-ops/breakdown/active */
  listActive: (params: { city_id?: number; limit?: number } = {}) =>
    apiClient
      .get<ActiveBreakdownsResponse>("/admin/cab-ops/breakdown/active", { params })
      .then((r) => r.data),

  /** GET /admin/cab-ops/breakdown/{cab_id}/available-vehicles */
  listAvailableVehicles: (cab_booking_id: number) =>
    apiClient
      .get<AvailableVehiclesResponse>(
        `/admin/cab-ops/breakdown/${cab_booking_id}/available-vehicles`,
      )
      .then((r) => r.data),

  /** GET /admin/cab-ops/breakdown/{cab_id}/available-partners */
  listAvailablePartners: (cab_booking_id: number) =>
    apiClient
      .get<AvailablePartnersResponse>(
        `/admin/cab-ops/breakdown/${cab_booking_id}/available-partners`,
      )
      .then((r) => r.data),

  /** POST /admin/cab-ops/breakdown/{cab_id}/report */
  report: (cab_booking_id: number, payload: ReportBreakdownRequest) =>
    apiClient
      .post(`/admin/cab-ops/breakdown/${cab_booking_id}/report`, payload)
      .then((r) => r.data),

  /** POST /admin/cab-ops/breakdown/{cab_id}/swap-same-partner */
  swapSamePartner: (cab_booking_id: number, payload: SwapSamePartnerRequest) =>
    apiClient
      .post(`/admin/cab-ops/breakdown/${cab_booking_id}/swap-same-partner`, payload)
      .then((r) => r.data),

  /** POST /admin/cab-ops/breakdown/{cab_id}/handover */
  handover: (cab_booking_id: number, payload: HandoverRequest) =>
    apiClient
      .post(`/admin/cab-ops/breakdown/${cab_booking_id}/handover`, payload)
      .then((r) => r.data),

  /** GET /admin/settlements/handover-reconciliation */
  listHandoverReconciliation: (params: { partner_id?: number; limit?: number } = {}) =>
    apiClient
      .get("/admin/settlements/handover-reconciliation", { params })
      .then((r) => r.data),
};

export default breakdownService;
