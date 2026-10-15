// ============================================================
// WAYTERO ADMIN — REUSABLE SEO FIELDS BLOCK
// Doc Ref: SEO Implementation §2 — one validated editor for slug + meta
// title/description/keywords, shared by hotels, tours, blog and the
// master-data category forms so the UI can never drift from backend rules.
// ============================================================
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Chip, Divider, Stack, TextField, Typography,
} from "@mui/material";
import {
  SEO_IDEAL, SEO_LIMITS, seoErrorsFor, seoIssues, seoWarningsFor, slugify, splitKeywords,
} from "../../utils/seoValidation";
import type { SeoValues } from "../../utils/seoValidation";

interface Props {
  value: SeoValues;
  onChange: (patch: Partial<SeoValues>) => void;
  /** Public URL prefix shown before the slug, e.g. "waytero.com/tours/". */
  urlBase: string;
  /** Name/label used to auto-fill an empty slug and the SERP preview. */
  fallbackTitle?: string;
  fallbackDescription?: string;
  /** When true (entity already live) a slug edit gets an explicit warning. */
  liveEntity?: boolean;
  /** Original slug from the server — compared against the current one. */
  originalSlug?: string | null;
  /** Slug ceiling for this entity (blogs store VARCHAR(300)). */
  slugMax?: number;
  /** Hide the slug input when the page edits it elsewhere. */
  showSlug?: boolean;
}

export default function SeoFields({
  value, onChange, urlBase, fallbackTitle = "", fallbackDescription = "", liveEntity, originalSlug,
  slugMax = SEO_LIMITS.slug, showSlug = true,
}: Props) {
  const [slugTouched, setSlugTouched] = useState(Boolean(value.slug));

  // Auto-derive the slug from the entity name until the admin edits it by hand.
  useEffect(() => {
    if (!slugTouched && fallbackTitle) {
      const next = slugify(fallbackTitle);
      if (next !== value.slug) onChange({ slug: next });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallbackTitle, slugTouched]);

  const issues = useMemo(() => seoIssues(value, { slugMax }), [value, slugMax]);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  const slugChanged = liveEntity && value.slug.trim() !== (originalSlug ?? "").trim();
  const previewUrl = `${urlBase}${value.slug.trim() || "[slug]"}`;
  const previewTitle = value.seo_title.trim() || fallbackTitle || "Untitled page";
  const previewDesc = value.seo_description.trim() || fallbackDescription || "No description set — Google will generate one from the page body.";

  const fieldProps = (field: keyof SeoValues, label: string, limit: number, ideal?: string) => ({
    label,
    size: "small" as const,
    fullWidth: true,
    value: value[field],
    error: Boolean(seoErrorsFor(value, field, { slugMax })),
    helperText:
      seoErrorsFor(value, field, { slugMax }) ??
      seoWarningsFor(value, field, { slugMax }) ??
      `${value[field].length}/${limit} characters${ideal ? ` · Ideal: ${ideal}` : ""}`,
    FormHelperTextProps: {
      sx: {
        color: seoErrorsFor(value, field, { slugMax })
          ? "error.main"
          : seoWarningsFor(value, field, { slugMax })
            ? "warning.main"
            : "text.secondary",
      },
    },
  });

  return (
    <Stack spacing={2}>
      {showSlug && (
        <>
          <TextField
            {...fieldProps("slug", "URL Slug", slugMax)}
            inputProps={{ maxLength: slugMax }}
            onChange={(e) => {
              setSlugTouched(true);
              onChange({ slug: e.target.value.trim().toLowerCase().replace(/\s+/g, "-") });
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
            Lowercase letters, digits and single hyphens only. Leave it as-is after publishing —
            changing a live slug breaks every link and search result pointing at the page.
          </Typography>
          {slugChanged && (
            <Alert severity="warning" sx={{ py: 0 }}>
              This page is live. Saving a new slug will 404 every existing URL and drop its rankings.
            </Alert>
          )}
        </>
      )}

      <TextField
        {...fieldProps("seo_title", "SEO Title (meta title)", SEO_LIMITS.title, `${SEO_IDEAL.titleMin}–${SEO_IDEAL.titleMax}`)}
        inputProps={{ maxLength: SEO_LIMITS.title }}
        onChange={(e) => onChange({ seo_title: e.target.value })}
      />
      <TextField
        {...fieldProps("seo_description", "Meta Description", SEO_LIMITS.description, `${SEO_IDEAL.descMin}–${SEO_IDEAL.descMax}`)}
        multiline
        rows={3}
        inputProps={{ maxLength: SEO_LIMITS.description }}
        onChange={(e) => onChange({ seo_description: e.target.value })}
      />

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
          Keywords (comma separated, up to {SEO_LIMITS.keywords} chars)
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 1 }}>
          {splitKeywords(value.seo_keywords).map((kw) => (
            <Chip
              key={kw}
              label={kw}
              size="small"
              onDelete={() =>
                onChange({ seo_keywords: splitKeywords(value.seo_keywords).filter((k) => k !== kw).join(", ") })
              }
            />
          ))}
        </Stack>
        <TextField
          {...fieldProps("seo_keywords", "SEO Keywords", SEO_LIMITS.keywords)}
          onChange={(e) => onChange({ seo_keywords: e.target.value })}
        />
      </Box>

      <Divider />

      <Box
        sx={{
          p: 2,
          borderRadius: 1.5,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="overline" color="text.secondary">
          Google preview
        </Typography>
        <Typography variant="caption" color="success.main" sx={{ display: "block" }}>
          {previewUrl}
        </Typography>
        <Typography
          variant="body1"
          color="primary.main"
          fontWeight={600}
          sx={{ fontSize: "1.1rem", maxWidth: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {previewTitle.length > SEO_IDEAL.titleMax ? `${previewTitle.slice(0, SEO_IDEAL.titleMax - 1)}…` : previewTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 600 }}>
          {previewDesc.length > SEO_IDEAL.descMax ? `${previewDesc.slice(0, SEO_IDEAL.descMax - 1)}…` : previewDesc}
        </Typography>
      </Box>

      {errors.length > 0 && (
        <Alert severity="error" sx={{ py: 0 }}>
          <Stack spacing={0.25}>
            {errors.map((e) => (
              <Typography key={e.field + e.message} variant="body2">
                {e.message}
              </Typography>
            ))}
          </Stack>
        </Alert>
      )}
      {warnings.length > 0 && (
        <Alert severity="warning" sx={{ py: 0 }}>
          <Stack spacing={0.25}>
            {warnings.map((w) => (
              <Typography key={w.field + w.message} variant="body2">
                {w.message}
              </Typography>
            ))}
          </Stack>
        </Alert>
      )}
    </Stack>
  );
}

export type { SeoValues };
