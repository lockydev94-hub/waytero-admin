// ============================================================
// WAYTERO ADMIN — WEBSITE CAPTURE SERVICE
// Doc Ref: Website Lead Capture §3 — Admin API
// Endpoints: /admin/capture
// The three public capture surfaces (enquiry rail, request-a-callback
// card, guest feedback page) land in these queues.
// ============================================================
import apiClient from "./api";

// ── Types ─────────────────────────────────────────────────────

export type EnquiryStatus = "NEW" | "CONTACTED" | "QUOTED" | "BOOKED" | "CLOSED";
export type CallbackStatus = "NEW" | "CALLED" | "NOT_PICKED" | "DONE";
export type QuotationStatus = "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED";
export type FeedbackStatus = "PENDING" | "APPROVED" | "REJECTED";
export type CaptureServiceType = "CAB" | "HOTEL" | "TOUR" | "OTHER";

type ChipColor = "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning";

export interface Paginated<T> {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: T[];
}

export interface CaptureStats {
  total: number;
  open: number;
  by_status: Record<string, number>;
}

export interface EnquiryItem {
  id: number;
  first_name: string;
  last_name: string | null;
  email: string;
  mobile: string;
  service_type: CaptureServiceType;
  message: string | null;
  status: EnquiryStatus;
  handle_note: string | null;
  source: string;
  handled_at: string | null;
  handler_email: string | null;
  quotation_count: number;
  customer_found: boolean;
  customer_id: number | null;
  created_at: string;
}

export interface QuotationItem {
  id: number;
  enquiry_id: number | null;
  customer_id: number | null;
  master_booking_id: number | null;
  service_type: CaptureServiceType | null;
  summary: string;
  /** Decimal serialised as a string — never parse it as a float. */
  amount: string;
  currency: string;
  valid_till: string | null;
  terms: string | null;
  status: QuotationStatus;
  created_at: string;
  created_by_email?: string | null;
}

export interface CallbackItem {
  id: number;
  name: string | null;
  mobile: string;
  status: CallbackStatus;
  handle_note: string | null;
  source: string;
  called_at: string | null;
  handler_email: string | null;
  customer_found: boolean;
  customer_id: number | null;
  created_at: string;
}

export interface FeedbackBooking {
  master_booking_id: number;
  booking_number: string;
  booking_status: string;
  payment_status: string;
  total_amount: string;
  journey_start_date: string | null;
  journey_end_date: string | null;
  city: string | null;
  /** "CAB:COMPLETED | HOTEL:CONFIRMED" — one entry per service line. */
  services: string;
  customer_id: number;
  customer_name: string;
  customer_mobile: string | null;
  customer_email: string | null;
}

export interface FeedbackItem {
  id: number;
  rating: number;
  review: string | null;
  status: FeedbackStatus;
  guest_name: string | null;
  guest_mobile: string | null;
  guest_email: string | null;
  booking_ref_submitted: string | null;
  rejection_reason: string | null;
  moderated_at: string | null;
  moderator_email: string | null;
  created_at: string;
  booking: FeedbackBooking;
}

// ── Chip metadata ─────────────────────────────────────────────

export const ENQUIRY_STATUS_META: Record<EnquiryStatus, { label: string; color: ChipColor }> = {
  NEW:        { label: "New",       color: "warning" },
  CONTACTED:  { label: "Contacted", color: "info"    },
  QUOTED:     { label: "Quoted",    color: "primary" },
  BOOKED:     { label: "Booked",    color: "success" },
  CLOSED:     { label: "Closed",    color: "default" },
};

export const CALLBACK_STATUS_META: Record<CallbackStatus, { label: string; color: ChipColor }> = {
  NEW:        { label: "New",         color: "warning" },
  CALLED:     { label: "Called",      color: "info"    },
  NOT_PICKED: { label: "Not picked",  color: "error"   },
  DONE:       { label: "Done",        color: "success" },
};

export const QUOTATION_STATUS_META: Record<QuotationStatus, { label: string; color: ChipColor }> = {
  DRAFT:    { label: "Draft",    color: "default" },
  SENT:     { label: "Sent",     color: "info"    },
  ACCEPTED: { label: "Accepted", color: "success" },
  DECLINED: { label: "Declined", color: "error"   },
  EXPIRED:  { label: "Expired",  color: "warning" },
};

export const FEEDBACK_STATUS_META: Record<FeedbackStatus, { label: string; color: ChipColor }> = {
  PENDING:  { label: "Pending",  color: "warning" },
  APPROVED: { label: "Approved", color: "success" },
  REJECTED: { label: "Rejected", color: "error"   },
};

export const SERVICE_TYPE_LABEL: Record<CaptureServiceType, string> = {
  CAB: "Cab", HOTEL: "Hotel", TOUR: "Tour", OTHER: "Other",
};

// ── Service ───────────────────────────────────────────────────

const base = "/admin/capture";

export const captureService = {
  // Enquiries
  listEnquiries: (params?: {
    status?: string;
    service_type?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }) =>
    apiClient.get<Paginated<EnquiryItem>>(`${base}/enquiries`, { params }).then(r => r.data),

  enquiryStats: () =>
    apiClient.get<CaptureStats>(`${base}/enquiries/stats`).then(r => r.data),

  updateEnquiry: (id: number, payload: { status?: string; handle_note?: string }) =>
    apiClient.patch<{ id: number; status: EnquiryStatus }>(`${base}/enquiries/${id}`, payload).then(r => r.data),

  // Quotations
  listQuotations: (params?: { enquiry_id?: number; status?: string; page?: number; page_size?: number }) =>
    apiClient.get<Paginated<QuotationItem>>(`${base}/quotations`, { params }).then(r => r.data),

  createQuotation: (
    enquiryId: number,
    payload: {
      summary: string;
      amount: string;
      service_type?: string;
      valid_till?: string;
      terms?: string;
      status?: string;
    },
  ) =>
    apiClient.post<QuotationItem>(`${base}/enquiries/${enquiryId}/quotation`, payload).then(r => r.data),

  updateQuotation: (
    id: number,
    payload: { status?: string; summary?: string; amount?: string; valid_till?: string; terms?: string },
  ) =>
    apiClient.patch<QuotationItem>(`${base}/quotations/${id}`, payload).then(r => r.data),

  // Callback requests
  listCallbacks: (params?: { status?: string; search?: string; page?: number; page_size?: number }) =>
    apiClient.get<Paginated<CallbackItem>>(`${base}/callbacks`, { params }).then(r => r.data),

  callbackStats: () =>
    apiClient.get<CaptureStats>(`${base}/callbacks/stats`).then(r => r.data),

  updateCallback: (id: number, payload: { status?: string; handle_note?: string }) =>
    apiClient.patch<{ id: number; status: CallbackStatus }>(`${base}/callbacks/${id}`, payload).then(r => r.data),

  // Guest feedback
  listFeedback: (params?: {
    status?: string;
    service_type?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }) =>
    apiClient.get<Paginated<FeedbackItem>>(`${base}/feedback`, { params }).then(r => r.data),

  approveFeedback: (id: number) =>
    apiClient.post<{ id: number; status: FeedbackStatus }>(`${base}/feedback/${id}/approve`, {}).then(r => r.data),

  rejectFeedback: (id: number, reason: string) =>
    apiClient.post<{ id: number; status: FeedbackStatus }>(`${base}/feedback/${id}/reject`, { reason }).then(r => r.data),
};
