// ============================================================
// WAYTERO ADMIN — LIVE CHAT SERVICE
// Doc Ref: Website Chat §4 — Admin API
// Endpoints: /admin/chat
// The portal's chat board: conversation inbox, thread + customer
// context panel, replies, claim, close, and the presence heartbeat
// that keeps this admin "online" for smart customer routing.
// ============================================================
import apiClient from "./api";

// ── Types ─────────────────────────────────────────────────────

export type ChatStatus = "WAITING" | "OPEN" | "CLOSED";
export type ChatSenderType = "CUSTOMER" | "ADMIN" | "SYSTEM";
export type AdminPresenceStatus = "online" | "away" | "offline";

export interface ChatConversationItem {
  id: string;
  status: ChatStatus;
  subject: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_mobile: string | null;
  customer_user_id: string | null;
  assigned_admin_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_admin_count: number;
  unread_customer_count: number;
  created_at: string;
  customer_name: string | null;
  customer_mobile: string | null;
}

export interface ChatMessageItem {
  id: number;
  conversation_id: string;
  sender_type: ChatSenderType;
  sender_user_id: string | null;
  sender_name?: string | null;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface ChatCustomerContext {
  is_existing: boolean;
  profile: {
    id?: number | null;
    customer_code: string | null;
    first_name: string | null;
    last_name: string | null;
    created_at: string | null;
    mobile_number: string | null;
    email: string | null;
  } | null;
  recent_bookings: Array<Record<string, unknown>>;
  recent_payments: Array<Record<string, unknown>>;
  wallet: {
    available_balance: string | number;
    hold_balance: string | number;
    wallet_status: string;
  } | null;
}

export interface ChatConversationDetail {
  conversation: ChatConversationItem;
  messages: ChatMessageItem[];
  customer_context: ChatCustomerContext;
}

export interface PaginatedChatConversations {
  items: ChatConversationItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ── Service ───────────────────────────────────────────────────

const base = "/admin/chat";

export const chatService = {
  list: (params?: { status?: ChatStatus; q?: string; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedChatConversations>(`${base}/conversations`, { params }).then(r => r.data),

  get: (conversationId: string) =>
    apiClient.get<ChatConversationDetail>(`${base}/conversations/${conversationId}`).then(r => r.data),

  reply: (conversationId: string, body: string) =>
    apiClient.post<ChatMessageItem>(`${base}/conversations/${conversationId}/messages`, { body }).then(r => r.data),

  assign: (conversationId: string) =>
    apiClient.post<ChatConversationItem>(`${base}/conversations/${conversationId}/assign`).then(r => r.data),

  close: (conversationId: string) =>
    apiClient.post<ChatConversationItem>(`${base}/conversations/${conversationId}/close`).then(r => r.data),

  /** Presence heartbeat — keeps this admin in the online set used for
   *  smart routing. Called on portal open, every ~30s, and on close. */
  presence: (status: AdminPresenceStatus) =>
    apiClient.post<{ online: boolean }>(`${base}/presence`, { status }).then(r => r.data),
};