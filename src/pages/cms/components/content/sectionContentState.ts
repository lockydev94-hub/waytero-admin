// ============================================================
// WAYTERO ADMIN — CMS SECTION CONTENT STATE
// Doc Ref: Migration 0044_website_cms
//
//  Turns a section's JSONB into typed rows and back again. Kept free of
//  React so the round trip can be reasoned about (and tested) on its own.
//
//  Three rules drive the whole file:
//
//  1. NOTHING IS LOST QUIETLY. A key the editor does not own is either
//     `retained` (legal, passed through byte-for-byte) or `quarantined`
//     (the backend would reject it, so it cannot be kept — and the admin has
//     to acknowledge discarding it). The same split applies inside a row:
//     fields the schema does not declare ride along in `extras`.
//
//  2. NEVER WRITE AN EMPTY STRING. The public site reads content with
//     `pick(variant, key)`, which falls back only on `undefined`/`null`
//     (customer-web/src/types/cms.ts:105-108). A `""` therefore beats the
//     renderer's own default text, so blank inputs are dropped rather than
//     written as empty.
//
//  3. HYDRATE NEVER THROWS. A thrown hydrate would leave the form empty and
//     the next save would clear live homepage content, so every unexpected
//     shape is classified instead of raised.
// ============================================================

import {
  SECTION_ALLOWED_KEYS, SECTION_CONTENT_SCHEMA, STRING_ROW_KEY,
  VARIANT_TYPED_SLOTS,
  type ArraySpec, type BandSchema, type FieldSpec, type ObjectSpec,
} from "./sectionContentSchema";

// ── Shapes ─────────────────────────────────────────────────────

export interface ItemState {
  /** Values for the fields this band's schema declares. */
  values: Record<string, unknown>;
  /** Keys on the stored row that the schema does not declare, kept as-is. */
  extras: Record<string, unknown>;
  /**
   * A row that is not an object at all (string[] bands) or not an object where
   * one was expected. Shown read-only and written back unchanged, so one odd
   * legacy row cannot cost the admin the rows around it.
   */
  raw?: unknown;
  /** True when the row came from the database rather than an "Add" click. */
  loaded?: boolean;
}

export interface QuarantinedKey {
  value: unknown;
  reason: string;
}

export interface ContentState {
  arrays: Record<string, ItemState[]>;
  objects: Record<string, Record<string, unknown>>;
  retained: Record<string, unknown>;
  quarantined: Record<string, QuarantinedKey>;
  /** Set when the stored value was not an object; holds the JSON text. */
  unparseable: string | null;
}

export interface ContentIssue {
  arrayKey?: string;
  objectKey?: string;
  index?: number;
  fieldKey?: string;
  message: string;
  level: "error" | "warning";
}

// ── Helpers ────────────────────────────────────────────────────

function schemaFor(sectionKey: string): BandSchema | undefined {
  return SECTION_CONTENT_SCHEMA[sectionKey];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function blankValues(fields: FieldSpec[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) out[f.key] = "";
  return out;
}

export function emptyItem(spec: ArraySpec): ItemState {
  return spec.rowKind === "string"
    ? { values: { [STRING_ROW_KEY]: "" }, extras: {} }
    : { values: blankValues(spec.fields), extras: {} };
}

export function emptyContentState(sectionKey: string): ContentState {
  const schema = schemaFor(sectionKey);
  const arrays: ContentState["arrays"] = {};
  const objects: ContentState["objects"] = {};
  for (const a of schema?.arrays ?? []) arrays[a.key] = [];
  for (const o of schema?.objects ?? []) objects[o.key] = blankValues(o.fields);
  return { arrays, objects, retained: {}, quarantined: {}, unparseable: null };
}

function quarantineReason(sectionKey: string, key: string, allowed: readonly string[]): string {
  if (VARIANT_TYPED_SLOTS.includes(key)) {
    return `“${key}” is a field of this variant, not a content key — the site would `
      + "use it instead of the matching input above.";
  }
  if (allowed.length === 0) {
    return `“${key}” is not read by the ${sectionKey} section. This band takes no `
      + "content keys, so its cards come from live data.";
  }
  return `“${key}” is not read by the ${sectionKey} section. Allowed keys: `
    + `${allowed.join(", ")}.`;
}

// ── Hydrate ────────────────────────────────────────────────────

export function hydrateContent(sectionKey: string, raw: unknown): ContentState {
  const state = emptyContentState(sectionKey);
  if (raw === null || raw === undefined) return state;
  if (!isPlainObject(raw)) {
    try {
      state.unparseable = JSON.stringify(raw) ?? String(raw);
    } catch {
      state.unparseable = String(raw);
    }
    return state;
  }

  const schema = schemaFor(sectionKey);
  const allowed = SECTION_ALLOWED_KEYS[sectionKey] ?? null;

  for (const [key, value] of Object.entries(raw)) {
    const arraySpec = schema?.arrays.find((a) => a.key === key);
    const objectSpec = schema?.objects?.find((o) => o.key === key);

    // An unknown key for a band the backend knows nothing about still fails
    // open server-side (:971-973), so it is retained rather than discarded.
    if (allowed && !allowed.includes(key)) {
      state.quarantined[key] = { value, reason: quarantineReason(sectionKey, key, allowed) };
      continue;
    }

    if (arraySpec && Array.isArray(value)) {
      state.arrays[key] = value.map((row) => hydrateRow(arraySpec, row));
      continue;
    }
    if (arraySpec) {
      state.quarantined[key] = {
        value,
        reason: `“${key}” has to be a list of ${arraySpec.itemLabel} rows.`,
      };
      continue;
    }

    if (objectSpec && isPlainObject(value)) {
      const merged = blankValues(objectSpec.fields);
      for (const f of objectSpec.fields) {
        const v = value[f.key];
        if (v !== undefined && v !== null) merged[f.key] = v;
      }
      state.objects[key] = merged;
      continue;
    }
    if (objectSpec) {
      state.quarantined[key] = {
        value,
        reason: `“${key}” has to be an object with ${objectSpec.fields.map((f) => f.key).join(" and ")}.`,
      };
      continue;
    }

    // Allowed but not owned by a typed control (eyebrow / title / subtitle):
    // kept verbatim so saving the variant cannot drop it.
    state.retained[key] = value;
  }
  return state;
}

function hydrateRow(spec: ArraySpec, row: unknown): ItemState {
  if (spec.rowKind === "string") {
    if (typeof row === "string") {
      return { values: { [STRING_ROW_KEY]: row }, extras: {}, loaded: true };
    }
    return { values: {}, extras: {}, raw: row, loaded: true };
  }
  if (!isPlainObject(row)) {
    return { values: {}, extras: {}, raw: row, loaded: true };
  }
  const values = blankValues(spec.fields);
  const declared = new Set(spec.fields.map((f) => f.key));
  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (declared.has(k)) {
      if (v !== undefined && v !== null) values[k] = v;
    } else {
      extras[k] = v;
    }
  }
  return { values, extras, loaded: true };
}

// ── Serialize ──────────────────────────────────────────────────

/** Blank-ish values are dropped, never written as `""` (rule 2 above). */
function cleanFieldValue(field: FieldSpec, value: unknown): { keep: boolean; value?: unknown } {
  if (value === undefined || value === null) return { keep: false };
  if (field.coerce === "number") {
    const n = typeof value === "number" ? value : Number(String(value).trim());
    return Number.isFinite(n) ? { keep: true, value: n } : { keep: false };
  }
  if (typeof value === "string") {
    const t = value.trim();
    return t ? { keep: true, value: t } : { keep: false };
  }
  if (typeof value === "object") {
    // e.g. an avatar URL the uploader stored as { url }.
    return isPlainObject(value) && Object.keys(value).length === 0 ? { keep: false } : { keep: true, value };
  }
  return { keep: true, value };
}

function serializeItem(spec: ArraySpec, item: ItemState): { keep: boolean; value?: unknown } {
  if (item.raw !== undefined) return { keep: true, value: item.raw };

  if (spec.rowKind === "string") {
    const text = String(item.values[STRING_ROW_KEY] ?? "").trim();
    return text ? { keep: true, value: text } : { keep: false };
  }

  const out: Record<string, unknown> = { ...item.extras };
  for (const field of spec.fields) {
    const cleaned = cleanFieldValue(field, item.values[field.key]);
    if (cleaned.keep) out[field.key] = cleaned.value;
  }
  return Object.keys(out).length ? { keep: true, value: out } : { keep: false };
}

function serializeObject(spec: ObjectSpec, values: Record<string, unknown>): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const field of spec.fields) {
    const cleaned = cleanFieldValue(field, values[field.key]);
    if (cleaned.keep) out[field.key] = cleaned.value;
  }
  return Object.keys(out).length === spec.fields.length ? out : null;
}

/**
 * The object that goes into `section_variants.content`, or null when there is
 * nothing to store. Quarantined keys are deliberately absent — they are the
 * reason Save asks for an acknowledgement.
 */
export function serializeContent(sectionKey: string, state: ContentState): Record<string, unknown> | null {
  const schema = schemaFor(sectionKey);
  if (!schema) return null;
  const out: Record<string, unknown> = { ...state.retained };

  for (const spec of schema.arrays) {
    const rows = state.arrays[spec.key] ?? [];
    const values = rows
      .map((row) => serializeItem(spec, row))
      .filter((r) => r.keep)
      .map((r) => r.value);
    if (values.length > 0) {
      out[spec.key] = values;
    } else if (spec.emptyMeansHidden) {
      // SERVICES / WHY_US: an absent key resurrects their hardcoded cards.
      out[spec.key] = [];
    }
  }

  for (const spec of schema.objects ?? []) {
    const obj = serializeObject(spec, state.objects[spec.key] ?? {});
    if (obj) out[spec.key] = obj;
  }

  return Object.keys(out).length ? out : null;
}

// ── Validate ───────────────────────────────────────────────────

/**
 * `quarantineAcknowledged` is the admin's tick agreeing to lose those keys.
 * Until then the loss is an error that stops the save; after it the same
 * entries stay visible as warnings, because a legacy key must not make a
 * variant unsaveable — the acknowledgement exists precisely to allow it.
 */
export function validateContent(
  sectionKey: string,
  state: ContentState,
  quarantineAcknowledged = false,
): ContentIssue[] {
  const schema = schemaFor(sectionKey);
  if (!schema) return [];
  const issues: ContentIssue[] = [];
  const lossLevel: ContentIssue["level"] = quarantineAcknowledged ? "warning" : "error";

  if (state.unparseable !== null) {
    issues.push({
      message: "The stored content is not an object, so it cannot be edited here. "
        + "Discard it to continue — nothing else on this variant changes.",
      level: lossLevel,
    });
  }

  for (const spec of schema.arrays) {
    const rows = state.arrays[spec.key] ?? [];
    let rawRows = 0;

    rows.forEach((row, index) => {
      if (row.raw !== undefined) {
        rawRows += 1;
        return;
      }
      for (const field of spec.fields) {
        const cleaned = cleanFieldValue(field, row.values[field.key]);
        if (field.required && !cleaned.keep) {
          issues.push({
            arrayKey: spec.key, index, fieldKey: field.key,
            message: `${rowLabel(spec, index)} needs ${
              field.key === STRING_ROW_KEY ? "a value" : field.label.toLowerCase()
            }.`,
            level: "error",
          });
          continue;
        }
        if (cleaned.keep && field.kind === "number" && typeof cleaned.value !== "number") {
          issues.push({
            arrayKey: spec.key, index, fieldKey: field.key,
            message: `${rowLabel(spec, index)} must be a number.`,
            level: "error",
          });
        }
        if (cleaned.keep && field.options && typeof cleaned.value === "string"
          && !field.options.includes(cleaned.value)) {
          issues.push({
            arrayKey: spec.key, index, fieldKey: field.key,
            message: `“${cleaned.value}” is not an option the ${sectionKey} band can draw.`,
            level: "error",
          });
        }
      }
    });

    if (spec.keyField) {
      const seen = new Map<string, number[]>();
      rows.forEach((row, index) => {
        if (row.raw !== undefined) return;
        const raw = spec.rowKind === "string"
          ? String(row.values[STRING_ROW_KEY] ?? "")
          : String(row.values[spec.keyField!] ?? "");
        const key = raw.trim();
        if (!key) return;
        seen.set(key, [...(seen.get(key) ?? []), index]);
      });
      for (const [key, indexes] of seen) {
        if (indexes.length < 2) continue;
        issues.push({
          arrayKey: spec.key, index: indexes[1], fieldKey: spec.keyField,
          message: `Two ${spec.itemLabel} rows share “${key}”, and the site uses it to `
            + "tell them apart. Give one a different value.",
          level: spec.duplicateIsError ? "error" : "warning",
        });
      }
    }

    if (rawRows > 0) {
      issues.push({
        arrayKey: spec.key,
        message: `${rawRows} row(s) in this list are in a shape this editor cannot show. `
          + "They will be saved exactly as they are — remove them to replace them.",
        level: "warning",
      });
    }
  }

  for (const spec of schema.objects ?? []) {
    const values = state.objects[spec.key] ?? {};
    const filled = spec.fields.filter((f) => cleanFieldValue(f, values[f.key]).keep);
    if (filled.length > 0 && filled.length < spec.fields.length) {
      const missing = spec.fields.find((f) => !cleanFieldValue(f, values[f.key]).keep);
      issues.push({
        objectKey: spec.key, fieldKey: missing?.key,
        message: `${spec.label} needs both ${spec.fields.map((f) => f.label.toLowerCase()).join(" and ")}.`,
        level: "error",
      });
    }
  }

  for (const [key, q] of Object.entries(state.quarantined)) {
    issues.push({
      message: `${q.reason} Saving drops “${key}” from this variant.`,
      level: lossLevel,
    });
  }

  return issues;
}

/** The row a message is about: "Strip item 2", or "This entry" for a text list. */
function rowLabel(spec: ArraySpec, index: number): string {
  const noun = spec.rowKind === "string" ? "this entry" : `${spec.itemLabel} ${index + 1}`;
  return capitalize(noun);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Errors only — warnings never block a save. */
export function blockingIssues(issues: ContentIssue[]): ContentIssue[] {
  return issues.filter((i) => i.level === "error");
}

export function issuesForRow(issues: ContentIssue[], arrayKey: string, index: number): ContentIssue[] {
  return issues.filter((i) => i.arrayKey === arrayKey && i.index === index);
}
