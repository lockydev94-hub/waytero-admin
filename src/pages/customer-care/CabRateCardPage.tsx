// ============================================================
// WAYTERO ADMIN — CAB RATE CARD
// Route: /cab-rate-card
// Doc Ref: Docs/01_Business_Requirements/SUPPLIER_CAB_PRICE_MASTER_V1.md
//          BRD Part 3 §36 — city-based pricing; migration 0097/0098
//
// Two questions this screen answers:
//   1. What does each vehicle class cost here, package by package? — the card
//      the desk quotes from, editable line by line.
//   2. Which customers have an agreed price that differs from it? — the
//      overrides, with enough context to revoke one.
//
// Every figure is the server's. Editing a line writes the rate card itself, so
// the next quote for every booking in this city uses the corrected price.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import {
  Box, Stack, Typography, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, Chip, Button, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Tab, Tabs, Tooltip, alpha, useTheme,
} from "@mui/material";
import { Edit, Refresh, Block, LocalOffer, Undo } from "@mui/icons-material";

import {
  customerCareService, RateClass, RatePackage, RentalRateCard, CustomQuote,
  CabBookingMeta,
} from "../../services/customerCare.service";
import { apiErrorMessage } from "../../utils/apiError";

const money = (v: number | string | null | undefined) =>
  `₹${Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const RENTAL_LABEL: Record<string, string> = {
  LOCAL: "Local",
  OUTSTATION: "Outstation",
  DAILY: "Daily",
};

export default function CabRateCardPage() {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [cities, setCities] = useState<CabBookingMeta["cities"]>([]);
  const [cityId, setCityId] = useState<number | "">("");
  const [card, setCard] = useState<RentalRateCard | null>(null);
  const [quotes, setQuotes] = useState<CustomQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Edit-line dialog
  const [editing, setEditing] = useState<{ cls: RateClass; pkg: RatePackage } | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const load = useCallback(async (id: number) => {
    setLoading(true); setError("");
    try {
      const [rateCard, agreed] = await Promise.all([
        customerCareService.getCabRateCard({ city_id: id }),
        customerCareService.listCustomQuotes({ city_id: id }),
      ]);
      setCard(rateCard);
      setQuotes(agreed.quotes);
    } catch (e: any) {
      setError(apiErrorMessage(e, "Could not load the rate card"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const meta = await customerCareService.getCabMeta();
        setCities(meta.cities);
        const first = meta.cities[0]?.id;
        if (first) { setCityId(first); await load(first); }
      } catch {
        setError("Could not load cities.");
      }
    })();
  }, [load]);

  function openEdit(cls: RateClass, pkg: RatePackage) {
    setEditing({ cls, pkg });
    setEditError("");
    setForm({
      price: String(pkg.price),
      extra_hour_rate: String(pkg.extra_hour_rate),
      extra_km_rate: String(pkg.extra_km_rate),
      driver_allowance: String(pkg.driver_allowance),
      midnight_return_charge: String(pkg.midnight_return_charge),
      vehicle_category_id: cls.vehicle_category_id != null ? String(cls.vehicle_category_id) : "",
    });
  }

  async function saveEdit() {
    if (!editing || !cityId) return;
    setSaving(true); setEditError("");
    try {
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(form)) {
        if (value === "") continue;
        payload[key] = key === "vehicle_category_id" ? Number(value) : String(value);
      }
      const res = await customerCareService.updateRateCardLine(editing.pkg.rate_id, payload);
      setEditing(null);
      setNotice(res.message || "Rate card updated");
      await load(Number(cityId));
    } catch (e: any) {
      setEditError(apiErrorMessage(e, "Could not update the line"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleQuote(q: CustomQuote) {
    try {
      const res = await customerCareService.updateCustomQuote(q.id, { is_active: !q.is_active });
      setNotice(res.message || "Agreed price updated");
      if (cityId) await load(Number(cityId));
    } catch (e: any) {
      setError(apiErrorMessage(e, "Could not update the agreed price"));
    }
  }

  return (
    <Box maxWidth={1200} mx="auto">
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} gap={2} mb={3}>
        <Box flex={1}>
          <Typography variant="h6" fontWeight={800}>Cab Rate Card</Typography>
          <Typography variant="caption" color="text.secondary">
            The package prices the desk quotes from. City sheets override the platform default class by class.
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>City</InputLabel>
          <Select
            value={cityId}
            label="City"
            onChange={(e) => { const id = Number(e.target.value); setCityId(id); load(id); }}
          >
            {cities.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </Select>
        </FormControl>
        <IconButton onClick={() => cityId && load(Number(cityId))} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
          <Refresh />
        </IconButton>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setNotice("")}>{notice}</Alert>}

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Rate card${card ? ` (${card.classes.length} classes)` : ""}`} sx={{ textTransform: "none", fontWeight: 700 }} />
        <Tab label={`Agreed prices${quotes.length ? ` (${quotes.filter(q => q.is_active).length})` : ""}`} sx={{ textTransform: "none", fontWeight: 700 }} />
      </Tabs>

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
      ) : tab === 0 ? (
        <Stack gap={1.5}>
          {(card?.classes ?? []).map(cls => (
            <Paper key={cls.vehicle_class} variant="outlined" sx={{ borderRadius: 2.5, overflow: "hidden" }}>
              <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2, py: 1.25, bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                <Typography fontWeight={800} fontSize={13.5}>{cls.label}</Typography>
                <Typography fontSize={11.5} color="text.secondary">{cls.vehicle_class}</Typography>
                {cls.seating_capacity != null && <Chip size="small" label={`${cls.seating_capacity} seats`} sx={{ height: 20, fontSize: 10.5 }} />}
                <Chip
                  size="small"
                  label={cls.rate_source === "CITY" ? "City sheet" : "Platform default"}
                  color={cls.rate_source === "CITY" ? "success" : "default"}
                  sx={{ height: 20, fontSize: 10.5, fontWeight: 700 }}
                />
                {cls.vehicle_category_id == null && (
                  <Chip size="small" color="error" label="Not bookable — no category" sx={{ height: 20, fontSize: 10.5 }} />
                )}
                <Box flex={1} />
                <Typography fontSize={11} color="text.secondary">{cls.models}</Typography>
              </Stack>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Package</TableCell>
                    <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700 }}>Price</TableCell>
                    <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700 }}>Extra / hour</TableCell>
                    <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700 }}>Extra / km</TableCell>
                    <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700 }}>Driver</TableCell>
                    <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700 }}>Midnight</TableCell>
                    <TableCell align="center" sx={{ fontSize: 11, fontWeight: 700 }}>Includes</TableCell>
                    <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cls.packages.map(p => (
                    <TableRow key={p.rate_id} hover>
                      <TableCell sx={{ fontSize: 12 }}>{RENTAL_LABEL[p.rental_type] ?? p.rental_type}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{p.included_hours}h / {p.included_km}km</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12, fontWeight: 700 }}>
                        {money(p.price)}
                        {p.custom?.applies && (
                          <Tooltip title={`Agreed for a customer: ${money(p.custom.package_price ?? p.price)}`}>
                            <LocalOffer sx={{ fontSize: 13, color: "#4F46E5", ml: 0.5, verticalAlign: "middle" }} />
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: 12 }}>{money(p.extra_hour_rate)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12 }}>{money(p.extra_km_rate)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12 }}>{money(p.driver_allowance)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12 }}>{money(p.midnight_return_charge)}</TableCell>
                      <TableCell align="center">
                        <Stack direction="row" gap={0.25} justifyContent="center" flexWrap="wrap">
                          {p.toll_included && <Chip size="small" label="Toll" sx={{ height: 18, fontSize: 10 }} />}
                          {p.parking_included && <Chip size="small" label="Parking" sx={{ height: 18, fontSize: 10 }} />}
                          {p.night_halt_included && <Chip size="small" label="Halt" sx={{ height: 18, fontSize: 10 }} />}
                          {!p.toll_included && !p.parking_included && !p.night_halt_included && (
                            <Typography fontSize={10.5} color="text.disabled">extra</Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openEdit(cls, p)}><Edit fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          ))}
          {!card?.classes.length && !loading && (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              No rate card for this city or the platform default. Seed or add one before quoting packages.
            </Alert>
          )}
        </Stack>
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: "hidden" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Customer</TableCell>
                <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Class / package</TableCell>
                <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700 }}>Package price</TableCell>
                <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700 }}>Extra hour</TableCell>
                <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700 }}>Extra km</TableCell>
                <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Valid</TableCell>
                <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Reason</TableCell>
                <TableCell align="right" sx={{ fontSize: 11, fontWeight: 700 }}>State</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {quotes.map(q => (
                <TableRow key={q.id} hover>
                  <TableCell sx={{ fontSize: 12 }}>
                    <Typography fontSize={12} fontWeight={700}>{q.customer_name || `Customer #${q.customer_id}`}</Typography>
                    <Typography fontSize={11} color="text.secondary">{q.mobile_number}{q.city_name ? ` · ${q.city_name}` : " · all cities"}</Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {q.vehicle_class} · {RENTAL_LABEL[q.rental_type] ?? q.rental_type} {q.included_hours}h
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: 12 }}>{q.package_price != null ? money(q.package_price) : "—"}</TableCell>
                  <TableCell align="right" sx={{ fontSize: 12 }}>{q.extra_hour_rate != null ? money(q.extra_hour_rate) : "—"}</TableCell>
                  <TableCell align="right" sx={{ fontSize: 12 }}>{q.extra_km_rate != null ? money(q.extra_km_rate) : "—"}</TableCell>
                  <TableCell sx={{ fontSize: 11.5, color: "text.secondary" }}>
                    {q.valid_from || q.valid_to
                      ? `${q.valid_from ?? "always"} → ${q.valid_to ?? "open"}`
                      : "No end date"}
                  </TableCell>
                  <TableCell sx={{ fontSize: 11.5, color: "text.secondary", maxWidth: 220 }}>{q.reason || "—"}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" justifyContent="flex-end" alignItems="center" gap={0.5}>
                      <Chip
                        size="small"
                        label={q.is_active ? "Active" : "Revoked"}
                        color={q.is_active ? "success" : "default"}
                        sx={{ height: 20, fontSize: 10.5, fontWeight: 700 }}
                      />
                      <Tooltip title={q.is_active ? "Revoke — keeps the row for audit" : "Reactivate"}>
                        <IconButton size="small" onClick={() => toggleQuote(q)}>
                          {q.is_active ? <Block fontSize="small" /> : <Undo fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {!quotes.length && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography fontSize={12} color="text.secondary" py={2} textAlign="center">
                      No agreed prices in this city. Set one while booking a package for a customer.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* ── Edit a card line ── */}
      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>
          {editing ? `${editing.cls.label} · ${RENTAL_LABEL[editing.pkg.rental_type] ?? editing.pkg.rental_type} ${editing.pkg.included_hours}h / ${editing.pkg.included_km}km` : ""}
        </DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            Changing this line reprices every future quote for the class in{" "}
            {editing?.cls.rate_source === "CITY" ? "this city" : "every city that has no sheet of its own"}.
          </Typography>
          <Stack gap={2}>
            <TextField label="Package price (₹)" size="small" type="number" value={form.price ?? ""} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
            <TextField label="Extra hour rate (₹)" size="small" type="number" value={form.extra_hour_rate ?? ""} onChange={e => setForm(f => ({ ...f, extra_hour_rate: e.target.value }))} />
            <TextField label="Extra km rate (₹)" size="small" type="number" value={form.extra_km_rate ?? ""} onChange={e => setForm(f => ({ ...f, extra_km_rate: e.target.value }))} />
            <TextField label="Driver allowance (₹)" size="small" type="number" value={form.driver_allowance ?? ""} onChange={e => setForm(f => ({ ...f, driver_allowance: e.target.value }))} />
            <TextField label="Midnight return charge (₹)" size="small" type="number" value={form.midnight_return_charge ?? ""} onChange={e => setForm(f => ({ ...f, midnight_return_charge: e.target.value }))} />
            <TextField
              label="Bookable category id" size="small" type="number"
              value={form.vehicle_category_id ?? ""}
              onChange={e => setForm(f => ({ ...f, vehicle_category_id: e.target.value }))}
              helperText="Partners are offered the job by category; without one the class cannot be booked."
            />
            {editError && <Alert severity="error" sx={{ borderRadius: 2 }}>{editError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditing(null)} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit} disabled={saving} sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}>
            {saving ? "Saving…" : "Save line"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
