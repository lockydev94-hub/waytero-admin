// ============================================================
// WAYTERO ADMIN — PARTNER SUPPORT SERVICE
// Doc Ref: 04_FINANCE_ACCOUNT.md AC4
// Partners raise tickets from the partner app; support staff
// triage them here.
//   GET   /admin/support-tickets
//   PATCH /admin/support-tickets/{id}
// ============================================================
import apiClient from "./api";

export type PartnerSupportStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type PartnerSupportPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface PartnerSupportTicket {
  id: number;
  ticket_number: string;
  partner_id: number;
  partner_code: string | null;
  business_name: string | null;
  owner_name: string | null;
  mobile: string | null;
  category: string;
  subject: string;
  description: string;
  booking_reference: string | null;
  priority: PartnerSupportPriority;
  status: PartnerSupportStatus;
  resolution_notes: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface PartnerSupportMessage {
  id: number;
  ticket_id: number;
  author_type: "PARTNER" | "ADMIN" | "SYSTEM";
  author_name: string | null;
  body: string;
  created_at: string;
}

export interface PartnerSupportTicketDetail extends PartnerSupportTicket {
  messages: PartnerSupportMessage[];
}

export interface PaginatedPartnerSupportTickets {
  items: PartnerSupportTicket[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface PartnerSupportUpdate {
  status?: PartnerSupportStatus;
  priority?: PartnerSupportPriority;
  resolution_notes?: string;
}

type ChipColor = "default" | "warning" | "info" | "success" | "error";

export const SUPPORT_STATUS_META: Record<
  PartnerSupportStatus,
  { label: string; color: ChipColor }
> = {
  OPEN: { label: "Open", color: "warning" },
  IN_PROGRESS: { label: "In progress", color: "info" },
  RESOLVED: { label: "Resolved", color: "success" },
  CLOSED: { label: "Closed", color: "default" },
};

export const SUPPORT_PRIORITY_META: Record<
  PartnerSupportPriority,
  { label: string; color: ChipColor }
> = {
  LOW: { label: "Low", color: "default" },
  NORMAL: { label: "Normal", color: "info" },
  HIGH: { label: "High", color: "warning" },
  URGENT: { label: "Urgent", color: "error" },
};

export const SUPPORT_CATEGORIES = [
  "APP",
  "PAYMENT",
  "TRIP_ISSUE",
  "DOCUMENT",
  "OTHER",
] as const;

const base = "/admin/support-tickets";

export const partnerSupportService = {
  list: (params?: {
    status?: PartnerSupportStatus;
    category?: string;
    priority?: PartnerSupportPriority;
    search?: string;
    page?: number;
    page_size?: number;
  }) =>
    apiClient
      .get<PaginatedPartnerSupportTickets>(base, { params })
      .then((r) => r.data),

  getDetail: (id: number) =>
    apiClient
      .get<PartnerSupportTicketDetail>(`${base}/${id}`)
      .then((r) => r.data),

  reply: (id: number, message: string) =>
    apiClient
      .post<PartnerSupportMessage>(`${base}/${id}/messages`, { message })
      .then((r) => r.data),

  update: (id: number, payload: PartnerSupportUpdate) =>
    apiClient
      .patch<
        Pick<
          PartnerSupportTicket,
          | "id"
          | "ticket_number"
          | "category"
          | "subject"
          | "description"
          | "booking_reference"
          | "priority"
          | "status"
          | "resolution_notes"
          | "created_at"
          | "updated_at"
          | "resolved_at"
        >
      >(`${base}/${id}`, payload)
      .then((r) => r.data),
};

export default partnerSupportService;
