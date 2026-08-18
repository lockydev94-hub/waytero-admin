// ============================================================
// WAYTERO ADMIN — COUPON SERVICE
// Endpoints: /admin/coupons  (per coupon_api.py)
// ============================================================
import axios from "axios";
import { API_BASE_URL } from "../constants";

const base = `${API_BASE_URL}/admin/coupons`;

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

function authHeader() {
  const token = localStorage.getItem("wt_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const couponService = {
  list: (params?: { is_active?: boolean; apply_to?: string }) =>
    axios.get<Coupon[]>(base, { headers: authHeader(), params }).then((r) => r.data),

  get: (id: number) =>
    axios.get<Coupon>(`${base}/${id}`, { headers: authHeader() }).then((r) => r.data),

  create: (payload: CouponCreatePayload) =>
    axios.post<Coupon>(base, payload, { headers: authHeader() }).then((r) => r.data),

  update: (id: number, payload: Partial<CouponCreatePayload> & { is_active?: boolean }) =>
    axios.put<Coupon>(`${base}/${id}`, payload, { headers: authHeader() }).then((r) => r.data),

  delete: (id: number) =>
    axios.delete(`${base}/${id}`, { headers: authHeader() }),

  usages: (id: number, page = 1, pageSize = 20) =>
    axios
      .get<CouponUsagePaginatedResponse>(`${base}/${id}/usages`, {
        headers: authHeader(),
        params: { page, page_size: pageSize },
      })
      .then((r) => r.data),
};
