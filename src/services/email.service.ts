// ============================================================
// WAYTERO ADMIN — EMAIL SERVICE
// Doc Ref: Backend /admin/email/* — SMTP config, test send,
//          transaction logs + resend
// ============================================================
import apiClient from "./api";

// ── Types ─────────────────────────────────────────────────────

export interface EmailSettings {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  password_set: boolean;
  password: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
  configured: boolean;
  platform_name: string;
  logo_url: string;
  support_email: string;
  support_phone: string;
  web_url: string;
}

export interface EmailLogItem {
  id: number;
  event_type: string;
  event_label: string;
  recipient: string;
  recipient_name: string | null;
  subject: string;
  status: "SENT" | "FAILED";
  error_message: string | null;
  attempt_count: number;
  related_type: string | null;
  related_id: string | null;
  sent_at: string | null;
  created_at: string | null;
  payload?: Record<string, unknown> | null;
}

export interface EmailLogsPage {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: EmailLogItem[];
}

export interface EmailStats {
  sent: number;
  failed: number;
  total: number;
}

// ── Settings ──────────────────────────────────────────────────

export const emailService = {
  async getSettings(): Promise<EmailSettings> {
    const res = await apiClient.get("/admin/email/settings");
    return res.data.data ?? res.data;
  },

  async saveSettings(
    payload: Partial<
      Pick<
        EmailSettings,
        "enabled" | "host" | "port" | "user" | "password" | "from_email" | "from_name" | "use_tls"
      >
    >
  ): Promise<EmailSettings> {
    const res = await apiClient.put("/admin/email/settings", payload);
    return res.data.data ?? res.data;
  },

  async sendTest(to_email: string): Promise<{ success: boolean; message: string; log_id: number }> {
    const res = await apiClient.post("/admin/email/test", { to_email });
    return res.data.data ?? res.data;
  },

  // ── Logs ────────────────────────────────────────────────────

  async getLogs(params: {
    status?: string;
    event_type?: string;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<EmailLogsPage> {
    const res = await apiClient.get("/admin/email/logs", { params });
    return res.data.data ?? res.data;
  },

  async getStats(): Promise<EmailStats> {
    const res = await apiClient.get("/admin/email/logs/stats");
    return res.data.data ?? res.data;
  },

  async getLogDetail(id: number): Promise<EmailLogItem> {
    const res = await apiClient.get(`/admin/email/logs/${id}`);
    return res.data.data ?? res.data;
  },

  async resend(id: number): Promise<{ success: boolean; message: string; log_id: number }> {
    const res = await apiClient.post(`/admin/email/logs/${id}/resend`);
    return res.data.data ?? res.data;
  },
};
