// ============================================================
// WAYTERO ADMIN — OFFER SERVICE
// Endpoints: /admin/offers  (per offer_api.py, migration 0077)
// Offers are marketing wrappers over coupons — no discount math here.
// ============================================================
import apiClient from "./api";

const base = "/admin/offers";

export type OfferServiceType = "CAB" | "HOTEL" | "TOUR";

export interface OfferListItem {
  id: number;
  slug: string;
  title: string;
  service_type: OfferServiceType;
  image_url: string;
  badge_label: string | null;
  badge: string;
  valid_from: string;
  valid_to: string;
  is_published: boolean;
  sort_order: number;
  coupon_code: string;
  coupon_type: string;
  coupon_active: boolean;
  discount_type: string;
  discount_value: number;
  max_discount_amount: number | null;
  vehicle_category_id: number | null;
  hotel_links: number;
  tour_links: number;
  exit_requests: number;
  status: "LIVE" | "SCHEDULED" | "EXPIRED" | "DRAFT";
}

export interface OfferRoomType {
  id: number;
  name: string;
}

export interface OfferHotelLink {
  link_id: number;
  hotel_id: number;
  status: "ACTIVE" | "EXIT_REQUESTED" | "REMOVED";
  exit_requested_at: string | null;
  exit_reason: string | null;
  hotel_name: string;
  slug: string;
  city_id: number;
  partner_id: number;
  room_types: OfferRoomType[];
}

export interface OfferTourLink {
  link_id: number;
  tour_package_id: number;
  status: "ACTIVE" | "EXIT_REQUESTED" | "REMOVED";
  exit_requested_at: string | null;
  exit_reason: string | null;
  package_name: string;
  slug: string;
  destination: string | null;
  city_id: number;
  partner_id: number;
}

export interface OfferDetail {
  id: number;
  slug: string;
  coupon_id: number;
  coupon_code: string | null;
  coupon_type: string | null;
  discount_type: string | null;
  discount_value: number | null;
  max_discount_amount: number | null;
  min_booking_amount: number | null;
  service_type: OfferServiceType;
  vehicle_category_id: number | null;
  vehicle_category_name: string | null;
  title: string;
  short_description: string | null;
  terms_and_conditions: string;
  image_url: string;
  badge_label: string | null;
  badge: string | null;
  valid_from: string;
  valid_to: string;
  is_published: boolean;
  sort_order: number;
  is_live: boolean;
  hotels: OfferHotelLink[];
  tour_packages: OfferTourLink[];
}

export interface EligibleCoupon {
  coupon_id: number;
  coupon_code: string;
  title: string;
  coupon_type: string;
  valid_from: string;
  valid_to: string;
  eligible: boolean;
  reasons: string[];
  partner: { partner_id: number; in_cohort: boolean; granted: boolean } | null;
}

export interface OfferHotelIn {
  hotel_id: number;
  room_category_ids: number[];
}

export interface OfferCreatePayload {
  coupon_id: number;
  service_type: OfferServiceType;
  vehicle_category_id?: number | null;
  title: string;
  slug?: string | null;
  short_description?: string | null;
  terms_and_conditions: string;
  image_url: string;
  badge_label?: string | null;
  valid_from: string;
  valid_to: string;
  is_published: boolean;
  sort_order: number;
  hotels?: OfferHotelIn[];
  tour_package_ids?: number[];
}

export type OfferUpdatePayload = Partial<Omit<OfferCreatePayload, "hotels" | "tour_package_ids">>;

export const offerService = {
  list: (params?: { is_published?: boolean; service_type?: string }) =>
    apiClient.get<OfferListItem[]>(base, { params }).then((r) => r.data),

  get: (id: number) =>
    apiClient.get<OfferDetail>(`${base}/${id}`).then((r) => r.data),

  create: (payload: OfferCreatePayload) =>
    apiClient.post<OfferDetail>(base, payload).then((r) => r.data),

  update: (id: number, payload: OfferUpdatePayload) =>
    apiClient.put<OfferDetail>(`${base}/${id}`, payload).then((r) => r.data),

  delete: (id: number) => apiClient.delete(`${base}/${id}`),

  eligibleCoupons: (params: {
    service_type: OfferServiceType;
    vehicle_category_id?: number;
    hotel_id?: number;
    tour_package_id?: number;
  }) =>
    apiClient
      .get<{ service_type: string; items: EligibleCoupon[] }>(`${base}/eligible-coupons`, { params })
      .then((r) => r.data.items),

  linkHotel: (id: number, payload: OfferHotelIn) =>
    apiClient.post<OfferDetail>(`${base}/${id}/hotels`, payload).then((r) => r.data),

  setRoomTypes: (id: number, hotelId: number, roomCategoryIds: number[]) =>
    apiClient
      .put<OfferDetail>(`${base}/${id}/hotels/${hotelId}/room-types`, { room_category_ids: roomCategoryIds })
      .then((r) => r.data),

  unlinkHotel: (id: number, hotelId: number) =>
    apiClient.delete(`${base}/${id}/hotels/${hotelId}`).then((r) => r.data),

  resolveHotelExit: (id: number, hotelId: number, approve: boolean) =>
    apiClient.put<OfferDetail>(`${base}/${id}/hotels/${hotelId}/exit`, { approve }).then((r) => r.data),

  linkTour: (id: number, tourPackageId: number) =>
    apiClient.post<OfferDetail>(`${base}/${id}/tours`, { tour_package_id: tourPackageId }).then((r) => r.data),

  unlinkTour: (id: number, tourPackageId: number) =>
    apiClient.delete(`${base}/${id}/tours/${tourPackageId}`).then((r) => r.data),

  resolveTourExit: (id: number, tourPackageId: number, approve: boolean) =>
    apiClient.put<OfferDetail>(`${base}/${id}/tours/${tourPackageId}/exit`, { approve }).then((r) => r.data),
};
