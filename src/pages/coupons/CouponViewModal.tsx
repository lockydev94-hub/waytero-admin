// ============================================================
// WAYTERO ADMIN — COUPON VIEW MODAL
// Tabs: Overview | Uses
// Backend: GET /admin/coupons/{id}  &  GET /admin/coupons/{id}/usages
// Models: Coupon, CouponUsageRecord (coupon_models.py)
// ============================================================

import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Tabs, Tab, Chip, Divider, Grid, Stack,
  Button, IconButton, CircularProgress, Alert,
  Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Paper, Pagination, alpha, useTheme,
  Tooltip, LinearProgress,
} from "@mui/material";
import {
  Close, LocalOffer, CheckCircle, Cancel, Schedule,
  Percent, AttachMoney, CalendarMonth, People, LocationCity,
  DirectionsCar, Replay, Assessment, ContentCopy, ReceiptLong,
  HourglassEmpty,
} from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { format, parseISO, isAfter, isBefore } from "date-fns";
import {
  couponService,
  Coupon,
  CouponUsageRecord,
  CouponUsagePaginatedResponse,
} from "../../services/coupon.service";
import { settingsService, City, VehicleCategory } from "../../services/settings.service";

// ── Helpers ───────────────────────────────────────────────────

function couponStatus(c: Coupon): { label: string; color: "success" | "error" | "warning" | "default" } {
  if (!c.is_active) return { label: "Inactive", color: "error" };
  const today = new Date();
  const from = parseISO(c.valid_from);
  const to = parseISO(c.valid_to);
  if (isBefore(today, from)) return { label: "Scheduled", color: "warning" };
  if (isAfter(today, to)) return { label: "Expired", color: "error" };
  return { label: "Active", color: "success" };
}

function fmtDiscount(c: Coupon) {
  return c.discount_type === "PERCENTAGE"
    ? `${c.discount_value}%${c.max_discount_amount ? ` (max ₹${c.max_discount_amount})` : ""}`
    : `₹${c.discount_value}`;
}

const APPLY_COLOR: Record<string, "default" | "primary" | "success" | "warning"> = {
  ALL: "primary", CAB: "success", HOTEL: "warning", TOUR: "default",
};

// ── Tab Panel ─────────────────────────────────────────────────
interface TabPanelProps { children: React.ReactNode; index: number; value: number }
function TabPanel({ children, index, value }: TabPanelProps) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

// ── Info Row ─────────────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
      <Box sx={{ mt: 0.25, color: "text.secondary", minWidth: 20 }}>{icon}</Box>
      <Box flex={1}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
          {label}
        </Typography>
        <Box mt={0.25}>{typeof value === "string" ? <Typography variant="body2">{value}</Typography> : value}</Box>
      </Box>
    </Box>
  );
}

// ── Stat Card ────────────────────────────────────────────────
function StatCard({ label, value, sub, color, bg }: {
  label: string; value: React.ReactNode; sub?: string; color: string; bg: string;
}) {
  return (
    <Box sx={{ flex: 1, border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2, background: bg }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>
        {label}
      </Typography>
      <Typography variant="h4" fontWeight={800} color={color} sx={{ mt: 0.5, lineHeight: 1.1 }}>
        {value}
      </Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Box>
  );
}

// ══════════════════════════════════════════════════════════════
// COUPON VIEW MODAL
// ══════════════════════════════════════════════════════════════
interface CouponViewModalProps {
  open: boolean;
  coupon: Coupon | null;
  onClose: () => void;
  cities?: City[];
  vehicleCategories?: VehicleCategory[];
}

const PAGE_SIZE = 15;

export default function CouponViewModal({ open, coupon, onClose, cities = [], vehicleCategories = [] }: CouponViewModalProps) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const [tab, setTab] = useState(0);

  // Lookup helpers
  const cityName = (id: number) => cities.find(c => c.id === id)?.name ?? `City #${id}`;
  const catName  = (id: number | null) => id == null ? null : (vehicleCategories.find(v => v.id === id)?.category_name ?? `Cat #${id}`);

  // Usage state
  const [usagePage, setUsagePage] = useState(1);
  const [usageData, setUsageData] = useState<CouponUsagePaginatedResponse | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState(false);

  // ── Load usages ──────────────────────────────────────────
  const loadUsages = useCallback(async (page: number) => {
    if (!coupon) return;
    setUsageLoading(true);
    setUsageError(false);
    try {
      const data = await couponService.usages(coupon.id, page, PAGE_SIZE);
      setUsageData(data);
    } catch {
      setUsageError(true);
      enqueueSnackbar("Failed to load usage records", { variant: "error" });
    } finally {
      setUsageLoading(false);
    }
  }, [coupon, enqueueSnackbar]);

  // Reset on open/coupon change
  useEffect(() => {
    if (open && coupon) {
      setTab(0);
      setUsagePage(1);
      setUsageData(null);
      setUsageError(false);
    }
  }, [open, coupon?.id]);

  // Load usages when Uses tab selected
  useEffect(() => {
    if (tab === 1 && open && coupon && !usageData && !usageLoading) {
      loadUsages(1);
    }
  }, [tab, open, coupon]);

  function handlePageChange(_: React.ChangeEvent<unknown>, page: number) {
    setUsagePage(page);
    loadUsages(page);
  }

  if (!coupon) return null;
  const st = couponStatus(coupon);
  const usagePercent = coupon.max_usage_total
    ? Math.min(100, (coupon.current_usage_count / coupon.max_usage_total) * 100)
    : 0;

  const StatusIcon = st.label === "Active" ? CheckCircle : st.label === "Scheduled" ? Schedule : Cancel;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: "hidden",
          background: theme.palette.background.paper,
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
        },
      }}
    >
      {/* ── Header ── */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.primary.dark, 0.05)} 100%)`,
          borderBottom: "1px solid",
          borderColor: "divider",
          px: 3,
          pt: 3,
          pb: 0,
        }}
      >
        {/* Title row */}
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Box
              sx={{
                width: 44, height: 44, borderRadius: 2,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: alpha(theme.palette.primary.main, 0.14),
                color: "primary.main",
              }}
            >
              <LocalOffer />
            </Box>
            <Box>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography
                  variant="h6"
                  fontWeight={800}
                  fontFamily="monospace"
                  letterSpacing={2}
                  color="primary.main"
                >
                  {coupon.coupon_code}
                </Typography>
                <Tooltip title="Copy code">
                  <IconButton
                    size="small"
                    onClick={() => {
                      navigator.clipboard.writeText(coupon.coupon_code);
                      enqueueSnackbar("Code copied!", { variant: "info", autoHideDuration: 1500 });
                    }}
                  >
                    <ContentCopy sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
                <Chip
                  label={st.label}
                  size="small"
                  color={st.color}
                  icon={<StatusIcon sx={{ fontSize: "14px !important" }} />}
                  sx={{ fontWeight: 700, fontSize: 11 }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" mt={0.25}>
                {coupon.title}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ mt: -0.5 }}>
            <Close />
          </IconButton>
        </Box>

        {/* Tabs */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            "& .MuiTab-root": { fontWeight: 600, minHeight: 44 },
            "& .MuiTabs-indicator": { height: 3, borderRadius: "3px 3px 0 0" },
          }}
        >
          <Tab label="Overview" icon={<LocalOffer sx={{ fontSize: 16 }} />} iconPosition="start" />
          <Tab
            label={
              <Box display="flex" alignItems="center" gap={0.75}>
                Uses
                <Chip
                  label={coupon.current_usage_count}
                  size="small"
                  color="primary"
                  sx={{ height: 18, fontSize: 10, fontWeight: 700, "& .MuiChip-label": { px: 0.75 } }}
                />
              </Box>
            }
            icon={<ReceiptLong sx={{ fontSize: 16 }} />}
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* ── Content ── */}
      <DialogContent sx={{ p: 0 }}>
        {/* ══ TAB 0: OVERVIEW ══ */}
        <TabPanel value={tab} index={0}>
          <Box sx={{ px: 3, pb: 3 }}>
            {/* Stats row */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={3}>
              <StatCard
                label="Discount"
                value={fmtDiscount(coupon)}
                sub={coupon.discount_type === "PERCENTAGE" ? "Percentage off" : "Flat discount"}
                color="primary.main"
                bg={alpha(theme.palette.primary.main, 0.07)}
              />
              <StatCard
                label="Total Uses"
                value={coupon.current_usage_count}
                sub={coupon.max_usage_total ? `of ${coupon.max_usage_total} allowed` : "No limit set"}
                color={usagePercent > 80 ? "error.main" : "success.main"}
                bg={alpha(usagePercent > 80 ? theme.palette.error.main : theme.palette.success.main, 0.07)}
              />
              <StatCard
                label="Per Customer"
                value={coupon.max_usage_per_customer}
                sub="Max uses per customer"
                color="text.primary"
                bg={alpha(theme.palette.action.focus, 0.05)}
              />
            </Stack>

            {/* Usage progress bar (if total limit set) */}
            {coupon.max_usage_total && (
              <Box mb={3}>
                <Box display="flex" justifyContent="space-between" mb={0.5}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Usage Progress
                  </Typography>
                  <Typography variant="caption" fontWeight={700} color={usagePercent > 80 ? "error.main" : "text.primary"}>
                    {coupon.current_usage_count} / {coupon.max_usage_total} ({usagePercent.toFixed(0)}%)
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={usagePercent}
                  color={usagePercent > 80 ? "error" : usagePercent > 50 ? "warning" : "success"}
                  sx={{ height: 8, borderRadius: 4, bgcolor: alpha(theme.palette.action.focus, 0.12) }}
                />
              </Box>
            )}

            <Divider sx={{ mb: 0 }} />

            {/* Details */}
            {coupon.description && (
              <InfoRow
                icon={<LocalOffer fontSize="small" />}
                label="Description"
                value={coupon.description}
              />
            )}
            <InfoRow
              icon={<Chip label={coupon.apply_to} size="small" color={APPLY_COLOR[coupon.apply_to] ?? "default"} variant="outlined" sx={{ height: 20, fontSize: 11 }} />}
              label="Applies To"
              value={
                <Typography variant="body2">
                  {coupon.apply_to === "ALL" ? "All Services (CAB, HOTEL, TOUR)" : coupon.apply_to}
                </Typography>
              }
            />
            <InfoRow
              icon={coupon.discount_type === "PERCENTAGE" ? <Percent fontSize="small" /> : <AttachMoney fontSize="small" />}
              label="Discount"
              value={
                <Box>
                  <Typography variant="body2" fontWeight={700}>{fmtDiscount(coupon)}</Typography>
                  {coupon.min_booking_amount > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      Min. booking: ₹{coupon.min_booking_amount}
                    </Typography>
                  )}
                </Box>
              }
            />
            <InfoRow
              icon={<CalendarMonth fontSize="small" />}
              label="Validity Period"
              value={
                <Typography variant="body2">
                  {format(parseISO(coupon.valid_from), "dd MMM yyyy")}
                  {" — "}
                  {format(parseISO(coupon.valid_to), "dd MMM yyyy")}
                </Typography>
              }
            />

            {/* Restrictions */}
            {(coupon.is_city_specific || coupon.is_customer_specific || coupon.service_rules.length > 0) && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="subtitle2" fontWeight={700} mb={1} color="text.secondary">
                  Restrictions
                </Typography>
              </>
            )}

            {coupon.is_city_specific && coupon.city_rules.length > 0 && (
              <InfoRow
                icon={<LocationCity fontSize="small" />}
                label={`City Restricted (${coupon.city_rules.length} cities)`}
                value={
                  <Stack direction="row" flexWrap="wrap" gap={0.75} mt={0.5}>
                    {coupon.city_rules.map(r => (
                      <Chip
                        key={r.id}
                        label={
                          r.max_discount_override
                            ? `${cityName(r.city_id)} (cap ₹${r.max_discount_override})`
                            : cityName(r.city_id)
                        }
                        size="small"
                        color="info"
                        variant="outlined"
                        icon={<LocationCity sx={{ fontSize: "12px !important" }} />}
                      />
                    ))}
                  </Stack>
                }
              />
            )}

            {coupon.is_customer_specific && (
              <InfoRow
                icon={<People fontSize="small" />}
                label={`Customer-Specific (${coupon.customer_rules.length} numbers)`}
                value={
                  <Stack direction="row" flexWrap="wrap" gap={0.75} mt={0.5}>
                    {coupon.customer_rules.map(r => (
                      <Chip
                        key={r.id}
                        label={r.mobile_number}
                        size="small"
                        color="secondary"
                        variant="outlined"
                        icon={<People sx={{ fontSize: "12px !important" }} />}
                      />
                    ))}
                  </Stack>
                }
              />
            )}

            {coupon.service_rules.length > 0 && (
              <InfoRow
                icon={<DirectionsCar fontSize="small" />}
                label={`Service Rules (${coupon.service_rules.length})`}
                value={
                  <Stack direction="row" flexWrap="wrap" gap={0.75} mt={0.5}>
                    {coupon.service_rules.map(r => (
                      <Chip
                        key={r.id}
                        label={
                          catName(r.vehicle_category_id)
                            ? `${r.service_type} › ${catName(r.vehicle_category_id)}`
                            : r.service_type
                        }
                        size="small"
                        color="warning"
                        variant="outlined"
                        icon={<DirectionsCar sx={{ fontSize: "12px !important" }} />}
                      />
                    ))}
                  </Stack>
                }
              />
            )}

            {/* Meta */}
            <Divider sx={{ my: 1.5 }} />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                  CREATED AT
                </Typography>
                <Typography variant="body2">
                  {format(new Date(coupon.created_at), "dd MMM yyyy, HH:mm")}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                  LAST UPDATED
                </Typography>
                <Typography variant="body2">
                  {format(new Date(coupon.updated_at), "dd MMM yyyy, HH:mm")}
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        {/* ══ TAB 1: USES ══ */}
        <TabPanel value={tab} index={1}>
          <Box sx={{ px: 3, pb: 3 }}>
            {/* Summary strip */}
            <Box
              sx={{
                mb: 2.5,
                p: 2,
                borderRadius: 2,
                background: alpha(theme.palette.primary.main, 0.06),
                border: "1px solid",
                borderColor: alpha(theme.palette.primary.main, 0.15),
                display: "flex",
                gap: 3,
                flexWrap: "wrap",
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>TOTAL USES</Typography>
                <Typography variant="h5" fontWeight={800} color="primary.main">{coupon.current_usage_count}</Typography>
              </Box>
              {usageData && (
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>TOTAL DISCOUNT GIVEN</Typography>
                  <Typography variant="h5" fontWeight={800} color="success.main">
                    ₹{usageData.items.reduce((sum, u) => sum + u.discount_applied, 0).toFixed(2)}
                    <Typography component="span" variant="caption" color="text.secondary" ml={0.5}>(this page)</Typography>
                  </Typography>
                </Box>
              )}
              <Box ml="auto" display="flex" alignItems="center">
                <Tooltip title="Refresh">
                  <IconButton size="small" onClick={() => loadUsages(usagePage)} disabled={usageLoading}>
                    <Replay fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Loading */}
            {usageLoading && (
              <Box display="flex" justifyContent="center" alignItems="center" py={6} flexDirection="column" gap={2}>
                <CircularProgress size={40} />
                <Typography variant="body2" color="text.secondary">Loading usage records…</Typography>
              </Box>
            )}

            {/* Error */}
            {usageError && !usageLoading && (
              <Alert severity="error" action={
                <Button size="small" color="inherit" onClick={() => loadUsages(usagePage)}>Retry</Button>
              }>
                Failed to load usage records.
              </Alert>
            )}

            {/* Empty */}
            {!usageLoading && !usageError && usageData && usageData.items.length === 0 && (
              <Box py={8} textAlign="center">
                <HourglassEmpty sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
                <Typography color="text.secondary" fontWeight={500}>No usage records yet</Typography>
                <Typography variant="caption" color="text.disabled">
                  This coupon hasn't been redeemed by any customer yet.
                </Typography>
              </Box>
            )}

            {/* Table */}
            {!usageLoading && !usageError && usageData && usageData.items.length > 0 && (
              <>
                <TableContainer
                  component={Paper}
                  variant="outlined"
                  sx={{ borderRadius: 2, mb: 2.5 }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow
                        sx={{
                          "& th": {
                            fontWeight: 700,
                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                            borderBottom: "2px solid",
                            borderColor: "divider",
                            fontSize: 12,
                            letterSpacing: 0.3,
                          },
                        }}
                      >
                        <TableCell>#</TableCell>
                        <TableCell>Customer ID</TableCell>
                        <TableCell>Booking ID</TableCell>
                        <TableCell>Discount Applied</TableCell>
                        <TableCell>Used At</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {usageData.items.map((u, idx) => {
                        const rowNum = (usagePage - 1) * PAGE_SIZE + idx + 1;
                        return (
                          <TableRow
                            key={u.id}
                            hover
                            sx={{ "&:last-child td": { borderBottom: 0 } }}
                          >
                            <TableCell>
                              <Typography variant="caption" color="text.disabled" fontWeight={600}>
                                {rowNum}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={`#${u.customer_id}`}
                                size="small"
                                variant="outlined"
                                color="default"
                                sx={{ fontWeight: 600, fontFamily: "monospace", fontSize: 11 }}
                              />
                            </TableCell>
                            <TableCell>
                              {u.master_booking_id ? (
                                <Chip
                                  label={`BK-${u.master_booking_id}`}
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  sx={{ fontWeight: 600, fontFamily: "monospace", fontSize: 11 }}
                                />
                              ) : (
                                <Typography variant="caption" color="text.disabled">—</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Box
                                sx={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 0.5,
                                  px: 1.25,
                                  py: 0.35,
                                  borderRadius: 1.5,
                                  background: alpha(theme.palette.success.main, 0.1),
                                  color: "success.dark",
                                }}
                              >
                                <AttachMoney sx={{ fontSize: 13 }} />
                                <Typography variant="body2" fontWeight={700}>
                                  {u.discount_applied.toFixed(2)}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {format(new Date(u.used_at), "dd MMM yyyy")}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {format(new Date(u.used_at), "HH:mm:ss")}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Pagination */}
                {usageData.total_pages > 1 && (
                  <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                    <Typography variant="caption" color="text.secondary">
                      Showing {(usagePage - 1) * PAGE_SIZE + 1}–
                      {Math.min(usagePage * PAGE_SIZE, usageData.total)} of {usageData.total} records
                    </Typography>
                    <Pagination
                      count={usageData.total_pages}
                      page={usagePage}
                      onChange={handlePageChange}
                      color="primary"
                      shape="rounded"
                      size="small"
                      disabled={usageLoading}
                    />
                  </Box>
                )}
              </>
            )}
          </Box>
        </TabPanel>
      </DialogContent>

      {/* ── Footer ── */}
      <DialogActions
        sx={{
          px: 3, py: 2,
          borderTop: "1px solid",
          borderColor: "divider",
          background: alpha(theme.palette.action.focus, 0.03),
        }}
      >
        <Typography variant="caption" color="text.disabled" sx={{ mr: "auto" }}>
          ID: {coupon.id} · Code: {coupon.coupon_code}
        </Typography>
        <Button onClick={onClose} variant="outlined" size="small" startIcon={<Close />}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
