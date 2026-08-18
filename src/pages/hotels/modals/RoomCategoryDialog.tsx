// ============================================================
// WAYTERO ADMIN — ROOM CATEGORY DIALOG
// Doc Ref: 03_FRONTEND_DESIGN.md §6 "RoomCategoryDialog"
// Create/edit: Identity → Occupancy → Attributes → Pricing → Inventory → Amenities → Images
// ============================================================

import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, Grid, FormControlLabel, Switch,
  Select, MenuItem, FormControl, InputLabel, Typography,
  CircularProgress, Divider, Alert, Chip, Box,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { useQuery } from "@tanstack/react-query";

import hotelService, { RoomCategory, HotelAmenity } from "../../../services/hotel.service";
import { HOTEL_QUERY_KEYS, ROOM_TYPE_LABELS, BED_TYPE_LABELS, VIEW_TYPE_LABELS, numOr, numOrNull, strOrUndef } from "../constants";
import { apiErrorMessage } from "../../../utils/apiError";

interface Props {
  open: boolean;
  hotelId: number;
  category?: RoomCategory;
  onClose: () => void;
  onSaved: () => void;
}

const MEAL_PLANS = ["EP", "CP", "MAP", "AP"];

const INITIAL = {
  category_name: "", room_type: "", description: "",
  base_occupancy: 2, max_adults: 2, max_children: 0, max_occupancy: 2,
  extra_bed_allowed: false, extra_bed_charge: 0, extra_adult_charge: 0, extra_child_charge: 0,
  bed_type: "", room_size_sqft: "", view_type: "", floor_range: "",
  base_price: "", published_price: "", min_sellable_price: "",
  meal_plan: "EP", is_refundable: true, total_rooms: 1,
  display_order: 0, is_active: true,
};

export default function RoomCategoryDialog({ open, hotelId, category, onClose, onSaved }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>(INITIAL);
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<number[]>([]);
  const [validErr, setValidErr] = useState<string | null>(null);

  const { data: amenities = [] } = useQuery<HotelAmenity[]>({
    queryKey: [HOTEL_QUERY_KEYS.amenities],
    queryFn: () => hotelService.listAmenities(),
    staleTime: 5 * 60_000,
  });

  const amenityGroups = amenities.reduce((acc, a) => {
    const g = a.amenity_group ?? "Other";
    if (!acc[g]) acc[g] = [];
    acc[g].push(a);
    return acc;
  }, {} as Record<string, HotelAmenity[]>);

  useEffect(() => {
    if (category) {
      setForm({
        category_name: category.category_name,
        room_type: category.room_type ?? "",
        description: category.description ?? "",
        base_occupancy: category.base_occupancy,
        max_adults: category.max_adults,
        max_children: category.max_children,
        max_occupancy: category.max_occupancy,
        extra_bed_allowed: category.extra_bed_allowed,
        extra_bed_charge: category.extra_bed_charge,
        extra_adult_charge: category.extra_adult_charge,
        extra_child_charge: category.extra_child_charge,
        bed_type: category.bed_type ?? "",
        room_size_sqft: category.room_size_sqft ?? "",
        view_type: category.view_type ?? "",
        floor_range: category.floor_range ?? "",
        base_price: category.base_price,
        published_price: category.published_price ?? "",
        min_sellable_price: category.min_sellable_price ?? "",
        meal_plan: category.meal_plan,
        is_refundable: category.is_refundable,
        total_rooms: category.total_rooms,
        display_order: category.display_order,
        is_active: category.is_active,
      });
      setSelectedAmenityIds(category.amenity_ids);
    } else {
      setForm(INITIAL);
      setSelectedAmenityIds([]);
    }
    setValidErr(null);
  }, [category, open]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  // Mirrors the server's validators (hotel/validators: validate_occupancy,
  // validate_price_structure) so the admin sees the failure inline instead of
  // as a round-trip 422.
  const validate = (): string | null => {
    if (!form.category_name.trim()) return "Category name is required.";

    const baseOcc = numOr(form.base_occupancy, 2);
    const maxAdults = numOr(form.max_adults, 2);
    const maxChildren = numOr(form.max_children, 0);
    const maxOcc = numOr(form.max_occupancy, 2);

    if (baseOcc < 1) return "Base occupancy must be at least 1.";
    if (maxAdults < 1) return "A room must allow at least one adult.";
    if (maxChildren < 0) return "Maximum children cannot be negative.";
    if (maxOcc < baseOcc) return "Maximum occupancy cannot be less than base occupancy.";
    // Server rule: adults + children must COVER max occupancy, not the reverse.
    if (maxAdults + maxChildren < maxOcc)
      return "Max adults + max children must be at least the max occupancy.";

    const basePrice = numOr(form.base_price, 0);
    const published = numOrNull(form.published_price);
    const minSellable = numOrNull(form.min_sellable_price);

    if (basePrice <= 0) return "Base price must be greater than 0.";
    if (published !== null && published < basePrice)
      return "Published price cannot be lower than the base price.";
    if (minSellable !== null && minSellable > basePrice)
      return "Min sellable price cannot exceed base price.";
    if (numOr(form.total_rooms, 0) < 0) return "Total rooms cannot be negative.";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setValidErr(err); return; }
    setSaving(true);
    try {
      // Numeric fields come off MUI TextField as strings, and an emptied one is
      // "" — which Pydantic rejects with a 422 rather than treating as absent.
      // Required-with-default fields fall back to the server's default; optional
      // ones go as null so clearing them actually clears them.
      const payload = {
        category_name: form.category_name.trim(),
        room_type: strOrUndef(form.room_type),
        description: strOrUndef(form.description),

        base_occupancy: numOr(form.base_occupancy, 2),
        max_adults: numOr(form.max_adults, 2),
        max_children: numOr(form.max_children, 0),
        max_occupancy: numOr(form.max_occupancy, 2),
        extra_bed_allowed: !!form.extra_bed_allowed,
        extra_bed_charge: numOr(form.extra_bed_charge, 0),
        extra_adult_charge: numOr(form.extra_adult_charge, 0),
        extra_child_charge: numOr(form.extra_child_charge, 0),

        bed_type: strOrUndef(form.bed_type),
        room_size_sqft: numOrNull(form.room_size_sqft),
        view_type: strOrUndef(form.view_type),
        floor_range: strOrUndef(form.floor_range),

        base_price: numOr(form.base_price, 0),
        published_price: numOrNull(form.published_price),
        min_sellable_price: numOrNull(form.min_sellable_price),
        meal_plan: form.meal_plan || "EP",
        is_refundable: !!form.is_refundable,

        total_rooms: numOr(form.total_rooms, 0),
        display_order: numOr(form.display_order, 0),
        amenity_ids: selectedAmenityIds,
      };
      if (category) {
        // is_active is only on the update schema — sending it on create is dropped.
        await hotelService.updateRoomCategory(hotelId, category.id, {
          ...payload,
          is_active: !!form.is_active,
        });
        enqueueSnackbar("Room category updated", { variant: "success" });
      } else {
        await hotelService.createRoomCategory(hotelId, payload);
        enqueueSnackbar("Room category created — inventory materialised across 365 days", { variant: "success" });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      enqueueSnackbar(apiErrorMessage(e, "Save failed"), { variant: "error" });
    } finally { setSaving(false); }
  };

  const tf = (label: string, key: string, extra: Record<string, any> = {}) => (
    <TextField
      label={label}
      value={form[key] ?? ""}
      onChange={(e) => set(key, e.target.value)}
      size="small"
      fullWidth
      {...extra}
    />
  );

  const toggleAmenity = (id: number) => {
    setSelectedAmenityIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {category ? "Edit Room Category" : "Add Room Category"}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {validErr && <Alert severity="warning">{validErr}</Alert>}

          {/* Identity */}
          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Identity</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>{tf("Category name *", "category_name")}</Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Room type</InputLabel>
                  <Select value={form.room_type} label="Room type" onChange={(e) => set("room_type", e.target.value)}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {Object.entries(ROOM_TYPE_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>{tf("Description", "description", { multiline: true, rows: 2 })}</Grid>
            </Grid>
          </Box>

          <Divider />

          {/* Occupancy */}
          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Occupancy</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>{tf("Base occupancy", "base_occupancy", { type: "number" })}</Grid>
              <Grid item xs={6} sm={3}>{tf("Max adults", "max_adults", { type: "number" })}</Grid>
              <Grid item xs={6} sm={3}>{tf("Max children", "max_children", { type: "number" })}</Grid>
              <Grid item xs={6} sm={3}>{tf("Max occupancy", "max_occupancy", { type: "number" })}</Grid>
              <Grid item xs={12} sm={4}>
                <FormControlLabel
                  control={<Switch checked={!!form.extra_bed_allowed} onChange={(e) => set("extra_bed_allowed", e.target.checked)} />}
                  label="Extra bed allowed"
                />
              </Grid>
              {/* Extra adult/child are charged on occupancy over base_occupancy
                  regardless of beds, so they always show. Extra bed charge only
                  applies when the room actually offers an extra bed. */}
              <Grid item xs={6} sm={4}>{tf("Extra adult charge (₹/night)", "extra_adult_charge", { type: "number" })}</Grid>
              <Grid item xs={6} sm={4}>{tf("Extra child charge (₹/night)", "extra_child_charge", { type: "number" })}</Grid>
              {form.extra_bed_allowed && (
                <Grid item xs={6} sm={4}>{tf("Extra bed charge (₹/stay)", "extra_bed_charge", { type: "number" })}</Grid>
              )}
            </Grid>
          </Box>

          <Divider />

          {/* Attributes */}
          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Attributes</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Bed type</InputLabel>
                  <Select value={form.bed_type} label="Bed type" onChange={(e) => set("bed_type", e.target.value)}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {Object.entries(BED_TYPE_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl size="small" fullWidth>
                  <InputLabel>View type</InputLabel>
                  <Select value={form.view_type} label="View type" onChange={(e) => set("view_type", e.target.value)}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {Object.entries(VIEW_TYPE_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={4}>{tf("Room size (sqft)", "room_size_sqft", { type: "number" })}</Grid>
              <Grid item xs={6}>{tf("Floor range", "floor_range", { placeholder: "e.g. 2-5" })}</Grid>
            </Grid>
          </Box>

          <Divider />

          {/* Pricing */}
          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Pricing</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>{tf("Base price (₹) *", "base_price", { type: "number" })}</Grid>
              <Grid item xs={12} sm={4}>{tf("Published price (₹)", "published_price", { type: "number", helperText: "Strikethrough price" })}</Grid>
              <Grid item xs={12} sm={4}>{tf("Min sellable (₹)", "min_sellable_price", { type: "number", helperText: "Rate plan floor" })}</Grid>
              <Grid item xs={6} sm={4}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Meal plan</InputLabel>
                  <Select value={form.meal_plan} label="Meal plan" onChange={(e) => set("meal_plan", e.target.value)}>
                    {MEAL_PLANS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={4}>
                <FormControlLabel
                  control={<Switch checked={!!form.is_refundable} onChange={(e) => set("is_refundable", e.target.checked)} />}
                  label="Refundable"
                />
              </Grid>
            </Grid>
          </Box>

          <Divider />

          {/* Inventory */}
          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Inventory</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={4}>
                {tf("Total rooms *", "total_rooms", {
                  type: "number",
                  helperText: "Saving materialises inventory across 365 days",
                })}
              </Grid>
              <Grid item xs={6} sm={4}>{tf("Display order", "display_order", { type: "number" })}</Grid>
              <Grid item xs={12} sm={4}>
                <FormControlLabel
                  control={<Switch checked={!!form.is_active} onChange={(e) => set("is_active", e.target.checked)} />}
                  label="Active"
                />
              </Grid>
            </Grid>
          </Box>

          <Divider />

          {/* Amenities */}
          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Amenities</Typography>
            {Object.entries(amenityGroups).map(([group, items]) => (
              <Box key={group} sx={{ mb: 1.5 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {group}
                </Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" gap={0.75} sx={{ mt: 0.5 }}>
                  {items.map((a) => (
                    <Chip
                      key={a.id}
                      label={a.amenity_name}
                      size="small"
                      onClick={() => toggleAmenity(a.id)}
                      color={selectedAmenityIds.includes(a.id) ? "primary" : "default"}
                      variant={selectedAmenityIds.includes(a.id) ? "filled" : "outlined"}
                      sx={{ cursor: "pointer" }}
                    />
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {category ? "Save changes" : "Create category"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
