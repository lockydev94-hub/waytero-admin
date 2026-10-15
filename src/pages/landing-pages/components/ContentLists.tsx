// ============================================================
// WAYTERO ADMIN — LANDING PAGE AUTHORED LISTS
// Doc Ref: City + Service-Type Landing Pages §Phase 3
//
//  The four repeatable, hand-authored collections a landing page carries:
//  highlights, stat chips, gallery tiles and FAQs. Each one is rendered by a
//  block of the same name in the page's block list, so an empty list here means
//  that block has nothing to show — the block editor says as much.
//
//  These are the page-level equivalents of what the data blocks pull live, and
//  the same rule applies: whatever an admin types here is a claim the page has
//  to honour, which is why the FAQ pair is required-complete rather than
//  partially filled.
// ============================================================

import {
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Add, Delete } from "@mui/icons-material";

import MediaUploader, { cropForSlot } from "../../cms/components/MediaUploader";
import {
  slotGeometry,
  type LandingFaq,
  type LandingGalleryTile,
  type LandingHighlight,
  type LandingStat,
  type SlotSpec,
} from "../../../services/landingPages.service";

interface ListProps<T> {
  items: T[];
  max: number;
  onChange: (items: T[]) => void;
  addLabel: string;
  /** Heading above the list. */
  title: string;
  caption?: string;
}

/**
 * The add/limit/remove shell every one of these lists needs. Each caller only
 * supplies the row, so nothing here pretends the four shapes are one shape.
 */
function ListShell<T>({
  items,
  max,
  onChange,
  addLabel,
  title,
  caption,
  children,
}: ListProps<T> & { children: (item: T, index: number, patch: (p: Partial<T>) => void) => React.ReactNode }) {
  const patchAt = (index: number, patch: Partial<T>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const removeAt = (index: number) => onChange(items.filter((_, i) => i !== index));

  return (
    <Box>
      <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 0.5 }}>
        <Typography variant="subtitle2" fontWeight={700}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {items.length}/{max}
        </Typography>
      </Stack>
      {caption && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          {caption}
        </Typography>
      )}

      <Stack spacing={1.5}>
        {items.map((item, index) => (
          <Box
            key={index}
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              p: 1.5,
              position: "relative",
            }}
          >
            <Tooltip title="Remove">
              <IconButton
                size="small"
                onClick={() => removeAt(index)}
                sx={{ position: "absolute", top: 6, right: 6 }}
                aria-label={`Remove ${title} ${index + 1}`}
              >
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
            {children(item, index, (patch) => patchAt(index, patch))}
          </Box>
        ))}
      </Stack>

      <Button
        size="small"
        startIcon={<Add />}
        onClick={() => onChange([...items, {} as T])}
        disabled={items.length >= max}
        sx={{ mt: 1.5 }}
      >
        {addLabel}
      </Button>
    </Box>
  );
}

// ── Highlights ───────────────────────────────────────────────────────────────

export function HighlightListEditor({
  items,
  max,
  onChange,
  iconSlot,
}: ListProps<LandingHighlight> & { iconSlot?: SlotSpec }) {
  return (
    <ListShell
      title="Highlights"
      addLabel="Add highlight"
      caption="The short trust points under the hero. Keep them provable."
      items={items}
      max={max}
      onChange={onChange}
    >
      {(item, _index, patch) => (
        <Stack spacing={1.5}>
          <TextField
            size="small"
            label="Title"
            value={item.title ?? ""}
            onChange={(e) => patch({ title: e.target.value })}
            fullWidth
          />
          <TextField
            size="small"
            label="Text"
            value={item.text ?? ""}
            onChange={(e) => patch({ text: e.target.value })}
            multiline
            minRows={2}
            fullWidth
          />
          {iconSlot && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Icon (optional)
              </Typography>
              <MediaUploader
                value={item.icon_url ?? null}
                onChange={(url) => patch({ icon_url: url })}
                folder="waytero/landing"
                kind="icon"
                label="Upload icon"
                previewHeight={92}
                slot={slotGeometry(iconSlot)}
                crop={cropForSlot(slotGeometry(iconSlot))}
                strict
              />
            </Box>
          )}
        </Stack>
      )}
    </ListShell>
  );
}

// ── Stat chips ───────────────────────────────────────────────────────────────

export function StatListEditor({
  items,
  max,
  onChange,
}: ListProps<LandingStat>) {
  return (
    <ListShell
      title="Stat chips"
      addLabel="Add stat"
      caption={
        "Leave this empty to show the live numbers the platform can prove " +
        "(hotels bookable, packages, cheapest fare). Anything typed here replaces them."
      }
      items={items}
      max={max}
      onChange={onChange}
    >
      {(item, _index, patch) => (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            size="small"
            label="Value"
            value={item.value ?? ""}
            onChange={(e) => patch({ value: e.target.value })}
            sx={{ flex: 1 }}
          />
          <TextField
            size="small"
            label="Suffix"
            placeholder="+"
            value={item.suffix ?? ""}
            onChange={(e) => patch({ suffix: e.target.value || undefined })}
            sx={{ width: { xs: "100%", sm: 90 } }}
          />
          <TextField
            size="small"
            label="Label"
            value={item.label ?? ""}
            onChange={(e) => patch({ label: e.target.value })}
            sx={{ flex: 2 }}
          />
        </Stack>
      )}
    </ListShell>
  );
}

// ── Gallery ──────────────────────────────────────────────────────────────────

export function GalleryListEditor({
  items,
  max,
  onChange,
  tileSlot,
}: ListProps<LandingGalleryTile> & { tileSlot?: SlotSpec }) {
  return (
    <ListShell
      title="Gallery"
      addLabel="Add image"
      caption="Real photos of this place only — an unrelated stock image on a page that quotes live prices reads as a scam."
      items={items}
      max={max}
      onChange={onChange}
    >
      {(item, _index, patch) => (
        <Stack spacing={1.5}>
          {tileSlot ? (
            <MediaUploader
              value={item.image_url ?? null}
              onChange={(url) => patch({ image_url: url ?? "" })}
              folder="waytero/landing"
              kind="image"
              label="Upload gallery image"
              previewHeight={150}
              slot={slotGeometry(tileSlot)}
              crop={cropForSlot(slotGeometry(tileSlot))}
              strict
            />
          ) : (
            <TextField
              size="small"
              label="Image URL"
              value={item.image_url ?? ""}
              onChange={(e) => patch({ image_url: e.target.value })}
              fullWidth
            />
          )}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              size="small"
              label="Alt text"
              value={item.alt_text ?? ""}
              onChange={(e) => patch({ alt_text: e.target.value || null })}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="Caption"
              value={item.caption ?? ""}
              onChange={(e) => patch({ caption: e.target.value || null })}
              sx={{ flex: 1 }}
            />
          </Stack>
        </Stack>
      )}
    </ListShell>
  );
}

// ── FAQs ─────────────────────────────────────────────────────────────────────

export function FaqListEditor({ items, max, onChange }: ListProps<LandingFaq>) {
  return (
    <ListShell
      title="FAQs"
      addLabel="Add question"
      caption="These feed both the page and its FAQ rich result, so a half-written pair is worse than none."
      items={items}
      max={max}
      onChange={onChange}
    >
      {(item, _index, patch) => (
        <Stack spacing={1}>
          <TextField
            size="small"
            label="Question"
            value={item.question ?? ""}
            onChange={(e) => patch({ question: e.target.value })}
            fullWidth
          />
          <TextField
            size="small"
            label="Answer"
            value={item.answer ?? ""}
            onChange={(e) => patch({ answer: e.target.value })}
            multiline
            minRows={2}
            fullWidth
          />
        </Stack>
      )}
    </ListShell>
  );
}
