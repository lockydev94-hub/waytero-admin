// ============================================================
// HOTEL DETAIL — PROFILE TAB
// Doc Ref: 03_FRONTEND_DESIGN.md §5 — editable profile form
// Covers: identity, description, amenities (grouped chips)
// ============================================================
import React, { useState, useEffect, useMemo } from "react";
import {
  Box, Card, CardContent, Grid, TextField, Typography,
  Stack, Button, FormControl, InputLabel, Select, MenuItem,
  Rating, FormControlLabel, Switch, Chip, CircularProgress,
  Alert, alpha, useTheme, Divider,
} from "@mui/material";
import { Save, Hotel, LocationCity, GroupWork } from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { hotelService, HotelDetail } from "../../../../services/hotel.service";
import SectionHeader from "../../components/SectionHeader";
import { HOTEL_QUERY_KEYS } from "../../constants";
import { apiErrorMessage } from "../../../../utils/apiError";

interface Props {
  hotel: HotelDetail;
  isOfficer: boolean;
  onRefresh: () => void;
}

export default function ProfileTab({ hotel, isOfficer, onRefresh }: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    hotel_name: hotel.hotel_name ?? "",
    hotel_type: hotel.hotel_type ?? "",
    hotel_category_id: hotel.hotel_category_id ?? "" as string | number,
    star_rating: hotel.star_rating,
    description: hotel.description ?? "",
    short_description: hotel.short_description ?? "",
    confirmation_mode: hotel.confirmation_mode ?? "INSTANT_CONFIRMATION",
    room_allocation_mode: hotel.room_allocation_mode ?? "AT_BOOKING",
    address: hotel.address ?? "",
    address_line_2: hotel.address_line_2 ?? "",
    landmark: hotel.landmark ?? "",
    postal_code: hotel.postal_code ?? "",
    contact_person: hotel.contact_person ?? "",
    contact_number: hotel.contact_number ?? "",
    alternate_number: hotel.alternate_number ?? "",
    email: hotel.email ?? "",
    website_url: hotel.website_url ?? "",
  });

  const [selectedAmenities, setSelectedAmenities] = useState<number[]>(hotel.amenity_ids ?? []);
  const [dirty, setDirty] = useState(false);

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => { setForm((p) => ({ ...p, [k]: e.target.value })); setDirty(true); };

  const setVal = (k: keyof typeof form, v: unknown) => { setForm((p) => ({ ...p, [k]: v })); setDirty(true); };

  // ── Amenities ────────────────────────────────────────────
  const { data: amenities = [] } = useQuery({
    queryKey: ["hotel-amenities"],
    queryFn: () => hotelService.listAmenities(false),
    staleTime: 5 * 60_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["hotel-categories"],
    queryFn: () => hotelService.listCategories(false),
    staleTime: 5 * 60_000,
  });

  const { data: meta } = useQuery({
    queryKey: ["hotel-meta"],
    queryFn: () => hotelService.getMeta(),
    staleTime: 10 * 60_000,
  });

  // Group amenities by amenity_group
  const amenityGroups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const a of amenities as any[]) {
      const g = a.amenity_group ?? "Other";
      (groups[g] ??= []).push(a);
    }
    return groups;
  }, [amenities]);

  const toggleAmenity = (id: number) => {
    setSelectedAmenities((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setDirty(true);
  };

  // ── Save profile ─────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      await hotelService.update(hotel.id, {
        hotel_name: form.hotel_name.trim(),
        hotel_type: form.hotel_type || undefined,
        hotel_category_id: form.hotel_category_id ? Number(form.hotel_category_id) : null,
        // MUI Rating yields null when cleared but 0 is also reachable; the
        // server constrains star_rating to 1..7, so 0 must go as null.
        star_rating: form.star_rating ? Number(form.star_rating) : null,
        description: form.description.trim() || undefined,
        short_description: form.short_description.trim() || undefined,
        confirmation_mode: form.confirmation_mode,
        room_allocation_mode: form.room_allocation_mode,
        address: form.address.trim(),
        address_line_2: form.address_line_2.trim() || undefined,
        landmark: form.landmark.trim() || undefined,
        postal_code: form.postal_code.trim() || undefined,
        contact_person: form.contact_person.trim() || undefined,
        contact_number: form.contact_number.trim() || undefined,
        alternate_number: form.alternate_number.trim() || undefined,
        email: form.email.trim() || undefined,
        website_url: form.website_url.trim() || undefined,
      });
      await hotelService.updateAmenities(hotel.id, selectedAmenities);
    },
    onSuccess: () => {
      enqueueSnackbar("Profile saved", { variant: "success" });
      setDirty(false);
      qc.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.detail, hotel.id] });
      onRefresh();
    },
    onError: (e: any) =>
      enqueueSnackbar(apiErrorMessage(e, "Save failed"), { variant: "error" }),
  });

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Identity */}
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <SectionHeader icon={<Hotel fontSize="small" />} title="Identity" />
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField label="Hotel Name *" value={form.hotel_name} onChange={set("hotel_name")} size="small" fullWidth inputProps={{ maxLength: 200 }} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Hotel Type</InputLabel>
                  <Select value={form.hotel_type} label="Hotel Type" onChange={(e) => setVal("hotel_type", e.target.value)}>
                    <MenuItem value=""><em>Not specified</em></MenuItem>
                    {(meta as any)?.room_types?.map?.((t: string) => (
                      <MenuItem key={t} value={t}>{t.replace(/_/g, " ")}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select value={form.hotel_category_id} label="Category" onChange={(e) => setVal("hotel_category_id", e.target.value)}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {(categories as any[]).map((c: any) => <MenuItem key={c.id} value={c.id}>{c.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Star Rating</Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    <Rating value={form.star_rating} onChange={(_, v) => setVal("star_rating", v)} size="medium" />
                    {form.star_rating && <Button size="small" onClick={() => setVal("star_rating", null)}>Clear</Button>}
                  </Stack>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <TextField label="Description" value={form.description} onChange={set("description")} size="small" fullWidth multiline rows={3} inputProps={{ maxLength: 2000 }} helperText={`${form.description.length}/2000`} />
              </Grid>
              <Grid item xs={12}>
                <TextField label="Short Description" value={form.short_description} onChange={set("short_description")} size="small" fullWidth multiline rows={2} inputProps={{ maxLength: 500 }} helperText={`${form.short_description.length}/500`} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Location */}
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <SectionHeader icon={<LocationCity fontSize="small" />} title="Location" />
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField label="Address" value={form.address} onChange={set("address")} size="small" fullWidth multiline rows={2} />
              </Grid>
              <Grid item xs={8}>
                <TextField label="Address Line 2" value={form.address_line_2} onChange={set("address_line_2")} size="small" fullWidth />
              </Grid>
              <Grid item xs={4}>
                <TextField label="Postal Code" value={form.postal_code} onChange={set("postal_code")} size="small" fullWidth inputProps={{ maxLength: 10 }} />
              </Grid>
              <Grid item xs={12}>
                <TextField label="Landmark" value={form.landmark} onChange={set("landmark")} size="small" fullWidth />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <SectionHeader icon={<GroupWork fontSize="small" />} title="Contact" />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField label="Contact Person" value={form.contact_person} onChange={set("contact_person")} size="small" fullWidth />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Mobile" value={form.contact_number} onChange={set("contact_number")} size="small" fullWidth inputProps={{ maxLength: 10 }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Alternate" value={form.alternate_number} onChange={set("alternate_number")} size="small" fullWidth inputProps={{ maxLength: 10 }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Email" value={form.email} onChange={set("email")} size="small" fullWidth type="email" />
              </Grid>
              <Grid item xs={12}>
                <TextField label="Website URL" value={form.website_url} onChange={set("website_url")} size="small" fullWidth placeholder="https://..." />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Amenities */}
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Amenities</Typography>
            {Object.entries(amenityGroups).map(([group, items]) => (
              <Box key={group} sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: "block", mb: 0.75, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {group}
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.75}>
                  {items.map((a: any) => {
                    const selected = selectedAmenities.includes(a.id);
                    return (
                      <Chip
                        key={a.id}
                        label={a.amenity_name}
                        onClick={() => !isOfficer && toggleAmenity(a.id)}
                        variant={selected ? "filled" : "outlined"}
                        color={selected ? "primary" : "default"}
                        size="small"
                        sx={{ cursor: isOfficer ? "default" : "pointer" }}
                      />
                    );
                  })}
                </Stack>
              </Box>
            ))}
          </CardContent>
        </Card>

        {/* Settings */}
        {!isOfficer && (
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Operational Settings</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Confirmation Mode</InputLabel>
                    <Select value={form.confirmation_mode} label="Confirmation Mode" onChange={(e) => setVal("confirmation_mode", e.target.value)}>
                      <MenuItem value="INSTANT_CONFIRMATION">Instant</MenuItem>
                      <MenuItem value="MANUAL_CONFIRMATION">Manual</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Room Allocation Mode</InputLabel>
                    <Select value={form.room_allocation_mode} label="Room Allocation Mode" onChange={(e) => setVal("room_allocation_mode", e.target.value)}>
                      <MenuItem value="AT_BOOKING">At Booking</MenuItem>
                      <MenuItem value="AT_CHECK_IN">At Check-in</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Save */}
        {!isOfficer && (
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="contained"
              startIcon={saveMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <Save />}
              onClick={() => saveMutation.mutate()}
              disabled={!dirty || saveMutation.isPending || !form.hotel_name.trim()}
            >
              {saveMutation.isPending ? "Saving…" : "Save Profile"}
            </Button>
          </Box>
        )}
      </Stack>
    </Box>
  );
}
