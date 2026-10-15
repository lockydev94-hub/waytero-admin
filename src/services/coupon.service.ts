// ============================================================
// WAYTERO ADMIN — COUPON SERVICE
// Endpoints: /admin/coupons  (per coupon_api.py)
// ============================================================
import apiClient from "./api";

const base = "/admin/coupons";

export type CouponType = "PLATFORM" | "PARTNER_ONLY" | "PLATFORM_PARTNER";

export const COUPON_TYPE_LABELS: Record<CouponType, string> = {
  PLATFORM: "Platform funded",
  PARTNER_ONLY: "Partner funded",
  PLATFORM_PARTNER: "Platform + partner split",
};

export interface CouponPartnerRule {
  id: number;
  partner_id: number;
  joined_at: string;
  is_active: boolean;
}

export interface CouponPartnerActivity {
  partner_id: number;
  business_name: string | null;
  partner_status: string;
  joined_at: string;
  is_active: boolean;
  offered_count: number;
  accepted_count: number;
  declined_count: number;
  declined_with_cabs: number;
  can_remove: boolean;
  declines: {
    booking_number: string;
    rejected_at: string | null;
    reason_code: string | null;
    available_cabs_at_decline: number | null;
  }[];
}

export interface CouponPartnersResponse {
  coupon_id: number;
  coupon_type: CouponType;
  items: CouponPartnerActivity[];
}

export interface CouponServiceRule {
  id: number;
  service_type: string;
  vehicle_category_id: number | null;
}
export interface CouponCityRule {
  id: number;
  city_id: number;
  max_discount_override: number | null;
}
export interface CouponCustomerRule {
  id: number;
  mobile_number: string;
  customer_id: number | null;
}
export interface Coupon {
  id: number;
  coupon_code: string;
  coupon_type: CouponType;
  platform_share_percent: number | null;
  partner_rules: CouponPartnerRule[];
  title: string;
  description: string | null;
  apply_to: string;
  discount_type: string;
  discount_value: number;
  max_discount_amount: number | null;
  min_booking_amount: number;
  max_usage_total: number | null;
  max_usage_per_customer: number;
  current_usage_count: number;
  valid_from: string;
  valid_to: string;
  is_customer_specific: boolean;
  is_city_specific: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  service_rules: CouponServiceRule[];
  city_rules: CouponCityRule[];
  customer_rules: CouponCustomerRule[];
}
export interface CouponUsageRecord {
  id: number;
  customer_id: number;
  master_booking_id: number | null;
  discount_applied: number;
  used_at: string;
}

export interface CouponUsagePaginatedResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: CouponUsageRecord[];
}
export interface CouponCreatePayload {
  coupon_code: string;
  coupon_type: CouponType;
  platform_share_percent: number | null;
  partner_ids: number[];
  title: string;
  description?: string;
  apply_to: string;
  discount_type: string;
  discount_value: number;
  max_discount_amount?: number | null;
  min_booking_amount: number;
  max_usage_total?: number | null;
  max_usage_per_customer: number;
  valid_from: string;
  valid_to: string;
  is_customer_specific: boolean;
  is_city_specific: boolean;
  service_rules: { service_type: string; vehicle_category_id?: number | null }[];
  city_rules: { city_id: number; max_discount_override?: number | null }[];
  customer_mobiles: string[];
}

export const couponService = {
  list: (params?: { is_active?: boolean; apply_to?: string }) =>
    apiClient.get<Coupon[]>(base, { params }).then((r) => r.data),

  get: (id: number) =>
    apiClient.get<Coupon>(`${base}/${id}`).then((r) => r.data),

  create: (payload: CouponCreatePayload) =>
    apiClient.post<Coupon>(base, payload).then((r) => r.data),

  update: (id: number, payload: Partial<CouponCreatePayload> & { is_active?: boolean }) =>
    apiClient.put<Coupon>(`${base}/${id}`, payload).then((r) => r.data),

  delete: (id: number) => apiClient.delete(`${base}/${id}`),

  partners: (id: number) =>
    apiClient.get<CouponPartnersResponse>(`${base}/${id}/partners`).then((r) => r.data),

  removePartner: (id: number, partnerId: number) =>
    apiClient.delete(`${base}/${id}/partners/${partnerId}`).then((r) => r.data),

  usages: (id: number, page = 1, pageSize = 20) =>
    apiClient
      .get<CouponUsagePaginatedResponse>(`${base}/${id}/usages`, {
        params: { page, page_size: pageSize },
      })
      .then((r) => r.data),
};
