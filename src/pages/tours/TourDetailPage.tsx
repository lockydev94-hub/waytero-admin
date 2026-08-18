// WAYTERO ADMIN — TOUR PACKAGE DETAIL PAGE
// Read-only deep view of a tour package with full metadata, day-by-day
// itinerary, media gallery, pricing slabs, and a list of related bookings.
// Includes status actions inline (Approve / Activate / Suspend / Reject).
// Doc Ref: BRD_PART_5_TOUR_PACKAGE_MANAGEMENT §2-§4
// ============================================================
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box, Typography, Card, CardContent, Stack, Chip, Button, IconButton, Grid, Avatar,
  Divider, CircularProgress, Alert, Tooltip, ImageList, ImageListItem, Table, TableBody,
  TableCell, TableHead, TableRow, Paper, alpha, useTheme,
} from "@mui/material";
import {
  ArrowBack, Edit, TravelExplore, LocationOn, CalendarMonth, People, AccessTime,
  CheckCircle, Block, PauseCircle, Cancel, Star, StarBorder, Image as ImageIcon,
  OpenInNew, ReceiptLong, Hotel, Restaurant, CameraAlt, DirectionsBus, Flight,
  Museum, BeachAccess, Hiking, HistoryEdu, Park, LocalActivity, Verified, Schedule,
  AttachMoney, Description, ListAlt, PendingActions, Drafts, TaskAlt, CancelOutlined,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { format } from "date-fns";
import { tourService, TourPackage } from "../../services/tour.service";

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  DRAFT:            { label: "Draft",            color: "#6B7280", bg: "#F3F4F6", icon: <Drafts sx={{ fontSize: 14 }} /> },
  PENDING_APPROVAL: { label: "Pending Review",   color: "#F59E0B", bg: "#FEF3C7", icon: <PendingActions sx={{ fontSize: 14 }} /> },
  APPROVED:         { label: "Approved",         color: "#6366F1", bg: "#E0E7FF", icon: <TaskAlt sx={{ fontSize: 14 }} /> },
  ACTIVE:           { label: "Active",           color: "#10B981", bg: "#D1FAE5", icon: <CheckCircle sx={{ fontSize: 14 }} /> },
  INACTIVE:         { label: "Inactive",         color: "#6B7280", bg: "#F3F4F6", icon: <PauseCircle sx={{ fontSize: 14 }} /> },
  SUSPENDED:        { label: "Suspended",        color: "#F59E0B", bg: "#FEF3C7", icon: <Block sx={{ fontSize: 14 }} /> },
  REJECTED:         { label: "Rejected",         color: "#EF4444", bg: "#FEE2E2", icon: <CancelOutlined sx={{ fontSize: 14 }} /> },
};

function InfoRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ py: 1 }}>
      {icon && <Box sx={{ color: "text.secondary", mt: 0.25 }}>{icon}</Box>}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>{label}</Typography>
        <Typography variant="body2" fontWeight={600} sx={{ mt: 0.25 }}>{value || "—"}</Typography>
      </Box>
    </Stack>
  );
}

function SectionCard({ title, icon, action, children }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent sx={{ p: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: "divider" }}>
          <Stack direction="row" spacing={1} alignItems="center">{icon}<Typography variant="subtitle1" fontWeight={800}>{title}</Typography></Stack>
          {action}
        </Stack>
        <Box sx={{ p: 2.5 }}>{children}</Box>
      </CardContent>
    </Card>
  );
}

export default function TourDetailPage() {
  const { packageId } = useParams<{ packageId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const id = Number(packageId);

  const { data: pkg, isLoading, isError, refetch } = useQuery<TourPackage>({
    queryKey: ["admin-tour-package", id],
    queryFn: () => tourService.getPackage(id),
    enabled: !!id,
  });

  const { data: bookings } = useQuery({
    queryKey: ["admin-tour-bookings", "by-package", id],
    queryFn: () => tourService.listBookings(),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (vars: { status: string; reason?: string }) => tourService.setPackageStatus(id, vars.status, vars.reason),
    onSuccess: (_, vars) => {
      enqueueSnackbar(`Package ${vars.status.toLowerCase().replace("_", " ")}`, { variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin-tour-package", id] });
      qc.invalidateQueries({ queryKey: ["admin-tour-packages"] });
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || "Status update failed", { variant: "error" }),
  });

  if (isLoading) return <Box sx={{ display: "grid", placeItems: "center", minHeight: 400 }}><CircularProgress /></Box>;
  if (isError || !pkg) return <Alert severity="error" sx={{ m: 3 }} action={<Button onClick={() => refetch()}>Retry</Button>}>Package not found.</Alert>;

  const status = STATUS_META[pkg.status] ?? STATUS_META.DRAFT;
  const startingPrice = pkg.pricing?.length ? Math.min(...pkg.pricing.map(x => x.package_price)) : 0;
  const primaryImage = pkg.media?.find(m => m.is_primary)?.media_url || pkg.media?.[0]?.media_url;
  const packageBookings = (bookings ?? []).filter(b => b.package_id === id);

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate("/tours")}>Back</Button>
        <Typography variant="caption" color="text.secondary">/ tours / {pkg.package_code}</Typography>
      </Stack>

      {/* Hero */}
      <Card variant="outlined" sx={{ borderRadius: 3, overflow: "hidden", mb: 3 }}>
        <Box sx={{ position: "relative", aspectRatio: "21/9", bgcolor: "grey.100" }}>
          {primaryImage ? (
            <img src={primaryImage} alt={pkg.package_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <Box sx={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)}, ${alpha(theme.palette.secondary.main, 0.1)})` }}>
              <TravelExplore sx={{ fontSize: 80, color: "text.disabled" }} />
            </Box>
          )}
          <Box sx={{ position: "absolute", top: 16, left: 16, display: "flex", gap: 1 }}>
            <Chip icon={status.icon} label={status.label} sx={{ fontWeight: 700, bgcolor: status.bg, color: status.color }} />
            <Chip label={pkg.package_type} color="primary" variant="outlined" sx={{ bgcolor: "rgba(255,255,255,0.9)", fontWeight: 700 }} />
          </Box>
        </Box>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "flex-start" }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h4" fontWeight={900}>{pkg.package_name}</Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 1 }} flexWrap="wrap">
                <Stack direction="row" spacing={0.5} alignItems="center"><LocationOn fontSize="small" color="action" /><Typography variant="body2">{pkg.destination} · {pkg.city_name}</Typography></Stack>
                <Stack direction="row" spacing={0.5} alignItems="center"><CalendarMonth fontSize="small" color="action" /><Typography variant="body2">{pkg.duration_days}D / {pkg.duration_nights}N</Typography></Stack>
                <Stack direction="row" spacing={0.5} alignItems="center"><People fontSize="small" color="action" /><Typography variant="body2">{pkg.minimum_persons}–{pkg.maximum_persons || "∞"} pax</Typography></Stack>
              </Stack>
              {pkg.short_description && <Typography sx={{ mt: 2, color: "text.secondary" }}>{pkg.short_description}</Typography>}
            </Box>
            <Box sx={{ minWidth: 240 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button startIcon={<Edit />} variant="outlined" onClick={() => navigate(`/tours?edit=${id}`)}>Edit</Button>
                {pkg.status === "PENDING_APPROVAL" && <Button color="success" variant="contained" onClick={() => statusMutation.mutate({ status: "APPROVED" })}>Approve</Button>}
                {pkg.status === "APPROVED" && <Button color="success" variant="contained" onClick={() => statusMutation.mutate({ status: "ACTIVE" })}>Activate</Button>}
                {pkg.status === "ACTIVE" && <Button color="warning" variant="outlined" onClick={() => statusMutation.mutate({ status: "SUSPENDED" })}>Suspend</Button>}
                {pkg.status === "REJECTED" && <Button variant="outlined" onClick={() => statusMutation.mutate({ status: "DRAFT" })}>Move to draft</Button>}
              </Stack>
              {startingPrice > 0 && (
                <Box sx={{ mt: 2, p: 2, bgcolor: "primary.50", borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>STARTING FROM</Typography>
                  <Typography variant="h4" fontWeight={900} color="primary.main">₹{startingPrice.toLocaleString("en-IN")}</Typography>
                  <Typography variant="caption" color="text.secondary">per package · {pkg.pricing.length} pricing slab{pkg.pricing.length === 1 ? "" : "s"}</Typography>
                </Box>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {pkg.status === "REJECTED" && pkg.rejection_reason && (
        <Alert severity="error" sx={{ mb: 3 }} icon={<Cancel />}><b>Rejection reason:</b> {pkg.rejection_reason}</Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          {/* Itinerary */}
          <SectionCard title={`Itinerary — ${pkg.itinerary.length} day${pkg.itinerary.length === 1 ? "" : "s"}`} icon={<ListAlt color="primary" />}>
            {pkg.itinerary.length === 0 ? (
              <Alert severity="info">No itinerary added yet.</Alert>
            ) : (
              <Stack spacing={2}>
                {pkg.itinerary.map(day => (
                  <Box key={day.id || day.day_number} sx={{ display: "flex", gap: 2 }}>
                    <Box sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: 2, bgcolor: "primary.main", color: "#fff", display: "grid", placeItems: "center", fontWeight: 900 }}>{day.day_number}</Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight={800}>{day.title}</Typography>
                      {day.description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{day.description}</Typography>}
                      {day.activities?.length > 0 && (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 1, gap: 0.5 }}>
                          {day.activities.map((a, i) => <Chip key={i} label={a} size="small" />)}
                        </Stack>
                      )}
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}
          </SectionCard>

          {/* Inclusions / Exclusions */}
          <Box sx={{ mt: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <SectionCard title={`Included (${pkg.inclusions.length})`} icon={<CheckCircle color="success" />}>
                  {pkg.inclusions.length === 0 ? <Alert severity="info">No inclusions.</Alert> : (
                    <Stack spacing={1}>
                      {pkg.inclusions.map((x, i) => (
                        <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                          <CheckCircle fontSize="small" color="success" sx={{ mt: 0.25 }} />
                          <Typography variant="body2">{x.text}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </SectionCard>
              </Grid>
              <Grid item xs={12} md={6}>
                <SectionCard title={`Not included (${pkg.exclusions.length})`} icon={<Cancel color="error" />}>
                  {pkg.exclusions.length === 0 ? <Alert severity="info">No exclusions.</Alert> : (
                    <Stack spacing={1}>
                      {pkg.exclusions.map((x, i) => (
                        <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                          <Box sx={{ width: 16, height: 16, mt: 0.5, borderRadius: "50%", bgcolor: "error.main", color: "#fff", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800 }}>×</Box>
                          <Typography variant="body2">{x.text}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </SectionCard>
              </Grid>
            </Grid>
          </Box>

          {/* Media gallery */}
          {pkg.media?.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <SectionCard title={`Media (${pkg.media.length})`} icon={<ImageIcon color="primary" />}>
                <ImageList cols={3} gap={8} sx={{ width: "100%", m: 0 }}>
                  {pkg.media.map((m, i) => (
                    <ImageListItem key={i} sx={{ position: "relative" }}>
                      <img src={m.media_url} alt={m.caption || `media ${i + 1}`} loading="lazy" style={{ aspectRatio: "4/3", objectFit: "cover", borderRadius: 8 }} />
                      {m.is_primary && <Chip label="Primary" size="small" color="primary" sx={{ position: "absolute", top: 8, left: 8 } as any} />}
                      {m.caption && (
                        <Box sx={{ position: "absolute", bottom: 0, left: 0, right: 0, bgcolor: "rgba(0,0,0,0.5)", color: "#fff", p: 0.5, fontSize: 11, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>{m.caption}</Box>
                      )}
                    </ImageListItem>
                  ))}
                </ImageList>
              </SectionCard>
            </Box>
          )}

          {/* Bookings for this package */}
          {packageBookings.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <SectionCard title={`Bookings (${packageBookings.length})`} icon={<ReceiptLong color="primary" />}
                action={<Button size="small" endIcon={<OpenInNew fontSize="small" />} onClick={() => navigate("/tours?tab=bookings")}>All bookings</Button>}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow><TableCell sx={{ fontWeight: 800 }}>Booking #</TableCell><TableCell sx={{ fontWeight: 800 }}>Customer</TableCell><TableCell sx={{ fontWeight: 800 }}>Travel</TableCell><TableCell sx={{ fontWeight: 800 }}>Pax</TableCell><TableCell sx={{ fontWeight: 800 }}>Amount</TableCell><TableCell align="right" /></TableRow>
                  </TableHead>
                  <TableBody>
                    {packageBookings.slice(0, 5).map(b => (
                      <TableRow key={b.id} hover>
                        <TableCell><Typography variant="body2" fontWeight={700} fontFamily="monospace">{b.booking_number}</Typography></TableCell>
                        <TableCell>{b.customer_name}</TableCell>
                        <TableCell>{b.travel_start_date} → {b.travel_end_date}</TableCell>
                        <TableCell>{b.persons_count}</TableCell>
                        <TableCell><b>₹{b.total_amount.toLocaleString("en-IN")}</b></TableCell>
                        <TableCell align="right">
                          <Button size="small" onClick={() => navigate(`/bookings/${b.master_booking_id}/tour/${b.id}`)}>Open</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SectionCard>
            </Box>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          <SectionCard title="Package info" icon={<Description color="primary" />}>
            <InfoRow label="Code" value={pkg.package_code} />
            <Divider />
            <InfoRow label="Partner" value={pkg.partner_name ? `${pkg.partner_name} (${pkg.partner_code})` : `Partner #${pkg.partner_id}`} icon={<Verified fontSize="small" />} />
            <Divider />
            <InfoRow label="Destination" value={pkg.destination} icon={<LocationOn fontSize="small" />} />
            <Divider />
            <InfoRow label="City" value={pkg.city_name} />
            <Divider />
            <InfoRow label="Duration" value={`${pkg.duration_days} days / ${pkg.duration_nights} nights`} icon={<AccessTime fontSize="small" />} />
            <Divider />
            <InfoRow label="Pax range" value={`${pkg.minimum_persons}–${pkg.maximum_persons || "Unlimited"}`} icon={<People fontSize="small" />} />
          </SectionCard>

          {/* Pricing slabs */}
          {pkg.pricing.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <SectionCard title="Pricing slabs" icon={<AttachMoney color="primary" />}>
                <Table size="small">
                  <TableHead>
                    <TableRow><TableCell sx={{ fontWeight: 800 }}>Pax</TableCell><TableCell sx={{ fontWeight: 800 }} align="right">Price</TableCell></TableRow>
                  </TableHead>
                  <TableBody>
                    {pkg.pricing.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>{p.persons_count} travellers</TableCell>
                        <TableCell align="right"><b>₹{p.package_price.toLocaleString("en-IN")}</b></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SectionCard>
            </Box>
          )}

          {/* T&C */}
          {pkg.terms_and_conditions && (
            <Box sx={{ mt: 3 }}>
              <SectionCard title="Terms & conditions" icon={<Description color="primary" />}>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{pkg.terms_and_conditions}</Typography>
              </SectionCard>
            </Box>
          )}

          {/* Audit */}
          <Box sx={{ mt: 3 }}>
            <SectionCard title="Audit trail" icon={<HistoryEdu color="primary" />}>
              <InfoRow label="Created" value={pkg.created_at ? format(new Date(pkg.created_at), "PP p") : "—"} />
              <Divider />
              <InfoRow label="Submitted" value={pkg.submitted_at ? format(new Date(pkg.submitted_at), "PP p") : "—"} />
              <Divider />
              <InfoRow label="Approved" value={pkg.approved_at ? format(new Date(pkg.approved_at), "PP p") : "—"} />
              <Divider />
              <InfoRow label="Activated" value={pkg.activated_at ? format(new Date(pkg.activated_at), "PP p") : "—"} />
            </SectionCard>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
