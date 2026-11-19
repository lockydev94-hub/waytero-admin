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
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
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
  is_custom?: boolean;
  custom_customer_id?: number | null;
  custom_plan?: CustomTourPlanSnapshot | null;
  estimated_cost?: number;
  quoted_price?: number | null;
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
  offer_id?: number | null;
  offer_title?: string | null;
  offer_slug?: string | null;
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

// ── Custom / private tour plan (migration 0109) ─────────────────────────────

export interface CustomTourPlace {
  name: string;
  arrival_time?: string | null;
  distance_from_previous_km: number;
  distance_source?: string | null;
  notes?: string | null;
}

export interface CustomTourHotel {
  enabled: boolean;
  hotel_name?: string | null;
  address?: string | null;
  category?: string | null;
  room_type?: string | null;
  rooms: number;
  nights: number;
  cost: number;
  notes?: string | null;
}

export interface CustomTourDay {
  day_number: number;
  title: string;
  description?: string | null;
  places: CustomTourPlace[];
  hotel?: CustomTourHotel | null;
  other_cost: number;
  notes?: string | null;
}

export interface CustomTourPlanSnapshot {
  version: number;
  days: CustomTourDay[];
  total_distance_km: number;
  cab: Record<string, unknown>;
  toll_cost: number;
  other_cost: number;
  cost_breakdown: CustomTourCostBreakdown;
}

export interface CustomTourCostBreakdown {
  total_distance_km: number;
  billed_distance_km: number;
  cab_base_fare: number;
  cab_distance_charge: number;
  cab_driver_allowance: number;
  cab_night_charge: number;
  cab_toll: number;
  toll_cost: number;
  hotel_total: number;
  other_total: number;
  cab_total: number;
  estimated_cost: number;
}

export interface CustomTourCabOption {
  id: number;
  category_name: string;
  seating_capacity?: number | null;
  luggage_capacity?: number | null;
  trip_type: string;
  source: string;
  base_fare: number;
  minimum_km: number;
  per_km_rate: number;
  driver_allowance: number;
  driver_allowance_type: string;
  night_charge: number;
  night_charge_type: string;
  toll: number;
}

export interface CustomTourPartner {
  id: number;
  business_name?: string | null;
  owner_name?: string | null;
  mobile?: string | null;
  city_id?: number | null;
  city_name?: string | null;
  has_tour_service: boolean;
}

export interface CustomTourEstimatePayload {
  city_id: number;
  travel_start_date: string;
  duration_days: number;
  cab_category_id: number;
  days: CustomTourDay[];
  toll_cost: number;
  other_cost: number;
}

export interface CustomTourPlanPayload extends CustomTourEstimatePayload {
  customer_id: number;
  partner_id: number;
  package_name: string;
  destination: string;
  duration_nights: number;
  persons_count: number;
  minimum_persons: number;
  maximum_persons?: number | null;
  pickup_location?: string | null;
  short_description?: string | null;
  description?: string | null;
  inclusions: string[];
  exclusions: string[];
  media: string[];
  quoted_price?: number | null;
  book_now: boolean;
  special_requests?: string | null;
  participants?: Array<Record<string, unknown>>;
}

export interface CustomTourBookingResult {
  tour_booking_id: number;
  master_booking_id: number;
  booking_number: string;
  master_booking_number: string;
  total_amount: number;
  platform_commission: number;
  partner_payout: number;
  booking_status: string;
}

export interface CustomTourPlanResult {
  package: TourPackage;
  estimate: CustomTourCostBreakdown;
  booking: CustomTourBookingResult | null;
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
  /** POST /admin/tours/partners/{id}/enable-tour-service — grant TOUR before wizard save (mirrors hotel flow). */
  enableTourService: (partner_id: number) =>
    apiClient.post(`/admin/tours/partners/${partner_id}/enable-tour-service`).then(r => r.data),
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
  // ── Customer PDFs (blob-returning so the WhatsApp modal can attach them) ──
  advanceReceiptPdf: async (id: number, advanceId: number): Promise<Blob> => {
    const res = await apiClient.get(`/admin/tours/bookings/${id}/advance/${advanceId}/receipt`, { responseType: "blob" });
    return new Blob([res.data], { type: "application/pdf" });
  },
  invoicePdf: async (id: number): Promise<Blob> => {
    const res = await apiClient.get(`/admin/tours/bookings/${id}/invoice`, { responseType: "blob" });
    return new Blob([res.data], { type: "application/pdf" });
  },
  itineraryPdf: async (id: number): Promise<Blob> => {
    const res = await apiClient.get(`/admin/tours/bookings/${id}/itinerary`, { responseType: "blob" });
    return new Blob([res.data], { type: "application/pdf" });
  },
  /** Stream the advance receipt PDF (browser download). */
  downloadAdvanceReceipt: async (id: number, advanceId: number, receiptNumber: string) => {
    const blob = await tourService.advanceReceiptPdf(id, advanceId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${receiptNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
  },
  /** Generate + stream the booking invoice PDF (browser download). */
  downloadInvoice: async (id: number) => {
    const blob = await tourService.invoicePdf(id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tour-invoice-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
  },
  /** Stream the tour itinerary PDF (customer + booking + day-by-day plan + payment + fleet). */
  downloadItinerary: async (id: number) => {
    const blob = await tourService.itineraryPdf(id);
    const url = URL.createObjectURL(blob);
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

  // Custom / private tour plans ─────────────────────────────────
  customPartners: (cityId?: number): Promise<CustomTourPartner[]> =>
    apiClient.get<CustomTourPartner[]>("/admin/tours/custom-plans/partners", {
      params: cityId ? { city_id: cityId } : undefined,
    }).then(r => r.data),
  customCabOptions: (cityId: number, travelDate?: string): Promise<CustomTourCabOption[]> =>
    apiClient.get<CustomTourCabOption[]>("/admin/tours/custom-plans/cab-options", {
      params: { city_id: cityId, ...(travelDate ? { travel_date: travelDate } : {}) },
    }).then(r => r.data),
  customRouteDistance: (payload: {
    origin: string; destination: string;
    origin_hint?: string; destination_hint?: string;
  }): Promise<{ distance_km: number; source: string }> =>
    apiClient.post<{ distance_km: number; source: string }>(
      "/admin/tours/custom-plans/route-distance", payload,
    ).then(r => r.data),
  estimateCustomPlan: (payload: CustomTourEstimatePayload): Promise<{
    plan: CustomTourPlanSnapshot; breakdown: CustomTourCostBreakdown; cab: Record<string, unknown>;
  }> =>
    apiClient.post("/admin/tours/custom-plans/estimate", payload).then(r => r.data),
  createCustomPlan: (payload: CustomTourPlanPayload): Promise<CustomTourPlanResult> =>
    apiClient.post<CustomTourPlanResult>("/admin/tours/custom-plans", payload).then(r => r.data),
  bookCustomPlan: (packageId: number, payload: {
    partner_id: number; quoted_price: number; travel_start_date: string;
    persons_count: number; special_requests?: string | null;
    participants?: Array<Record<string, unknown>>;
  }): Promise<{ package: TourPackage; booking: CustomTourBookingResult }> =>
    apiClient.post(`/admin/tours/custom-plans/${packageId}/book`, payload).then(r => r.data),

  // Customer care quick-booking ─────────────────────────────────
  getCustomerCareMeta: (customerId: number) =>
    apiClient.get<{ customer: any; packages: TourPackage[] }>(`/admin/customer-care/tour-booking/${customerId}/meta`).then(r => r.data),
  createCustomerCareBooking: (customerId: number, data: any) =>
    apiClient.post(`/admin/customer-care/tour-booking/${customerId}/create`, data).then(r => r.data),

  // Quote (re-use public quote endpoint for live preview) ───────
  quote: (packageId: number, persons: number) =>
    apiClient.get(`/public/tours/packages/${packageId}/quote`, { params: { persons } }).then(r => r.data),
};
