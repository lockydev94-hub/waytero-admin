// ============================================================
// WAYTERO ADMIN — PARTNERS PAGE  (Premium v3)
// Doc Ref: BRD Part 2 §17-22 | DB Schema Part 2 §4-19
//          Partner API Doc §3-11
// Status flow: PENDING → UNDER_REVIEW → DOCUMENT_PENDING → APPROVED → ACTIVE → SUSPENDED → BLOCKED
// Partner Types: INDIVIDUAL | COMPANY
// Service Types: CAB | HOTEL | TOUR  (DB Schema Part 2 §8)
// City name fix: cities list passed as prop into KycModal to avoid stale render
// ============================================================

import React, { useState, useMemo } from "react";
import {
  Box, Typography, Card, CardContent, Chip, Button, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TextField, MenuItem, Select, FormControl, InputLabel,
  Stack, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogActions, LinearProgress, Alert, Avatar, Grid,
  Paper, Tab, Tabs, CircularProgress, Skeleton,
  Stepper, Step, StepLabel, Divider,
  FormControlLabel, Checkbox, InputAdornment, Badge as MuiBadge,
  useTheme, alpha,
} from "@mui/material";
import {
  Search, Refresh, Add, AssignmentInd, CloudUpload, CheckCircle,
  Cancel, Block, PlayArrow, Pause, Visibility, AccountBalance,
  History, Close, Person, Business, Phone, Email, LocationCity,
  Edit, Image, OpenInNew, CheckCircleOutline, DirectionsCar,
  Hotel, Tour, Badge, CreditCard, AccountBox, ArrowBack,
  ArrowForward, Save, GpsFixed, Description, TaskAlt,
  GroupWork, ErrorOutline, HourglassTop, Apartment,
  AccountBalanceWallet, AddCard, ArrowUpward, ArrowDownward, CurrencyRupee,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  partnerService,
  AdminPartnerListItem,
  PartnerDetail,
  PartnerDocument,
  PartnerBankAccount,
  STATUS_META,
  DOCUMENT_TYPES,
  DOCUMENT_META,
  PARTNER_STATUSES,
  SERVICE_TYPES,
} from "../../services/partner.service";
import { settingsService, City, State, ServiceTypeRecord } from "../../services/settings.service";
import { walletService } from "../../services/wallet.service";

// ── States helper ─────────────────────────────────────────────────────────────
function useStates() {
  return useQuery<State[]>({
    queryKey: ["states"],
    queryFn: () => (settingsService as any).getStates(),
    staleTime: 10 * 60 * 1000,
  });
}

// ── City helpers ──────────────────────────────────────────────────────────────
function useCities() {
  return useQuery<City[]>({
    queryKey: ["cities"],
    queryFn: () => (settingsService as any).getCities(),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Service Types hook (dynamic from DB) ─────────────────────────────────────
function useServiceTypes() {
  return useQuery<ServiceTypeRecord[]>({
    queryKey: ["service-types"],
    queryFn: () => (settingsService as any).getServiceTypes(true),
    staleTime: 10 * 60 * 1000,
  });
}

function cityLabel(cityId: number | null, cities: City[]): string {
  if (!cityId) return "—";
  const city = cities.find((c) => c.id === cityId);
  if (!city) return `City ${cityId}`;
  return city.state_name ? `${city.name}, ${city.state_name}` : city.name;
}

function CityName({ cityId, cities }: { cityId: number | null; cities: City[] }) {
  return <>{cityLabel(cityId, cities)}</>;
}

// ── Status chip ───────────────────────────────────────────────────────────────
function StatusChip({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: "default" as const };
  return (
    <Chip label={meta.label} color={meta.color} size="small"
      sx={{ fontWeight: 700, letterSpacing: 0.3, minWidth: 112 }} />
  );
}

// ── Actions per status ────────────────────────────────────────────────────────
type ActionDef = {
  label: string; key: string; icon: React.ReactNode;
  color?: "primary" | "success" | "error" | "warning" | "info" | "secondary";
  variant?: "contained" | "outlined";
};
function getActions(status: string): ActionDef[] {
  switch (status) {
    case "PENDING":       return [
      { key: "review",           label: "Start KYC Review",  icon: <AssignmentInd fontSize="small" />, color: "primary"                },
      { key: "block",            label: "Block Partner",     icon: <Block fontSize="small" />,         color: "error",  variant: "outlined" },
    ];
    case "UNDER_REVIEW":  return [
      { key: "approve",          label: "Approve KYC",       icon: <CheckCircle fontSize="small" />,   color: "success"                },
      { key: "document_pending", label: "Request More Docs", icon: <CloudUpload fontSize="small" />,   color: "warning"                },
      { key: "block",            label: "Block Partner",     icon: <Block fontSize="small" />,         color: "error",  variant: "outlined" },
    ];
    case "DOCUMENT_PENDING": return [
      { key: "approve",          label: "Approve KYC",       icon: <CheckCircle fontSize="small" />,   color: "success"                },
      { key: "review",           label: "Back to Review",    icon: <AssignmentInd fontSize="small" />, color: "info"                   },
      { key: "block",            label: "Block Partner",     icon: <Block fontSize="small" />,         color: "error",  variant: "outlined" },
    ];
    case "APPROVED":      return [
      { key: "activate",         label: "Activate Partner",  icon: <PlayArrow fontSize="small" />,     color: "success"                },
      { key: "suspend",          label: "Suspend",           icon: <Pause fontSize="small" />,         color: "warning"                },
      { key: "block",            label: "Block Partner",     icon: <Block fontSize="small" />,         color: "error",  variant: "outlined" },
    ];
    case "ACTIVE":        return [
      { key: "suspend",          label: "Suspend",           icon: <Pause fontSize="small" />,         color: "warning"                },
      { key: "block",            label: "Block Partner",     icon: <Block fontSize="small" />,         color: "error",  variant: "outlined" },
    ];
    case "SUSPENDED":     return [
      { key: "unsuspend",        label: "Re-Activate",       icon: <PlayArrow fontSize="small" />,     color: "success"                },
      { key: "block",            label: "Block Partner",     icon: <Block fontSize="small" />,         color: "error",  variant: "outlined" },
    ];
    default: return [];
  }
}

// ── Reason dialog ─────────────────────────────────────────────────────────────
function ReasonDialog({ open, actionLabel, onConfirm, onClose, loading, actionColor = "primary" }:
  { open: boolean; actionLabel: string; onConfirm: (r: string) => void; onClose: () => void; loading: boolean; actionColor?: any }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>{actionLabel}</DialogTitle>
      <DialogContent>
        <TextField autoFocus label="Reason / Remarks (optional)" multiline rows={3} fullWidth
          value={reason} onChange={(e) => setReason(e.target.value)} sx={{ mt: 1 }} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={loading} color="inherit">Cancel</Button>
        <Button variant="contained" color={actionColor}
          onClick={() => { onConfirm(reason); setReason(""); }}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
          sx={{ minWidth: 100 }}>
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Service type config ───────────────────────────────────────────────────────
const SERVICE_ICONS: Record<string, React.ReactNode> = {
  CAB:   <DirectionsCar />,
  HOTEL: <Hotel />,
  TOUR:  <Tour />,
};
const SERVICE_LABELS: Record<string, string> = {
  CAB: "Cab / Transport", HOTEL: "Hotel / Accommodation", TOUR: "Tour / Travel Package",
};
const SERVICE_DESC: Record<string, string> = {
  CAB: "Cab rentals, airport transfers, outstation trips",
  HOTEL: "Hotel bookings and accommodation services",
  TOUR: "Tour packages, sightseeing and travel itineraries",
};

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
      <Box sx={{ color: "primary.main" }}>{icon}</Box>
      <Typography variant="subtitle2" fontWeight={800} color="primary.main" letterSpacing={0.5}>
        {title}
      </Typography>
    </Box>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  REGISTER PARTNER DIALOG — Premium 3-step stepper
//  Step 1: Partner Identity & Contact
//  Step 2: Location & Business
//  Step 3: Services & Review
// ════════════════════════════════════════════════════════════════════════════
interface RegisterDialogProps { open: boolean; onClose: () => void; onDone: () => void; }

function RegisterPartnerDialog({ open, onClose, onDone }: RegisterDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const { data: cities = [], isLoading: citiesLoading } = useCities();
  const { data: dbServiceTypes = [] } = useServiceTypes();
  const { data: commissionGroups = [] } = useQuery({
    queryKey: ["commission-groups"],
    queryFn: () => (settingsService as any).getCommissionGroups() as Promise<Array<{ id: number; group_name: string; description: string | null; is_active: boolean; rules: any[] }>>,
    staleTime: 5 * 60 * 1000,
  });

  const [step, setStep] = useState(0);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const handleLogoSelect = (file: File) => {
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const { data: states = [] } = useStates();

  const [form, setForm] = useState({
    partner_type: "INDIVIDUAL" as "INDIVIDUAL" | "COMPANY",
    owner_name: "",
    business_name: "",
    mobile: "",
    email: "",
    city_id: "" as string | number,
    onboarding_source: "ADMIN",
    // Tax — COMPANY must provide GST (BRD Rule 14)
    gst_number: "",
    pan_number: "",
    gst_legal_name: "",
    gst_trade_name: "",
    // Office address — BRD Part 2 §20
    office_address_line_1: "",
    office_address_line_2: "",
    office_postal_code: "",
    services: [] as string[],
    commission_group_id: "" as string | number,
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const toggleService = (s: string) =>
    setForm((p) => ({
      ...p,
      services: p.services.includes(s) ? p.services.filter((x) => x !== s) : [...p.services, s],
    }));

  const mutation = useMutation({
    mutationFn: () =>
      partnerService.register({
        partner_type: form.partner_type,
        owner_name: form.owner_name.trim(),
        business_name: form.business_name.trim() || undefined,
        mobile: form.mobile.trim(),
        email: form.email.trim() || undefined,
        city_id: Number(form.city_id),
        onboarding_source: form.onboarding_source || undefined,
        gst_number: form.gst_number.trim() || undefined,
        pan_number: form.pan_number.trim() || undefined,
        gst_legal_name: form.gst_legal_name.trim() || undefined,
        gst_trade_name: form.gst_trade_name.trim() || undefined,
        office_address_line_1: form.office_address_line_1.trim() || undefined,
        office_address_line_2: form.office_address_line_2.trim() || undefined,
        office_city_id: form.city_id ? Number(form.city_id) : undefined,
        office_postal_code: form.office_postal_code.trim() || undefined,
        services: form.services.length > 0 ? form.services : undefined,
        commission_group_id: form.commission_group_id ? Number(form.commission_group_id) : undefined,
      }),
    onSuccess: async (res: any) => {
      // If a logo was selected, upload it now that we have a partner_id
      if (logoFile && res?.data?.partner_id) {
        setLogoUploading(true);
        try {
          await partnerService.uploadLogo(res.data.partner_id, logoFile);
          enqueueSnackbar("Partner registered with logo successfully", { variant: "success" });
        } catch {
          enqueueSnackbar("Partner registered — logo upload failed (retry from Edit)", { variant: "warning" });
        } finally {
          setLogoUploading(false);
        }
      } else {
        enqueueSnackbar("Partner registered successfully", { variant: "success" });
      }
      qc.invalidateQueries({ queryKey: ["admin-partners"] });
      resetAndClose();
      onDone();
    },
    onError: (err: any) =>
      enqueueSnackbar(err?.response?.data?.detail ?? "Registration failed", { variant: "error" }),
  });

  const resetAndClose = () => {
    setStep(0);
    setLogoFile(null);
    setLogoPreview(null);
    setForm({
      partner_type: "INDIVIDUAL", owner_name: "", business_name: "", mobile: "", email: "",
      city_id: "", onboarding_source: "ADMIN",
      gst_number: "", pan_number: "", gst_legal_name: "", gst_trade_name: "",
      office_address_line_1: "", office_address_line_2: "", office_postal_code: "",
      services: [], commission_group_id: "",
    });
    onClose();
  };

  // Step validation
  const step0Valid = form.owner_name.trim().length >= 2 && /^[6-9]\d{9}$/.test(form.mobile.trim());
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  const gstValid = !form.gst_number || gstRegex.test(form.gst_number);
  const gstRequired = form.partner_type === "COMPANY";
  const step1Valid = !!form.city_id &&
    (gstRequired ? (gstRegex.test(form.gst_number) && form.pan_number.trim().length >= 10) : gstValid);

  const selectedCity = cities.find((c) => c.id === Number(form.city_id));

  const STEPS = ["Identity & Contact", "Location & Business", "Services & Review"];
  const STEP_ICONS = [<Person />, <LocationCity />, <GroupWork />];

  return (
    <Dialog open={open} onClose={resetAndClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 4, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.2)" } }}>

      {/* Premium Header */}
      <Box sx={{
        px: 3, py: 3,
        background: "linear-gradient(135deg, #0d1b6e 0%, #1a237e 50%, #283593 100%)",
        color: "white",
        position: "relative",
        overflow: "hidden",
      }}>
        <Box sx={{
          position: "absolute", top: -20, right: -20, width: 120, height: 120,
          borderRadius: "50%", bgcolor: "rgba(255,255,255,0.05)",
        }} />
        <Box sx={{
          position: "absolute", bottom: -40, left: "40%", width: 180, height: 180,
          borderRadius: "50%", bgcolor: "rgba(255,255,255,0.03)",
        }} />
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="h6" fontWeight={800} letterSpacing={0.3}>Register New Partner</Typography>
            <Typography variant="caption" sx={{ opacity: 0.75 }}>
              Step {step + 1} of {STEPS.length} — {STEPS[step]}
            </Typography>
          </Box>
          <IconButton onClick={resetAndClose} sx={{ color: "white", mt: -0.5 }} size="small">
            <Close />
          </IconButton>
        </Box>

        {/* Progress bar */}
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: "flex", gap: 0.75 }}>
            {STEPS.map((_, i) => (
              <Box key={i} sx={{
                flex: 1, height: 3, borderRadius: 2,
                bgcolor: i <= step ? "white" : "rgba(255,255,255,0.25)",
                transition: "background 0.3s",
              }} />
            ))}
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
            {STEPS.map((label, i) => (
              <Typography key={i} variant="caption" sx={{ opacity: i <= step ? 1 : 0.45, fontSize: "0.65rem", fontWeight: i === step ? 700 : 400 }}>
                {label}
              </Typography>
            ))}
          </Box>
        </Box>
      </Box>

      <DialogContent sx={{ px: 3, pt: 3, pb: 1 }}>

        {/* ── Step 0: Identity & Contact ──────────────────────────────────── */}
        {step === 0 && (
          <Box>
            <SectionHeader icon={<Person fontSize="small" />} title="Partner Identity" />

            {/* Partner Type Cards */}
            <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
              {(["INDIVIDUAL", "COMPANY"] as const).map((type) => {
                const active = form.partner_type === type;
                return (
                  <Grid item xs={6} key={type}>
                    <Paper
                      onClick={() => setForm((p) => ({ ...p, partner_type: type, gst_number: "" }))}
                      variant="outlined"
                      sx={{
                        p: 1.75, borderRadius: 2.5, cursor: "pointer",
                        border: "2px solid",
                        borderColor: active ? "primary.main" : "divider",
                        bgcolor: active ? "primary.50" : "background.paper",
                        transition: "all 0.2s",
                        "&:hover": { borderColor: "primary.light" },
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                        <Box sx={{
                          width: 36, height: 36, borderRadius: 1.5, display: "flex",
                          alignItems: "center", justifyContent: "center",
                          bgcolor: active ? "primary.main" : "action.selected",
                          color: active ? "white" : "text.secondary",
                          flexShrink: 0,
                        }}>
                          {type === "INDIVIDUAL" ? <Person fontSize="small" /> : <Apartment fontSize="small" />}
                        </Box>
                        <Box>
                          <Typography variant="body2" fontWeight={700} fontSize="0.8rem">
                            {type === "INDIVIDUAL" ? "Individual" : "Company"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" fontSize="0.68rem">
                            {type === "INDIVIDUAL" ? "Solo operator" : "Registered entity"}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Owner / Contact Name *" fullWidth value={form.owner_name} onChange={set("owner_name")}
                  placeholder="Full legal name"
                  InputProps={{ startAdornment: <InputAdornment position="start"><Person fontSize="small" color="action" /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Business / Trade Name" fullWidth value={form.business_name} onChange={set("business_name")}
                  placeholder={form.partner_type === "COMPANY" ? "Company name" : "Optional"}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Business fontSize="small" color="action" /></InputAdornment> }}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 0.5 }}><Typography variant="caption" color="text.secondary">Contact Information</Typography></Divider>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Mobile Number *" fullWidth value={form.mobile} onChange={set("mobile")}
                  placeholder="10-digit number" inputProps={{ maxLength: 10 }}
                  error={form.mobile.length > 0 && !/^[6-9]\d{9}$/.test(form.mobile)}
                  helperText={form.mobile.length > 0 && !/^[6-9]\d{9}$/.test(form.mobile) ? "Enter valid 10-digit Indian mobile" : ""}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mr: 0.5 }}>
                          <Phone fontSize="small" color="action" />
                          <Typography variant="caption" fontWeight={700} color="text.secondary">+91</Typography>
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Email Address" fullWidth value={form.email} onChange={set("email")} type="email"
                  placeholder="Optional — for login & notifications"
                  helperText={form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? "Enter a valid email address" : ""}
                  error={!!form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Email fontSize="small" color="action" /></InputAdornment> }}
                />
              </Grid>
            </Grid>
          </Box>
        )}

        {/* ── Step 1: Location & Business ───────────────────────────────── */}
        {step === 1 && (
          <Box>
            {/* ── Logo Upload ─────────────────────────────────────────── */}
            <SectionHeader icon={<Image fontSize="small" />} title="Partner Logo" />
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2.5 }}>
              <Box sx={{
                width: 80, height: 80, borderRadius: 2.5,
                border: "2px dashed", borderColor: logoPreview ? "primary.main" : "divider",
                overflow: "hidden", flexShrink: 0, bgcolor: "action.hover",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {logoPreview
                  ? <img src={logoPreview} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <Image sx={{ color: "text.disabled", fontSize: 32 }} />}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Button variant="outlined" component="label" size="small" startIcon={<CloudUpload />} sx={{ borderRadius: 2 }}>
                  {logoFile ? logoFile.name.slice(0, 22) + (logoFile.name.length > 22 ? "…" : "") : "Upload Logo"}
                  <input hidden type="file" accept="image/*"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoSelect(f); }} />
                </Button>
                {logoFile && (
                  <Button size="small" color="error" onClick={() => { setLogoFile(null); setLogoPreview(null); }} sx={{ ml: 1 }}>
                    Remove
                  </Button>
                )}
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  PNG, JPG up to 2MB. Shown on partner profile and invoices.
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ mb: 2 }}><Typography variant="caption" color="text.secondary">Location</Typography></Divider>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Operating City *</InputLabel>
                  <Select
                    value={form.city_id}
                    label="Operating City *"
                    onChange={(e) => setForm((p) => ({ ...p, city_id: e.target.value as string }))}
                    disabled={citiesLoading}
                    startAdornment={<InputAdornment position="start"><GpsFixed fontSize="small" color="action" /></InputAdornment>}
                  >
                    {cities.filter((c) => c.is_active).map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{c.name}</Typography>
                          {c.state_name && <Typography variant="caption" color="text.secondary">{c.state_name}</Typography>}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ mb: 0.5 }}><Typography variant="caption" color="text.secondary">Office Address (same city)</Typography></Divider>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Address Line 1"
                  fullWidth
                  value={form.office_address_line_1}
                  onChange={(e) => setForm((p) => ({ ...p, office_address_line_1: e.target.value }))}
                  placeholder="Building, Street, Area"
                  InputProps={{ startAdornment: <InputAdornment position="start"><Apartment fontSize="small" color="action" /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  label="Address Line 2"
                  fullWidth
                  value={form.office_address_line_2}
                  onChange={(e) => setForm((p) => ({ ...p, office_address_line_2: e.target.value }))}
                  placeholder="Landmark, Floor, Suite (optional)"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Postal Code"
                  fullWidth
                  value={form.office_postal_code}
                  onChange={(e) => setForm((p) => ({ ...p, office_postal_code: e.target.value }))}
                  placeholder="6-digit PIN"
                  inputProps={{ maxLength: 6 }}
                />
              </Grid>

              {/* Tax / GST — required for COMPANY */}
              {form.partner_type === "COMPANY" && (
                <>
                  <Grid item xs={12}>
                    <Divider>
                      <Typography variant="caption" color="text.secondary">
                        Tax Information — Required for Company
                      </Typography>
                    </Divider>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="GST Number *"
                      fullWidth
                      required
                      value={form.gst_number}
                      onChange={(e) => setForm((p) => ({ ...p, gst_number: e.target.value.toUpperCase() }))}
                      placeholder="22AAAAA0000A1Z5"
                      inputProps={{ maxLength: 15 }}
                      error={!!form.gst_number && !gstRegex.test(form.gst_number)}
                      helperText={
                        !form.gst_number
                          ? "Required for company partners (BRD Rule 14)"
                          : !gstRegex.test(form.gst_number)
                          ? "Invalid GST — expected format: 22AAAAA0000A1Z5"
                          : "✓ Valid GSTIN"
                      }
                      FormHelperTextProps={{ sx: { color: form.gst_number && gstRegex.test(form.gst_number) ? "success.main" : undefined } }}
                      InputProps={{
                        startAdornment: <InputAdornment position="start"><CreditCard fontSize="small" color="action" /></InputAdornment>,
                        endAdornment: form.gst_number && gstRegex.test(form.gst_number)
                          ? <InputAdornment position="end"><CheckCircleOutline color="success" fontSize="small" /></InputAdornment>
                          : undefined,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="PAN Number *"
                      fullWidth
                      required
                      value={form.pan_number}
                      onChange={(e) => setForm((p) => ({ ...p, pan_number: e.target.value.toUpperCase() }))}
                      placeholder="ABCDE1234F"
                      inputProps={{ maxLength: 10 }}
                      error={!!form.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.pan_number)}
                      helperText={
                        !form.pan_number
                          ? "Required for company partners"
                          : !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.pan_number)
                          ? "Invalid PAN format — expected: ABCDE1234F"
                          : "✓ Valid PAN"
                      }
                      FormHelperTextProps={{ sx: { color: form.pan_number && /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.pan_number) ? "success.main" : undefined } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="GST Legal Name"
                      fullWidth
                      value={form.gst_legal_name}
                      onChange={(e) => setForm((p) => ({ ...p, gst_legal_name: e.target.value }))}
                      placeholder="Legal name as per GST certificate"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Trade Name"
                      fullWidth
                      value={form.gst_trade_name}
                      onChange={(e) => setForm((p) => ({ ...p, gst_trade_name: e.target.value }))}
                      placeholder="Trade / brand name (if different)"
                    />
                  </Grid>
                </>
              )}

              {/* Individual — optional GST */}
              {form.partner_type === "INDIVIDUAL" && (
                <>
                  <Grid item xs={12}>
                    <Divider sx={{ mb: 0.5 }}><Typography variant="caption" color="text.secondary">Tax (Optional for Individual)</Typography></Divider>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="GST Number"
                      fullWidth
                      value={form.gst_number}
                      onChange={(e) => setForm((p) => ({ ...p, gst_number: e.target.value.toUpperCase() }))}
                      placeholder="22AAAAA0000A1Z5"
                      inputProps={{ maxLength: 15 }}
                      error={!!form.gst_number && !gstRegex.test(form.gst_number)}
                      helperText={form.gst_number && !gstRegex.test(form.gst_number) ? "Invalid GST format" : "Optional — can be added via KYC Documents later"}
                      InputProps={{ startAdornment: <InputAdornment position="start"><CreditCard fontSize="small" color="action" /></InputAdornment> }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="PAN Number"
                      fullWidth
                      value={form.pan_number}
                      onChange={(e) => setForm((p) => ({ ...p, pan_number: e.target.value.toUpperCase() }))}
                      placeholder="ABCDE1234F"
                      inputProps={{ maxLength: 10 }}
                    />
                  </Grid>
                </>
              )}

              <Grid item xs={12}>
                <Divider sx={{ my: 0.5 }}><Typography variant="caption" color="text.secondary">Onboarding</Typography></Divider>
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Onboarding Source</InputLabel>
                  <Select
                    value={form.onboarding_source}
                    label="Onboarding Source"
                    onChange={(e) => setForm((p) => ({ ...p, onboarding_source: e.target.value }))}
                  >
                    {[
                      { value: "ADMIN",       label: "Admin Portal",   sub: "Registered directly by admin" },
                      { value: "WEBSITE",     label: "Website",        sub: "Self-registered via web" },
                      { value: "MOBILE_APP",  label: "Mobile App",     sub: "Self-registered via app" },
                      { value: "REFERRAL",    label: "Referral",       sub: "Referred by existing partner" },
                      { value: "FIELD_AGENT", label: "Field Agent",    sub: "Onboarded by field executive" },
                    ].map(({ value, label, sub }) => (
                      <MenuItem key={value} value={value}>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{label}</Typography>
                          <Typography variant="caption" color="text.secondary">{sub}</Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ my: 0.5 }}><Typography variant="caption" color="text.secondary">Commission</Typography></Divider>
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Commission Group</InputLabel>
                  <Select
                    value={form.commission_group_id}
                    label="Commission Group"
                    onChange={(e) => setForm((p) => ({ ...p, commission_group_id: e.target.value }))}
                  >
                    <MenuItem value=""><em>None — assign later</em></MenuItem>
                    {commissionGroups.filter((g) => g.is_active).map((g) => (
                      <MenuItem key={g.id} value={g.id}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 2 }}>
                          <Box>
                            <Typography variant="body2" fontWeight={700}>{g.group_name}</Typography>
                            {g.description && <Typography variant="caption" color="text.secondary">{g.description}</Typography>}
                          </Box>
                          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                            {g.rules.slice(0, 3).map((r: any) => (
                              <Typography key={r.id} variant="caption" color="primary.main" fontWeight={600}>
                                {r.service_type}: {r.commission_value}{r.commission_type === "PERCENTAGE" ? "%" : " ₹"}
                              </Typography>
                            ))}
                          </Box>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
                    Commission rates are determined by the selected group
                  </Typography>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* ── Step 2: Services & Review ──────────────────────────────────── */}
        {step === 2 && (
          <Box>
            <SectionHeader icon={<GroupWork fontSize="small" />} title="Services" />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select the services this partner will provide. You can update these later.
            </Typography>

            <Stack spacing={1.25} sx={{ mb: 3 }}>
              {(dbServiceTypes.length > 0 ? dbServiceTypes : []).map((st) => {
                const s = st.type_code;
                const selected = form.services.includes(s);
                const icon = SERVICE_ICONS[s] ?? <GroupWork />;
                const label = SERVICE_LABELS[s] ?? st.label;
                const desc = SERVICE_DESC[s] ?? (st.description || `${st.label} services`);
                return (
                  <Paper
                    key={s}
                    variant="outlined"
                    onClick={() => toggleService(s)}
                    sx={{
                      p: 2, borderRadius: 2.5, cursor: "pointer",
                      border: "2px solid",
                      borderColor: selected ? "primary.main" : "divider",
                      bgcolor: selected ? "primary.50" : "background.paper",
                      transition: "all 0.15s",
                      "&:hover": { borderColor: "primary.light" },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Box sx={{
                        width: 44, height: 44, borderRadius: 2, display: "flex",
                        alignItems: "center", justifyContent: "center",
                        bgcolor: selected ? "primary.main" : "action.selected",
                        color: selected ? "white" : "text.secondary",
                        flexShrink: 0,
                        overflow: "hidden",
                      }}>
                        {st.icon_url
                          ? <img src={st.icon_url} alt={label} style={{ width: 28, height: 28, objectFit: "contain" }} />
                          : icon}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" fontWeight={700}>{label}</Typography>
                        <Typography variant="caption" color="text.secondary">{desc}</Typography>
                      </Box>
                      {selected && <TaskAlt color="primary" />}
                    </Box>
                  </Paper>
                );
              })}
            </Stack>

            {/* Review Summary */}
            <Divider sx={{ mb: 2 }}><Typography variant="caption" color="text.secondary">Review Summary</Typography></Divider>

            <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: "hidden" }}>
              <Box sx={{ px: 2.5, py: 1.5, bgcolor: "action.hover", borderBottom: 1, borderColor: "divider" }}>
                <Typography variant="subtitle2" fontWeight={700}>Registration Details</Typography>
              </Box>
              <Grid container sx={{ p: 2 }} spacing={1.5}>
                {[
                  { label: "Partner Type",  value: form.partner_type },
                  { label: "Owner Name",    value: form.owner_name || "—" },
                  { label: "Business Name", value: form.business_name || "—" },
                  { label: "Mobile",        value: form.mobile ? `+91 ${form.mobile}` : "—" },
                  { label: "Email",         value: form.email || "—" },
                  { label: "City",          value: selectedCity ? `${selectedCity.name}${selectedCity.state_name ? `, ${selectedCity.state_name}` : ""}` : "—" },
                  ...(form.gst_number ? [{ label: "GST Number", value: form.gst_number }] : []),
                  ...(form.pan_number ? [{ label: "PAN Number", value: form.pan_number }] : []),
                  ...(form.office_address_line_1 ? [{ label: "Office Address", value: [form.office_address_line_1, form.office_address_line_2, form.office_postal_code].filter(Boolean).join(", ") }] : []),
                  { label: "Source",        value: form.onboarding_source },
                  { label: "Services",      value: form.services.length > 0 ? form.services.join(", ") : "None selected" },
                  { label: "Commission Group", value: form.commission_group_id ? (commissionGroups.find((g) => g.id === Number(form.commission_group_id))?.group_name ?? "—") : "Not assigned" },
                ].map(({ label, value }) => (
                  <Grid item xs={6} key={label}>
                    <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{value}</Typography>
                  </Grid>
                ))}
              </Grid>
              {form.services.length > 0 && (
                <Box sx={{ px: 2.5, pb: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>Services</Typography>
                  <Stack direction="row" gap={0.75} flexWrap="wrap">
                    {form.services.map((s) => {
                      const st = dbServiceTypes.find(x => x.type_code === s);
                      const label = SERVICE_LABELS[s] ?? st?.label ?? s;
                      const icon = SERVICE_ICONS[s] ?? <GroupWork fontSize="small" />;
                      return (
                        <Chip key={s} label={label} color="primary" size="small"
                          icon={icon as any} sx={{ fontWeight: 600 }} />
                      );
                    })}
                  </Stack>
                </Box>
              )}
            </Paper>

            <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
              Partner will be registered with <strong>PENDING</strong> status. KYC review and activation follow.
            </Alert>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 1 }}>
        <Button onClick={resetAndClose} color="inherit" disabled={mutation.isPending} sx={{ borderRadius: 2 }}>
          Cancel
        </Button>
        {step > 0 && (
          <Button onClick={() => setStep((s) => s - 1)} startIcon={<ArrowBack />}
            disabled={mutation.isPending} sx={{ borderRadius: 2 }}>
            Back
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        {step < 2 ? (
          <Button
            variant="contained"
            onClick={() => setStep((s) => s + 1)}
            disabled={(step === 0 && !step0Valid) || (step === 1 && !step1Valid)}
            endIcon={<ArrowForward />}
            sx={{ borderRadius: 2, px: 3 }}
          >
            Continue
          </Button>
        ) : (
          <Button
            variant="contained" color="primary"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            startIcon={mutation.isPending ? <CircularProgress size={16} /> : <Save />}
            sx={{ borderRadius: 2, px: 3 }}
          >
            Register Partner
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  EDIT PARTNER DIALOG — Advanced sectioned with services management
// ════════════════════════════════════════════════════════════════════════════
interface EditDialogProps {
  open: boolean;
  partner: PartnerDetail | undefined;
  cities: City[];
  onClose: () => void;
  onSaved: () => void;
}
function EditPartnerDialog({ open, partner, cities, onClose, onSaved }: EditDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [editTab, setEditTab] = useState(0);
  const { data: dbServiceTypes = [] } = useServiceTypes();

  // Services tab state
  const [editServices, setEditServices] = useState<string[]>([]);
  const [servicesSaving, setServicesSaving] = useState(false);

  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
  const [editLogoUploading, setEditLogoUploading] = useState(false);

  const handleEditLogoSelect = (file: File) => {
    setEditLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setEditLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleEditLogoUpload = async () => {
    if (!editLogoFile || !partner) return;
    setEditLogoUploading(true);
    try {
      await partnerService.uploadLogo(partner.id, editLogoFile);
      enqueueSnackbar("Logo updated successfully", { variant: "success" });
      setEditLogoFile(null); setEditLogoPreview(null);
      onSaved();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.detail ?? "Logo upload failed", { variant: "error" });
    } finally { setEditLogoUploading(false); }
  };

  const [form, setForm] = useState({
    owner_name: "", business_name: "", mobile: "", email: "",
    city_id: "", partner_type: "INDIVIDUAL", onboarding_source: "",
    // Office address
    office_address_line_1: "", office_address_line_2: "", office_postal_code: "",
    // Tax / GST
    gst_number: "", pan_number: "", gst_legal_name: "", gst_trade_name: "",
  });

  React.useEffect(() => {
    if (partner && open) {
      setEditTab(0);
      setEditLogoFile(null); setEditLogoPreview(null);
      // Seed services from partner detail (partner.services is [{service_type, is_active}])
      const activeServices = ((partner as any).services ?? [])
        .filter((s: any) => s.is_active)
        .map((s: any) => s.service_type as string);
      setEditServices(activeServices);
      setForm({
        owner_name:           partner.owner_name ?? "",
        business_name:        partner.business_name ?? "",
        mobile:               partner.mobile ?? "",
        email:                partner.email ?? "",
        city_id:              String(partner.city_id ?? ""),
        partner_type:         partner.partner_type ?? "INDIVIDUAL",
        onboarding_source:    partner.onboarding_source ?? "",
        office_address_line_1: partner.office_address_line_1 ?? "",
        office_address_line_2: partner.office_address_line_2 ?? "",
        office_postal_code:   partner.office_postal_code ?? "",
        gst_number:           partner.gst_details?.gst_number ?? "",
        pan_number:           partner.gst_details?.pan_number ?? "",
        gst_legal_name:       partner.gst_details?.legal_name ?? "",
        gst_trade_name:       partner.gst_details?.trade_name ?? "",
      });
    }
  }, [partner, open]);

  const mutation = useMutation({
    mutationFn: () =>
      partnerService.editPartner(partner!.id, {
        owner_name:           form.owner_name    || undefined,
        business_name:        form.business_name || undefined,
        mobile:               form.mobile        || undefined,
        email:                form.email         || undefined,
        city_id:              form.city_id ? Number(form.city_id) : undefined,
        partner_type:         form.partner_type  || undefined,
        onboarding_source:    form.onboarding_source || undefined,
        office_address_line_1: form.office_address_line_1 || undefined,
        office_address_line_2: form.office_address_line_2 || undefined,
        office_city_id:       form.city_id ? Number(form.city_id) : undefined,
        office_postal_code:   form.office_postal_code || undefined,
        gst_number:           form.gst_number || undefined,
        pan_number:           form.pan_number || undefined,
        gst_legal_name:       form.gst_legal_name || undefined,
        gst_trade_name:       form.gst_trade_name || undefined,
      }),
    onSuccess: () => {
      enqueueSnackbar("Partner details updated successfully", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin-partners"] });
      onSaved();
      onClose();
    },
    onError: (err: any) =>
      enqueueSnackbar(err?.response?.data?.detail ?? "Update failed", { variant: "error" }),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const selectedCity = cities.find((c) => c.id === Number(form.city_id));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 4, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.18)" } }}>

      {/* Header */}
      <Box sx={{
        px: 3, py: 2.5,
        background: "linear-gradient(135deg, #2e3c5f 0%, #37474f 60%, #455a64 100%)",
        color: "white",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ bgcolor: "rgba(255,255,255,0.12)", borderRadius: 1.5, p: 0.75, display: "flex" }}>
            <Edit fontSize="small" />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={800} fontSize="1rem">Edit Partner Profile</Typography>
            <Typography variant="caption" sx={{ opacity: 0.75 }}>
              {partner?.partner_code} · {partner?.partner_type} · {STATUS_META[partner?.status ?? ""]?.label ?? partner?.status}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: "white" }} size="small"><Close /></IconButton>
      </Box>

      {/* Edit Tabs */}
      <Tabs value={editTab} onChange={(_, v) => setEditTab(v)} variant="scrollable" scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.default" }}>
        <Tab label="Basic Info" icon={<Person fontSize="small" />} iconPosition="start" sx={{ minHeight: 48, fontSize: "0.8rem" }} />
        <Tab label="Contact" icon={<Phone fontSize="small" />} iconPosition="start" sx={{ minHeight: 48, fontSize: "0.8rem" }} />
        <Tab label="Location" icon={<LocationCity fontSize="small" />} iconPosition="start" sx={{ minHeight: 48, fontSize: "0.8rem" }} />
        <Tab label="Tax & Address" icon={<CreditCard fontSize="small" />} iconPosition="start"
          sx={{ minHeight: 48, fontSize: "0.8rem", color: partner?.partner_type === "COMPANY" ? "warning.main" : undefined }} />
        <Tab label="Logo" icon={<Image fontSize="small" />} iconPosition="start" sx={{ minHeight: 48, fontSize: "0.8rem" }} />
        <Tab label="Services" icon={<GroupWork fontSize="small" />} iconPosition="start"
          sx={{ minHeight: 48, fontSize: "0.8rem", color: editServices.length === 0 ? "warning.main" : undefined }} />
      </Tabs>

      <DialogContent sx={{ p: 0 }}>

        {/* ── Tab 0: Basic Info ──────────────────────────────────────── */}
        {editTab === 0 && (
          <Box sx={{ p: 3 }}>
            <SectionHeader icon={<AccountBox fontSize="small" />} title="Partner Identity" />
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Partner Type</InputLabel>
                  <Select value={form.partner_type} label="Partner Type"
                    onChange={(e) => setForm((p) => ({ ...p, partner_type: e.target.value }))}>
                    <MenuItem value="INDIVIDUAL">
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Person fontSize="small" color="primary" />
                        <Box>
                          <Typography variant="body2" fontWeight={700}>Individual Partner</Typography>
                          <Typography variant="caption" color="text.secondary">Solo cab operator, tour agent</Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                    <MenuItem value="COMPANY">
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Business fontSize="small" color="secondary" />
                        <Box>
                          <Typography variant="body2" fontWeight={700}>Company Partner</Typography>
                          <Typography variant="caption" color="text.secondary">Registered business entity</Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Owner / Contact Name" fullWidth value={form.owner_name} onChange={set("owner_name")}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Person fontSize="small" color="action" /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Business Name" fullWidth value={form.business_name} onChange={set("business_name")}
                  helperText="Legal business / trade name"
                  InputProps={{ startAdornment: <InputAdornment position="start"><Business fontSize="small" color="action" /></InputAdornment> }}
                />
              </Grid>
            </Grid>
          </Box>
        )}

        {/* ── Tab 1: Contact ────────────────────────────────────────── */}
        {editTab === 1 && (
          <Box sx={{ p: 3 }}>
            <SectionHeader icon={<Phone fontSize="small" />} title="Contact Details" />
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Mobile Number" fullWidth value={form.mobile} onChange={set("mobile")}
                  inputProps={{ maxLength: 10 }}
                  error={form.mobile.length > 0 && form.mobile.length !== 10}
                  helperText={form.mobile.length > 0 && form.mobile.length !== 10 ? "Must be 10 digits" : ""}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Phone fontSize="small" color="action" /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Email Address" fullWidth value={form.email} onChange={set("email")} type="email"
                  InputProps={{ startAdornment: <InputAdornment position="start"><Email fontSize="small" color="action" /></InputAdornment> }}
                />
              </Grid>
            </Grid>

            <Alert severity="warning" sx={{ mt: 2.5, borderRadius: 2 }} icon={<ErrorOutline />}>
              Changing mobile number will affect the partner's login credentials. Ensure it is verified.
            </Alert>
          </Box>
        )}

        {/* ── Tab 2: Location ───────────────────────────────────────── */}
        {editTab === 2 && (
          <Box sx={{ p: 3 }}>
            <SectionHeader icon={<LocationCity fontSize="small" />} title="Location & Source" />
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Operating City</InputLabel>
                  <Select
                    value={form.city_id}
                    label="Operating City"
                    onChange={(e) => setForm((p) => ({ ...p, city_id: e.target.value as string }))}
                    startAdornment={<InputAdornment position="start"><GpsFixed fontSize="small" color="action" /></InputAdornment>}
                  >
                    {cities.filter((c) => c.is_active).map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{c.name}</Typography>
                          {c.state_name && <Typography variant="caption" color="text.secondary">{c.state_name}</Typography>}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {selectedCity && (
                  <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: "flex", alignItems: "center", gap: 0.5 }}>
                    <CheckCircleOutline sx={{ fontSize: 14 }} />
                    {selectedCity.name}{selectedCity.state_name ? `, ${selectedCity.state_name}` : ""}
                  </Typography>
                )}
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Onboarding Source</InputLabel>
                  <Select
                    value={form.onboarding_source}
                    label="Onboarding Source"
                    onChange={(e) => setForm((p) => ({ ...p, onboarding_source: e.target.value }))}
                  >
                    <MenuItem value="ADMIN">Admin Portal</MenuItem>
                    <MenuItem value="WEBSITE">Website</MenuItem>
                    <MenuItem value="MOBILE_APP">Mobile App</MenuItem>
                    <MenuItem value="REFERRAL">Referral</MenuItem>
                    <MenuItem value="FIELD_AGENT">Field Agent</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Alert severity="info" sx={{ mt: 2.5, borderRadius: 2 }} icon={<Badge />}>
              Current status: <strong>{partner?.status}</strong> — use KYC modal to change status.
            </Alert>
          </Box>
        )}

        {/* ── Tab 3: Tax & Address ──────────────────────────────────── */}
        {editTab === 3 && (
          <Box sx={{ p: 3 }}>
            <SectionHeader icon={<Apartment fontSize="small" />} title="Office Address" />
            {partner?.partner_type === "COMPANY" && (
              <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                Company partners must have valid GST and PAN on file (BRD Rule 14).
              </Alert>
            )}
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Address Line 1"
                  fullWidth
                  value={form.office_address_line_1}
                  onChange={(e) => setForm((p) => ({ ...p, office_address_line_1: e.target.value }))}
                  placeholder="Building, Street, Area"
                  InputProps={{ startAdornment: <InputAdornment position="start"><Apartment fontSize="small" color="action" /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  label="Address Line 2"
                  fullWidth
                  value={form.office_address_line_2}
                  onChange={(e) => setForm((p) => ({ ...p, office_address_line_2: e.target.value }))}
                  placeholder="Landmark, Floor, Suite (optional)"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Postal Code"
                  fullWidth
                  value={form.office_postal_code}
                  onChange={(e) => setForm((p) => ({ ...p, office_postal_code: e.target.value }))}
                  placeholder="6-digit PIN"
                  inputProps={{ maxLength: 6 }}
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Office city is automatically matched to Operating City: <strong>{selectedCity ? `${selectedCity.name}${selectedCity.state_name ? `, ${selectedCity.state_name}` : ""}` : "—"}</strong>
                </Typography>
              </Grid>

              <Grid item xs={12}><Divider><Typography variant="caption" color="text.secondary">GST / Tax Information</Typography></Divider></Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label={partner?.partner_type === "COMPANY" ? "GST Number *" : "GST Number"}
                  fullWidth
                  value={form.gst_number}
                  onChange={(e) => setForm((p) => ({ ...p, gst_number: e.target.value.toUpperCase() }))}
                  placeholder="22AAAAA0000A1Z5"
                  inputProps={{ maxLength: 15 }}
                  error={!!form.gst_number && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gst_number)}
                  helperText={
                    form.gst_number && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gst_number)
                      ? "✓ Valid GSTIN"
                      : form.gst_number
                      ? "Invalid GST format — expected: 22AAAAA0000A1Z5"
                      : partner?.partner_type === "COMPANY" ? "Required for company partners" : "Optional"
                  }
                  FormHelperTextProps={{ sx: { color: form.gst_number && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gst_number) ? "success.main" : undefined } }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><CreditCard fontSize="small" color="action" /></InputAdornment>,
                    endAdornment: form.gst_number && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gst_number)
                      ? <InputAdornment position="end"><CheckCircleOutline color="success" fontSize="small" /></InputAdornment>
                      : undefined,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={partner?.partner_type === "COMPANY" ? "PAN Number *" : "PAN Number"}
                  fullWidth
                  value={form.pan_number}
                  onChange={(e) => setForm((p) => ({ ...p, pan_number: e.target.value.toUpperCase() }))}
                  placeholder="ABCDE1234F"
                  inputProps={{ maxLength: 10 }}
                  error={!!form.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.pan_number)}
                  helperText={
                    form.pan_number && /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.pan_number)
                      ? "✓ Valid PAN"
                      : form.pan_number
                      ? "Invalid PAN — expected: ABCDE1234F"
                      : partner?.partner_type === "COMPANY" ? "Required for company partners" : "Optional"
                  }
                  FormHelperTextProps={{ sx: { color: form.pan_number && /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.pan_number) ? "success.main" : undefined } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="GST Legal Name"
                  fullWidth
                  value={form.gst_legal_name}
                  onChange={(e) => setForm((p) => ({ ...p, gst_legal_name: e.target.value }))}
                  placeholder="Legal name as per GST certificate"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Trade Name"
                  fullWidth
                  value={form.gst_trade_name}
                  onChange={(e) => setForm((p) => ({ ...p, gst_trade_name: e.target.value }))}
                  placeholder="Trade / brand name (if different)"
                />
              </Grid>
              {partner?.gst_details && (
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "background.default" }}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Current GST Record</Typography>
                    <Stack direction="row" flexWrap="wrap" gap={1.5}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Status</Typography>
                        <Chip label={partner.gst_details.gst_status ?? "PENDING"} size="small"
                          color={partner.gst_details.gst_status === "ACTIVE" ? "success" : "warning"}
                          sx={{ ml: 0.75, fontWeight: 700 }} />
                      </Box>
                      {partner.gst_details.verified_at && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Verified</Typography>
                          <Typography variant="caption" fontWeight={600} sx={{ ml: 0.75 }}>
                            {new Date(partner.gst_details.verified_at).toLocaleDateString("en-IN")}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </Box>
        )}

        {/* ── Tab 4: Logo ───────────────────────────────────────────── */}
        {editTab === 4 && (
          <Box sx={{ p: 3 }}>
            <SectionHeader icon={<Image fontSize="small" />} title="Partner Logo" />

            {/* Current logo */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 2.5, mb: 3 }}>
              <Box sx={{
                width: 96, height: 96, borderRadius: 3,
                border: "2px solid", borderColor: "divider",
                overflow: "hidden", flexShrink: 0, bgcolor: "action.hover",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {editLogoPreview
                  ? <img src={editLogoPreview} alt="new logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : partner?.logo_url
                  ? <img src={partner.logo_url} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : (partner?.partner_type === "COMPANY" ? <Business sx={{ color: "text.disabled", fontSize: 40 }} /> : <Person sx={{ color: "text.disabled", fontSize: 40 }} />)
                }
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  {editLogoPreview ? "New Logo Selected" : partner?.logo_url ? "Current Logo" : "No Logo Uploaded"}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                  PNG, JPG, max 2MB. Displayed on partner profile, invoices, and partner app.
                </Typography>
                <Stack direction="row" gap={1}>
                  <Button variant="outlined" component="label" size="small" startIcon={<CloudUpload />} sx={{ borderRadius: 2 }}>
                    {editLogoFile ? "Change File" : "Choose File"}
                    <input hidden type="file" accept="image/*"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEditLogoSelect(f); }} />
                  </Button>
                  {editLogoFile && (
                    <Button variant="contained" size="small" startIcon={editLogoUploading ? <CircularProgress size={14} /> : <Save />}
                      onClick={handleEditLogoUpload} disabled={editLogoUploading} sx={{ borderRadius: 2 }}>
                      Upload Now
                    </Button>
                  )}
                  {editLogoFile && (
                    <Button size="small" color="error" onClick={() => { setEditLogoFile(null); setEditLogoPreview(null); }}>
                      Cancel
                    </Button>
                  )}
                </Stack>
                {editLogoFile && (
                  <Typography variant="caption" color="primary.main" display="block" sx={{ mt: 0.75 }}>
                    Selected: {editLogoFile.name}
                  </Typography>
                )}
              </Box>
            </Box>

            <Alert severity="info" sx={{ borderRadius: 2 }} icon={<Image fontSize="small" />}>
              Logo is uploaded separately — click <strong>Upload Now</strong> after selecting a file. Other profile changes save via the <strong>Save Changes</strong> button below.
            </Alert>
          </Box>
        )}

        {/* ── Tab 5: Services ──────────────────────────────────────── */}
        {editTab === 5 && (
          <Box sx={{ p: 3 }}>
            <SectionHeader icon={<GroupWork fontSize="small" />} title="Active Services" />
            {editServices.length === 0 && (
              <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                This partner has no active services. Select at least one service below.
              </Alert>
            )}
            <Stack spacing={1.25} sx={{ mb: 3 }}>
              {(dbServiceTypes.length > 0 ? dbServiceTypes : []).map((st) => {
                const s = st.type_code;
                const selected = editServices.includes(s);
                const icon = SERVICE_ICONS[s] ?? <GroupWork />;
                const label = SERVICE_LABELS[s] ?? st.label;
                const desc = SERVICE_DESC[s] ?? (st.description || `${st.label} services`);
                return (
                  <Paper
                    key={s}
                    variant="outlined"
                    onClick={() => setEditServices(prev =>
                      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                    )}
                    sx={{
                      p: 2, borderRadius: 2.5, cursor: "pointer",
                      border: "2px solid",
                      borderColor: selected ? "primary.main" : "divider",
                      bgcolor: selected ? "primary.50" : "background.paper",
                      transition: "all 0.15s",
                      "&:hover": { borderColor: "primary.light" },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Box sx={{
                        width: 44, height: 44, borderRadius: 2, display: "flex",
                        alignItems: "center", justifyContent: "center",
                        bgcolor: selected ? "primary.main" : "action.selected",
                        color: selected ? "white" : "text.secondary",
                        flexShrink: 0, overflow: "hidden",
                      }}>
                        {st.icon_url
                          ? <img src={st.icon_url} alt={label} style={{ width: 28, height: 28, objectFit: "contain" }} />
                          : icon}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" fontWeight={700}>{label}</Typography>
                        <Typography variant="caption" color="text.secondary">{desc}</Typography>
                      </Box>
                      {selected && <TaskAlt color="primary" />}
                    </Box>
                  </Paper>
                );
              })}
            </Stack>
            <Button
              variant="contained"
              fullWidth
              disabled={servicesSaving}
              startIcon={servicesSaving ? <CircularProgress size={16} /> : <Save />}
              sx={{ borderRadius: 2 }}
              onClick={async () => {
                if (!partner) return;
                setServicesSaving(true);
                try {
                  await partnerService.updateServices(partner.id, editServices);
                  enqueueSnackbar("Services updated successfully", { variant: "success" });
                  qc.invalidateQueries({ queryKey: ["admin-partners"] });
                  onSaved();
                } catch (e: any) {
                  enqueueSnackbar(e?.response?.data?.detail ?? "Failed to update services", { variant: "error" });
                } finally { setServicesSaving(false); }
              }}
            >
              Save Services
            </Button>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 1.5 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending} sx={{ borderRadius: 2 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          startIcon={mutation.isPending ? <CircularProgress size={16} /> : <Save />}
          sx={{ borderRadius: 2, px: 3 }}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  KYC MODAL — now receives cities as prop (fixes City ID display bug)
// ════════════════════════════════════════════════════════════════════════════

// ── PartnerWalletTab — embedded wallet summary inside KycModal ────────────────
function PartnerWalletTab({ partnerId }: { partnerId: number }) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  // modal state
  const [modal, setModal] = useState<{ open: boolean; type: "recharge" | "credit" | "debit" } | null>(null);
  // recharge form
  const [rchAmount, setRchAmount] = useState("");
  const [rchMode, setRchMode] = useState<"CASH" | "UPI">("CASH");
  const [rchUpi, setRchUpi] = useState("");
  const [rchRemarks, setRchRemarks] = useState("");
  // adj form
  const [adjAmount, setAdjAmount] = useState("");
  const [adjCause, setAdjCause] = useState("");
  const [adjRemarks, setAdjRemarks] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["kyc-partner-wallet", partnerId],
    queryFn: () => walletService.getPartnerWallet(partnerId, { ledger_page: 1, ledger_page_size: 10 }),
    staleTime: 20_000,
  });

  const fmtINR = (n: number) =>
    `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  function closeModal() {
    setModal(null);
    setRchAmount(""); setRchMode("CASH"); setRchUpi(""); setRchRemarks("");
    setAdjAmount(""); setAdjCause(""); setAdjRemarks("");
    setFormError(""); setFormLoading(false);
  }

  async function handleRecharge() {
    if (!rchAmount || Number(rchAmount) <= 0) { setFormError("Enter a valid amount"); return; }
    if (rchMode === "UPI" && !rchUpi.trim()) { setFormError("UPI reference is required"); return; }
    setFormLoading(true); setFormError("");
    try {
      const res = await walletService.rechargePartner({
        partner_id: partnerId,
        amount: Number(rchAmount),
        payment_mode: rchMode,
        upi_reference: rchUpi || undefined,
        remarks: rchRemarks || undefined,
      });
      enqueueSnackbar(res.message, { variant: "success" });
      qc.invalidateQueries({ queryKey: ["kyc-partner-wallet", partnerId] });
      closeModal();
    } catch (e: any) {
      setFormError(e?.response?.data?.detail ?? "Recharge failed");
    } finally { setFormLoading(false); }
  }

  async function handleAdj(type: "credit" | "debit") {
    if (!adjAmount || Number(adjAmount) <= 0) { setFormError("Enter a valid amount"); return; }
    if (!adjCause.trim() || adjCause.trim().length < 3) { setFormError("Cause is required (min 3 chars)"); return; }
    setFormLoading(true); setFormError("");
    try {
      const fn = type === "credit" ? walletService.credit : walletService.debit;
      const res = await fn({
        wallet_type: "PARTNER",
        entity_id: partnerId,
        amount: Number(adjAmount),
        cause: adjCause.trim(),
        remarks: adjRemarks || undefined,
      });
      enqueueSnackbar(res.message, { variant: "success" });
      qc.invalidateQueries({ queryKey: ["kyc-partner-wallet", partnerId] });
      closeModal();
    } catch (e: any) {
      setFormError(e?.response?.data?.detail ?? "Operation failed");
    } finally { setFormLoading(false); }
  }

  if (isLoading) {
    return (
      <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (!data) return <Alert severity="info">Wallet data unavailable.</Alert>;

  const w = data.wallet;

  const REF_COLORS: Record<string, "success" | "error" | "info" | "warning" | "default"> = {
    RECHARGE_CASH: "success", RECHARGE_UPI: "success",
    CREDIT_ADJUSTMENT: "info", DEBIT_ADJUSTMENT: "error",
    CAB_COMMISSION: "warning", SETTLEMENT: "warning",
  };

  return (
    <Stack spacing={3}>
      {/* ── Balance Summary ─────────────────────────────────────────── */}
      <Grid container spacing={1.5}>
        {[
          { label: "Available Balance", value: w.available_balance, color: "success.main", gradient: "linear-gradient(135deg,#059669,#10b981)" },
          { label: "On Hold",           value: w.hold_balance,      color: "warning.main", gradient: "linear-gradient(135deg,#d97706,#f59e0b)" },
          { label: "Credit Limit",      value: w.credit_limit,      color: "info.main",    gradient: "linear-gradient(135deg,#2563eb,#60a5fa)" },
          { label: "Total Balance",     value: w.total_balance,     color: "primary.main", gradient: "linear-gradient(135deg,#7c3aed,#a78bfa)" },
        ].map(({ label, value, gradient }) => (
          <Grid item xs={6} key={label}>
            <Box sx={{
              borderRadius: 2.5, overflow: "hidden",
              boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            }}>
              <Box sx={{ background: gradient, px: 2, py: 1.5 }}>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", fontSize: "0.62rem" }}>
                  {label}
                </Typography>
                <Typography variant="h6" fontWeight={900} color="white" sx={{ lineHeight: 1.2, mt: 0.25, fontSize: "1rem" }}>
                  {fmtINR(value)}
                </Typography>
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* ── Status + Type chips ─────────────────────────────────────── */}
      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Chip
          label={`Wallet: ${w.wallet_status}`}
          color={w.wallet_status === "ACTIVE" ? "success" : "error"}
          size="small" sx={{ fontWeight: 700 }}
        />
        <Chip label={`Type: ${w.wallet_type}`} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={() => refetch()} title="Refresh wallet">
          <Refresh fontSize="small" />
        </IconButton>
      </Stack>

      {/* ── Action Buttons ─────────────────────────────────────────── */}
      <Stack direction="row" spacing={1}>
        <Button
          variant="contained" color="success" size="small"
          startIcon={<AddCard sx={{ fontSize: 16 }} />}
          onClick={() => setModal({ open: true, type: "recharge" })}
          sx={{ fontWeight: 700, borderRadius: 2 }}
        >
          Recharge
        </Button>
        <Button
          variant="outlined" color="primary" size="small"
          startIcon={<ArrowUpward sx={{ fontSize: 16 }} />}
          onClick={() => setModal({ open: true, type: "credit" })}
          sx={{ fontWeight: 700, borderRadius: 2 }}
        >
          Credit
        </Button>
        <Button
          variant="outlined" color="error" size="small"
          startIcon={<ArrowDownward sx={{ fontSize: 16 }} />}
          onClick={() => setModal({ open: true, type: "debit" })}
          sx={{ fontWeight: 700, borderRadius: 2 }}
        >
          Debit
        </Button>
      </Stack>

      {/* ── Recent Ledger ───────────────────────────────────────────── */}
      <Box>
        <Typography variant="caption" fontWeight={700} color="text.secondary"
          sx={{ letterSpacing: 1, textTransform: "uppercase", display: "block", mb: 1 }}>
          Recent Transactions ({data.ledger.total} total)
        </Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                {["Date", "Type", "Credit", "Debit", "Balance", "Note"].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: "0.68rem", color: "text.secondary", letterSpacing: 0.4 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.ledger.entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                    <Typography variant="caption" color="text.secondary">No transactions yet</Typography>
                  </TableCell>
                </TableRow>
              )}
              {data.ledger.entries.map((e) => (
                <TableRow key={e.id} hover>
                  <TableCell sx={{ fontSize: "0.7rem", whiteSpace: "nowrap" }}>
                    {new Date(e.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={e.ref_type.replace(/_/g, " ")}
                      color={REF_COLORS[e.ref_type] ?? "default"}
                      size="small"
                      sx={{ fontSize: "0.6rem", height: 18, fontWeight: 700 }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: "success.main", fontWeight: 700, fontSize: "0.75rem" }}>
                    {e.credit > 0 ? `+${fmtINR(e.credit)}` : "—"}
                  </TableCell>
                  <TableCell sx={{ color: "error.main", fontWeight: 700, fontSize: "0.75rem" }}>
                    {e.debit > 0 ? `−${fmtINR(e.debit)}` : "—"}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: "0.78rem" }}>{fmtINR(e.balance_after)}</TableCell>
                  <TableCell sx={{ fontSize: "0.68rem", color: "text.secondary", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.narration}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {data.ledger.total > 10 && (
          <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.75, textAlign: "right" }}>
            Showing last 10 — visit Wallets page for full ledger
          </Typography>
        )}
      </Box>

      {/* ── Recharge Modal ──────────────────────────────────────────── */}
      <Dialog open={modal?.open === true && modal.type === "recharge"} onClose={closeModal} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <Box sx={{ background: "linear-gradient(135deg,#059669,#10b981)", px: 3, pt: 2.5, pb: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <AddCard sx={{ color: "#fff", fontSize: 24 }} />
            <Box>
              <Typography variant="subtitle1" fontWeight={800} color="white">Recharge Partner Wallet</Typography>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.75)" }}>Admin-recorded top-up</Typography>
            </Box>
          </Stack>
        </Box>
        <DialogContent sx={{ pt: 2.5 }}>
          <Stack spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Payment Mode</InputLabel>
              <Select value={rchMode} label="Payment Mode" onChange={e => setRchMode(e.target.value as any)}>
                <MenuItem value="CASH">Cash</MenuItem>
                <MenuItem value="UPI">UPI / Bank Transfer</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Amount (Rs.) *" type="number" size="small" fullWidth
              value={rchAmount} onChange={e => { setRchAmount(e.target.value); setFormError(""); }}
              InputProps={{ startAdornment: <InputAdornment position="start"><CurrencyRupee sx={{ fontSize: 16, color: "text.secondary" }} /></InputAdornment> }}
              inputProps={{ min: 1 }} />
            {rchMode === "UPI" && (
              <TextField label="UPI Reference / UTR *" size="small" fullWidth
                value={rchUpi} onChange={e => { setRchUpi(e.target.value); setFormError(""); }}
                placeholder="e.g. 426789123456" />
            )}
            <TextField label="Remarks (optional)" size="small" fullWidth multiline rows={2}
              value={rchRemarks} onChange={e => setRchRemarks(e.target.value)} />
            {formError && <Alert severity="error" sx={{ borderRadius: 2 }}>{formError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={closeModal} disabled={formLoading} variant="outlined" size="small">Cancel</Button>
          <Button onClick={handleRecharge} disabled={formLoading} variant="contained" color="success" size="small"
            startIcon={formLoading ? <CircularProgress size={13} color="inherit" /> : <AddCard fontSize="small" />}
            sx={{ fontWeight: 700 }}>
            {formLoading ? "Processing…" : "Recharge"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Credit / Debit Modal ────────────────────────────────────── */}
      {(modal?.type === "credit" || modal?.type === "debit") && (
        <Dialog open={modal.open} onClose={closeModal} maxWidth="xs" fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}>
          <Box sx={{
            background: modal.type === "credit"
              ? "linear-gradient(135deg,#1d4ed8,#60a5fa)"
              : "linear-gradient(135deg,#b91c1c,#f87171)",
            px: 3, pt: 2.5, pb: 2,
          }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              {modal.type === "credit"
                ? <ArrowUpward sx={{ color: "#fff", fontSize: 24 }} />
                : <ArrowDownward sx={{ color: "#fff", fontSize: 24 }} />}
              <Box>
                <Typography variant="subtitle1" fontWeight={800} color="white">
                  {modal.type === "credit" ? "Credit" : "Debit"} Partner Wallet
                </Typography>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.75)" }}>
                  Manual adjustment — permanently logged
                </Typography>
              </Box>
            </Stack>
          </Box>
          <DialogContent sx={{ pt: 2.5 }}>
            <Stack spacing={2}>
              <TextField label={`Amount to ${modal.type === "credit" ? "Credit" : "Debit"} *`}
                type="number" size="small" fullWidth
                value={adjAmount} onChange={e => { setAdjAmount(e.target.value); setFormError(""); }}
                InputProps={{ startAdornment: <InputAdornment position="start"><CurrencyRupee sx={{ fontSize: 16, color: "text.secondary" }} /></InputAdornment> }}
                inputProps={{ min: 0.01, step: 0.01 }} />
              <TextField label="Cause / Reason *" size="small" fullWidth
                value={adjCause} onChange={e => { setAdjCause(e.target.value); setFormError(""); }}
                placeholder={modal.type === "credit" ? "e.g. Compensation, Promotional" : "e.g. Penalty, Chargeback"}
                helperText="Recorded permanently in the ledger" />
              <TextField label="Additional Remarks (optional)" size="small" fullWidth multiline rows={2}
                value={adjRemarks} onChange={e => setAdjRemarks(e.target.value)} />
              {formError && <Alert severity="error" sx={{ borderRadius: 2 }}>{formError}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={closeModal} disabled={formLoading} variant="outlined" size="small">Cancel</Button>
            <Button onClick={() => handleAdj(modal.type as "credit" | "debit")} disabled={formLoading}
              variant="contained" color={modal.type === "credit" ? "primary" : "error"} size="small"
              startIcon={formLoading ? <CircularProgress size={13} color="inherit" /> : modal.type === "credit" ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
              sx={{ fontWeight: 700 }}>
              {formLoading ? "Processing…" : `Confirm ${modal.type === "credit" ? "Credit" : "Debit"}`}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Stack>
  );
}

interface KycModalProps {
  partnerId: number | null;
  onClose: () => void;
  onActionDone: () => void;
  cities: City[];  // ← passed from parent (already fetched, no stale render)
}
function KycModal({ partnerId, onClose, onActionDone, cities }: KycModalProps) {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [reasonDialog, setReasonDialog] = useState<{ open: boolean; key: string; label: string; color?: any }>({ open: false, key: "", label: "" });
  const [editOpen, setEditOpen] = useState(false);

  // Doc upload
  const [docType, setDocType] = useState<string>(DOCUMENT_TYPES[0] as string);
  const [docNumber, setDocNumber] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docExpiry, setDocExpiry] = useState("");
  const [docUploading, setDocUploading] = useState(false);

  // Bank account
  const [bankForm, setBankForm] = useState({
    account_holder_name: "", account_number_encrypted: "",
    ifsc_code: "", bank_name: "", branch_name: "",
    account_type: "SAVINGS" as "SAVINGS" | "CURRENT", is_primary: false,
  });
  const [bankSaving, setBankSaving] = useState(false);
  const [showBankForm, setShowBankForm] = useState(false);

  // Logo
  const [logoUploading, setLogoUploading] = useState(false);

  // Commission group state
  const [commGroupOpen, setCommGroupOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | number>("");
  const [commGroupSaving, setCommGroupSaving] = useState(false);

  const { data: commissionGroups = [] } = useQuery({
    queryKey: ["commission-groups"],
    queryFn: () => (settingsService as any).getCommissionGroups() as Promise<Array<{ id: number; group_name: string; description: string | null; is_active: boolean; rules: any[] }>>,
    staleTime: 5 * 60 * 1000,
    enabled: !!partnerId,
  });

  const handleAssignCommGroup = async () => {
    if (!partner || !selectedGroupId) return;
    setCommGroupSaving(true);
    try {
      await partnerService.assignCommissionGroup(partner.id, Number(selectedGroupId));
      enqueueSnackbar("Commission group assigned successfully", { variant: "success" });
      setCommGroupOpen(false);
      setSelectedGroupId("");
      refetch();
      qc.invalidateQueries({ queryKey: ["admin-partners"] });
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.detail ?? "Failed to assign commission group", { variant: "error" });
    } finally {
      setCommGroupSaving(false);
    }
  };

  const handleRemoveCommGroup = async () => {
    if (!partner) return;
    setCommGroupSaving(true);
    try {
      await partnerService.removeCommissionGroup(partner.id);
      enqueueSnackbar("Commission group removed", { variant: "success" });
      refetch();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.detail ?? "Failed to remove", { variant: "error" });
    } finally {
      setCommGroupSaving(false);
    }
  };

  const { data: partner, isLoading, refetch } = useQuery<PartnerDetail>({
    queryKey: ["partner-detail", partnerId],
    queryFn: () => partnerService.getDetail(partnerId!),
    enabled: !!partnerId,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const actionMutation = useMutation({
    mutationFn: ({ key, reason }: { key: string; reason: string }) => {
      const id = partner!.id;
      const fns: Record<string, (id: number, r?: string) => Promise<unknown>> = {
        review: partnerService.review, document_pending: partnerService.documentPending,
        approve: partnerService.approve, activate: partnerService.activate,
        suspend: partnerService.suspend, unsuspend: partnerService.unsuspend,
        block: partnerService.block,
      };
      return fns[key](id, reason || undefined);
    },
    onSuccess: (_, vars) => {
      enqueueSnackbar(`Action "${vars.key}" applied successfully`, { variant: "success" });
      setReasonDialog({ open: false, key: "", label: "" });
      refetch();
      qc.invalidateQueries({ queryKey: ["admin-partners"] });
      onActionDone();
    },
    onError: (err: any) =>
      enqueueSnackbar(err?.response?.data?.detail ?? "Action failed", { variant: "error" }),
  });

  const docVerifyMutation = useMutation({
    mutationFn: ({ docId, vs, remarks }: { docId: number; vs: "APPROVED" | "REJECTED"; remarks?: string }) =>
      partnerService.verifyDocument(partner!.id, docId, vs, remarks),
    onSuccess: () => { enqueueSnackbar("Document updated", { variant: "success" }); refetch(); },
    onError: () => enqueueSnackbar("Failed to update document", { variant: "error" }),
  });

  const handleDocUpload = async () => {
    if (!docFile || !partner) { enqueueSnackbar("Please select a file", { variant: "warning" }); return; }
    setDocUploading(true);
    try {
      await partnerService.uploadDocument(partner.id, docFile, docType, docNumber || undefined, docExpiry || undefined);
      enqueueSnackbar("Document uploaded successfully", { variant: "success" });
      setDocFile(null); setDocNumber(""); setDocExpiry("");
      refetch();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.detail ?? "Upload failed", { variant: "error" });
    } finally { setDocUploading(false); }
  };

  const handleBankSave = async () => {
    if (!bankForm.account_holder_name || !bankForm.account_number_encrypted || !bankForm.ifsc_code || !bankForm.bank_name) {
      enqueueSnackbar("Please fill all required bank fields", { variant: "warning" }); return;
    }
    if (!partner) return;
    setBankSaving(true);
    try {
      await partnerService.addBankAccount(partner.id, bankForm);
      enqueueSnackbar("Bank account added", { variant: "success" });
      setBankForm({ account_holder_name: "", account_number_encrypted: "", ifsc_code: "", bank_name: "", branch_name: "", account_type: "SAVINGS", is_primary: false });
      setShowBankForm(false); refetch();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.detail ?? "Failed", { variant: "error" });
    } finally { setBankSaving(false); }
  };

  const handleLogoUpload = async (file: File) => {
    if (!partner) return;
    setLogoUploading(true);
    try {
      await partnerService.uploadLogo(partner.id, file);
      enqueueSnackbar("Logo uploaded", { variant: "success" }); refetch();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.detail ?? "Logo upload failed", { variant: "error" });
    } finally { setLogoUploading(false); }
  };

  const actions = partner ? getActions(partner.status) : [];
  const docMeta = DOCUMENT_META[docType] ?? {};
  const needsApprove = partner && (partner.status === "UNDER_REVIEW" || partner.status === "DOCUMENT_PENDING");

  // ── KEY FIX: use passed-in cities (already loaded in parent) ──────────────
  const partnerCityName = partner ? cityLabel(partner.city_id, cities) : "";

  return (
    <>
      <Dialog open={!!partnerId} onClose={onClose} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 4, height: { xs: "100vh", sm: "90vh" }, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.22)" } }}>

        {/* Header */}
        <Box sx={{
          px: 3, py: 2.5, flexShrink: 0,
          background: "linear-gradient(135deg, #0d1b6e 0%, #1a237e 50%, #283593 100%)",
          color: "white",
        }}>
          {isLoading ? (
            <Skeleton variant="text" width={240} height={34} sx={{ bgcolor: "rgba(255,255,255,0.2)" }} />
          ) : partner ? (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box sx={{ position: "relative", flexShrink: 0 }}>
                  <Avatar src={partner.logo_url ?? undefined}
                    sx={{ width: 56, height: 56, bgcolor: "#fff", border: "2px solid rgba(255,255,255,0.3)" }}>
                    {partner.partner_type === "COMPANY" ? <Business sx={{ color: "#1a237e" }} /> : <Person sx={{ color: "#1a237e" }} />}
                  </Avatar>
                  <Tooltip title="Upload Logo">
                    <Box component="label" sx={{
                      position: "absolute", bottom: -4, right: -4,
                      bgcolor: "white", borderRadius: "50%", width: 22, height: 22,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", boxShadow: 2,
                    }}>
                      {logoUploading ? <CircularProgress size={12} sx={{ color: "#1a237e" }} /> : <Image sx={{ fontSize: 13, color: "#1a237e" }} />}
                      <input hidden type="file" accept="image/*"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
                    </Box>
                  </Tooltip>
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                    {partner.business_name || partner.owner_name}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    {partner.partner_code} · {partner.partner_type} · {partnerCityName}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <StatusChip status={partner.status} />
                <Tooltip title="Edit Partner Details">
                  <IconButton onClick={() => setEditOpen(true)} sx={{ color: "white", bgcolor: "rgba(255,255,255,0.1)" }}>
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
                <IconButton onClick={onClose} sx={{ color: "white" }}><Close /></IconButton>
              </Box>
            </Box>
          ) : null}
        </Box>

        {isLoading && <LinearProgress />}

        {/* Approve CTA Banner */}
        {needsApprove && (
          <Box sx={{
            px: 3, py: 1.5, bgcolor: "#e8f5e9", borderBottom: "1px solid #a5d6a7",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexShrink: 0,
          }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <CheckCircleOutline color="success" />
              <Box>
                <Typography variant="subtitle2" fontWeight={700} color="success.dark">Ready for KYC Approval</Typography>
                <Typography variant="caption" color="text.secondary">
                  Partner is {partner!.status === "UNDER_REVIEW" ? "under review" : "awaiting additional documents"} — approve to proceed.
                </Typography>
              </Box>
            </Box>
            <Button variant="contained" color="success" size="small" startIcon={<CheckCircle />}
              onClick={() => setReasonDialog({ open: true, key: "approve", label: "Approve KYC", color: "success" })}>
              Approve KYC
            </Button>
          </Box>
        )}

        {/* Action buttons */}
        {partner && actions.length > 0 && (
          <Box sx={{ px: 2.5, py: 1.25, bgcolor: "background.default", borderBottom: 1, borderColor: "divider", flexShrink: 0 }}>
            <Stack direction="row" flexWrap="wrap" gap={0.75}>
              {actions
                .filter((a) => !(needsApprove && a.key === "approve"))
                .map((a) => (
                  <Button key={a.key} size="small" variant={a.variant ?? "contained"} color={a.color}
                    startIcon={a.icon} sx={{ fontSize: "0.75rem", borderRadius: 1.5 }}
                    onClick={() => setReasonDialog({ open: true, key: a.key, label: a.label, color: a.color })}>
                    {a.label}
                  </Button>
                ))}
            </Stack>
          </Box>
        )}

        {/* Tabs */}
        {partner && (
          <Tabs value={tab} onChange={(_, v) => setTab(v)}
            sx={{ px: 2, borderBottom: 1, borderColor: "divider", flexShrink: 0 }}>
            <Tab label="Overview" />
            <Tab label={`KYC Documents (${partner.documents.length})`} />
            <Tab label={`Bank Accounts (${partner.bank_accounts.length})`} />
            <Tab label="Activity Log" />
            <Tab icon={<AccountBalanceWallet sx={{ fontSize: 15 }} />} iconPosition="start" label="Wallet" sx={{ minHeight: 48, fontSize: "0.8rem", fontWeight: 700 }} />
          </Tabs>
        )}

        {/* Tab content */}
        <Box sx={{ flex: 1, overflow: "auto", px: 3, py: 2.5 }}>
          {isLoading && (
            <Stack spacing={2}>{[1,2,3].map(i => <Skeleton key={i} variant="rounded" height={80} />)}</Stack>
          )}

          {/* ── Overview ─────────────────────────────────────────────── */}
          {!isLoading && partner && tab === 0 && (
            <Stack spacing={2.5}>
              <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: "hidden" }}>
                <Box sx={{ px: 2.5, py: 1.5, bgcolor: "background.default", borderBottom: 1, borderColor: "divider",
                  display: "flex", alignItems: "center", gap: 1 }}>
                  <Person fontSize="small" color="primary" />
                  <Typography variant="subtitle2" fontWeight={700}>Contact Information</Typography>
                </Box>
                <Grid container sx={{ p: 2.5 }} spacing={2}>
                  {[
                    { icon: <Person fontSize="small" />,         label: "Owner Name",     value: partner.owner_name },
                    { icon: <Business fontSize="small" />,       label: "Business Name",  value: partner.business_name ?? "—" },
                    { icon: <Phone fontSize="small" />,          label: "Mobile",         value: partner.mobile },
                    { icon: <Email fontSize="small" />,          label: "Email",          value: partner.email ?? "—" },
                    // ← FIX: now shows real city name (not "City ID 5")
                    { icon: <LocationCity fontSize="small" />,   label: "Operating City", value: partnerCityName },
                    { icon: <Badge fontSize="small" />,          label: "Partner Type",   value: partner.partner_type },
                  ].map(({ icon, label, value }) => (
                    <Grid item xs={12} sm={6} key={label}>
                      <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                        <Box sx={{ color: "primary.main", mt: 0.25, flexShrink: 0 }}>{icon}</Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                          <Typography variant="body2" fontWeight={600}>{value}</Typography>
                        </Box>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Paper>

              <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: "hidden" }}>
                <Box sx={{ px: 2.5, py: 1.5, bgcolor: "background.default", borderBottom: 1, borderColor: "divider",
                  display: "flex", alignItems: "center", gap: 1 }}>
                  <AssignmentInd fontSize="small" color="primary" />
                  <Typography variant="subtitle2" fontWeight={700}>Onboarding Status</Typography>
                </Box>
                <Box sx={{ p: 2.5 }}>
                  <Stack direction="row" flexWrap="wrap" gap={0.75} mb={1.5}>
                    {PARTNER_STATUSES.map((s) => (
                      <Chip key={s} label={STATUS_META[s]?.label ?? s}
                        color={partner.status === s ? STATUS_META[s]?.color : "default"}
                        variant={partner.status === s ? "filled" : "outlined"}
                        size="small" sx={{ fontWeight: partner.status === s ? 700 : 400 }} />
                    ))}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Next allowed: <strong>{(partner.allowed_transitions ?? []).join(", ") || "None — terminal state"}</strong>
                  </Typography>
                </Box>
              </Paper>

              {/* ── Commission Group Card ─────────────────────────────────────── */}
              <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: "hidden" }}>
                <Box sx={{
                  px: 2.5, py: 1.5, bgcolor: "background.default", borderBottom: 1, borderColor: "divider",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <GroupWork fontSize="small" color="primary" />
                    <Typography variant="subtitle2" fontWeight={700}>Commission Group</Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.75 }}>
                    {partner.commission_group && (
                      <Tooltip title="Remove commission group assignment">
                        <IconButton size="small" color="error" disabled={commGroupSaving}
                          onClick={handleRemoveCommGroup}>
                          {commGroupSaving ? <CircularProgress size={14} /> : <Cancel fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    )}
                    <Button size="small" variant="outlined" startIcon={<Edit fontSize="small" />}
                      onClick={() => {
                        setSelectedGroupId(partner.commission_group?.id ?? "");
                        setCommGroupOpen(true);
                      }}
                      sx={{ borderRadius: 1.5, fontSize: "0.72rem" }}>
                      {partner.commission_group ? "Change" : "Assign"}
                    </Button>
                  </Box>
                </Box>

                {partner.commission_group ? (
                  <Box sx={{ p: 2.5 }}>
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                      <Box sx={{
                        width: 44, height: 44, borderRadius: 2, flexShrink: 0,
                        bgcolor: "primary.main", display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <GroupWork sx={{ color: "white" }} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" fontWeight={800}>{partner.commission_group.group_name}</Typography>
                        {partner.commission_group.description && (
                          <Typography variant="caption" color="text.secondary">{partner.commission_group.description}</Typography>
                        )}
                        <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>
                          Assigned: {new Date(partner.commission_group.assigned_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </Typography>
                      </Box>
                      <Chip label="Active" color="success" size="small" sx={{ fontWeight: 700 }} />
                    </Box>

                    {/* Commission rules summary */}
                    {(() => {
                      const grp = commissionGroups.find((g) => g.id === partner.commission_group!.id);
                      const activeRules = grp?.rules?.filter((r: any) => r.is_active) ?? [];
                      return activeRules.length > 0 ? (
                        <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
                          <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 1 }}>
                            COMMISSION RATES
                          </Typography>
                          <Stack direction="row" flexWrap="wrap" gap={1}>
                            {activeRules.map((r: any) => (
                              <Chip
                                key={r.id}
                                icon={r.service_type === "CAB" ? <DirectionsCar fontSize="small" /> : r.service_type === "HOTEL" ? <Hotel fontSize="small" /> : <Tour fontSize="small" />}
                                label={`${r.service_type}: ${r.commission_value}${r.commission_type === "PERCENTAGE" ? "%" : " ₹ flat"}`}
                                variant="outlined"
                                color="primary"
                                size="small"
                                sx={{ fontWeight: 700, fontSize: "0.72rem" }}
                              />
                            ))}
                          </Stack>
                        </Box>
                      ) : null;
                    })()}
                  </Box>
                ) : (
                  <Box sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 1.5 }}>
                    <ErrorOutline color="warning" />
                    <Box>
                      <Typography variant="body2" fontWeight={600} color="warning.dark">No commission group assigned</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Commission cannot be calculated until a group is assigned.
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Paper>

              {/* ── Linked Services ─────────────────────────────────────── */}
              <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: "hidden" }}>
                <Box sx={{
                  px: 2.5, py: 1.5, bgcolor: "background.default", borderBottom: 1, borderColor: "divider",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <GroupWork fontSize="small" color="primary" />
                    <Typography variant="subtitle2" fontWeight={700}>Linked Services</Typography>
                    {(() => {
                      const activeCount = (partner.services ?? []).filter((s) => s.is_active).length;
                      return (
                        <Chip
                          label={activeCount === 0 ? "None active" : `${activeCount} active`}
                          size="small"
                          color={activeCount === 0 ? "warning" : "success"}
                          sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }}
                        />
                      );
                    })()}
                  </Box>
                  <Tooltip title="Manage services in Edit Partner">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Edit fontSize="small" />}
                      onClick={() => setEditOpen(true)}
                      sx={{ borderRadius: 1.5, fontSize: "0.72rem" }}
                    >
                      Manage
                    </Button>
                  </Tooltip>
                </Box>

                <Box sx={{ p: 2.5 }}>
                  {(() => {
                    const svcs = partner.services ?? [];
                    if (svcs.length === 0) {
                      return (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <ErrorOutline color="warning" />
                          <Box>
                            <Typography variant="body2" fontWeight={600} color="warning.dark">
                              No services linked to this partner
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Use Edit Partner → Services tab to assign service types.
                            </Typography>
                          </Box>
                        </Box>
                      );
                    }
                    const active = svcs.filter((s) => s.is_active);
                    const inactive = svcs.filter((s) => !s.is_active);
                    return (
                      <Stack spacing={1.5}>
                        {active.length > 0 && (
                          <Box>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 1 }}>
                              ACTIVE
                            </Typography>
                            <Stack direction="row" flexWrap="wrap" gap={1}>
                              {active.map((s) => {
                                const icon = SERVICE_ICONS[s.service_type] ?? <GroupWork fontSize="small" />;
                                const label = SERVICE_LABELS[s.service_type] ?? s.service_type;
                                return (
                                  <Chip
                                    key={s.service_type}
                                    icon={icon as React.ReactElement}
                                    label={label}
                                    color="primary"
                                    variant="filled"
                                    size="small"
                                    sx={{ fontWeight: 700, fontSize: "0.78rem", px: 0.5 }}
                                  />
                                );
                              })}
                            </Stack>
                          </Box>
                        )}
                        {inactive.length > 0 && (
                          <Box>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 1 }}>
                              INACTIVE
                            </Typography>
                            <Stack direction="row" flexWrap="wrap" gap={1}>
                              {inactive.map((s) => {
                                const icon = SERVICE_ICONS[s.service_type] ?? <GroupWork fontSize="small" />;
                                const label = SERVICE_LABELS[s.service_type] ?? s.service_type;
                                return (
                                  <Chip
                                    key={s.service_type}
                                    icon={icon as React.ReactElement}
                                    label={label}
                                    color="default"
                                    variant="outlined"
                                    size="small"
                                    sx={{ fontWeight: 500, fontSize: "0.78rem", opacity: 0.6, px: 0.5 }}
                                  />
                                );
                              })}
                            </Stack>
                          </Box>
                        )}
                      </Stack>
                    );
                  })()}
                </Box>
              </Paper>

              {/* ── Office Address ───────────────────────────────────────── */}
              {(partner.office_address_line_1 || partner.office_city_id) && (
                <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: "hidden" }}>
                  <Box sx={{ px: 2.5, py: 1.5, bgcolor: "background.default", borderBottom: 1, borderColor: "divider",
                    display: "flex", alignItems: "center", gap: 1 }}>
                    <Apartment fontSize="small" color="primary" />
                    <Typography variant="subtitle2" fontWeight={700}>Office Address</Typography>
                  </Box>
                  <Box sx={{ p: 2.5 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {[partner.office_address_line_1, partner.office_address_line_2].filter(Boolean).join(", ")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {cityLabel(partner.office_city_id, cities)}
                      {partner.office_postal_code ? ` — ${partner.office_postal_code}` : ""}
                    </Typography>
                  </Box>
                </Paper>
              )}

              {/* ── Tax Information ───────────────────────────────────────── */}
              <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: "hidden" }}>
                <Box sx={{ px: 2.5, py: 1.5, bgcolor: "background.default", borderBottom: 1, borderColor: "divider",
                  display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CreditCard fontSize="small" color="primary" />
                    <Typography variant="subtitle2" fontWeight={700}>Tax Information</Typography>
                    {partner.partner_type === "COMPANY" && (
                      <Chip label="Required" size="small" color="warning" sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }} />
                    )}
                  </Box>
                  <Tooltip title="Edit Tax Information">
                    <IconButton size="small" onClick={() => setEditOpen(true)} sx={{ opacity: 0.6 }}>
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                {partner.gst_details ? (
                  <Grid container sx={{ p: 2.5 }} spacing={2}>
                    {[
                      { label: "GST Number",   value: partner.gst_details.gst_number   ?? "—" },
                      { label: "PAN Number",   value: partner.gst_details.pan_number   ?? "—" },
                      { label: "Legal Name",   value: partner.gst_details.legal_name   ?? "—" },
                      { label: "Trade Name",   value: partner.gst_details.trade_name   ?? "—" },
                      { label: "GST Status",   value: partner.gst_details.gst_status   ?? "—" },
                      { label: "Reg. Date",    value: partner.gst_details.registration_date
                          ? new Date(partner.gst_details.registration_date).toLocaleDateString("en-IN") : "—" },
                    ].map(({ label, value }) => (
                      <Grid item xs={12} sm={6} key={label}>
                        <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {label === "GST Status"
                            ? <Chip label={value} size="small"
                                color={value === "ACTIVE" ? "success" : value === "—" ? "default" : "warning"}
                                sx={{ fontWeight: 700 }} />
                            : value}
                        </Typography>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Box sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 1.5 }}>
                    {partner.partner_type === "COMPANY"
                      ? <ErrorOutline color="error" />
                      : <HourglassTop color="action" />
                    }
                    <Box>
                      <Typography variant="body2" fontWeight={600}
                        color={partner.partner_type === "COMPANY" ? "error.main" : "text.secondary"}>
                        {partner.partner_type === "COMPANY"
                          ? "GST details missing — required for company partners"
                          : "No tax information on file"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Add GST / PAN via Edit Partner → Tax & Address tab
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Paper>

              <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: "hidden" }}>
                <Box sx={{ px: 2.5, py: 1.5, bgcolor: "background.default", borderBottom: 1, borderColor: "divider",
                  display: "flex", alignItems: "center", gap: 1 }}>
                  <History fontSize="small" color="primary" />
                  <Typography variant="subtitle2" fontWeight={700}>Timeline</Typography>
                </Box>
                <Grid container sx={{ p: 2.5 }} spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="text.secondary">Registered</Typography>
                    <Typography variant="body2" fontWeight={600}>{new Date(partner.created_at).toLocaleString()}</Typography>
                  </Grid>
                  {partner.approved_at && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">Approved</Typography>
                      <Typography variant="body2" fontWeight={600}>{new Date(partner.approved_at).toLocaleString()}</Typography>
                    </Grid>
                  )}
                  {partner.onboarding_source && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">Onboarding Source</Typography>
                      <Typography variant="body2" fontWeight={600}>{partner.onboarding_source}</Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </Stack>
          )}

          {/* ── KYC Documents ────────────────────────────────────────── */}
          {!isLoading && partner && tab === 1 && (
            <Stack spacing={2.5}>
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2.5, bgcolor: "background.default" }}>
                <Typography variant="subtitle2" fontWeight={700} color="primary" gutterBottom>Upload New Document</Typography>
                <Grid container spacing={2} alignItems="flex-end">
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Document Type</InputLabel>
                      <Select value={docType} label="Document Type"
                        onChange={(e) => { setDocType(e.target.value); setDocNumber(""); }}>
                        {DOCUMENT_TYPES.map((t) => (
                          <MenuItem key={t} value={t}>{DOCUMENT_META[t]?.label ?? t.replace(/_/g, " ")}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  {docMeta.numberLabel && (
                    <Grid item xs={12} sm={4}>
                      <TextField label={docMeta.numberLabel} placeholder={docMeta.numberPlaceholder}
                        size="small" fullWidth value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
                    </Grid>
                  )}
                  {docMeta.hasExpiry && (
                    <Grid item xs={12} sm={3}>
                      <TextField label="Expiry Date" type="date" size="small" fullWidth
                        value={docExpiry} onChange={(e) => setDocExpiry(e.target.value)}
                        InputLabelProps={{ shrink: true }} />
                    </Grid>
                  )}
                  <Grid item xs={12} sm={docMeta.numberLabel ? 4 : 6}>
                    <Button variant="outlined" component="label" size="small" startIcon={<CloudUpload />} fullWidth sx={{ height: 40 }}>
                      {docFile ? docFile.name.slice(0, 18) + (docFile.name.length > 18 ? "…" : "") : "Select File"}
                      <input hidden type="file" accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <Button variant="contained" fullWidth size="small" onClick={handleDocUpload}
                      disabled={docUploading || !docFile} sx={{ height: 40 }}
                      startIcon={docUploading ? <CircularProgress size={14} /> : <CloudUpload />}>
                      Upload
                    </Button>
                  </Grid>
                </Grid>
              </Paper>

              {partner.documents.length === 0 && (
                <Alert severity="info">No documents uploaded yet. Use the form above to upload KYC documents.</Alert>
              )}
              {partner.documents.map((doc: PartnerDocument) => (
                <Paper key={doc.id} variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" fontWeight={700}>
                        {DOCUMENT_META[doc.document_type]?.label ?? doc.document_type.replace(/_/g, " ")}
                      </Typography>
                      {doc.document_number && (
                        <Typography variant="body2" color="primary.main" fontWeight={600}>
                          {DOCUMENT_META[doc.document_type]?.numberLabel ?? "Number"}: {doc.document_number}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}
                        {doc.expiry_date && ` · Expires: ${doc.expiry_date}`}
                        {doc.verified_at && ` · Verified: ${new Date(doc.verified_at).toLocaleDateString()}`}
                      </Typography>
                      {doc.remarks && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{doc.remarks}</Typography>}
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Chip label={doc.verification_status ?? "PENDING"} size="small" sx={{ fontWeight: 700 }}
                        color={doc.verification_status === "APPROVED" ? "success" : doc.verification_status === "REJECTED" ? "error" : "warning"} />
                      <Tooltip title="View Document">
                        <IconButton size="small" onClick={() => window.open(doc.file_url, "_blank")}><OpenInNew fontSize="small" /></IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  {doc.verification_status !== "APPROVED" && doc.verification_status !== "REJECTED" && (
                    <Stack direction="row" gap={1} sx={{ mt: 1.5 }}>
                      <Button size="small" variant="contained" color="success" startIcon={<CheckCircle />}
                        onClick={() => docVerifyMutation.mutate({ docId: doc.id, vs: "APPROVED" })}
                        disabled={docVerifyMutation.isPending}>Approve Document</Button>
                      <Button size="small" variant="outlined" color="error" startIcon={<Cancel />}
                        onClick={() => docVerifyMutation.mutate({ docId: doc.id, vs: "REJECTED", remarks: "Rejected by admin" })}
                        disabled={docVerifyMutation.isPending}>Reject</Button>
                    </Stack>
                  )}
                </Paper>
              ))}
            </Stack>
          )}

          {/* ── Bank Accounts ─────────────────────────────────────────── */}
          {!isLoading && partner && tab === 2 && (
            <Stack spacing={2}>
              {!showBankForm ? (
                <Button variant="outlined" startIcon={<Add />} onClick={() => setShowBankForm(true)} sx={{ alignSelf: "flex-start", borderRadius: 2 }}>
                  Add Bank Account
                </Button>
              ) : (
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2.5, bgcolor: "background.default" }}>
                  <Typography variant="subtitle2" fontWeight={700} color="primary" gutterBottom>New Bank Account</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField label="Account Holder Name *" fullWidth size="small"
                        value={bankForm.account_holder_name}
                        onChange={(e) => setBankForm((p) => ({ ...p, account_holder_name: e.target.value }))} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField label="Account Number *" fullWidth size="small"
                        value={bankForm.account_number_encrypted}
                        onChange={(e) => setBankForm((p) => ({ ...p, account_number_encrypted: e.target.value }))} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField label="IFSC Code *" fullWidth size="small"
                        value={bankForm.ifsc_code}
                        onChange={(e) => setBankForm((p) => ({ ...p, ifsc_code: e.target.value.toUpperCase() }))} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField label="Bank Name *" fullWidth size="small"
                        value={bankForm.bank_name}
                        onChange={(e) => setBankForm((p) => ({ ...p, bank_name: e.target.value }))} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField label="Branch Name" fullWidth size="small"
                        value={bankForm.branch_name}
                        onChange={(e) => setBankForm((p) => ({ ...p, branch_name: e.target.value }))} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Account Type</InputLabel>
                        <Select value={bankForm.account_type} label="Account Type"
                          onChange={(e) => setBankForm((p) => ({ ...p, account_type: e.target.value as "SAVINGS" | "CURRENT" }))}>
                          <MenuItem value="SAVINGS">Savings</MenuItem>
                          <MenuItem value="CURRENT">Current</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={4} sx={{ display: "flex", alignItems: "center" }}>
                      <FormControlLabel control={
                        <Checkbox checked={bankForm.is_primary}
                          onChange={(e) => setBankForm((p) => ({ ...p, is_primary: e.target.checked }))} />
                      } label="Set as Primary Account" />
                    </Grid>
                    <Grid item xs={12} sm={4} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Button variant="contained" onClick={handleBankSave} disabled={bankSaving}
                        startIcon={bankSaving ? <CircularProgress size={16} /> : <Save />} sx={{ borderRadius: 2 }}>
                        Save
                      </Button>
                      <Button onClick={() => setShowBankForm(false)} color="inherit">Cancel</Button>
                    </Grid>
                  </Grid>
                </Paper>
              )}

              {partner.bank_accounts.length === 0 && (
                <Alert severity="info">No bank accounts on file. Add one using the button above.</Alert>
              )}
              {partner.bank_accounts.map((b: PartnerBankAccount) => (
                <Paper key={b.id} variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1 }}>
                    <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                      <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: "primary.50",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <AccountBalance color="primary" />
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>{b.bank_name ?? "—"}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          IFSC: {b.ifsc_code ?? "—"} · {b.branch_name ?? "—"}
                        </Typography>
                        <Typography variant="body2" fontWeight={500}>{b.account_holder_name ?? "—"}</Typography>
                        {b.account_number_encrypted && (
                          <Typography variant="caption" color="text.secondary">
                            Acc: ****{b.account_number_encrypted.slice(-4)}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <Stack direction="row" gap={0.5} alignItems="center">
                      {b.is_primary && <Chip label="Primary" size="small" color="primary" />}
                      <Chip label={b.verification_status ?? "PENDING"} size="small" sx={{ fontWeight: 700 }}
                        color={b.verification_status === "APPROVED" ? "success" : b.verification_status === "REJECTED" ? "error" : "warning"} />
                    </Stack>
                  </Box>
                  {b.verification_status !== "VERIFIED" && b.verification_status !== "REJECTED" && (
                    <Stack direction="row" gap={1} sx={{ mt: 1.5 }}>
                      <Button size="small" variant="contained" color="success"
                        onClick={() => partnerService.verifyBankAccount(partner.id, b.id, "VERIFIED")
                          .then(() => { enqueueSnackbar("Bank account verified", { variant: "success" }); refetch(); })
                          .catch(() => enqueueSnackbar("Failed", { variant: "error" }))}>
                        Verify
                      </Button>
                      <Button size="small" variant="outlined" color="error"
                        onClick={() => partnerService.verifyBankAccount(partner.id, b.id, "REJECTED")
                          .then(() => { enqueueSnackbar("Bank account rejected", { variant: "success" }); refetch(); })
                          .catch(() => enqueueSnackbar("Failed", { variant: "error" }))}>
                        Reject
                      </Button>
                    </Stack>
                  )}
                </Paper>
              ))}
            </Stack>
          )}

          {/* ── Activity Log ──────────────────────────────────────────── */}
          {!isLoading && partner && tab === 3 && (
            <Stack spacing={0}>
              {partner.verification_logs.length === 0 && <Alert severity="info">No activity recorded yet.</Alert>}
              {partner.verification_logs.map((log, idx) => (
                <Box key={log.id} sx={{
                  display: "flex", gap: 2, py: 1.75,
                  borderBottom: idx < partner.verification_logs.length - 1 ? "1px solid" : "none",
                  borderColor: "divider",
                }}>
                  <Box sx={{ display: "flex", alignItems: "flex-start", pt: 0.25 }}>
                    <History fontSize="small" color="action" />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={700}>{log.action.replace(/_/g, " ")}</Typography>
                    {log.remarks && <Typography variant="caption" color="text.secondary">{log.remarks}</Typography>}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                    {new Date(log.created_at).toLocaleString()}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}

          {/* ── Wallet ─────────────────────────────────────────────────── */}
          {!isLoading && partner && tab === 4 && (
            <PartnerWalletTab partnerId={partner.id} />
          )}
        </Box>
      </Dialog>

      {/* Reason dialog */}
      <ReasonDialog open={reasonDialog.open} actionLabel={reasonDialog.label} loading={actionMutation.isPending}
        actionColor={reasonDialog.color}
        onClose={() => setReasonDialog({ open: false, key: "", label: "" })}
        onConfirm={(reason) => actionMutation.mutate({ key: reasonDialog.key, reason })} />

      {/* Edit partner dialog */}
      <EditPartnerDialog open={editOpen} partner={partner} cities={cities}
        onClose={() => setEditOpen(false)} onSaved={() => refetch()} />

      {/* ── Assign Commission Group Dialog ─────────────────────────────── */}
      <Dialog open={commGroupOpen} onClose={() => { setCommGroupOpen(false); setSelectedGroupId(""); }}
        maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}>

        {/* Header */}
        <Box sx={{
          px: 3, py: 2.5,
          background: "linear-gradient(135deg, #1a237e 0%, #283593 100%)",
          color: "white",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ bgcolor: "rgba(255,255,255,0.12)", borderRadius: 1.5, p: 0.75, display: "flex" }}>
              <GroupWork fontSize="small" />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>Assign Commission Group</Typography>
              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                {partner?.business_name || partner?.owner_name} · {partner?.partner_code}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => { setCommGroupOpen(false); setSelectedGroupId(""); }} sx={{ color: "white" }} size="small">
            <Close />
          </IconButton>
        </Box>

        <DialogContent sx={{ pt: 3 }}>
          {/* Current assignment */}
          {partner?.commission_group && (
            <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2 }}>
              Currently assigned: <strong>{partner.commission_group.group_name}</strong> — selecting a new group will replace this.
            </Alert>
          )}

          {/* Group selector cards */}
          <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 1.5 }}>
            SELECT COMMISSION GROUP
          </Typography>
          <Stack spacing={1.25}>
            {commissionGroups.filter((g) => g.is_active).map((g) => {
              const isSelected = String(selectedGroupId) === String(g.id);
              const isCurrent = partner?.commission_group?.id === g.id;
              const activeRules = g.rules?.filter((r: any) => r.is_active) ?? [];
              return (
                <Paper
                  key={g.id}
                  variant="outlined"
                  onClick={() => setSelectedGroupId(g.id)}
                  sx={{
                    p: 2, borderRadius: 2.5, cursor: "pointer",
                    border: "2px solid",
                    borderColor: isSelected ? "primary.main" : "divider",
                    bgcolor: isSelected ? "primary.50" : "background.paper",
                    transition: "all 0.15s",
                    "&:hover": { borderColor: "primary.light" },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                    <Box sx={{
                      width: 40, height: 40, borderRadius: 1.5, flexShrink: 0,
                      bgcolor: isSelected ? "primary.main" : "action.selected",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: isSelected ? "white" : "text.secondary",
                    }}>
                      <GroupWork fontSize="small" />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
                        <Typography variant="body2" fontWeight={800}>{g.group_name}</Typography>
                        {isCurrent && <Chip label="Current" size="small" color="info" sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }} />}
                      </Box>
                      {g.description && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>{g.description}</Typography>
                      )}
                      {activeRules.length > 0 ? (
                        <Stack direction="row" flexWrap="wrap" gap={0.5}>
                          {activeRules.map((r: any) => (
                            <Chip
                              key={r.id}
                              size="small"
                              label={`${r.service_type} ${r.commission_value}${r.commission_type === "PERCENTAGE" ? "%" : "₹"}`}
                              icon={r.service_type === "CAB" ? <DirectionsCar sx={{ fontSize: "12px !important" }} /> : r.service_type === "HOTEL" ? <Hotel sx={{ fontSize: "12px !important" }} /> : <Tour sx={{ fontSize: "12px !important" }} />}
                              variant="outlined"
                              color={isSelected ? "primary" : "default"}
                              sx={{ fontSize: "0.68rem", fontWeight: 700, height: 22 }}
                            />
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="caption" color="text.disabled">No active commission rules</Typography>
                      )}
                    </Box>
                    {isSelected && <TaskAlt color="primary" sx={{ flexShrink: 0, mt: 0.25 }} />}
                  </Box>
                </Paper>
              );
            })}
            {commissionGroups.filter((g) => g.is_active).length === 0 && (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                No active commission groups found. Create one in Settings → Commission Groups.
              </Alert>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 1.5, gap: 1 }}>
          <Button onClick={() => { setCommGroupOpen(false); setSelectedGroupId(""); }} color="inherit" disabled={commGroupSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAssignCommGroup}
            disabled={!selectedGroupId || commGroupSaving}
            startIcon={commGroupSaving ? <CircularProgress size={16} /> : <Save />}
            sx={{ borderRadius: 2, px: 3 }}
          >
            Assign Group
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN PARTNERS PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function PartnersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);

  // ── Load cities ONCE at page level and pass down ──────────────────────────
  const { data: cities = [] } = useCities();

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-partners", page, rowsPerPage, statusFilter, typeFilter],
    queryFn: () =>
      partnerService.list({ page: page + 1, page_size: rowsPerPage,
        status: statusFilter || undefined, partner_type: typeFilter || undefined }),
    placeholderData: (prev) => prev,
  });

  const partners: AdminPartnerListItem[] = data?.items ?? [];
  const filtered = search
    ? partners.filter((p) =>
        [p.contact_person, p.business_name, p.partner_code, p.mobile_number]
          .some((v) => v?.toLowerCase().includes(search.toLowerCase()))
      )
    : partners;

  // Status counts for chips
  const statusCounts: Record<string, number> = useMemo(() => {
    const counts: Record<string, number> = {};
    partners.forEach((p) => { counts[p.status] = (counts[p.status] ?? 0) + 1; });
    return counts;
  }, [partners]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Partners</Typography>
          <Typography variant="body2" color="text.secondary">Manage onboarding, KYC review and partner operations</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={() => refetch()} disabled={isFetching}><Refresh /></IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<Add />} size="small" onClick={() => setRegisterOpen(true)}
            sx={{ borderRadius: 2 }}>
            Register Partner
          </Button>
        </Box>
      </Box>

      {/* Status filter chips */}
      <Box sx={{ mb: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
        {["", "PENDING", "UNDER_REVIEW", "DOCUMENT_PENDING", "APPROVED", "ACTIVE", "SUSPENDED", "BLOCKED"].map((s) => (
          <Chip key={s || "ALL"}
            label={s ? (STATUS_META[s]?.label ?? s) : `All (${data?.total ?? 0})`}
            color={statusFilter === s ? (STATUS_META[s]?.color ?? "primary") : "default"}
            variant={statusFilter === s ? "filled" : "outlined"}
            size="small" clickable onClick={() => { setStatusFilter(s); setPage(0); }}
            sx={{ fontWeight: 600 }} />
        ))}
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 2, borderRadius: 2.5 }}>
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <TextField size="small" placeholder="Search by name, code, mobile…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <Search fontSize="small" sx={{ mr: 0.5, color: "text.disabled" }} /> }}
              sx={{ minWidth: 240, flex: 1 }} />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Partner Type</InputLabel>
              <Select value={typeFilter} label="Partner Type"
                onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}>
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="INDIVIDUAL">Individual</MenuItem>
                <MenuItem value="COMPANY">Company</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {/* Table */}
      <Card sx={{ borderRadius: 2.5 }}>
        {(isLoading || isFetching) && <LinearProgress />}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "background.default", py: 1.5, whiteSpace: "nowrap" } }}>
                <TableCell sx={{ minWidth: 220 }}>Partner</TableCell>
                <TableCell sx={{ minWidth: 110 }}>Type</TableCell>
                <TableCell sx={{ minWidth: 160 }}>Mobile / Email</TableCell>
                <TableCell sx={{ minWidth: 130 }}>City</TableCell>
                <TableCell sx={{ minWidth: 120 }}>Status</TableCell>
                <TableCell sx={{ minWidth: 100 }}>Registered</TableCell>
                <TableCell align="center" sx={{ minWidth: 120 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6, color: "text.disabled" }}>
                    No partners found
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((p) => {
                const rowActions = getActions(p.status).slice(0, 2);
                return (
                  <TableRow key={p.id} hover sx={{ cursor: "pointer", "& td": { py: 2, verticalAlign: "middle" } }}
                    onClick={() => setSelectedId(p.id)}>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Avatar sx={{ width: 40, height: 40, bgcolor: "primary.main", color: "white", fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
                          {(p.business_name || p.contact_person || "?")[0].toUpperCase()}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={700} noWrap>
                            {p.business_name || p.contact_person || "—"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">{p.partner_code ?? "—"}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={p.partner_type ?? "—"} size="small"
                        color={p.partner_type === "COMPANY" ? "secondary" : "default"}
                        variant="outlined" sx={{ fontWeight: 600 }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{p.mobile_number ?? "—"}</Typography>
                      {p.email && (
                        <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ maxWidth: 160 }}>
                          {p.email}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {/* ← FIX: uses cityLabel() to resolve name from loaded cities list */}
                      <Typography variant="body2" fontWeight={500}>
                        <CityName cityId={p.city_id} cities={cities} />
                      </Typography>
                    </TableCell>
                    <TableCell><StatusChip status={p.status} /></TableCell>
                    <TableCell>
                      <Typography variant="body2">{new Date(p.created_at).toLocaleDateString("en-IN")}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(p.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                      <Stack direction="row" justifyContent="center" spacing={0.5}>
                        {rowActions.map((a) => (
                          <Tooltip key={a.key} title={a.label}>
                            <span>
                              <IconButton size="small" color={a.color}
                                onClick={(e) => { e.stopPropagation(); setSelectedId(p.id); }}>
                                {a.icon}
                              </IconButton>
                            </span>
                          </Tooltip>
                        ))}
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setSelectedId(p.id); }}>
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={data?.total ?? 0} page={page} rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 20, 50]}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }} />
      </Card>

      {/* KYC Modal — cities passed as prop (fix) */}
      <KycModal
        partnerId={selectedId}
        onClose={() => setSelectedId(null)}
        onActionDone={() => qc.invalidateQueries({ queryKey: ["admin-partners"] })}
        cities={cities}
      />

      {/* Register Partner Dialog */}
      <RegisterPartnerDialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onDone={() => qc.invalidateQueries({ queryKey: ["admin-partners"] })}
      />
    </Box>
  );
}
