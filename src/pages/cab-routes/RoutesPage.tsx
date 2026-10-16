// ============================================================
// WAYTERO ADMIN — CAB ROUTES PAGE
// Backend: /admin/cab-routes (cab_route_api.py)
// Drives the "Popular Routes" homepage section and /cabs/routes pages.
// Prices are never stored here — the fare engine quotes each route live.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import {
  Box, Typography, Card, CardContent, Chip, Button, IconButton, Tooltip,
  Stack, Grid, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Paper, TextField, InputAdornment, MenuItem,
  CircularProgress, Alert, Switch, alpha, useTheme,
} from "@mui/material";
import {
  Add, Edit, Delete, Refresh, AltRoute, Search, ArrowForward,
  OpenInNew, Warning, CheckCircle,
} from "@mui/icons-material";
import { useSnackbar } from "notistack";

import { routeService, RouteListItem, DistanceSource } from "../../services/routes.service";
import RouteEditorDialog from "./RouteEditorDialog";
import { apiErrorMessage } from "../../utils/apiError";

const SOURCE_CHIP: Record<DistanceSource, { label: string; color: "success" | "warning" | "default" }> = {
  GOOGLE: { label: "Google", color: "success" },
  HAVERSINE: { label: "Estimated", color: "warning" },
  MANUAL: { label: "Manual", color: "default" },
};

export default function RoutesPage() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const [routes, setRoutes] = useState<RouteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"" | "true" | "false">("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params: { is_active?: boolean } = {};
      if (filterActive !== "") params.is_active = filterActive === "true";
      setRoutes(await routeService.list(params));
    } catch (e) {
      setLoadError(apiErrorMessage(e, "Failed to load routes"));
    } finally {
      setLoading(false);
    }
  }, [filterActive]);

  useEffect(() => { load(); }, [load]);

  const filtered = routes.filter(r => {
    if (!filterSearch) return true;
    const q = filterSearch.toLowerCase();
    return r.origin_label.toLowerCase().includes(q)
      || r.destination_label.toLowerCase().includes(q)
      || r.slug.includes(q);
  });

  async function toggleActive(r: RouteListItem) {
    try {
      await routeService.update(r.id, { is_active: !r.is_active });
      enqueueSnackbar(`Route ${r.is_active ? "hidden" : "published"}`, { variant: "success" });
      load();
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e, "Failed to update"), { variant: "error" });
    }
  }

  async function handleDelete(r: RouteListItem) {
    if (!window.confirm(`Delete route "${r.origin_label} → ${r.destination_label}"? Existing bookings are not affected.`)) return;
    try {
      await routeService.delete(r.id);
      enqueueSnackbar("Route deleted", { variant: "success" });
      load();
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e, "Delete failed"), { variant: "error" });
    }
  }

  const siteUrl = import.meta.env.VITE_SITE_URL ?? "http://localhost:3002";
  const needsCheck = routes.filter(r => r.distance_source === "HAVERSINE").length;
  const stats = [
    { label: "Total Routes", value: routes.length, color: "primary.main" as const },
    { label: "Live", value: routes.filter(r => r.is_active).length, color: "success.main" as const },
    { label: "Hidden", value: routes.filter(r => !r.is_active).length, color: "text.secondary" as const },
    { label: "Unverified distances", value: needsCheck, color: needsCheck ? ("error.main" as const) : ("text.secondary" as const) },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <AltRoute sx={{ color: "primary.main" }} /> Cab Routes
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Intercity corridors — the distance is stored, the fare always comes from the live pricing rules
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={load} disabled={loading}>Refresh</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => { setEditId(null); setEditorOpen(true); }} sx={{ fontWeight: 600 }}>
            New Route
          </Button>
        </Stack>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {stats.map(s => (
          <Grid item xs={6} sm={3} key={s.label}>
            <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, background: alpha(theme.palette.primary.main, 0.03) }}>
              <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
                <Typography variant="h4" fontWeight={800} color={s.color}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={500}>{s.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, mb: 2.5 }}>
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <TextField
              size="small" placeholder="Search origin, destination or slug…"
              value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
              sx={{ minWidth: 260 }}
            />
            <TextField select size="small" label="Visibility" value={filterActive} onChange={e => setFilterActive(e.target.value as any)} sx={{ minWidth: 140 }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Live</MenuItem>
              <MenuItem value="false">Hidden</MenuItem>
            </TextField>
            <Box flex={1} />
            <Typography variant="body2" color="text.secondary">{filtered.length} route{filtered.length !== 1 ? "s" : ""}</Typography>
          </Stack>
        </CardContent>
      </Card>

      {loadError && <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={load}>Retry</Button>}>{loadError}</Alert>}

      {/* Table */}
      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
        ) : filtered.length === 0 ? (
          <Box py={8} textAlign="center">
            <AltRoute sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
            <Typography color="text.secondary">No routes found</Typography>
            <Button variant="outlined" sx={{ mt: 2 }} startIcon={<Add />} onClick={() => { setEditId(null); setEditorOpen(true); }}>
              Create First Route
            </Button>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.04), borderBottom: "2px solid", borderColor: "divider" } }}>
                  <TableCell>Route</TableCell>
                  <TableCell align="right">Distance</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Fares from</TableCell>
                  <TableCell align="center">Vehicles</TableCell>
                  <TableCell align="center">Live</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id} hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Typography variant="body2" fontWeight={700}>{r.origin_label}</Typography>
                            <ArrowForward sx={{ fontSize: 14, color: "text.disabled" }} />
                            <Typography variant="body2" fontWeight={700}>{r.destination_label}</Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary" fontFamily="monospace">/cabs/routes/{r.slug}</Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600}>{Number(r.distance_km).toFixed(1)} km</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={SOURCE_CHIP[r.distance_source].label} color={SOURCE_CHIP[r.distance_source].color} variant="outlined" />
                      {r.distance_source === "HAVERSINE" && (
                        <Tooltip title="Straight-line estimate, not a routed distance — open the route and verify it">
                          <Warning fontSize="small" color="warning" sx={{ ml: 0.5, verticalAlign: "middle" }} />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell><Typography variant="body2">{r.pricing_city_name ?? "—"}</Typography></TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">{r.vehicle_count}</Typography>
                      {r.is_active && r.vehicle_count === 0 && (
                        <Tooltip title="Published with no vehicle types — the route page shows no prices">
                          <Warning fontSize="small" color="error" sx={{ verticalAlign: "middle" }} />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Switch size="small" checked={r.is_active} onChange={() => toggleActive(r)} color="success" />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="View on website">
                          <IconButton size="small" href={`${siteUrl}/cabs/routes/${r.slug}`} target="_blank" rel="noreferrer">
                            <OpenInNew fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => { setEditId(r.id); setEditorOpen(true); }}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDelete(r)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {routes.some(r => !r.is_active) && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 0.5 }}>
          <CheckCircle fontSize="small" /> Hidden routes stay editable and out of the website until you switch them live.
        </Typography>
      )}

      <RouteEditorDialog open={editorOpen} routeId={editId} onClose={() => setEditorOpen(false)} onSaved={load} />
    </Box>
  );
}
