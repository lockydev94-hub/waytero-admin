// ============================================================
// WAYTERO ADMIN — HOTELS PAGE
// Doc Ref: BRD Part 4 §57-92 | SRS Part 5 §153-194
//          Docs/21_Hotel_Module_Implementation/03_FRONTEND_DESIGN.md §3
//
// Route: /hotels  (already wired in AppRoutes.tsx + NAV_ITEMS)
// Roles: SUPER_ADMIN, ADMIN, VERIFICATION_OFFICER
//
// Build order: C3 — replaces the 37-line placeholder.
// ============================================================

import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  Box, Typography, Card, CardContent, Button, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TextField, MenuItem, Select, FormControl, InputLabel,
  Stack, Tooltip, LinearProgress, Alert, Avatar, Grid,
  Skeleton, Chip, InputAdornment, alpha, useTheme,
  ToggleButton, Menu,
} from "@mui/material";
import {
  Hotel, Add, Refresh, Search, Visibility, MoreVert,
  CheckCircle, HourglassTop, FactCheck, Block, Star,
  WarningAmber, Tune, OpenInNew,
} from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { useNavigate } from "react-router-dom";

import {
  hotelService,
  HotelListItem,
  HotelStats,
  HOTEL_STATUS_META,
  HOTEL_STATUSES,
} from "../../services/hotel.service";
import { HOTEL_QUERY_KEYS } from "./constants";
import { currentUserType } from "../../utils/currentUser";
import KpiCard from "./components/KpiCard";
import HotelStatusChip from "./components/HotelStatusChip";
import CompletenessMeter from "./components/CompletenessMeter";

// ── Lazy modal imports ──────────────────────────────────────
const AddHotelWizard = React.lazy(() => import("./modals/AddHotelWizard"));
const HotelDetailDialog = React.lazy(() => import("./modals/HotelDetailDialog"));

// ── Helpers ─────────────────────────────────────────────────
const COLS = 9; // total table columns for colSpan

function StarRating({ value }: { value: number | null }) {
  if (!value) return <Typography variant="caption" color="text.disabled">Unrated</Typography>;
  return (
    <Stack direction="row" spacing={0.25} alignItems="center">
      {[...Array(Math.round(value))].map((_, i) => (
        <Star key={i} sx={{ fontSize: 12, color: "warning.main" }} />
      ))}
      <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
        {value}★
      </Typography>
    </Stack>
  );
}

// ── Row action menu ──────────────────────────────────────────
function RowMenu({
  hotel,
  onOpen,
}: {
  hotel: HotelListItem;
  onOpen: (id: number) => void;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const handleAction = async (action: string) => {
    setAnchor(null);
    try {
      if (action === "activate") {
        await hotelService.activate(hotel.id);
        enqueueSnackbar("Hotel activated", { variant: "success" });
      } else if (action === "suspend") {
        await hotelService.suspend(hotel.id);
        enqueueSnackbar("Hotel suspended", { variant: "warning" });
      } else if (action === "feature") {
        await hotelService.updateSeo(hotel.id, { is_featured: !hotel.is_featured });
        enqueueSnackbar(hotel.is_featured ? "Removed from featured" : "Added to featured", { variant: "success" });
      }
      queryClient.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.list] });
      queryClient.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.stats] });
    } catch {
      enqueueSnackbar("Action failed", { variant: "error" });
    }
  };

  const canActivate = hotel.status === "APPROVED";
  const canSuspend = ["ACTIVE", "APPROVED"].includes(hotel.status);
  const items = [
    { key: "view", label: "View details", always: true },
    { key: "activate", label: "Activate", when: canActivate },
    { key: "suspend", label: "Suspend", when: canSuspend },
    { key: "feature", label: hotel.is_featured ? "Remove from featured" : "Feature hotel", always: true },
  ].filter((i) => i.always || i.when);

  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget); }}
        aria-label="More actions"
      >
        <MoreVert fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={(e: any) => { e.stopPropagation?.(); setAnchor(null); }}
        onClick={(e) => e.stopPropagation()}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 180 } }}
      >
        {items.map((item) => (
          <MenuItem
            key={item.key}
            dense
            onClick={() => {
              if (item.key === "view") { onOpen(hotel.id); setAnchor(null); }
              else handleAction(item.key);
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────
export default function HotelsPage() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // ── Filters ───────────────────────────────────────────────
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [statusFilter, setStatusFilter] = useState("");
  const [cityFilter, setCityFilter] = useState<number | "">("");
  const [categoryFilter, setCategoryFilter] = useState<number | "">("");
  const [partnerFilter, setPartnerFilter] = useState<number | "">("");
  const [myQueue, setMyQueue] = useState(false);

  // ── Dialog state ──────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [initialTab, setInitialTab] = useState<number>(0);

  // ── User role (from Zustand-persisted auth store) ──
  const userType = useMemo(() => currentUserType(), []);
  const isOfficer = userType === "VERIFICATION_OFFICER";

  // ── Data queries ──────────────────────────────────────────
  const queryKey = [
    HOTEL_QUERY_KEYS.list, search, statusFilter, cityFilter,
    categoryFilter, partnerFilter, myQueue, page, rowsPerPage,
  ];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      hotelService.list({
        search: search || undefined,
        status: statusFilter || undefined,
        city_id: cityFilter || undefined,
        hotel_category_id: categoryFilter || undefined,
        partner_id: partnerFilter || undefined,
        page: page + 1,
        page_size: rowsPerPage,
      }),
    staleTime: 30_000,
  });

  const { data: stats } = useQuery<HotelStats>({
    queryKey: [HOTEL_QUERY_KEYS.stats],
    queryFn: () => hotelService.getStats(),
    staleTime: 60_000,
  });

  const { data: meta } = useQuery({
    queryKey: [HOTEL_QUERY_KEYS.meta],
    queryFn: () => hotelService.getMeta(),
    staleTime: 5 * 60_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: [HOTEL_QUERY_KEYS.categories],
    queryFn: () => hotelService.listCategories(),
    staleTime: 5 * 60_000,
  });

  const hotels: HotelListItem[] = data?.items ?? [];
  const total = data?.total ?? 0;

  // ── Debounced search ──────────────────────────────────────
  const handleSearchInput = useCallback((val: string) => {
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(val);
      setPage(0);
    }, 400);
  }, []);

  const resetFilters = () => {
    setSearch(""); setSearchInput(""); setStatusFilter("");
    setCityFilter(""); setCategoryFilter(""); setPartnerFilter("");
    setMyQueue(false); setPage(0);
  };
  const hasFilters = !!(search || statusFilter || cityFilter || categoryFilter || partnerFilter || myQueue);

  // ── Open detail ───────────────────────────────────────────
  const openDetail = useCallback((id: number, tab = 0) => {
    setSelectedId(id);
    setInitialTab(tab);
  }, []);

  // ── KPI tiles ─────────────────────────────────────────────
  const kpis = [
    { label: "Total", value: stats?.total ?? 0, color: "primary" as const, icon: <Hotel /> },
    { label: "Draft", value: stats?.draft ?? 0, color: "secondary" as const, icon: <Hotel /> },
    { label: "Pending", value: stats?.pending ?? 0, color: "warning" as const, icon: <HourglassTop /> },
    { label: "Under Review", value: stats?.under_review ?? 0, color: "info" as const, icon: <FactCheck /> },
    { label: "Active", value: stats?.active ?? 0, color: "success" as const, icon: <CheckCircle /> },
    { label: "Suspended", value: stats?.suspended ?? 0, color: "error" as const, icon: <Block /> },
    { label: "Own-risk", value: stats?.own_risk_approved ?? 0, color: "warning" as const, icon: <WarningAmber /> },
  ];

  return (
    <Box>
      {/* ── Header ──────────────────────────────────────────── */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{ bgcolor: "primary.main", width: 40, height: 40 }}>
            <Hotel />
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight={800}>Hotels</Typography>
            <Typography variant="body2" color="text.secondary">
              Onboard, verify and manage hotel properties
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Tooltip title="Refresh">
            <IconButton onClick={() => { refetch(); queryClient.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.stats] }); }}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Tooltip title="Hotel categories and amenities">
            <Button
              variant="outlined"
              size="small"
              startIcon={<Tune />}
              onClick={() => navigate("/settings?tab=7&sub=3")}
              sx={{ borderRadius: 2, fontWeight: 600 }}
            >
              Masters
            </Button>
          </Tooltip>
          {!isOfficer && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setAddOpen(true)}
              sx={{ borderRadius: 2, fontWeight: 700 }}
            >
              Add Hotel
            </Button>
          )}
        </Stack>
      </Box>

      {/* ── KPI Row ─────────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {kpis.map((k) => (
          <Grid item xs={6} sm={4} md={12 / 7} key={k.label}>
            <KpiCard
              label={k.label}
              value={k.value}
              color={k.color}
              icon={k.icon}
              onClick={k.label !== "Total" && k.label !== "Own-risk"
                ? () => {
                    const s = HOTEL_STATUSES.find((st) =>
                      HOTEL_STATUS_META[st]?.label === k.label
                    );
                    if (s) { setStatusFilter(s); setPage(0); }
                  }
                : undefined}
              selected={statusFilter === HOTEL_STATUSES.find((st) => HOTEL_STATUS_META[st]?.label === k.label)}
            />
          </Grid>
        ))}
      </Grid>

      {/* ── Filters ─────────────────────────────────────────── */}
      <Card variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
            <TextField
              size="small"
              placeholder="Search hotel name, code, partner…"
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ flex: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              >
                <MenuItem value="">All Statuses</MenuItem>
                {HOTEL_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>{HOTEL_STATUS_META[s]?.label ?? s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Category</InputLabel>
              <Select
                label="Category"
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value as number | ""); setPage(0); }}
              >
                <MenuItem value="">All Categories</MenuItem>
                {categories.map((c: any) => (
                  <MenuItem key={c.id} value={c.id}>{c.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {isOfficer && (
              <ToggleButton
                value="myQueue"
                selected={myQueue}
                size="small"
                onChange={() => { setMyQueue((p) => !p); setPage(0); }}
                sx={{ borderRadius: 2, fontWeight: 600, fontSize: 13, px: 2 }}
              >
                My queue
              </ToggleButton>
            )}
            {hasFilters && (
              <Button size="small" onClick={resetFilters} sx={{ whiteSpace: "nowrap" }}>
                Clear filters
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* ── Error ───────────────────────────────────────────── */}
      {isError && (
        <Alert severity="error" sx={{ mb: 2 }} action={
          <Button size="small" color="inherit" onClick={() => refetch()}>Retry</Button>
        }>
          Failed to load hotels. Please try again.
        </Alert>
      )}

      {/* ── Table ───────────────────────────────────────────── */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        {isLoading && <LinearProgress />}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Hotel</TableCell>
                <TableCell sx={{ fontWeight: 700, display: { xs: "none", md: "table-cell" } }}>Partner</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                <TableCell sx={{ fontWeight: 700, display: { xs: "none", sm: "table-cell" } }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Rooms</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Readiness</TableCell>
                <TableCell sx={{ fontWeight: 700, display: { xs: "none", md: "table-cell" } }}>Docs</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(COLS)].map((_, j) => (
                      <TableCell key={j}><Skeleton animation="wave" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : hotels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLS} align="center" sx={{ py: 6 }}>
                    <Stack alignItems="center" spacing={1.5}>
                      <Hotel sx={{ fontSize: 48, color: "text.disabled" }} />
                      <Typography variant="body2" color="text.disabled">
                        {hasFilters
                          ? "No hotels match your filters"
                          : "No hotels onboarded yet"}
                      </Typography>
                      {!hasFilters && !isOfficer && (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Add />}
                          onClick={() => setAddOpen(true)}
                        >
                          Add your first hotel
                        </Button>
                      )}
                      {hasFilters && (
                        <Button size="small" onClick={resetFilters}>
                          Clear filters
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : (
                hotels.map((h) => (
                  <TableRow
                    key={h.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => openDetail(h.id)}
                  >
                    {/* Hotel cell */}
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar
                          src={h.primary_image_url ?? undefined}
                          sx={{
                            width: 44, height: 44, borderRadius: 1.5,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: "primary.main",
                          }}
                        >
                          <Hotel />
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              noWrap
                              sx={{ maxWidth: { xs: 120, sm: 200 } }}
                            >
                              {h.hotel_name}
                            </Typography>
                            {h.is_featured && (
                              <Chip
                                label="Featured"
                                size="small"
                                color="secondary"
                                sx={{ fontSize: 10, height: 16, fontWeight: 700 }}
                              />
                            )}
                            {h.is_own_risk_approved && (
                              <Tooltip title="Own-risk approved">
                                <WarningAmber sx={{ fontSize: 14, color: "warning.main" }} />
                              </Tooltip>
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.disabled" sx={{ fontFamily: "monospace" }}>
                            {h.hotel_code}
                          </Typography>
                          {/* Fold partner+category on mobile */}
                          <Box sx={{ display: { xs: "block", md: "none" } }}>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {h.partner_name}
                              {h.category_label ? ` · ${h.category_label}` : ""}
                            </Typography>
                          </Box>
                        </Box>
                      </Stack>
                    </TableCell>

                    {/* Partner */}
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 140 }}>
                        {h.partner_name ?? "—"}
                      </Typography>
                    </TableCell>

                    {/* Location */}
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 120 }}>
                        {h.city_name ?? "—"}
                      </Typography>
                      <StarRating value={h.star_rating} />
                    </TableCell>

                    {/* Category */}
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                      {h.category_label ? (
                        <Chip
                          label={h.category_label}
                          size="small"
                          variant="outlined"
                          sx={{ borderRadius: 1 }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.disabled">—</Typography>
                      )}
                    </TableCell>

                    {/* Rooms */}
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {h.total_rooms}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {h.room_category_count} {h.room_category_count === 1 ? "category" : "categories"}
                      </Typography>
                    </TableCell>

                    {/* Readiness */}
                    <TableCell>
                      <CompletenessMeter
                        percent={h.completeness_percent}
                        variant="compact"
                      />
                    </TableCell>

                    {/* Docs — hidden on mobile */}
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        color={h.completeness_percent >= 100 ? "success.main" : "text.secondary"}
                      >
                        Docs
                      </Typography>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <HotelStatusChip status={h.status} />
                    </TableCell>

                    {/* Actions */}
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="View details">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); openDetail(h.id); }}
                            aria-label={`View ${h.hotel_name}`}
                          >
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <RowMenu hotel={h} onOpen={openDetail} />
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50]}
        />
      </Card>

      {/* ── Modals ──────────────────────────────────────────── */}
      <React.Suspense fallback={null}>
        {addOpen && (
          <AddHotelWizard
            open={addOpen}
            onClose={() => setAddOpen(false)}
            onCreated={(id: number) => {
              setAddOpen(false);
              queryClient.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.list] });
              queryClient.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.stats] });
              openDetail(id, 3); // open on Rooms tab
            }}
          />
        )}
        {selectedId !== null && (
          <HotelDetailDialog
            open={selectedId !== null}
            hotelId={selectedId}
            initialTab={initialTab}
            onClose={() => setSelectedId(null)}
          />
        )}
      </React.Suspense>
    </Box>
  );
}
