// ============================================================
// WAYTERO ADMIN — CANCELLATION SERVICE
// Doc Ref: BRD Part 3 §46/§47, BRD Part 4 §82
// Endpoints: /admin/cancellation
// ============================================================
import apiClient from "./api";

// ── Types ─────────────────────────────────────────────────────

export type CancellationSource = "CUSTOMER" | "PARTNER_REQUEST" | "ADMIN" | "SYSTEM";
export type CancellationTier =
  | "free_window"
  | "tier_1"
  | "tier_2"
  | "tier_3"
  | "same_day"
  | "last_minute"
  | "past_pickup"
  | "post_assignment"
  | "no_show"
  | "no_checkin_date";

export interface CabRefundPreview {
  cab_booking_id: number;
  charge: number;
  refund_amount: number;
  refund_percent: number;
  tier_label: CancellationTier | string;
  cab_total_amount: number;
  advance_paid_total: number;
  pickup_at: string | null;
  hours_to_pickup: number | null;
  is_post_assignment: boolean;
  policy_snapshot: Record<string, unknown>;
}

export interface HotelRefundPreview {
  hotel_reservation_id: number;
  charge: number;
  refund_amount: number;
  refund_percent: number;
  tier_label: CancellationTier | string;
  hotel_total_amount: number;
  advance_paid_total: number;
  check_in_date: string | null;
  hours_to_checkin: number | null;
  is_no_show: boolean;
  policy_snapshot: Record<string, unknown>;
}

export interface TourRefundPreview {
  tour_booking_id: number;
  charge: number;
  refund_amount: number;
  refund_percent: number;
  tier_label: CancellationTier | string;
  tour_total_amount: number;
  advance_paid_total: number;
  travel_start_date: string | null;
  days_to_travel: number | null;
  policy_snapshot: Record<string, unknown>;
}

export interface CabLadderEntry {
  value: string;
  description: string | null;
}

export interface CabLadder {
  [key: string]: CabLadderEntry;
}

export interface CabLadderHistoryItem {
  id: number;
  config_key: string;
  previous_value: string | null;
  new_value: string;
  changed_by_user_id: string | null;
  change_reason: string | null;
  created_at: string;
}

export interface PaginatedCabLadderHistory {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: CabLadderHistoryItem[];
}

export interface HotelPolicyRow {
  hotel_id: number;
  cancellation_free_hours: number | null;
  refund_percent_tier_1: number | null;
  cancellation_tier_2_hours: number | null;
  refund_percent_tier_2: number | null;
  cancellation_tier_3_hours: number | null;
  refund_percent_tier_3: number | null;
  refund_percent_same_day: number | null;
  no_show_refund_percent: number | null;
  cancellation_policy_text: string | null;
}

export interface TourPackagePolicy {
  id: number | null;
  tour_package_id: number;
  cancellation_free_days: number;
  cancellation_tier_1_days: number;
  refund_percent_tier_1: number;
  cancellation_tier_2_days: number;
  refund_percent_tier_2: number;
  refund_percent_tier_3: number;
  refund_percent_last_minute: number;
  cancellation_policy_text: string | null;
  updated_at: string | null;
  has_policy?: boolean;
}

export interface TourPackagePolicyInput {
  cancellation_free_days: number;
  cancellation_tier_1_days: number;
  refund_percent_tier_1: number;
  cancellation_tier_2_days: number;
  refund_percent_tier_2: number;
  refund_percent_tier_3: number;
  refund_percent_last_minute: number;
  cancellation_policy_text?: string | null;
}

export interface TourPackageLite {
  id: number;
  package_name: string;
  destination: string | null;
  duration_days: number;
  status: string;
}

export interface CancellationRequestItem {
  id: number;
  booking_type: "CAB" | "HOTEL" | "TOUR";
  master_booking_id: number | null;
  cab_booking_id: number | null;
  hotel_reservation_id: number | null;
  tour_booking_id: number | null;
  master_booking_number: string | null;
  cab_booking_number: string | null;
  hotel_reservation_number: string | null;
  tour_booking_number: string | null;
  requested_by_user_id: string;
  requested_at: string;
  requested_reason: string;
  requested_reason_code: string | null;
  refund_preview_json: Record<string, unknown> | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "AUTO_CLOSED";
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}

export interface PaginatedCancelRequests {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: CancellationRequestItem[];
}

export interface CancelRequestCounts {
  pending: number;
  approved: number;
  rejected: number;
  withdrawn: number;
  auto_closed: number;
  total: number;
}

export interface CancelResult {
  success: boolean;
  message: string;
  cab_booking_id?: number;
  hotel_reservation_id?: number;
  master_booking_id?: number;
  charge: number;
  refund_amount: number;
  advance_refunded_total?: number;
  refund_percent: number;
  tier_label: string;
  policy_snapshot: Record<string, unknown>;
  new_wallet_balance?: number;
  cancelled_source: CancellationSource;
  cancelled_by_role: string;
  cancellation_charge?: number;
  cabs_cancelled?: number;
  hotels_cancelled?: number;
}

// ── Service ───────────────────────────────────────────────────

const base = "/admin/cancellation";

export const cancellationService = {
  // Refund previews (read-only — no DB writes)
  previewCab: (cab_booking_id: number) =>
    apiClient.get<CabRefundPreview>(`${base}/cab/${cab_booking_id}/refund-preview`).then(r => r.data),

  previewHotel: (reservation_id: number, is_no_show = false) =>
    apiClient.get<HotelRefundPreview>(`${base}/hotel/${reservation_id}/refund-preview`, {
      params: is_no_show ? { is_no_show: true } : undefined,
    }).then(r => r.data),

  previewTour: (tour_booking_id: number) =>
    apiClient.get<TourRefundPreview>(`${base}/tour/${tour_booking_id}/refund-preview`).then(r => r.data),

  // Force-cancel (admin override — runs the engine, auto-refunds)
  cancelCab: (cab_booking_id: number, reason: string) =>
    apiClient.post<CancelResult>(`${base}/cab/${cab_booking_id}/cancel`, { reason }).then(r => r.data),

  cancelHotel: (reservation_id: number, reason: string) =>
    apiClient.post<CancelResult>(`${base}/hotel/${reservation_id}/cancel`, { reason }).then(r => r.data),

  cancelTour: (tour_booking_id: number, reason: string) =>
    apiClient.post<CancelResult>(`${base}/tour/${tour_booking_id}/cancel`, { reason }).then(r => r.data),

  // Cab ladder policy editor
  getCabLadder: () =>
    apiClient.get<CabLadder>(`${base}/policy/cab`).then(r => r.data),

  updateCabLadderKey: (config_key: string, new_value: string, change_reason?: string) =>
    apiClient.put<{
      success: boolean;
      message: string;
      config_key: string;
      previous_value: string | null;
      new_value: string;
    }>(`${base}/policy/cab/${config_key}`, { new_value, change_reason }).then(r => r.data),

  getCabLadderHistory: (params?: { config_key?: string; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedCabLadderHistory>(`${base}/policy/cab/history`, { params }).then(r => r.data),

  getHotelLadder: (hotel_id: number) =>
    apiClient.get<HotelPolicyRow>(`${base}/policy/hotel/${hotel_id}`).then(r => r.data),

  // Global tour ladder editor (BRD Part 5 §119)
  getTourLadder: () =>
    apiClient.get<CabLadder>(`${base}/policy/tour`).then(r => r.data),

  updateTourLadderKey: (config_key: string, new_value: string, change_reason?: string) =>
    apiClient.put<{
      success: boolean;
      message: string;
      config_key: string;
      previous_value: string | null;
      new_value: string;
    }>(`${base}/policy/tour/${config_key}`, { new_value, change_reason }).then(r => r.data),

  getTourLadderHistory: (params?: { config_key?: string; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedCabLadderHistory>(`${base}/policy/tour/history`, { params }).then(r => r.data),

  // Per-tour-package policy
  getTourPackagePolicy: (package_id: number) =>
    apiClient.get<TourPackagePolicy>(`${base}/policy/tour-package/${package_id}`).then(r => r.data),

  updateTourPackagePolicy: (package_id: number, payload: TourPackagePolicyInput) =>
    apiClient.put<{ success: boolean; message: string; tour_package_id: number }>(
      `${base}/policy/tour-package/${package_id}`,
      payload,
    ).then(r => r.data),

  // Partner cancellation-request inbox
  listRequests: (params?: { status?: string; booking_type?: string; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedCancelRequests>(`${base}/requests`, { params }).then(r => r.data),

  getRequestCounts: () =>
    apiClient.get<CancelRequestCounts>(`${base}/requests/counts`).then(r => r.data),

  reviewRequest: (request_id: number, decision: "APPROVED" | "REJECTED", note?: string) =>
    apiClient.post<CancelResult & { request_id: number; status: string }>(
      `${base}/requests/${request_id}/review`,
      { decision, note },
    ).then(r => r.data),
};
