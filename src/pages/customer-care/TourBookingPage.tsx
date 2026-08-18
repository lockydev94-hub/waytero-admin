// WAYTERO ADMIN — CUSTOMER CARE TOUR BOOKING PAGE
// Real-world tour booking creation from the customer care console.
// Two-column layout: trip selection (left) + participants & summary (right).
// Live commission preview via the public quote endpoint, multi-participant
// form, success card with link to the new TourBookingDetailPage.
// Doc Ref: BRD_PART_5_TOUR_PACKAGE_MANAGEMENT §6
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box, Typography, Card, CardContent, Chip, Button, Stack, Grid, MenuItem, TextField,
  IconButton, Divider, Avatar, Alert, CircularProgress, alpha, useTheme, Tooltip,
} from "@mui/material";
import {
  ArrowBack, CheckCircle, CalendarMonth, Groups, TravelExplore, LocationOn,
  Add, Delete, Person, Phone, Cake, Wc, AttachMoney, Star, AccessTime, Info,
  Refresh, OpenInNew, Hotel, Flight, Restaurant, Museum, CameraAlt, BeachAccess,
  CheckCircleOutline, Warning, PendingActions, Celebration,
} from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { tourService, TourPackage } from "../../services/tour.service";

const INR = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

interface Participant { name: string; mobile: string; age: string; gender: string; }

const blankParticipant: Participant = { name: "", mobile: "", age: "", gender: "" };

export default function TourBookingPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const [packages, setPackages] = useState<TourPackage[]>([]);
  const [customer, setCustomer] = useState<any>(null);
  const [packageId, setPackageId] = useState("");
  const [date, setDate] = useState("");
  const [pax, setPax] = useState(2);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [requests, setRequests] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([{ ...blankParticipant }]);
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<any>(null);

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    tourService.getCustomerCareMeta(Number(customerId))
      .then(data => {
        setCustomer(data.customer);
        setPackages(data.packages);
        if (data.packages[0]) setPackageId(String(data.packages[0].id));
        setName(data.customer.name || "");
        setMobile(data.customer.mobile || "");
      })
      .catch((e: any) => setError(e?.response?.data?.message ?? "Could not load active packages"))
      .finally(() => setLoading(false));
  }, [customerId]);

  const selected = packages.find(p => p.id === Number(packageId));
  const minDate = useMemo(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10), []);

  // Live quote
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    tourService.quote(selected.id, pax)
      .then(q => { if (!cancelled) setQuote(q); })
      .catch(() => { if (!cancelled) setQuote(null); });
    return () => { cancelled = true; };
  }, [selected?.id, pax]);

  // Sync participant list size with pax
  useEffect(() => {
    setParticipants(prev => {
      if (prev.length === pax) return prev;
      if (prev.length < pax) {
        const add = Array.from({ length: pax - prev.length }, () => ({ ...blankParticipant }));
        return [...prev, ...add];
      }
      return prev.slice(0, pax);
    });
  }, [pax]);

  const updateParticipant = (idx: number, k: keyof Participant, v: string) => {
    setParticipants(prev => prev.map((p, i) => i === idx ? { ...p, [k]: v } : p));
  };

  const submit = async () => {
    if (!selected) { setError("Select a tour package."); return; }
    if (!date) { setError("Pick a travel start date."); return; }
    if (!name.trim()) { setError("Enter the primary traveller's name."); return; }
    if (participants.some(p => !p.name.trim())) { setError("All participants need a name."); return; }
    setSubmitting(true);
    setError("");
    try {
      const result = await tourService.createCustomerCareBooking(Number(customerId), {
        package_id: selected.id,
        travel_start_date: date,
        persons_count: pax,
        special_requests: requests || null,
        participants: participants.map(p => ({
          participant_name: p.name.trim(),
          mobile: p.mobile.trim() || null,
          age: p.age ? Number(p.age) : null,
          gender: p.gender || null,
        })),
      });
      setSuccess(result);
      enqueueSnackbar("Tour booking created", { variant: "success" });
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.response?.data?.detail ?? "Could not create tour booking");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Box sx={{ display: "grid", placeItems: "center", minHeight: 400 }}><CircularProgress /></Box>;

  // ── Success view ─────────────────────────────────────────────
  if (success) return (
    <Box maxWidth={680} mx="auto" mt={6}>
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 5, textAlign: "center" }}>
          <Avatar sx={{ width: 72, height: 72, mx: "auto", bgcolor: "success.main" }}><CheckCircle sx={{ fontSize: 40 }} /></Avatar>
          <Typography variant="h5" fontWeight={900} sx={{ mt: 2 }}>Tour booking created</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>Booking created for {customer?.name || `Customer #${customerId}`}.</Typography>
          <Stack spacing={1.5} sx={{ mt: 3, textAlign: "left" }}>
            <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Booking number</Typography><Typography fontWeight={800} fontFamily="monospace">{success.booking_number}</Typography></Stack>
            <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Master booking</Typography><Typography fontWeight={800} fontFamily="monospace">{success.master_booking_number || "—"}</Typography></Stack>
            <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Total amount</Typography><Typography fontWeight={800} color="success.main">{INR(success.total_amount)}</Typography></Stack>
            <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Status</Typography><Chip label="Confirmed" color="success" size="small" /></Stack>
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ mt: 4 }} justifyContent="center">
            <Button variant="outlined" onClick={() => navigate("/customer-care")}>Back to customer care</Button>
            <Button variant="contained" endIcon={<OpenInNew />} onClick={() => navigate(`/bookings/${success.master_booking_id || ""}/tour/${success.id}`)}>Open booking</Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );

  // ── Form view ────────────────────────────────────────────────
  return (
    <Box maxWidth={1200} mx="auto">
      <Button startIcon={<ArrowBack />} onClick={() => navigate("/customer-care")} sx={{ mb: 2 }}>Back to customer care</Button>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.1), display: "grid", placeItems: "center" }}>
          <TravelExplore color="primary" />
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={900}>Book a tour package</Typography>
          <Typography color="text.secondary">Create a confirmed tour booking for <b>{customer?.name || `Customer #${customerId}`}</b></Typography>
        </Box>
      </Stack>

      {packages.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>No active tour packages are available right now. Create a package in the Tours console first.</Alert>
      )}

      {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        {/* Left: trip selection */}
        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ borderRadius: 3, mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>Trip selection</Typography>
              <Stack spacing={2}>
                <TextField select label="Active tour package" value={packageId} onChange={e => { setPackageId(e.target.value); setPax(2); }} fullWidth required>
                  {packages.map(p => <MenuItem key={p.id} value={p.id}>{p.package_name} · {p.destination} · {p.duration_days}D/{p.duration_nights}N</MenuItem>)}
                </TextField>

                {selected && (
                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.06), border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}` }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      {selected.media?.find(m => m.is_primary)?.media_url && (
                        <Avatar src={selected.media.find(m => m.is_primary)!.media_url} variant="rounded" sx={{ width: 80, height: 80, borderRadius: 2 }} />
                      )}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontWeight={800}>{selected.package_name}</Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap">
                          <Chip icon={<LocationOn fontSize="small" />} label={selected.destination} size="small" />
                          <Chip icon={<AccessTime fontSize="small" />} label={`${selected.duration_days}D/${selected.duration_nights}N`} size="small" />
                          <Chip icon={<Groups fontSize="small" />} label={`${selected.minimum_persons}–${selected.maximum_persons || "∞"} pax`} size="small" />
                        </Stack>
                        {selected.short_description && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{selected.short_description}</Typography>}
                      </Box>
                    </Stack>
                  </Box>
                )}

                <Stack direction="row" spacing={2}>
                  <TextField label="Travel start date" type="date" InputLabelProps={{ shrink: true }} value={date} onChange={e => setDate(e.target.value)} inputProps={{ min: minDate }} fullWidth required />
                  <TextField select label="Travellers" value={pax} onChange={e => setPax(Number(e.target.value))} fullWidth required>
                    {Array.from({ length: Math.max(1, Math.min(selected?.maximum_persons || 12, 12) - (selected?.minimum_persons || 1) + 1) }, (_, i) => (selected?.minimum_persons || 1) + i).map(n => <MenuItem key={n} value={n}>{n} travellers</MenuItem>)}
                  </TextField>
                </Stack>

                <TextField label="Special requests" value={requests} onChange={e => setRequests(e.target.value)} multiline minRows={3} fullWidth placeholder="e.g. Vegetarian meals, early check-in, wheelchair access" />
              </Stack>
            </CardContent>
          </Card>

          {/* Participants */}
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={800}>Participants ({participants.length})</Typography>
                <Button size="small" startIcon={<Add />} onClick={() => setParticipants(p => [...p, { ...blankParticipant }])} disabled={participants.length >= (selected?.maximum_persons || 12)}>Add</Button>
              </Stack>
              <Stack spacing={1.5}>
                {participants.map((p, idx) => (
                  <Box key={idx} sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: idx === 0 ? "primary.main" : "grey.400" }}>{idx + 1}</Avatar>
                      <Typography variant="body2" fontWeight={700}>{idx === 0 ? "Primary traveller" : `Participant ${idx + 1}`}</Typography>
                      {participants.length > 1 && <IconButton size="small" sx={{ ml: "auto" }} onClick={() => setParticipants(prev => prev.filter((_, i) => i !== idx))}><Delete fontSize="small" /></IconButton>}
                    </Stack>
                    <Grid container spacing={1.5}>
                      <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Full name *" value={p.name} onChange={e => updateParticipant(idx, "name", e.target.value)} InputProps={{ startAdornment: <Person fontSize="small" sx={{ mr: 0.5, color: "action.active" }} /> }} /></Grid>
                      <Grid item xs={6} sm={3}><TextField fullWidth size="small" label="Mobile" value={p.mobile} onChange={e => updateParticipant(idx, "mobile", e.target.value)} InputProps={{ startAdornment: <Phone fontSize="small" sx={{ mr: 0.5, color: "action.active" }} /> }} /></Grid>
                      <Grid item xs={3} sm={1.5}><TextField fullWidth size="small" type="number" label="Age" value={p.age} onChange={e => updateParticipant(idx, "age", e.target.value)} /></Grid>
                      <Grid item xs={3} sm={1.5}>
                        <TextField select fullWidth size="small" label="Gender" value={p.gender} onChange={e => updateParticipant(idx, "gender", e.target.value)}>
                          <MenuItem value="">—</MenuItem>
                          <MenuItem value="MALE">M</MenuItem>
                          <MenuItem value="FEMALE">F</MenuItem>
                          <MenuItem value="OTHER">Other</MenuItem>
                        </TextField>
                      </Grid>
                    </Grid>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Right: summary */}
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ borderRadius: 3, position: "sticky", top: 16 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={800}>Booking summary</Typography>
              {selected && quote ? (
                <Stack spacing={1.5} sx={{ mt: 2 }}>
                  <SummaryRow label="Package" value={selected.package_name} />
                  <SummaryRow label="Destination" value={selected.destination} icon={<LocationOn fontSize="small" />} />
                  <SummaryRow label="Duration" value={`${selected.duration_days} days / ${selected.duration_nights} nights`} icon={<AccessTime fontSize="small" />} />
                  <SummaryRow label="Travel date" value={date || "—"} icon={<CalendarMonth fontSize="small" />} />
                  <SummaryRow label="Travellers" value={`${pax} ${pax === 1 ? "person" : "people"}`} icon={<Groups fontSize="small" />} />
                  <Divider />
                  <SummaryRow label="Package total" value={INR(quote.total_amount)} bold />
                  <SummaryRow label="Platform commission" value={`${INR(quote.platform_commission)} (${quote.commission_percent}%)`} color="success.main" />
                  <SummaryRow label="Partner payout" value={INR(quote.partner_payout)} />
                  <Divider />
                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.success.main, 0.08), border: `1px solid ${alpha(theme.palette.success.main, 0.2)}` }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Info color="success" fontSize="small" />
                      <Typography variant="body2" color="success.dark">This booking is created as <b>CONFIRMED</b> by default. Use the booking detail page to adjust status.</Typography>
                    </Stack>
                  </Box>
                </Stack>
              ) : (
                <Alert severity="info" sx={{ mt: 2 }}>Pick a package to see pricing.</Alert>
              )}

              <Button fullWidth size="large" variant="contained" onClick={submit} disabled={submitting || packages.length === 0} startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />} sx={{ mt: 3 }}>
                {submitting ? "Creating…" : "Create booking"}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

function SummaryRow({ label, value, icon, bold, color }: { label: string; value: React.ReactNode; icon?: React.ReactNode; bold?: boolean; color?: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ color: "text.secondary" }}>
        {icon}
        <Typography variant="body2">{label}</Typography>
      </Stack>
      <Typography variant="body2" fontWeight={bold ? 900 : 700} color={color}>{value}</Typography>
    </Stack>
  );
}
