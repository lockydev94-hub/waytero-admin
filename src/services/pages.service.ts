// ============================================================
// WAYTERO ADMIN — WEBSITE PAGE BODIES
// Doc Ref: Round 6 · Website → Pages editor
// Base: /admin/settings/configurations
//
//  Every marketing page whose *prose* an admin can own — privacy, terms,
//  refund, cookies, the booking guide, safety, support, careers, press — is
//  one `LEGAL_PAGE_{SLUG}` row in `system_configurations`. The website reads
//  them through the public endpoint `GET /public/legal/{slug}` and falls back
//  to the copy shipped in its bundle when a row is missing, empty or
//  unpublished, which is why this screen can offer "reset" instead of
//  demanding a body.
//
//  Why configurations and not a table: the public resolver already treats
//  `LEGAL_PAGE_{SLUG}` as a generic published-body namespace with no
//  whitelist, `upsert` creates a missing key, and `GET /public/legal` lists
//  slugs by prefix — so a new page is an admin action, not a deploy. The
//  prefix name is historic (the first five were legal docs); the namespace is
//  now broader than its name and the public handler says so.
//
//  Head metadata is a separate row, `SEO_PAGE_{SLUG}` = {title, description},
//  read by `GET /public/site-seo`. Meta keywords for these pages are fixed in
//  the site's code, so nothing here pretends to edit them.
// ============================================================
import apiClient from "./api";
import { settingsService, type SystemConfig } from "./settings.service";

/** A row of the body, as the website renders it. */
export interface PageSection {
  heading: string;
  body: string;
}

export interface PageFaqItem {
  question: string;
  answer: string;
}

/** The stored JSON. Field names are the website's render contract — renaming
 *  one here silently drops it from the page, so they are not free to drift. */
export interface PageBody {
  slug: string;
  title: string;
  eyebrow?: string | null;
  description?: string | null;
  effective_date?: string | null;
  updated_at?: string | null;
  sections: PageSection[];
  faq?: PageFaqItem[];
  is_published?: boolean;
}

export interface PageSeo {
  title: string;
  description: string;
}

/** Which text the live page is standing on. Five distinct states because the
 *  admin's next move differs for each. */
export type PageContentState = "live" | "unpublished" | "empty" | "corrupt" | "built-in";

export const STATE_LABEL: Record<PageContentState, string> = {
  live: "Live (edited copy)",
  unpublished: "Unpublished",
  empty: "Saved but empty",
  corrupt: "Invalid JSON",
  "built-in": "Built-in copy",
};

/** Plain-language cause, shown next to the status so "unpublished" is not a riddle. */
export const STATE_HINT: Record<PageContentState, string> = {
  live: "The website serves what you saved.",
  unpublished: "The switch is off, so the website serves its built-in copy instead.",
  empty: "The row exists but has no sections, so the website serves its built-in copy.",
  corrupt: "The stored value is not valid JSON, so the website ignores it and serves its built-in copy.",
  "built-in": "Nothing has been saved for this page, so the website serves the copy shipped with it.",
};

export type PageKind = "policy" | "guide" | "trust" | "company";

export interface PageRegistryRow {
  slug: string;
  label: string;
  /** Path on the customer site — also the anchor for the "open on site" link. */
  path: string;
  kind: PageKind;
  /** Whether the website renders an FAQ band from `body.faq` for this page. */
  hasFaq: boolean;
  /** Where the numbers on the page come from, when they are not prose. */
  dataSource?: string;
}

/**
 * The nine pages this screen owns. `/blog` is not here (it has a real CRUD at
 * /cms/blog), the homepage bands are not here (Website CMS), and the refund
 * *percentages* are not here (Cancellation Policy → 15 config keys) — the body
 * of /refund is prose that describes those numbers, and only that.
 */
export const PAGE_REGISTRY: PageRegistryRow[] = [
  { slug: "refund", label: "Refund & Cancellation", path: "/refund", kind: "policy", hasFaq: true, dataSource: "Cancellation Policy (15 tier keys)" },
  { slug: "booking-instructions", label: "Booking Instructions", path: "/booking-instructions", kind: "guide", hasFaq: false },
  { slug: "privacy", label: "Privacy Policy", path: "/privacy", kind: "policy", hasFaq: false },
  { slug: "terms", label: "Terms of Service", path: "/terms", kind: "policy", hasFaq: false },
  { slug: "cookies", label: "Cookies & Browser Storage", path: "/cookies", kind: "policy", hasFaq: false },
  { slug: "safety", label: "Safety", path: "/safety", kind: "trust", hasFaq: true },
  { slug: "support", label: "Support Centre", path: "/support", kind: "trust", hasFaq: true },
  { slug: "careers", label: "Careers", path: "/careers", kind: "company", hasFaq: true },
  { slug: "press", label: "Press & Media", path: "/press", kind: "company", hasFaq: true },
];

export const MAX_SECTIONS = 16;
export const MAX_FAQS = 12;

export interface PageListRow extends PageRegistryRow {
  state: PageContentState;
  sectionCount: number;
  faqCount: number;
  isPublished: boolean;
  /** `updated_at` of the configuration row — when the admin last saved. */
  configUpdatedAt: string | null;
  bodyUpdatedAt: string | null;
  title: string;
}

const bodyKey = (slug: string) => `LEGAL_PAGE_${slug.replace(/-/g, "_").toUpperCase()}`;
const seoKey = (slug: string) => `SEO_PAGE_${slug.replace(/-/g, "_").toUpperCase()}`;

/** `booking-instructions` → `booking_instructions`, the key the site looks up. */
export const seoMapKey = (slug: string) => slug.replace(/-/g, "_");

interface ParsedBody {
  body: PageBody | null;
  state: PageContentState;
}

/**
 * A stored value can be four different non-live things, and the editor has to
 * tell them apart or "Reset" and "Publish" mean nothing. Order matters: a
 * corrupt row is not an empty row.
 */
function parseStored(raw: string | null): ParsedBody {
  if (raw === null || raw === "") return { body: null, state: "built-in" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { body: null, state: "corrupt" };
  }
  if (!parsed || typeof parsed !== "object") return { body: null, state: "corrupt" };
  const body = parsed as PageBody;
  if (!Array.isArray(body.sections)) return { body: null, state: "corrupt" };
  const filled = body.sections.filter((s) => s && typeof s.heading === "string");
  if (filled.length === 0) return { body, state: "empty" };
  if (body.is_published === false) return { body, state: "unpublished" };
  return { body, state: "live" };
}

export const pagesService = {
  /**
   * One GET of every configuration, joined to the registry client-side. The
   * endpoint has no filter param and the table is small; going through it
   * means no new backend route, and pages that have never been saved still
   * list (that is the point — the admin needs to see the gap).
   */
  listPages: async (): Promise<PageListRow[]> => {
    const configs = await apiClient
      .get<SystemConfig[]>("/admin/settings/configurations")
      .then((r) => r.data);
    const byKey = new Map(configs.map((c) => [c.config_key, c]));
    return PAGE_REGISTRY.map((page) => {
      const row = byKey.get(bodyKey(page.slug));
      const { body, state } = parseStored(row?.config_value ?? null);
      return {
        ...page,
        state,
        sectionCount: body?.sections.filter((s) => s && typeof s.heading === "string").length ?? 0,
        faqCount: Array.isArray(body?.faq) ? body.faq.length : 0,
        isPublished: state === "live",
        configUpdatedAt: row?.updated_at ?? null,
        bodyUpdatedAt: body?.updated_at ?? null,
        title: body?.title ?? page.label,
      };
    });
  },

  /** The stored body, or null when there is no usable one. */
  getPage: async (slug: string): Promise<{ body: PageBody | null; state: PageContentState; seo: PageSeo }> => {
    const configs = await apiClient
      .get<SystemConfig[]>("/admin/settings/configurations")
      .then((r) => r.data);
    const byKey = new Map(configs.map((c) => [c.config_key, c]));
    const { body, state } = parseStored(byKey.get(bodyKey(slug))?.config_value ?? null);
    const seoRaw = byKey.get(seoKey(slug))?.config_value;
    let seo: PageSeo = { title: "", description: "" };
    if (seoRaw) {
      try {
        const parsed = JSON.parse(seoRaw) as Partial<PageSeo>;
        seo = { title: parsed.title ?? "", description: parsed.description ?? "" };
      } catch {
        /* an unreadable SEO row is simply no SEO */
      }
    }
    return { body, state, seo };
  },

  /**
   * Two writes, one per concern. A page's body and its search snippet are
   * separate rows because the website reads them from separate endpoints;
   * saving here keeps them together so an admin never publishes one and
   * forgets the other.
   */
  savePage: async (slug: string, body: PageBody, seo: PageSeo) => {
    const registry = PAGE_REGISTRY.find((p) => p.slug === slug);
    await settingsService.upsertConfiguration(
      bodyKey(slug),
      JSON.stringify({ ...body, slug }),
      `Website page body: /${registry?.path ?? slug} (admin editor)`
    );
    const hasSeo = Boolean(seo.title.trim() || seo.description.trim());
    if (hasSeo) {
      await settingsService.upsertConfiguration(
        seoKey(slug),
        JSON.stringify({ title: seo.title.trim(), description: seo.description.trim() }),
        `Website page SEO: /${registry?.path ?? slug} (admin editor)`
      );
    } else {
      // An emptied snippet should stop overriding the site's own default, not
      // linger as a blank <title>.
      await settingsService.deleteConfiguration(seoKey(slug)).catch(() => undefined);
    }
  },

  /**
   * Drops the body row so the page returns to the copy shipped with the site.
   * The SEO row is left alone: an admin may have tuned the snippet without
   * touching the body, and "reset the copy" should not quietly undo that.
   */
  resetPage: (slug: string) => settingsService.deleteConfiguration(bodyKey(slug)),
};

export { bodyKey, seoKey };

/** A body the editor can open a brand-new page with. */
export function emptyBody(slug: string, label: string): PageBody {
  return {
    slug,
    title: label,
    eyebrow: null,
    description: null,
    effective_date: null,
    updated_at: new Date().toISOString().slice(0, 10),
    sections: [{ heading: "", body: "" }],
    faq: [],
    is_published: true,
  };
}
