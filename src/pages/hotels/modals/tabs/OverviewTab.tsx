// ============================================================
// HOTEL DETAIL — OVERVIEW TAB
// Doc Ref: 03_FRONTEND_DESIGN.md §5 — read-only dashboard
// ============================================================
import React from "react";
import {
  Box, Grid, Card, CardContent, Typography, Stack, Divider,
  Chip, Alert, LinearProgress, alpha, useTheme, Tooltip,
} from "@mui/material";
import {
  CheckCircle, Cancel, HourglassEmpty, MeetingRoom, Image,
  Description, Star, TrendingUp, VerifiedUser,
} from "@mui/icons-material";
import { HotelDetail, ReadinessCheck } from "../../../../services/hotel.service";

interface Props {
  hotel: HotelDetail;
  isOfficer: boolean;
  onRefresh: () => void;
}

function StatTile({ label, value, icon, color = "primary.main" }: { label: string; value: string | number; icon: React.ReactNode; color?: string }) {
  const theme = useTheme();
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), borderRadius: 1.5, p: 1, color }}>
          {icon}
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={800}>{value}</Typography>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
        </Box>
      </Stack>
    </Card>
  );
}

function ReadinessItem({ check }: { check: ReadinessCheck }) {
  const color = check.passed ? "success.main" : check.blocks_submit ? "error.main" : "warning.main";
  const icon = check.passed ? <CheckCircle fontSize="small" /> : check.blocks_submit ? <Cancel fontSize="small" /> : <HourglassEmpty fontSize="small" />;
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ py: 0.75 }}>
      <Box sx={{ color, mt: 0.1, flexShrink: 0 }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600}>{check.label}</Typography>
        {!check.passed && check.hint && (
          <Typography variant="caption" color="text.secondary">{check.hint}</Typography>
        )}
      </Box>
      {check.blocks_approve && !check.passed && (
        <Chip label="Blocks approval" size="small" color="error" variant="outlined" sx={{ height: 18, fontSize: "0.6rem" }} />
      )}
    </Stack>
  );
}

export default function OverviewTab({ hotel, isOfficer, onRefresh }: Props) {
  const theme = useTheme();
  const readiness = hotel.readiness;
  const docs = hotel.documents ?? [];
  const images = hotel.images ?? [];
  const verifiedDocs = docs.filter(d => d.verification_status === "VERIFIED").length;

  // Commission source label
  const commissionSourceLabel: Record<string, string> = {
    HOTEL_OVERRIDE: "Hotel-specific override",
    CITY_RULE: "City-level rule",
    GLOBAL_RULE: "Global platform rule",
    SYSTEM_DEFAULT: "Platform default",
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Completeness banner */}
      {readiness && (
        <Card variant="outlined" sx={{ borderRadius: 2, mb: 3, bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
          <CardContent sx={{ pb: "12px !important" }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>Readiness</Typography>
              <Chip
                label={`${readiness.completeness_percent}% complete`}
                size="small"
                color={readiness.completeness_percent >= 80 ? "success" : readiness.completeness_percent >= 50 ? "warning" : "error"}
              />
              {readiness.can_submit && <Chip label="Ready to submit" size="small" color="success" variant="outlined" />}
            </Stack>
            <LinearProgress
              variant="determinate"
              value={readiness.completeness_percent}
              sx={{ height: 6, borderRadius: 3, mb: 2 }}
              color={readiness.completeness_percent >= 80 ? "success" : readiness.completeness_percent >= 50 ? "warning" : "error"}
            />
            <Stack spacing={0} divider={<Divider />}>
              {readiness.checks.map((c) => <ReadinessItem key={c.key} check={c} />)}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Stats grid */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4} md={2}>
          <StatTile label="Room Categories" value={hotel.total_rooms ?? 0} icon={<MeetingRoom fontSize="small" />} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatTile label="Total Rooms" value={hotel.total_rooms} icon={<MeetingRoom fontSize="small" />} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatTile label="Images" value={images.length} icon={<Image fontSize="small" />} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatTile label="Docs Verified" value={`${verifiedDocs}/${docs.length}`} icon={<Description fontSize="small" />} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatTile label="Star Rating" value={hotel.star_rating ? `${hotel.star_rating}★` : "—"} icon={<Star fontSize="small" />} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatTile label="Status" value={hotel.status} icon={<VerifiedUser fontSize="small" />} />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Commission card */}
        {!isOfficer && hotel.commission && (
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Effective Commission</Typography>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Type</Typography>
                    <Typography variant="body2" fontWeight={600}>{hotel.commission.commission_type}</Typography>
                  </Stack>
                  {hotel.commission.commission_percent > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Percentage</Typography>
                      <Typography variant="body2" fontWeight={600}>{hotel.commission.commission_percent}%</Typography>
                    </Stack>
                  )}
                  {hotel.commission.commission_flat > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Flat amount</Typography>
                      <Typography variant="body2" fontWeight={600}>₹{hotel.commission.commission_flat}</Typography>
                    </Stack>
                  )}
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Applies to</Typography>
                    <Typography variant="body2" fontWeight={600}>{hotel.commission.applies_to}</Typography>
                  </Stack>
                  <Divider />
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">Source</Typography>
                    <Chip
                      label={commissionSourceLabel[hotel.commission.source] ?? hotel.commission.source}
                      size="small"
                      variant="outlined"
                      color={hotel.commission.source === "HOTEL_OVERRIDE" ? "primary" : "default"}
                    />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Tax card */}
        {!isOfficer && (
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Tax Configuration</Typography>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Tax mode</Typography>
                    <Chip
                      label={hotel.tax_mode}
                      size="small"
                      color={hotel.tax_mode === "EXEMPT" ? "default" : "info"}
                      variant="outlined"
                    />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">GST registered</Typography>
                    <Typography variant="body2" fontWeight={600}>{hotel.is_gst_registered ? "Yes" : "No"}</Typography>
                  </Stack>
                  {hotel.gst_number && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">GST number</Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ fontFamily: "monospace" }}>{hotel.gst_number}</Typography>
                    </Stack>
                  )}
                  {!hotel.platform_gst_enabled && (
                    <Alert severity="info" sx={{ borderRadius: 1.5, mt: 1 }}>
                      Global GST is disabled — tax mode is inert until enabled in platform settings.
                    </Alert>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Officer assignment */}
        {hotel.assigned_officer && (
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Assigned Officer</Typography>
                <Stack spacing={0.5}>
                  <Typography variant="body2" fontWeight={600}>{hotel.assigned_officer.officer_name ?? "—"}</Typography>
                  <Typography variant="caption" color="text.secondary">{hotel.assigned_officer.officer_mobile ?? ""}</Typography>
                  {hotel.assigned_officer.notes && (
                    <Typography variant="caption" color="text.secondary">Notes: {hotel.assigned_officer.notes}</Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
