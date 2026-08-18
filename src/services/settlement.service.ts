// ============================================================
// WAYTERO ADMIN — SETTLEMENT SERVICE
// Base URL: /admin/settlements
// ============================================================
import apiClient from "./api";

export interface SettlementPosition {
  advance_paid: number;
  advance_received_by: string | null;
  advance_held_by_partner: number;
  balance_due: number;
  balance_held_by_partner: number;
  partner_held: number;
  coupon_discount: number;
  partner_payout: number;
  net_settlement: number;
  wallet_direction: "CREDIT" | "DEBIT" | "NONE";
}

export interface SettlementItem {
  booking_number: string;
  cab_booking_number: string;
  cab_status: string;
  customer_name: string | null;
  customer_mobile: string | null;
  pickup_location: string | null;
  drop_location: string | null;
  actual_distance: number | null;
  trip_type: string | null;
  invoice_number: string | null;
  invoice_url: string | null;
  // Payment
  final_amount: number;
  coupon_discount: number;
  advance_paid: number;
  balance_due: number;
  payment_mode: string | null;
  payment_collected_by: string | null;
  cash_pending_at: string;
  // Settlement
  platform_commission: number | null;
  partner_payout: number | null;
  partner_id: number | null;
  partner_name: string | null;
  partner_mobile: string | null;
  partner_wallet_balance: number | null;
  coupon_disbursement: {
    id: number;
    amount: number;
    status: string;
  } | null;
  position: SettlementPosition | null;
  is_settled: boolean;
}

export interface SettlementListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  status_filter: string;
  items: SettlementItem[];
}

// ── Hotel settlement ──────────────────────────────────────────
// Position mirrors _compute_hotel_position(): every payment (advance, top-up,
// final balance) is a HotelAdvancePayment row carrying its own custody, so
// there is no separate balance-held branch like the cab side.
export interface HotelSettlementPosition {
  grand_total: number;
  total_paid: number;
  advance_paid: number;
  partner_held: number;
  platform_held: number;
  balance_due: number;
  coupon_discount: number;
  partner_payout: number;
  tds_deducted: number;
  net_settlement: number;
  wallet_direction: "CREDIT" | "DEBIT" | "NONE";
}

export interface HotelSettlementItem {
  service_type: "HOTEL";
  // Step 1: Booking
  booking_number: string;
  reservation_number: string | null;
  hotel_status: string;
  hotel_name: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  nights: number | null;
  rooms: number | null;
  invoice_number: string | null;
  invoice_url: string | null;
  // Step 2: Payment
  taxable_amount: number;
  gst_amount: number;
  grand_total: number;
  coupon_discount: number;
  advance_paid: number;
  balance_due: number;
  payment_mode: string | null;
  payment_collected_by: string | null;
  payment_collected_status: string | null;
  // Step 3: Settlement
  platform_commission: number | null;
  partner_payout: number | null;
  tds_deducted: number;
  tds_rate_pct: number;
  position: HotelSettlementPosition | null;
  partner_id: number | null;
  partner_name: string | null;
  partner_mobile: string | null;
  partner_wallet_balance: number | null;
  coupon_disbursement: {
    id: number;
    amount: number;
    status: string;
  } | null;
  is_settled: boolean;
}

export interface HotelSettlementListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  status_filter: string;
  items: HotelSettlementItem[];
}

export interface TourSettlementPosition {
  grand_total: number;
  total_paid: number;
  advance_paid: number;
  partner_held: number;
  platform_held: number;
  balance_due: number;
  partner_payout: number;
  net_settlement: number;
  wallet_direction: "CREDIT" | "DEBIT" | "NONE";
}

export interface TourSettlementItem {
  service_type: "TOUR";
  // Step 1: Booking
  booking_number: string | null;
  tour_booking_number: string;
  tour_status: string;
  package_name: string | null;
  destination: string | null;
  duration_days: number | null;
  duration_nights: number | null;
  travel_start_date: string | null;
  travel_end_date: string | null;
  persons_count: number;
  customer_name: string | null;
  customer_mobile: string | null;
  invoice_number: string | null;
  // Step 2: Payment
  total_amount: number;
  additional_amount: number;
  advance_paid: number;
  balance_due: number;
  advance_received_by: string | null;
  advances: Array<{
    id: number;
    receipt_number: string;
    amount: number;
    payment_mode: string;
    received_by: string;
    collected_by_role: string | null;
    collected_at: string | null;
  }>;
  // Step 3: Settlement
  platform_commission: number | null;
  partner_payout: number | null;
  position: TourSettlementPosition | null;
  partner_id: number | null;
  partner_name: string | null;
  partner_mobile: string | null;
  partner_wallet_balance: number | null;
  is_settled: boolean;
}

export interface TourSettlementListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  status_filter: string;
  items: TourSettlementItem[];
}

export interface CouponDisbursementItem {
  id: number;
  cab_booking_id: number | null;
  hotel_reservation_id: number | null;
  service_type: "CAB" | "HOTEL";
  booking_number: string | null;
  invoice_number: string | null;
  partner_id: number | null;
  partner_name: string | null;
  partner_mobile: string | null;
  coupon_discount_amount: number;
  partner_wallet_balance: number;
  status: string;
  disbursed_at: string | null;
  created_at: string | null;
}

export interface CouponDisbursementListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: CouponDisbursementItem[];
}

const base = "/admin/settlements";

export const settlementService = {
  // List settlements (PENDING | SETTLED | ALL)
  list: (status_filter = "PENDING", page = 1, page_size = 20): Promise<SettlementListResponse> =>
    apiClient.get(`${base}/list`, { params: { status_filter, page, page_size } }).then(r => r.data),

  // Get single booking detail for modal
  getBooking: (booking_number: string): Promise<SettlementItem> =>
    apiClient.get(`${base}/booking`, { params: { booking_number } }).then(r => r.data),

  // Settle a booking
  settle: (booking_number: string) =>
    apiClient.post(`${base}/settle`, { booking_number }).then(r => r.data),

  // ── Hotel settlements (same net-position arithmetic as cab) ──
  listHotel: (status_filter = "PENDING", page = 1, page_size = 20): Promise<HotelSettlementListResponse> =>
    apiClient.get(`${base}/hotel/list`, { params: { status_filter, page, page_size } }).then(r => r.data),

  getHotelBooking: (reservation_number: string): Promise<HotelSettlementItem> =>
    apiClient.get(`${base}/hotel/booking`, { params: { reservation_number } }).then(r => r.data),

  settleHotel: (reservation_number: string) =>
    apiClient.post(`${base}/hotel/settle`, { reservation_number }).then(r => r.data),

  // ── Tour settlements (same net-position arithmetic as cab/hotel) ──
  listTour: (status_filter = "PENDING", page = 1, page_size = 20): Promise<TourSettlementListResponse> =>
    apiClient.get(`${base}/tour/list`, { params: { status_filter, page, page_size } }).then(r => r.data),

  getTourBooking: (booking_number: string): Promise<TourSettlementItem> =>
    apiClient.get(`${base}/tour/booking`, { params: { booking_number } }).then(r => r.data),

  settleTour: (booking_number: string) =>
    apiClient.post(`${base}/tour/settle`, { booking_number }).then(r => r.data),

  // List coupon disbursements
  listCouponDisbursements: (status_filter = "PENDING", page = 1, page_size = 20): Promise<CouponDisbursementListResponse> =>
    apiClient.get(`${base}/coupon-disbursements`, { params: { status_filter, page, page_size } }).then(r => r.data),

  // Disburse coupon to partner wallet
  disburseCoupon: (disbursement_id: number) =>
    apiClient.post(`${base}/disburse-coupon`, { disbursement_id }).then(r => r.data),
};
