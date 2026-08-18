// ============================================================
// WAYTERO — TRIP DETAIL CARD
// Shows enriched booking detail inside the assist console
// ============================================================
import {
  Box, Grid, Typography, Chip, Divider, Stack, alpha, useTheme,
} from "@mui/material";
import {
  Person, DirectionsCar, Handshake, LocationOn, FiberManualRecord,
  AccessTime, Speed, Receipt, Phone,
} from "@mui/icons-material";
import { TripDetail } from "../../../services/tripAssistance.service";

interface Props { detail: TripDetail }

const STATUS_COLORS: Record<string, "default" | "warning" | "info" | "success" | "error"> = {
  PENDING_ASSIGNMENT: "warning",
  ASSIGNED: "info",
  DRIVER_ASSIGNED: "info",
  STARTED: "warning",
  COMPLETED: "success",
  SETTLEMENT_PENDING: "warning",
  SETTLED: "success",
  BREAKDOWN_REPORTED: "error",
  AWAITING_SWAP: "warning",
  CANCELLED: "error",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Typography
      variant="caption"
      fontWeight={700}
      color="text.secondary"
      sx={{ letterSpacing: 1, textTransform: "uppercase", mb: 0.5, display: "block" }}
    >
      {children}
    </Typography>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | number | null }) {
  const theme = useTheme();
  if (!value && value !== 0) return null;
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 1 }}>
      <Box sx={{ color: "primary.main", mt: 0.2, flexShrink: 0 }}>{icon}</Box>
      <Box>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="body2" fontWeight={600}>{value}</Typography>
      </Box>
    </Stack>
  );
}

export default function TripDetailCard({ detail }: Props) {
  const theme = useTheme();
  const statusColor = STATUS_COLORS[detail.cab_status] || "default";

  return (
    <Box
      sx={{
        borderRadius: 3,
        border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
        overflow: "hidden",
        bgcolor: "background.paper",
      }}
    >
      {/* Header Banner */}
      <Box
        sx={{
          px: 3, py: 2,
          background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <Box>
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.7), fontWeight: 600, letterSpacing: 1 }}>
              CAB BOOKING
            </Typography>
            <Typography variant="h6" fontWeight={800} color="white">
              {detail.cab_booking_number}
            </Typography>
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.7) }}>
              Master: {detail.booking_number}
            </Typography>
          </Box>
          <Chip
            label={detail.cab_status.replace(/_/g, " ")}
            color={statusColor}
            size="small"
            sx={{ fontWeight: 700, fontSize: "0.75rem" }}
          />
        </Stack>
      </Box>

      {/* Body */}
      <Box sx={{ p: 3 }}>
        <Grid container spacing={3}>

          {/* Customer */}
          <Grid item xs={12} sm={6} md={4}>
            <SectionLabel>Customer</SectionLabel>
            <InfoRow icon={<Person fontSize="small" />} label="Name" value={detail.customer_name} />
            <InfoRow icon={<Phone fontSize="small" />} label="Mobile" value={detail.customer_mobile} />
            <InfoRow icon={<LocationOn fontSize="small" />} label="City" value={detail.city_name} />
          </Grid>

          {/* Assignment */}
          <Grid item xs={12} sm={6} md={4}>
            <SectionLabel>Assignment</SectionLabel>
            <InfoRow icon={<Handshake fontSize="small" />} label="Partner" value={detail.partner_name} />
            <InfoRow icon={<Phone fontSize="small" />} label="Partner Mobile" value={detail.partner_mobile} />
            <InfoRow icon={<Person fontSize="small" />} label="Driver" value={detail.driver_name} />
            <InfoRow icon={<Phone fontSize="small" />} label="Driver Mobile" value={detail.driver_mobile} />
            <InfoRow icon={<DirectionsCar fontSize="small" />} label="Vehicle" value={
              detail.vehicle_reg ? `${detail.vehicle_reg}${detail.vehicle_model ? " · " + detail.vehicle_model : ""}` : undefined
            } />
          </Grid>

          {/* Trip Route */}
          <Grid item xs={12} sm={6} md={4}>
            <SectionLabel>Route</SectionLabel>
            <InfoRow icon={<FiberManualRecord fontSize="small" sx={{ color: "success.main" }} />} label="Pickup" value={detail.pickup_location} />
            <InfoRow icon={<LocationOn fontSize="small" sx={{ color: "error.main" }} />} label="Drop" value={detail.drop_location} />
            <InfoRow icon={<AccessTime fontSize="small" />} label="Pickup Time" value={
              detail.pickup_datetime ? new Date(detail.pickup_datetime).toLocaleString("en-IN") : undefined
            } />
            <InfoRow icon={<Speed fontSize="small" />} label="Est. Distance" value={
              detail.estimated_distance ? `${detail.estimated_distance} km` : undefined
            } />
          </Grid>

          {/* Trip KMs */}
          {(detail.trip_start_km || detail.trip_end_km) && (
            <Grid item xs={12}>
              <Divider sx={{ mb: 2 }} />
              <SectionLabel>Trip Odometer</SectionLabel>
              <Stack direction="row" spacing={4} flexWrap="wrap">
                {detail.trip_start_km !== null && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Start KM</Typography>
                    <Typography variant="h6" fontWeight={700} color="primary.main">{detail.trip_start_km?.toLocaleString()}</Typography>
                    {detail.trip_started_at && (
                      <Typography variant="caption" color="text.secondary">
                        {new Date(detail.trip_started_at).toLocaleString("en-IN")}
                      </Typography>
                    )}
                  </Box>
                )}
                {detail.trip_end_km !== null && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">End KM</Typography>
                    <Typography variant="h6" fontWeight={700} color="error.main">{detail.trip_end_km?.toLocaleString()}</Typography>
                    {detail.trip_ended_at && (
                      <Typography variant="caption" color="text.secondary">
                        {new Date(detail.trip_ended_at).toLocaleString("en-IN")}
                      </Typography>
                    )}
                  </Box>
                )}
                {detail.actual_distance !== null && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Actual Distance</Typography>
                    <Typography variant="h6" fontWeight={700}>{detail.actual_distance} km</Typography>
                  </Box>
                )}
              </Stack>
            </Grid>
          )}

          {/* Billing */}
          {(detail.estimated_amount || detail.final_amount) && (
            <Grid item xs={12}>
              <Divider sx={{ mb: 2 }} />
              <SectionLabel>Billing</SectionLabel>
              <Stack direction="row" spacing={4} flexWrap="wrap">
                {detail.estimated_amount !== null && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Estimated</Typography>
                    <Typography variant="h6" fontWeight={700}>₹{detail.estimated_amount?.toLocaleString()}</Typography>
                  </Box>
                )}
                {detail.final_amount !== null && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {detail.is_tax_invoice ? "Fare (excl. GST)" : "Final Amount"}
                    </Typography>
                    <Typography variant="h5" fontWeight={800} color="success.main">₹{detail.final_amount?.toLocaleString()}</Typography>
                  </Box>
                )}
                {detail.is_tax_invoice && (detail.gst_amount ?? 0) > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">GST ({detail.gst_rate ?? 0}%)</Typography>
                    <Typography variant="h6" fontWeight={700} color="warning.dark">
                      + ₹{(detail.gst_amount ?? 0).toLocaleString()}
                    </Typography>
                  </Box>
                )}
                {detail.is_tax_invoice && (detail.gst_amount ?? 0) > 0 && detail.final_amount !== null && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Total (incl. GST)</Typography>
                    <Typography variant="h5" fontWeight={900} color="success.dark">
                      ₹{(detail.final_amount + (detail.gst_amount ?? 0)).toLocaleString()}
                    </Typography>
                  </Box>
                )}
                {detail.platform_commission !== null && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Platform Commission</Typography>
                    <Typography variant="h6" fontWeight={700} color="warning.main">₹{detail.platform_commission?.toLocaleString()}</Typography>
                  </Box>
                )}
                {detail.partner_payout !== null && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Partner Payout</Typography>
                    <Typography variant="h6" fontWeight={700} color="primary.main">₹{detail.partner_payout?.toLocaleString()}</Typography>
                  </Box>
                )}
              </Stack>
            </Grid>
          )}

          {/* Payment & Invoice */}
          {(detail.payment_mode || detail.invoice_number) && (
            <Grid item xs={12}>
              <Divider sx={{ mb: 2 }} />
              <SectionLabel>Payment & Invoice</SectionLabel>
              <Stack direction="row" spacing={3} flexWrap="wrap" gap={1}>
                {detail.payment_mode && (
                  <Chip
                    label={`Mode: ${detail.payment_mode}`}
                    color="info" size="small" variant="outlined" sx={{ fontWeight: 700 }}
                  />
                )}
                {detail.payment_collected_by && (
                  <Chip
                    label={`Collected by: ${detail.payment_collected_by}`}
                    color="default" size="small" variant="outlined" sx={{ fontWeight: 700 }}
                  />
                )}
                {detail.cash_pending_at && detail.cash_pending_at !== "NONE" && (
                  <Chip
                    icon={<Receipt fontSize="small" />}
                    label={`Cash pending at: ${detail.cash_pending_at}`}
                    color="warning" size="small" sx={{ fontWeight: 700 }}
                  />
                )}
                {detail.invoice_number && (
                  <Chip
                    icon={<Receipt fontSize="small" />}
                    label={`Invoice: ${detail.invoice_number}`}
                    color="success" size="small" sx={{ fontWeight: 700 }}
                  />
                )}
                {detail.is_tax_invoice ? (
                  <Chip label="Tax Invoice" color="warning" size="small" sx={{ fontWeight: 700 }} />
                ) : detail.invoice_number ? (
                  <Chip label="Non-Tax Receipt" color="default" size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                ) : null}
              </Stack>
            </Grid>
          )}

        </Grid>
      </Box>
    </Box>
  );
}
