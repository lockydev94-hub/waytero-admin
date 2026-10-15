// ============================================================
// WAYTERO ADMIN — OFFER EDITOR DIALOG
// Backend: /admin/offers (offer_api.py)
// Create sends offer + targets in one POST; edit PUTs core
// fields then diffs hotel/tour links through the link endpoints.
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box, Typography, Stack, Chip, Button, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, FormControl, InputLabel, Select,
  Autocomplete, Checkbox, FormControlLabel, Switch, CircularProgress,
  Alert, Divider, Paper, alpha, useTheme,
} from "@mui/material";
import { Close, Add, CheckCircle, Cancel, Warning } from "@mui/icons-material";
import { useSnackbar } from "notistack";

import MediaUploader, { CropSpec } from "../cms/components/MediaUploader";
import {
  offerService, OfferServiceType, OfferCreatePayload, OfferDetail,
  EligibleCoupon, OfferHotelLink, OfferTourLink,
} from "../../services/offer.service";
import { couponService, Coupon } from "../../services/coupon.service";
import { hotelService, HotelListItem, RoomCategory } from "../../services/hotel.service";
import { tourService, TourPackage } from "../../services/tour.service";
import { settingsService, VehicleCategory } from "../../services/settings.service";
import { apiErrorMessage } from "../../utils/apiError";

// Hero slider renders this inside a circle — force a 1:1 512px webp.
const OFFER_IMAGE_CROP: CropSpec = {
  aspectRatio: 1,
  outputWidth: 512,
  outputHeight: 512,
  format: "image/webp",
};

interface HotelDraft {
  hotel_id: number;
  hotel_name: string;
  partner_id: number;
  partner_name: string | null;
  city_id: number;
  room_category_ids: number[];
  existing?: OfferHotelLink; // present when the link already exists on the server
}
interface TourDraft {
  tour_package_id: number;
  package_name: string;
  partner_id: number;
  partner_name: string | null;
  city_id: number;
  existing?: OfferTourLink;
}

interface Props {
  open: boolean;
  offerId: number | null; // null = create
  onClose: () => void;
  onSaved: () => void;
}

export default function OfferEditorDialog({ open, offerId, onClose, onSaved }: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const isEdit = offerId != null;

  // ── Core form ──
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState<string | null>(null);
  const [serviceType, setServiceType] = useState<OfferServiceType>("CAB");
  const [vehicleCategoryId, setVehicleCategoryId] = useState<number | null>(null);
  const [couponId, setCouponId] = useState<number | null>(null);
  const [shortDescription, setShortDescription] = useState("");
  const [terms, setTerms] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [badgeLabel, setBadgeLabel] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ── Pickers ──
  const [coupons, setCoupons] = useState<EligibleCoupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [vehicleCategories, setVehicleCategories] = useState<VehicleCategory[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [hotelOptions, setHotelOptions] = useState<HotelListItem[]>([]);
  const [tourOptions, setTourOptions] = useState<TourPackage[]>([]);
  const [roomCatsByHotel, setRoomCatsByHotel] = useState<Record<number, RoomCategory[]>>({});
  const [hotels, setHotels] = useState<HotelDraft[]>([]);
  const [tours, setTours] = useState<TourDraft[]>([]);

  // ── Load master data once per open ──
  useEffect(() => {
    if (!open) return;
    // master methods are Object.assign'd onto settingsService at runtime
    (settingsService as any).getVehicleCategories(true).then(setVehicleCategories).catch(() => {});
    hotelService.list({ status: "ACTIVE", page: 1, page_size: 100 })
      .then((p) => setHotelOptions(p.items)).catch(() => {});
    tourService.listPackages({ status: "ACTIVE" })
      .then((p: any) => setTourOptions(p.items ?? p)).catch(() => {});
  }, [open]);

  // ── Eligible coupons per service type (server-computed) ──
  useEffect(() => {
    if (!open) return;
    setCouponsLoading(true);
    offerService.eligibleCoupons({
      service_type: serviceType,
      ...(serviceType === "CAB" && vehicleCategoryId ? { vehicle_category_id: vehicleCategoryId } : {}),
    })
      .then(setCoupons)
      .catch(() => setCoupons([]))
      .finally(() => setCouponsLoading(false));
  }, [open, serviceType, vehicleCategoryId]);

  // ── Full coupon detail for window constraints + cohort panel ──
  useEffect(() => {
    if (!couponId) { setSelectedCoupon(null); return; }
    couponService.get(couponId).then(setSelectedCoupon).catch(() => setSelectedCoupon(null));
  }, [couponId]);

  const loadRoomCategories = useCallback((hotelId: number) => {
    if (roomCatsByHotel[hotelId]) return;
    hotelService.listRoomCategories(hotelId)
      .then((cats) => setRoomCatsByHotel((m) => ({ ...m, [hotelId]: cats.filter((c) => c.is_active) })))
      .catch(() => enqueueSnackbar("Failed to load room types", { variant: "error" }));
  }, [roomCatsByHotel, enqueueSnackbar]);

  // ── Load existing offer ──
  useEffect(() => {
    if (!open || offerId == null) return;
    setLoadingDetail(true);
    offerService.get(offerId)
      .then((o: OfferDetail) => {
        setTitle(o.title);
        setSlug(o.slug);
        setServiceType(o.service_type);
        setVehicleCategoryId(o.vehicle_category_id);
        setCouponId(o.coupon_id);
        setShortDescription(o.short_description ?? "");
        setTerms(o.terms_and_conditions ?? "");
        setImageUrl(o.image_url);
        setBadgeLabel(o.badge_label ?? "");
        setValidFrom(o.valid_from);
        setValidTo(o.valid_to);
        setIsPublished(o.is_published);
        setSortOrder(o.sort_order);
        setHotels(o.hotels.filter((h) => h.status !== "REMOVED").map((h) => ({
          hotel_id: h.hotel_id,
          hotel_name: h.hotel_name,
          partner_id: h.partner_id,
          partner_name: null,
          city_id: h.city_id,
          room_category_ids: h.room_types.map((rt) => rt.id),
          existing: h,
        })));
        setTours(o.tour_packages.filter((t) => t.status !== "REMOVED").map((t) => ({
          tour_package_id: t.tour_package_id,
          package_name: t.package_name,
          partner_id: t.partner_id,
          partner_name: null,
          city_id: t.city_id,
          existing: t,
        })));
        o.hotels.filter((h) => h.status !== "REMOVED").forEach((h) => {
          hotelService.listRoomCategories(h.hotel_id)
            .then((cats) => setRoomCatsByHotel((m) => ({ ...m, [h.hotel_id]: cats.filter((c) => c.is_active) })))
            .catch(() => {});
        });
      })
      .catch((e) => enqueueSnackbar(apiErrorMessage(e, "Failed to load offer"), { variant: "error" }))
      .finally(() => setLoadingDetail(false));
  }, [open, offerId, enqueueSnackbar]);

  // ── Reset on close ──
  useEffect(() => {
    if (open) return;
    setFormError(null);
    setHotels([]);
    setTours([]);
    setRoomCatsByHotel({});
  }, [open]);

  const couponWindow = useMemo(() => {
    const c = coupons.find((x) => x.coupon_id === couponId);
    return c ? { from: c.valid_from, to: c.valid_to } : null;
  }, [coupons, couponId]);

  // Clamp offer dates into the coupon window when a coupon is picked
  useEffect(() => {
    if (!couponWindow) return;
    setValidFrom((v) => (!v || v < couponWindow.from ? couponWindow.from : v > couponWindow.to ? couponWindow.to : v));
    setValidTo((v) => (!v || v > couponWindow.to ? couponWindow.to : v < couponWindow.from ? couponWindow.from : v));
  }, [couponWindow]);

  const cohortActivePartnerIds = useMemo(() => {
    if (!selectedCoupon || selectedCoupon.coupon_type === "PLATFORM") return null;
    return new Set(selectedCoupon.partner_rules.filter((r) => r.is_active).map((r) => r.partner_id));
  }, [selectedCoupon]);

  const couponCityIds = useMemo(() => {
    if (!selectedCoupon || !selectedCoupon.is_city_specific) return null;
    return new Set(selectedCoupon.city_rules.map((r) => r.city_id));
  }, [selectedCoupon]);

  function hotelTargetStatus(h: HotelDraft): { ok: boolean; note: string } {
    if (cohortActivePartnerIds && !cohortActivePartnerIds.has(h.partner_id)) {
      return { ok: false, note: "Partner has not joined this coupon" };
    }
    if (couponCityIds && !couponCityIds.has(h.city_id)) {
      return { ok: false, note: "Hotel is outside the coupon's cities" };
    }
    if (!h.room_category_ids.length) return { ok: false, note: "Pick at least one room type" };
    return { ok: true, note: "" };
  }
  function tourTargetStatus(t: TourDraft): { ok: boolean; note: string } {
    if (cohortActivePartnerIds && !cohortActivePartnerIds.has(t.partner_id)) {
      return { ok: false, note: "Partner has not joined this coupon" };
    }
    if (couponCityIds && !couponCityIds.has(t.city_id)) {
      return { ok: false, note: "Package is outside the coupon's cities" };
    }
    return { ok: true, note: "" };
  }

  // ── Target add/remove ──
  function addHotel(h: HotelListItem) {
    if (hotels.some((x) => x.hotel_id === h.id)) return;
    setHotels((xs) => [...xs, {
      hotel_id: h.id, hotel_name: h.hotel_name, partner_id: h.partner_id,
      partner_name: h.partner_name, city_id: h.city_id, room_category_ids: [],
    }]);
    loadRoomCategories(h.id);
  }
  function addTour(t: TourPackage) {
    if (tours.some((x) => x.tour_package_id === t.id)) return;
    setTours((xs) => [...xs, {
      tour_package_id: t.id, package_name: t.package_name, partner_id: t.partner_id,
      partner_name: t.partner_name ?? null, city_id: t.city_id,
    }]);
  }
  async function removeHotel(h: HotelDraft) {
    if (isEdit && h.existing && !saving) {
      // unlink immediately so the ≥1-active-link publish rule stays honest
      try {
        await offerService.unlinkHotel(offerId!, h.hotel_id);
        setHotels((xs) => xs.filter((x) => x.hotel_id !== h.hotel_id));
        return;
      } catch (e) {
        enqueueSnackbar(apiErrorMessage(e, "Failed to unlink hotel"), { variant: "error" });
        return;
      }
    }
    setHotels((xs) => xs.filter((x) => x.hotel_id !== h.hotel_id));
  }
  async function removeTour(t: TourDraft) {
    if (isEdit && t.existing && !saving) {
      try {
        await offerService.unlinkTour(offerId!, t.tour_package_id);
        setTours((xs) => xs.filter((x) => x.tour_package_id !== t.tour_package_id));
        return;
      } catch (e) {
        enqueueSnackbar(apiErrorMessage(e, "Failed to unlink package"), { variant: "error" });
        return;
      }
    }
    setTours((xs) => xs.filter((x) => x.tour_package_id !== t.tour_package_id));
  }
  function toggleRoomType(hotelId: number, rcId: number) {
    setHotels((xs) => xs.map((h) => {
      if (h.hotel_id !== hotelId) return h;
      const has = h.room_category_ids.includes(rcId);
      return { ...h, room_category_ids: has ? h.room_category_ids.filter((i) => i !== rcId) : [...h.room_category_ids, rcId] };
    }));
  }

  async function resolveExit(kind: "hotel" | "tour", targetId: number, approve: boolean) {
    try {
      if (kind === "hotel") await offerService.resolveHotelExit(offerId!, targetId, approve);
      else await offerService.resolveTourExit(offerId!, targetId, approve);
      enqueueSnackbar(approve ? "Exit approved — listing removed from offer" : "Exit request rejected", { variant: "success" });
      // refresh drafts from server
      const o = await offerService.get(offerId!);
      setHotels(o.hotels.filter((h) => h.status !== "REMOVED").map((h) => ({
        hotel_id: h.hotel_id, hotel_name: h.hotel_name, partner_id: h.partner_id,
        partner_name: null, city_id: h.city_id,
        room_category_ids: h.room_types.map((rt) => rt.id), existing: h,
      })));
      setTours(o.tour_packages.filter((t) => t.status !== "REMOVED").map((t) => ({
        tour_package_id: t.tour_package_id, package_name: t.package_name, partner_id: t.partner_id,
        partner_name: null, city_id: t.city_id, existing: t,
      })));
      onSaved();
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e, "Failed to resolve exit request"), { variant: "error" });
    }
  }

  // ── Save ──
  function validate(): string | null {
    if (!title.trim()) return "Title is required";
    if (!couponId) return "Select a coupon";
    if (!imageUrl) return "Upload the circular offer image";
    if (!validFrom || !validTo) return "Start and end dates are required";
    if (validFrom > validTo) return "End date cannot precede start date";
    if (serviceType === "CAB" && !vehicleCategoryId) return "A CAB offer needs a vehicle category";
    if (isPublished) {
      if (!terms.trim()) return "Terms & conditions are required to publish";
      if (serviceType === "HOTEL" && !hotels.length) return "Add at least one hotel to publish";
      if (serviceType === "TOUR" && !tours.length) return "Add at least one tour package to publish";
    }
    if (serviceType === "HOTEL" && hotels.some((h) => !h.room_category_ids.length)) {
      return "Every linked hotel needs at least one room type";
    }
    if (serviceType === "HOTEL" && hotels.some((h) => !hotelTargetStatus(h).ok && !h.existing)) {
      return "Fix the highlighted hotels (cohort / city / room types)";
    }
    if (serviceType === "TOUR" && tours.some((t) => !tourTargetStatus(t).ok && !t.existing)) {
      return "Fix the highlighted tour packages (cohort / city)";
    }
    return null;
  }

  async function handleSave() {
    const problem = validate();
    if (problem) { setFormError(problem); return; }
    setFormError(null);
    setSaving(true);
    try {
      if (!isEdit) {
        const payload: OfferCreatePayload = {
          coupon_id: couponId!, service_type: serviceType,
          vehicle_category_id: serviceType === "CAB" ? vehicleCategoryId : null,
          title: title.trim(), short_description: shortDescription.trim() || null,
          terms_and_conditions: terms, image_url: imageUrl!,
          badge_label: badgeLabel.trim() || null,
          valid_from: validFrom, valid_to: validTo,
          is_published: isPublished, sort_order: sortOrder,
          hotels: serviceType === "HOTEL" ? hotels.map((h) => ({ hotel_id: h.hotel_id, room_category_ids: h.room_category_ids })) : [],
          tour_package_ids: serviceType === "TOUR" ? tours.map((t) => t.tour_package_id) : [],
        };
        await offerService.create(payload);
        enqueueSnackbar("Offer created", { variant: "success" });
      } else {
        await offerService.update(offerId!, {
          coupon_id: couponId!, service_type: serviceType,
          vehicle_category_id: serviceType === "CAB" ? vehicleCategoryId : null,
          title: title.trim(), short_description: shortDescription.trim() || null,
          terms_and_conditions: terms, image_url: imageUrl!,
          badge_label: badgeLabel.trim() || null,
          valid_from: validFrom, valid_to: validTo,
          is_published: isPublished, sort_order: sortOrder,
        });
        // Diff links that were added since load (existing ones already unlinked live)
        for (const h of hotels) {
          if (!h.existing) {
            await offerService.linkHotel(offerId!, { hotel_id: h.hotel_id, room_category_ids: h.room_category_ids });
            continue;
          }
          const server = new Set(h.existing.room_types.map((rt) => rt.id));
          const now = new Set(h.room_category_ids);
          const changed = server.size !== now.size || [...now].some((i) => !server.has(i));
          if (changed) await offerService.setRoomTypes(offerId!, h.hotel_id, h.room_category_ids);
        }
        for (const t of tours.filter((x) => !x.existing)) {
          await offerService.linkTour(offerId!, t.tour_package_id);
        }
        enqueueSnackbar("Offer updated", { variant: "success" });
      }
      onSaved();
      onClose();
    } catch (e) {
      setFormError(apiErrorMessage(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  const selectedCouponBrief = coupons.find((c) => c.coupon_id === couponId);

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 0, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {isEdit ? `Edit Offer${slug ? ` — /offers/${slug}` : ""}` : "Create Offer"}
        <IconButton size="small" onClick={onClose} disabled={saving}><Close /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: "16px !important" }}>
        {loadingDetail ? (
          <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
        ) : (
          <Stack spacing={2.5}>
            {formError && <Alert severity="error" onClose={() => setFormError(null)}>{formError}</Alert>}

            {/* ── Basics ── */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Offer Title *" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth size="small" />
              <FormControl size="small" sx={{ minWidth: { sm: 160 } }}>
                <InputLabel>Service *</InputLabel>
                <Select value={serviceType} label="Service *" disabled={isEdit} onChange={(e) => {
                  setServiceType(e.target.value as OfferServiceType);
                  setCouponId(null);
                  if (e.target.value !== "CAB") setVehicleCategoryId(null);
                }}>
                  {(["CAB", "HOTEL", "TOUR"] as OfferServiceType[]).map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>

            {serviceType === "CAB" && (
              <FormControl size="small" fullWidth>
                <InputLabel>Cab Category *</InputLabel>
                <Select value={vehicleCategoryId ?? ""} label="Cab Category *" disabled={isEdit}
                  onChange={(e) => setVehicleCategoryId(Number(e.target.value) || null)}>
                  {vehicleCategories.map((c) => <MenuItem key={c.id} value={c.id}>{c.category_name}</MenuItem>)}
                </Select>
              </FormControl>
            )}

            <Autocomplete
              options={coupons}
              getOptionLabel={(c) => `${c.coupon_code} — ${c.title}`}
              value={coupons.find((c) => c.coupon_id === couponId) ?? null}
              onChange={(_, c) => setCouponId(c ? c.coupon_id : null)}
              isOptionEqualToValue={(a, b) => a.coupon_id === b.coupon_id}
              loading={couponsLoading}
              disabled={isEdit && hotels.some((h) => h.existing)}
              renderOption={(props, c) => {
                const { key, ...other } = props;
                return (
                  <Box component="li" key={key} {...other} sx={{ opacity: c.eligible ? 1 : 0.55 }}>
                    <Stack spacing={0.25} flex={1}>
                      <Typography variant="body2" fontWeight={700} fontFamily="monospace">{c.coupon_code}
                        <Chip component="span" size="small" label={c.coupon_type} sx={{ ml: 1, height: 18, fontSize: 11 }} variant="outlined" />
                      </Typography>
                      <Typography variant="caption" color="text.secondary">{c.title}</Typography>
                      {!c.eligible && (
                        <Typography variant="caption" color="error.main" component="span" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Warning sx={{ fontSize: 13 }} />{c.reasons.join("; ")}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                );
              }}
              renderInput={(params) => (
                <TextField {...params} label="Coupon *" size="small"
                  helperText={selectedCouponBrief && !selectedCouponBrief.eligible
                    ? selectedCouponBrief.reasons.join("; ")
                    : "Only active coupons are listed; ineligible ones show why"} />
              )}
            />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Valid From *" type="date" size="small" fullWidth value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)} InputLabelProps={{ shrink: true }}
                inputProps={{ min: couponWindow?.from, max: couponWindow?.to ?? "9999-12-31" }}
                helperText={couponWindow ? `Coupon window: ${couponWindow.from} → ${couponWindow.to}` : "Pick a coupon first to constrain dates"} />
              <TextField label="Valid To *" type="date" size="small" fullWidth value={validTo}
                onChange={(e) => setValidTo(e.target.value)} InputLabelProps={{ shrink: true }}
                inputProps={{ min: couponWindow?.from, max: couponWindow?.to ?? "9999-12-31" }} />
              <TextField label="Sort Order" type="number" size="small" value={sortOrder} sx={{ sm: { maxWidth: 120 } }}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)} helperText="Hero slider order" />
            </Stack>

            {/* ── Media ── */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-start" }}>
              <Box sx={{ flex: 1, minWidth: 240 }}>
                <MediaUploader
                  value={imageUrl}
                  onChange={setImageUrl}
                  folder="waytero/offers"
                  kind="image"
                  label="Offer image *"
                  hint="Shown inside the hero circle — square crops best"
                  crop={OFFER_IMAGE_CROP}
                  previewHeight={160}
                />
              </Box>
              {imageUrl && (
                <Tooltip title="How the hero circle will crop it">
                  <Box component="img" src={imageUrl} alt="" sx={{
                    width: 120, height: 120, borderRadius: "50%", objectFit: "cover",
                    border: `3px solid ${alpha(theme.palette.primary.main, 0.4)}`, mx: { sm: "auto" },
                  }} />
                </Tooltip>
              )}
            </Stack>

            {/* ── Content ── */}
            <TextField label="Short Description" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)}
              multiline rows={2} size="small" fullWidth />
            <TextField label="Badge Override (optional)" value={badgeLabel} onChange={(e) => setBadgeLabel(e.target.value)}
              size="small" fullWidth inputProps={{ maxLength: 60 }}
              helperText="Leave blank to derive from the coupon (FLAT ₹X OFF / UPTO X% OFF)" />
            <TextField label="Terms & Conditions *" value={terms} onChange={(e) => setTerms(e.target.value)}
              multiline rows={4} size="small" fullWidth
              error={isPublished && !terms.trim()}
              helperText={isPublished && !terms.trim() ? "Required to publish" : "Shown on the public offer page"} />

            {/* ── Targets ─ */}
            {serviceType === "HOTEL" && (
              <Box>
                <Typography variant="subtitle2" fontWeight={700} mb={1}>Eligible hotels</Typography>
                <Autocomplete
                  options={hotelOptions.filter((h) => !hotels.some((x) => x.hotel_id === h.id))}
                  getOptionLabel={(h) => `${h.hotel_name}${h.city_name ? ` (${h.city_name})` : ""}`}
                  value={null}
                  onChange={(_, h) => { if (h) addHotel(h); }}
                  blurOnSelect
                  renderInput={(params) => <TextField {...params} size="small" label="Add hotel…" placeholder="Search active hotels" />}
                  sx={{ maxWidth: 420, mb: 1.5 }}
                />
                {hotels.map((h) => {
                  const st = hotelTargetStatus(h);
                  return (
                    <Paper key={h.hotel_id} variant="outlined" sx={{ p: 1.5, mb: 1, borderRadius: 2, borderColor: st.ok ? "divider" : "warning.main" }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                        <Box>
                          <Typography variant="body2" fontWeight={700}>{h.hotel_name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Partner #{h.partner_id}{h.partner_name ? ` · ${h.partner_name}` : ""}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {h.existing?.status === "EXIT_REQUESTED" && (
                            <Tooltip title={h.existing.exit_reason ?? "Partner requested to leave this offer"}>
                              <Chip size="small" color="warning" variant="outlined" label="Exit requested"
                                icon={<Warning sx={{ fontSize: 16 }} />} />
                            </Tooltip>
                          )}
                          {h.existing?.status === "EXIT_REQUESTED" ? (
                            <>
                              <Button size="small" color="error" startIcon={<CheckCircle />} onClick={() => resolveExit("hotel", h.hotel_id, true)}>Approve exit</Button>
                              <Button size="small" startIcon={<Cancel />} onClick={() => resolveExit("hotel", h.hotel_id, false)}>Reject</Button>
                            </>
                          ) : (
                            <IconButton size="small" onClick={() => removeHotel(h)} disabled={saving}><Close fontSize="small" /></IconButton>
                          )}
                        </Stack>
                      </Stack>
                      {!st.ok && <Typography variant="caption" color="warning.main" display="block" mt={0.5}>{st.note}</Typography>}
                      <Stack direction="row" spacing={1} flexWrap="wrap" mt={0.5}>
                        {(roomCatsByHotel[h.hotel_id] ?? []).map((rc) => (
                          <FormControlLabel key={rc.id} control={
                            <Checkbox size="small" checked={h.room_category_ids.includes(rc.id)} onChange={() => toggleRoomType(h.hotel_id, rc.id)} />
                          } label={<Typography variant="body2">{rc.category_name}</Typography>} sx={{ mr: 0 }} />
                        ))}
                        {!roomCatsByHotel[h.hotel_id] && <CircularProgress size={16} />}
                      </Stack>
                    </Paper>
                  );
                })}
              </Box>
            )}

            {serviceType === "TOUR" && (
              <Box>
                <Typography variant="subtitle2" fontWeight={700} mb={1}>Eligible tour packages</Typography>
                <Autocomplete
                  options={tourOptions.filter((t) => !tours.some((x) => x.tour_package_id === t.id))}
                  getOptionLabel={(t) => `${t.package_name}${t.destination ? ` (${t.destination})` : ""}`}
                  value={null}
                  onChange={(_, t) => { if (t) addTour(t); }}
                  blurOnSelect
                  renderInput={(params) => <TextField {...params} size="small" label="Add package…" placeholder="Search active packages" />}
                  sx={{ maxWidth: 420, mb: 1.5 }}
                />
                {tours.map((t) => {
                  const st = tourTargetStatus(t);
                  return (
                    <Paper key={t.tour_package_id} variant="outlined" sx={{ p: 1.5, mb: 1, borderRadius: 2, borderColor: st.ok ? "divider" : "warning.main" }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography variant="body2" fontWeight={700}>{t.package_name}</Typography>
                          <Typography variant="caption" color="text.secondary">Partner #{t.partner_id}{t.partner_name ? ` · ${t.partner_name}` : ""}</Typography>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {t.existing?.status === "EXIT_REQUESTED" && (
                            <Chip size="small" color="warning" variant="outlined" label="Exit requested" icon={<Warning sx={{ fontSize: 16 }} />} />
                          )}
                          {t.existing?.status === "EXIT_REQUESTED" ? (
                            <>
                              <Button size="small" color="error" startIcon={<CheckCircle />} onClick={() => resolveExit("tour", t.tour_package_id, true)}>Approve exit</Button>
                              <Button size="small" startIcon={<Cancel />} onClick={() => resolveExit("tour", t.tour_package_id, false)}>Reject</Button>
                            </>
                          ) : (
                            <IconButton size="small" onClick={() => removeTour(t)} disabled={saving}><Close fontSize="small" /></IconButton>
                          )}
                        </Stack>
                      </Stack>
                      {!st.ok && <Typography variant="caption" color="warning.main" display="block" mt={0.5}>{st.note}</Typography>}
                    </Paper>
                  );
                })}
              </Box>
            )}

            <Divider />
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <FormControlLabel
                control={<Switch checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} color="success" />}
                label={<Box><Typography variant="body2" fontWeight={700}>Published</Typography>
                  <Typography variant="caption" color="text.secondary">Live on the website hero once the coupon and dates allow</Typography></Box>}
              />
              {isEdit && slug && (
                <Button size="small" href={`${import.meta.env.VITE_SITE_URL ?? "http://localhost:3002"}/offers/${slug}`} target="_blank" rel="noreferrer">
                  View on website ↗
                </Button>
              )}
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || loadingDetail}
          startIcon={saving ? <CircularProgress size={16} /> : <Add />} sx={{ fontWeight: 600, minWidth: 130 }}>
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Offer"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
