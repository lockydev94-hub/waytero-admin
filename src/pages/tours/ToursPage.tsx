// WAYTERO ADMIN — TOUR PACKAGES PAGE
// Real-world console: KPIs, search, status filters, package catalog table,
// bookings table, reject-with-reason modal, and a multi-step visual package
// editor (see components/tours/PackageEditor.tsx).
// Doc Ref: BRD_PART_5_TOUR_PACKAGE_MANAGEMENT §2-§4
// ============================================================
import { useEffect, useMemo, useState } from "react";
import {
  Box, Typography, Stack, Card, CardContent, Chip, Button, TextField, InputAdornment,
  IconButton, Tooltip, Avatar, Dialog, DialogTitle, DialogContent, DialogActions,
  Menu, MenuItem, Alert, Divider, Tabs, Tab, CircularProgress, alpha, useTheme,
  Table, TableBody, TableCell, TableHead, TableRow, Paper, Grid,
} from "@mui/material";
import {
  Add, Search, Refresh, Edit, Visibility, CheckCircle, Block, PauseCircle, Cancel,
  TravelExplore, ReceiptLong, PendingActions, Drafts, LocationOn, CalendarMonth,
  People, MoreVert, Star, OpenInNew, Hotel, Image as ImageIcon, HourglassEmpty,
  TaskAlt, CancelOutlined, WarningAmber, AttachMoney,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { tourService, TourPackage, TourBooking, TourStats } from "../../services/tour.service";
import PackageEditor from "../../components/tours/PackageEditor";

// ── Status config ─────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  DRAFT:            { label: "Draft",            color: "#6B7280", bg: "#F3F4F6", icon: <Drafts sx={{ fontSize: 14 }} /> },
  PENDING_APPROVAL: { label: "Pending Review",   color: "#F59E0B", bg: "#FEF3C7", icon: <PendingActions sx={{ fontSize: 14 }} /> },
  APPROVED:         { label: "Approved",         color: "#6366F1", bg: "#E0E7FF", icon: <TaskAlt sx={{ fontSize: 14 }} /> },
  ACTIVE:           { label: "Active",           color: "#10B981", bg: "#D1FAE5", icon: <CheckCircle sx={{ fontSize: 14 }} /> },
  INACTIVE:         { label: "Inactive",         color: "#6B7280", bg: "#F3F4F6", icon: <PauseCircle sx={{ fontSize: 14 }} /> },
  SUSPENDED:        { label: "Suspended",        color: "#F59E0B", bg: "#FEF3C7", icon: <Block sx={{ fontSize: 14 }} /> },
  REJECTED:         { label: "Rejected",         color: "#EF4444", bg: "#FEE2E2", icon: <CancelOutlined sx={{ fontSize: 14 }} /> },
};

const BOOKING_STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  PENDING_CONFIRMATION: { color: "#F59E0B", bg: "#FEF3C7", label: "Pending Confirmation" },
  CONFIRMED:            { color: "#3B82F6", bg: "#DBEAFE", label: "Confirmed" },
  IN_PROGRESS:          { color: "#06B6D4", bg: "#CFFAFE", label: "In Progress" },
  COMPLETED:            { color: "#10B981", bg: "#D1FAE5", label: "Completed" },
  SETTLEMENT_PENDING:   { color: "#8B5CF6", bg: "#EDE9FE", label: "Settlement Pending" },
  SETTLED:              { color: "#16A34A", bg: "#BBF7D0", label: "Settled" },
  CANCELLED:            { color: "#EF4444", bg: "#FEE2E2", label: "Cancelled" },
};

const STATUS_FILTERS = [
  { value: "ALL",             label: "All" },
  { value: "ACTIVE",          label: "Active" },
  { value: "PENDING_APPROVAL",label: "Pending" },
  { value: "APPROVED",        label: "Approved" },
  { value: "DRAFT",           label: "Draft" },
  { value: "REJECTED",        label: "Rejected" },
  { value: "SUSPENDED",       label: "Suspended" },
];

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, value, color, icon, subtitle }: { label: string; value: string | number; color: string; icon: any; subtitle?: string }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider", height: "100%" }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Typography>
            <Typography variant="h3" fontWeight={900} sx={{ mt: 0.5, color: "text.primary" }}>{value}</Typography>
            {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
          </Box>
          <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: alpha(color, 0.12), display: "grid", placeItems: "center", "& svg": { color, fontSize: 22 } }}>{icon}</Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ── Status chip ───────────────────────────────────────────────
function StatusChip({ status, type = "package" }: { status: string; type?: "package" | "booking" }) {
  const meta = type === "booking" ? BOOKING_STATUS_META[status] : STATUS_META[status];
  if (!meta) return <Chip size="small" label={status} />;
  return (
    <Chip
      icon={(meta as any).icon}
      label={(meta as any).label || (meta as any).label}
      size="small"
      sx={{ fontWeight: 700, bgcolor: meta.bg, color: meta.color, border: `1px solid ${alpha(meta.color, 0.2)}`, "& .MuiChip-icon": { color: meta.color } }}
    />
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function ToursPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [cityFilter, setCityFilter] = useState("ALL");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("ALL");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<TourPackage | null>(null);

  const [rejectTarget, setRejectTarget] = useState<TourPackage | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [actionMenu, setActionMenu] = useState<{ anchor: HTMLElement; pkg: TourPackage } | null>(null);

  // ── Data fetching ───────────────────────────────────────────
  const statsQuery = useQuery<TourStats>({
    queryKey: ["admin-tour-stats"],
    queryFn: () => tourService.getStats(),
    refetchInterval: 60_000,
  });

  const partnersQuery = useQuery({
    queryKey: ["admin-tour-partners"],
    queryFn: () => tourService.getPartners(),
    staleTime: 5 * 60_000,
  });

  const citiesQuery = useQuery({
    queryKey: ["admin-tour-cities"],
    queryFn: () => tourService.getCities(),
    staleTime: 5 * 60_000,
  });

  const packagesQuery = useQuery<TourPackage[]>({
    queryKey: ["admin-tour-packages", statusFilter, cityFilter, search],
    queryFn: () => tourService.listPackages({
      ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      ...(cityFilter !== "ALL" ? { city_id: cityFilter } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    }),
  });

  const bookingsQuery = useQuery<TourBooking[]>({
    queryKey: ["admin-tour-bookings", bookingStatusFilter, search],
    queryFn: () => tourService.listBookings({
      ...(bookingStatusFilter !== "ALL" ? { status: bookingStatusFilter } : {}),
    }),
    enabled: tab === 1,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: number; status: string; reason?: string }) => tourService.setPackageStatus(id, status, reason),
    onSuccess: (_, vars) => {
      enqueueSnackbar(`Package ${vars.status.toLowerCase().replace("_", " ")}`, { variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin-tour-packages"] });
      qc.invalidateQueries({ queryKey: ["admin-tour-stats"] });
      setActionMenu(null);
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || "Status update failed", { variant: "error" }),
  });

  const rejectMutation = useMutation({
    mutationFn: () => tourService.setPackageStatus(rejectTarget!.id, "REJECTED", rejectReason),
    onSuccess: () => {
      enqueueSnackbar("Package rejected", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin-tour-packages"] });
      qc.invalidateQueries({ queryKey: ["admin-tour-stats"] });
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || "Reject failed", { variant: "error" }),
  });

  const packages = packagesQuery.data ?? [];
  const bookings = bookingsQuery.data ?? [];
  const partners = partnersQuery.data ?? [];
  const cities = citiesQuery.data ?? [];

  const filteredPackages = useMemo(() => {
    let items = packages;
    if (search.trim()) {
      const s = search.toLowerCase();
      items = items.filter(p => p.package_name.toLowerCase().includes(s) || p.destination.toLowerCase().includes(s) || p.package_code.toLowerCase().includes(s) || (p.partner_name || "").toLowerCase().includes(s));
    }
    return items;
  }, [packages, search]);

  return (
    <Box>
      {/* Header */}
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.1), display: "grid", placeItems: "center" }}>
              <TravelExplore color="primary" />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={900}>Tour packages</Typography>
              <Typography variant="body2" color="text.secondary">Curate partner products, approve content, and manage tour bookings.</Typography>
            </Box>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<Refresh />} onClick={() => { qc.invalidateQueries({ queryKey: ["admin-tour-packages"] }); qc.invalidateQueries({ queryKey: ["admin-tour-bookings"] }); qc.invalidateQueries({ queryKey: ["admin-tour-stats"] }); }}>Refresh</Button>
          <Button startIcon={<Add />} variant="contained" size="large" onClick={() => { setEditing(null); setEditorOpen(true); }}>Add package</Button>
        </Stack>
      </Stack>

      {/* Stat cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}><StatCard label="Active catalog" value={statsQuery.data?.active ?? "—"} color="#10B981" icon={<CheckCircle />} /></Grid>
        <Grid item xs={6} md={3}><StatCard label="Awaiting review" value={statsQuery.data?.pending_review ?? "—"} color="#F59E0B" icon={<HourglassEmpty />} /></Grid>
        <Grid item xs={6} md={3}><StatCard label="Total bookings" value={statsQuery.data?.total_bookings ?? "—"} color="#3B82F6" icon={<ReceiptLong />} subtitle={`${statsQuery.data?.today_bookings ?? 0} today`} /></Grid>
        <Grid item xs={6} md={3}><StatCard label="Revenue (MTD)" value={`₹${((statsQuery.data?.revenue_mtd ?? 0) / 1000).toFixed(1)}k`} color="#8B5CF6" icon={<AttachMoney />} /></Grid>
      </Grid>

      {/* Tabs */}
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: "divider", px: 1 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label={`Package catalog${packages.length ? ` (${packages.length})` : ""}`} />
            <Tab label={`Bookings${bookings.length ? ` (${bookings.length})` : ""}`} />
          </Tabs>
        </Box>

        {/* ── Catalog tab ─────────────────────────────────────── */}
        {tab === 0 && (
          <Box>
            <Box sx={{ p: 2, display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", borderBottom: 1, borderColor: "divider" }}>
              <TextField
                size="small" placeholder="Search package, destination, partner, code…"
                value={search} onChange={e => setSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
                sx={{ minWidth: 320 }}
              />
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                {STATUS_FILTERS.map(f => (
                  <Chip
                    key={f.value} label={f.label} size="small"
                    color={statusFilter === f.value ? "primary" : "default"}
                    onClick={() => setStatusFilter(f.value)}
                    variant={statusFilter === f.value ? "filled" : "outlined"}
                    sx={{ fontWeight: 700 }}
                  />
                ))}
              </Stack>
              <TextField
                size="small" select label="City" value={cityFilter} onChange={e => setCityFilter(e.target.value)}
                sx={{ minWidth: 180, ml: "auto" }}
              >
                <MenuItem value="ALL">All cities</MenuItem>
                {cities.map((c: any) => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
              </TextField>
            </Box>

            {packagesQuery.isLoading ? (
              <Box sx={{ display: "grid", placeItems: "center", minHeight: 240 }}><CircularProgress /></Box>
            ) : filteredPackages.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 8 }}>
                <TravelExplore sx={{ fontSize: 56, color: "text.disabled", mb: 1 }} />
                <Typography variant="h6" fontWeight={800}>No tour packages found</Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>Try a different filter or add the first package.</Typography>
                <Button variant="contained" startIcon={<Add />} onClick={() => { setEditing(null); setEditorOpen(true); }}>Add package</Button>
              </Box>
            ) : (
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "grey.50" }}>
                      <TableCell sx={{ fontWeight: 800 }}>PACKAGE</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>PARTNER</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>DESTINATION</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>DURATION</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>PRICE FROM</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>STATUS</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>ACTIONS</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredPackages.map(p => {
                      const startingPrice = p.pricing?.length ? Math.min(...p.pricing.map(x => x.package_price)) : 0;
                      const primaryImg = p.media?.find(m => m.is_primary)?.media_url || p.media?.[0]?.media_url;
                      return (
                        <TableRow key={p.id} hover sx={{ "&:last-child td": { border: 0 } }}>
                          <TableCell>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <Avatar src={primaryImg} variant="rounded" sx={{ width: 44, height: 44, bgcolor: "grey.200" }}>
                                <ImageIcon />
                              </Avatar>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={800} noWrap sx={{ maxWidth: 220 }}>{p.package_name}</Typography>
                                <Typography variant="caption" color="text.secondary">{p.package_code} · {p.package_type}</Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell><Typography variant="body2">{p.partner_name || `Partner #${p.partner_id}`}</Typography></TableCell>
                          <TableCell><Typography variant="body2">{p.destination}<br /><Typography variant="caption" color="text.secondary">{p.city_name}</Typography></Typography></TableCell>
                          <TableCell><Chip label={`${p.duration_days}D/${p.duration_nights}N`} size="small" variant="outlined" /></TableCell>
                          <TableCell><Typography variant="body2" fontWeight={800}>₹{startingPrice.toLocaleString("en-IN")}</Typography></TableCell>
                          <TableCell>
                            <Stack spacing={0.5}>
                              <StatusChip status={p.status} />
                              {p.status === "REJECTED" && p.rejection_reason && (
                                <Tooltip title={p.rejection_reason}><Chip size="small" label="Reason" color="error" variant="outlined" sx={{ fontSize: 10 }} /></Tooltip>
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              <Tooltip title="View detail"><IconButton size="small" onClick={() => navigate(`/tours/${p.id}`)}><Visibility fontSize="small" /></IconButton></Tooltip>
                              <Tooltip title="Edit"><IconButton size="small" onClick={() => { setEditing(p); setEditorOpen(true); }}><Edit fontSize="small" /></IconButton></Tooltip>
                              <IconButton size="small" onClick={(e) => setActionMenu({ anchor: e.currentTarget, pkg: p })}><MoreVert fontSize="small" /></IconButton>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Box>
        )}

        {/* ── Bookings tab ────────────────────────────────────── */}
        {tab === 1 && (
          <Box>
            <Box sx={{ p: 2, display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", borderBottom: 1, borderColor: "divider" }}>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                {[{ value: "ALL", label: "All" }, { value: "PENDING_CONFIRMATION", label: "Pending" }, { value: "CONFIRMED", label: "Confirmed" }, { value: "IN_PROGRESS", label: "In Progress" }, { value: "COMPLETED", label: "Completed" }, { value: "CANCELLED", label: "Cancelled" }, { value: "SETTLEMENT_PENDING", label: "Settling" }, { value: "SETTLED", label: "Settled" }].map(f => (
                  <Chip
                    key={f.value} label={f.label} size="small"
                    color={bookingStatusFilter === f.value ? "primary" : "default"}
                    onClick={() => setBookingStatusFilter(f.value)}
                    variant={bookingStatusFilter === f.value ? "filled" : "outlined"}
                    sx={{ fontWeight: 700 }}
                  />
                ))}
              </Stack>
            </Box>

            {bookingsQuery.isLoading ? (
              <Box sx={{ display: "grid", placeItems: "center", minHeight: 240 }}><CircularProgress /></Box>
            ) : bookings.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 8 }}>
                <ReceiptLong sx={{ fontSize: 56, color: "text.disabled", mb: 1 }} />
                <Typography variant="h6" fontWeight={800}>No tour bookings yet</Typography>
                <Typography color="text.secondary">Bookings created from the website or customer care will appear here.</Typography>
              </Box>
            ) : (
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "grey.50" }}>
                      <TableCell sx={{ fontWeight: 800 }}>BOOKING</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>PACKAGE</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>CUSTOMER</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>TRAVEL</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>PAX</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>AMOUNT</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>COMMISSION</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>STATUS</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>ACTION</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bookings.map(b => (
                      <TableRow key={b.id} hover sx={{ "&:last-child td": { border: 0 } }}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={800} fontFamily="monospace">{b.booking_number}</Typography>
                          <Typography variant="caption" color="text.secondary">{b.created_at ? new Date(b.created_at).toLocaleDateString() : ""}</Typography>
                        </TableCell>
                        <TableCell><Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>{b.package_name}</Typography></TableCell>
                        <TableCell><Typography variant="body2">{b.customer_name || `#${b.customer_id}`}</Typography></TableCell>
                        <TableCell><Typography variant="body2">{b.travel_start_date}<br /><Typography variant="caption" color="text.secondary">→ {b.travel_end_date}</Typography></Typography></TableCell>
                        <TableCell><Typography variant="body2">{b.persons_count}</Typography></TableCell>
                        <TableCell><Typography variant="body2" fontWeight={800}>₹{b.total_amount.toLocaleString("en-IN")}</Typography></TableCell>
                        <TableCell><Typography variant="body2" color="success.main">₹{b.platform_commission.toLocaleString("en-IN")}</Typography><Typography variant="caption" color="text.secondary">payout ₹{b.partner_payout.toLocaleString("en-IN")}</Typography></TableCell>
                        <TableCell><StatusChip status={b.booking_status} type="booking" /></TableCell>
                        <TableCell align="right">
                          <Button size="small" variant="outlined" startIcon={<OpenInNew fontSize="small" />} onClick={() => navigate(`/bookings/${b.master_booking_id}/tour/${b.id}`)}>
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Box>
        )}
      </Card>

      {/* ── Action menu ─────────────────────────────────────── */}
      <Menu anchorEl={actionMenu?.anchor} open={!!actionMenu} onClose={() => setActionMenu(null)}>
        {actionMenu?.pkg.status === "PENDING_APPROVAL" && [
          <MenuItem key="approve" onClick={() => statusMutation.mutate({ id: actionMenu.pkg.id, status: "APPROVED" })}>
            <CheckCircle fontSize="small" sx={{ mr: 1, color: "success.main" }} /> Approve
          </MenuItem>,
        ]}
        {actionMenu?.pkg.status === "APPROVED" && [
          <MenuItem key="activate" onClick={() => statusMutation.mutate({ id: actionMenu.pkg.id, status: "ACTIVE" })}>
            <CheckCircle fontSize="small" sx={{ mr: 1, color: "success.main" }} /> Activate
          </MenuItem>,
        ]}
        {actionMenu?.pkg.status === "ACTIVE" && [
          <MenuItem key="suspend" onClick={() => { if (window.confirm("Suspend this tour package? This will set its status to SUSPENDED and it will no longer appear in active catalogs.")) { statusMutation.mutate({ id: actionMenu.pkg.id, status: "SUSPENDED" }); } }}>
            <Block fontSize="small" sx={{ mr: 1, color: "warning.main" }} /> Suspend
          </MenuItem>,
          <MenuItem key="inactive" onClick={() => { if (window.confirm("Mark this tour package as inactive? This will set its status to INACTIVE and it will no longer appear in the active catalog.")) { statusMutation.mutate({ id: actionMenu.pkg.id, status: "INACTIVE" }); } }}>
            <PauseCircle fontSize="small" sx={{ mr: 1 }} /> Mark inactive
          </MenuItem>,
        ]}
        {actionMenu?.pkg.status === "SUSPENDED" && [
          <MenuItem key="reactivate" onClick={() => statusMutation.mutate({ id: actionMenu.pkg.id, status: "ACTIVE" })}>
            <CheckCircle fontSize="small" sx={{ mr: 1, color: "success.main" }} /> Reactivate
          </MenuItem>,
        ]}
        {["PENDING_APPROVAL", "APPROVED", "ACTIVE", "DRAFT"].includes(actionMenu?.pkg.status || "") && (
          <MenuItem onClick={() => { setRejectTarget(actionMenu!.pkg); setActionMenu(null); }}>
            <Cancel fontSize="small" sx={{ mr: 1, color: "error.main" }} /> Reject
          </MenuItem>
        )}
        {actionMenu?.pkg.status === "REJECTED" && (
          <MenuItem onClick={() => statusMutation.mutate({ id: actionMenu.pkg.id, status: "DRAFT" })}>
            <Edit fontSize="small" sx={{ mr: 1 }} /> Move back to draft
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={() => navigate(`/tours/${actionMenu!.pkg.id}`)}>
          <OpenInNew fontSize="small" sx={{ mr: 1 }} /> View detail page
        </MenuItem>
      </Menu>

      {/* ── Reject dialog ───────────────────────────────────── */}
      <Dialog open={!!rejectTarget} onClose={() => setRejectTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject tour package</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <b>{rejectTarget?.package_name}</b> by {rejectTarget?.partner_name} will be marked as rejected and the partner will see your reason.
          </Alert>
          <TextField fullWidth multiline minRows={3} label="Reason for rejection" placeholder="e.g. Pricing too high without hotel details; itinerary needs activities per day" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={!rejectReason.trim() || rejectMutation.isPending} onClick={() => rejectMutation.mutate()}>
            {rejectMutation.isPending ? "Rejecting…" : "Reject package"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Editor dialog ───────────────────────────────────── */}
      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TravelExplore color="primary" />
            <Typography variant="h6" fontWeight={900}>{editing ? `Edit · ${editing.package_name}` : "Add new tour package"}</Typography>
          </Stack>
          <Button onClick={() => setEditorOpen(false)}>Close</Button>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: "grey.50" }}>
          <PackageEditor
            open={editorOpen}
            initial={editing}
            partners={partners}
            cities={cities}
            onClose={() => setEditorOpen(false)}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["admin-tour-packages"] });
              qc.invalidateQueries({ queryKey: ["admin-tour-stats"] });
              setEditorOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
