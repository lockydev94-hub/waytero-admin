// ============================================================
// WAYTERO ADMIN — LINK LIST EDITOR
// Doc Ref: Migration 0044_website_cms
//
//  Reusable editor for a list of {label, href, external?} items,
//  used by header nav_links, footer quick_links, and footer legal_links.
// ============================================================

import {
  Box, Button, IconButton, Stack, TextField, FormControlLabel, Switch,
  Typography, Card, CardContent, alpha, useTheme,
} from "@mui/material";
import { Add, Delete, ArrowUpward, ArrowDownward } from "@mui/icons-material";

import type { NavLinkItem } from "../../../services/cms.service";

interface Props {
  label: string;
  value: NavLinkItem[];
  onChange: (next: NavLinkItem[]) => void;
  hint?: string;
}

export default function LinkListEditor({ label, value, onChange, hint }: Props) {
  const theme = useTheme();
  const items = value ?? [];

  const update = (idx: number, patch: Partial<NavLinkItem>) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange(next);
  };

  const remove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const add = () => {
    onChange([...items, { label: "", href: "", external: false }]);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
        <Box>
          <Typography variant="subtitle2" fontWeight={700}>
            {label}
          </Typography>
          {hint && (
            <Typography variant="caption" color="text.secondary">
              {hint}
            </Typography>
          )}
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Add />}
          onClick={add}
        >
          Add link
        </Button>
      </Stack>

      {items.length === 0 && (
        <Card variant="outlined" sx={{ borderStyle: "dashed" }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" align="center">
              No links yet. Click "Add link" to create one.
            </Typography>
          </CardContent>
        </Card>
      )}

      <Stack spacing={1}>
        {items.map((it, idx) => (
          <Card
            key={idx}
            variant="outlined"
            sx={{ borderRadius: 2, borderColor: alpha(theme.palette.divider, 0.6) }}
          >
            <CardContent sx={{ display: "flex", gap: 1, alignItems: "center", py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Stack flex={1} direction={{ xs: "column", md: "row" }} spacing={1}>
                <TextField
                  size="small"
                  label="Label"
                  value={it.label}
                  onChange={(e) => update(idx, { label: e.target.value })}
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  label="URL"
                  value={it.href}
                  onChange={(e) => update(idx, { href: e.target.value })}
                  sx={{ flex: 2 }}
                  placeholder="/path or https://…"
                />
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={!!it.external}
                      onChange={(e) => update(idx, { external: e.target.checked })}
                    />
                  }
                  label="External"
                />
              </Stack>
              <Stack>
                <IconButton size="small" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Move up">
                  <ArrowUpward fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => move(idx, 1)} disabled={idx === items.length - 1} aria-label="Move down">
                  <ArrowDownward fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => remove(idx)} aria-label="Remove">
                  <Delete fontSize="small" />
                </IconButton>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
