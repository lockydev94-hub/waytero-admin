// ============================================================
// WAYTERO ADMIN — REPORTS SERVICE
// Base URL: /admin/reports
// Doc Ref: 14_Reporting_Business_Intelligence/
// ============================================================
import apiClient from "./api";

// ── Types — Booking Report ─────────────────────────────────
export interface BookingReportItem {
  booking_number: string;
  customer_name: string | null;
  customer_mobile: string | null;
  city_name: string | null;
  journey_date: string | null;
  trip_type: string | null;
  pickup_location: string | null;
  drop_location: string | null;
  vehicle_category: string | null;
  partner_name: string | null;
  final_amount: number | null;
  gst_amount: number;
  is_tax_invoice: boolean;
  payment_mode: string | null;
  payment_status: string;
  booking_status: string;
  cab_status: string | null;
  invoice_number: string | null;
  platform_commission: number | null;
  partner_payout: number | null;
  created_at: string;
}

export interface BookingReportSummary {
  total_bookings: number;
  completed: number;
  settled: number;
  total_revenue: number;
  total_commission: number;
  total_payout: number;
  total_gst: number;
}

export interface BookingReportResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  summary: BookingReportSummary;
  items: BookingReportItem[];
}

// ── Types — GST ────────────────────────────────────────────
export interface GSTRecord {
  month: string;
  month_label: string;
  total_taxable: number;
  gst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  total_invoices: number;
  challan_generated: boolean;
  challan_number: string | null;
  challan_date: string | null;
  challan_status: string | null;
}

export interface GSTReportResponse {
  year: number;
  records: GSTRecord[];
  yearly_summary: {
    total_taxable: number;
    total_gst: number;
    total_cgst: number;
    total_sgst: number;
  };
}

export interface GenerateChallanResponse {
  success: boolean;
  message: string;
  challan_number: string;
  month: string;
  gst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
}

// ── Types — TDS ────────────────────────────────────────────
export interface TDSRecord {
  partner_id: number;
  partner_name: string;
  partner_code: string;
  partner_type: string;
  gst_number: string | null;
  pan_number: string | null;
  total_payout: number;
  tds_amount: number;
  tds_deducted: number;
  tds_gap: number;
  net_payout: number;
  total_bookings: number;
  deducted_bookings: number;
  period: string;
  financial_year: string | null;
  quarter: string | null;
}

export interface TDSReportResponse {
  period: string;
  tds_enabled: boolean;
  tds_rate: number;
  total_tds: number;
  total_deducted: number;
  total_gap: number;
  total_payout: number;
  records: TDSRecord[];
}

// ── Types — Partner Report ─────────────────────────────────
export interface PartnerReportSummary {
  partner_id: number;
  partner_name: string;
  partner_code: string;
  partner_type: string;
  city_name: string | null;
  total_bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;
  total_revenue: number;
  total_gst: number;
  total_commission: number;
  total_payout: number;
  average_trip_amount: number;
  settled_bookings: number;
}

export interface PartnerBookingDetail {
  booking_number: string;
  cab_booking_number: string | null;
  journey_date: string | null;
  trip_type: string | null;
  pickup_location: string | null;
  drop_location: string | null;
  final_amount: number | null;
  gst_amount: number;
  is_tax_invoice: boolean;
  platform_commission: number | null;
  partner_payout: number | null;
  payment_mode: string | null;
  cab_status: string | null;
  invoice_number: string | null;
  created_at: string;
}

export interface PartnerReportResponse {
  summary: PartnerReportSummary;
  items: PartnerBookingDetail[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PartnerOption {
  id: number;
  name: string;
  code: string;
  type: string;
}

// ── Types — Customer Report ────────────────────────────────
export interface CustomerReportItem {
  customer_id: number;
  customer_name: string | null;
  customer_mobile: string | null;
  customer_email: string | null;
  city_name: string | null;
  total_bookings: number;
  completed_bookings: number;
  total_spent: number;
  last_booking_date: string | null;
  first_booking_date: string | null;
  avg_booking_value: number;
}

export interface CustomerReportResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  summary: { unique_customers: number; total_revenue: number; avg_booking_value: number };
  items: CustomerReportItem[];
}

// ── Service ────────────────────────────────────────────────
const base = "/admin/reports";

export const reportsService = {
  bookings: (params: {
    period?: string; date_from?: string; date_to?: string;
    city_id?: number; partner_id?: number; booking_status?: string;
    payment_mode?: string; page?: number; page_size?: number;
  }): Promise<BookingReportResponse> =>
    apiClient.get(`${base}/bookings`, { params }).then(r => r.data),

  gst: (year?: number): Promise<GSTReportResponse> =>
    apiClient.get(`${base}/gst`, { params: { year } }).then(r => r.data),

  generateChallan: (month: string, challan_number: string): Promise<GenerateChallanResponse> =>
    apiClient.post(`${base}/gst/generate-challan`, { month, challan_number }).then(r => r.data),

  markChallanFiled: (month: string, filed_date?: string, notes?: string): Promise<{ success: boolean; message: string }> =>
    apiClient.post(`${base}/gst/mark-filed`, { month, filed_date, notes }).then(r => r.data),

  tds: (params: { period?: string; year?: number; month?: number }): Promise<TDSReportResponse> =>
    apiClient.get(`${base}/tds`, { params }).then(r => r.data),

  partnerOptions: (): Promise<PartnerOption[]> =>
    apiClient.get(`${base}/partner-options`).then(r => r.data),

  partnerReport: (partner_id: number, params: {
    period?: string; date_from?: string; date_to?: string; page?: number; page_size?: number;
  }): Promise<PartnerReportResponse> =>
    apiClient.get(`${base}/partner/${partner_id}`, { params }).then(r => r.data),

  customers: (params: {
    period?: string; date_from?: string; date_to?: string;
    city_id?: number; search?: string; min_bookings?: number;
    page?: number; page_size?: number;
  }): Promise<CustomerReportResponse> =>
    apiClient.get(`${base}/customers`, { params }).then(r => r.data),
};
