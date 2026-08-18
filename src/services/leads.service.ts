// ============================================================
// WAYTERO ADMIN — WEBSITE LEADS SERVICE
// Doc Ref: Website Lead Capture §3 — Admin API
// Endpoints: /admin/leads
// Partner applications (from /partner form) + contact messages
// (from /contact form). Admin reviews them here.
// ============================================================
import apiClient from "./api";

// ── Types ─────────────────────────────────────────────────────

export type ApplicationStatus = "NEW" | "CONTACTED" | "CONVERTED" | "REJECTED";

export interface PartnerApplicationItem {
  id: number;
  business_name: string;
  business_type: string;
  contact_person: string;
  mobile: string;
  email: string;
  city: string | null;
  details: string | null;
  status: ApplicationStatus;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  reviewer_mobile: string | null;
}

export interface PaginatedPartnerApplications {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: PartnerApplicationItem[];
}

export interface PartnerApplicationStats {
  new: number;
  contacted: number;
  converted: number;
  rejected: number;
  total: number;
}

export interface ContactMessageItem {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  subject: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface PaginatedContactMessages {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: ContactMessageItem[];
}

export interface ContactMessageStats {
  unread: number;
  total: number;
}

export const APPLICATION_STATUS_META: Record<ApplicationStatus, { label: string; color: "warning" | "info" | "success" | "error" }> = {
  NEW:       { label: "New",       color: "warning" },
  CONTACTED: { label: "Contacted", color: "info"    },
  CONVERTED: { label: "Converted", color: "success" },
  REJECTED:  { label: "Rejected",  color: "error"   },
};

// ── Service ───────────────────────────────────────────────────

const base = "/admin/leads";

export const leadsService = {
  // Partner applications
  listPartnerApplications: (params?: {
    status?: string;
    business_type?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }) =>
    apiClient
      .get<PaginatedPartnerApplications>(`${base}/partner-applications`, { params })
      .then(r => r.data),

  getPartnerApplicationStats: () =>
    apiClient.get<PartnerApplicationStats>(`${base}/partner-applications/stats`).then(r => r.data),

  updatePartnerApplication: (id: number, payload: { status?: string; admin_notes?: string }) =>
    apiClient.patch<{ id: number; status: string; admin_notes: string | null; updated_at: string }>(
      `${base}/partner-applications/${id}`,
      payload,
    ).then(r => r.data),

  // Contact messages
  listContactMessages: (params?: { read?: boolean; search?: string; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedContactMessages>(`${base}/contact-messages`, { params }).then(r => r.data),

  getContactMessageStats: () =>
    apiClient.get<ContactMessageStats>(`${base}/contact-messages/stats`).then(r => r.data),

  markContactMessageRead: (id: number, read: boolean) =>
    apiClient.patch<{ id: number; is_read: boolean }>(`${base}/contact-messages/${id}/read`, null, {
      params: { read },
    }).then(r => r.data),
};
