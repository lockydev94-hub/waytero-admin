// ============================================================
// WAYTERO ADMIN — ACCOUNT DELETION REQUESTS SERVICE
// Doc Ref: Account Deletion — Admin Inbox
//   GET  /admin/account-deletion/requests
//   GET  /admin/account-deletion/requests/counts
//   POST /admin/account-deletion/requests/{id}/review
// ============================================================
import apiClient from "./api";

export type DeletionRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type DeletionRequestSource = "PUBLIC" | "LOGGED_IN";

export interface DeletionRequestItem {
  id: number;
  customer_user_id: string | null;
  customer_id: number | null;
  mobile: string;
  email: string | null;
  full_name: string | null;
  reason: string;
  request_source: DeletionRequestSource;
  status: DeletionRequestStatus;
  requested_at: string;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}

export interface PaginatedDeletionRequests {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: DeletionRequestItem[];
}

export interface DeletionRequestCounts {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

export interface ReviewDeletionResult {
  success: boolean;
  message: string;
  request_id: number;
  status: DeletionRequestStatus;
  deleted?: boolean;
  user_id?: string | null;
  anonymised?: boolean;
  note?: string | null;
}

const base = "/admin/account-deletion";

export const accountDeletionService = {
  listRequests: (params?: { status?: DeletionRequestStatus; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedDeletionRequests>(`${base}/requests`, { params }).then((r) => r.data),

  getCounts: () =>
    apiClient.get<DeletionRequestCounts>(`${base}/requests/counts`).then((r) => r.data),

  reviewRequest: (request_id: number, decision: "APPROVED" | "REJECTED", note?: string) =>
    apiClient.post<ReviewDeletionResult>(`${base}/requests/${request_id}/review`, { decision, note }).then((r) => r.data),
};

export default accountDeletionService;
