// ============================================================
// WAYTERO ADMIN — BOOKING SERVICE
// Doc Ref: Admin Booking API (booking_api.py)
// Endpoints: /admin/bookings
// ============================================================
import apiClient from "./api";

// ── Types ─────────────────────────────────────────────────────

export interface CabBookingOut {
  id: number;
  booking_number: string;
  trip_type: string | null;
  vehicle_category_id: number | null;
  vehicle_category_name: string | null;
  pickup_location: string | null;
  drop_location: string | null;
  pickup_datetime: string | null;
  estimated_distance: number | null;
  estimated_amount: number | null;
  final_amount: number | null;
  booking_status: string;
  assigned_partner_id: number | null;
  assigned_partner_name: string | null;
  assigned_driver_id: number | null;
  assigned_driver_name: string | null;
  assigned_driver_mobile: string | null;
  assigned_vehicle_id: number | null;
  assigned_vehicle_reg: string | null;
  // ── Partner acceptance gate (Doc Ref: BRD Part 3 §42) ──
  /** Latest assignment row's assigned_at; null if no partner assigned yet. */
  assigned_at: string | null;
  /** ISO timestamp by which the partner must accept; null if not in pending state. */
  acceptance_deadline: string | null;
  /** Derived: PENDING | ACCEPTED | REJECTED | TIMEOUT — sourced from latest assignment. */
  acceptance_status: "PENDING" | "ACCEPTED" | "REJECTED" | "TIMEOUT" | null;
  /** ISO timestamp when the partner responded (accept/reject), if any. */
  partner_responded_at: string | null;
  /** ID of the partner currently in the acceptance window (denormalised from cab). */
  pending_partner_id: number | null;
  // ── Invoice / payment (Doc Ref: admin_download_cab_invoice) ──
  /** Formatted tax-invoice number, set when payment is recorded. Drives the
   *  "Download Invoice (PDF)" button on CabBookingDetailPage. */
  invoice_number: string | null;
  /** How the customer paid — UPI / CASH / WALLET / ONLINE. Required before
   *  the invoice can be downloaded. */
  payment_mode: string | null;
}

export interface PendingAcceptanceItem {
  cab_booking_id: number;
  cab_booking_number: string;
  master_booking_id: number;
  master_booking_number: string;
  pickup_location: string | null;
  pickup_datetime: string | null;
  assigned_at: string;
  acceptance_deadline: string;
  seconds_remaining: number;
  assignment_id: number;
  partner_id: number;
  assigned_partner_name: string | null;
  city_id: number;
  city_name: string | null;
  trip_type: string | null;
  vehicle_category_name: string | null;
}

export interface PendingAcceptanceResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: PendingAcceptanceItem[];
  acceptance_timeout_minutes: number;
}

export interface BookingListItem {
  id: number;
  booking_number: string;
  customer_id: number;
  customer_name: string | null;
  customer_mobile: string | null;
  city_id: number;
  city_name: string | null;
  booking_status: string;
  payment_status: string;
  total_amount: number;
  total_paid_amount: number;
  journey_start_date: string | null;
  journey_end_date: string | null;
  services: string[];
  cab_status: string | null;
  hotel_status: string | null;
  tour_status: string | null;
  created_at: string;
}

export interface BookingDetail {
  id: number;
  booking_number: string;
  customer_id: number;
  customer_name: string | null;
  customer_mobile: string | null;
  customer_email: string | null;
  city_id: number;
  city_name: string | null;
  booking_status: string;
  payment_status: string;
  total_amount: number;
  total_paid_amount: number;
  total_refund_amount: number;
  journey_start_date: string | null;
  journey_end_date: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  services: string[];
  cab_bookings: CabBookingOut[];
  hotel_bookings: HotelBookingOut[];
  tour_bookings: TourBookingOut[];
  timeline: TimelineEntry[];
}

export interface TourBookingOut {
  id: number;
  booking_number: string;
  package_id: number;
  package_name: string;
  destination: string;
  travel_start_date: string | null;
  travel_end_date: string | null;
  persons_count: number;
  total_amount: number;
  platform_commission: number;
  partner_payout: number;
  payment_status: string;
  booking_status: string;
  special_requests: string | null;
}

export interface HotelAdvancePayment {
  id: number;
  receipt_number: string;
  amount: number;
  refunded_amount: number;
  payment_mode: "UPI" | "ONLINE" | "WALLET" | "CASH";
  received_by: "ADMIN" | "PARTNER";
  reference_number: string | null;
  notes: string | null;
  collected_at: string | null;
}

// ── Check-out preview (GET .../checkout-preview) ──────────────
export interface HotelOvertime {
  is_overtime: boolean;
  scheduled_checkout_at: string | null;
  actual_checkout_at: string | null;
  overtime_hours: number;
  raw_hours: number;
  grace_minutes: number;
  mode: "SLAB" | "HOURLY";
  slab: "HALF_DAY" | "FULL_DAY" | null;
  percent_applied: number;
  nightly_rate: number;
  charge: number;
  reason: string;
}

export interface HotelBillLine {
  label: string;
  amount: number;
  kind: "CHARGE" | "DISCOUNT" | "TAX" | "PAYMENT";
  detail: string | null;
}

export interface HotelBill {
  room_charge: number;
  room_tariff?: number;                       // room_charge less occupancy surcharge
  occupancy?: Record<string, number> | null;  // frozen extra adult/child/bed breakdown
  overtime: HotelOvertime;
  extra_charges: number;
  discount: number;
  taxable_amount: number;
  gst_percent: number;
  gst_amount: number;
  is_tax_invoice: boolean;
  gst_enabled: boolean;
  tax_source: string;
  grand_total: number;
  advance_paid: number;
  balance_due: number;
  refund_due: number;
  lines: HotelBillLine[];
  advances: HotelAdvancePayment[];
}

export interface HotelCheckoutPreview {
  success: boolean;
  hotel_status: string;
  booking_number: string;
  nights: number | null;
  rooms: number | null;
  check_in_date: string | null;
  check_out_date: string | null;
  actual_check_in_at: string | null;
  bill: HotelBill;
}

export interface HotelBookingOut {
  id: number;
  booking_number: string;
  hotel_id: number | null;
  hotel_name: string | null;
  hotel_address: string | null;
  room_category_name: string | null;
  room_category_id: number | null;
  room_type: string | null;
  meal_plan: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  num_nights: number | null;
  num_rooms: number | null;
  num_guests: number | null;
  adults_count: number | null;
  children_count: number | null;
  extra_beds: number | null;
  special_requests: string | null;
  base_amount: number | null;
  taxes_amount: number | null;
  additional_charges: number | null;
  final_amount: number | null;
  actual_check_in_at: string | null;
  actual_check_out_at: string | null;
  check_in_id_proof: string | null;
  booking_status: string;
  hotel_confirmation_number: string | null;
  voucher_url: string | null;
  cancellation_reason: string | null;
  cancellation_charge: number | null;
  refund_amount: number | null;
  allocated_rooms: string | null;   // JSON list of room numbers e.g. '["101","102"]'
  // ── Billing / custody (migration 0035) ──
  coupon_code?: string | null;
  coupon_discount?: number | null;
  overtime_hours?: number | null;
  overtime_charge?: number | null;
  invoice_number?: string | null;
  invoice_url?: string | null;
  payment_collected_status?: "PENDING" | "PARTIAL" | "PAID" | null;
  payment_mode?: string | null;
  payment_collected_by?: "ADMIN" | "PARTNER" | null;
  advance_payments?: HotelAdvancePayment[];
  total_advance_paid?: number | null;
  balance_due?: number | null;
  // ── Occupancy breakdown (frozen at booking time) ──
  room_tariff?: number | null;                 // base_amount less extra-person/bed surcharge
  occupancy?: Record<string, number> | null;   // extra adult/child/bed counts, unit charges & bases
}

export interface TimelineEntry {
  id: number;
  event_type: string;
  event_description: string;
  event_timestamp: string;
}

export interface PaginatedBookings {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: BookingListItem[];
}

export interface BookingStats {
  total: number;
  pending_assignment: number;
  confirmed: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  today_bookings: number;
}

export interface AssignablePartner {
  id: number;
  name: string;
  owner_name: string;
  mobile: string;
  city_id: number;
  partner_type: string;
  has_cab_service: boolean;
  total_vehicles: number;
  free_vehicles: number;
}
export interface AssignableDriver {
  id: number; name: string; mobile: string; license_number: string;
  license_expiry_date: string | null; joining_date: string | null;
  availability_status: string; is_busy: boolean;
}
export interface PartnerDetail {
  id: number; name: string; owner_name: string; mobile: string; email: string | null;
  partner_code: string; city_id: number; city_name: string | null; status: string;
}
export interface AssignableVehicle {
  id: number;
  registration_number: string;
  vehicle_category_id: number;
  vehicle_category_name: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  fuel_type: string | null;
  seating_capacity: number | null;
  make: string | null;
  model: string | null;
  manufacturing_year: number | null;
  is_busy: boolean;
}
export interface VehicleCategoryOption { id: number; category_name: string; seating_capacity: number | null; is_active: boolean }
export interface BookingNote { id: number; note: string; created_at: string }

// ── Hotel switch / split-stay (Doc Ref: Hotel Switch Spec; Migration 0042) ──

/** Audit row for one switch or split. Returned by /admin/bookings/hotel/switch-events. */
export interface HotelSwitchEvent {
  id: number;
  split_type: "PRE_CHECKIN_SWITCH" | "POST_CHECKIN_SPLIT";
  original_reservation_id: number;
  original_reservation_number: string;
  original_hotel_id: number;
  new_reservation_id: number;
  new_reservation_number: string;
  new_hotel_id: number;
  nights_transferred: number;
  original_nights_consumed: number;
  original_final_amount: number;
  new_total_amount: number;
  refund_issued: number;
  advance_redistributed: number;
  advance_split_strategy: "ROLLOVER" | "NONE";
  notes: string | null;
  created_at: string;
}

/** Read-only preview payload returned by /admin/bookings/hotel/{id}/switch/quote. */
export interface HotelSwitchQuote {
  original_reservation_id: number;
  original_reservation_number: string;
  original_status: string;
  nights_total: number;
  nights_consumed: number;
  nights_remaining: number;
  nights_transferred: number;
  target_quote: {
    hotel_id: number;
    hotel_name: string;
    room_category_id: number;
    check_in_date: string;
    check_out_date: string;
    nights: number;
    rooms_count: number;
    base_amount: number;
    taxable_amount: number;
    gst_amount: number;
    total_amount: number;
    platform_commission: number;
    partner_payout: number;
  };
  money_moves: {
    advance_net: number;
    rollover_amount: number;
    refund_preview: number;
    suggested_strategy: "ROLLOVER" | "NONE";
  };
  inventory_available: boolean;
  unavailable_dates: string[];
}

// ── Service ───────────────────────────────────────────────────

const base = "/admin/bookings";

export const bookingService = {
  // List & Stats
  list: (params?: {
    page?: number; page_size?: number; booking_status?: string;
    payment_status?: string; service_type?: string; city_id?: number;
    search?: string; journey_date?: string;
  }) => apiClient.get<PaginatedBookings>(base, { params }).then(r => r.data),

  stats: () => apiClient.get<BookingStats>(`${base}/stats`).then(r => r.data),

  get: (id: number) => apiClient.get<BookingDetail>(`${base}/${id}`).then(r => r.data),

  /**
   * List cabs awaiting partner acceptance (PENDING_PARTNER_ACCEPTANCE).
   * Doc Ref: BRD Part 3 §42 — used by the admin "Awaiting Acceptance" tab.
   * Auto-orders by acceptance_deadline ASC (closest-to-expiry first).
   */
  listPendingAcceptance: (params?: { page?: number; page_size?: number; city_id?: number }) =>
    apiClient.get<PendingAcceptanceResponse>(`${base}/pending-acceptance`, { params }).then(r => r.data),

  // Cab actions
  assignPartner:      (bookingId: number, cabId: number, partner_id: number) =>
    apiClient.post(`${base}/${bookingId}/cab/${cabId}/assign-partner`, { partner_id }).then(r => r.data),

  assignDriver:       (bookingId: number, cabId: number, driver_id: number, vehicle_id: number) =>
    apiClient.post(`${base}/${bookingId}/cab/${cabId}/assign-driver`, { driver_id, vehicle_id }).then(r => r.data),

  reassignPartner:    (bookingId: number, cabId: number, partner_id: number, reason?: string) =>
    apiClient.post(`${base}/${bookingId}/cab/${cabId}/reassign`, { partner_id, reason }).then(r => r.data),

  editCabDetails: (bookingId: number, cabId: number, data: {
    pickup_location?: string; drop_location?: string;
    estimated_distance?: number; estimated_amount?: number;
    trip_type?: string; vehicle_category_id?: number;
  }) =>
    apiClient.patch(`${base}/${bookingId}/cab/${cabId}/edit`, data).then(r => r.data),

  editHotelDetails: (reservationId: number, data: {
    room_category_id: number;
    check_in_date: string; // YYYY-MM-DD
    check_out_date: string; // YYYY-MM-DD
    rooms_count: number;
    adults_count: number;
    children_count: number;
    extra_beds: number;
    special_requests?: string | null;
  }) =>
    apiClient.put(`/admin/customer-care/hotel-booking/${reservationId}`, data).then(r => r.data),

  reschedule:         (bookingId: number, cabId: number, pickup_datetime: string, reason?: string) =>
    apiClient.post(`${base}/${bookingId}/cab/${cabId}/reschedule`, { pickup_datetime, reason }).then(r => r.data),

  setFinalAmount:     (bookingId: number, cabId: number, final_amount: number, reason?: string) =>
    apiClient.post(`${base}/${bookingId}/cab/${cabId}/final-amount`, { final_amount, reason }).then(r => r.data),

  // Master booking cancel
  cancel: (bookingId: number, reason: string, cancellation_charge = 0, refund_amount = 0) =>
    apiClient.post(`${base}/${bookingId}/cancel`, { reason, cancellation_charge, refund_amount }).then(r => r.data),

  // Hotel booking actions
  hotelConfirm: (bookingId: number, hotelId: number, hotel_confirmation_number?: string) =>
    apiClient.post(`${base}/${bookingId}/hotel/${hotelId}/confirm`, { hotel_confirmation_number }).then(r => r.data),

  hotelReject: (bookingId: number, hotelId: number, reason: string, refund_amount = 0) =>
    apiClient.post(`${base}/${bookingId}/hotel/${hotelId}/reject`, { reason, refund_amount }).then(r => r.data),

  hotelCheckIn: (
    bookingId: number,
    hotelId: number,
    id_proof: string,
    id_number: string,
    room_ids: number[] = [],
    remarks?: string,
    actual_check_in_at?: string,
    confirm_date_mismatch = false,
  ) =>
    apiClient.post(`${base}/${bookingId}/hotel/${hotelId}/check-in`, {
      id_proof, id_number, room_ids, remarks, actual_check_in_at, confirm_date_mismatch,
    }).then(r => r.data),

  hotelInHouse: (bookingId: number, hotelId: number) =>
    apiClient.post(`${base}/${bookingId}/hotel/${hotelId}/in-house`).then(r => r.data),

  hotelCheckOut: (bookingId: number, hotelId: number, additional_charges = 0, check_out_notes?: string, actual_check_out_at?: string) =>
    apiClient.post(`${base}/${bookingId}/hotel/${hotelId}/check-out`, { additional_charges, check_out_notes, actual_check_out_at }).then(r => r.data),

  hotelComplete: (bookingId: number, hotelId: number) =>
    apiClient.post(`${base}/${bookingId}/hotel/${hotelId}/complete`).then(r => r.data),

  hotelSettle: (bookingId: number, hotelId: number) =>
    apiClient.post(`${base}/${bookingId}/hotel/${hotelId}/settle`).then(r => r.data),

  // Read-only hotel settlement detail used by the 3-step Settlement modal.
  // The endpoint is registered under /settlements/hotel/booking (admin
  // settlement_api.get_hotel_settlement_booking) and returns the full
  // commission / TDS / net-position arithmetic the modal walks through.
  getHotelSettlementDetail: (reservationNumber: string) =>
    apiClient.get(`/admin/settlements/hotel/booking`, {
      params: { reservation_number: reservationNumber },
    }).then(r => r.data),

  hotelNoShow: (bookingId: number, hotelId: number, refund_amount = 0) =>
    apiClient.post(`${base}/${bookingId}/hotel/${hotelId}/no-show`, { refund_amount }).then(r => r.data),

  hotelCancel: (bookingId: number, hotelId: number, reason: string, cancellation_charge = 0, refund_amount = 0) =>
    apiClient.post(`${base}/${bookingId}/hotel/${hotelId}/cancel`, { reason, cancellation_charge, refund_amount }).then(r => r.data),

  hotelAddCharges: (bookingId: number, hotelId: number, amount: number, description: string) =>
    apiClient.post(`${base}/${bookingId}/hotel/${hotelId}/add-charges`, { amount, description }).then(r => r.data),

  // Dry-run the full bill (room + overtime + extras − discount + GST − advances).
  // Safe to poll as the admin edits charges; mutates nothing.
  hotelCheckoutPreview: (
    bookingId: number, hotelId: number,
    additional_charges = 0, actual_check_out_at?: string,
  ) =>
    apiClient.get<HotelCheckoutPreview>(
      `${base}/${bookingId}/hotel/${hotelId}/checkout-preview`,
      { params: { additional_charges, actual_check_out_at } },
    ).then(r => r.data),

  // Record an advance received from the customer. Multiple advances allowed.
  // ONLINE/WALLET are forced to ADMIN custody server-side.
  hotelRecordAdvance: (
    bookingId: number, hotelId: number,
    amount: number, payment_mode: string,
    received_by = "ADMIN", reference_number?: string, notes?: string,
  ) =>
    apiClient.post(`${base}/${bookingId}/hotel/${hotelId}/record-advance`, {
      amount, payment_mode, received_by, reference_number, notes,
    }).then(r => r.data),

  // Freeze the bill into an invoice. Idempotent — re-calling returns the same number.
  hotelGenerateInvoice: (bookingId: number, hotelId: number) =>
    apiClient.post(`${base}/${bookingId}/hotel/${hotelId}/generate-invoice`).then(r => r.data),

  // Collect the final balance. ONLINE is forced to ADMIN custody server-side.
  hotelCollectPayment: (
    bookingId: number, hotelId: number,
    amount: number, payment_mode: string,
    collected_by = "ADMIN", reference_number?: string,
  ) =>
    apiClient.post(`${base}/${bookingId}/hotel/${hotelId}/collect-payment`, {
      amount, payment_mode, collected_by, reference_number,
    }).then(r => r.data),

  // Download the frozen hotel invoice PDF — triggers a browser file download.
  // Only available once the stay is checked-out/completed/settled and an
  // invoice number exists. Mirrors the cab download flow.
  hotelDownloadInvoice: async (
    bookingId: number, hotelId: number, invoice_number: string,
  ): Promise<void> => {
    const response = await apiClient.get(
      `${base}/${bookingId}/hotel/${hotelId}/download-invoice`,
      { responseType: "blob" },
    );
    const url = URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoice_number}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // Download the cab booking invoice PDF — admin-gated, mirrors the partner
  // download but without partner ownership scope. Backend route:
  // GET /admin/bookings/{bookingId}/cab/{cabId}/download-invoice
  // (admin/booking_api.py admin_download_cab_invoice).
  cabDownloadInvoice: async (
    bookingId: number, cabId: number, invoice_number: string,
  ): Promise<void> => {
    const response = await apiClient.get(
      `${base}/${bookingId}/cab/${cabId}/download-invoice`,
      { responseType: "blob" },
    );
    const url = URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice_${invoice_number}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  getAvailableRooms: (bookingId: number, hotelId: number) =>
    apiClient.get<{ success: boolean; rooms_needed: number; data: { id: number; room_number: string; floor_number: string | null }[] }>(
      `${base}/${bookingId}/hotel/${hotelId}/available-rooms`
    ).then(r => r.data),

  // ── Hotel switch / split-stay (Doc Ref: Hotel Switch Spec; Migration 0042) ──
  // Pre-checkin whole-reservation switch and post-checkin mid-stay split share
  // these four endpoints. The backend service in app/modules/hotel/services/switch.py
  // branches the commit on `reservation_status`, so the frontend only needs to
  // pick the right reason + strategy and trust the server for the rest.

  /** Read-only preview of a switch/split: target quote, advance redistribution
   *  preview, and inventory check. No DB writes. */
  getHotelSwitchPreview: (reservationId: number, payload: {
    target_hotel_id: number;
    target_room_category_id: number;
    target_check_in: string;   // YYYY-MM-DD
    target_check_out: string;  // YYYY-MM-DD
    adults_count?: number;
    children_count?: number;
    extra_beds?: number;
  }) =>
    apiClient.post(`${base}/hotel/${reservationId}/switch/quote`, payload).then(r => r.data),

  /** Commit a switch/split. The backend decides PRE_CHECKIN_SWITCH vs
   *  POST_CHECKIN_SPLIT based on the reservation's current status. */
  switchHotel: (reservationId: number, payload: {
    target_hotel_id: number;
    target_room_category_id: number;
    target_check_in: string;
    target_check_out: string;
    strategy: "ROLLOVER" | "NONE";
    reason: string;
    notes?: string | null;
    adults_count?: number;
    children_count?: number;
    extra_beds?: number;
  }) =>
    apiClient.post(`${base}/hotel/${reservationId}/switch`, payload).then(r => r.data),

  /** Record a Razorpay refund on a single advance. Use after the gateway has
   *  cleared; the switch marks the advance with reference_number='MANUAL_PENDING'
   *  so admin knows which rows still need gateway confirmation. */
  recordHotelAdvanceRefund: (reservationId: number, payload: {
    advance_payment_id: number;
    refund_amount: number;
    gateway_reference?: string | null;
    notes?: string | null;
  }) =>
    apiClient.post(`${base}/hotel/${reservationId}/advance-refund`, payload).then(r => r.data),

  /** Paginated audit page for hotel switches/splits (admin Bookings → Switches). */
  listHotelSwitchEvents: (params?: {
    master_booking_id?: number;
    original_reservation_id?: number;
    new_reservation_id?: number;
    split_type?: "PRE_CHECKIN_SWITCH" | "POST_CHECKIN_SPLIT";
    date_from?: string;  // YYYY-MM-DD
    date_to?: string;
    page?: number;
    page_size?: number;
  }) =>
    apiClient.get<{ success: boolean; items: HotelSwitchEvent[]; page: number; page_size: number; total: number }>(
      `${base}/hotel/switch-events`,
      { params },
    ).then(r => r.data),

  // Notes
  addNote:  (bookingId: number, note: string) =>
    apiClient.post(`${base}/${bookingId}/notes`, { note }).then(r => r.data),
  getNotes: (bookingId: number) =>
    apiClient.get<BookingNote[]>(`${base}/${bookingId}/notes`).then(r => r.data),

  // Resources for assignment dropdowns
  getVehicleCategories: () =>
    apiClient.get<VehicleCategoryOption[]>("/admin/settings/master/vehicle-categories", {
      params: { active_only: true }
    }).then(r => r.data),

  getPartnerDetail: (partner_id: number) =>
    apiClient.get<PartnerDetail>(`${base}/resources/partners/${partner_id}`).then(r => r.data),

  getPartners: (city_id?: number, vehicle_category_id?: number | null) =>
    apiClient.get<AssignablePartner[]>(`${base}/resources/partners`, { params: { city_id, vehicle_category_id } }).then(r => r.data),
  getDrivers:  (partner_id: number) =>
    apiClient.get<AssignableDriver[]>(`${base}/resources/drivers`, { params: { partner_id } }).then(r => r.data),
  getVehicles: (partner_id: number, vehicle_category_id?: number) =>
    apiClient.get<AssignableVehicle[]>(`${base}/resources/vehicles`, { params: { partner_id, vehicle_category_id } }).then(r => r.data),

  // ── Real-time booking acceptance queue (Doc Ref: BRD Part 7 §155) ──
  /** Website bookings waiting for admin acceptance (cab/hotel/tour). */
  acceptQueue: () =>
    apiClient.get<AdminAcceptQueueResponse>(`${base}/accept-queue`).then(r => r.data),

  /** Accept one pending website booking from the realtime modal. */
  acceptBooking: (bookingId: number, serviceType: "CAB" | "HOTEL" | "TOUR") =>
    apiClient.post<{ success: boolean; message: string; booking_status: string; service_status: string }>(
      `${base}/${bookingId}/accept`, { service_type: serviceType }
    ).then(r => r.data),
};

// ── Real-time accept queue types ────────────────────────────────────
export interface AdminAcceptQueueItem {
  master_booking_id: number;
  master_booking_number: string;
  service_type: "CAB" | "HOTEL" | "TOUR";
  service_id: number;
  service_number: string;
  /** Pickup location (cab) / hotel name (hotel) / package name (tour). */
  headline: string | null;
  /** Pickup datetime (cab) / check-in (hotel) / travel start (tour). */
  datetime: string | null;
  amount: number;
  customer_name: string | null;
  city_name: string | null;
  created_at: string | null;
}

export interface AdminAcceptQueueResponse {
  total: number;
  items: AdminAcceptQueueItem[];
}
