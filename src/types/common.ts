// ============================================================
// WAYTERO ADMIN — COMMON TYPES
// Shared across all pages
// ============================================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export type Status = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING" | "BLOCKED";

export type BookingStatus = "DRAFT" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export interface SelectOption {
  label: string;
  value: string | number;
}
