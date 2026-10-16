// ============================================================
// WAYTERO ADMIN — CAB ROUTE EDITOR DIALOG
// Backend: /admin/cab-routes (cab_route_api.py)
// A route is endpoints + distance only. Distance comes from Google Maps
// (with a haversine fallback the admin must verify) or from a typed value,
// which then sticks as MANUAL.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import {
  Box, Typography, Stack, Chip, Button, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, FormControl, InputLabel, Select,
  Checkbox, FormControlLabel, Switch, CircularProgress,
  Alert, Divider, useTheme,
} from "@mui/material";
import { Close, AltRoute, Public, Warning, TravelExplore } from "@mui/icons-material";
import { useSnackbar } from "notistack";

import MediaUploader, { CropSpec } from "../cms/components/MediaUploader";
import {
  routeService, RouteDetail, RouteSavePayload, DistanceSource,
} from "../../services/routes.service";
import { settingsService, City, VehicleCategory } from "../../services/settings.service";
import { apiErrorMessage } from "../../utils/apiError";

// Route cards on the website are wide — keep uploads at 16:9 so nothing crops.
const ROUTE_IMAGE_CROP: CropSpec = {
  aspectRatio: 16 / 9,
  outputWidth: 1280,
  outputHeight: 720,
  format: "image/webp",
};

const SOURCE_LABEL: Record<DistanceSource, { text: string; color: "success" | "warning" | "default" }> = {
  GOOGLE: { text: "Google Maps", color: "success" },
  HAVERSINE: { text: "Estimated", color: "warning" },
  MANUAL: { text: "Entered manually", color: "default" },
};

interface Props {
  open: boolean;
  routeId: number | null; // null = create
  onClose: () => void;
  onSaved: () => void;
}

export default function RouteEditorDialog({ open, routeId, onClose, onSaved }: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const isEdit = routeId != null;

  const [originLabel, setOriginLabel] = useState("");
  const [destinationLabel, setDestinationLabel] = useState("");
  const [originCityId, setOriginCityId] = useState<number | null>(null);
  const [destinationCityId, setDestinationCityId] = useState<number | null>(null);
  const [pricingCityId, setPricingCityId] = useState<number | null>(null);
  const [distance, setDistance] = useState("");
  const [distanceSource, setDistanceSource] = useState<DistanceSource | null>(null);
  const [description, setDescription] = useState("");
  const [terms, setTerms] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);
  const [vehicleIds, setVehicleIds] = useState<number[]>([]);

  const [cities, setCities] = useState<City[]>([]);
  const [vehicleCategories, setVehicleCategories] = useState<VehicleCategory[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // The label pair the current distance was computed for; a mismatch means the
  // number on screen no longer describes the corridor being saved.
  const [distanceForLabels, setDistanceForLabels] = useState<[string, string] | null>(null);

  // ── Master data once per open ── (city/vehicle lists are Object.assign'd at runtime)
  useEffect(() => {
    if (!open) return;
    (settingsService as any).getCities(true).then(setCities).catch(() => {});
    (settingsService as any).getVehicleCategories(true).then(setVehicleCategories).catch(() => {});
  }, [open]);

  // ── Existing route ──
  useEffect(() => {
    if (!open || routeId == null) return;
    setLoadingDetail(true);
    routeService.get(routeId)
      .then((r: RouteDetail) => {
        setOriginLabel(r.origin_label);
        setDestinationLabel(r.destination_label);
        setOriginCityId(r.origin_city_id);
        setDestinationCityId(r.destination_city_id);
        setPricingCityId(r.pricing_city_id);
        setDistance(String(r.distance_km));
        setDistanceSource(r.distance_source);
        setDistanceForLabels([r.origin_label, r.destination_label]);
        setDescription(r.description ?? "");
        setTerms(r.terms_and_conditions ?? "");
        setImageUrl(r.image_url);
        setIsActive(r.is_active);
        setSortOrder(r.sort_order);
        setVehicleIds(r.vehicle_category_ids);
      })
      .catch((e) => enqueueSnackbar(apiErrorMessage(e, "Failed to load route"), { variant: "error" }))
      .finally(() => setLoadingDetail(false));
  }, [open, routeId, enqueueSnackbar]);

  useEffect(() => {
    if (open) return;
    setFormError(null);
    setFetching(false);
  }, [open]);

  const labelsChanged = useMemo(() => {
    if (!distance || distanceForLabels == null) return false;
    return distanceForLabels[0] !== originLabel.trim() || distanceForLabels[1] !== destinationLabel.trim();
  }, [distance, distanceForLabels, originLabel, destinationLabel]);

  const pricingCityName = useMemo(
    () => cities.find((c) => c.id === pricingCityId)?.name ?? null,
    [cities, pricingCityId],
  );

  const canFetch = originLabel.trim().length > 0
    && destinationLabel.trim().length > 0
    && originLabel.trim().toLowerCase() !== destinationLabel.trim().toLowerCase();

  function toggleVehicle(id: number) {
    setVehicleIds((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  }

  async function handleFetchDistance() {
    if (!canFetch || fetching) return;
    setFetching(true);
    try {
      const r = await routeService.fetchDistance({
        origin_label: originLabel.trim(),
        destination_label: destinationLabel.trim(),
        origin_city_id: originCityId,
        destination_city_id: destinationCityId,
      });
      setDistance(String(r.distance_km));
      setDistanceSource(r.distance_source);
      setDistanceForLabels([originLabel.trim(), destinationLabel.trim()]);
      if (r.distance_source === "HAVERSINE") {
        enqueueSnackbar("Distance estimated by fallback — please verify it", { variant: "warning" });
      } else {
        enqueueSnackbar(`Distance from Google Maps: ${r.distance_km} km`, { variant: "success" });
      }
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e, "Could not determine the distance"), { variant: "error" });
    } finally {
      setFetching(false);
    }
  }

  function validate(): string | null {
    const o = originLabel.trim();
    const d = destinationLabel.trim();
    if (!o || !d) return "Origin and destination are both required";
    if (o.toLowerCase() === d.toLowerCase()) return "Origin and destination must be different places";
    const km = Number(distance);
    if (!distance || !Number.isFinite(km) || km <= 0) return "Distance must be a positive number of km";
    if (km > 5000) return "Distance cannot exceed 5000 km";
    if (isActive) {
      if (!vehicleIds.length) return "Select at least one vehicle type before publishing";
      if (!terms.trim()) return "Terms & conditions are required before publishing";
    }
    return null;
  }

  async function handleSave() {
    const problem = validate();
    if (problem) { setFormError(problem); return; }
    setFormError(null);
    setSaving(true);
    try {
      const payload: RouteSavePayload = {
        origin_label: originLabel.trim(),
        destination_label: destinationLabel.trim(),
        origin_city_id: originCityId,
        destination_city_id: destinationCityId,
        pricing_city_id: pricingCityId,
        distance_km: Number(distance),
        description,
        terms_and_conditions: terms,
        image_url: imageUrl,
        is_active: isActive,
        sort_order: sortOrder,
        vehicle_category_ids: vehicleIds,
      };
      if (isEdit) await routeService.update(routeId!, payload);
      else await routeService.create(payload);
      enqueueSnackbar(isEdit ? "Route updated" : "Route created", { variant: "success" });
      onSaved();
      onClose();
    } catch (e) {
      setFormError(apiErrorMessage(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  const siteUrl = import.meta.env.VITE_SITE_URL ?? "http://localhost:3002";

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 0, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AltRoute sx={{ color: "primary.main", fontSize: 22, verticalAlign: "middle" }} />
          {isEdit ? "Edit Route" : "Create Route"}
        </Stack>
        <IconButton size="small" onClick={onClose} disabled={saving}><Close /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: "16px !important" }}>
        {loadingDetail ? (
          <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
        ) : (
          <Stack spacing={2.5}>
            {formError && <Alert severity="error" onClose={() => setFormError(null)}>{formError}</Alert>}

            {/* ── Endpoints ── */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Origin *" value={originLabel} onChange={(e) => setOriginLabel(e.target.value)}
                fullWidth size="small" helperText="Town or area as customers should read it" />
              <TextField label="Destination *" value={destinationLabel} onChange={(e) => setDestinationLabel(e.target.value)}
                fullWidth size="small" />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Names are free text, so a route can cover a town that has no city record yet. Linking a city is optional and only sharpens the
              Google Maps lookup and the fare rules.
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>Origin city</InputLabel>
                <Select value={originCityId ?? ""} label="Origin city" onChange={(e) => setOriginCityId(Number(e.target.value) || null)}>
                  <MenuItem value="">None</MenuItem>
                  {cities.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>Destination city</InputLabel>
                <Select value={destinationCityId ?? ""} label="Destination city" onChange={(e) => setDestinationCityId(Number(e.target.value) || null)}>
                  <MenuItem value="">None</MenuItem>
                  {cities.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>

            {/* ── Distance ── */}
            <Divider />
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.75 }}>
                <TravelExplore fontSize="small" color="primary" /> Distance
              </Typography>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <TextField
                  label="Distance (km) *" value={distance} onChange={(e) => setDistance(e.target.value)}
                  size="small" type="number" slotProps={{ htmlInput: { step: "0.1", min: 0.1, max: 5000 } }}
                  sx={{ width: 160 }}
                />
                <Button variant="outlined" size="small" onClick={handleFetchDistance} disabled={!canFetch || fetching}
                  startIcon={fetching ? <CircularProgress size={16} /> : <Public />}>
                  {fetching ? "Checking…" : "Fetch distance"}
                </Button>
                {distanceSource && (
                  <Chip size="small" label={SOURCE_LABEL[distanceSource].text}
                    color={SOURCE_LABEL[distanceSource].color} variant="outlined" sx={{ mt: 0.5 }} />
                )}
              </Stack>
              {!distance && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Fetch it, or type the road distance yourself. A typed value is kept as-is even when the names change later.
                </Typography>
              )}
              {distanceSource === "HAVERSINE" && (
                <Alert severity="warning" sx={{ mt: 1.5 }} icon={<Warning fontSize="small" />}>
                  Google could not route this pair, so the distance was estimated from a straight line. Verify it before publishing.
                </Alert>
              )}
              {labelsChanged && distanceSource !== "MANUAL" && (
                <Alert severity="info" sx={{ mt: 1.5 }}>
                  You renamed an endpoint after this distance was resolved — fetch it again, or saving re-checks it automatically.
                </Alert>
              )}
            </Box>

            {/* ── Fare rules ── */}
            <FormControl size="small" fullWidth sx={{ maxWidth: 360 }}>
              <InputLabel>Pricing city</InputLabel>
              <Select value={pricingCityId ?? ""} label="Pricing city" onChange={(e) => setPricingCityId(Number(e.target.value) || null)}>
                <MenuItem value="">Auto</MenuItem>
                {cities.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary">
              The route is quoted against one city's fare rules, and the price the customer sees here is the price the booking flow charges.
              {" "}Auto uses an endpoint city when there is one, otherwise the city with the most rules
              {pricingCityName ? ` — currently ${pricingCityName}` : ""}.
            </Typography>

            {/* ── Vehicles ── */}
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                Vehicle types {isActive ? "*" : ""}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Only these appear on the route page, each priced live from the fare engine.
              </Typography>
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5}>
                {vehicleCategories.map((c) => (
                  <FormControlLabel
                    key={c.id}
                    sx={{ m: 0, px: 1, py: 0.25, borderRadius: 1, border: "1px solid", borderColor: "divider" }}
                    control={
                      <Checkbox size="small" checked={vehicleIds.includes(c.id)}
                        onChange={() => toggleVehicle(c.id)} />
                    }
                    label={
                      <Tooltip title={c.slug ? `/${c.slug}` : ""}>
                        <Typography variant="body2">
                          {c.category_name}
                          <Box component="span" color="text.secondary" fontSize={11} sx={{ ml: 0.75 }}>
                            {c.seating_capacity ? `${c.seating_capacity} seats` : ""}
                          </Box>
                        </Typography>
                      </Tooltip>
                    }
                  />
                ))}
                {vehicleCategories.length === 0 && (
                  <Typography variant="body2" color="text.secondary">No active vehicle categories — add them under Vehicles first.</Typography>
                )}
              </Stack>
            </Box>

            {/* ── Copy ── */}
            <Divider />
            <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)}
              multiline minRows={3} size="small"
              helperText="Shown on the route page. State what the trip covers — no invented claims." />
            <TextField label="Terms & conditions" value={terms} onChange={(e) => setTerms(e.target.value)}
              multiline minRows={4} size="small"
              helperText="Required before publishing. Waiting time, tolls, parking and permits are not in the estimate." />

            <MediaUploader value={imageUrl} onChange={setImageUrl} folder="waytero/routes" kind="image"
              label="Route image" hint="Wide card art for the route page and listing. Optional."
              crop={ROUTE_IMAGE_CROP} previewHeight={180} />
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" mr="auto">
          <FormControlLabel
            control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} color="success" />}
            label="Visible on website" />
          <TextField label="Sort" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            type="number" size="small" sx={{ width: 90 }}
            slotProps={{ htmlInput: { type: "number" } }} />
          {isEdit && (
            <Tooltip title="View on website">
              <IconButton size="small" href={`${siteUrl}/cabs/routes`} target="_blank" rel="noreferrer">
                <Public fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || loadingDetail}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          sx={{ fontWeight: 600, bgcolor: theme.palette.primary.main }}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create route"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
