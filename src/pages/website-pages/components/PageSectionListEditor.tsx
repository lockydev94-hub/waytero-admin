// ============================================================
// WAYTERO ADMIN — PAGE SECTION LIST EDITOR
// Doc Ref: Round 6 · Website → Pages editor · Body tab
//
//  The body of a static page is a run of heading + paragraph rows, and this is
//  the only way to write one: there is no raw-JSON textarea anywhere in this
//  screen, because a stray bracket turns a policy page into the built-in
//  fallback with no visible reason.
//
//  `body` is plain text. The website renders it with `white-space: pre-line`,
//  so a line break typed here is a line break on the page — no markdown, no
//  HTML, nothing to escape.
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
import { Add, ArrowDownward, ArrowUpward, ContentCopy, Delete } from "@mui/icons-material";

import { MAX_SECTIONS, type PageSection } from "../../../services/pages.service";

interface Props {
  items: PageSection[];
  onChange: (items: PageSection[]) => void;
  max?: number;
}

export default function PageSectionListEditor({ items, onChange, max = MAX_SECTIONS }: Props) {
  const patchAt = (index: number, patch: Partial<PageSection>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const removeAt = (index: number) => onChange(items.filter((_, i) => i !== index));

  const duplicateAt = (index: number) => {
    const next = [...items];
    next.splice(index + 1, 0, { ...items[index] });
    onChange(next.slice(0, max));
  };

  const move = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="baseline" spacing={1}>
        <Typography variant="subtitle2" fontWeight={700}>
          Sections
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {items.length}/{max}
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
        These are the paragraphs of the page, in the order a reader sees them. A
        section with no heading is dropped when you save. Press Enter inside the
        body for a line break.
      </Typography>

      <Stack spacing={1.5}>
        {items.map((item, index) => (
          <Box
            key={index}
            sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 1.5, position: "relative" }}
          >
            <Stack direction="row" spacing={0.25} sx={{ position: "absolute", top: 6, right: 6 }}>
              <Tooltip title="Move up">
                <span>
                  <IconButton size="small" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move section ${index + 1} up`}>
                    <ArrowUpward fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Move down">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label={`Move section ${index + 1} down`}
                  >
                    <ArrowDownward fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Duplicate">
                <span>
                  <IconButton size="small" onClick={() => duplicateAt(index)} disabled={items.length >= max} aria-label={`Duplicate section ${index + 1}`}>
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Remove">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => removeAt(index)}
                    disabled={items.length === 1}
                    aria-label={`Remove section ${index + 1}`}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>

            <Stack spacing={1.25}>
              <TextField
                size="small"
                label="Heading"
                value={item.heading ?? ""}
                onChange={(e) => patchAt(index, { heading: e.target.value })}
                fullWidth
                inputProps={{ maxLength: 140 }}
              />
              <TextField
                size="small"
                label="Body"
                value={item.body ?? ""}
                onChange={(e) => patchAt(index, { body: e.target.value })}
                multiline
                minRows={4}
                maxRows={16}
                fullWidth
                inputProps={{ maxLength: 4000 }}
                helperText={`${(item.body ?? "").length}/4000`}
              />
            </Stack>
          </Box>
        ))}
      </Stack>

      <Button
        size="small"
        startIcon={<Add />}
        onClick={() => onChange([...items, { heading: "", body: "" }])}
        disabled={items.length >= max}
        sx={{ mt: 1.5 }}
      >
        Add section
      </Button>
    </Box>
  );
}
