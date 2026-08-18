import apiClient from "./api";

export interface TourItinerary {
  id?: number;
  day_number: number;
  title: string;
  description?: string | null;
  activities: string[];
  overnight_city_id?: number | null;
}
export interface TourPricing {
  id?: number;
  persons_count: number;
  package_price: number;
  effective_from?: string | null;
  effective_to?: string | null;
}
export interface TourMedia {
  id?: number;
  media_type?: string;
  media_url: string;
  caption?: string | null;
  is_primary?: boolean;
}
export interface TourPackage {
  id: number;
  package_code: string;
  slug: string;
  package_name: string;
  package_type: string;
  destination: string;
  city_id: number;
  city_name?: string | null;
  duration_days: number;
  duration_nights: number;
  minimum_persons: number;
  maximum_persons?: number | null;
  short_description?: string | null;
  description?: string | null;
  terms_and_conditions?: string | null;
  status: string;
  partner_id: number;
  partner_name?: string | null;
  partner_code?: string | null;
  rejection_reason?: string | null;
  primary_image_url?: string | null;
  starting_price?: number;
  itinerary: TourItinerary[];
  inclusions: Array<{ id?: number; text: string }>;
  exclusions: Array<{ id?: number; text: string }>;
  pricing: TourPricing[];
  media: TourMedia[];
  created_at?: string;
  submitted_at?: string | null;
  approved_at?: string | null;
  activated_at?: string | null;
}

export interface TourBooking {
  id: number;
  booking_number: string;
  master_booking_id: number;
  master_booking_number?: string;
  package_id: number;
  package_name: string;
  customer_id: number;
  customer_name?: string | null;
  customer_mobile?: string | null;
  customer_email?: string | null;
  travel_start_date: string;
  travel_end_date: string;
  persons_count: number;
  total_amount: number;
  platform_commission: number;
  partner_payout: number;
  payment_status: string;
  booking_status: string;
  special_requests?: string | null;
  participants?: Array<{ id: number; participant_name: string; mobile?: string | null; age?: number | null; gender?: string | null }>;
  package?: {
    id: number;
    package_code: string;
    package_name: string;
    destination: string;
    duration_days: number;
    duration_nights: number;
    minimum_persons: number;
    maximum_persons?: number | null;
    slug: string;
  };
  customer?: { id: number; name: string; mobile?: string | null; email?: string | null };
  created_at?: string;
  updated_at?: string;
}

/** Tour booking manage payload — /admin/tours/bookings/{id}/manage */
export interface TourManagePayload {
  id: number;
  booking_number: string;
  master_booking_id: number;
  package_id: number;
  package_name?: string | null;
  package_code?: string | null;
  destination?: string | null;
  duration_days?: number | null;
  duration_nights?: number | null;
  partner_id?: number | null;
  partner_name?: string | null;
  travel_start_date?: string | null;
  travel_end_date?: string | null;
  pickup_location?: string | null;
  pickup_datetime?: string | null;
  persons_count: number;
  total_amount: number;
  platform_commission: number;
  partner_payout: number;
  additional_amount: number;
  additional_charge_note?: string | null;
  advance_total: number;
  advance_received_by?: string | null;
  payment_status: string;
  booking_status: string;
  invoice_number?: string | null;
  invoiced_at?: string | null;
  hotel_details?: string | null;
  other_details?: string | null;
  special_requests?: string | null;
  vehicle?: { id: number; registration_number: string; vehicle_brand?: string | null; vehicle_model?: string | null; seating_capacity?: number | null; driver_name?: string | null } | null;
  driver?: { id: number; full_name: string; mobile?: string | null } | null;
  advances: Array<{
    id: number;
    receipt_number: string;
    amount: number;
    payment_mode: string;
    received_by: string;
    reference_number?: string | null;
    notes?: string | null;
    status: string;
    collected_by_role: string;
    collected_at?: string | null;
    void_reason?: string | null;
  }>;
  charges: Array<{
    id: number;
    label: string;
    amount: number;
    reason?: string | null;
    added_by_role: string;
    created_at?: string | null;
  }>;
  fleet?: {
    vehicles: Array<{ id: number; registration_number: string; vehicle_brand?: string | null; vehicle_model?: string | null; seating_capacity?: number | null }>;
    drivers: Array<{ id: number; full_name: string; mobile?: string | null }>;
  };
}

export interface TourStats {
  active: number;
  pending_review: number;
  draft: number;
  rejected: number;
  suspended?: number;
  inactive?: number;
  total_packages: number;
  total_bookings: number;
  today_bookings: number;
  revenue_today: number;
  revenue_mtd: number;
}

export interface PopularDestination {
  city_id: number;
  name: string;
  package_count: number;
  image_url?: string | null;
}

export const tourService = {
  // Catalog ─────────────────────────────────────────────────────
  listPackages: (params?: Record<string, string | number>) =>
    apiClient.get<TourPackage[]>("/admin/tours/packages", { params }).then(r => r.data),
  getPackage: (id: number) =>
    apiClient.get<TourPackage>(`/admin/tours/packages/${id}`).then(r => r.data),
  createPackage: (data: any) =>
    apiClient.post<TourPackage>("/admin/tours/packages", data).then(r => r.data),
  updatePackage: (id: number, data: any) =>
    apiClient.patch<TourPackage>(`/admin/tours/packages/${id}`, data).then(r => r.data),
  setPackageStatus: (id: number, status: string, rejection_reason?: string) =>
    apiClient.post<TourPackage>(`/admin/tours/packages/${id}/status`, { status, rejection_reason }).then(r => r.data),

  // Bookings ────────────────────────────────────────────────────
  listBookings: (params?: Record<string, string>) =>
    apiClient.get<TourBooking[]>("/admin/tours/bookings", { params }).then(r => r.data),
  getBooking: (id: number) =>
    apiClient.get<TourBooking>(`/admin/tours/bookings/${id}`).then(r => r.data),
  setBookingStatus: (id: number, booking_status: string) =>
    apiClient.post(`/admin/tours/bookings/${id}/status`, { status: booking_status }).then(r => r.data),

  // ── Booking manage (advance / fleet / trip / charges / settle) ──
  getManage: (id: number) =>
    apiClient.get<TourManagePayload>(`/admin/tours/bookings/${id}/manage`).then(r => r.data),
  collectAdvance: (id: number, payload: { amount: number; payment_mode: string; received_by: string; reference_number?: string; notes?: string }) =>
    apiClient.post(`/admin/tours/bookings/${id}/advance`, payload).then(r => r.data),
  voidAdvance: (id: number, advanceId: number, reason: string) =>
    apiClient.post(`/admin/tours/bookings/${id}/advance/${advanceId}/void`, { reason }).then(r => r.data),
  assignVehicle: (id: number, payload: { vehicle_id?: number | null; driver_id?: number | null }) =>
    apiClient.post(`/admin/tours/bookings/${id}/vehicle`, payload).then(r => r.data),
  updateTrip: (id: number, payload: Record<string, unknown>) =>
    apiClient.patch(`/admin/tours/bookings/${id}`, payload).then(r => r.data),
  addCharge: (id: number, payload: { label: string; amount: number; reason?: string }) =>
    apiClient.post(`/admin/tours/bookings/${id}/charges`, payload).then(r => r.data),
  settleBooking: (id: number) =>
    apiClient.post(`/admin/tours/bookings/${id}/settle`).then(r => r.data),
  /** Stream the advance receipt PDF (browser download). */
  downloadAdvanceReceipt: async (id: number, advanceId: number, receiptNumber: string) => {
    const res = await apiClient.get(`/admin/tours/bookings/${id}/advance/${advanceId}/receipt`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${receiptNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
  },
  /** Generate + stream the booking invoice PDF (browser download). */
  downloadInvoice: async (id: number) => {
    const res = await apiClient.get(`/admin/tours/bookings/${id}/invoice`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `tour-invoice-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
  },
  /** Stream the tour itinerary PDF (customer + booking + day-by-day plan + payment + fleet). */
  downloadItinerary: async (id: number) => {
    const res = await apiClient.get(`/admin/tours/bookings/${id}/itinerary`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `tour-itinerary-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
  },

  // Stats & reference data ──────────────────────────────────────
  getStats: () => apiClient.get<TourStats>("/admin/tours/stats").then(r => r.data),
  getPartners: () =>
    apiClient.get<any>("/admin/partners", { params: { page_size: 200 } }).then(r => (r.data as any)?.items ?? r.data),
  getCities: () =>
    apiClient.get<any[]>("/admin/settings/master/cities", { params: { active_only: true } }).then(r => r.data),

  // Customer care quick-booking ─────────────────────────────────
  getCustomerCareMeta: (customerId: number) =>
    apiClient.get<{ customer: any; packages: TourPackage[] }>(`/admin/customer-care/tour-booking/${customerId}/meta`).then(r => r.data),
  createCustomerCareBooking: (customerId: number, data: any) =>
    apiClient.post(`/admin/customer-care/tour-booking/${customerId}/create`, data).then(r => r.data),

  // Quote (re-use public quote endpoint for live preview) ───────
  quote: (packageId: number, persons: number) =>
    apiClient.get(`/public/tours/packages/${packageId}/quote`, { params: { persons } }).then(r => r.data),
};
