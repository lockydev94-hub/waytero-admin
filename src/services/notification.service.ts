// ============================================================
// WAYTERO ADMIN PORTAL — NOTIFICATION SERVICE
// Doc Ref: BRD Part 7 §155 — Notification engine
//
// Same endpoints as the partner portal — both portals authenticate
// against the same /api/v1/notifications/me/* namespace; the server
// resolves the recipient from the JWT so admins see admin-side
// notifications and partners see partner-side ones.
// ============================================================

import apiClient from "./api";

export interface NotificationItem {
  id: number;
  event_type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  booking_id: number | null;
  delivered_via: string;
  read_at: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  unread_count: number;
}

export const notificationService = {
  list: async (params?: { unread_only?: boolean; limit?: number; offset?: number }) => {
    const res = await apiClient.get<NotificationListResponse>(
      "/notifications/me/notifications",
      { params }
    );
    return res.data;
  },

  unreadCount: async () => {
    const res = await apiClient.get<{ unread_count: number }>(
      "/notifications/me/notifications/unread-count"
    );
    return res.data.unread_count;
  },

  markRead: async (id: number) => {
    await apiClient.post(`/notifications/me/notifications/${id}/read`);
  },

  markAllRead: async () => {
    const res = await apiClient.post<{ marked: number }>(
      "/notifications/me/notifications/read-all"
    );
    return res.data;
  },
};
