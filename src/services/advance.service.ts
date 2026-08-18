// ============================================================
// WAYTERO ADMIN — ADVANCE PAYMENT SERVICE
// Routes:
//   GET  /admin/advance/{booking_number}   — eligibility
//   POST /admin/advance/collect            — record advance
//   POST /admin/advance/void               — void advance (admin-only)
//   GET  /admin/advance/{booking_number}/receipt  — download PDF
// Doc Ref: BRD Part 3 §45
// ============================================================
import apiClient from "./api";

export interface AdvanceSummary {
  id: number;
  receipt_number: string;
  amount: number;
  payment_mode: string;
  received_by: string;
  reference_note: string | null;
  status: string;
  collected_by_role: string;
  collected_at: string | null;
}

export interface AdvanceEligibility {
  booking_number: string;
  advance: AdvanceSummary | null;
  can_collect: boolean;
  blocked_reason: string | null;
  allowed_receivers: string[];
  modes_by_receiver: Record<string, string[]>;
  max_amount: number;
  is_assigned: boolean;
  has_driver: boolean;
}

export interface CollectAdvancePayload {
  booking_number: string;
  amount: number;
  payment_mode: string;
  received_by: string;
  reference_note?: string;
}

export interface CollectAdvanceResponse {
  receipt_number: string;
  amount: number;
  payment_mode: string;
  received_by: string;
  collected_at: string | null;
  fare: number;
  balance_after_advance: number;
}

export interface VoidAdvancePayload {
  booking_number: string;
  reason: string;
}

export const advanceService = {
  getEligibility: (bookingNumber: string): Promise<AdvanceEligibility> =>
    apiClient
      .get<{ success: boolean; data: AdvanceEligibility }>(`/admin/advance/${bookingNumber}`)
      .then((r) => r.data.data),

  collect: (payload: CollectAdvancePayload): Promise<{ data: CollectAdvanceResponse; message: string }> =>
    apiClient
      .post<{ success: boolean; message: string; data: CollectAdvanceResponse }>("/admin/advance/collect", payload)
      .then((r) => ({ data: r.data.data, message: r.data.message })),

  voidAdvance: (payload: VoidAdvancePayload): Promise<void> =>
    apiClient.post("/admin/advance/void", payload).then(() => undefined),

  downloadReceipt: (bookingNumber: string): Promise<Blob> =>
    apiClient
      .get(`/admin/advance/${bookingNumber}/receipt`, { responseType: "blob" })
      .then((r) => r.data as Blob),
};
