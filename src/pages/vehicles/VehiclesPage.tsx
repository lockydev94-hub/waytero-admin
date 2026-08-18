// ============================================================
// WAYTERO ADMIN — VEHICLES PAGE  (Premium v1 — Full)
// Doc Ref:
//   DB Schema Part 3 §12-15 | Migration 0017
//   Admin API §10 — Vehicle Management
//   BRD Part 3 §30-40 — Vehicle Verification Flow
//
// Status flow: PENDING → UNDER_REVIEW → APPROVED → ACTIVE
//              ACTIVE  → MAINTENANCE | SUSPENDED | INACTIVE
// Verification: Admin assigns officer OR approves directly.
// Documents: RC, INSURANCE, FITNESS_CERTIFICATE, PERMIT, PUC
// Photos: FRONT, BACK, LEFT, RIGHT, INTERIOR, ODOMETER, ENGINE, OTHER
// ============================================================

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Box, Typography, Card, CardContent, Chip, Button, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TextField, MenuItem, Select, FormControl, InputLabel,
  Stack, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogActions, LinearProgress, Alert, Avatar, Grid,
  Paper, Tab, Tabs, CircularProgress, Skeleton,
  Divider, InputAdornment, Badge as MuiBadge,
  alpha, useTheme, Collapse, List, ListItem, ListItemText,
  ListItemIcon, ListItemSecondaryAction,
} from "@mui/material";
import {
  Search, Refresh, Add, CheckCircle,
  Cancel, PlayArrow, Pause, Visibility,
  History, Close, Person, Business, Phone, LocationCity,
  DirectionsCar, Badge, Description, TaskAlt,
  ErrorOutline, HourglassTop, Image as ImageIcon,
  Assignment, VerifiedUser, LocalPolice, Speed,
  Engineering, CloudUpload, ExpandMore, ExpandLess,
  AttachMoney, Route, ArrowRight, CheckCircleOutline,
  HighlightOff, DoNotDisturb, ManageSearch,
  AssignmentInd,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  vehicleService,
  AdminVehicleListItem,
  VehicleDetail,
  VehicleDocumentDetail,
  VehiclePhotoDetail,
  VEHICLE_STATUS_META,
  V_TRANSITIONS,
  DOCUMENT_TYPES,
  PHOTO_TYPES,
  FUEL_TYPES,
  TRIP_TYPE_LABELS,
  RegisterVehiclePayload,
  PartnerWithCab,
  PartnerWithCabPage,
} from "../../services/vehicle.service";
import { settingsService, City, VehicleCategory, uploadMedia } from "../../services/settings.service";
import apiClient from "../../services/api";
import { partnerService } from "../../services/partner.service";

// ── Types ─────────────────────────────────────────────────────

interface VerificationOfficer {
  id: string;
  full_name: string;
  mobile: string;
  email?: string;
}

interface AdminPartnerMinimal {
  id: number;
  owner_name: string;
  business_name: string | null;
  mobile: string | null;
  partner_code: string;
  city_id: number | null;
  status: string;
  has_cab?: boolean;          // true if CAB service is active
  active_services?: string;  // comma-separated e.g. "CAB,HOTEL,TOUR"
}

// ── Status chip ───────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const meta = VEHICLE_STATUS_META[status] ?? { label: status, color: "default" as const };
  return (
    <Chip label={meta.label} color={meta.color} size="small"
      sx={{ fontWeight: 600, letterSpacing: 0.3, minWidth: 88 }} />
  );
}

// ── Doc / Photo status chip ───────────────────────────────────

function VerifyChip({ status }: { status: string }) {
  const COLOR_MAP: Record<string, "default" | "warning" | "success" | "error"> = {
    PENDING: "warning",
    APPROVED: "success",
    REJECTED: "error",
  };
  return (
    <Chip
      label={status}
      color={COLOR_MAP[status] ?? "default"}
      size="small"
      sx={{ fontWeight: 600, fontSize: 10, height: 20 }}
    />
  );
}

// ── Photo type label ──────────────────────────────────────────

const PHOTO_TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  FRONT:    { label: "Front View",   icon: <DirectionsCar fontSize="small" /> },
  BACK:     { label: "Rear View",    icon: <DirectionsCar fontSize="small" sx={{ transform: "scaleX(-1)" }} /> },
  LEFT:     { label: "Left Side",    icon: <ArrowRight fontSize="small" /> },
  RIGHT:    { label: "Right Side",   icon: <ArrowRight fontSize="small" sx={{ transform: "scaleX(-1)" }} /> },
  INTERIOR: { label: "Interior",     icon: <Speed fontSize="small" /> },
  ODOMETER: { label: "Odometer",     icon: <Speed fontSize="small" /> },
  ENGINE:   { label: "Engine Bay",   icon: <Engineering fontSize="small" /> },
  OTHER:    { label: "Other",        icon: <ImageIcon fontSize="small" /> },
};

// ── Document type icon ────────────────────────────────────────

const DOC_ICON: Record<string, React.ReactNode> = {
  RC:                   <Description fontSize="small" />,
  INSURANCE:            <VerifiedUser fontSize="small" />,
  FITNESS_CERTIFICATE:  <TaskAlt fontSize="small" />,
  PERMIT:               <LocalPolice fontSize="small" />,
  PUC:                  <CheckCircle fontSize="small" />,
};

// ── Pricing block ─────────────────────────────────────────────

function PricingBlock({ pricing }: { pricing: { source: string; rules: any[] } }) {
  const theme = useTheme();
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <AttachMoney fontSize="small" color="primary" />
        <Typography variant="caption" fontWeight={700} color="primary">
          {pricing.source === "city" ? "City Pricing" : "Default Pricing"}
        </Typography>
        <Chip
          label={pricing.source === "city" ? "City-Specific" : "Platform Default"}
          size="small"
          color={pricing.source === "city" ? "primary" : "default"}
          sx={{ height: 18, fontSize: 10 }}
        />
      </Stack>
      <Box
        sx={{
          borderRadius: 1.5,
          border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
          overflow: "hidden",
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
              <TableCell sx={{ py: 0.5, fontSize: 11, fontWeight: 700 }}>Trip Type</TableCell>
              <TableCell sx={{ py: 0.5, fontSize: 11, fontWeight: 700 }} align="right">Base Fare</TableCell>
              <TableCell sx={{ py: 0.5, fontSize: 11, fontWeight: 700 }} align="right">Per KM</TableCell>
              <TableCell sx={{ py: 0.5, fontSize: 11, fontWeight: 700 }} align="right">Min KM</TableCell>
              <TableCell sx={{ py: 0.5, fontSize: 11, fontWeight: 700 }} align="right">Allowance</TableCell>
              <TableCell sx={{ py: 0.5, fontSize: 11, fontWeight: 700 }} align="right">Night</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pricing.rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 2, color: "text.disabled", fontSize: 12 }}>
                  No pricing rules found
                </TableCell>
              </TableRow>
            ) : (
              pricing.rules.map((r: any, i: number) => (
                <TableRow key={i} hover>
                  <TableCell sx={{ py: 0.5, fontSize: 12 }}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Route fontSize="small" sx={{ color: "primary.main", fontSize: 14 }} />
                      {TRIP_TYPE_LABELS[r.trip_type] ?? r.trip_type}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ py: 0.5, fontSize: 12 }} align="right">₹{r.base_fare}</TableCell>
                  <TableCell sx={{ py: 0.5, fontSize: 12 }} align="right">₹{r.per_km_rate}</TableCell>
                  <TableCell sx={{ py: 0.5, fontSize: 12 }} align="right">{r.minimum_km ?? "—"}</TableCell>
                  <TableCell sx={{ py: 0.5, fontSize: 12 }} align="right">₹{r.driver_allowance}</TableCell>
                  <TableCell sx={{ py: 0.5, fontSize: 12 }} align="right">₹{r.night_charge}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}

// ── KYC Progress bar ──────────────────────────────────────────

function VerificationProgress({ documents, photos }: { documents: VehicleDocumentDetail[]; photos: VehiclePhotoDetail[] }) {
  const docApproved = documents.filter((d) => d.verification_status === "APPROVED").length;
  const photoApproved = photos.filter((p) => p.verification_status === "APPROVED").length;
  const total = DOCUMENT_TYPES.length + PHOTO_TYPES.length;
  const done = docApproved + photoApproved;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">Verification progress</Typography>
        <Typography variant="caption" fontWeight={700} color="primary">{pct}%</Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{ height: 6, borderRadius: 3 }}
        color={pct >= 100 ? "success" : pct > 50 ? "primary" : "warning"}
      />
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
        <Typography variant="caption" color="text.disabled">
          Docs: {docApproved}/{DOCUMENT_TYPES.length}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          Photos: {photoApproved}/{PHOTO_TYPES.length}
        </Typography>
      </Stack>
    </Box>
  );
}

// ── Add Vehicle Dialog (Premium Wizard) ──────────────────────

// Step indicator
function StepDot({ label, step, current }: { label: string; step: number; current: number }) {
  const theme = useTheme();
  const done = current > step;
  const active = current === step;
  return (
    <Stack alignItems="center" spacing={0.5} sx={{ minWidth: 64 }}>
      <Box sx={{
        width: 32, height: 32, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: 13,
        transition: "all .25s",
        bgcolor: done ? "success.main" : active ? "primary.main" : alpha(theme.palette.divider, 0.5),
        color: (done || active) ? "#fff" : "text.disabled",
        boxShadow: active ? `0 0 0 4px ${alpha(theme.palette.primary.main, 0.18)}` : "none",
      }}>
        {done ? <CheckCircle sx={{ fontSize: 18 }} /> : step}
      </Box>
      <Typography variant="caption" fontWeight={active ? 700 : 400}
        color={active ? "primary" : done ? "success.main" : "text.disabled"} noWrap>
        {label}
      </Typography>
    </Stack>
  );
}

function StepConnector({ done }: { done: boolean }) {
  const theme = useTheme();
  return (
    <Box sx={{
      flex: 1, height: 2, mt: "15px", mb: "auto", mx: 0.5,
      bgcolor: done ? "success.main" : alpha(theme.palette.divider, 0.5),
      transition: "background .3s",
    }} />
  );
}

interface AddVehicleDialogProps {
  open: boolean;
  onClose: () => void;
}

function AddVehicleDialog({ open, onClose }: AddVehicleDialogProps) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();

  const [step, setStep] = useState(1); // 1=Partner, 2=VehicleInfo, 3=Confirm
  const [form, setForm] = useState<Partial<RegisterVehiclePayload>>({});
  const [pricingPreview, setPricingPreview] = useState<any>(null);
  const [selectedPartner, setSelectedPartner] = useState<AdminPartnerMinimal | null>(null);
  const [commGroup, setCommGroup] = useState<any>(null);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [partnerServices, setPartnerServices] = useState<string[]>([]);
  const [cabLinkLoading, setCabLinkLoading] = useState(false);

  // Partner search state
  const [partnerSearch, setPartnerSearch] = useState("");
  const [partnerPage, setPartnerPage] = useState(1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounced search query
  const { data: partnerPage1, isLoading: partnersLoading, isFetching: partnersFetching } =
    useQuery<PartnerWithCabPage>({
      queryKey: ["partners-with-cab", partnerSearch, partnerPage],
      queryFn: () => vehicleService.listPartnersWithCab(partnerSearch || undefined, partnerPage, 15),
      staleTime: 60 * 1000,
      enabled: open && step === 1,
      placeholderData: (prev) => prev,
    });

  const partners = partnerPage1?.items ?? [];
  const partnersTotal = partnerPage1?.total ?? 0;
  const partnerTotalPages = Math.ceil(partnersTotal / 15);

  const { data: cities = [] } = useQuery<City[]>({
    queryKey: ["cities"],
    queryFn: () => (settingsService as any).getCities(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: categories = [] } = useQuery<VehicleCategory[]>({
    queryKey: ["vehicle-categories"],
    queryFn: () => (settingsService as any).getVehicleCategories(true),
    staleTime: 5 * 60 * 1000,
  });

  const handleClose = () => {
    setStep(1);
    setForm({});
    setPricingPreview(null);
    setSelectedPartner(null);
    setCommGroup(null);
    setPartnerSearch("");
    setPartnerPage(1);
    onClose();
  };

  // Debounce search input
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlePartnerSearchChange = useCallback((val: string) => {
    setPartnerSearch(val);
    setPartnerPage(1);
  }, []);

  const handleSelectPartner = async (partner: AdminPartnerMinimal) => {
    setSelectedPartner(partner);
    setForm((f) => ({ ...f, partner_id: partner.id, city_id: partner.city_id ?? undefined }));
    setCommGroup(null);
    setPartnerServices([]);
    try {
      const detail = await apiClient.get(`/admin/partners/${partner.id}`).then((r) => r.data);
      setCommGroup(detail.commission_group ?? null);
      // Extract active service types
      const activeServices = (detail.services ?? [])
        .filter((s: any) => s.is_active)
        .map((s: any) => s.service_type as string);
      setPartnerServices(activeServices);
    } catch {
      setCommGroup(null);
      setPartnerServices([]);
    }
  };

  const handleQuickLinkCab = async () => {
    if (!selectedPartner) return;
    setCabLinkLoading(true);
    try {
      // Add CAB to existing services
      const newServices = Array.from(new Set([...partnerServices, "CAB"]));
      await partnerService.updateServices(selectedPartner.id, newServices);
      setPartnerServices(newServices);
      enqueueSnackbar(`CAB service linked to ${selectedPartner.owner_name}`, { variant: "success" });
      // Refresh partner list
      queryClient.invalidateQueries({ queryKey: ["partners-with-cab"] });
    } catch (err: any) {
      enqueueSnackbar(err?.response?.data?.detail ?? "Failed to link CAB service", { variant: "error" });
    }
    setCabLinkLoading(false);
  };

  const fetchPricing = async (city_id: number, vehicle_category_id: number) => {
    setLoadingPricing(true);
    try {
      const p = await vehicleService.getPricingPreview(city_id, vehicle_category_id);
      setPricingPreview(p);
    } catch { setPricingPreview(null); }
    setLoadingPricing(false);
  };

  const handleCategoryChange = (category_id: number) => {
    setForm((f) => ({ ...f, vehicle_category_id: category_id }));
    if (form.city_id && category_id) fetchPricing(form.city_id, category_id);
  };

  const handleCityChange = (city_id: number) => {
    setForm((f) => ({ ...f, city_id }));
    if (form.vehicle_category_id && city_id) fetchPricing(city_id, form.vehicle_category_id!);
  };

  const mutation = useMutation({
    mutationFn: (payload: RegisterVehiclePayload) => vehicleService.registerVehicle(payload),
    onSuccess: (data) => {
      enqueueSnackbar(`Vehicle ${data.vehicle_code} registered — Status: PENDING`, { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["admin-vehicles"] });
      handleClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? "Failed to register vehicle";
      enqueueSnackbar(typeof msg === "string" ? msg : "Registration failed", { variant: "error" });
    },
  });

  const step1Valid = !!form.partner_id;
  const step2Valid = !!(form.vehicle_category_id && form.registration_number?.trim() && form.city_id);
  const catObj = categories.find((c) => c.id === form.vehicle_category_id);
  const cityObj = cities.find((c) => c.id === form.city_id);

  const STEPS = ["Select Partner", "Vehicle Details", "Review & Submit"];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: theme.palette.mode === "dark"
            ? "linear-gradient(145deg, #1a1f2e 0%, #151a26 100%)"
            : "linear-gradient(145deg, #ffffff 0%, #f8faff 100%)",
          overflow: "hidden",
        },
      }}
    >
      {/* Premium Header */}
      <Box sx={{
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.dark, 0.9)} 100%)`,
        px: 3, py: 2.5, color: "#fff",
      }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{ bgcolor: "rgba(255,255,255,0.2)", width: 44, height: 44 }}>
            <DirectionsCar />
          </Avatar>
          <Box flex={1}>
            <Typography variant="h6" fontWeight={800} sx={{ color: "#fff" }}>Register Vehicle</Typography>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.75)" }}>
              Admin registers a vehicle on behalf of a partner
            </Typography>
          </Box>
          <IconButton size="small" onClick={handleClose} sx={{ color: "rgba(255,255,255,0.8)" }}>
            <Close />
          </IconButton>
        </Stack>

        {/* Step indicators */}
        <Stack direction="row" alignItems="flex-start" sx={{ mt: 2.5 }}>
          {STEPS.map((label, i) => (
            <React.Fragment key={i}>
              <StepDot label={label} step={i + 1} current={step} />
              {i < STEPS.length - 1 && <StepConnector done={step > i + 1} />}
            </React.Fragment>
          ))}
        </Stack>
      </Box>

      <DialogContent sx={{ pt: 3, px: 3 }}>

        {/* ── Step 1: Select Partner ─────────────────────────────── */}
        {step === 1 && (
          <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
              Choose Partner
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              All <strong>ACTIVE partners</strong> are shown. Partners already linked to CAB service are ready. Others will have CAB <strong>auto-linked</strong> when you register a vehicle for them.
            </Typography>

            {/* Search box */}
            <TextField
              fullWidth
              size="small"
              placeholder="Search by name, business, mobile or partner code…"
              value={partnerSearch}
              onChange={(e) => handlePartnerSearchChange(e.target.value)}
              inputRef={searchInputRef}
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" color="action" />
                  </InputAdornment>
                ),
                endAdornment: (partnersFetching && !partnersLoading) ? (
                  <InputAdornment position="end">
                    <CircularProgress size={16} />
                  </InputAdornment>
                ) : partnerSearch ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => handlePartnerSearchChange("")}>
                      <Close fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
              sx={{ mb: 1.5 }}
            />

            {/* Results */}
            {partnersLoading ? (
              <Stack spacing={1.5}>
                {[...Array(4)].map((_, i) => <Skeleton key={i} height={72} sx={{ borderRadius: 2 }} />)}
              </Stack>
            ) : partners.length === 0 ? (
              <Paper variant="outlined" sx={{ p: 4, textAlign: "center", borderRadius: 2 }}>
                <Business sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
                <Typography variant="body2" color="text.disabled" fontWeight={600}>
                  {partnerSearch ? `No partners found for "${partnerSearch}"` : "No ACTIVE partners found"}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {partnerSearch ? "Try a different search term" : "Create or activate a partner first in the Partners section"}
                </Typography>
              </Paper>
            ) : (
              <>
                <Stack spacing={1.2} sx={{ maxHeight: 300, overflowY: "auto", pr: 0.5 }}>
                  {partners.map((p) => {
                    const isSelected = form.partner_id === p.id;
                    return (
                      <Paper
                        key={p.id}
                        variant="outlined"
                        onClick={() => handleSelectPartner(p)}
                        sx={{
                          p: 1.5, borderRadius: 2, cursor: "pointer",
                          transition: "all .18s",
                          borderColor: isSelected ? "primary.main" : "divider",
                          borderWidth: isSelected ? 2 : 1,
                          bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.06) : "transparent",
                          "&:hover": {
                            borderColor: "primary.main",
                            bgcolor: alpha(theme.palette.primary.main, 0.04),
                            transform: "translateY(-1px)",
                            boxShadow: 1,
                          },
                        }}
                      >
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar sx={{
                            width: 40, height: 40,
                            bgcolor: isSelected ? "primary.main" : alpha(theme.palette.primary.main, 0.1),
                            color: isSelected ? "#fff" : "primary.main",
                            fontWeight: 800, fontSize: 15,
                          }}>
                            {(p.owner_name ?? "?").charAt(0).toUpperCase()}
                          </Avatar>
                          <Box flex={1} minWidth={0}>
                            <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap">
                              <Typography variant="body2" fontWeight={700} noWrap>
                                {p.owner_name}
                              </Typography>
                              <Chip
                                label={p.partner_code}
                                size="small"
                                sx={{ height: 18, fontSize: 10, fontFamily: "monospace", letterSpacing: 0.5 }}
                              />
                            </Stack>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {[p.business_name, p.mobile].filter(Boolean).join(" · ")}
                            </Typography>
                            {/* Service badges */}
                            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap">
                              {p.has_cab ? (
                                <Chip label="CAB ✓" size="small" color="success"
                                  sx={{ height: 16, fontSize: 9, fontWeight: 700 }} />
                              ) : (
                                <Chip label="CAB (auto-link)" size="small" color="warning" variant="outlined"
                                  sx={{ height: 16, fontSize: 9, fontWeight: 600 }} />
                              )}
                              {(p.active_services ?? "").split(",").filter(s => s && s !== "CAB").map(svc => (
                                <Chip key={svc} label={svc} size="small" color="info" variant="outlined"
                                  sx={{ height: 16, fontSize: 9 }} />
                              ))}
                            </Stack>
                          </Box>
                          {isSelected && <CheckCircle color="primary" fontSize="small" />}
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>

                {/* Pagination row */}
                {partnerTotalPages > 1 && (
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      {partnersTotal} partners found
                    </Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <IconButton
                        size="small"
                        disabled={partnerPage <= 1 || partnersFetching}
                        onClick={() => setPartnerPage((p) => p - 1)}
                      >
                        <ArrowRight sx={{ transform: "rotate(180deg)", fontSize: 16 }} />
                      </IconButton>
                      <Typography variant="caption" fontWeight={600}>
                        {partnerPage} / {partnerTotalPages}
                      </Typography>
                      <IconButton
                        size="small"
                        disabled={partnerPage >= partnerTotalPages || partnersFetching}
                        onClick={() => setPartnerPage((p) => p + 1)}
                      >
                        <ArrowRight sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Stack>
                  </Stack>
                )}
                {partnersTotal > 0 && partnerTotalPages === 1 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                    {partnersTotal} active partner{partnersTotal !== 1 ? "s" : ""}
                  </Typography>
                )}
              </>
            )}

            {/* Commission group info after partner selected */}
            {selectedPartner && (
              <Box sx={{ mt: 2 }}>
                {commGroup ? (
                  <Alert severity="info" icon={<ManageSearch />} sx={{ borderRadius: 2 }}>
                    <Typography variant="body2" fontWeight={700}>Commission Group: {commGroup.group_name}</Typography>
                    {commGroup.description && (
                      <Typography variant="caption" color="text.secondary">{commGroup.description}</Typography>
                    )}
                  </Alert>
                ) : (
                  <Alert severity="warning" sx={{ borderRadius: 2 }}>
                    <Typography variant="caption">
                      No commission group assigned to <strong>{selectedPartner.owner_name}</strong> — Default platform pricing will apply.
                    </Typography>
                  </Alert>
                )}
              </Box>
            )}
          </Box>
        )}

                {/* ── Step 2: Vehicle Details ─────────────────────────────── */}
        {step === 2 && (
          <Box>
            {/* Selected partner reminder */}
            {selectedPartner && (
              <Paper variant="outlined" sx={{
                p: 1.5, mb: 2.5, borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.04),
                borderColor: alpha(theme.palette.primary.main, 0.3),
              }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", fontSize: 13, fontWeight: 700 }}>
                    {selectedPartner.owner_name.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Partner</Typography>
                    <Typography variant="body2" fontWeight={700}>{selectedPartner.owner_name}</Typography>
                  </Box>
                  {commGroup && (
                    <>
                      <Divider orientation="vertical" flexItem />
                      <Box>
                        <Typography variant="caption" color="text.secondary">Commission Group</Typography>
                        <Typography variant="body2" fontWeight={600}>{commGroup.group_name}</Typography>
                      </Box>
                    </>
                  )}
                </Stack>
              </Paper>
            )}

            <Grid container spacing={2}>
              {/* Vehicle Category */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Vehicle Category *</InputLabel>
                  <Select
                    label="Vehicle Category *"
                    value={form.vehicle_category_id ?? ""}
                    onChange={(e) => handleCategoryChange(e.target.value as number)}
                  >
                    {categories.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <DirectionsCar fontSize="small" color="action" />
                          <Box>
                            <Typography variant="body2" fontWeight={600}>{c.category_name}</Typography>
                            {c.seating_capacity && (
                              <Typography variant="caption" color="text.secondary">{c.seating_capacity} seats</Typography>
                            )}
                          </Box>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* City */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Operating City *</InputLabel>
                  <Select
                    label="Operating City *"
                    value={form.city_id ?? ""}
                    onChange={(e) => handleCityChange(e.target.value as number)}
                  >
                    {cities.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <LocationCity fontSize="small" color="action" />
                          <Typography variant="body2">{c.name}</Typography>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Registration Number */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth size="small" label="Registration Number *"
                  placeholder="e.g. OD05AB1234"
                  value={form.registration_number ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, registration_number: e.target.value.toUpperCase() }))}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Badge fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                    style: { fontFamily: "monospace", fontWeight: 700 },
                  }}
                />
              </Grid>

              {/* Brand */}
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Vehicle Brand"
                  placeholder="e.g. Maruti, Hyundai, Toyota"
                  value={form.vehicle_brand ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, vehicle_brand: e.target.value }))}
                />
              </Grid>

              {/* Model */}
              <Grid item xs={12} md={4}>
                <TextField fullWidth size="small" label="Model Name"
                  placeholder="e.g. Swift, Creta, Innova"
                  value={form.vehicle_model ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, vehicle_model: e.target.value }))}
                />
              </Grid>

              {/* Year */}
              <Grid item xs={12} md={4}>
                <TextField fullWidth size="small" label="Manufacturing Year"
                  type="number" inputProps={{ min: 1990, max: 2030 }}
                  value={form.manufacturing_year ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, manufacturing_year: parseInt(e.target.value) || undefined }))}
                />
              </Grid>

              {/* Color */}
              <Grid item xs={12} md={4}>
                <TextField fullWidth size="small" label="Color"
                  placeholder="e.g. White, Silver"
                  value={form.color ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                />
              </Grid>

              {/* Fuel */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Fuel Type</InputLabel>
                  <Select
                    label="Fuel Type"
                    value={form.fuel_type ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, fuel_type: e.target.value }))}
                  >
                    {FUEL_TYPES.map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>

              {/* Seating */}
              <Grid item xs={12} md={6}>
                <TextField fullWidth size="small" label="Seating Capacity"
                  type="number" inputProps={{ min: 1, max: 60 }}
                  value={form.seating_capacity ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, seating_capacity: parseInt(e.target.value) || undefined }))}
                />
              </Grid>

              {/* Pricing Preview */}
              {(pricingPreview || loadingPricing) && form.city_id && form.vehicle_category_id && (
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      Price Structure Preview · {cityObj?.name ?? ""} · {catObj?.category_name ?? ""}
                    </Typography>
                  </Divider>
                  {loadingPricing ? (
                    <Skeleton height={120} sx={{ borderRadius: 2 }} />
                  ) : (
                    <PricingBlock pricing={pricingPreview} />
                  )}
                </Grid>
              )}
            </Grid>
          </Box>
        )}

        {/* ── Step 3: Review & Submit ─────────────────────────────── */}
        {step === 3 && (
          <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
              Review Vehicle Details
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: "block", mb: 1.5 }}>
                    PARTNER
                  </Typography>
                  <Stack spacing={1}>
                    {[
                      ["Name", selectedPartner?.owner_name ?? "—"],
                      ["Business", selectedPartner?.business_name ?? "—"],
                      ["Mobile", selectedPartner?.mobile ?? "—"],
                      ["Commission Group", commGroup?.group_name ?? "Default Pricing"],
                    ].map(([l, v]) => (
                      <Stack key={l} direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">{l}</Typography>
                        <Typography variant="caption" fontWeight={600}>{v}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: "block", mb: 1.5 }}>
                    VEHICLE
                  </Typography>
                  <Stack spacing={1}>
                    {[
                      ["Category", catObj?.category_name ?? "—"],
                      ["Reg. Number", form.registration_number ?? "—"],
                      ["Brand", form.vehicle_brand ?? "—"],
                      ["Model", form.vehicle_model ?? "—"],
                      ["Year", form.manufacturing_year?.toString() ?? "—"],
                      ["Fuel", form.fuel_type ?? "—"],
                      ["Seats", form.seating_capacity?.toString() ?? "—"],
                      ["Color", form.color ?? "—"],
                      ["City", cityObj?.name ?? "—"],
                    ].map(([l, v]) => (
                      <Stack key={l} direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">{l}</Typography>
                        <Typography variant="caption" fontWeight={600}
                          sx={l === "Reg. Number" ? { fontFamily: "monospace" } : {}}>
                          {v}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Paper>
              </Grid>
              {pricingPreview && (
                <Grid item xs={12}>
                  <PricingBlock pricing={pricingPreview} />
                </Grid>
              )}
              <Grid item xs={12}>
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  <Typography variant="caption">
                    Vehicle will be registered with status <strong>PENDING</strong>.
                    Upload documents and photos after registration, then move to <strong>UNDER_REVIEW → APPROVED → ACTIVE</strong>.
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </Box>
        )}
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        {step > 1 && (
          <Button onClick={() => setStep((s) => s - 1)} color="inherit" startIcon={<History />}>
            Back
          </Button>
        )}
        <Box flex={1} />
        <Button onClick={handleClose} color="inherit">Cancel</Button>

        {step < 3 && (
          <Button
            variant="contained"
            disabled={step === 1 ? !step1Valid : !step2Valid}
            onClick={() => setStep((s) => s + 1)}
            sx={{ borderRadius: 2, fontWeight: 700, px: 3 }}
          >
            Next →
          </Button>
        )}
        {step === 3 && (
          <Button
            variant="contained"
            color="success"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(form as RegisterVehiclePayload)}
            startIcon={mutation.isPending ? <CircularProgress size={16} /> : <CheckCircle />}
            sx={{ borderRadius: 2, fontWeight: 700, px: 3 }}
          >
            {mutation.isPending ? "Registering…" : "Register Vehicle"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ── Activation Roadmap Banner ────────────────────────────────
// Shows the vehicle activation flow visually with current step highlighted

const ACTIVATION_STEPS = [
  {
    key: "PENDING",
    label: "Registered",
    sub: "Vehicle submitted",
    icon: <HourglassTop fontSize="small" />,
    color: "#9e9e9e",
  },
  {
    key: "UNDER_REVIEW",
    label: "Under Review",
    sub: "Docs & photos being verified",
    icon: <ManageSearch fontSize="small" />,
    color: "#f57c00",
  },
  {
    key: "APPROVED",
    label: "Approved",
    sub: "All checks passed",
    icon: <TaskAlt fontSize="small" />,
    color: "#0288d1",
  },
  {
    key: "ACTIVE",
    label: "Active",
    sub: "Ready to take bookings",
    icon: <CheckCircle fontSize="small" />,
    color: "#2e7d32",
  },
] as const;

const ACTIVATION_STATUS_ORDER = ["PENDING", "UNDER_REVIEW", "APPROVED", "ACTIVE"];

interface ActivationRoadmapProps {
  vehicle: VehicleDetail;
}

function ActivationRoadmap({ vehicle }: ActivationRoadmapProps) {
  const theme = useTheme();
  const currentIdx = ACTIVATION_STATUS_ORDER.indexOf(vehicle.status);
  const isOnActivationPath = currentIdx !== -1;

  // Determine blockers
  const docsApproved = vehicle.documents.filter((d) => d.verification_status === "APPROVED").length;
  const docsTotal = DOCUMENT_TYPES.length;
  const photosApproved = vehicle.photos.filter((p) => p.verification_status === "APPROVED").length;
  const photosTotal = PHOTO_TYPES.length;
  const allDocsOk = docsApproved >= docsTotal;
  const allPhotosOk = photosApproved >= photosTotal;
  const officerAssigned = !!vehicle.assigned_officer;

  // Derived flags
  const allVerified = allDocsOk && allPhotosOk;

  // What to show as blockers / next-step hints per status
  const blockers: { text: string; type: "blocker" | "hint" | "ready" }[] = [];
  if (vehicle.status === "PENDING") {
    if (!allDocsOk)
      blockers.push({ text: `${docsTotal - docsApproved} document(s) still need verification`, type: "blocker" });
    if (!allPhotosOk)
      blockers.push({ text: `${photosTotal - photosApproved} photo(s) still need verification`, type: "blocker" });
    if (allVerified)
      blockers.push({ text: "All documents & photos verified — move status to UNDER REVIEW, then APPROVED", type: "ready" });
    else if (allDocsOk && !allPhotosOk)
      blockers.push({ text: "Documents ✓ — upload & approve all vehicle photos", type: "hint" });
    else if (!allDocsOk && allPhotosOk)
      blockers.push({ text: "Photos ✓ — upload & approve all vehicle documents", type: "hint" });
  }
  if (vehicle.status === "UNDER_REVIEW") {
    if (!allDocsOk)
      blockers.push({ text: `${docsTotal - docsApproved} document(s) still need verification`, type: "blocker" });
    if (!allPhotosOk)
      blockers.push({ text: `${photosTotal - photosApproved} photo(s) still need verification`, type: "blocker" });
    if (allVerified)
      blockers.push({ text: "All verified ✓ — go to Actions tab and move status to APPROVED", type: "ready" });
  }
  if (vehicle.status === "APPROVED") {
    blockers.push({ text: "Ready to go live — move status to ACTIVE to enable bookings", type: "ready" });
  }

  return (
    <Box sx={{
      mx: 3, mt: 2, mb: 1,
      p: 2,
      borderRadius: 2,
      background: isOnActivationPath
        ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`
        : alpha(theme.palette.warning.main, 0.06),
      border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
    }}>
      {/* Title row */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Route fontSize="small" color="primary" />
        <Typography variant="caption" fontWeight={700} color="primary">
          ACTIVATION ROADMAP
        </Typography>
        {!isOnActivationPath && (
          <Chip
            label={vehicle.status}
            size="small"
            color="warning"
            sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
          />
        )}
      </Stack>

      {/* Steps */}
      {isOnActivationPath && (
        <Stack direction="row" alignItems="flex-start">
          {ACTIVATION_STEPS.map((step, i) => {
            const isDone = currentIdx > i;
            const isCurrent = currentIdx === i;
            const isFuture = currentIdx < i;
            return (
              <React.Fragment key={step.key}>
                <Stack alignItems="center" spacing={0.5} sx={{ minWidth: 80 }}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    bgcolor: isDone ? "success.main" : isCurrent ? step.color : alpha(theme.palette.divider, 0.4),
                    color: (isDone || isCurrent) ? "#fff" : "text.disabled",
                    boxShadow: isCurrent ? `0 0 0 4px ${alpha(step.color, 0.2)}` : "none",
                    transition: "all .25s",
                  }}>
                    {isDone ? <CheckCircle sx={{ fontSize: 18 }} /> : step.icon}
                  </Box>
                  <Typography variant="caption" fontWeight={isCurrent ? 700 : 400}
                    color={isDone ? "success.main" : isCurrent ? "primary" : "text.disabled"}
                    textAlign="center" noWrap sx={{ fontSize: 10 }}>
                    {step.label}
                  </Typography>
                  <Typography variant="caption" color="text.disabled"
                    textAlign="center" sx={{ fontSize: 9, lineHeight: 1.2, maxWidth: 72 }}>
                    {step.sub}
                  </Typography>
                </Stack>
                {i < ACTIVATION_STEPS.length - 1 && (
                  <Box sx={{
                    flex: 1, height: 2, mt: "17px", mx: 0.5,
                    bgcolor: isDone ? "success.main" : alpha(theme.palette.divider, 0.4),
                    transition: "background .3s",
                  }} />
                )}
              </React.Fragment>
            );
          })}
        </Stack>
      )}

      {/* Blockers / next-step hints */}
      {blockers.length > 0 && isOnActivationPath && vehicle.status !== "ACTIVE" && (
        <Box sx={{ mt: 1.5 }}>
          <Stack spacing={0.5}>
            {blockers.map((b, i) => {
              const isReady = b.type === "ready";
              const isHint = b.type === "hint";
              return (
                <Box key={i} sx={{
                  display: "flex", alignItems: "center", gap: 0.75,
                  px: 1, py: 0.5, borderRadius: 1,
                  bgcolor: isReady
                    ? alpha(theme.palette.success.main, 0.08)
                    : isHint
                      ? alpha(theme.palette.info.main, 0.07)
                      : alpha(theme.palette.warning.main, 0.07),
                  border: `1px solid ${isReady
                    ? alpha(theme.palette.success.main, 0.2)
                    : isHint
                      ? alpha(theme.palette.info.main, 0.15)
                      : alpha(theme.palette.warning.main, 0.2)}`,
                }}>
                  {isReady
                    ? <CheckCircleOutline sx={{ fontSize: 13, color: "success.main", flexShrink: 0 }} />
                    : isHint
                      ? <ArrowRight sx={{ fontSize: 13, color: "info.main", flexShrink: 0 }} />
                      : <ErrorOutline sx={{ fontSize: 13, color: "warning.main", flexShrink: 0 }} />}
                  <Typography variant="caption" fontWeight={isReady ? 700 : 500}
                    color={isReady ? "success.main" : isHint ? "info.main" : "warning.main"}>
                    {b.text}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}
      {vehicle.status === "ACTIVE" && (
        <Alert severity="success" icon={<CheckCircle fontSize="small" />} sx={{ mt: 1.5, py: 0.5, borderRadius: 1.5 }}>
          <Typography variant="caption" fontWeight={700}>Vehicle is ACTIVE and available for bookings!</Typography>
        </Alert>
      )}
    </Box>
  );
}

// ── CloudinaryFileUpload ─────────────────────────────────────
// Reusable Cloudinary file upload component used for vehicle docs & photos

interface CloudinaryFileUploadProps {
  accept: string;                      // e.g. "image/*" or ".pdf,image/*"
  assetType: "document" | "photo";
  label: string;                       // e.g. "Upload RC Document"
  hint?: string;                       // e.g. "PDF or image, max 20 MB"
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
}

function CloudinaryFileUpload({
  accept, assetType, label, hint, currentUrl, onUploaded,
}: CloudinaryFileUploadProps) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const folder = assetType === "document"
    ? "waytero/vehicles/documents"
    : "waytero/vehicles/photos";

  const handleFile = async (file: File) => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadMedia(file, assetType, {
        folderOverride: folder,
        onProgress: (pct) => setProgress(pct),
      });
      onUploaded(result.secure_url);
      enqueueSnackbar(`${label} uploaded successfully`, { variant: "success" });
    } catch (err: any) {
      enqueueSnackbar(
        err?.response?.data?.detail ?? `Upload failed — check Cloudinary settings`,
        { variant: "error" }
      );
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const isImage = assetType === "photo";

  return (
    <Box>
      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={onInputChange}
      />

      {/* Drop zone / upload area */}
      <Box
        onClick={() => !uploading && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        sx={{
          border: `2px dashed ${dragOver
            ? theme.palette.primary.main
            : currentUrl
              ? theme.palette.success.light
              : alpha(theme.palette.divider, 0.6)}`,
          borderRadius: 2,
          p: currentUrl && isImage ? 0 : 2,
          textAlign: "center",
          cursor: uploading ? "default" : "pointer",
          transition: "all .2s",
          overflow: "hidden",
          bgcolor: dragOver
            ? alpha(theme.palette.primary.main, 0.04)
            : currentUrl
              ? alpha(theme.palette.success.main, 0.03)
              : "transparent",
          "&:hover": uploading ? {} : {
            borderColor: "primary.main",
            bgcolor: alpha(theme.palette.primary.main, 0.04),
          },
          minHeight: currentUrl && isImage ? 120 : 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {uploading ? (
          <Stack alignItems="center" spacing={1} sx={{ width: "100%", px: 2 }}>
            <CircularProgress size={28} variant="determinate" value={progress} />
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Uploading to Cloudinary… {progress}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ width: "100%", height: 4, borderRadius: 2 }}
            />
          </Stack>
        ) : currentUrl && isImage ? (
          // Photo preview with overlay
          <Box sx={{ position: "relative", width: "100%", lineHeight: 0 }}>
            <Box
              component="img"
              src={currentUrl}
              alt="preview"
              sx={{ width: "100%", height: 120, objectFit: "cover" }}
              onError={(e: any) => { e.target.style.display = "none"; }}
            />
            <Box sx={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              bgcolor: "rgba(0,0,0,0)",
              transition: "background .2s",
              "&:hover": { bgcolor: "rgba(0,0,0,0.45)" },
            }}>
              <Stack alignItems="center" spacing={0.5}
                sx={{ opacity: 0, "&:hover": { opacity: 1 }, transition: "opacity .2s" }}>
                <CloudUpload sx={{ color: "#fff", fontSize: 28 }} />
                <Typography variant="caption" sx={{ color: "#fff", fontWeight: 700 }}>
                  Click to replace
                </Typography>
              </Stack>
            </Box>
          </Box>
        ) : currentUrl ? (
          // Non-image (PDF) — show link + replace button
          <Stack alignItems="center" spacing={1} sx={{ width: "100%" }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Description color="success" />
              <Typography variant="caption" color="success.main" fontWeight={700} noWrap>
                Document uploaded
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button
                size="small" variant="outlined" color="info"
                onClick={(e) => { e.stopPropagation(); window.open(currentUrl, "_blank"); }}
                startIcon={<Visibility fontSize="small" />}
                sx={{ fontSize: 11 }}
              >
                View
              </Button>
              <Button
                size="small" variant="outlined"
                startIcon={<CloudUpload fontSize="small" />}
                sx={{ fontSize: 11 }}
              >
                Replace
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Stack alignItems="center" spacing={0.75}>
            <CloudUpload sx={{ fontSize: 32, color: "text.disabled" }} />
            <Typography variant="caption" fontWeight={700} color="text.secondary">
              {label}
            </Typography>
            {hint && (
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
                {hint}
              </Typography>
            )}
            <Typography variant="caption" color="primary" sx={{ fontSize: 10, fontWeight: 600 }}>
              Click to browse or drag & drop
            </Typography>
          </Stack>
        )}
      </Box>
    </Box>
  );
}

// ── Vehicle Detail Drawer / Dialog ───────────────────────────

interface VehicleDetailDialogProps {
  vehicleId: number | null;
  onClose: () => void;
}

function VehicleDetailDialog({ vehicleId, onClose }: VehicleDetailDialogProps) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [statusForm, setStatusForm] = useState({ status: "", remarks: "" });
  const [officerForm, setOfficerForm] = useState({ officer_user_id: "" });
  const [docVerify, setDocVerify] = useState<{ id: number; status: string; remarks: string } | null>(null);
  const [photoVerify, setPhotoVerify] = useState<{ id: number; status: string; remarks: string } | null>(null);
  const [docUploadForm, setDocUploadForm] = useState({ document_type: "", file_url: "", expiry_date: "" });
  const [photoUploadForm, setPhotoUploadForm] = useState({ photo_type: "", file_url: "", caption: "" });
  // Cloudinary upload state — tracks uploaded URL before submitting to backend
  const [docUploadedUrl, setDocUploadedUrl] = useState<string>("");
  const [photoUploadedUrl, setPhotoUploadedUrl] = useState<string>("");
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);

  const { data: vehicle, isLoading } = useQuery<VehicleDetail>({
    queryKey: ["vehicle-detail", vehicleId],
    queryFn: () => vehicleService.getVehicleDetail(vehicleId!),
    enabled: !!vehicleId,
    staleTime: 30 * 1000,
  });

  const { data: officers = [] } = useQuery<VerificationOfficer[]>({
    queryKey: ["verification-officers"],
    queryFn: () =>
      apiClient.get("/admin/vehicles/verification-officers").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["vehicle-detail", vehicleId] });
    queryClient.invalidateQueries({ queryKey: ["admin-vehicles"] });
  };

  const statusMutation = useMutation({
    mutationFn: () =>
      vehicleService.changeStatus(vehicleId!, statusForm.status, statusForm.remarks || undefined),
    onSuccess: () => {
      enqueueSnackbar(`Status changed to ${statusForm.status}`, { variant: "success" });
      setStatusForm({ status: "", remarks: "" });
      invalidate();
    },
    onError: (err: any) =>
      enqueueSnackbar(err?.response?.data?.detail ?? "Status change failed", { variant: "error" }),
  });

  const officerMutation = useMutation({
    mutationFn: () =>
      vehicleService.assignOfficer(vehicleId!, officerForm.officer_user_id),
    onSuccess: () => {
      enqueueSnackbar("Verification officer assigned", { variant: "success" });
      setOfficerForm({ officer_user_id: "" });
      invalidate();
    },
    onError: (err: any) =>
      enqueueSnackbar(err?.response?.data?.detail ?? "Assignment failed", { variant: "error" }),
  });

  const verifyDocMutation = useMutation({
    mutationFn: () =>
      vehicleService.verifyDocument(vehicleId!, docVerify!.id, {
        verification_status: docVerify!.status,
        remarks: docVerify!.remarks || undefined,
      }),
    onSuccess: () => {
      enqueueSnackbar("Document status updated", { variant: "success" });
      setDocVerify(null);
      invalidate();
    },
    onError: (err: any) =>
      enqueueSnackbar(err?.response?.data?.detail ?? "Failed", { variant: "error" }),
  });

  const verifyPhotoMutation = useMutation({
    mutationFn: () =>
      vehicleService.verifyPhoto(vehicleId!, photoVerify!.id, {
        verification_status: photoVerify!.status,
        remarks: photoVerify!.remarks || undefined,
      }),
    onSuccess: () => {
      enqueueSnackbar("Photo status updated", { variant: "success" });
      setPhotoVerify(null);
      invalidate();
    },
    onError: (err: any) =>
      enqueueSnackbar(err?.response?.data?.detail ?? "Failed", { variant: "error" }),
  });

  const uploadDocMutation = useMutation({
    mutationFn: () =>
      vehicleService.uploadDocument(vehicleId!, {
        document_type: docUploadForm.document_type,
        file_url: docUploadForm.file_url,
        expiry_date: docUploadForm.expiry_date || undefined,
      }),
    onSuccess: () => {
      enqueueSnackbar("Document added", { variant: "success" });
      setDocUploadForm({ document_type: "", file_url: "", expiry_date: "" });
      setDocUploadedUrl("");
      setShowDocUpload(false);
      invalidate();
    },
    onError: (err: any) =>
      enqueueSnackbar(err?.response?.data?.detail ?? "Failed", { variant: "error" }),
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: () =>
      vehicleService.uploadPhoto(vehicleId!, {
        photo_type: photoUploadForm.photo_type,
        file_url: photoUploadForm.file_url,
        caption: photoUploadForm.caption || undefined,
      }),
    onSuccess: () => {
      enqueueSnackbar("Photo added", { variant: "success" });
      setPhotoUploadForm({ photo_type: "", file_url: "", caption: "" });
      setPhotoUploadedUrl("");
      setShowPhotoUpload(false);
      invalidate();
    },
    onError: (err: any) =>
      enqueueSnackbar(err?.response?.data?.detail ?? "Failed", { variant: "error" }),
  });

  const allowedTransitions = vehicle ? V_TRANSITIONS[vehicle.status] ?? [] : [];

  return (
    <Dialog open={!!vehicleId} onClose={onClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { borderRadius: 3, height: "90vh" } }}>

      {/* Header */}
      <DialogTitle sx={{ pb: 0, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)` }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{ bgcolor: "primary.main", width: 44, height: 44 }}>
            <DirectionsCar />
          </Avatar>
          <Box flex={1}>
            {isLoading ? <Skeleton width={240} /> : (
              <>
                <Typography variant="h6" fontWeight={700}>
                  {vehicle?.registration_number}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    {vehicle?.vehicle_brand} {vehicle?.vehicle_model}
                    {vehicle?.manufacturing_year ? ` (${vehicle.manufacturing_year})` : ""}
                  </Typography>
                  {vehicle && <StatusChip status={vehicle.status} />}
                </Stack>
              </>
            )}
          </Box>
          <IconButton onClick={onClose}><Close /></IconButton>
        </Stack>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mt: 1 }}>
          <Tab label="Overview" />
          <Tab label="Documents" />
          <Tab label="Photos" />
          <Tab label="Pricing" />
          <Tab label="Actions" />
        </Tabs>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {isLoading ? (
          <Box sx={{ p: 3 }}>
            {[...Array(5)].map((_, i) => <Skeleton key={i} height={40} sx={{ mb: 1 }} />)}
          </Box>
        ) : vehicle ? (
          <>
            {/* ── Activation Roadmap Banner (always visible) ──── */}
            <ActivationRoadmap vehicle={vehicle} />

            {/* ── Tab 0: Overview ─────────────────────────────── */}
            {tab === 0 && (
              <Box sx={{ p: 3 }}>
                <Grid container spacing={3}>

                  {/* Vehicle info */}
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined" sx={{ borderRadius: 2 }}>
                      <CardContent>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }} color="primary">
                          Vehicle Details
                        </Typography>
                        <Stack spacing={1.5}>
                          {[
                            ["Vehicle Code", vehicle.vehicle_code ?? "—"],
                            ["Registration", vehicle.registration_number],
                            ["Category", vehicle.vehicle_category ?? "—"],
                            ["Brand / Model", `${vehicle.vehicle_brand ?? "—"} ${vehicle.vehicle_model ?? ""}`],
                            ["Year", vehicle.manufacturing_year ?? "—"],
                            ["Fuel Type", vehicle.fuel_type ?? "—"],
                            ["Seating", vehicle.seating_capacity ? `${vehicle.seating_capacity} seats` : "—"],
                            ["Status", <StatusChip key="s" status={vehicle.status} />],
                          ].map(([label, value]) => (
                            <Stack key={String(label)} direction="row" justifyContent="space-between">
                              <Typography variant="caption" color="text.secondary">{label}</Typography>
                              <Typography variant="caption" fontWeight={600}>{value as any}</Typography>
                            </Stack>
                          ))}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Partner info */}
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined" sx={{ borderRadius: 2 }}>
                      <CardContent>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }} color="primary">
                          Partner
                        </Typography>
                        <Stack spacing={1.5}>
                          {[
                            ["Owner", vehicle.partner?.owner_name ?? "—"],
                            ["Business", vehicle.partner?.business_name ?? "—"],
                            ["Mobile", vehicle.partner?.mobile ?? "—"],
                            ["Partner ID", vehicle.partner?.id ? `#${vehicle.partner.id}` : "—"],
                          ].map(([label, value]) => (
                            <Stack key={String(label)} direction="row" justifyContent="space-between">
                              <Typography variant="caption" color="text.secondary">{label}</Typography>
                              <Typography variant="caption" fontWeight={600}>{value as any}</Typography>
                            </Stack>
                          ))}
                        </Stack>

                        {vehicle.commission_group && (
                          <Box sx={{ mt: 2, p: 1, bgcolor: alpha(theme.palette.info.main, 0.08), borderRadius: 1.5 }}>
                            <Typography variant="caption" fontWeight={700} color="info.main">
                              Commission Group: {vehicle.commission_group.group_name}
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>

                    {/* Assigned officer */}
                    <Card variant="outlined" sx={{ borderRadius: 2, mt: 2 }}>
                      <CardContent>
                        <Typography variant="subtitle2" fontWeight={700} color="primary" sx={{ mb: 1 }}>
                          Assigned Verification Officer
                        </Typography>
                        {vehicle.assigned_officer ? (
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar sx={{ width: 32, height: 32, bgcolor: "success.main" }}>
                              <AssignmentInd fontSize="small" />
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight={600}>
                                {vehicle.assigned_officer.full_name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {vehicle.assigned_officer.mobile}
                              </Typography>
                            </Box>
                          </Stack>
                        ) : (
                          <Alert severity="warning" sx={{ py: 0.5 }}>
                            <Typography variant="caption">No officer assigned. Admin will verify directly.</Typography>
                          </Alert>
                        )}

                        {vehicle.verification_remarks && (
                          <Box sx={{ mt: 1.5, p: 1, bgcolor: alpha(theme.palette.warning.main, 0.08), borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary">Remarks:</Typography>
                            <Typography variant="caption" sx={{ display: "block" }}>
                              {vehicle.verification_remarks}
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Verification progress */}
                  <Grid item xs={12}>
                    <Card variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
                      <VerificationProgress documents={vehicle.documents} photos={vehicle.photos} />
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* ── Tab 1: Documents ─────────────────────────────── */}
            {tab === 1 && (
              <Box sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Vehicle Documents ({vehicle.documents.length})
                  </Typography>
                  <Button
                    size="small" startIcon={<Add />} variant="outlined"
                    onClick={() => setShowDocUpload((v) => !v)}
                  >
                    Add Document
                  </Button>
                </Stack>

                {/* Add document form */}
                <Collapse in={showDocUpload}>
                  <Paper variant="outlined" sx={{ p: 2.5, mb: 2, borderRadius: 2, border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.2)}` }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                      <Description color="primary" fontSize="small" />
                      <Typography variant="subtitle2" fontWeight={700} color="primary">
                        Add Vehicle Document
                      </Typography>
                    </Stack>
                    <Grid container spacing={2} alignItems="flex-start">
                      {/* Type */}
                      <Grid item xs={12} sm={4}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Document Type *</InputLabel>
                          <Select
                            label="Document Type *"
                            value={docUploadForm.document_type}
                            onChange={(e) => {
                              setDocUploadForm((f) => ({ ...f, document_type: e.target.value, file_url: "" }));
                              setDocUploadedUrl("");
                            }}
                          >
                            {DOCUMENT_TYPES.map((t) => (
                              <MenuItem key={t} value={t}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  {DOC_ICON[t] ?? <Description fontSize="small" />}
                                  <Typography variant="body2">{t.replace(/_/g, " ")}</Typography>
                                </Stack>
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        {/* Expiry date — below type */}
                        <TextField
                          fullWidth size="small" label="Expiry Date (if applicable)"
                          type="date" InputLabelProps={{ shrink: true }}
                          value={docUploadForm.expiry_date}
                          onChange={(e) => setDocUploadForm((f) => ({ ...f, expiry_date: e.target.value }))}
                          sx={{ mt: 1.5 }}
                        />
                      </Grid>

                      {/* Cloudinary Upload */}
                      <Grid item xs={12} sm={8}>
                        {!docUploadForm.document_type ? (
                          <Box sx={{
                            border: (theme) => `2px dashed ${alpha(theme.palette.divider, 0.4)}`,
                            borderRadius: 2, p: 3, textAlign: "center",
                          }}>
                            <Typography variant="caption" color="text.disabled">
                              Select a document type first
                            </Typography>
                          </Box>
                        ) : (
                          <CloudinaryFileUpload
                            accept=".pdf,image/jpeg,image/png,image/webp"
                            assetType="document"
                            label={`Upload ${docUploadForm.document_type.replace(/_/g, " ")}`}
                            hint="PDF or image (JPG, PNG) · max 20 MB"
                            currentUrl={docUploadedUrl || null}
                            onUploaded={(url) => {
                              setDocUploadedUrl(url);
                              setDocUploadForm((f) => ({ ...f, file_url: url }));
                            }}
                          />
                        )}
                        {docUploadedUrl && (
                          <Alert severity="success" icon={<CheckCircle fontSize="small" />}
                            sx={{ mt: 1, py: 0.5, borderRadius: 1.5 }}>
                            <Typography variant="caption" fontWeight={600}>
                              File uploaded to Cloudinary — ready to save
                            </Typography>
                          </Alert>
                        )}
                      </Grid>

                      {/* Actions */}
                      <Grid item xs={12}>
                        <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                          <Button size="small" color="inherit"
                            onClick={() => {
                              setShowDocUpload(false);
                              setDocUploadForm({ document_type: "", file_url: "", expiry_date: "" });
                              setDocUploadedUrl("");
                            }}>
                            Cancel
                          </Button>
                          <Button
                            size="small" variant="contained"
                            disabled={!docUploadForm.document_type || !docUploadedUrl || uploadDocMutation.isPending}
                            onClick={() => uploadDocMutation.mutate()}
                            startIcon={uploadDocMutation.isPending ? <CircularProgress size={14} /> : <TaskAlt />}
                            sx={{ borderRadius: 2, fontWeight: 700 }}
                          >
                            {uploadDocMutation.isPending ? "Saving…" : "Save Document"}
                          </Button>
                        </Stack>
                      </Grid>
                    </Grid>
                  </Paper>
                </Collapse>

                {/* Document checklist */}
                <Grid container spacing={2}>
                  {DOCUMENT_TYPES.map((dtype) => {
                    const doc = vehicle.documents.find((d) => d.document_type === dtype);
                    return (
                      <Grid item xs={12} sm={6} key={dtype}>
                        <Paper variant="outlined" sx={{
                          p: 2, borderRadius: 2,
                          borderColor: doc
                            ? doc.verification_status === "APPROVED"
                              ? "success.main"
                              : doc.verification_status === "REJECTED"
                                ? "error.main"
                                : "warning.main"
                            : alpha(theme.palette.divider, 0.5),
                        }}>
                          <Stack direction="row" spacing={1.5} alignItems="flex-start">
                            <Avatar sx={{
                              width: 36, height: 36,
                              bgcolor: doc
                                ? doc.verification_status === "APPROVED"
                                  ? alpha(theme.palette.success.main, 0.15)
                                  : alpha(theme.palette.warning.main, 0.15)
                                : alpha(theme.palette.divider, 0.3),
                              color: doc
                                ? doc.verification_status === "APPROVED" ? "success.main" : "warning.main"
                                : "text.disabled",
                            }}>
                              {DOC_ICON[dtype] ?? <Description fontSize="small" />}
                            </Avatar>
                            <Box flex={1}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="caption" fontWeight={700}>
                                  {dtype.replace(/_/g, " ")}
                                </Typography>
                                {doc ? (
                                  <VerifyChip status={doc.verification_status} />
                                ) : (
                                  <Chip label="Missing" size="small" color="default"
                                    sx={{ height: 18, fontSize: 10 }} />
                                )}
                              </Stack>
                              {doc ? (
                                <>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                    Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}
                                    {doc.expiry_date ? ` · Expires: ${doc.expiry_date}` : ""}
                                  </Typography>
                                  {doc.remarks && (
                                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
                                      {doc.remarks}
                                    </Typography>
                                  )}
                                  <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                                    <Tooltip title="View document">
                                      <IconButton size="small" href={doc.file_url ?? "#"} target="_blank">
                                        <Visibility fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Approve">
                                      <IconButton size="small" color="success"
                                        onClick={() => setDocVerify({ id: doc.id, status: "APPROVED", remarks: "" })}>
                                        <CheckCircleOutline fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Reject">
                                      <IconButton size="small" color="error"
                                        onClick={() => setDocVerify({ id: doc.id, status: "REJECTED", remarks: "" })}>
                                        <HighlightOff fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </Stack>
                                </>
                              ) : (
                                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                                  <Typography variant="caption" color="text.disabled">
                                    Not uploaded yet
                                  </Typography>
                                  <Button
                                    size="small" variant="outlined" color="primary"
                                    startIcon={<CloudUpload sx={{ fontSize: 14 }} />}
                                    sx={{ fontSize: 10, py: 0.3, borderRadius: 1.5, alignSelf: "flex-start" }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDocUploadForm({ document_type: dtype, file_url: "", expiry_date: "" });
                                      setDocUploadedUrl("");
                                      setShowDocUpload(true);
                                    }}
                                  >
                                    Upload
                                  </Button>
                                </Stack>
                              )}
                            </Box>
                          </Stack>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            )}

            {/* ── Tab 2: Photos ─────────────────────────────────── */}
            {tab === 2 && (
              <Box sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Vehicle Photos ({vehicle.photos.length})
                  </Typography>
                  <Button size="small" startIcon={<CloudUpload />} variant="outlined"
                    onClick={() => setShowPhotoUpload((v) => !v)}>
                    Add Photo
                  </Button>
                </Stack>

                <Collapse in={showPhotoUpload}>
                  <Paper variant="outlined" sx={{ p: 2.5, mb: 2, borderRadius: 2, border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.2)}` }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                      <ImageIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle2" fontWeight={700} color="primary">
                        Add Vehicle Photo
                      </Typography>
                    </Stack>
                    <Grid container spacing={2} alignItems="flex-start">
                      {/* Type + caption */}
                      <Grid item xs={12} sm={4}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Photo Type *</InputLabel>
                          <Select
                            label="Photo Type *"
                            value={photoUploadForm.photo_type}
                            onChange={(e) => {
                              setPhotoUploadForm((f) => ({ ...f, photo_type: e.target.value, file_url: "" }));
                              setPhotoUploadedUrl("");
                            }}
                          >
                            {PHOTO_TYPES.map((t) => (
                              <MenuItem key={t} value={t}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  {PHOTO_TYPE_META[t]?.icon}
                                  <Typography variant="body2">{PHOTO_TYPE_META[t]?.label ?? t}</Typography>
                                </Stack>
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField fullWidth size="small" label="Caption (optional)"
                          value={photoUploadForm.caption}
                          onChange={(e) => setPhotoUploadForm((f) => ({ ...f, caption: e.target.value }))}
                          sx={{ mt: 1.5 }}
                        />
                      </Grid>

                      {/* Cloudinary Upload */}
                      <Grid item xs={12} sm={8}>
                        {!photoUploadForm.photo_type ? (
                          <Box sx={{
                            border: (theme) => `2px dashed ${alpha(theme.palette.divider, 0.4)}`,
                            borderRadius: 2, p: 3, textAlign: "center",
                          }}>
                            <Typography variant="caption" color="text.disabled">
                              Select a photo type first
                            </Typography>
                          </Box>
                        ) : (
                          <CloudinaryFileUpload
                            accept="image/jpeg,image/png,image/webp,image/heic"
                            assetType="photo"
                            label={`Upload ${PHOTO_TYPE_META[photoUploadForm.photo_type]?.label ?? photoUploadForm.photo_type}`}
                            hint="JPG, PNG, WebP · max 20 MB · Best: high resolution"
                            currentUrl={photoUploadedUrl || null}
                            onUploaded={(url) => {
                              setPhotoUploadedUrl(url);
                              setPhotoUploadForm((f) => ({ ...f, file_url: url }));
                            }}
                          />
                        )}
                        {photoUploadedUrl && (
                          <Alert severity="success" icon={<CheckCircle fontSize="small" />}
                            sx={{ mt: 1, py: 0.5, borderRadius: 1.5 }}>
                            <Typography variant="caption" fontWeight={600}>
                              Photo uploaded to Cloudinary — ready to save
                            </Typography>
                          </Alert>
                        )}
                      </Grid>

                      {/* Actions */}
                      <Grid item xs={12}>
                        <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                          <Button size="small" color="inherit"
                            onClick={() => {
                              setShowPhotoUpload(false);
                              setPhotoUploadForm({ photo_type: "", file_url: "", caption: "" });
                              setPhotoUploadedUrl("");
                            }}>
                            Cancel
                          </Button>
                          <Button
                            size="small" variant="contained"
                            disabled={!photoUploadForm.photo_type || !photoUploadedUrl || uploadPhotoMutation.isPending}
                            onClick={() => uploadPhotoMutation.mutate()}
                            startIcon={uploadPhotoMutation.isPending ? <CircularProgress size={14} /> : <ImageIcon />}
                            sx={{ borderRadius: 2, fontWeight: 700 }}
                          >
                            {uploadPhotoMutation.isPending ? "Saving…" : "Save Photo"}
                          </Button>
                        </Stack>
                      </Grid>
                    </Grid>
                  </Paper>
                </Collapse>

                {/* Photo grid — 8 required categories */}
                <Grid container spacing={2}>
                  {PHOTO_TYPES.map((ptype) => {
                    const photo = vehicle.photos.find((p) => p.photo_type === ptype);
                    const meta = PHOTO_TYPE_META[ptype];
                    return (
                      <Grid item xs={6} sm={3} key={ptype}>
                        <Paper variant="outlined" sx={{
                          borderRadius: 2, overflow: "hidden",
                          borderColor: photo
                            ? photo.verification_status === "APPROVED" ? "success.main" : "warning.main"
                            : alpha(theme.palette.divider, 0.5),
                        }}>
                          {/* Photo preview */}
                          <Box
                            sx={{
                              height: 100,
                              bgcolor: photo ? alpha(theme.palette.primary.main, 0.05) : alpha(theme.palette.divider, 0.1),
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              position: "relative",
                              cursor: "pointer",
                            }}
                            onClick={() => {
                              if (photo) {
                                window.open(photo.file_url, "_blank");
                              } else {
                                // Quick-add: pre-select this photo type and open the upload panel
                                setPhotoUploadForm({ photo_type: ptype, file_url: "", caption: "" });
                                setPhotoUploadedUrl("");
                                setShowPhotoUpload(true);
                              }
                            }}
                          >
                            {photo ? (
                              <Box
                                component="img"
                                src={photo.file_url}
                                alt={ptype}
                                sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                                onError={(e: any) => { e.target.style.display = "none"; }}
                              />
                            ) : (
                              <Stack alignItems="center" spacing={0.5}>
                                <CloudUpload sx={{ fontSize: 24, color: alpha("#1976d2", 0.4) }} />
                                <Typography variant="caption" color="text.disabled" fontSize={9}>
                                  Click to upload
                                </Typography>
                              </Stack>
                            )}
                            {photo && (
                              <Box sx={{ position: "absolute", top: 4, right: 4 }}>
                                <VerifyChip status={photo.verification_status} />
                              </Box>
                            )}
                          </Box>

                          <Box sx={{ p: 1 }}>
                            <Typography variant="caption" fontWeight={700} display="block">
                              {meta?.label ?? ptype}
                            </Typography>
                            {photo && (
                              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                                <Tooltip title="Approve">
                                  <IconButton size="small" color="success" sx={{ p: 0.3 }}
                                    onClick={() => setPhotoVerify({ id: photo.id, status: "APPROVED", remarks: "" })}>
                                    <CheckCircleOutline sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Reject">
                                  <IconButton size="small" color="error" sx={{ p: 0.3 }}
                                    onClick={() => setPhotoVerify({ id: photo.id, status: "REJECTED", remarks: "" })}>
                                    <HighlightOff sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            )}
                          </Box>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            )}

            {/* ── Tab 3: Pricing ─────────────────────────────────── */}
            {tab === 3 && (
              <Box sx={{ p: 3 }}>
                <PricingBlock pricing={vehicle.pricing_structure} />
                {vehicle.commission_group && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="caption" fontWeight={700}>
                      Commission Group: {vehicle.commission_group.group_name}
                    </Typography>
                    {vehicle.commission_group.description && (
                      <Typography variant="caption" sx={{ ml: 1 }}>
                        — {vehicle.commission_group.description}
                      </Typography>
                    )}
                  </Alert>
                )}
                {!vehicle.commission_group && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    <Typography variant="caption">
                      No commission group assigned to partner. Default platform pricing applies.
                    </Typography>
                  </Alert>
                )}
              </Box>
            )}

            {/* ── Tab 4: Actions ─────────────────────────────────── */}
            {tab === 4 && (
              <Box sx={{ p: 3 }}>
                <Grid container spacing={3}>

                  {/* ── Activation Quick Guide ──────────────────── */}
                  <Grid item xs={12}>
                    <Card variant="outlined" sx={{
                      borderRadius: 2,
                      background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.04)} 0%, transparent 100%)`,
                      borderColor: (theme) => alpha(theme.palette.primary.main, 0.2),
                    }}>
                      <CardContent sx={{ pb: "12px !important" }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                          <Route fontSize="small" color="primary" />
                          <Typography variant="subtitle2" fontWeight={700} color="primary">
                            Activation Guide — Current: <StatusChip status={vehicle.status} />
                          </Typography>
                        </Stack>
                        <Stack spacing={0.75}>
                          {[
                            {
                              step: "1",
                              title: "PENDING → UNDER_REVIEW",
                              desc: "Assign a verification officer OR start reviewing directly. Move status to UNDER_REVIEW.",
                              done: ["UNDER_REVIEW","APPROVED","ACTIVE"].includes(vehicle.status),
                              active: vehicle.status === "PENDING",
                            },
                            {
                              step: "2",
                              title: "Upload & Verify Documents",
                              desc: "Go to Documents tab → upload RC, Insurance, Fitness Certificate, Permit, PUC → Approve each.",
                              done: vehicle.documents.filter(d => d.verification_status === "APPROVED").length >= DOCUMENT_TYPES.length,
                              active: ["PENDING","UNDER_REVIEW"].includes(vehicle.status),
                            },
                            {
                              step: "3",
                              title: "Upload & Verify Photos",
                              desc: "Go to Photos tab → upload all 8 angles (Front, Back, Left, Right, Interior, Odometer, Engine, Other) → Approve each.",
                              done: vehicle.photos.filter(p => p.verification_status === "APPROVED").length >= PHOTO_TYPES.length,
                              active: ["PENDING","UNDER_REVIEW"].includes(vehicle.status),
                            },
                            {
                              step: "4",
                              title: "UNDER_REVIEW → APPROVED",
                              desc: "After all docs & photos are verified, move status to APPROVED.",
                              done: ["APPROVED","ACTIVE"].includes(vehicle.status),
                              active: vehicle.status === "UNDER_REVIEW",
                            },
                            {
                              step: "5",
                              title: "APPROVED → ACTIVE",
                              desc: "Final step: activate the vehicle. It will appear in the booking engine and partners can accept rides.",
                              done: vehicle.status === "ACTIVE",
                              active: vehicle.status === "APPROVED",
                            },
                          ].map((item) => (
                            <Stack key={item.step} direction="row" spacing={1.5} alignItems="flex-start" sx={{
                              p: 1, borderRadius: 1.5,
                              bgcolor: item.active
                                ? (theme) => alpha(theme.palette.warning.main, 0.06)
                                : "transparent",
                              border: item.active
                                ? (theme) => `1px solid ${alpha(theme.palette.warning.main, 0.2)}`
                                : "1px solid transparent",
                            }}>
                              <Box sx={{
                                width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                bgcolor: item.done ? "success.main" : item.active ? "warning.main" : (theme) => alpha(theme.palette.divider, 0.5),
                                color: (item.done || item.active) ? "#fff" : "text.disabled",
                                fontSize: 11, fontWeight: 700,
                              }}>
                                {item.done ? <CheckCircle sx={{ fontSize: 14 }} /> : item.step}
                              </Box>
                              <Box>
                                <Typography variant="caption" fontWeight={700}
                                  color={item.done ? "success.main" : item.active ? "warning.main" : "text.secondary"}>
                                  {item.title}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: 11 }}>
                                  {item.desc}
                                </Typography>
                              </Box>
                            </Stack>
                          ))}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* ── Quick Action Buttons (Approve / Activate) ─── */}
                  {(vehicle.status === "UNDER_REVIEW" || vehicle.status === "APPROVED") && (() => {
                    const docsOk = vehicle.documents.filter(d => d.verification_status === "APPROVED").length >= DOCUMENT_TYPES.length;
                    const photosOk = vehicle.photos.filter(p => p.verification_status === "APPROVED").length >= PHOTO_TYPES.length;
                    const allOk = docsOk && photosOk;
                    return (
                      <Grid item xs={12}>
                        <Card variant="outlined" sx={{
                          borderRadius: 2,
                          background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.05)} 0%, transparent 100%)`,
                          borderColor: (theme) => alpha(theme.palette.success.main, 0.3),
                        }}>
                          <CardContent sx={{ pb: "12px !important" }}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                              <TaskAlt color="success" fontSize="small" />
                              <Typography variant="subtitle2" fontWeight={700} color="success.main">
                                {vehicle.status === "UNDER_REVIEW" ? "Approve Vehicle" : "Activate Vehicle"}
                              </Typography>
                            </Stack>

                            {vehicle.status === "UNDER_REVIEW" && (
                              <>
                                {!allOk ? (
                                  <Alert severity="warning" sx={{ mb: 1.5, py: 0.5, borderRadius: 1.5 }}>
                                    <Typography variant="caption">
                                      {!docsOk && `${DOCUMENT_TYPES.length - vehicle.documents.filter(d => d.verification_status === "APPROVED").length} document(s) pending. `}
                                      {!photosOk && `${PHOTO_TYPES.length - vehicle.photos.filter(p => p.verification_status === "APPROVED").length} photo(s) pending.`}
                                      {" "}Verify all before approving.
                                    </Typography>
                                  </Alert>
                                ) : (
                                  <Alert severity="success" sx={{ mb: 1.5, py: 0.5, borderRadius: 1.5 }}>
                                    <Typography variant="caption" fontWeight={600}>
                                      All {DOCUMENT_TYPES.length} documents and {PHOTO_TYPES.length} photos verified ✓ — ready to approve!
                                    </Typography>
                                  </Alert>
                                )}
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                  <TextField
                                    size="small" label="Approval remarks (optional)" fullWidth
                                    value={statusForm.status === "APPROVED" ? statusForm.remarks : ""}
                                    onChange={(e) => setStatusForm({ status: "APPROVED", remarks: e.target.value })}
                                    sx={{ flex: 1 }}
                                  />
                                  <Button
                                    variant="contained" color="success" size="large"
                                    disabled={statusMutation.isPending}
                                    onClick={() => { setStatusForm((f) => ({ ...f, status: "APPROVED" })); statusMutation.mutate(); }}
                                    startIcon={statusMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <TaskAlt />}
                                    sx={{ borderRadius: 2, fontWeight: 700, minWidth: 140, whiteSpace: "nowrap" }}
                                  >
                                    {statusMutation.isPending ? "Approving…" : "Approve Vehicle"}
                                  </Button>
                                </Stack>
                              </>
                            )}

                            {vehicle.status === "APPROVED" && (
                              <>
                                <Alert severity="info" sx={{ mb: 1.5, py: 0.5, borderRadius: 1.5 }}>
                                  <Typography variant="caption" fontWeight={600}>
                                    Vehicle is approved. Activate it to make it available for bookings.
                                  </Typography>
                                </Alert>
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                  <TextField
                                    size="small" label="Activation remarks (optional)" fullWidth
                                    value={statusForm.status === "ACTIVE" ? statusForm.remarks : ""}
                                    onChange={(e) => setStatusForm({ status: "ACTIVE", remarks: e.target.value })}
                                    sx={{ flex: 1 }}
                                  />
                                  <Button
                                    variant="contained" color="success" size="large"
                                    disabled={statusMutation.isPending}
                                    onClick={() => { setStatusForm((f) => ({ ...f, status: "ACTIVE" })); statusMutation.mutate(); }}
                                    startIcon={statusMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <CheckCircle />}
                                    sx={{ borderRadius: 2, fontWeight: 700, minWidth: 160, whiteSpace: "nowrap" }}
                                  >
                                    {statusMutation.isPending ? "Activating…" : "Activate Vehicle"}
                                  </Button>
                                </Stack>
                              </>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })()}

                  {/* Status change */}
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined" sx={{ borderRadius: 2 }}>
                      <CardContent>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                          <Typography variant="subtitle2" fontWeight={700} color="primary">
                            Change Status
                          </Typography>
                          <Chip
                            label={vehicle.status}
                            size="small"
                            color={(VEHICLE_STATUS_META[vehicle.status]?.color as any) ?? "default"}
                            sx={{ fontWeight: 700, fontSize: 10 }}
                          />
                        </Stack>
                        <Stack spacing={2}>
                          {allowedTransitions.length > 0 ? (
                            <>
                              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                                {allowedTransitions.map((s) => {
                                  const meta = VEHICLE_STATUS_META[s];
                                  const isForward = ["UNDER_REVIEW","APPROVED","ACTIVE"].includes(s);
                                  return (
                                    <Chip
                                      key={s}
                                      label={`→ ${meta?.label ?? s}`}
                                      onClick={() => setStatusForm((f) => ({ ...f, status: s }))}
                                      color={statusForm.status === s ? (meta?.color ?? "default") : isForward ? "primary" : "default"}
                                      variant={statusForm.status === s ? "filled" : "outlined"}
                                      size="small"
                                      sx={{ fontWeight: 700, cursor: "pointer" }}
                                    />
                                  );
                                })}
                              </Stack>
                              <TextField
                                size="small" label="Remarks (optional)" multiline rows={2}
                                value={statusForm.remarks}
                                onChange={(e) => setStatusForm((f) => ({ ...f, remarks: e.target.value }))}
                                disabled={!statusForm.status}
                              />
                              <Button
                                variant="contained"
                                disabled={!statusForm.status || statusMutation.isPending}
                                onClick={() => statusMutation.mutate()}
                                startIcon={statusMutation.isPending ? <CircularProgress size={14} /> : <TaskAlt />}
                                sx={{ borderRadius: 2, fontWeight: 700 }}
                              >
                                {statusMutation.isPending
                                  ? "Applying…"
                                  : statusForm.status
                                    ? `Move to ${VEHICLE_STATUS_META[statusForm.status]?.label ?? statusForm.status}`
                                    : "Select a status above"}
                              </Button>
                            </>
                          ) : (
                            <Alert severity="info" sx={{ py: 0.5 }}>
                              <Typography variant="caption">No transitions available from <strong>{vehicle.status}</strong>.</Typography>
                            </Alert>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Assign officer */}
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined" sx={{ borderRadius: 2 }}>
                      <CardContent>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                          <AssignmentInd color="primary" fontSize="small" />
                          <Typography variant="subtitle2" fontWeight={700} color="primary">
                            Verification Officer
                          </Typography>
                          <Chip label="Optional" size="small" variant="outlined" sx={{ height: 18, fontSize: 9 }} />
                        </Stack>
                        <Stack spacing={1.5}>
                          {vehicle.assigned_officer ? (
                            <Stack direction="row" spacing={1.5} alignItems="center" sx={{
                              p: 1.5, borderRadius: 1.5,
                              bgcolor: (theme) => alpha(theme.palette.success.main, 0.06),
                              border: (theme) => `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                            }}>
                              <Avatar sx={{ width: 34, height: 34, bgcolor: "success.main" }}>
                                <AssignmentInd sx={{ fontSize: 16 }} />
                              </Avatar>
                              <Box flex={1} minWidth={0}>
                                <Typography variant="body2" fontWeight={700} noWrap>
                                  {vehicle.assigned_officer.full_name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {vehicle.assigned_officer.mobile}
                                </Typography>
                              </Box>
                              <Chip label="Assigned" size="small" color="success" sx={{ fontWeight: 700 }} />
                            </Stack>
                          ) : (
                            <Alert severity="info" icon={false} sx={{ py: 0.5, borderRadius: 1.5, fontSize: 11 }}>
                              <Typography variant="caption">
                                Officer assignment is optional — admin can approve directly using the status panel or quick-action button above.
                              </Typography>
                            </Alert>
                          )}
                          <Stack direction="row" spacing={1}>
                            <FormControl fullWidth size="small">
                              <InputLabel>
                                {vehicle.assigned_officer ? "Re-assign Officer" : "Assign Officer"}
                              </InputLabel>
                              <Select
                                label={vehicle.assigned_officer ? "Re-assign Officer" : "Assign Officer"}
                                value={officerForm.officer_user_id}
                                onChange={(e) => setOfficerForm({ officer_user_id: e.target.value })}
                              >
                                {officers.map((o) => (
                                  <MenuItem key={o.id} value={o.id}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <Avatar sx={{ width: 26, height: 26, bgcolor: "primary.main", fontSize: 11, fontWeight: 700 }}>
                                        {(o.full_name ?? "?").charAt(0)}
                                      </Avatar>
                                      <Box>
                                        <Typography variant="body2" fontWeight={600} fontSize={12}>{o.full_name}</Typography>
                                        <Typography variant="caption" color="text.secondary" fontSize={10}>{o.mobile}</Typography>
                                      </Box>
                                    </Stack>
                                  </MenuItem>
                                ))}
                                {officers.length === 0 && (
                                  <MenuItem disabled>
                                    <Typography variant="caption" color="text.disabled">No officers found</Typography>
                                  </MenuItem>
                                )}
                              </Select>
                            </FormControl>
                            <Button
                              variant="contained" color="primary"
                              disabled={!officerForm.officer_user_id || officerMutation.isPending}
                              onClick={() => officerMutation.mutate()}
                              startIcon={officerMutation.isPending ? <CircularProgress size={13} color="inherit" /> : <AssignmentInd />}
                              sx={{ borderRadius: 2, fontWeight: 700, minWidth: 100, flexShrink: 0 }}
                            >
                              {officerMutation.isPending ? "…" : vehicle.assigned_officer ? "Re-assign" : "Assign"}
                            </Button>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            )}
          </>
        ) : null}
      </DialogContent>

      {/* Inline doc verify confirm */}
      {docVerify && (
        <Dialog open onClose={() => setDocVerify(null)} maxWidth="sm" fullWidth
          PaperProps={{ sx: { borderRadius: 2 } }}>
          <DialogTitle>
            {docVerify.status === "APPROVED" ? "Approve Document" : "Reject Document"}
          </DialogTitle>
          <DialogContent>
            <TextField
              fullWidth size="small" label="Remarks (optional)" multiline rows={2} sx={{ mt: 1 }}
              value={docVerify.remarks}
              onChange={(e) => setDocVerify((f) => f && ({ ...f, remarks: e.target.value }))}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDocVerify(null)}>Cancel</Button>
            <Button
              variant="contained"
              color={docVerify.status === "APPROVED" ? "success" : "error"}
              disabled={verifyDocMutation.isPending}
              onClick={() => verifyDocMutation.mutate()}
            >
              Confirm {docVerify.status}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Inline photo verify confirm */}
      {photoVerify && (
        <Dialog open onClose={() => setPhotoVerify(null)} maxWidth="sm" fullWidth
          PaperProps={{ sx: { borderRadius: 2 } }}>
          <DialogTitle>
            {photoVerify.status === "APPROVED" ? "Approve Photo" : "Reject Photo"}
          </DialogTitle>
          <DialogContent>
            <TextField
              fullWidth size="small" label="Remarks (optional)" multiline rows={2} sx={{ mt: 1 }}
              value={photoVerify.remarks}
              onChange={(e) => setPhotoVerify((f) => f && ({ ...f, remarks: e.target.value }))}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPhotoVerify(null)}>Cancel</Button>
            <Button
              variant="contained"
              color={photoVerify.status === "APPROVED" ? "success" : "error"}
              disabled={verifyPhotoMutation.isPending}
              onClick={() => verifyPhotoMutation.mutate()}
            >
              Confirm {photoVerify.status}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Dialog>
  );
}

// ── KPI card ──────────────────────────────────────────────────

function KpiCard({ label, value, color, icon }: {
  label: string; value: number; color: string; icon: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <Card variant="outlined" sx={{
      borderRadius: 2,
      border: `1px solid ${alpha(theme.palette[color as "primary"]?.main ?? theme.palette.primary.main, 0.2)}`,
      background: `linear-gradient(135deg, ${alpha(theme.palette[color as "primary"]?.main ?? theme.palette.primary.main, 0.06)} 0%, transparent 100%)`,
    }}>
      <CardContent sx={{ py: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{
            bgcolor: alpha(theme.palette[color as "primary"]?.main ?? theme.palette.primary.main, 0.12),
            color: `${color}.main`,
            width: 40, height: 40,
          }}>
            {icon}
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight={800} color={`${color}.main`}>{value}</Typography>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ── Main VehiclesPage ─────────────────────────────────────────

export default function VehiclesPage() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Vehicles list
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-vehicles", statusFilter, page, rowsPerPage],
    queryFn: () =>
      vehicleService.listVehicles({
        status: statusFilter || undefined,
        page: page + 1,
        page_size: rowsPerPage,
      }),
    staleTime: 30 * 1000,
  });

  const vehicles = data?.items ?? [];
  const total = data?.total ?? 0;

  // KPI counts per status
  const kpis = useMemo(() => {
    const all = vehicles;
    return {
      total,
      active: vehicles.filter((v) => v.status === "ACTIVE").length,
      pending: vehicles.filter((v) => v.status === "PENDING").length,
      underReview: vehicles.filter((v) => v.status === "UNDER_REVIEW").length,
      suspended: vehicles.filter((v) => v.status === "SUSPENDED").length,
    };
  }, [vehicles, total]);

  // Client-side search
  const filtered = useMemo(() => {
    if (!search) return vehicles;
    const q = search.toLowerCase();
    return vehicles.filter((v) =>
      v.registration_number?.toLowerCase().includes(q) ||
      v.vehicle_code?.toLowerCase().includes(q) ||
      v.make?.toLowerCase().includes(q) ||
      v.model?.toLowerCase().includes(q)
    );
  }, [vehicles, search]);

  return (
    <Box>
      {/* ── Header ─────────────────────────────────────────── */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: "primary.main", width: 40, height: 40 }}>
              <DirectionsCar />
            </Avatar>
            <Box>
              <Typography variant="h5" fontWeight={800}>Vehicles</Typography>
              <Typography variant="body2" color="text.secondary">
                Register, verify and manage all partner vehicles
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Tooltip title="Refresh">
            <IconButton onClick={() => refetch()}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setAddOpen(true)}
            sx={{ borderRadius: 2, fontWeight: 700 }}
          >
            Register Vehicle
          </Button>
        </Stack>
      </Box>

      {/* ── KPI Row ─────────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={4} md={2.4}>
          <KpiCard label="Total" value={total} color="primary" icon={<DirectionsCar />} />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <KpiCard label="Active" value={kpis.active} color="success" icon={<CheckCircle />} />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <KpiCard label="Pending" value={kpis.pending} color="warning" icon={<HourglassTop />} />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <KpiCard label="Under Review" value={kpis.underReview} color="info" icon={<ManageSearch />} />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <KpiCard label="Suspended" value={kpis.suspended} color="error" icon={<DoNotDisturb />} />
        </Grid>
      </Grid>

      {/* ── Filters ─────────────────────────────────────────── */}
      <Card variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
        <CardContent sx={{ py: 1.5 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder="Search reg. number, code, brand…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
              sx={{ flex: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              >
                <MenuItem value="">All Statuses</MenuItem>
                {Object.keys(VEHICLE_STATUS_META).map((s) => (
                  <MenuItem key={s} value={s}>{VEHICLE_STATUS_META[s].label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Table ───────────────────────────────────────────── */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        {isLoading && <LinearProgress />}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Registration</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Brand / Model</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Partner</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Registered</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(7)].map((_, j) => (
                      <TableCell key={j}><Skeleton /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Stack alignItems="center" spacing={1.5}>
                      <DirectionsCar sx={{ fontSize: 48, color: "text.disabled" }} />
                      <Typography variant="body2" color="text.disabled">
                        {statusFilter || search ? "No vehicles match your filters" : "No vehicles registered yet"}
                      </Typography>
                      {!statusFilter && !search && (
                        <Button variant="outlined" size="small" startIcon={<Add />} onClick={() => setAddOpen(true)}>
                          Register First Vehicle
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((v) => (
                  <TableRow
                    key={v.id} hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => setSelectedId(v.id)}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar sx={{
                          width: 32, height: 32,
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          color: "primary.main",
                        }}>
                          <DirectionsCar sx={{ fontSize: 16 }} />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={700} sx={{ fontFamily: "monospace" }}>
                            {v.registration_number}
                          </Typography>
                          <Typography variant="caption" color="text.disabled">
                            {v.vehicle_code ?? "—"}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {[v.make, v.model].filter(Boolean).join(" ") || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {v.vehicle_category ?? "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {v.partner_name ?? "—"}
                      </Typography>
                    </TableCell>
                    <TableCell><StatusChip status={v.status} /></TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(v.created_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View details">
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); setSelectedId(v.id); }}
                        >
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50]}
        />
      </Card>

      {/* ── Add Vehicle Dialog ───────────────────────────────── */}
      <AddVehicleDialog open={addOpen} onClose={() => setAddOpen(false)} />

      {/* ── Vehicle Detail Dialog ────────────────────────────── */}
      <VehicleDetailDialog vehicleId={selectedId} onClose={() => setSelectedId(null)} />
    </Box>
  );
}
