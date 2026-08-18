// ============================================================
// WAYTERO ADMIN — WEBSITE CMS SERVICE
// Doc Ref:
//   Migration 0044_website_cms
//   Backend: /admin/settings/cms/* + /public/homepage
//
//  Admin endpoints (all require cms.section.manage /
//  cms.header_footer.manage permissions):
//    GET    /admin/settings/cms/sections
//    PATCH  /admin/settings/cms/sections/{section_key}
//    GET    /admin/settings/cms/sections/{section_key}/variants
//    POST   /admin/settings/cms/sections/{section_key}/variants
//    GET    /admin/settings/cms/variants/{id}
//    PATCH  /admin/settings/cms/variants/{id}
//    DELETE /admin/settings/cms/variants/{id}
//    POST   /admin/settings/cms/variants/{id}/activate
//    GET    /admin/settings/cms/header
//    PATCH  /admin/settings/cms/header
//    GET    /admin/settings/cms/footer
//    PATCH  /admin/settings/cms/footer
// ============================================================

import apiClient from "./api";

const base = "/admin/settings/cms";

// ── Types ─────────────────────────────────────────────────────

export interface PageSection {
  id: number;
  section_key: string;
  display_name: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  is_visible: boolean;
  is_active: boolean;
  variant_count: number;
  active_variant_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface PageSectionUpdatePayload {
  display_name?: string;
  description?: string | null;
  icon?: string;
  display_order?: number;
  is_visible?: boolean;
  is_active?: boolean;
}

export type AnimationStyle =
  | "NONE"
  | "FADE"
  | "SLIDE_LEFT"
  | "SLIDE_RIGHT"
  | "SLIDE_UP"
  | "ZOOM"
  | "PARALLAX";

export type TextAlignment = "LEFT" | "CENTER" | "RIGHT";

export const ANIMATION_STYLES: AnimationStyle[] = [
  "NONE",
  "FADE",
  "SLIDE_LEFT",
  "SLIDE_RIGHT",
  "SLIDE_UP",
  "ZOOM",
  "PARALLAX",
];

export const TEXT_ALIGNMENTS: TextAlignment[] = ["LEFT", "CENTER", "RIGHT"];

export interface SectionVariant {
  id: number;
  page_section_id: number;
  section_key: string;
  variant_name: string;
  variant_tag: string | null;
  display_order: number;
  is_active: boolean;
  headline: string | null;
  subheadline: string | null;
  body_text: string | null;
  cta_text: string | null;
  cta_link: string | null;
  background_image_url: string | null;
  background_video_url: string | null;
  mobile_image_url: string | null;
  icon_url: string | null;
  accent_color: string | null;
  animation_style: AnimationStyle | null;
  text_alignment: TextAlignment | null;
  overlay_opacity: number | null;
  /**
   * Structured content (JSONB) for sections whose copy can't fit in the
   * fixed typed slots — e.g. HOW_IT_WORKS `{steps:[…]}`, OFFERS `{offers:[…]}`,
   * FAQ `{faqs:[…]}`, STATS `{stats:[…]}`, POPULAR_DESTINATIONS
   * `{destinations:[…]}`, FEATURED_HOTELS `{hotels:[…]}`.
   */
  content: Record<string, unknown> | null;
  /**
   * Service binding — when set, customer-web injects the matching
   * inline search form (CAB/HOTEL/TOUR) into this section. `ALL`
   * means a generic CTA with no inline search. `null` = decorative.
   */
  service_type: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SectionVariantCreatePayload {
  variant_name: string;
  variant_tag?: string | null;
  display_order?: number;
  is_active?: boolean;
  headline?: string | null;
  subheadline?: string | null;
  body_text?: string | null;
  cta_text?: string | null;
  cta_link?: string | null;
  background_image_url?: string | null;
  background_video_url?: string | null;
  mobile_image_url?: string | null;
  icon_url?: string | null;
  accent_color?: string | null;
  animation_style?: AnimationStyle | null;
  text_alignment?: TextAlignment | null;
  overlay_opacity?: number | null;
  content?: Record<string, unknown> | null;
  service_type?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
}

export type SectionVariantUpdatePayload = Partial<SectionVariantCreatePayload>;

// ── Content picker ─────────────────────────────────────────────
// The add/edit-variant modal can pull live records out of the database
// to seed a section's structured content instead of hand-typing JSON.
// `type` is one of: HOTELS | COUPONS | DESTINATIONS | SERVICES.
export type CmsPickerItem = Record<string, unknown>;

export interface CmsPickerResult {
  type: string;
  items: CmsPickerItem[];
}

export interface NavLinkItem {
  label: string;
  href: string;
  external?: boolean;
}

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
  whatsapp?: string;
  website?: string;
}

export interface PaymentIconItem {
  label: string;
  image_url: string;
}

export interface AppStoreLinks {
  android?: string;
  ios?: string;
}

export interface SiteHeader {
  id: number;
  logo_url: string | null;
  logo_alt_text: string | null;
  tagline: string | null;
  show_search_bar: boolean;
  show_login_button: boolean;
  cta_text: string | null;
  cta_link: string | null;
  support_phone: string | null;
  contact_email: string | null;
  nav_links: NavLinkItem[];
  social_links: SocialLinks;
  background_color: string | null;
  text_color: string | null;
  is_active: boolean;
  updated_at: string;
}

export interface SiteHeaderUpdatePayload {
  logo_url?: string | null;
  logo_alt_text?: string | null;
  tagline?: string | null;
  show_search_bar?: boolean;
  show_login_button?: boolean;
  cta_text?: string | null;
  cta_link?: string | null;
  support_phone?: string | null;
  contact_email?: string | null;
  nav_links?: NavLinkItem[];
  social_links?: SocialLinks;
  background_color?: string | null;
  text_color?: string | null;
  is_active?: boolean;
}

export interface SiteFooter {
  id: number;
  logo_url: string | null;
  description: string | null;
  copyright_text: string | null;
  company_address: string | null;
  support_phone: string | null;
  contact_email: string | null;
  quick_links: NavLinkItem[];
  legal_links: NavLinkItem[];
  social_links: SocialLinks;
  payment_icons: PaymentIconItem[];
  app_store_links: AppStoreLinks;
  background_color: string | null;
  text_color: string | null;
  is_active: boolean;
  updated_at: string;
}

export interface SiteFooterUpdatePayload {
  logo_url?: string | null;
  description?: string | null;
  copyright_text?: string | null;
  company_address?: string | null;
  support_phone?: string | null;
  contact_email?: string | null;
  quick_links?: NavLinkItem[];
  legal_links?: NavLinkItem[];
  social_links?: SocialLinks;
  payment_icons?: PaymentIconItem[];
  app_store_links?: AppStoreLinks;
  background_color?: string | null;
  text_color?: string | null;
  is_active?: boolean;
}

// ── Section registry ──────────────────────────────────────────

// ── Blog Types ────────────────────────────────────────────────

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  featured_image_url: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
  tags: string[];
  is_published: boolean;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogPostListSummary {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
  tags: string[];
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogPostCreatePayload {
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
  featured_image_url?: string | null;
  author_name?: string | null;
  author_avatar_url?: string | null;
  tags?: string[];
  is_published?: boolean;
  published_at?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
}

export type BlogPostUpdatePayload = Partial<BlogPostCreatePayload>;

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  per_page: number;
}

const blogBase = "/admin/settings/blog";

export const blogService = {
  listPosts: (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    tag?: string;
    status?: "all" | "published" | "draft";
    published_only?: boolean;
  }) =>
    apiClient
      .get<PaginatedResponse<BlogPostListSummary>>(blogBase, { params })
      .then((r) => r.data),

  getPost: (id: number) =>
    apiClient
      .get<{ success: boolean; data: BlogPost }>(`${blogBase}/${id}`)
      .then((r) => r.data.data),

  listTags: () =>
    apiClient
      .get<{ success: boolean; data: string[] }>(`${blogBase}/tags`)
      .then((r) => r.data.data),

  createPost: (payload: BlogPostCreatePayload) =>
    apiClient
      .post<{ success: boolean; data: BlogPost }>(blogBase, payload)
      .then((r) => r.data.data),

  updatePost: (id: number, payload: BlogPostUpdatePayload) =>
    apiClient
      .patch<{ success: boolean; data: BlogPost }>(`${blogBase}/${id}`, payload)
      .then((r) => r.data.data),

  deletePost: (id: number) =>
    apiClient.delete(`${blogBase}/${id}`).then((r) => r.data),

  togglePublish: (id: number) =>
    apiClient
      .post<{ success: boolean; data: BlogPost }>(`${blogBase}/${id}/publish`)
      .then((r) => r.data.data),
};

export const cmsService = {
  // Page sections
  listSections: () =>
    apiClient.get<PageSection[]>(`${base}/sections`).then((r) => r.data),

  updateSection: (sectionKey: string, payload: PageSectionUpdatePayload) =>
    apiClient
      .patch<PageSection>(`${base}/sections/${sectionKey}`, payload)
      .then((r) => r.data),

  // Section variants
  listVariants: (sectionKey: string) =>
    apiClient
      .get<SectionVariant[]>(`${base}/sections/${sectionKey}/variants`)
      .then((r) => r.data),

  createVariant: (sectionKey: string, payload: SectionVariantCreatePayload) =>
    apiClient
      .post<SectionVariant>(
        `${base}/sections/${sectionKey}/variants`,
        payload
      )
      .then((r) => r.data),

  pickerItems: (pickerType: string) =>
    apiClient
      .get<CmsPickerResult>(`${base}/picker-items`, {
        params: { type: pickerType },
      })
      .then((r) => r.data),

  getVariant: (variantId: number) =>
    apiClient
      .get<SectionVariant>(`${base}/variants/${variantId}`)
      .then((r) => r.data),

  updateVariant: (variantId: number, payload: SectionVariantUpdatePayload) =>
    apiClient
      .patch<SectionVariant>(`${base}/variants/${variantId}`, payload)
      .then((r) => r.data),

  deleteVariant: (variantId: number) =>
    apiClient.delete(`${base}/variants/${variantId}`).then((r) => r.data),

  activateVariant: (variantId: number) =>
    apiClient
      .post<SectionVariant>(`${base}/variants/${variantId}/activate`)
      .then((r) => r.data),

  // Header
  getHeader: () =>
    apiClient.get<SiteHeader>(`${base}/header`).then((r) => r.data),

  updateHeader: (payload: SiteHeaderUpdatePayload) =>
    apiClient.patch<SiteHeader>(`${base}/header`, payload).then((r) => r.data),

  // Footer
  getFooter: () =>
    apiClient.get<SiteFooter>(`${base}/footer`).then((r) => r.data),

  updateFooter: (payload: SiteFooterUpdatePayload) =>
    apiClient.patch<SiteFooter>(`${base}/footer`, payload).then((r) => r.data),
};
