// ============================================================
// WAYTERO ADMIN — CUSTOMER CARE SERVICE
// Base: /admin/customer-care
// ============================================================
import apiClient from "./api";

// ── Types ─────────────────────────────────────────────────────

export interface CareLogItem {
  id: number;
  log_number: string;
  customer_id: number | null;
  customer_name: string | null;
  customer_mobile: string | null;
  issue_type: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  booking_id: number | null;
  booking_number: string | null;
  resolved_at: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedCareLogs {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: CareLogItem[];
}

export interface CustomerLookup {
  found: boolean;
  customer_id?: number;
  customer_code?: string;
  user_id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  mobile_number?: string;
  email?: string;
  is_active?: boolean;
  created_at?: string;
  total_bookings?: number;
  total_issues?: number;
}

export interface CustomerRegisterPayload {
  first_name: string;
  last_name?: string;
  mobile_number: string;
  email?: string;
  city_id?: number;
}

export interface CareLogCreatePayload {
  customer_id: number;
  issue_type: string;
  subject: string;
  description: string;
  priority: string;
  booking_id?: number | null;
}

export interface CareLogUpdatePayload {
  status?: string;
  priority?: string;
  description?: string;
  resolution_notes?: string;
}

export interface CustomerBookingHistoryItem {
  id: number;
  booking_number: string;
  booking_status: string;
  payment_status: string;
  total_amount: number | null;
  journey_start_date: string | null;
  city_name: string | null;
  created_at: string;
}

export interface CustomerPreviousRecords {
  bookings: CustomerBookingHistoryItem[];
  booking_total: number;
  booking_page: number;
  booking_pages: number;
  issues: CareLogItem[];
  issue_total: number;
  issue_page: number;
  issue_pages: number;
}

export interface VehicleCategory {
  id: number;
  category_name: string;
  seating_capacity: number | null;
  image_url: string | null;
  icon_url: string | null;
}

export interface CabBookingMeta {
  vehicle_categories: VehicleCategory[];
  pricing: Record<string, Record<string, {
    base_fare: number;
    per_km_rate: number;
    minimum_km: number;
    driver_allowance: number;
    driver_allowance_type: string;
    night_charge: number;
  }>>;
  cities: { id: number; name: string }[];
}

export interface CabBookingCreatePayload {
  customer_id: number;
  city_id: number;
  trip_type: string;
  vehicle_category_id: number;
  pickup_location: string;
  pickup_latitude?: number | null;
  pickup_longitude?: number | null;
  drop_location: string;
  drop_latitude?: number | null;
  drop_longitude?: number | null;
  pickup_datetime: string; // ISO
  estimated_distance?: number | null;
  remarks?: string;
}

export interface CareStats {
  total: number;
  open_count: number;
  in_progress_count: number;
  resolved_count: number;
  closed_count: number;
  urgent_count: number;
  today_count: number;
}

// ── Hotel booking ──────────────────────────────────────────────

export interface HotelRoomCategoryMeta {
  id: number;
  hotel_id: number;
  category_name: string;
  room_type: string | null;
  meal_plan: string;
  base_occupancy: number;
  max_adults: number;
  max_children: number;
  max_occupancy: number;
  extra_bed_allowed: boolean;
  extra_bed_charge: number | null;
  extra_adult_charge: number | null;
  extra_child_charge: number | null;
  base_price: number | null;
  published_price: number | null;
  total_rooms: number;
}

export interface HotelMetaItem {
  id: number;
  hotel_code: string;
  hotel_name: string;
  star_rating: number | null;
  city_id: number | null;
  city_name: string | null;
  address: string | null;
  tax_mode: string;
  room_categories: HotelRoomCategoryMeta[];
}

export interface HotelBookingMeta {
  hotels: HotelMetaItem[];
  cities: { id: number; name: string }[];
}

export interface HotelQuoteNight {
  date: string;
  rate: number;
  source: string;
  plan_name: string | null;
  gst_percent: number;
  gst_amount: number;
  total_with_tax: number;
}

export interface HotelQuoteOccupancy {
  base_occupancy: number;
  base_capacity: number;
  adults: number;
  children: number;
  extra_adults: number;
  extra_children: number;
  extra_beds: number;
  extra_adult_charge: number;
  extra_child_charge: number;
  extra_bed_charge: number;
  person_surcharge: number;
  bed_surcharge: number;
  surcharge: number;
  person_charge_basis: string;
  bed_charge_basis: string;
  taxable_amount?: number;
  gst_amount?: number;
  total_amount?: number;
}

export interface HotelBookingQuote {
  success: boolean;
  hotel_id: number;
  hotel_name: string;
  room_category_id: number;
  room_category_name: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  rooms_count: number;
  room_nights: number;
  base_amount: number;
  taxable_amount: number;
  gst_percent: number;
  gst_amount: number;
  is_tax_invoice: boolean;
  total_amount: number;
  platform_commission: number;
  partner_payout: number;
  average_nightly_rate: number;
  nightly: HotelQuoteNight[];
  occupancy?: HotelQuoteOccupancy | null;
}

export interface HotelQuotePayload {
  hotel_id: number;
  room_category_id: number;
  check_in_date: string; // YYYY-MM-DD
  check_out_date: string; // YYYY-MM-DD
  rooms_count?: number;
  adults_count?: number;
  children_count?: number;
  extra_beds?: number;
}

export interface HotelReservationGuestPayload {
  guest_name: string;
  mobile?: string | null;
  gender?: string | null;
  age?: number | null;
  id_type?: string | null;
  id_number?: string | null;
  is_primary?: boolean;
}

export interface HotelBookingCreatePayload {
  customer_id: number;
  hotel_id: number;
  room_category_id: number;
  check_in_date: string; // YYYY-MM-DD
  check_out_date: string; // YYYY-MM-DD
  rooms_count?: number;
  adults_count?: number;
  children_count?: number;
  extra_beds?: number;
  guests?: HotelReservationGuestPayload[];
  special_requests?: string | null;
  remarks?: string | null;
}

export interface HotelBookingCreateResult {
  success: boolean;
  master_booking_id: number;
  booking_number: string;
  reservation_id: number;
  reservation_number: string;
  total_amount: number;
  nights: number;
  rooms_count: number;
  message: string;
}

// ── Service ───────────────────────────────────────────────────

const BASE = "/admin/customer-care";

export const customerCareService = {
  // Stats
  stats: (): Promise<CareStats> =>
    apiClient.get(`${BASE}/stats`).then(r => r.data),

  // List logs
  list: (params?: {
    page?: number; page_size?: number; status?: string;
    issue_type?: string; priority?: string; search?: string;
  }): Promise<PaginatedCareLogs> =>
    apiClient.get(BASE, { params }).then(r => r.data),

  // Lookup customer by mobile
  lookup: (mobile: string): Promise<CustomerLookup> =>
    apiClient.get(`${BASE}/lookup`, { params: { mobile } }).then(r => r.data),

  // Fetch a single customer's profile by id (for booking-page prefill)
  getCustomer: (customerId: number): Promise<CustomerLookup> =>
    apiClient.get(`${BASE}/customer/${customerId}`).then(r => r.data),

  // Register customer
  registerCustomer: (payload: CustomerRegisterPayload): Promise<CustomerLookup> =>
    apiClient.post(`${BASE}/register-customer`, payload).then(r => r.data),

  // Customer previous records
  getCustomerRecords: (customerId: number, params?: {
    booking_page?: number; issue_page?: number; page_size?: number;
  }): Promise<CustomerPreviousRecords> =>
    apiClient.get(`${BASE}/customer/${customerId}/records`, { params }).then(r => r.data),

  // Create care log
  createLog: (payload: CareLogCreatePayload): Promise<CareLogItem> =>
    apiClient.post(BASE, payload).then(r => r.data),

  // Update care log
  updateLog: (logId: number, payload: CareLogUpdatePayload): Promise<CareLogItem> =>
    apiClient.patch(`${BASE}/${logId}`, payload).then(r => r.data),

  // Cab booking meta
  getCabMeta: (cityId?: number): Promise<CabBookingMeta> =>
    apiClient.get(`${BASE}/cab-booking/meta`, { params: cityId ? { city_id: cityId } : undefined }).then(r => r.data),

  // Create cab booking
  createCabBooking: (payload: CabBookingCreatePayload) =>
    apiClient.post(`${BASE}/cab-booking`, payload).then(r => r.data),

  // Hotel booking meta (active hotels + room categories)
  getHotelMeta: (cityId?: number): Promise<HotelBookingMeta> =>
    apiClient.get(`${BASE}/hotel-booking/meta`, { params: cityId ? { city_id: cityId } : undefined }).then(r => r.data),

  // Hotel stay quote (server-side price preview)
  getHotelQuote: (payload: HotelQuotePayload): Promise<HotelBookingQuote> =>
    apiClient.post(`${BASE}/hotel-booking/quote`, payload).then(r => r.data),

  // Create hotel booking
  createHotelBooking: (payload: HotelBookingCreatePayload): Promise<HotelBookingCreateResult> =>
    apiClient.post(`${BASE}/hotel-booking`, payload).then(r => r.data),
};
