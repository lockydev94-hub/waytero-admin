// ============================================================
// WAYTERO ADMIN — COUPONS PAGE (Full Implementation)
// Backend: /admin/coupons  (coupon_api.py)
// Models: Coupon, CouponServiceRule, CouponCityRule,
//         CouponCustomerRule, CouponUsage
// ============================================================
import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Card, CardContent, Chip, Button, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, InputLabel, FormControl,
  Switch, FormControlLabel, Table, TableHead, TableRow,
  TableCell, TableBody, TableContainer, Paper, Tooltip,
  CircularProgress, Alert, Stack, Grid, Divider,
  InputAdornment, Tabs, Tab, Badge, alpha, useTheme,
  Autocomplete, Collapse,
} from "@mui/material";
import {
  Add, Edit, Delete, Refresh, LocalOffer, ContentCopy,
  CheckCircle, Cancel, ExpandMore, ExpandLess, People,
  LocationCity, DirectionsCar, Percent, AttachMoney,
  CalendarMonth, Assessment, Search, FilterList,
  ToggleOn, ToggleOff, Visibility, Close,
} from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { couponService, Coupon, CouponCreatePayload, CouponUsageRecord } from "../../services/coupon.service";
import CouponViewModal from "./CouponViewModal";
import { settingsService, City, VehicleCategory } from "../../services/settings.service";
import { format, isAfter, isBefore, parseISO } from "date-fns";

// ── Types ──────────────────────────────────────────────────────
interface ServiceRuleRow { service_type: string; vehicle_category_id: number | null }
interface CityRuleRow { city_id: number; city_name?: string; max_discount_override: number | null }

const APPLY_TO_OPTIONS = ["ALL", "CAB", "HOTEL", "TOUR"];
const DISCOUNT_TYPES   = ["PERCENTAGE", "FLAT"];
const SERVICE_TYPES    = ["CAB", "HOTEL", "TOUR"];

const APPLY_COLOR: Record<string, "default" | "primary" | "success" | "warning"> = {
  ALL: "primary", CAB: "success", HOTEL: "warning", TOUR: "default",
};

// ── Helpers ───────────────────────────────────────────────────
function couponStatus(c: Coupon): { label: string; color: "success" | "error" | "warning" | "default" } {
  if (!c.is_active) return { label: "Inactive", color: "error" };
  const today = new Date();
  const from = parseISO(c.valid_from);
  const to   = parseISO(c.valid_to);
  if (isBefore(today, from)) return { label: "Scheduled", color: "warning" };
  if (isAfter(today, to))    return { label: "Expired",   color: "error" };
  return { label: "Active", color: "success" };
}

function fmtDiscount(c: Coupon) {
  return c.discount_type === "PERCENTAGE"
    ? `${c.discount_value}%${c.max_discount_amount ? ` (max ₹${c.max_discount_amount})` : ""}`
    : `₹${c.discount_value}`;
}

// ── EMPTY FORM ────────────────────────────────────────────────
function emptyForm(): CouponCreatePayload {
  const today = new Date().toISOString().split("T")[0];
  const next  = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
  return {
    coupon_code: "",
    title: "",
    description: "",
    apply_to: "ALL",
    discount_type: "PERCENTAGE",
    discount_value: 10,
    max_discount_amount: null,
    min_booking_amount: 0,
    max_usage_total: null,
    max_usage_per_customer: 1,
    valid_from: today,
    valid_to: next,
    is_customer_specific: false,
    is_city_specific: false,
    service_rules: [],
    city_rules: [],
    customer_mobiles: [],
  };
}

// ══════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════
export default function CouponsPage() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  // ── State ──
  const [coupons, setCoupons]       = useState<Coupon[]>([]);
  const [loading, setLoading]       = useState(true);
  const [cities, setCities]         = useState<City[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);

  // Filters
  const [filterStatus, setFilterStatus] = useState<"" | "true" | "false">("");
  const [filterApplyTo, setFilterApplyTo] = useState("");
  const [filterSearch, setFilterSearch]   = useState("");

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId]         = useState<number | null>(null);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState<CouponCreatePayload>(emptyForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Usage drawer
  const [usageOpen, setUsageOpen]   = useState(false);
  const [usageCoupon, setUsageCoupon] = useState<Coupon | null>(null);
  const [usages, setUsages]         = useState<CouponUsageRecord[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);

  // View modal
  const [viewCoupon, setViewCoupon] = useState<Coupon | null>(null);
  const [viewOpen, setViewOpen]     = useState(false);

  // City rules UI
  const [cityRules, setCityRules]   = useState<CityRuleRow[]>([]);
  // Service rules UI
  const [serviceRules, setServiceRules] = useState<ServiceRuleRow[]>([]);
  // Customer mobiles
  const [mobilesText, setMobilesText] = useState("");

  // Form tab
  const [formTab, setFormTab] = useState(0);

  // ── Load data ──
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: { is_active?: boolean; apply_to?: string } = {};
      if (filterStatus !== "") params.is_active = filterStatus === "true";
      if (filterApplyTo)        params.apply_to  = filterApplyTo;
      const data = await couponService.list(params);
      setCoupons(data);
    } catch {
      enqueueSnackbar("Failed to load coupons", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterApplyTo, enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (settingsService as any).getCities(true).then(setCities).catch(() => {});
    (settingsService as any).getVehicleCategories(true).then(setCategories).catch(() => {});
  }, []);

  // ── Filtered list ──
  const filtered = coupons.filter(c => {
    if (!filterSearch) return true;
    const q = filterSearch.toLowerCase();
    return c.coupon_code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q);
  });

  // ── Open dialog for create / edit ──
  function openCreate() {
    setEditId(null);
    const f = emptyForm();
    setForm(f);
    setCityRules([]);
    setServiceRules([]);
    setMobilesText("");
    setFormErrors({});
    setFormTab(0);
    setDialogOpen(true);
  }

  function openEdit(c: Coupon) {
    setEditId(c.id);
    setForm({
      coupon_code: c.coupon_code,
      title: c.title,
      description: c.description ?? "",
      apply_to: c.apply_to,
      discount_type: c.discount_type,
      discount_value: Number(c.discount_value),
      max_discount_amount: c.max_discount_amount ? Number(c.max_discount_amount) : null,
      min_booking_amount: Number(c.min_booking_amount),
      max_usage_total: c.max_usage_total ?? null,
      max_usage_per_customer: c.max_usage_per_customer,
      valid_from: c.valid_from,
      valid_to: c.valid_to,
      is_customer_specific: c.is_customer_specific,
      is_city_specific: c.is_city_specific,
      service_rules: c.service_rules.map(r => ({ service_type: r.service_type, vehicle_category_id: r.vehicle_category_id })),
      city_rules: c.city_rules.map(r => ({ city_id: r.city_id, max_discount_override: r.max_discount_override ? Number(r.max_discount_override) : null })),
      customer_mobiles: c.customer_rules.map(r => r.mobile_number),
    });
    setCityRules(c.city_rules.map(r => ({
      city_id: r.city_id,
      city_name: cities.find(ci => ci.id === r.city_id)?.name ?? String(r.city_id),
      max_discount_override: r.max_discount_override ? Number(r.max_discount_override) : null,
    })));
    setServiceRules(c.service_rules.map(r => ({ service_type: r.service_type, vehicle_category_id: r.vehicle_category_id })));
    setMobilesText(c.customer_rules.map(r => r.mobile_number).join("\n"));
    setFormErrors({});
    setFormTab(0);
    setDialogOpen(true);
  }

  // ── Validate form ──
  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.coupon_code.trim()) e.coupon_code = "Required";
    if (!form.title.trim()) e.title = "Required";
    if (!form.discount_value || form.discount_value <= 0) e.discount_value = "Must be > 0";
    if (form.discount_type === "PERCENTAGE" && form.discount_value > 100) e.discount_value = "Cannot exceed 100%";
    if (!form.valid_from) e.valid_from = "Required";
    if (!form.valid_to) e.valid_to = "Required";
    if (form.valid_from && form.valid_to && form.valid_from > form.valid_to) e.valid_to = "Must be after start date";
    if (form.is_city_specific && cityRules.length === 0) e.city_rules = "Add at least one city";
    if (form.is_customer_specific && !mobilesText.trim()) e.customer_mobiles = "Enter at least one mobile number";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Save ──
  async function handleSave() {
    // Sync sub-form state into form
    const mobiles = mobilesText.split(/[\n,]+/).map(m => m.trim()).filter(Boolean);
    const payload: CouponCreatePayload = {
      ...form,
      coupon_code: form.coupon_code.toUpperCase().trim(),
      service_rules: serviceRules,
      city_rules: cityRules.map(r => ({ city_id: r.city_id, max_discount_override: r.max_discount_override })),
      customer_mobiles: mobiles,
    };
    // Sync for validation
    setForm(payload);
    if (!validate()) { setFormTab(0); return; }

    setSaving(true);
    try {
      if (editId) {
        await couponService.update(editId, payload);
        enqueueSnackbar("Coupon updated", { variant: "success" });
      } else {
        await couponService.create(payload);
        enqueueSnackbar("Coupon created", { variant: "success" });
      }
      setDialogOpen(false);
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? "Save failed";
      enqueueSnackbar(msg, { variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle active ──
  async function toggleActive(c: Coupon) {
    try {
      await couponService.update(c.id, { is_active: !c.is_active });
      enqueueSnackbar(`Coupon ${c.is_active ? "deactivated" : "activated"}`, { variant: "success" });
      load();
    } catch {
      enqueueSnackbar("Failed to update status", { variant: "error" });
    }
  }

  // ── Delete ──
  async function handleDelete(c: Coupon) {
    if (!window.confirm(`Delete coupon "${c.coupon_code}"? This cannot be undone.`)) return;
    try {
      await couponService.delete(c.id);
      enqueueSnackbar("Coupon deleted", { variant: "success" });
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? "Delete failed";
      enqueueSnackbar(msg, { variant: "error" });
    }
  }

  // ── Open usage drawer ──
  async function openUsages(c: Coupon) {
    setUsageCoupon(c);
    setUsageOpen(true);
    setUsageLoading(true);
    try {
      const data = await couponService.usages(c.id);
      setUsages(data.items);
    } catch {
      enqueueSnackbar("Failed to load usages", { variant: "error" });
    } finally {
      setUsageLoading(false);
    }
  }

  // ── Stats banner ──
  const totalActive   = coupons.filter(c => couponStatus(c).label === "Active").length;
  const totalExpired  = coupons.filter(c => couponStatus(c).label === "Expired").length;
  const totalInactive = coupons.filter(c => !c.is_active).length;

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <LocalOffer sx={{ color: "primary.main" }} /> Coupon Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Create and manage discount coupons — service-specific, city-restricted, or customer-targeted
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={load} disabled={loading}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={openCreate} sx={{ fontWeight: 600 }}>
            New Coupon
          </Button>
        </Stack>
      </Box>

      {/* ── Stats ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: "Total Coupons", value: coupons.length, color: "primary.main", bg: alpha(theme.palette.primary.main, 0.08) },
          { label: "Active",        value: totalActive,    color: "success.main",  bg: alpha(theme.palette.success.main, 0.08) },
          { label: "Expired",       value: totalExpired,   color: "error.main",    bg: alpha(theme.palette.error.main, 0.08) },
          { label: "Inactive",      value: totalInactive,  color: "text.secondary",bg: alpha(theme.palette.action.focus, 0.05) },
        ].map(s => (
          <Grid item xs={6} sm={3} key={s.label}>
            <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, background: s.bg }}>
              <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
                <Typography variant="h4" fontWeight={800} color={s.color}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={500}>{s.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Filters ── */}
      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, mb: 2.5 }}>
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <TextField
              size="small" placeholder="Search code or title…"
              value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
              sx={{ minWidth: 220 }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Status</InputLabel>
              <Select value={filterStatus} label="Status" onChange={e => setFilterStatus(e.target.value as any)}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="true">Active</MenuItem>
                <MenuItem value="false">Inactive</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Applies To</InputLabel>
              <Select value={filterApplyTo} label="Applies To" onChange={e => setFilterApplyTo(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {APPLY_TO_OPTIONS.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </Select>
            </FormControl>
            {(filterSearch || filterStatus || filterApplyTo) && (
              <Button size="small" onClick={() => { setFilterSearch(""); setFilterStatus(""); setFilterApplyTo(""); }}>
                Clear
              </Button>
            )}
            <Box flex={1} />
            <Typography variant="body2" color="text.secondary">
              {filtered.length} coupon{filtered.length !== 1 ? "s" : ""}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Table ── */}
      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
        ) : filtered.length === 0 ? (
          <Box py={8} textAlign="center">
            <LocalOffer sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
            <Typography color="text.secondary">No coupons found</Typography>
            <Button variant="outlined" sx={{ mt: 2 }} startIcon={<Add />} onClick={openCreate}>Create First Coupon</Button>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.04), borderBottom: "2px solid", borderColor: "divider" } }}>
                  <TableCell>Code / Title</TableCell>
                  <TableCell>Applies To</TableCell>
                  <TableCell>Discount</TableCell>
                  <TableCell>Validity</TableCell>
                  <TableCell align="center">Usage</TableCell>
                  <TableCell align="center">Flags</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map(c => {
                  const st = couponStatus(c);
                  return (
                    <TableRow key={c.id} hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
                      <TableCell>
                        <Box>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <Typography variant="body2" fontWeight={700} fontFamily="monospace" letterSpacing={1} color="primary.main">
                              {c.coupon_code}
                            </Typography>
                            <Tooltip title="Copy code">
                              <IconButton size="small" onClick={() => { navigator.clipboard.writeText(c.coupon_code); enqueueSnackbar("Copied!", { variant: "info", autoHideDuration: 1000 }); }}>
                                <ContentCopy sx={{ fontSize: 13 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                          <Typography variant="caption" color="text.secondary">{c.title}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={c.apply_to} size="small" color={APPLY_COLOR[c.apply_to] ?? "default"} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{fmtDiscount(c)}</Typography>
                        {c.min_booking_amount > 0 && (
                          <Typography variant="caption" color="text.secondary">Min ₹{c.min_booking_amount}</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {format(parseISO(c.valid_from), "dd MMM yy")} – {format(parseISO(c.valid_to), "dd MMM yy")}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="View usage history">
                          <Button size="small" variant="text" onClick={() => openUsages(c)} sx={{ minWidth: 0 }}>
                            <Badge badgeContent={c.current_usage_count} color="primary" max={9999}>
                              <Assessment fontSize="small" />
                            </Badge>
                          </Button>
                        </Tooltip>
                        {c.max_usage_total && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            / {c.max_usage_total}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          {c.is_city_specific && (
                            <Tooltip title={
                              c.city_rules.length > 0
                                ? `Cities: ${c.city_rules.map(r => cities.find(ci => ci.id === r.city_id)?.name ?? `#${r.city_id}`).join(", ")}`
                                : "City-specific"
                            }>
                              <LocationCity fontSize="small" color="info" />
                            </Tooltip>
                          )}
                          {c.is_customer_specific && (
                            <Tooltip title={`Customer-specific (${c.customer_rules.length} numbers)`}>
                              <People fontSize="small" color="secondary" />
                            </Tooltip>
                          )}
                          {c.service_rules.length > 0 && (
                            <Tooltip title={
                              c.service_rules.map(r =>
                                r.vehicle_category_id
                                  ? `${r.service_type} › ${categories.find(v => v.id === r.vehicle_category_id)?.category_name ?? `Cat #${r.vehicle_category_id}`}`
                                  : r.service_type
                              ).join(", ")
                            }>
                              <DirectionsCar fontSize="small" color="warning" />
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={st.label} size="small" color={st.color} variant="filled" sx={{ fontWeight: 600, minWidth: 72 }} />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => { setViewCoupon(c); setViewOpen(true); }}
                              sx={{ color: "primary.main" }}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={c.is_active ? "Deactivate" : "Activate"}>
                            <IconButton size="small" onClick={() => toggleActive(c)} color={c.is_active ? "success" : "default"}>
                              {c.is_active ? <ToggleOn /> : <ToggleOff />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEdit(c)}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => handleDelete(c)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {/* ══ CREATE / EDIT DIALOG ══ */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 0, fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
          <LocalOffer color="primary" />
          {editId ? "Edit Coupon" : "Create Coupon"}
        </DialogTitle>

        <Box sx={{ px: 3, pt: 1 }}>
          <Tabs value={formTab} onChange={(_, v) => setFormTab(v)} sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tab label="Basic" />
            <Tab label="Service Rules" />
            <Tab label="City Rules" disabled={!form.is_city_specific} />
            <Tab label="Customers" disabled={!form.is_customer_specific} />
          </Tabs>
        </Box>

        <DialogContent>
          {/* ── Tab 0: Basic ── */}
          {formTab === 0 && (
            <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Coupon Code *" fullWidth size="small"
                  value={form.coupon_code}
                  onChange={e => setForm(f => ({ ...f, coupon_code: e.target.value.toUpperCase() }))}
                  error={!!formErrors.coupon_code} helperText={formErrors.coupon_code}
                  disabled={!!editId}
                  inputProps={{ style: { fontFamily: "monospace", letterSpacing: 2, fontWeight: 700 } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Title *" fullWidth size="small"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  error={!!formErrors.title} helperText={formErrors.title}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Description" fullWidth size="small" multiline rows={2}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Applies To *</InputLabel>
                  <Select value={form.apply_to} label="Applies To *" onChange={e => setForm(f => ({ ...f, apply_to: e.target.value }))}>
                    {APPLY_TO_OPTIONS.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Discount Type *</InputLabel>
                  <Select value={form.discount_type} label="Discount Type *" onChange={e => setForm(f => ({ ...f, discount_type: e.target.value }))}>
                    {DISCOUNT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Discount Value *" fullWidth size="small" type="number"
                  value={form.discount_value}
                  onChange={e => setForm(f => ({ ...f, discount_value: Number(e.target.value) }))}
                  error={!!formErrors.discount_value} helperText={formErrors.discount_value}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        {form.discount_type === "PERCENTAGE" ? <Percent fontSize="small" /> : <AttachMoney fontSize="small" />}
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  label="Max Discount Cap (₹)" fullWidth size="small" type="number"
                  value={form.max_discount_amount ?? ""}
                  onChange={e => setForm(f => ({ ...f, max_discount_amount: e.target.value ? Number(e.target.value) : null }))}
                  helperText="Leave blank for no cap"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Min Booking Amount (₹)" fullWidth size="small" type="number"
                  value={form.min_booking_amount}
                  onChange={e => setForm(f => ({ ...f, min_booking_amount: Number(e.target.value) }))}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Max Uses Per Customer" fullWidth size="small" type="number"
                  value={form.max_usage_per_customer}
                  onChange={e => setForm(f => ({ ...f, max_usage_per_customer: Number(e.target.value) }))}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  label="Total Usage Limit" fullWidth size="small" type="number"
                  value={form.max_usage_total ?? ""}
                  onChange={e => setForm(f => ({ ...f, max_usage_total: e.target.value ? Number(e.target.value) : null }))}
                  helperText="Leave blank for unlimited"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Valid From *" fullWidth size="small" type="date"
                  value={form.valid_from}
                  onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))}
                  error={!!formErrors.valid_from} helperText={formErrors.valid_from}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Valid To *" fullWidth size="small" type="date"
                  value={form.valid_to}
                  onChange={e => setForm(f => ({ ...f, valid_to: e.target.value }))}
                  error={!!formErrors.valid_to} helperText={formErrors.valid_to}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" fontWeight={600} mb={1}>Restrictions</Typography>
                <Stack direction="row" spacing={3}>
                  <FormControlLabel
                    control={<Switch checked={form.is_city_specific} onChange={e => setForm(f => ({ ...f, is_city_specific: e.target.checked }))} color="info" />}
                    label={<Box><Typography variant="body2" fontWeight={600}>City-Specific</Typography><Typography variant="caption" color="text.secondary">Limit to selected cities</Typography></Box>}
                  />
                  <FormControlLabel
                    control={<Switch checked={form.is_customer_specific} onChange={e => setForm(f => ({ ...f, is_customer_specific: e.target.checked }))} color="secondary" />}
                    label={<Box><Typography variant="body2" fontWeight={600}>Customer-Specific</Typography><Typography variant="caption" color="text.secondary">Only whitelisted mobiles</Typography></Box>}
                  />
                </Stack>
              </Grid>
            </Grid>
          )}

          {/* ── Tab 1: Service Rules ── */}
          {formTab === 1 && (
            <Box sx={{ mt: 1 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                If no service rules are added, the coupon applies to <strong>all</strong> services under the "Applies To" scope.
                Add rules to restrict to specific service types or vehicle categories.
              </Alert>
              <Button startIcon={<Add />} variant="outlined" size="small" onClick={() =>
                setServiceRules(r => [...r, { service_type: "CAB", vehicle_category_id: null }])
              }>
                Add Rule
              </Button>
              {serviceRules.length > 0 && (
                <TableContainer component={Paper} variant="outlined" sx={{ mt: 2, borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Service Type</TableCell>
                        <TableCell>Vehicle Category <Typography component="span" variant="caption">(CAB only, optional)</Typography></TableCell>
                        <TableCell align="right">Remove</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {serviceRules.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <FormControl size="small" sx={{ minWidth: 120 }}>
                              <Select value={r.service_type} onChange={e => setServiceRules(rs => rs.map((x, j) => j === i ? { ...x, service_type: e.target.value, vehicle_category_id: null } : x))}>
                                {SERVICE_TYPES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            {r.service_type === "CAB" ? (
                              <FormControl size="small" sx={{ minWidth: 160 }}>
                                <Select
                                  value={r.vehicle_category_id ?? ""}
                                  displayEmpty
                                  onChange={e => setServiceRules(rs => rs.map((x, j) => j === i ? { ...x, vehicle_category_id: e.target.value ? Number(e.target.value) : null } : x))}
                                >
                                  <MenuItem value="">All categories</MenuItem>
                                  {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.category_name}</MenuItem>)}
                                </Select>
                              </FormControl>
                            ) : (
                              <Typography variant="caption" color="text.secondary">N/A</Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <IconButton size="small" color="error" onClick={() => setServiceRules(rs => rs.filter((_, j) => j !== i))}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {/* ── Tab 2: City Rules ── */}
          {formTab === 2 && (
            <Box sx={{ mt: 1 }}>
              {formErrors.city_rules && <Alert severity="error" sx={{ mb: 2 }}>{formErrors.city_rules}</Alert>}
              <Alert severity="info" sx={{ mb: 2 }}>
                The <strong>Max Discount Override</strong> per city caps the discount to protect against giving more than the city base fare.
                Leave blank to use the coupon's global cap.
              </Alert>
              <Autocomplete
                options={cities.filter(ci => !cityRules.find(r => r.city_id === ci.id))}
                getOptionLabel={c => c.name}
                onChange={(_, val) => {
                  if (val) setCityRules(r => [...r, { city_id: val.id, city_name: val.name, max_discount_override: null }]);
                }}
                renderInput={params => <TextField {...params} label="Add City" size="small" placeholder="Search city…" />}
                sx={{ maxWidth: 320, mb: 2 }}
              />
              {cityRules.length > 0 && (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>City</TableCell>
                        <TableCell>Max Discount Override (₹)</TableCell>
                        <TableCell align="right">Remove</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cityRules.map((r, i) => (
                        <TableRow key={r.city_id}>
                          <TableCell sx={{ fontWeight: 600 }}>{r.city_name ?? r.city_id}</TableCell>
                          <TableCell>
                            <TextField
                              size="small" type="number" placeholder="No limit"
                              value={r.max_discount_override ?? ""}
                              onChange={e => setCityRules(rs => rs.map((x, j) => j === i ? { ...x, max_discount_override: e.target.value ? Number(e.target.value) : null } : x))}
                              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                              sx={{ maxWidth: 160 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <IconButton size="small" color="error" onClick={() => setCityRules(rs => rs.filter((_, j) => j !== i))}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {/* ── Tab 3: Customer Whitelist ── */}
          {formTab === 3 && (
            <Box sx={{ mt: 1 }}>
              {formErrors.customer_mobiles && <Alert severity="error" sx={{ mb: 2 }}>{formErrors.customer_mobiles}</Alert>}
              <Alert severity="info" sx={{ mb: 2 }}>
                Enter one mobile number per line (or comma-separated). Only these customers will be able to redeem this coupon.
              </Alert>
              <TextField
                label="Customer Mobile Numbers"
                fullWidth multiline rows={8}
                value={mobilesText}
                onChange={e => setMobilesText(e.target.value)}
                placeholder={"9876543210\n9123456789\n..."}
                helperText={`${mobilesText.split(/[\n,]+/).filter(m => m.trim()).length} number(s) entered`}
              />
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving} startIcon={saving ? <CircularProgress size={16} /> : undefined} sx={{ fontWeight: 600, minWidth: 120 }}>
            {saving ? "Saving…" : editId ? "Update Coupon" : "Create Coupon"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══ USAGE HISTORY DIALOG ══ */}
      <Dialog open={usageOpen} onClose={() => setUsageOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box display="flex" alignItems="center" gap={1}>
            <Assessment color="primary" />
            Usage History — <Typography component="span" fontFamily="monospace" fontWeight={800} color="primary.main">{usageCoupon?.coupon_code}</Typography>
          </Box>
          <IconButton onClick={() => setUsageOpen(false)} size="small"><Close /></IconButton>
        </DialogTitle>
        <DialogContent>
          {usageLoading ? (
            <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
          ) : usages.length === 0 ? (
            <Box py={4} textAlign="center">
              <Assessment sx={{ fontSize: 40, color: "text.disabled" }} />
              <Typography color="text.secondary" mt={1}>No usage records yet</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Customer ID</TableCell>
                    <TableCell>Booking ID</TableCell>
                    <TableCell>Discount</TableCell>
                    <TableCell>Used At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {usages.map(u => (
                    <TableRow key={u.id}>
                      <TableCell>{u.customer_id}</TableCell>
                      <TableCell>{u.master_booking_id ?? "—"}</TableCell>
                      <TableCell>
                        <Typography fontWeight={600} color="success.main">₹{u.discount_applied}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{format(new Date(u.used_at), "dd MMM yyyy, HH:mm")}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
      </Dialog>
      {/* ══ COUPON VIEW MODAL ══ */}
      <CouponViewModal
        open={viewOpen}
        coupon={viewCoupon}
        onClose={() => { setViewOpen(false); }}
        cities={cities}
        vehicleCategories={categories}
      />
    </Box>
  );
}
