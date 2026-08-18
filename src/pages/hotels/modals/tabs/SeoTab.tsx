// ============================================================
// HOTEL DETAIL — SEO TAB (admin-only)
// Doc Ref: 03_FRONTEND_DESIGN.md §5 — slug, SEO fields, SERP preview
// ============================================================
import React, { useState } from "react";
import {
  Box, Card, CardContent, Typography, TextField, Stack,
  Button, Chip, Alert, CircularProgress, FormControlLabel,
  Switch, Divider, InputAdornment, alpha, useTheme,
} from "@mui/material";
import { Save, Tag, Search, WarningAmber } from "@mui/icons-material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { hotelService, HotelDetail } from "../../../../services/hotel.service";
import SectionHeader from "../../components/SectionHeader";
import { HOTEL_QUERY_KEYS } from "../../constants";
import { apiErrorMessage } from "../../../../utils/apiError";

interface Props {
  hotel: HotelDetail;
  onRefresh: () => void;
}

export default function SeoTab({ hotel, onRefresh }: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    slug: hotel.slug ?? "",
    seo_title: hotel.seo_title ?? "",
    seo_description: hotel.seo_description ?? "",
    seo_keywords: hotel.seo_keywords ?? "",
    is_featured: hotel.is_featured,
    display_order: String(hotel.display_order ?? 0),
  });
  const [keywords, setKeywords] = useState<string[]>(
    hotel.seo_keywords ? hotel.seo_keywords.split(",").map(s => s.trim()).filter(Boolean) : []
  );
  const [kwInput, setKwInput] = useState("");
  const [dirty, setDirty] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(p => ({ ...p, [k]: e.target.value }));
    setDirty(true);
  };

  const addKeyword = () => {
    const kw = kwInput.trim();
    if (kw && !keywords.includes(kw)) {
      const next = [...keywords, kw];
      setKeywords(next);
      setForm(p => ({ ...p, seo_keywords: next.join(", ") }));
      setDirty(true);
    }
    setKwInput("");
  };

  const removeKeyword = (kw: string) => {
    const next = keywords.filter(k => k !== kw);
    setKeywords(next);
    setForm(p => ({ ...p, seo_keywords: next.join(", ") }));
    setDirty(true);
  };

  const mutation = useMutation({
    mutationFn: () => hotelService.updateSeo(hotel.id, {
      slug: form.slug.trim().toLowerCase().replace(/\s+/g, "-") || undefined,
      seo_title: form.seo_title.trim() || undefined,
      seo_description: form.seo_description.trim() || undefined,
      seo_keywords: keywords.join(", ") || undefined,
      is_featured: form.is_featured,
      display_order: Number(form.display_order) || 0,
    }),
    onSuccess: () => {
      enqueueSnackbar("SEO settings saved", { variant: "success" });
      setDirty(false);
      qc.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.detail, hotel.id] });
      onRefresh();
    },
    onError: (e: any) => enqueueSnackbar(apiErrorMessage(e, "Save failed"), { variant: "error" }),
  });

  const slugUrl = `waytero.com/hotels/${form.slug || "[slug]"}`;
  const previewTitle = form.seo_title || hotel.hotel_name;
  const previewDesc = form.seo_description || hotel.short_description || hotel.description || "No description set.";

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Slug */}
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <SectionHeader icon={<Tag fontSize="small" />} title="URL Slug" />
            <TextField
              label="Slug"
              value={form.slug}
              onChange={set("slug")}
              size="small"
              fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start">waytero.com/hotels/</InputAdornment> }}
              helperText="Lowercase letters, numbers and hyphens only."
            />
            {hotel.status === "ACTIVE" && form.slug !== hotel.slug && (
              <Alert severity="warning" icon={<WarningAmber />} sx={{ mt: 1, borderRadius: 1.5 }}>
                Changing the slug on an active hotel will break existing links.
              </Alert>
            )}
            <Typography variant="caption" color="primary.main" sx={{ display: "block", mt: 1 }}>
              🔗 {slugUrl}
            </Typography>
          </CardContent>
        </Card>

        {/* SEO fields */}
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <SectionHeader icon={<Search fontSize="small" />} title="Search Engine Optimisation" />
            <Stack spacing={2}>
              <TextField
                label="SEO Title"
                value={form.seo_title}
                onChange={set("seo_title")}
                size="small"
                fullWidth
                inputProps={{ maxLength: 120 }}
                helperText={`${form.seo_title.length}/120`}
              />
              <TextField
                label="Meta Description"
                value={form.seo_description}
                onChange={set("seo_description")}
                size="small"
                fullWidth
                multiline
                rows={3}
                inputProps={{ maxLength: 320 }}
                helperText={`${form.seo_description.length}/320`}
              />

              {/* Keywords chip input */}
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>Keywords</Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 1 }}>
                  {keywords.map(kw => (
                    <Chip key={kw} label={kw} size="small" onDelete={() => removeKeyword(kw)} />
                  ))}
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField
                    value={kwInput}
                    onChange={(e) => setKwInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); }}}
                    placeholder="Add keyword, press Enter"
                    size="small"
                    sx={{ flex: 1 }}
                  />
                  <Button size="small" variant="outlined" onClick={addKeyword}>Add</Button>
                </Stack>
              </Box>

              <Divider />

              {/* Featured + order */}
              <Stack direction="row" spacing={3} alignItems="center">
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.is_featured}
                      onChange={(e) => { setForm(p => ({ ...p, is_featured: e.target.checked })); setDirty(true); }}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">Featured on homepage</Typography>}
                />
                <TextField
                  label="Display Order"
                  value={form.display_order}
                  onChange={set("display_order")}
                  size="small"
                  type="number"
                  sx={{ width: 120 }}
                />
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* SERP preview */}
        <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: alpha(theme.palette.grey[500], 0.04) }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Google SERP Preview</Typography>
            <Box sx={{ bgcolor: "background.paper", p: 2, borderRadius: 1.5, border: "1px solid", borderColor: "divider" }}>
              <Typography variant="caption" color="success.main" sx={{ display: "block" }}>
                {slugUrl}
              </Typography>
              <Typography
                variant="body1"
                color="primary.main"
                fontWeight={600}
                sx={{
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  maxWidth: 600,
                  fontSize: "1.1rem",
                }}
              >
                {previewTitle.length > 60 ? previewTitle.substring(0, 57) + "…" : previewTitle}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 600, mt: 0.25 }}>
                {previewDesc.length > 160 ? previewDesc.substring(0, 157) + "…" : previewDesc}
              </Typography>
              {(form.seo_title.length > 60 || form.seo_description.length > 160) && (
                <Alert severity="warning" sx={{ mt: 1, borderRadius: 1, py: 0 }}>
                  {form.seo_title.length > 60 && "Title will be truncated by search engines. "}
                  {form.seo_description.length > 160 && "Description will be truncated."}
                </Alert>
              )}
            </Box>
          </CardContent>
        </Card>

        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="contained"
            startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <Save />}
            onClick={() => mutation.mutate()}
            disabled={!dirty || mutation.isPending}
          >
            {mutation.isPending ? "Saving…" : "Save SEO"}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
