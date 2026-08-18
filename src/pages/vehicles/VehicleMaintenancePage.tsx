// ============================================================
// WAYTERO ADMIN — VEHICLE MAINTENANCE PAGE
// Doc Ref: BRD Part 3 §133-138
//
// Route: /vehicles/maintenance
// Purpose: Fleet-wide service-desk dashboard — every vehicle whose next
// service is due in ≤ N days (or already overdue), with quick deep-link
// into the per-vehicle maintenance dialog.
// ============================================================

import { useState } from "react";
import {
  Box, Typography, Card, CardContent, Stack, Chip, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Skeleton, Alert, Button, ToggleButton, ToggleButtonGroup, useTheme, alpha,
} from "@mui/material";
import { Refresh, Warning, Build, OpenInNew, CheckCircle, EventAvailable } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";

import { vehicleMaintenanceService, DueMaintenanceItem } from "../../services/vehicleMaintenance.service";
import VehicleMaintenanceDialog from "./VehicleMaintenanceDialog";

const WINDOWS = [
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
];

export default function VehicleMaintenancePage() {
  const theme = useTheme();
  const [windowKey, setWindowKey] = useState("30");
  const days = WINDOWS.find((w) => w.key === windowKey)?.days ?? 30;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["vehicle-maintenance-due", days],
    queryFn: () => vehicleMaintenanceService.dueFleet(days, 200),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const [openVehicle, setOpenVehicle] = useState<{ id: number; label: string } | null>(null);

  const items: DueMaintenanceItem[] = data?.items ?? [];
  const overdueCount = items.filter((i) => i.is_overdue).length;
  const upcomingCount = items.length - overdueCount;

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{
            p: 1.5, borderRadius: 2,
            background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.18)}, ${alpha(theme.palette.error.main, 0.10)})`,
          }}>
            <Build sx={{ color: "warning.main", fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={800}>Vehicle Maintenance</Typography>
            <Typography variant="body2" color="text.secondary">
              Service desk — vehicles due in the next {days} day{windowKey === "1" ? "" : "s"}.
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Tooltip title="Refresh"><IconButton onClick={() => refetch()}><Refresh /></IconButton></Tooltip>
        </Stack>
      </Box>

      {/* KPI strip */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
        <Chip
          label={`${overdueCount} overdue`}
          color={overdueCount > 0 ? "error" : "default"}
          icon={<Warning />}
          sx={{ fontWeight: 700 }}
        />
        <Chip
          label={`${upcomingCount} upcoming`}
          color={upcomingCount > 0 ? "warning" : "default"}
          icon={<EventAvailable />}
          variant="outlined"
          sx={{ fontWeight: 700 }}
        />
        <Chip label={`Window: ${days}d`} variant="outlined" sx={{ fontWeight: 600 }} />
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <ToggleButtonGroup
          value={windowKey}
          exclusive
          size="small"
          onChange={(_, v) => v && setWindowKey(v)}
        >
          {WINDOWS.map((w) => (
            <ToggleButton key={w.key} value={w.key} sx={{ fontWeight: 600 }}>{w.label}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load maintenance feed.</Alert>}

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.warning.main, 0.05) }}>
                <TableCell sx={{ fontWeight: 700 }}>Vehicle</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Partner</TableCell>
                <TableCell sx={{ fontWeight: 700, display: { xs: "none", md: "table-cell" } }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Last service</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Next due</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Cost</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(7)].map((__, j) => (
                      <TableCell key={j}><Skeleton animation="wave" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Stack alignItems="center" spacing={1}>
                      <CheckCircle sx={{ fontSize: 40, color: "success.main" }} />
                      <Typography variant="body2" color="text.secondary">All clear — nothing due in this window.</Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : items.map((i) => (
                <TableRow key={i.vehicle_id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{i.registration_number}</Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ fontFamily: "monospace" }}>
                      {i.vehicle_code ?? `V${i.vehicle_id}`} · {i.category_name ?? "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{i.partner_name ?? "—"}</Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ fontFamily: "monospace" }}>
                      {i.partner_code ?? ""}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                    <Chip
                      label={(i.maintenance_type ?? "—").replace(/_/g, " ")}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {i.service_date ? format(parseISO(i.service_date), "dd MMM yyyy") : "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography variant="body2" fontWeight={600}>
                        {format(parseISO(i.next_due_date), "dd MMM yyyy")}
                      </Typography>
                      {i.is_overdue ? (
                        <Chip
                          label={`${Math.abs(i.days_until_due)}d overdue`}
                          size="small"
                          color="error"
                          icon={<Warning />}
                          sx={{ fontWeight: 700 }}
                        />
                      ) : i.days_until_due <= 7 ? (
                        <Chip label={`Due in ${i.days_until_due}d`} size="small" color="warning" sx={{ fontWeight: 700 }} />
                      ) : (
                        <Chip label={`Due in ${i.days_until_due}d`} size="small" variant="outlined" />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600}>
                      {i.cost != null ? `₹${i.cost.toLocaleString("en-IN")}` : "—"}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Open maintenance log">
                      <IconButton
                        size="small"
                        onClick={() =>
                          setOpenVehicle({
                            id: i.vehicle_id,
                            label: `${i.registration_number} · ${i.partner_name ?? ""}`,
                          })
                        }
                      >
                        <OpenInNew fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {openVehicle && (
        <VehicleMaintenanceDialog
          open={Boolean(openVehicle)}
          onClose={() => setOpenVehicle(null)}
          vehicleId={openVehicle.id}
          vehicleLabel={openVehicle.label}
        />
      )}
    </Box>
  );
}
