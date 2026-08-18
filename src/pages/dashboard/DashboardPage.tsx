// ============================================================
// WAYTERO ADMIN — DASHBOARD PAGE
// KPI Cards → Revenue Chart → City Chart → Recent Activity
//             → Expiring Documents
// API: GET /admin/dashboard | /admin/analytics
//      GET /admin/dashboard/revenue-trend
//      GET /admin/dashboard/city-performance
//      GET /admin/dashboard/recent-activity
//      GET /admin/dashboard/expiring-documents
// ============================================================
import { useQuery } from "@tanstack/react-query";
import {
  Box, Grid, Card, CardContent, Typography, Skeleton,
  Chip, Divider, Avatar, Stack, alpha, Table, TableBody, TableCell,
  TableHead, TableRow, TableContainer,
} from "@mui/material";
import {
  ConfirmationNumber, Hotel, DirectionsCar, Handshake,
  Person, TrendingUp, AccountBalance, HourglassEmpty,
  CheckCircleOutline, ErrorOutline, InfoOutlined, WarningAmber, Description,
} from "@mui/icons-material";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { dashboardService } from "../../services/dashboard.service";
import { CACHE_TTL } from "../../constants";

function formatCurrency(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}

function KpiCard({ label, value, sub, icon, color, loading }: KpiCardProps) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600}
              sx={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {label}
            </Typography>
            {loading ? (
              <Skeleton variant="text" width={80} height={44} />
            ) : (
              <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5, lineHeight: 1 }}>
                {value}
              </Typography>
            )}
            {sub && !loading && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                {sub}
              </Typography>
            )}
          </Box>
          <Avatar sx={{ bgcolor: alpha(color, 0.12), width: 48, height: 48 }}>
            <Box sx={{ color }}>{icon}</Box>
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );
}

const statusColor: Record<string, "success" | "error" | "warning" | "info"> = {
  success: "success", error: "error", warning: "warning", info: "info",
};

function ActivityIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircleOutline sx={{ color: "success.main", fontSize: 20 }} />;
  if (status === "error")   return <ErrorOutline sx={{ color: "error.main", fontSize: 20 }} />;
  if (status === "warning") return <ErrorOutline sx={{ color: "warning.main", fontSize: 20 }} />;
  return <InfoOutlined sx={{ color: "info.main", fontSize: 20 }} />;
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: dashboardService.getStats,
    staleTime: CACHE_TTL.SHORT,
    retry: false,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["dashboard-analytics"],
    queryFn: dashboardService.getAnalytics,
    staleTime: CACHE_TTL.SHORT,
    retry: false,
  });

  const { data: cityData = [], isLoading: cityLoading } = useQuery({
    queryKey: ["dashboard-city-performance"],
    queryFn: dashboardService.getCityPerformance,
    staleTime: CACHE_TTL.SHORT,
    retry: false,
  });

  const { data: revenueData = [], isLoading: revenueLoading } = useQuery({
    queryKey: ["dashboard-revenue-trend"],
    queryFn: dashboardService.getRevenueTrend,
    staleTime: CACHE_TTL.SHORT,
    retry: false,
  });

  const { data: recentActivity = [], isLoading: activityLoading } = useQuery({
    queryKey: ["dashboard-recent-activity"],
    queryFn: dashboardService.getRecentActivity,
    staleTime: CACHE_TTL.SHORT,
    retry: false,
  });

  const { data: expiringDocs, isLoading: expiringLoading } = useQuery({
    queryKey: ["dashboard-expiring-documents"],
    queryFn: () => dashboardService.getExpiringDocuments(30),
    staleTime: CACHE_TTL.MEDIUM,
    retry: false,
  });

  const { data: hotelPipeline, isLoading: pipelineLoading } = useQuery({
    queryKey: ["dashboard-hotel-pipeline"],
    queryFn: dashboardService.getHotelPipeline,
    staleTime: CACHE_TTL.MEDIUM,
    retry: false,
  });

  const s = stats ?? {
    today_cab_bookings: 0,
    today_hotel_reservations: 0,
    active_trips: 0,
    today_revenue: 0,
    pending_settlements: 0,
    pending_partner_approvals: 0,
  };

  const a = analytics ?? {
    total_customers: 0,
    total_partners: 0,
    active_partners: 0,
    total_hotels: 0,
    active_hotels: 0,
    monthly_revenue: 0,
    pending_hotel_approvals: 0,
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Dashboard</Typography>
        <Typography variant="body2" color="text.secondary">
          Platform overview — live operational metrics
        </Typography>
      </Box>

      {/* KPI Row 1 — Today's ops */}
      <Typography variant="caption" color="text.secondary" fontWeight={600}
        sx={{ textTransform: "uppercase", letterSpacing: "0.05em", mb: 1.5, display: "block" }}>
        Today's Operations
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard label="Cab Bookings" value={s.today_cab_bookings} sub="New today"
            icon={<DirectionsCar />} color="#0F6FFF" loading={isLoading} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard label="Hotel Reservations" value={s.today_hotel_reservations} sub="New today"
            icon={<Hotel />} color="#14B8A6" loading={isLoading} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard label="Today's Revenue" value={formatCurrency(s.today_revenue)} sub="Cab + Hotel"
            icon={<TrendingUp />} color="#22C55E" loading={isLoading} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard label="Pending Settlements" value={formatCurrency(s.pending_settlements)} sub="Awaiting payout"
            icon={<AccountBalance />} color="#F59E0B" loading={isLoading} />
        </Grid>
      </Grid>

      {/* KPI Row 2 — Platform summary */}
      <Typography variant="caption" color="text.secondary" fontWeight={600}
        sx={{ textTransform: "uppercase", letterSpacing: "0.05em", mb: 1.5, display: "block" }}>
        Platform Summary
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard label="Total Customers" value={a.total_customers.toLocaleString("en-IN")}
            icon={<Person />} color="#8B5CF6" loading={analyticsLoading} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard label="Active Partners" value={a.active_partners}
            sub={`${a.total_partners} total · ${s.pending_partner_approvals} pending`}
            icon={<Handshake />} color="#0F6FFF" loading={isLoading || analyticsLoading} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard label="Active Hotels" value={a.active_hotels}
            sub={`${a.total_hotels} total · ${a.pending_hotel_approvals} pending`}
            icon={<Hotel />} color="#14B8A6" loading={analyticsLoading} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard label="Monthly Revenue" value={formatCurrency(a.monthly_revenue)} sub="Cab + Hotel"
            icon={<TrendingUp />} color="#22C55E" loading={analyticsLoading} />
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={8}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={600}>Revenue Trend</Typography>
                  <Typography variant="caption" color="text.secondary">Last 6 months — Cab + Hotel</Typography>
                </Box>
                <Chip label="Monthly" size="small" color="primary" variant="outlined" />
              </Box>
              {revenueLoading ? (
                <Skeleton variant="rectangular" height={220} />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={revenueData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0F6FFF" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#0F6FFF" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="bkGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748B" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#64748B" }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v: number, n) =>
                      n === "revenue" ? [`₹${v.toLocaleString("en-IN")}`, "Revenue"] : [v, "Bookings"]} />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" stroke="#0F6FFF" strokeWidth={2} fill="url(#revGrad)" name="revenue" />
                    <Area type="monotone" dataKey="bookings" stroke="#14B8A6" strokeWidth={2} fill="url(#bkGrad)" name="bookings" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={0.5}>City Performance</Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                Bookings by city — this month
              </Typography>
              {cityLoading ? (
                <Skeleton variant="rectangular" height={220} />
              ) : cityData.length === 0 ? (
                <Box sx={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography variant="body2" color="text.secondary">No data yet</Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={cityData} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} />
                    <YAxis type="category" dataKey="city" tick={{ fontSize: 12, fill: "#64748B" }} width={72} />
                    <Tooltip />
                    <Bar dataKey="bookings" fill="#0F6FFF" radius={[0, 4, 4, 0]} name="Bookings" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Hotel Pipeline Funnel */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <Hotel sx={{ color: "primary.main" }} />
            <Typography variant="h6" fontWeight={600}>Hotel Onboarding Pipeline</Typography>
            {hotelPipeline && (
              <Chip
                size="small"
                label={`${hotelPipeline.total} total · ${hotelPipeline.active} live`}
                color="primary"
                variant="outlined"
              />
            )}
          </Stack>
          {pipelineLoading ? (
            <Skeleton variant="rectangular" height={140} />
          ) : !hotelPipeline ? (
            <Typography variant="body2" color="text.secondary">No data</Typography>
          ) : (
            <Stack spacing={1}>
              {[
                { label: "Draft", value: hotelPipeline.draft, color: "#9CA3AF" },
                { label: "Pending", value: hotelPipeline.pending, color: "#F59E0B" },
                { label: "Under Review", value: hotelPipeline.under_review, color: "#0F6FFF" },
                { label: "Document Pending", value: hotelPipeline.document_pending, color: "#FB923C" },
                { label: "Approved", value: hotelPipeline.approved, color: "#6366F1" },
                { label: "Active", value: hotelPipeline.active, color: "#22C55E" },
              ].map((stage) => {
                const pct = hotelPipeline.total > 0 ? (stage.value / hotelPipeline.total) * 100 : 0;
                return (
                  <Box key={stage.label}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        {stage.label}
                      </Typography>
                      <Typography variant="caption" color="text.primary" fontWeight={700}>
                        {stage.value}
                      </Typography>
                    </Stack>
                    <Box sx={{
                      height: 14, borderRadius: 1,
                      bgcolor: alpha(stage.color, 0.08),
                      overflow: "hidden",
                    }}>
                      <Box sx={{
                        height: "100%",
                        width: `${Math.max(pct, stage.value > 0 ? 2 : 0)}%`,
                        background: `linear-gradient(90deg, ${stage.color}, ${alpha(stage.color, 0.65)})`,
                        borderRadius: 1,
                        transition: "width 0.6s ease",
                      }} />
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={2}>Recent Activity</Typography>
          {activityLoading ? (
            <Stack spacing={1}>
              {[...Array(5)].map((_, i) => <Skeleton key={i} variant="rectangular" height={48} />)}
            </Stack>
          ) : recentActivity.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No recent activity</Typography>
          ) : (
            <Stack divider={<Divider />} spacing={0}>
              {recentActivity.map((item) => (
                <Box key={item.id} sx={{ display: "flex", alignItems: "center", gap: 2, py: 1.5 }}>
                  <ActivityIcon status={item.status} />
                  <Box flex={1}>
                    <Typography variant="body2" fontWeight={500}>{item.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.type}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">{item.time}</Typography>
                  <Chip
                    label={item.status}
                    size="small"
                    color={statusColor[item.status] ?? "default"}
                    variant="outlined"
                    sx={{ fontSize: 10, height: 20, textTransform: "capitalize" }}
                  />
                </Box>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Expiring Documents */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <WarningAmber sx={{ color: "warning.main" }} />
            <Typography variant="h6" fontWeight={600}>Expiring Documents · next 30 days</Typography>
            {expiringDocs && (
              <Chip
                size="small"
                label={`${expiringDocs.total} total`}
                color={expiringDocs.total > 0 ? "warning" : "default"}
                variant="outlined"
              />
            )}
          </Stack>
          {expiringLoading ? (
            <Stack spacing={1}>
              {[...Array(4)].map((_, i) => <Skeleton key={i} variant="rectangular" height={36} />)}
            </Stack>
          ) : !expiringDocs || expiringDocs.items.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No documents expiring in the next 30 days.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Entity</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Document</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Expiry</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {expiringDocs.items.slice(0, 8).map((d) => (
                    <TableRow key={`${d.entity_type}-${d.doc_id}`}>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Avatar sx={{
                            bgcolor: d.entity_type === "HOTEL" ? "#14B8A6"
                                    : d.entity_type === "VEHICLE" ? "#0F6FFF"
                                    : d.entity_type === "DRIVER" ? "#8B5CF6"
                                    : "#F59E0B",
                            width: 28, height: 28,
                          }}>
                            <Description sx={{ fontSize: 14 }} />
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={600}>{d.entity_name ?? "—"}</Typography>
                            <Typography variant="caption" color="text.disabled">
                              {d.entity_type} · {d.entity_code ?? ""}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{d.document_type.replace(/_/g, " ")}</Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2">
                            {d.expiry_date ? format(parseISO(d.expiry_date), "dd MMM yyyy") : "—"}
                          </Typography>
                          {d.is_expired ? (
                            <Chip label="Expired" size="small" color="error" sx={{ fontWeight: 700 }} />
                          ) : d.days_until_expiry !== null && d.days_until_expiry <= 7 ? (
                            <Chip label={`${d.days_until_expiry}d`} size="small" color="error" variant="outlined" sx={{ fontWeight: 700 }} />
                          ) : d.days_until_expiry !== null && d.days_until_expiry <= 30 ? (
                            <Chip label={`${d.days_until_expiry}d`} size="small" color="warning" variant="outlined" />
                          ) : null}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{d.verification_status ?? "—"}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
