// ============================================================
// WAYTERO ADMIN — NOTICES SERVICE
// Admin → partner notices (wallet low balance, driver-assign
// pending, document expiry, policy updates…). Published to all
// partners or a single partner; partners see a banner at the top
// of their portal and dismiss it per-partner.
//
//   POST /admin/notices                  create a notice
//   GET  /admin/notices                  list with read stats
//   GET  /admin/notices/stats            counts for the header
//   POST /admin/notices/{id}/archive     hide a notice
// ============================================================
import apiClient from "./api";

export const NOTICE_TYPES: { code: string; label: string; desc: string }[] = [
  { code: "WALLET_LOW_BALANCE", label: "Wallet low balance", desc: "Partner wallet below the minimum for new bookings" },
  { code: "BOOKING_ACTION_REQUIRED", label: "Booking action required", desc: "e.g. cab booking driver-assign pending, hotel confirmation" },
  { code: "DOCUMENT_EXPIRY", label: "Document expiry", desc: "Vehicle / driver documents expiring or rejected" },
  { code: "SETTLEMENT", label: "Settlement", desc: "Settlement processed, failed or awaiting details" },
  { code: "POLICY_UPDATE", label: "Policy update", desc: "Cancellation, commission or operational policy changes" },
  { code: "GENERAL_ANNOUNCEMENT", label: "General announcement", desc: "Platform-wide announcements and reminders" },
];

export interface NoticeItem {
  id: number;
  notice_type: string;
  title: string;
  body: string | null;
  priority: "NORMAL" | "HIGH" | "URGENT";
  audience: "ALL_PARTNERS" | "PARTNER";
  partner_id: number | null;
  partner_name: string | null;
  status: "ACTIVE" | "ARCHIVED";
  created_by_name: string | null;
  reads: number;
  read_pct: number;
  created_at: string | null;
}

export interface NoticesPageData {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: NoticeItem[];
}

export interface NoticeStats {
  active: number;
  archived: number;
  total: number;
}

export const noticesService = {
  async list(params?: { status?: string; notice_type?: string; page?: number; page_size?: number }): Promise<NoticesPageData> {
    const res = await apiClient.get("/admin/notices", { params });
    return res.data.data ?? res.data;
  },

  async stats(): Promise<NoticeStats> {
    const res = await apiClient.get("/admin/notices/stats");
    return res.data.data ?? res.data;
  },

  async create(payload: {
    notice_type: string;
    title: string;
    body?: string;
    priority: string;
    audience: string;
    partner_id?: number | null;
  }): Promise<{ success: boolean; notice_id: number }> {
    const res = await apiClient.post("/admin/notices", payload);
    return res.data.data ?? res.data;
  },

  async archive(id: number): Promise<{ success: boolean }> {
    const res = await apiClient.post(`/admin/notices/${id}/archive`);
    return res.data.data ?? res.data;
  },
};
