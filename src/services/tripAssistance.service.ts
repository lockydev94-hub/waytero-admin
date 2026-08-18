// ============================================================
// WAYTERO ADMIN — TRIP ASSISTANCE SERVICE
// Base URL: /admin/trip-assist
// All endpoints match Backend trip_assistance_api.py
// ============================================================
import apiClient from "./api";

// ── Types ────────────────────────────────────────────────────

export interface TripTimeline {
  id: number;
  event_type: string;
  event_description: string;
  event_timestamp: string;
}

export interface TripDetail {
  // Master booking
  master_booking_id: number;
  booking_number: string;
  booking_status: string;
  payment_status: string;
  total_amount: number;
  total_paid_amount: number;
  // Customer
  customer_name: string | null;
  customer_mobile: string | null;
  // City
  city_name: string | null;
  // Cab booking
  cab_booking_id: number;
  cab_booking_number: string;
  cab_status: string;
  trip_type: string | null;
  vehicle_category_name: string | null;
  pickup_location: string | null;
  drop_location: string | null;
  pickup_datetime: string | null;
  estimated_distance: number | null;
  estimated_amount: number | null;
  final_amount: number | null;
  // Trip start/end
  trip_start_km: number | null;
  trip_started_at: string | null;
  trip_end_km: number | null;
  trip_ended_at: string | null;
  actual_distance: number | null;
  // Coupon & advance
  coupon_discount: number;
  advance_paid: number;
  // Payment
  payment_mode: string | null;
  payment_collected_by: string | null;
  cash_pending_at: string;
  platform_commission: number | null;
  partner_payout: number | null;
  // Invoice
  invoice_number: string | null;
  invoice_url: string | null;
  // GST / Tax (migration 0024)
  gst_rate: number;
  gst_amount: number;
  is_tax_invoice: boolean;
  // Assignment
  partner_id: number | null;
  partner_name: string | null;
  partner_mobile: string | null;
  driver_id: number | null;
  driver_name: string | null;
  driver_mobile: string | null;
  vehicle_id: number | null;
  vehicle_reg: string | null;
  vehicle_model: string | null;
  // Timeline
  timeline: TripTimeline[];
}

export interface ActiveTripsResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: TripDetail[];
}

export interface PricingRule {
  base_fare: number;
  per_km_rate: number;
  minimum_km: number;
  driver_allowance: number;
  driver_allowance_type: string;
  night_charge: number;
}

export interface TripPricingPreview {
  booking_number: string;
  city_name: string | null;
  trip_type: string | null;
  vehicle_category: number | null;
  trip_start_km: number | null;
  estimated_distance: number | null;
  estimated_amount: number | null;
  pricing_rule: PricingRule | null;
  actual_distance: number | null;
  calculated_amount: number | null;
}

const base = "/admin/trip-assist";

export const tripAssistanceService = {
  // Lookup booking by number
  lookup: (booking_number: string): Promise<TripDetail> =>
    apiClient.get(`${base}/lookup`, { params: { booking_number } }).then(r => r.data),

  // List active trips (DRIVER_ASSIGNED, STARTED)
  listActive: (page = 1, page_size = 20): Promise<ActiveTripsResponse> =>
    apiClient.get(`${base}/active`, { params: { page, page_size } }).then(r => r.data),

  // Fetch pricing rule + optional live calculation
  getPricing: (booking_number: string, end_km?: number): Promise<TripPricingPreview> =>
    apiClient.get(`${base}/pricing`, { params: { booking_number, ...(end_km !== undefined ? { end_km } : {}) } }).then(r => r.data),

  // Start trip
  startTrip: (payload: {
    booking_number: string;
    start_km: number;
    start_datetime: string; // ISO string
  }) =>
    apiClient.post(`${base}/start-trip`, payload).then(r => r.data),

  // Close trip
  closeTrip: (payload: {
    booking_number: string;
    end_km: number;
    end_datetime: string;
    final_amount: number;
  }) =>
    apiClient.post(`${base}/close-trip`, payload).then(r => r.data),

  // Collect payment
  collectPayment: (payload: {
    booking_number: string;
    payment_mode: "CASH" | "ONLINE" | "WALLET";
    payment_collected_by: "DRIVER" | "PARTNER" | "PLATFORM";
    commission_percent?: number;
  }) =>
    apiClient.post(`${base}/collect-payment`, payload).then(r => r.data),

  // Generate invoice number
  generateInvoice: (booking_number: string) =>
    apiClient.post(`${base}/generate-invoice`, { booking_number }).then(r => r.data),

  // Update invoice URL (after Cloudinary upload)
  updateInvoiceUrl: (booking_number: string, invoice_url: string) =>
    apiClient.post(`${base}/update-invoice-url`, { booking_number, invoice_url }).then(r => r.data),

  // Get commission preview for a booking
  getCommissionPreview: (booking_number: string): Promise<{ booking_number: string; partner_id: number | null; commission_percent: number; rule_source: string }> =>
    apiClient.get(`${base}/commission-preview`, { params: { booking_number } }).then(r => r.data),

  // Get customer wallet balance for WALLET payment mode
  getCustomerWallet: (booking_number: string): Promise<{ wallet_found: boolean; available_balance: number; hold_balance: number; wallet_status: string | null }> =>
    apiClient.get(`${base}/customer-wallet`, { params: { booking_number } }).then(r => r.data),

  // Download invoice PDF — triggers browser file download
  downloadInvoice: async (booking_number: string, invoice_number: string): Promise<void> => {
    const response = await apiClient.get(`${base}/download-invoice`, {
      params: { booking_number },
      responseType: "blob",
    });
    const url = URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice_${invoice_number}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
