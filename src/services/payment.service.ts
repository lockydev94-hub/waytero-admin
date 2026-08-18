// ============================================================
// WAYTERO ADMIN — PAYMENT SERVICE
// Base URL: /admin/payments
// Doc Ref: Payment API §6 (payment detail), §15 (refund),
//          DB Schema Part 7, Admin Payment API (payment_api.py)
// ============================================================
import apiClient from "./api";

// ── Stats ────────────────────────────────────────────────────

export interface PaymentStatusBreakdown {
  status: string;
  count: number;
}

export interface PaymentStats {
  total_advance_collected: number;
  today_advance_collected: number;
  total_active_advances: number;
  voided_advances: number;
  admin_held_advances: number;
  duplicate_advance_bookings: number;
  pending_refund_count: number;
  pending_refund_amount: number;
  booking_payment_status_breakdown: PaymentStatusBreakdown[];
}

// ── Payment List Item ─────────────────────────────────────────

export interface PaymentListItem {
  id: number;
  receipt_number: string;
  cab_booking_number: string;
  master_booking_number: string;
  master_booking_id: number;
  amount: number;
  payment_mode: string;
  received_by: string;
  reference_note: string | null;
  advance_status: string;
  refunded_amount: number;
  refundable_balance: number;
  collected_by_role: string;
  collected_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  booking_status: string;
  payment_status: string;
  total_amount: number;
  total_paid_amount: number;
  total_refund_amount: number;
  journey_start_date: string | null;
  customer_id: number;
  customer_name: string;
  customer_mobile: string;
  customer_email: string;
  refund_eligible: boolean;
  refund_block_reason: string | null;
}

export interface PaymentListResponse {
  items: PaymentListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ── Payment Detail ────────────────────────────────────────────

export interface AdvanceAuditRow {
  id: number;
  receipt_number: string;
  cab_booking_number: string;
  amount: number;
  payment_mode: string;
  received_by: string;
  status: string;
  refunded_amount: number;
  collected_by_role: string;
  collected_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
}

export interface BookingNote {
  text: string;
  type: string;
  author: string | null;
  created_at: string | null;
}

export interface PaymentDetail {
  id: number;
  receipt_number: string;
  cab_booking_number: string;
  master_booking_id: number;
  master_booking_number: string;
  amount: number;
  payment_mode: string;
  received_by: string;
  reference_note: string | null;
  advance_status: string;
  refunded_amount: number;
  refundable_balance: number;
  collected_by_role: string;
  collected_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  booking: {
    booking_status: string;
    payment_status: string;
    cab_status: string;
    trip_type: string | null;
    vehicle_category_name: string | null;
    pickup_location: string;
    drop_location: string;
    pickup_datetime: string | null;
    total_amount: number;
    total_paid_amount: number;
    total_refund_amount: number;
    journey_start_date: string | null;
    journey_end_date: string | null;
    remarks: string | null;
    created_at: string | null;
  };
  customer: {
    id: number;
    name: string;
    mobile: string;
    email: string;
  };
  all_advances_on_booking: AdvanceAuditRow[];
  recent_notes: BookingNote[];
  refund_eligible: boolean;
  refund_block_reason: string | null;
}

// ── Duplicates ────────────────────────────────────────────────

export interface IndexViolation {
  cab_booking_number: string;
  duplicate_count: number;
  total_amount: number;
  receipts: string[];
  first_collected_at: string | null;
}

export interface RapidRepeatCharge {
  id1: number;
  receipt1: string;
  id2: number;
  receipt2: string;
  cab_booking_number: string;
  amount: number;
  payment_mode: string;
  customer_name: string;
  customer_mobile: string;
  t1: string | null;
  t2: string | null;
  seconds_apart: number;
}

export interface DuplicateAnalysis {
  index_violations: IndexViolation[];
  rapid_repeat_charges: RapidRepeatCharge[];
  has_issues: boolean;
}

// ── Refund ────────────────────────────────────────────────────

export interface InitiateRefundPayload {
  advance_payment_id: number;
  reason: string;
  refund_amount?: number;
}

export interface RefundResult {
  receipt_number: string;
  refund_amount: number;
  advance_amount: number;
  advance_refunded_amount: number;
  advance_refundable_balance: number;
  is_partial: boolean;
  new_total_refund_amount: number;
}

// ── List Filters ──────────────────────────────────────────────

export interface PaymentListFilters {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
  received_by?: string;
  payment_mode?: string;
  start_date?: string;
  end_date?: string;
  booking_status?: string;
  payment_status?: string;
}

// ── Service ───────────────────────────────────────────────────

export const paymentService = {
  getStats: (): Promise<PaymentStats> =>
    apiClient
      .get<{ success: boolean; data: PaymentStats }>("/admin/payments/stats")
      .then((r) => r.data.data),

  list: (filters: PaymentListFilters = {}): Promise<PaymentListResponse> => {
    const params: Record<string, unknown> = {};
    if (filters.page)         params.page         = filters.page;
    if (filters.page_size)    params.page_size    = filters.page_size;
    if (filters.search)       params.search       = filters.search;
    if (filters.status)       params.status       = filters.status;
    if (filters.received_by)  params.received_by  = filters.received_by;
    if (filters.payment_mode) params.payment_mode = filters.payment_mode;
    if (filters.start_date)   params.start_date   = filters.start_date;
    if (filters.end_date)     params.end_date     = filters.end_date;
    if (filters.booking_status) params.booking_status = filters.booking_status;
    if (filters.payment_status) params.payment_status = filters.payment_status;
    return apiClient
      .get<{ success: boolean; data: PaymentListResponse }>("/admin/payments", { params })
      .then((r) => r.data.data);
  },

  getDetail: (advanceId: number): Promise<PaymentDetail> =>
    apiClient
      .get<{ success: boolean; data: PaymentDetail }>(`/admin/payments/${advanceId}`)
      .then((r) => r.data.data),

  getDuplicates: (): Promise<DuplicateAnalysis> =>
    apiClient
      .get<{ success: boolean; data: DuplicateAnalysis }>("/admin/payments/duplicates/list")
      .then((r) => r.data.data),

  initiateRefund: (
    payload: InitiateRefundPayload
  ): Promise<{ message: string; data: RefundResult }> =>
    apiClient
      .post<{ success: boolean; message: string; data: RefundResult }>(
        "/admin/payments/refund",
        payload
      )
      .then((r) => ({ message: r.data.message, data: r.data.data })),
};
