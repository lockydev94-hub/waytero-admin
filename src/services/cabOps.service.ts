// ============================================================
// WAYTERO ADMIN — CAB OPERATIONS SERVICE
// Base URL: /admin/cab-ops
// Doc Ref:
//   BRD Part 3 §40 — Auto Assignment Engine (queue view)
//   BRD Part 3 §44 — Live Trip Tracking (in-trip view)
//   BRD Part 7 §155 — Realtime + push channel (SOS/escalation feed)
// ============================================================

import apiClient from "./api";

export interface CabOpsQueueItem {
  cab_booking_id: number;
  booking_number: string;
  master_booking_id: number;
  pickup_location: string | null;
  drop_location: string | null;
  pickup_datetime: string | null;
  trip_type: string | null;
  estimated_amount: number | null;
  cab_status: string;
  pending_partner_id: number | null;
  pending_partner_name: string | null;
  pending_partner_code: string | null;
  acceptance_deadline: string | null;
  seconds_to_deadline: number | null;
  customer_name: string | null;
  customer_mobile: string | null;
  city_id: number | null;
  city_name: string | null;
  vehicle_category_id: number | null;
  vehicle_category_label: string | null;
  created_at: string;
}

export interface CabOpsInTripItem {
  cab_booking_id: number;
  booking_number: string;
  master_booking_id: number;
  cab_status: string;
  pickup_location: string | null;
  drop_location: string | null;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  trip_started_at: string | null;
  trip_ended_at: string | null;
  payment_mode: string | null;
  payment_collected_by: string | null;
  final_amount: number | null;
  customer_name: string | null;
  customer_mobile: string | null;
  driver_id: number | null;
  driver_name: string | null;
  driver_mobile: string | null;
  vehicle_id: number | null;
  vehicle_number: string | null;
  partner_id: number | null;
  partner_name: string | null;
  city_id: number | null;
  city_name: string | null;
}

export interface CabOpsSosAlert {
  cab_booking_id: number;
  booking_number: string;
  master_booking_id: number;
  cab_status: string;
  raised_at: string;
  flag: string;
  note: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  driver_id: number | null;
  driver_name: string | null;
  driver_mobile: string | null;
  partner_id: number | null;
  partner_name: string | null;
}

export interface CabOpsListResponse<T> {
  items: T[];
  total: number;
}

export const cabOpsService = {
  /** GET /admin/cab-ops/queue — bookings waiting on a partner to accept */
  listQueue: (params: { city_id?: number; partner_id?: number; limit?: number } = {}) =>
    apiClient
      .get<CabOpsListResponse<CabOpsQueueItem>>("/admin/cab-ops/queue", { params })
      .then((r) => r.data),

  /** GET /admin/cab-ops/in-trip — DRIVER_ASSIGNED + STARTED trips */
  listInTrip: (params: { city_id?: number; status?: "DRIVER_ASSIGNED" | "STARTED"; limit?: number } = {}) =>
    apiClient
      .get<CabOpsListResponse<CabOpsInTripItem>>("/admin/cab-ops/in-trip", { params })
      .then((r) => r.data),

  /** GET /admin/cab-ops/sos-alerts — open SOS / escalation flags */
  listSosAlerts: (limit = 50) =>
    apiClient
      .get<CabOpsListResponse<CabOpsSosAlert>>("/admin/cab-ops/sos-alerts", { params: { limit } })
      .then((r) => r.data),

  /** POST /admin/cab-ops/queue/{cab_booking_id}/reassign — manual lever */
  reassign: (cab_booking_id: number, remarks?: string) =>
    apiClient
      .post(`/admin/cab-ops/queue/${cab_booking_id}/reassign`, { remarks })
      .then((r) => r.data),
};

export default cabOpsService;
