// ============================================================
// WAYTERO ADMIN — CMS CONTENT DATA PICKER
// Doc Ref: Migration 0044_website_cms
//
//  Populates a section's structured content from live database
//  records (hotels, coupons, destinations, services) instead of
//  hand-typing JSON. The chosen records are appended to the
//  content JSON under the section's array key.
//
//  Picker types (backend GET /cms/picker-items?type=…):
//    HOTELS       → FEATURED_HOTELS       hotels[]
//    COUPONS      → OFFERS                offers[]
//    DESTINATIONS → POPULAR_DESTINATIONS  destinations[]
//    SERVICES     → SERVICES              items[]
// ============================================================

import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Alert, CircularProgress, Typography,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Checkbox, Box, alpha, useTheme,
} from "@mui/material";
import { Storage, Search } from "@mui/icons-material";
import { useSnackbar } from "notistack";

import {
  cmsService, CmsPickerItem, CmsPickerResult,
} from "../../../services/cms.service";
import { apiErrorMessage } from "../../../utils/apiError";

export interface ContentPickerConfig {
  type: string;          // HOTELS | COUPONS | DESTINATIONS | SERVICES
  key: string;           // content JSON array key, e.g. "hotels", "offers"
  label: string;         // human label for the source
  help: string;
}

function itemLabel(item: CmsPickerItem, index: number): string {
  const title = (item.name as string) || (item.title as string);
  if (title) return title;
  const city = item.city as string;
  const state = item.state as string;
  const sub = [city, state].filter(Boolean).join(", ");
  return sub || `Record #${index + 1}`;
}

function itemDetail(item: CmsPickerItem): string {
  const parts: string[] = [];
  if (item.badge) parts.push(String(item.badge));
  if (item.city) parts.push(String(item.city));
  if (item.desc) parts.push(String(item.desc));
  if (item.cta_text) parts.push(String(item.cta_text));
  return parts.join(" · ");
}

export default function ContentDataPicker({
  open,
  config,
  onClose,
  onApply,
}: {
  open: boolean;
  config: ContentPickerConfig;
  onClose: () => void;
  onApply: (items: CmsPickerItem[]) => void;
}) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const [data, setData] = useState<CmsPickerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setQuery("");
    setError(null);
    setData(null);
    let cancelled = false;
    setLoading(true);
    cmsService
      .pickerItems(config.type)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (!cancelled) setError(apiErrorMessage(e, "Failed to load records"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, config.type]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.items;
    return data.items.filter((item, i) => {
      const label = itemLabel(item, i).toLowerCase();
      const detail = itemDetail(item).toLowerCase();
      return label.includes(q) || detail.includes(q);
    });
  }, [data, query]);

  const toggle = (index: number) => {
    setSelected((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  const handleApply = () => {
    if (selected.length === 0) {
      enqueueSnackbar("Select at least one record", { variant: "warning" });
      return;
    }
    const items = selected
      .map((i) => filtered[i])
      .filter((item): item is CmsPickerItem => Boolean(item));
    onApply(items);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Storage color="primary" />
        Pick {config.label.toLowerCase()} from database
      </DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2, "& strong": { fontWeight: 700 } }}>
          Adds records into the <code>{config.key}</code> array of the
          content JSON. {config.help}
        </Alert>

        <TextField
          fullWidth
          size="small"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{ startAdornment: <Search fontSize="small" sx={{ mr: 1, color: "text.secondary" }} /> }}
          sx={{ mb: 1.5 }}
        />

        {loading ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : !data || data.items.length === 0 ? (
          <Alert severity="warning">
            No {config.label.toLowerCase()} found in the database yet. Add records
            under the relevant section of the admin, then come back here.
          </Alert>
        ) : (
          <List dense disablePadding sx={{ maxHeight: 320, overflow: "auto" }}>
            {filtered.map((item, index) => {
              const checked = selected.includes(index);
              return (
                <ListItem key={index} disablePadding divider>
                  <ListItemButton onClick={() => toggle(index)} dense>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Checkbox
                        edge="start"
                        checked={checked}
                        tabIndex={-1}
                        disableRipple
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={itemLabel(item, index)}
                      secondary={
                        itemDetail(item) || undefined
                      }
                      primaryTypographyProps={{ fontWeight: 600, fontSize: 14 }}
                      secondaryTypographyProps={{ fontSize: 12, sx: { color: "text.secondary" } }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
            {filtered.length === 0 && (
              <Box py={4} textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  No matches for “{query}”.
                </Typography>
              </Box>
            )}
          </List>
        )}

        <Box
          sx={{
            mt: 2, px: 1.5, py: 1, borderRadius: 1.5,
            bgcolor: alpha(theme.palette.warning.main, 0.08),
            border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Records are pulled as-is — review prices, images and ratings in the
            JSON editor before activating this variant on the homepage.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={loading || selected.length === 0}
          onClick={handleApply}
        >
          Add {selected.length > 0 ? `${selected.length} selected` : "to content"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}