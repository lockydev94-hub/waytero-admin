// ============================================================
// WAYTERO ADMIN — WEBSITE CMS MAIN PAGE
// Doc Ref:
//   Migration 0044_website_cms
//
//  Four-tab shell:
//    • Sections   — registry of homepage section types (Hero,
//                   Services, Tours, …) with variant counts.
//                   Clicking a section opens the per-section
//                   management page (/cms/sections/:key).
//    • Header     — global header editor (logo, nav, socials).
//    • Footer     — global footer editor (links, socials, copy).
//    • Auth Modal — promotion images for the website login modal
//                   (left-side portrait slider next to the login form).
// ============================================================

import { useState } from "react";
import {
  Box, Tabs, Tab, Typography, Card, CardContent,
  Stack, Chip, IconButton, Tooltip, Button,
  CircularProgress, Switch, FormControlLabel, alpha, useTheme,
} from "@mui/material";
import {
  Web, ViewModule, AccountBalance, ArrowForward, Refresh,
  Edit, Visibility, VisibilityOff, AddCircleOutline, Login,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { cmsService, PageSection } from "../../services/cms.service";
import HeaderEditor from "./HeaderEditor";
import FooterEditor from "./FooterEditor";
import AuthModalEditor from "./AuthModalEditor";

const SECTION_ICON: Record<string, string> = {
  HERO: "Hero",
  SERVICES: "Services",
  WHY_US: "Why Us",
  TOUR_PACKAGES: "Tours",
  TESTIMONIALS: "Reviews",
  STATS: "Stats",
  PARTNERS: "Partners",
  CTA: "CTA",
};

// ──────────────────────────────────────────────────────────────
// Sections Tab
// ──────────────────────────────────────────────────────────────
function SectionsTab({ onOpenSection }: { onOpenSection: (key: string) => void }) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const { data: sections = [], isLoading, refetch } = useQuery({
    queryKey: ["cms-sections"],
    queryFn: cmsService.listSections,
  });

  const toggleVisibility = useMutation({
    mutationFn: ({ key, is_visible }: { key: string; is_visible: boolean }) =>
      cmsService.updateSection(key, { is_visible }),
    onSuccess: (_, vars) => {
      enqueueSnackbar(
        `Section ${vars.is_visible ? "shown on" : "hidden from"} homepage`,
        { variant: "success" }
      );
      qc.invalidateQueries({ queryKey: ["cms-sections"] });
    },
    onError: () => enqueueSnackbar("Failed to update visibility", { variant: "error" }),
  });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="body2" color="text.secondary">
          Every homepage section the platform knows about. Click a section to manage its
          design variants — exactly one variant is active on the homepage at a time.
        </Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={() => refetch()} size="small"><Refresh /></IconButton>
        </Tooltip>
      </Stack>

      <Stack spacing={1.5}>
        {sections.map((s) => (
          <SectionRow
            key={s.id}
            section={s}
            onOpen={() => onOpenSection(s.section_key)}
            onToggleVisible={(v) =>
              toggleVisibility.mutate({ key: s.section_key, is_visible: v })
            }
            toggling={toggleVisibility.isPending}
          />
        ))}
      </Stack>

      {sections.length === 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography color="text.secondary" align="center">
              No homepage sections registered. Run migration 0044_website_cms to seed them.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

function SectionRow({
  section,
  onOpen,
  onToggleVisible,
  toggling,
}: {
  section: PageSection;
  onOpen: () => void;
  onToggleVisible: (visible: boolean) => void;
  toggling: boolean;
}) {
  const theme = useTheme();
  const hasActive = section.active_variant_id != null;
  const accent = hasActive ? theme.palette.success.main : theme.palette.warning.main;

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        transition: "all 0.15s",
        "&:hover": { borderColor: "primary.main", boxShadow: 1 },
      }}
    >
      <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Box
          sx={{
            width: 48, height: 48, borderRadius: 1.5,
            display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: alpha(accent, 0.1),
            color: accent,
            fontWeight: 700,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {SECTION_ICON[section.section_key] ?? section.section_key.slice(0, 4)}
        </Box>

        <Box flex={1} minWidth={0}>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
            <Typography variant="subtitle1" fontWeight={600}>
              {section.display_name}
            </Typography>
            <Chip
              size="small"
              label={section.section_key}
              variant="outlined"
              sx={{ height: 20, fontSize: 11 }}
            />
            {hasActive ? (
              <Chip
                size="small"
                color="success"
                label="Active variant live"
                sx={{ height: 20, fontSize: 11 }}
              />
            ) : (
              <Chip
                size="small"
                color="warning"
                label="No active variant"
                sx={{ height: 20, fontSize: 11 }}
              />
            )}
          </Stack>
          {section.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {section.description}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
            {section.variant_count} variant{section.variant_count === 1 ? "" : "s"} ·
            Order #{section.display_order}
          </Typography>
        </Box>

        <Tooltip title={section.is_visible ? "Visible on homepage" : "Hidden from homepage"}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={section.is_visible}
                disabled={toggling}
                onChange={(e) => onToggleVisible(e.target.checked)}
              />
            }
            label={section.is_visible ? <Visibility fontSize="small" /> : <VisibilityOff fontSize="small" />}
            sx={{ mr: 0 }}
          />
        </Tooltip>

        <Button
          variant="outlined"
          size="small"
          endIcon={<ArrowForward />}
          onClick={onOpen}
          sx={{ ml: 1, whiteSpace: "nowrap" }}
        >
          Manage
        </Button>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────
// CmsPage — main shell
// ──────────────────────────────────────────────────────────────
export default function CmsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Web sx={{ color: "primary.main" }} /> Website CMS
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Manage every homepage section — Hero banners, Services, Tours, Testimonials — plus the
          global header & footer. Create multiple design variants per section; only the active
          variant is shown on the live homepage.
        </Typography>
      </Box>

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}
        >
          <Tab icon={<ViewModule />} iconPosition="start" label="Sections" />
          <Tab icon={<Web />} iconPosition="start" label="Header" />
          <Tab icon={<AccountBalance />} iconPosition="start" label="Footer" />
          <Tab icon={<Login />} iconPosition="start" label="Auth Modal" />
        </Tabs>
        <CardContent>
          {tab === 0 && (
            <SectionsTab
              onOpenSection={(key) => navigate(`/cms/sections/${key}`)}
            />
          )}
          {tab === 1 && <HeaderEditor />}
          {tab === 2 && <FooterEditor />}
          {tab === 3 && <AuthModalEditor />}
        </CardContent>
      </Card>
    </Box>
  );
}
