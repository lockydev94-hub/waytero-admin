// ============================================================
// WAYTERO ADMIN — CMS SECTION CONTENT EDITOR
// Doc Ref: Migration 0044_website_cms
//
//  Replaces the raw JSON textarea in the add/edit-variant dialog. Given a
//  section key it renders whatever that band actually stores: typed rows for
//  the nine bands with structured content, an explainer for the bands whose
//  cards the homepage pulls from live tables, and a read-only preview of the
//  object that will be written.
//
//  Admins no longer author JSON. The preview is there so they can see exactly
//  what the typed fields became — it is a mirror, not an input.
// ============================================================

import { useState } from "react";
import {
  Alert, Box, Button, Checkbox, Collapse, Divider, FormControlLabel,
  Stack, TextField, Typography,
} from "@mui/material";
import { ExpandMore, ExpandLess, Storage } from "@mui/icons-material";

import {
  LIVE_DATA_BANDS, NO_CONTENT_BANDS, SECTION_CONTENT_SCHEMA,
} from "./sectionContentSchema";
import {
  serializeContent, type ContentIssue, type ContentState,
} from "./sectionContentState";
import ItemListEditor from "./ItemListEditor";

interface Props {
  sectionKey: string;
  state: ContentState;
  issues: ContentIssue[];
  /** Present when this band's array has a database source. */
  onBrowse?: () => void;
  quarantineAck: boolean;
  onQuarantineAck: (next: boolean) => void;
  onChange: (next: ContentState) => void;
}

export default function SectionContentEditor({
  sectionKey, state, issues, onBrowse,
  quarantineAck, onQuarantineAck, onChange,
}: Props) {
  const schema = SECTION_CONTENT_SCHEMA[sectionKey];

  // ── Live-data bands and functional strips: nothing to author ──
  if (LIVE_DATA_BANDS[sectionKey] || NO_CONTENT_BANDS.includes(sectionKey)) {
    return (
      <LiveBandNotice
        sectionKey={sectionKey}
        retained={state.retained}
      />
    );
  }

  // ── A band this editor has no schema for ──────────────────────
  if (!schema) {
    return (
      <Alert severity="info">
        <strong>{sectionKey}</strong> has no structured content to edit here.
        Its heading, sub-heading and button fields above are what the homepage
        renders.
      </Alert>
    );
  }

  // CTA's only content keys are fallbacks for the heading inputs above, so the
  // schema exists but owns nothing to edit.
  if (schema.arrays.length === 0 && (schema.objects ?? []).length === 0) {
    return <LiveBandNotice sectionKey={sectionKey} retained={state.retained} />;
  }

  const setArray = (key: string, items: ContentState["arrays"][string]) =>
    onChange({ ...state, arrays: { ...state.arrays, [key]: items } });

  const setObject = (key: string, values: Record<string, unknown>) =>
    onChange({ ...state, objects: { ...state.objects, [key]: values } });

  const out = serializeContent(sectionKey, state);

  return (
    <Stack spacing={2}>
      {schema.arrays.map((spec) => (
        <Box key={spec.key}>
          <ItemListEditor
            spec={spec}
            items={state.arrays[spec.key] ?? []}
            sectionKey={sectionKey}
            folder={`waytero/cms/${sectionKey.toLowerCase()}/${spec.key}`}
            issues={issues}
            onChange={(items) => setArray(spec.key, items)}
          />
        </Box>
      ))}

      {(schema.objects ?? []).map((spec) => (
        <Box key={spec.key}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
            {spec.label}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            {spec.help}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            {spec.fields.map((field) => (
              <TextField
                key={field.key}
                size="small"
                fullWidth
                label={field.label}
                placeholder={field.placeholder}
                value={String((state.objects[spec.key] ?? {})[field.key] ?? "")}
                onChange={(e) => setObject(spec.key, {
                  ...(state.objects[spec.key] ?? {}),
                  [field.key]: e.target.value,
                })}
              />
            ))}
          </Stack>
        </Box>
      ))}

      {onBrowse && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<Storage />}
          onClick={onBrowse}
        >
          Browse database…
        </Button>
      )}

      <QuarantinePanel
        state={state}
        acknowledged={quarantineAck}
        onAcknowledge={onQuarantineAck}
      />

      <ContentPreview value={out} />
    </Stack>
  );
}

// ── Live-data bands ────────────────────────────────────────────

function LiveBandNotice({
  sectionKey, retained,
}: {
  sectionKey: string;
  retained: Record<string, unknown>;
}) {
  const cards = LIVE_DATA_BANDS[sectionKey];
  const retainedKeys = Object.keys(retained);
  return (
    <Stack spacing={1}>
      <Alert severity="info">
        {cards
          ? <>This band shows live {cards} — the homepage fetches them when it renders,
              so there is nothing to curate here. Manage them on their own admin page.
              Eyebrow, heading, sub-heading and button fields above are all this band reads.</>
          : <>This band has no structured content — it only uses the copy fields above.</>}
      </Alert>
      {retainedKeys.length > 0 && (
        <Alert severity="warning">
          This variant still carries {retainedKeys.map((k) => `“${k}”`).join(", ")}, which
          the site ignores. They are kept as they are so nothing is deleted; save once to
          clear them.
        </Alert>
      )}
    </Stack>
  );
}

// ── Keys the backend will not accept ───────────────────────────

function QuarantinePanel({
  state, acknowledged, onAcknowledge,
}: {
  state: ContentState;
  acknowledged: boolean;
  onAcknowledge: (next: boolean) => void;
}) {
  const entries = Object.entries(state.quarantined);
  const [open, setOpen] = useState(true);
  if (entries.length === 0 && state.unparseable === null) return null;

  return (
    <Box>
      <Alert
        severity="error"
        action={
          <Button size="small" color="inherit" onClick={() => setOpen((v) => !v)}>
            {open ? <ExpandLess /> : <ExpandMore />}
          </Button>
        }
      >
        {entries.length > 0
          ? <>This variant holds {entries.length} content key(s) the site cannot use.
              Saving removes them.</>
          : "The stored content is not an object the editor can show. Saving removes it."}
      </Alert>
      <Collapse in={open}>
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 1.5, mt: -0.5 }}>
          {entries.map(([key, q]) => (
            <Box key={key} sx={{ mb: 1 }}>
              <Typography variant="body2" fontWeight={600}>
                {key}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {q.reason}
              </Typography>
              <Typography
                component="pre"
                variant="caption"
                sx={{
                  mt: 0.5, p: 1, borderRadius: 1, overflow: "auto", maxHeight: 140,
                  bgcolor: "action.hover",
                  fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                }}
              >
                {safeJson(q.value)}
              </Typography>
            </Box>
          ))}
          {state.unparseable !== null && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Whole value: {state.unparseable}
            </Typography>
          )}
          <FormControlLabel
            control={
              <Checkbox
                checked={acknowledged}
                onChange={(e) => onAcknowledge(e.target.checked)}
              />
            }
            label="Remove these from the variant when I save"
          />
        </Box>
      </Collapse>
    </Box>
  );
}

// ── Read-only preview ──────────────────────────────────────────

function ContentPreview({ value }: { value: Record<string, unknown> | null }) {
  const [open, setOpen] = useState(false);
  return (
    <Box>
      <Divider sx={{ mb: 1 }} />
      <Button size="small" onClick={() => setOpen((v) => !v)} startIcon={open ? <ExpandLess /> : <ExpandMore />}>
        {open ? "Hide" : "Preview"} what gets stored
      </Button>
      <Collapse in={open}>
        <Typography
          component="pre"
          variant="caption"
          sx={{
            mt: 1, p: 1.5, borderRadius: 2, overflow: "auto", maxHeight: 320,
            bgcolor: "action.hover", border: 1, borderColor: "divider",
            fontFamily: "ui-monospace, Menlo, Consolas, monospace",
          }}
        >
          {value === null ? "null — this band stores no content" : JSON.stringify(value, null, 2)}
        </Typography>
      </Collapse>
    </Box>
  );
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2) ?? String(v);
  } catch {
    return String(v);
  }
}
