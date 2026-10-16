// ============================================================
// WAYTERO ADMIN — CAB ROUTE SERVICE
// Endpoints: /admin/cab-routes  (per cab_route_api.py, migration 0079)
// A route owns its endpoints and the distance between them only.
// Vehicle prices are computed from the fare engine at read time, so there
// is no price field here to keep in sync.
// ============================================================
import apiClient from "./api";

const base = "/admin/cab-routes";

export type DistanceSource = "GOOGLE" | "HAVERSINE" | "MANUAL";

export interface RouteListItem {
  id: number;
  slug: string;
  origin_label: string;
  destination_label: string;
  origin_city_id: number | null;
  destination_city_id: number | null;
  pricing_city_id: number;
  pricing_city_name: string | null;
  distance_km: number;
  distance_source: DistanceSource;
  description: string;
  terms_and_conditions: string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  vehicle_count: number;
}

export interface RouteDetail extends RouteListItem {
  origin_city_name: string | null;
  destination_city_name: string | null;
  vehicle_category_ids: number[];
  vehicle_category_names: string[];
}

export interface RouteSavePayload {
  origin_label: string;
  destination_label: string;
  origin_city_id?: number | null;
  destination_city_id?: number | null;
  pricing_city_id?: number | null;
  /** Omit and the backend resolves it from Google Maps on save. */
  distance_km?: number | null;
  description: string;
  terms_and_conditions: string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  vehicle_category_ids: number[];
  slug?: string | null;
}

export type RouteUpdatePayload = Partial<RouteSavePayload>;

export interface FetchDistanceResult {
  distance_km: number;
  distance_source: DistanceSource;
}

export const routeService = {
  list: (params?: { is_active?: boolean; q?: string }) =>
    apiClient.get<RouteListItem[]>(base, { params }).then((r) => r.data),

  get: (id: number) =>
    apiClient.get<RouteDetail>(`${base}/${id}`).then((r) => r.data),

  create: (payload: RouteSavePayload) =>
    apiClient.post<RouteDetail>(base, payload).then((r) => r.data),

  update: (id: number, payload: RouteUpdatePayload) =>
    apiClient.put<RouteDetail>(`${base}/${id}`, payload).then((r) => r.data),

  delete: (id: number) => apiClient.delete(`${base}/${id}`),

  fetchDistance: (payload: {
    origin_label: string;
    destination_label: string;
    origin_city_id?: number | null;
    destination_city_id?: number | null;
  }) => apiClient.post<FetchDistanceResult>(`${base}/fetch-distance`, payload).then((r) => r.data),
};
