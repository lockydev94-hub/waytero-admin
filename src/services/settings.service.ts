// ============================================================
// WAYTERO ADMIN — SETTINGS SERVICE
// Doc Ref: Backend Settings API — /admin/settings/*
//   DB Schema Part 1 §12-14 | Part 2 §14-15 | Part 3 §18 | Part 8 §11
// ============================================================
import apiClient from "./api";

// ── Types ─────────────────────────────────────────────────────

export interface SystemConfig {
  id: number;
  config_key: string;
  config_value: string | null;
  description: string | null;
  updated_at: string;
}

export interface AppVersion {
  id: number;
  platform: "ANDROID" | "IOS";
  version: string;
  is_force_update: boolean;
  release_notes: string | null;
  created_at: string;
}

export interface CommissionRule {
  id: number;
  service_type: string;
  commission_type: "PERCENTAGE" | "FLAT";
  commission_value: number;
  city_id: number | null;
  effective_from: string | null;
  effective_to: string | null;
  is_active: boolean;
}

export interface CommissionGroup {
  id: number;
  group_name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  rules: CommissionRule[];
}

export interface VehiclePricingRule {
  id: number;
  city_id: number;
  vehicle_category_id: number;
  trip_type: string;
  base_fare: number;
  minimum_km: number | null;
  per_km_rate: number;
  driver_allowance: number | null;
  driver_allowance_type: string | null;
  night_charge: number | null;
  night_charge_type: string | null;
  toll: number | null;
  gst_rate: number | null;
  effective_from: string | null;
  effective_to: string | null;
}

export interface NotificationTemplate {
  id: number;
  template_code: string;
  channel: "SMS" | "EMAIL" | "PUSH" | "IN_APP";
  template_name: string;
  template_content: string;
  is_active: boolean;
  created_at: string;
}

// ── API Calls ─────────────────────────────────────────────────

export const settingsService = {
  // System Configurations
  getConfigurations: () => apiClient.get<SystemConfig[]>("/admin/settings/configurations").then(r => r.data),
  upsertConfiguration: (key: string, config_value: string, description?: string) =>
    apiClient.put<SystemConfig>(`/admin/settings/configurations/${key}`, { config_value, description }).then(r => r.data),
  deleteConfiguration: (key: string) =>
    apiClient.delete(`/admin/settings/configurations/${key}`).then(r => r.data),

  // App Versions
  getAppVersions: () => apiClient.get<AppVersion[]>("/admin/settings/app-versions").then(r => r.data),
  createAppVersion: (data: Partial<AppVersion>) =>
    apiClient.post<AppVersion>("/admin/settings/app-versions", data).then(r => r.data),
  updateAppVersion: (id: number, data: Partial<AppVersion>) =>
    apiClient.patch<AppVersion>(`/admin/settings/app-versions/${id}`, data).then(r => r.data),
  deleteAppVersion: (id: number) =>
    apiClient.delete(`/admin/settings/app-versions/${id}`).then(r => r.data),

  // Commission Groups
  getCommissionGroups: () => apiClient.get<CommissionGroup[]>("/admin/settings/commission-groups").then(r => r.data),
  createCommissionGroup: (data: { group_name: string; description?: string }) =>
    apiClient.post<CommissionGroup>("/admin/settings/commission-groups", data).then(r => r.data),
  updateCommissionGroup: (id: number, data: Partial<CommissionGroup>) =>
    apiClient.patch<CommissionGroup>(`/admin/settings/commission-groups/${id}`, data).then(r => r.data),
  deleteCommissionGroup: (id: number) =>
    apiClient.delete(`/admin/settings/commission-groups/${id}`).then(r => r.data),
  addCommissionRule: (groupId: number, data: Partial<CommissionRule>) =>
    apiClient.post<CommissionRule>(`/admin/settings/commission-groups/${groupId}/rules`, data).then(r => r.data),
  updateCommissionRule: (ruleId: number, data: Partial<CommissionRule>) =>
    apiClient.patch<CommissionRule>(`/admin/settings/commission-rules/${ruleId}`, data).then(r => r.data),
  deleteCommissionRule: (ruleId: number) =>
    apiClient.delete(`/admin/settings/commission-rules/${ruleId}`).then(r => r.data),

  // Vehicle Pricing Rules
  getPricingRules: (params?: { city_id?: number; trip_type?: string }) =>
    apiClient.get<VehiclePricingRule[]>("/admin/settings/pricing-rules", { params }).then(r => r.data),
  createPricingRule: (data: Partial<VehiclePricingRule>) =>
    apiClient.post<VehiclePricingRule>("/admin/settings/pricing-rules", data).then(r => r.data),
  updatePricingRule: (id: number, data: Partial<VehiclePricingRule>) =>
    apiClient.patch<VehiclePricingRule>(`/admin/settings/pricing-rules/${id}`, data).then(r => r.data),
  deletePricingRule: (id: number) =>
    apiClient.delete(`/admin/settings/pricing-rules/${id}`).then(r => r.data),

  // Notification Templates
  getNotificationTemplates: (channel?: string) =>
    apiClient.get<NotificationTemplate[]>("/admin/settings/notification-templates", {
      params: channel ? { channel } : {}
    }).then(r => r.data),
  createNotificationTemplate: (data: Partial<NotificationTemplate>) =>
    apiClient.post<NotificationTemplate>("/admin/settings/notification-templates", data).then(r => r.data),
  updateNotificationTemplate: (id: number, data: Partial<NotificationTemplate>) =>
    apiClient.patch<NotificationTemplate>(`/admin/settings/notification-templates/${id}`, data).then(r => r.data),
  deleteNotificationTemplate: (id: number) =>
    apiClient.delete(`/admin/settings/notification-templates/${id}`).then(r => r.data),
};

// ── API Integration types ──────────────────────────────────────
export interface ApiIntegration {
  id: number;
  service_name: string;
  service_type: string; // CLOUDINARY | FIREBASE | GOOGLE_MAPS | RAZORPAY | MSG91 | ...
  configuration: Record<string, string>; // JSONB — returned as object by backend
  is_active: boolean;
  created_at: string;
}

// extend settingsService
Object.assign(settingsService, {
  // API Integrations
  getApiIntegrations: () =>
    apiClient.get<ApiIntegration[]>("/admin/settings/api-integrations").then(r => r.data),
  createApiIntegration: (data: { service_name: string; service_type: string; configuration: Record<string, string>; is_active: boolean }) =>
    apiClient.post<ApiIntegration>("/admin/settings/api-integrations", data).then(r => r.data),
  updateApiIntegration: (id: number, data: { service_name?: string; configuration?: Record<string, string>; is_active?: boolean }) =>
    apiClient.patch<ApiIntegration>(`/admin/settings/api-integrations/${id}`, data).then(r => r.data),
  deleteApiIntegration: (id: number) =>
    apiClient.delete(`/admin/settings/api-integrations/${id}`).then(r => r.data),
});

// ── Master Data (Cities + Vehicle Categories) ──────────────────────────────
// Doc Ref: Admin API §17 | DB Schema Part 1 §11, Part 3 §10-11

export interface State {
  id: number;
  name: string;
  state_code: string | null;
  is_active: boolean;
  country_id: number;
}

export interface City {
  id: number;
  name: string;
  city_code: string | null;
  is_active: boolean;
  state_id: number;
  state_name: string | null;
  // City-centre coordinates (migration 0046). Used by customer-web to bias
  // Google Places autocomplete. Nullable — admin sets them via the
  // "Find coordinates" button in the city editor.
  latitude: number | null;
  longitude: number | null;
}

export interface GeocodeCityResult {
  latitude: number;
  longitude: number;
  formatted_address: string;
}

export interface VehicleCategory {
  id: number;
  category_name: string;
  seating_capacity: number | null;
  luggage_capacity: number | null;
  is_active: boolean;
  created_at: string;
  // Media (migration 0018)
  image_url:  string | null;
  icon_url:   string | null;
  // SEO (migration 0018)
  seo_title:       string | null;
  seo_description: string | null;
  seo_keywords:    string | null;
  display_order:   number;
}

// service_type values (fixed enum per Doc Ref: DB Schema Part 2 §8)
export const SERVICE_TYPES = ["CAB", "HOTEL", "TOUR"] as const;
export type ServiceType = typeof SERVICE_TYPES[number];

// Dynamic service type record (Migration 0019 — service_types table)
export interface ServiceTypeRecord {
  id: number;
  type_code: string;       // CAB | HOTEL | TOUR — immutable
  label: string;
  description: string | null;
  icon_url: string | null;
  image_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

Object.assign(settingsService, {
  // States (read-only, for city form)
  getStates: () =>
    apiClient.get<State[]>("/admin/settings/master/states").then(r => r.data),

  // Cities
  getCities: (activeOnly = false) =>
    apiClient.get<City[]>("/admin/settings/master/cities", {
      params: activeOnly ? { active_only: true } : {}
    }).then(r => r.data),

  createCity: (
    data: {
      name: string;
      city_code?: string;
      state_id: number;
      is_active?: boolean;
      latitude?: number | null;
      longitude?: number | null;
    },
  ) =>
    apiClient.post<City>("/admin/settings/master/cities", data).then(r => r.data),

  updateCity: (
    id: number,
    data: {
      name?: string;
      city_code?: string;
      is_active?: boolean;
      latitude?: number | null;
      longitude?: number | null;
    },
  ) =>
    apiClient.patch<City>(`/admin/settings/master/cities/${id}`, data).then(r => r.data),

  deleteCity: (id: number) =>
    apiClient.delete(`/admin/settings/master/cities/${id}`).then(r => r.data),

  /**
   * Resolve a city's lat/lng using the admin-configured Google Maps key
   * via the backend's `POST /admin/settings/master/cities/geocode` endpoint.
   * Used by the City editor's "Find coordinates" button so admins never
   * have to leave the page or paste a key.
   */
  geocodeCity: (name: string, state_name?: string): Promise<GeocodeCityResult> =>
    apiClient
      .post<GeocodeCityResult>("/admin/settings/master/cities/geocode", {
        name,
        state_name,
      })
      .then(r => r.data),

  // Vehicle Categories (CAB booking assets)
  getVehicleCategories: (activeOnly = false) =>
    apiClient.get<VehicleCategory[]>("/admin/settings/master/vehicle-categories", {
      params: activeOnly ? { active_only: true } : {}
    }).then(r => r.data),

  createVehicleCategory: (data: {
    category_name: string; seating_capacity?: number; luggage_capacity?: number;
    image_url?: string; icon_url?: string;
    seo_title?: string; seo_description?: string; seo_keywords?: string;
    display_order?: number;
  }) =>
    apiClient.post<VehicleCategory>("/admin/settings/master/vehicle-categories", data).then(r => r.data),

  updateVehicleCategory: (id: number, data: {
    category_name?: string; seating_capacity?: number; luggage_capacity?: number; is_active?: boolean;
    image_url?: string | null; icon_url?: string | null;
    seo_title?: string | null; seo_description?: string | null; seo_keywords?: string | null;
    display_order?: number;
  }) =>
    apiClient.patch<VehicleCategory>(`/admin/settings/master/vehicle-categories/${id}`, data).then(r => r.data),

  deleteVehicleCategory: (id: number) =>
    apiClient.delete(`/admin/settings/master/vehicle-categories/${id}`).then(r => r.data),

  // Service Types (dynamic — migration 0019)
  getServiceTypes: (activeOnly = false) =>
    apiClient.get<ServiceTypeRecord[]>("/admin/settings/master/service-types", {
      params: activeOnly ? { active_only: true } : {}
    }).then(r => r.data),

  updateServiceType: (id: number, data: {
    label?: string; description?: string | null;
    icon_url?: string | null; image_url?: string | null;
    seo_title?: string | null; seo_description?: string | null;
    seo_keywords?: string | null; display_order?: number; is_active?: boolean;
  }) =>
    apiClient.patch<ServiceTypeRecord>(`/admin/settings/master/service-types/${id}`, data).then(r => r.data),

  createServiceType: (data: {
    type_code: string; label: string; description?: string | null;
    icon_url?: string | null; image_url?: string | null;
    seo_title?: string | null; seo_description?: string | null;
    seo_keywords?: string | null; display_order?: number; is_active?: boolean;
  }) =>
    apiClient.post<ServiceTypeRecord>('/admin/settings/master/service-types', data).then(r => r.data),

  deleteServiceType: (id: number) =>
    apiClient.delete(`/admin/settings/master/service-types/${id}`).then(r => r.data),
});

// ── Default Vehicle Pricing Rules ──────────────────────────────────────────
// Doc Ref: Backend API — /admin/settings/default-pricing-rules
//   BRD Part 3 §35 — Fare engine must never hardcode values
//   BRD Part 3 §36 — City-based pricing with platform-level fallback
//
// These are the PLATFORM DEFAULT prices used when no city-specific rule exists.
// Admin can view and update them in Settings → Vehicle Pricing Rules → "Default Pricing" section.

export interface DefaultPricingRule {
  id: number;
  vehicle_category_id: number;
  trip_type: "LOCAL" | "AIRPORT" | "OUTSTATION" | "ONE_WAY" | "ROUND_TRIP";
  base_fare: number;
  minimum_km: number;
  per_km_rate: number;
  driver_allowance: number;
  driver_allowance_type: string;
  night_charge: number;
  night_charge_type: string;
  toll: number;
  gst_rate: number;
  updated_at: string;
}

export interface EffectivePricingRule {
  vehicle_category_id: number;
  trip_type: string;
  base_fare: number;
  minimum_km: number;
  per_km_rate: number;
  driver_allowance: number;
  driver_allowance_type: string;
  night_charge: number;
  night_charge_type: string;
  toll: number;
  gst_rate: number;
  source: "city_specific" | "default"; // tells caller which layer was used
}

export const TRIP_TYPES = ["LOCAL", "AIRPORT", "OUTSTATION", "ONE_WAY", "ROUND_TRIP"] as const;
export type TripType = typeof TRIP_TYPES[number];

Object.assign(settingsService, {
  // List all default pricing rules (ordered by category + trip_type)
  getDefaultPricingRules: (): Promise<DefaultPricingRule[]> =>
    apiClient
      .get<DefaultPricingRule[]>("/admin/settings/default-pricing-rules")
      .then((r) => r.data),

  // Inline-edit a single default pricing row
  updateDefaultPricingRule: (
    id: number,
    data: Partial<Pick<DefaultPricingRule, "base_fare" | "minimum_km" | "per_km_rate" | "driver_allowance" | "driver_allowance_type" | "night_charge" | "night_charge_type" | "toll" | "gst_rate">>
  ): Promise<DefaultPricingRule> =>
    apiClient
      .patch<DefaultPricingRule>(`/admin/settings/default-pricing-rules/${id}`, data)
      .then((r) => r.data),

  // Booking engine helper — returns the effective price for a trip (city-specific or default)
  getEffectivePricingRule: (
    city_id: number,
    vehicle_category_id: number,
    trip_type: TripType
  ): Promise<EffectivePricingRule> =>
    apiClient
      .get<EffectivePricingRule>("/admin/settings/pricing-rules/effective", {
        params: { city_id, vehicle_category_id, trip_type },
      })
      .then((r) => r.data),
});

// ── Media Upload ───────────────────────────────────────────────
// POST /admin/settings/upload-media  (multipart/form-data)
// Doc Ref: Backend api.py — /upload-media route
//          Migration 0013 — PLATFORM_LOGO_URL / PLATFORM_FAVICON_URL / PLATFORM_OG_IMAGE_URL

export interface MediaUploadResult {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  format: string;
  asset_type: string;
}

export const uploadMedia = async (
  file: File,
  assetType: "logo" | "favicon" | "og_image" | "general" | "document" | "photo",
  options?: {
    folderOverride?: string;
    onProgress?: (pct: number) => void;
  }
): Promise<MediaUploadResult> => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("asset_type", assetType);
  if (options?.folderOverride) {
    fd.append("folder_override", options.folderOverride);
  }
  const r = await apiClient.post<MediaUploadResult>("/admin/settings/upload-media", fd, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: options?.onProgress
      ? (e) => {
          const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0;
          options.onProgress!(pct);
        }
      : undefined,
  });
  return r.data;
};
