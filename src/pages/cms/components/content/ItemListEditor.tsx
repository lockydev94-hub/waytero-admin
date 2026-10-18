// ============================================================
// WAYTERO ADMIN — CMS CONTENT ITEM LIST EDITOR
// Doc Ref: Migration 0044_website_cms
//
//  One row per entry of a section's content array (a marquee strip item, a
//  service card, a step, a stat, a review, a partner brand, an FAQ). The row
//  controls come from the band's ArraySpec, so adding a band is a schema edit,
//  not a new component.
//
//  Order is content, not decoration: every renderer maps these arrays in the
//  order stored, so up/down arrows change the homepage. Rows that came from
//  the database in a shape the schema cannot express are shown read-only and
//  written back untouched rather than silently dropped.
// ============================================================

import {
  Box, Button, Card, CardContent, Chip, FormControl, IconButton,
  InputLabel, MenuItem, Select, Stack, TextField, Tooltip, Typography,
  alpha, useTheme,
} from "@mui/material";
import { Add, ArrowDownward, ArrowUpward, Delete } from "@mui/icons-material";

import MediaUploader, { CropSpec } from "../MediaUploader";
import { STRING_ROW_KEY, type ArraySpec, type FieldSpec } from "./sectionContentSchema";
import {
  emptyItem, issuesForRow, type ContentIssue, type ItemState,
} from "./sectionContentState";

const CROP_AVATAR: CropSpec = { aspectRatio: 1, outputWidth: 256, outputHeight: 256 };

interface Props {
  spec: ArraySpec;
  items: ItemState[];
  sectionKey: string;
  folder: string;
  issues: ContentIssue[];
  onChange: (next: ItemState[]) => void;
}

export default function ItemListEditor({
  spec, items, sectionKey, folder, issues, onChange,
}: Props) {
  const theme = useTheme();

  const patch = (index: number, key: string, value: unknown) =>
    onChange(items.map((it, i) => (
      i === index ? { ...it, values: { ...it.values, [key]: value } } : it
    )));

  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
  };

  const add = () => onChange([...items, emptyItem(spec)]);

  return (
    <Box>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" fontWeight={700}>
          {headingFor(spec)}
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            {items.length}/{spec.max}
          </Typography>
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Add />}
          onClick={add}
          disabled={items.length >= spec.max}
        >
          {spec.addLabel ?? `Add ${spec.itemLabel}`}
        </Button>
      </Stack>

      {items.length === 0 ? (
        <Box
          sx={{
            border: `1px dashed ${alpha(theme.palette.divider, 1)}`,
            borderRadius: 2, px: 2, py: 1.5,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {emptyText(spec, sectionKey)}
          </Typography>
          {spec.picker && (
            <Typography variant="caption" color="text.secondary">
              Use “Browse database…” below to add {spec.picker.label}.
            </Typography>
          )}
        </Box>
      ) : (
        <Stack spacing={1}>
          {items.map((item, index) => (
            <Row
              key={index}
              index={index}
              item={item}
              spec={spec}
              sectionKey={sectionKey}
              folder={folder}
              rowIssues={issuesForRow(issues, spec.key, index)}
              onPatch={patch}
              onRemove={remove}
              onMove={move}
              last={index === items.length - 1}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}

// ── Row ────────────────────────────────────────────────────────

function Row({
  index, item, spec, sectionKey, folder, rowIssues, onPatch, onRemove, onMove, last,
}: {
  index: number;
  item: ItemState;
  spec: ArraySpec;
  sectionKey: string;
  folder: string;
  rowIssues: ContentIssue[];
  onPatch: (i: number, key: string, v: unknown) => void;
  onRemove: (i: number) => void;
  onMove: (i: number, dir: -1 | 1) => void;
  last: boolean;
}) {
  const hasError = rowIssues.some((i) => i.level === "error");
  const hasWarning = rowIssues.some((i) => i.level === "warning");

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        borderColor: hasError
          ? "error.main"
          : hasWarning
            ? "warning.main"
            : "divider",
      }}
    >
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack direction="row" alignItems="flex-start" spacing={1}>
          <Box flex={1} minWidth={0}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Chip size="small" label={`${index + 1}`} />
              <Typography variant="caption" color="text.secondary" noWrap>
                {rowTitle(item, spec)}
              </Typography>
              {rowIssues.length > 0 && (
                <Chip
                  size="small"
                  color={hasError ? "error" : "warning"}
                  variant="outlined"
                  label={hasError ? "Needs attention" : "Check"}
                />
              )}
            </Stack>

            {item.raw !== undefined ? (
              <RawRow value={item.raw} />
            ) : spec.rowKind === "string" ? (
              <TextField
                fullWidth
                size="small"
                label={spec.fields[0]?.label ?? "Value"}
                value={String(item.values[STRING_ROW_KEY] ?? "")}
                onChange={(e) => onPatch(index, STRING_ROW_KEY, e.target.value)}
              />
            ) : (
              <FieldGrid
                fields={spec.fields}
                item={item}
                index={index}
                sectionKey={sectionKey}
                folder={folder}
                onPatch={onPatch}
              />
            )}

            {rowIssues.length > 0 && (
              <Stack spacing={0.25} sx={{ mt: 0.75 }}>
                {rowIssues.map((issue, k) => (
                  <Typography
                    key={k}
                    variant="caption"
                    sx={{ color: issue.level === "error" ? "error.main" : "warning.main" }}
                  >
                    {issue.message}
                  </Typography>
                ))}
              </Stack>
            )}
          </Box>

          <Stack sx={{ pt: 3 }}>
            <IconButton
              size="small"
              onClick={() => onMove(index, -1)}
              disabled={index === 0}
              aria-label={`Move ${spec.itemLabel} ${index + 1} up`}
            >
              <ArrowUpward fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => onMove(index, 1)}
              disabled={last}
              aria-label={`Move ${spec.itemLabel} ${index + 1} down`}
            >
              <ArrowDownward fontSize="small" />
            </IconButton>
            <Tooltip title={`Remove this ${spec.itemLabel}`}>
              <IconButton size="small" color="error" onClick={() => onRemove(index)}
                aria-label={`Remove ${spec.itemLabel} ${index + 1}`}>
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Short fields two-up, wide ones full width. */
function FieldGrid({
  fields, item, index, sectionKey, folder, onPatch,
}: {
  fields: FieldSpec[];
  item: ItemState;
  index: number;
  sectionKey: string;
  folder: string;
  onPatch: (i: number, key: string, v: unknown) => void;
}) {
  return (
    <Stack spacing={1.25}>
      {fields.map((field) => (
        <Control
          key={field.key}
          field={field}
          item={item}
          index={index}
          sectionKey={sectionKey}
          folder={folder}
          onPatch={onPatch}
        />
      ))}
    </Stack>
  );
}

function Control({
  field, item, index, sectionKey, folder, onPatch,
}: {
  field: FieldSpec;
  item: ItemState;
  index: number;
  sectionKey: string;
  folder: string;
  onPatch: (i: number, key: string, v: unknown) => void;
}) {
  const value = item.values[field.key];
  const asText = value === undefined || value === null ? "" : String(value);

  if (field.kind === "image") {
    return (
      <Box>
        <Typography variant="caption" color="text.secondary">{field.label}</Typography>
        <MediaUploader
          label={field.label}
          kind={field.imageKind ?? "image"}
          folder={`${folder}/avatar`}
          value={asText || null}
          onChange={(url) => onPatch(index, field.key, url ?? "")}
          previewHeight={72}
          crop={CROP_AVATAR}
        />
        {field.help && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            {field.help}
          </Typography>
        )}
      </Box>
    );
  }

  if (field.kind === "select") {
    const options = field.options ?? [];
    return (
      <Box>
        <FormControl fullWidth size="small">
          <InputLabel>{field.label}</InputLabel>
          <Select
            label={field.label}
            value={asText}
            onChange={(e) => onPatch(index, field.key, e.target.value)}
          >
            <MenuItem value="">
              <em>Default</em>
            </MenuItem>
            {options.map((o) => (
              <MenuItem key={o} value={o}>{o}</MenuItem>
            ))}
          </Select>
        </FormControl>
        {field.help && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            {field.help}
          </Typography>
        )}
      </Box>
    );
  }

  const isNumber = field.kind === "number";
  return (
    <TextField
      fullWidth
      size="small"
      label={field.label}
      required={field.required}
      type={isNumber ? "number" : "text"}
      multiline={field.kind === "textarea"}
      minRows={field.kind === "textarea" ? 2 : undefined}
      value={asText}
      placeholder={field.placeholder}
      helperText={field.help}
      onChange={(e) => onPatch(index, field.key, e.target.value)}
      inputProps={isNumber ? { step: 1, min: 0 } : undefined}
      sx={isNumber ? { maxWidth: 260 } : undefined}
    />
  );
}

function RawRow({ value }: { value: unknown }) {
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch {
    text = String(value);
  }
  return (
    <Box>
      <Chip size="small" color="warning" variant="outlined" label="Stored as-is" />
      <Typography
        variant="caption"
        component="pre"
        sx={{
          display: "block", mt: 0.5, p: 1, borderRadius: 1, overflow: "auto",
          bgcolor: "action.hover", fontFamily: "ui-monospace, Menlo, Consolas, monospace",
        }}
      >
        {text}
      </Typography>
    </Box>
  );
}

// ── Copy ───────────────────────────────────────────────────────

function headingFor(spec: ArraySpec): string {
  return {
    marquee_items: "Hero strip items",
    items: spec.itemLabel === "reason" ? "Reasons to choose us" : "Service cards",
    stats: "Stats",
    steps: "Steps",
    testimonials: "Reviews",
    partners: "Partner brands",
    faqs: "Questions",
  }[spec.key] ?? spec.key;
}

function emptyText(spec: ArraySpec, sectionKey: string): string {
  if (spec.emptyMeansHidden) {
    return `No ${spec.itemLabel}s — with none here this band is hidden on the homepage. `
      + "Leaving the list untouched in a saved variant shows this band's built-in cards.";
  }
  if (spec.key === "marquee_items") {
    return "No items — the hero shows no strip.";
  }
  return `No ${spec.itemLabel}s yet — the ${sectionKey} band stays hidden until you add one.`;
}

function rowTitle(item: ItemState, spec: ArraySpec): string {
  if (item.raw !== undefined) return "legacy row";
  if (spec.rowKind === "string") {
    return String(item.values[STRING_ROW_KEY] ?? "").trim() || "(blank)";
  }
  const titleKey = spec.keyField ?? spec.fields[0]?.key;
  if (!titleKey) return "";
  return String(item.values[titleKey] ?? "").trim() || "(untitled)";
}
