// ============================================================
// WAYTERO ADMIN — LANDING PAGE BLOCK LIST EDITOR
// Doc Ref: City + Service-Type Landing Pages §Phase 3
//
//  A landing page is an ordered list of blocks. Two kinds exist and the admin
//  must not be able to confuse them:
//
//   • data blocks (fare table, hotel/tour/vehicle grids) pull live numbers from
//     the booking tables. They have a title and a card limit — nothing else —
//     because a hand-typed price on a page that also shows the real fare table
//     is how a marketing site starts lying.
//   • authored blocks render one of the page's own lists (highlights, stats,
//     gallery, FAQ). The content lives in those lists, so this row only decides
//     *whether* and *under what heading* they appear.
//
//  Reordering is up/down buttons rather than drag: the portal is used on a
//  laptop and on a phone, and a drag handle is the one control that stops
//  working on the second one.
// ============================================================

import { useState } from "react";
import {
  alpha,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { ArrowDownward, ArrowUpward, Delete } from "@mui/icons-material";

import {
  BLOCK_TYPE_LABELS,
  DATA_BLOCKS,
  type LandingBlock,
  type LandingBlockType,
} from "../../../services/landingPages.service";

/** Blocks that only decide whether a page-level list is shown, and where. */
const SOURCE_ONLY_BLOCKS: LandingBlockType[] = ["highlights", "stats", "gallery", "faq"];

interface Props {
  blocks: LandingBlock[];
  /** The vocabulary the server accepts for this page type, from /specs. */
  allowedTypes: LandingBlockType[];
  maxBlocks: number;
  onChange: (blocks: LandingBlock[]) => void;
}

export default function BlockListEditor({
  blocks,
  allowedTypes,
  maxBlocks,
  onChange,
}: Props) {
  const theme = useTheme();
  const [pendingType, setPendingType] = useState<LandingBlockType | "">("");

  const addBlock = () => {
    if (!pendingType || blocks.length >= maxBlocks) return;
    onChange([...blocks, { type: pendingType, title: null }]);
    setPendingType("");
  };

  const patchAt = (index: number, patch: Partial<LandingBlock>) =>
    onChange(blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)));

  const removeAt = (index: number) => onChange(blocks.filter((_, i) => i !== index));

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  // Already-used blocks would render the same list twice, so they are not
  // offered a second time. Data blocks are singletons for the same reason.
  const used = new Set(blocks.map((b) => b.type));
  const offerable = allowedTypes.filter((t) => !used.has(t));

  return (
    <Box>
      <Stack spacing={1.5}>
        {blocks.map((block, index) => {
          const isData = DATA_BLOCKS.includes(block.type);
          const isSourceOnly = SOURCE_ONLY_BLOCKS.includes(block.type);
          return (
            <Box
              key={`${block.type}-${index}`}
              sx={{
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
                p: 1.5,
                bgcolor: alpha(theme.palette.primary.main, 0.02),
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
                  {BLOCK_TYPE_LABELS[block.type] ?? block.type}
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  label={isData ? "live data" : isSourceOnly ? "authored list" : "authored"}
                />
                <Tooltip title="Move up">
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${block.type} up`}
                    >
                      <ArrowUpward fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Move down">
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => move(index, 1)}
                      disabled={index === blocks.length - 1}
                      aria-label={`Move ${block.type} down`}
                    >
                      <ArrowDownward fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <IconButton
                  size="small"
                  onClick={() => removeAt(index)}
                  aria-label={`Remove ${block.type}`}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  size="small"
                  label="Heading"
                  placeholder="Leave blank to use the platform default"
                  value={block.title ?? ""}
                  onChange={(e) => patchAt(index, { title: e.target.value || null })}
                  sx={{ flex: 1 }}
                />
                {isData && (
                  <TextField
                    size="small"
                    type="number"
                    label="Cards"
                    value={block.limit ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      patchAt(index, { limit: raw === "" ? undefined : Math.max(1, Number(raw)) });
                    }}
                    sx={{ width: { xs: "100%", sm: 120 } }}
                  />
                )}
              </Stack>

              {block.type === "prose" && (
                <TextField
                  size="small"
                  multiline
                  minRows={3}
                  label="Text"
                  value={typeof block.body === "string" ? block.body : ""}
                  onChange={(e) => patchAt(index, { body: e.target.value })}
                  fullWidth
                  sx={{ mt: 1 }}
                />
              )}

              {isSourceOnly && (
                <Typography variant="caption" color="text.secondary">
                  Renders this page&rsquo;s {block.type} list — edit the content below this one.
                </Typography>
              )}
              {isData && (
                <Typography variant="caption" color="text.secondary">
                  Filled from live inventory and pricing; there is nothing to type here.
                </Typography>
              )}
            </Box>
          );
        })}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Select
          size="small"
          displayEmpty
          value={pendingType}
          onChange={(e) => setPendingType(e.target.value as LandingBlockType | "")}
          sx={{ minWidth: 220 }}
          aria-label="Block to add"
          renderValue={(v) => (v ? BLOCK_TYPE_LABELS[v as LandingBlockType] : "Choose a block")}
        >
          {offerable.map((t) => (
            <MenuItem key={t} value={t}>
              {BLOCK_TYPE_LABELS[t]}
            </MenuItem>
          ))}
        </Select>
        <Button
          variant="outlined"
          onClick={addBlock}
          disabled={!pendingType || blocks.length >= maxBlocks}
        >
          Add block
        </Button>
      </Stack>
      {blocks.length >= maxBlocks && (
        <Typography variant="caption" color="warning.main">
          This page is at its block limit ({maxBlocks}).
        </Typography>
      )}
      {offerable.length === 0 && blocks.length < maxBlocks && (
        <Typography variant="caption" color="text.secondary">
          Every block type this page can carry is already in use.
        </Typography>
      )}
    </Box>
  );
}
