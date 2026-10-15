// ============================================================
// WAYTERO ADMIN — LANDING PAGES SERVICE
// Doc Ref: City + Service-Type Landing Pages (Backend migration 0069)
// Base: /admin/settings/landing-pages
//
//  One record per marketing page: /bhubaneswar, /cab-booking-in-bhubaneswar,
//  /hotel-booking-in-odisha … The slug is derived from page_type + scope on the
//  backend, so the admin picks a scope rather than typing a URL.
//
//  Envelope: list responses carry `data: T[]` + totals and are unwrapped one
//  level; single records arrive as `{ success, data }` and unwrap `data.data` —
//  same dialect as cms.service.ts.
// ============================================================
import apiClient from "./api";
import type { PaginatedResponse } from "./cms.service";
import type { SlotGeometry } from "../pages/cms/components/MediaUploader";

export type LandingPageType =
  | "CITY_HUB"
  | "CITY_CABS"
  | "CITY_HOTELS"
  | "CITY_TOURS"
  | "STATE_HOTELS"
  | "STATE_TOURS"
  | "PLACE_CABS";

export type LandingBlockType =
  | "prose"
  | "highlights"
  | "stats"
  | "gallery"
  | "faq"
  | "fare_matrix"
  | "vehicle_grid"
  | "hotel_grid"
  | "tour_grid"
  | "steps"
  | "cta_band"
  | "internal_links";

/** Where the hero art came from. `gradient` = nobody has uploaded yet. */
export type LandingImageSource = "admin" | "curated" | "gradient";

/** Per-slot geometry the crop modal and the strict pick check both use. */
export interface SlotSpec {
  label: string;
  width: number;
  height: number;
  min_width: number;
  min_height: number;
  aspect: number;
  max_bytes: number;
  formats: string[];
}

// The item shapes below are the render contract for
// src/components/renderers/landing/ on the website. The backend stores them
// as opaque JSON, so this is the only place they are described.
export interface LandingHighlight {
  title: string;
  text: string;
  icon_url?: string | null;
}

export interface LandingGalleryTile {
  image_url: string;
  alt_text?: string | null;
  caption?: string | null;
}

export interface LandingStat {
  value: string | number;
  suffix?: string;
  label: string;
}

export interface LandingFaq {
  question: string;
  answer: string;
}

export interface LandingBlock {
  type: LandingBlockType;
  title?: string | null;
  /** grid blocks: how many cards to pull. */
  limit?: number;
  /** prose blocks only. */
  body?: string | null;
  [key: string]: unknown;
}

/** Copy the platform would render if the admin authored nothing. */
export interface LandingDerivedCopy {
  eyebrow: string;
  headline: string;
  subheadline: string;
  body_text: string;
  cta_text: string;
  cta_link: string;
  cta2_text: string | null;
  cta2_link: string | null;
  seo_title: string;
  seo_description: string;
  seo_keywords: string[];
  canonical_path: string;
}

export interface LandingPagePrices {
  hotel_from: number | null;
  tour_from: number | null;
  cab_from: number | null;
  hotel_count: number;
  tour_count: number;
  vehicle_count: number;
  avg_hotel_rating: number | null;
  currency: string;
}

export interface LandingPage {
  id: number;
  slug: string;
  page_type: LandingPageType;
  city_id: number | null;
  state_id: number | null;
  place_id: number | null;
  place_name: string | null;
  city_name: string | null;
  state_name: string | null;
  service_type: string | null;
  display_name: string | null;
  eyebrow: string | null;
  headline: string | null;
  subheadline: string | null;
  body_text: string | null;
  banner_image_url: string | null;
  banner_mobile_url: string | null;
  banner_video_url: string | null;
  banner_alt_text: string | null;
  og_image_url: string | null;
  overlay_opacity: number | null;
  gallery: LandingGalleryTile[];
  highlights: LandingHighlight[];
  stats: LandingStat[];
  blocks: LandingBlock[];
  faqs: LandingFaq[];
  cta_text: string | null;
  cta_link: string | null;
  cta2_text: string | null;
  cta2_link: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  is_published: boolean;
  starts_at: string | null;
  ends_at: string | null;
  display_order: number | null;
  derived: LandingDerivedCopy;
  /** Computed per request from the admin's own uploads — never typed. */
  image_source: LandingImageSource;
  slot_specs: Record<string, SlotSpec>;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * List rows arrive as full admin dicts, not a slimmed projection: the backend
 * needs `image_source` and the derived copy per row anyway to answer "is this
 * page publishable", so the list reuses the same shape as the record.
 */
export type LandingPageListItem = LandingPage;
export interface LandingPageCreatePayload {
  page_type: LandingPageType;
  city_id?: number | null;
  state_id?: number | null;
  slug?: string | null;
  display_name?: string | null;
  is_published?: boolean;
  [key: string]: unknown;
}

export type LandingPageUpdatePayload = Partial<LandingPageCreatePayload>;

export interface LandingEditorOptions {
  cities: { id: number; name: string; state_id: number; state_name: string }[];
  states: { id: number; name: string }[];
  taken_scopes: {
    page_type: LandingPageType;
    city_id: number | null;
    state_id: number | null;
  }[];
}

export interface LandingSpecs {
  page_types: LandingPageType[];
  page_type_prefix: Record<LandingPageType, string>;
  page_type_service: Record<LandingPageType, string | null>;
  block_types: LandingBlockType[];
  /**
   * page_type → the blocks the server will accept on it. The editor builds its
   * add-block menu from this so it can never offer something that 400s on save.
   */
  blocks_by_page_type: Record<LandingPageType, LandingBlockType[]>;
  limits: {
    blocks: number;
    gallery: number;
    highlights: number;
    stats: number;
    faqs: number;
  };
  slot_specs: Record<string, SlotSpec>;
  options: LandingEditorOptions;
}

export interface LandingSuggestion {
  slug: string;
  reserved: boolean;
  display_name: string;
  service_type: string | null;
  blocks: LandingBlock[];
  derived: LandingDerivedCopy;
  prices: LandingPagePrices;
  publish_blockers: string[];
}

const base = "/admin/settings/landing-pages";

export const landingPagesService = {
  listPages: (params?: {
    page?: number;
    per_page?: number;
    page_type?: string;
    city_id?: number;
    state_id?: number;
    search?: string;
    status?: string;
  }): Promise<PaginatedResponse<LandingPageListItem>> =>
    apiClient
      .get<PaginatedResponse<LandingPageListItem>>(base, { params })
      .then((r) => r.data),

  getSpecs: (): Promise<LandingSpecs> =>
    apiClient.get<{ success: boolean; data: LandingSpecs }>(`${base}/specs`).then((r) => r.data.data),

  getSlotSpecs: (): Promise<Record<string, SlotSpec>> =>
    apiClient
      .get<{ success: boolean; data: Record<string, SlotSpec> }>(`${base}/slot-specs`)
      .then((r) => r.data.data),

  getReservedSlugs: (): Promise<{ reserved: string[]; published: string[] }> =>
    apiClient
      .get<{ success: boolean; data: { reserved: string[]; published: string[] } }>(
        `${base}/reserved-slugs`
      )
      .then((r) => r.data.data),

  getSuggestion: (params: {
    page_type: LandingPageType;
    city_id?: number | null;
    state_id?: number | null;
  }): Promise<LandingSuggestion> =>
    apiClient
      .get<{ success: boolean; data: LandingSuggestion }>(`${base}/suggestions`, {
        params: {
          page_type: params.page_type,
          city_id: params.city_id || undefined,
          state_id: params.state_id || undefined,
        },
      })
      .then((r) => r.data.data),

  syncPages: (): Promise<{ created: string[]; cities: number }> =>
    apiClient
      .post<{ success: boolean; message: string; data: { created: string[]; cities: number } }>(
        `${base}/sync`
      )
      .then((r) => r.data.data),

  getPage: (id: number): Promise<LandingPage> =>
    apiClient.get<{ success: boolean; data: LandingPage }>(`${base}/${id}`).then((r) => r.data.data),

  createPage: (payload: LandingPageCreatePayload): Promise<LandingPage> =>
    apiClient.post<{ success: boolean; data: LandingPage }>(base, payload).then((r) => r.data.data),

  updatePage: (id: number, payload: LandingPageUpdatePayload): Promise<LandingPage> =>
    apiClient
      .patch<{ success: boolean; data: LandingPage }>(`${base}/${id}`, payload)
      .then((r) => r.data.data),

  deletePage: (id: number) => apiClient.delete(`${base}/${id}`).then((r) => r.data),

  /**
   * `confirmed` answers the backend's "this page is not ready to publish"
   * rejection — pass true only from an explicit dialog that has listed the
   * blockers to the admin.
   */
  setPublished: (id: number, isPublished: boolean, confirmed = false): Promise<LandingPage> =>
    apiClient
      .post<{ success: boolean; message: string; data: LandingPage }>(
        `${base}/${id}/publish`,
        { is_published: isPublished, confirmed }
      )
      .then((r) => r.data.data),
};

/**
 * Backend slot spec → the geometry the uploader enforces. The numbers live on
 * the backend because the crop modal, the pick validation and the website's
 * CSS container all have to agree; this is the only translation between the
 * snake_case API and the component's camelCase prop.
 */
export function slotGeometry(spec: SlotSpec): SlotGeometry {
  return {
    minWidth: spec.min_width,
    minHeight: spec.min_height,
    aspect: spec.aspect,
    width: spec.width,
    height: spec.height,
  };
}

/** Label used everywhere a page type has to be shown to a human. */
export const PAGE_TYPE_LABELS: Record<LandingPageType, string> = {
  CITY_HUB: "City hub",
  CITY_CABS: "City · Cabs",
  CITY_HOTELS: "City · Hotels",
  CITY_TOURS: "City · Tours",
  STATE_HOTELS: "State · Hotels",
  STATE_TOURS: "State · Tours",
  PLACE_CABS: "Place · Cabs",
};

export const BLOCK_TYPE_LABELS: Record<LandingBlockType, string> = {
  prose: "Text",
  highlights: "Highlights",
  stats: "Stat chips",
  gallery: "Gallery",
  faq: "FAQ",
  fare_matrix: "Cab fare table",
  vehicle_grid: "Vehicle cards",
  hotel_grid: "Hotel cards",
  tour_grid: "Tour cards",
  steps: "How it works",
  cta_band: "Call-to-action band",
  internal_links: "Related links",
};

/**
 * Which blocks pull live data rather than authored content. A data block needs
 * no sub-form beyond a title and an optional limit — the numbers come from the
 * booking tables, and the admin must not be able to hand-type them.
 */
export const DATA_BLOCKS: LandingBlockType[] = [
  "fare_matrix",
  "vehicle_grid",
  "hotel_grid",
  "tour_grid",
];

/** Blocks that render the page-level authored lists instead of their own body. */
export const AUTHORED_SOURCE_BLOCKS: LandingBlockType[] = [
  "highlights",
  "stats",
  "gallery",
  "faq",
];
