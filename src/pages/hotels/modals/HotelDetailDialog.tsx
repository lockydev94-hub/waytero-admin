// ============================================================
// WAYTERO ADMIN — HOTEL DETAIL DIALOG (C5)
// Doc Ref: BRD Part 4 §57-92 | Docs/21_Hotel_Module_Implementation/03_FRONTEND_DESIGN.md §5
//
// Tabbed shell for Stages 2-6 of hotel management.
// fullWidth lg dialog, 92vh, tabs scroll independently.
// ============================================================

import React, { useState, useMemo, Suspense, lazy } from "react";
import {
  Dialog, Box, Typography, IconButton, Avatar,
  Tab, Tabs, CircularProgress, alpha, useTheme,
  Chip, Button, Tooltip, Menu, MenuItem, Divider, Stack,
} from "@mui/material";
import {
  Close, Hotel, MoreVert, Send, PersonSearch, FactCheck,
  CheckCircle, PowerSettingsNew, PauseCircle, Refresh,
  WarningAmber,
} from "@mui/icons-material";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  hotelService,
  HotelDetail,
  HOTEL_STATUS_META,
} from "../../../services/hotel.service";
import HotelStatusChip from "../components/HotelStatusChip";
import CompletenessMeter from "../components/CompletenessMeter";
import { HOTEL_QUERY_KEYS } from "../constants";
import { apiErrorMessage } from "../../../utils/apiError";
import { currentUserType } from "../../../utils/currentUser";

// ── Lazy tab imports ──────────────────────────────────────────
const OverviewTab      = lazy(() => import("./tabs/OverviewTab"));
const ProfileTab       = lazy(() => import("./tabs/ProfileTab"));
const MediaTab         = lazy(() => import("./tabs/MediaTab"));
const RoomsTab         = lazy(() => import("./tabs/RoomsTab"));
const PricingTab       = lazy(() => import("./tabs/PricingTab"));
const PoliciesTab      = lazy(() => import("./tabs/PoliciesTab"));
const CommercialsTab   = lazy(() => import("./tabs/CommercialsTab"));
const DocumentsTab     = lazy(() => import("./tabs/DocumentsTab"));
const SeoTab           = lazy(() => import("./tabs/SeoTab"));
const VerificationTab  = lazy(() => import("./tabs/VerificationTab"));
const ActivityTab      = lazy(() => import("./tabs/ActivityTab"));

// ── Tab config ────────────────────────────────────────────────
const ALL_TABS = [
  { label: "Overview",      value: 0  },
  { label: "Profile",       value: 1  },
  { label: "Media",         value: 2  },
  { label: "Rooms",         value: 3  },
  { label: "Pricing",       value: 4  },
  { label: "Policies",      value: 5  },
  { label: "Commercials",   value: 6  },
  { label: "Documents",     value: 7  },
  { label: "SEO",           value: 8  },
  { label: "Verification",  value: 9  },
  { label: "Activity",      value: 10 },
];

// Officer-restricted tabs (hidden for VERIFICATION_OFFICER)
const OFFICER_HIDDEN = [6, 8]; // Commercials, SEO

// ── Types ─────────────────────────────────────────────────────
interface Props {
  open: boolean;
  hotelId: number | null;
  initialTab?: number;
  onClose: () => void;
}

// ── Primary action by status ───────────────────────────────────
function PrimaryAction({
  hotel,
  isOfficer,
  onRefresh,
  onNavigateTab,
}: {
  hotel: HotelDetail;
  isOfficer: boolean;
  onRefresh: () => void;
  onNavigateTab: (tab: number) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.detail, hotel.id] });
    qc.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.list] });
    qc.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.stats] });
    onRefresh();
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await hotelService.submit(hotel.id);
      enqueueSnackbar("Hotel submitted for verification", { variant: "success" });
      invalidate();
    } catch (e: any) {
      enqueueSnackbar(apiErrorMessage(e, "Submit failed"), { variant: "error" });
    } finally { setLoading(false); }
  };

  const handleActivate = async () => {
    setLoading(true);
    try {
      await hotelService.activate(hotel.id);
      enqueueSnackbar("Hotel activated", { variant: "success" });
      invalidate();
    } catch (e: any) {
      enqueueSnackbar(apiErrorMessage(e, "Activation failed"), { variant: "error" });
    } finally { setLoading(false); }
  };

  if (hotel.status === "DRAFT" && !isOfficer) {
    const ready = hotel.readiness?.can_submit;
    return (
      <Tooltip title={ready ? "Submit for verification" : (hotel.readiness?.checks.find(c => !c.passed && c.blocks_submit)?.hint ?? "Complete required fields first")}>
        <span>
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <Send />}
            onClick={handleSubmit}
            disabled={!ready || loading}
            sx={{ bgcolor: "white", color: "primary.main", "&:hover": { bgcolor: "grey.100" }, fontWeight: 700 }}
          >
            Submit for Verification
          </Button>
        </span>
      </Tooltip>
    );
  }

  if (hotel.status === "APPROVED" && !isOfficer) {
    return (
      <Button
        variant="contained"
        color="success"
        size="small"
        startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <PowerSettingsNew />}
        onClick={handleActivate}
        disabled={loading}
        sx={{ bgcolor: "success.light", color: "success.contrastText", fontWeight: 700 }}
      >
        Activate Hotel
      </Button>
    );
  }

  if (hotel.status === "PENDING" && !isOfficer) {
    return (
      <Button
        variant="outlined"
        size="small"
        startIcon={<PersonSearch />}
        sx={{ color: "white", borderColor: "rgba(255,255,255,0.5)", "&:hover": { borderColor: "white" } }}
        onClick={() => onNavigateTab(9)}
      >
        Assign Officer
      </Button>
    );
  }

  if ((hotel.status === "UNDER_REVIEW" || hotel.status === "DOCUMENT_PENDING") && !isOfficer) {
    return (
      <Button
        variant="outlined"
        size="small"
        startIcon={<FactCheck />}
        sx={{ color: "white", borderColor: "rgba(255,255,255,0.5)", "&:hover": { borderColor: "white" } }}
        onClick={() => onNavigateTab(9)}
      >
        Review Documents
      </Button>
    );
  }

  return null;
}

// ── Overflow menu ─────────────────────────────────────────────
function OverflowMenu({ hotel, onRefresh }: { hotel: HotelDetail; onRefresh: () => void }) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.detail, hotel.id] });
    qc.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.list] });
    qc.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.stats] });
    onRefresh();
  };

  const handleSuspend = async () => {
    setAnchor(null);
    try {
      await hotelService.suspend(hotel.id);
      enqueueSnackbar("Hotel suspended", { variant: "warning" });
      invalidate();
    } catch (e: any) {
      enqueueSnackbar(apiErrorMessage(e, "Suspend failed"), { variant: "error" });
    }
  };

  const handleFeature = async () => {
    setAnchor(null);
    try {
      await hotelService.updateSeo(hotel.id, { is_featured: !hotel.is_featured });
      enqueueSnackbar(hotel.is_featured ? "Removed from featured" : "Marked as featured", { variant: "success" });
      invalidate();
    } catch (e: any) {
      enqueueSnackbar("Action failed", { variant: "error" });
    }
  };

  return (
    <>
      <Tooltip title="More actions">
        <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)} sx={{ color: "white" }}>
          <MoreVert />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {["ACTIVE", "APPROVED"].includes(hotel.status) && (
          <MenuItem onClick={handleSuspend}>
            <PauseCircle fontSize="small" sx={{ mr: 1, color: "warning.main" }} />
            Suspend Hotel
          </MenuItem>
        )}
        <MenuItem onClick={handleFeature}>
          {hotel.is_featured ? "Remove from Featured" : "Mark as Featured"}
        </MenuItem>
      </Menu>
    </>
  );
}

// ── Skeleton header ────────────────────────────────────────────
function HeaderSkeleton({ theme }: { theme: any }) {
  return (
    <Box sx={{
      px: 3, py: 2.5,
      background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
      minHeight: 120,
      display: "flex", alignItems: "center",
    }}>
      <CircularProgress size={24} sx={{ color: "rgba(255,255,255,0.7)" }} />
    </Box>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function HotelDetailDialog({ open, hotelId, initialTab = 0, onClose }: Props) {
  const theme = useTheme();
  const [tab, setTab] = useState(initialTab);

  // Sync initialTab when it changes (e.g. wizard opens on Rooms)
  React.useEffect(() => { setTab(initialTab); }, [initialTab, hotelId]);

  const userType = useMemo(() => currentUserType(), []);
  const isOfficer = userType === "VERIFICATION_OFFICER";

  // ── Fetch hotel full ───────────────────────────────────────
  const { data: hotel, isLoading, refetch } = useQuery<HotelDetail>({
    queryKey: [HOTEL_QUERY_KEYS.detail, hotelId],
    queryFn: () => hotelService.getFull(hotelId!),
    enabled: open && !!hotelId,
    staleTime: 30_000,
  });

  const visibleTabs = isOfficer
    ? ALL_TABS.filter((t) => !OFFICER_HIDDEN.includes(t.value))
    : ALL_TABS;

  // Current tab index within visibleTabs (for Tab value alignment)
  const tabValue = visibleTabs.find((t) => t.value === tab)?.value ?? visibleTabs[0]?.value ?? 0;

  const handleClose = () => {
    setTab(0);
    onClose();
  };

  // Primary image for header avatar
  const primaryImage = hotel?.images?.find((i) => i.is_primary)?.image_url
    ?? hotel?.images?.[0]?.image_url
    ?? null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{
        sx: {
          borderRadius: 3,
          height: "92vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {/* ── Gradient Header ──────────────────────────────────── */}
      {isLoading || !hotel ? (
        <HeaderSkeleton theme={theme} />
      ) : (
        <Box
          sx={{
            px: 3, py: 2,
            background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 60%, ${alpha(theme.palette.primary.light, 0.85)} 100%)`,
            color: "white",
            flexShrink: 0,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Background decoration */}
          <Box sx={{ position: "absolute", top: -30, right: -30, width: 160, height: 160, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.05)" }} />
          <Box sx={{ position: "absolute", bottom: -60, left: "50%", width: 220, height: 220, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.03)" }} />

          <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ position: "relative" }}>
            {/* Hotel avatar */}
            <Avatar
              src={primaryImage ?? undefined}
              sx={{ width: 56, height: 56, bgcolor: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.3)" }}
            >
              <Hotel />
            </Avatar>

            {/* Hotel info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="h6" fontWeight={800} noWrap sx={{ maxWidth: 400 }}>
                  {hotel.hotel_name}
                </Typography>
                <HotelStatusChip status={hotel.status} size="small" />
                {hotel.is_own_risk_approved && (
                  <Chip
                    label="Own-Risk"
                    size="small"
                    icon={<WarningAmber sx={{ fontSize: "0.75rem !important" }} />}
                    sx={{ bgcolor: "warning.dark", color: "white", height: 20, fontSize: "0.65rem" }}
                  />
                )}
              </Stack>
              <Typography variant="caption" sx={{ opacity: 0.75, display: "block", mt: 0.25 }}>
                {hotel.hotel_code}
                {hotel.city_name ? ` · ${hotel.city_name}` : ""}
                {hotel.category_label ? ` · ${hotel.category_label}` : ""}
                {hotel.star_rating ? ` · ${hotel.star_rating}★` : ""}
              </Typography>
              <Box sx={{ mt: 0.75 }}>
                <CompletenessMeter
                  percent={hotel.readiness?.completeness_percent ?? 0}
                                  />
              </Box>
            </Box>

            {/* Action cluster */}
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
              <PrimaryAction hotel={hotel} isOfficer={isOfficer} onRefresh={refetch} onNavigateTab={setTab} />
              <OverflowMenu hotel={hotel} onRefresh={refetch} />
              <Tooltip title="Refresh">
                <IconButton size="small" onClick={() => refetch()} sx={{ color: "white" }}>
                  <Refresh fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Close">
                <IconButton size="small" onClick={handleClose} sx={{ color: "white" }}>
                  <Close />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Box>
      )}

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", flexShrink: 0, bgcolor: "background.paper" }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            "& .MuiTab-root": { minHeight: 44, fontSize: "0.8rem", fontWeight: 600, textTransform: "none" },
            "& .Mui-selected": { color: "primary.main" },
          }}
        >
          {visibleTabs.map((t) => (
            <Tab key={t.value} label={t.label} value={t.value} />
          ))}
        </Tabs>
      </Box>

      {/* ── Tab content ──────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: "auto", bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
        {!hotel || isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
            <CircularProgress />
          </Box>
        ) : (
          <Suspense fallback={
            <Box sx={{ display: "flex", justifyContent: "center", pt: 6 }}>
              <CircularProgress />
            </Box>
          }>
            {tab === 0  && <OverviewTab     hotel={hotel} isOfficer={isOfficer} onRefresh={refetch} />}
            {tab === 1  && <ProfileTab      hotel={hotel} isOfficer={isOfficer} onRefresh={refetch} />}
            {tab === 2  && <MediaTab        hotel={hotel} isOfficer={isOfficer} onRefresh={refetch} />}
            {tab === 3  && <RoomsTab        hotel={hotel} isOfficer={isOfficer} onRefresh={refetch} />}
            {tab === 4  && <PricingTab      hotel={hotel} hotelId={hotel.id} onRefresh={refetch} />}
            {tab === 5  && <PoliciesTab     hotel={hotel} hotelId={hotel.id} onRefresh={refetch} />}
            {tab === 6  && !isOfficer && <CommercialsTab  hotel={hotel} hotelId={hotel.id} onRefresh={refetch} />}
            {tab === 7  && <DocumentsTab    hotel={hotel} isOfficer={isOfficer} onRefresh={refetch} />}
            {tab === 8  && !isOfficer && <SeoTab          hotel={hotel} onRefresh={refetch} />}
            {tab === 9  && <VerificationTab hotel={hotel} hotelId={hotel.id} onRefresh={refetch} />}
            {tab === 10 && <ActivityTab     hotel={hotel} />}          </Suspense>
        )}
      </Box>
    </Dialog>
  );
}
