// ============================================================
// WAYTERO ADMIN — SEO VALIDATION (single source of truth for the UI)
// Doc Ref: SEO Implementation §2 — mirrors Backend/app/shared/utilities/seo.py
// and the Pydantic caps in app/modules/*/schemas. Keep the two in sync:
// the backend is authoritative and rejects anything outside these limits,
// so the UI must never let an admin type something that will bounce as a 422.
// ============================================================
import { z } from "zod";

/** Same pattern as backend SLUG_RE — lowercase words joined by single hyphens. */
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Hard database/API limits — exceeding them is an error, not a suggestion. */
export const SEO_LIMITS = {
  slug: 120,
  title: 120,
  description: 320,
  keywords: 500,
} as const;

/** Blog slugs are stored in a VARCHAR(300) column — see BlogPostCreate. */
export const BLOG_SLUG_LIMIT = 300;

/** Google's display window — outside it the snippet is truncated or looks thin. */
export const SEO_IDEAL = {
  titleMin: 50,
  titleMax: 60,
  descMin: 120,
  descMax: 160,
  keywordMax: 10,
} as const;

export interface SeoValues {
  slug: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
}

export type SeoLevel = "error" | "warning";

export interface SeoIssue {
  field: keyof SeoValues;
  level: SeoLevel;
  message: string;
}

/**
 * Slug ceiling differs per entity (blogs allow 300, everything we expose for
 * SEO editing is 120) — the backend field is the authority, so callers pass it.
 */
export const seoSchema = z.object({
  seo_title: z.string().trim().max(SEO_LIMITS.title, `SEO title must be ${SEO_LIMITS.title} characters or fewer`),
  seo_description: z
    .string()
    .trim()
    .max(SEO_LIMITS.description, `Meta description must be ${SEO_LIMITS.description} characters or fewer`),
  seo_keywords: z
    .string()
    .trim()
    .max(SEO_LIMITS.keywords, `Keywords must be ${SEO_LIMITS.keywords} characters or fewer`),
});

/** Normalise free text into a legal slug (used for auto-generation from a name). */
export function slugify(text: string, max: number = SEO_LIMITS.slug): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
}

/**
 * Full rule pass over an SEO form. Errors block save; warnings are advisory
 * (Google truncation / thin metadata) and never block.
 */
export function seoIssues(values: SeoValues, options?: { slugMax?: number }): SeoIssue[] {
  const slugMax = options?.slugMax ?? SEO_LIMITS.slug;
  const issues: SeoIssue[] = [];
  const slug = values.slug.trim();
  const title = values.seo_title.trim();
  const desc = values.seo_description.trim();
  const kw = values.seo_keywords.trim();

  if (slug.length > slugMax) {
    issues.push({ field: "slug", level: "error", message: `Slug must be ${slugMax} characters or fewer` });
  } else if (slug && !SLUG_REGEX.test(slug)) {
    issues.push({
      field: "slug",
      level: "error",
      message: "Slug must be lowercase letters, digits and single hyphens",
    });
  }

  const parsed = seoSchema.safeParse({ seo_title: title, seo_description: desc, seo_keywords: kw });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof SeoValues;
      if (!issues.some((i) => i.field === field)) {
        issues.push({ field, level: "error", message: issue.message });
      }
    }
  }

  if (title.length > SEO_IDEAL.titleMax) {
    issues.push({
      field: "seo_title",
      level: "warning",
      message: `Title is ${title.length} chars — Google shows ~${SEO_IDEAL.titleMax}. Aim for ${SEO_IDEAL.titleMin}–${SEO_IDEAL.titleMax}.`,
    });
  } else if (title.length > 0 && title.length < SEO_IDEAL.titleMin) {
    issues.push({
      field: "seo_title",
      level: "warning",
      message: `Title is short (${title.length} chars). ${SEO_IDEAL.titleMin}–${SEO_IDEAL.titleMax} performs better.`,
    });
  }
  if (desc.length > SEO_IDEAL.descMax) {
    issues.push({
      field: "seo_description",
      level: "warning",
      message: `Description is ${desc.length} chars — the snippet cuts off around ${SEO_IDEAL.descMax}. Aim for ${SEO_IDEAL.descMin}–${SEO_IDEAL.descMax}.`,
    });
  } else if (desc.length > 0 && desc.length < SEO_IDEAL.descMin) {
    issues.push({
      field: "seo_description",
      level: "warning",
      message: `Description is thin (${desc.length} chars). ${SEO_IDEAL.descMin}–${SEO_IDEAL.descMax} reads better in search.`,
    });
  }
  if (kw) {
    const list = splitKeywords(kw);
    if (list.length > SEO_IDEAL.keywordMax) {
      issues.push({
        field: "seo_keywords",
        level: "warning",
        message: `${list.length} keywords — keep it under ${SEO_IDEAL.keywordMax}; stuffing dilutes relevance.`,
      });
    }
  }
  return issues;
}

type SeoOptions = { slugMax?: number };

export const seoHasError = (values: SeoValues, options?: SeoOptions): boolean =>
  seoIssues(values, options).some((i) => i.level === "error");

export const seoErrorsFor = (values: SeoValues, field: keyof SeoValues, options?: SeoOptions): string | undefined =>
  seoIssues(values, options).find((i) => i.level === "error" && i.field === field)?.message;

export const seoWarningsFor = (values: SeoValues, field: keyof SeoValues, options?: SeoOptions): string | undefined =>
  seoIssues(values, options).find((i) => i.level === "warning" && i.field === field)?.message;

export const splitKeywords = (raw: string): string[] =>
  raw.split(",").map((s) => s.trim()).filter(Boolean);

/**
 * 0–100 readiness score used for the list badges (a page with no meta title or
 * description still ranks, it just leaves the snippet to Google).
 */
export function seoScore(values: SeoValues): { score: number; missing: string[] } {
  const missing: string[] = [];
  if (!values.slug.trim()) missing.push("slug");
  if (!values.seo_title.trim()) missing.push("meta title");
  if (!values.seo_description.trim()) missing.push("meta description");
  if (!splitKeywords(values.seo_keywords).length) missing.push("keywords");
  return { score: Math.round(((4 - missing.length) / 4) * 100), missing };
}

/** Build SEO values from nullable API fields (lists carry raw DB columns). */
export function seoFromRecord(rec: {
  slug?: string | null; seo_title?: string | null;
  seo_description?: string | null; seo_keywords?: string | null;
}): SeoValues {
  return {
    slug: rec.slug ?? "",
    seo_title: rec.seo_title ?? "",
    seo_description: rec.seo_description ?? "",
    seo_keywords: rec.seo_keywords ?? "",
  };
}
