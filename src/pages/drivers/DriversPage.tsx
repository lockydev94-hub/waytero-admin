// ============================================================
// WAYTERO ADMIN — DRIVERS PAGE  (Premium v2 — Modal Edition)
// Doc Ref: Driver API Doc §3-32 | DB Schema Part 3 §2-9
//          Admin API §9 — Driver Management
// Status flow: PENDING → UNDER_REVIEW → APPROVED → ACTIVE → INACTIVE → SUSPENDED
// Documents: DRIVING_LICENSE | AADHAAR | PAN | PHOTO | POLICE_VERIFICATION | MEDICAL_CERTIFICATE
// Admin creates driver: POST /admin/drivers (requires partner_id)
// Admin actions: approve, suspend, block via PATCH /admin/drivers/{id}/*
// Document verify: PATCH /admin/drivers/{id}/verify-document/{docId}
// Document upload:  POST /drivers/{uuid}/documents  (uses driver uuid, not int id)
// ============================================================

import React, { useState, useMemo } from "react";
import {
  Box, Typography, Card, CardContent, Chip, Button, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TextField, MenuItem, Select, FormControl, InputLabel,
  Stack, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogActions, LinearProgress, Alert, Avatar, Grid,
  Paper, Tab, Tabs, CircularProgress, Skeleton,
  InputAdornment, Divider,
  Stepper, Step, StepLabel,
} from "@mui/material";
import {
  Search, Refresh, Add, CheckCircle,
  Cancel, Block, Visibility,
  Close, Person, Phone, Email,
  DriveEta, Badge, AssignmentInd, CloudUpload,
  VerifiedUser, HourglassTop, PlayArrow, Pause,
  Description, FolderOpen, CreditCard, CalendarToday,
  DirectionsCar, Star, CheckCircleOutline,
  ErrorOutline, PendingActions, GpsFixed, LocalShipping,
  AccountBox, FilterList, OpenInNew, TaskAlt, Numbers,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import apiClient from "../../services/api";
import { partnerService, AdminPartnerListItem } from "../../services/partner.service";
import MediaPicker from "../../components/media/MediaPicker";
import { MediaLibraryItem } from "../../services/media.service";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminDriver {
  id: number;
  driver_code: string | null;
  full_name: string | null;
  mobile_number: string | null;
  license_number: string | null;
  status: string;
  city_id: number | null;
  created_at: string;
  partner_id?: number | null;
}

export interface DriverDocument {
  id: number;
  document_type: string;
  file_url: string;
  verification_status: string | null;
  expiry_date: string | null;
  remarks: string | null;
  uploaded_at: string;
}

export interface DriverDetail {
  id: number;
  uuid: string;
  driver_code: string;
  partner_id: number;
  full_name: string;
  mobile_number: string | null;
  email: string | null;
  license_number: string | null;
  license_expiry_date: string | null;
  date_of_birth: string | null;
  joining_date: string | null;
  status: string;
  approved_at: string | null;
  created_at: string;
  documents: DriverDocument[];
  availability_status: string | null;
  completed_trips: number | null;
  average_rating: number | null;
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DRIVER_STATUSES = ["PENDING", "UNDER_REVIEW", "APPROVED", "ACTIVE", "INACTIVE", "SUSPENDED", "BLOCKED"] as const;

const STATUS_META: Record<string, { label: string; color: "default" | "warning" | "info" | "primary" | "success" | "error" | "secondary"; icon: React.ReactNode }> = {
  PENDING:      { label: "Pending",      color: "warning",   icon: <HourglassTop sx={{ fontSize: 14 }} /> },
  UNDER_REVIEW: { label: "Under Review", color: "info",      icon: <AssignmentInd sx={{ fontSize: 14 }} /> },
  APPROVED:     { label: "Approved",     color: "primary",   icon: <CheckCircleOutline sx={{ fontSize: 14 }} /> },
  ACTIVE:       { label: "Active",       color: "success",   icon: <PlayArrow sx={{ fontSize: 14 }} /> },
  INACTIVE:     { label: "Inactive",     color: "default",   icon: <Pause sx={{ fontSize: 14 }} /> },
  SUSPENDED:    { label: "Suspended",    color: "error",     icon: <Cancel sx={{ fontSize: 14 }} /> },
  BLOCKED:      { label: "Blocked",      color: "error",     icon: <Block sx={{ fontSize: 14 }} /> },
};

const DOC_META: Record<string, { label: string; icon: React.ReactNode; hasRegisteredNumber?: boolean; registeredNumberLabel?: string }> = {
  DRIVING_LICENSE:      { label: "Driving License",      icon: <DriveEta fontSize="small" />,      hasRegisteredNumber: true, registeredNumberLabel: "License Number" },
  AADHAAR:              { label: "Aadhaar Card",         icon: <Badge fontSize="small" />,          hasRegisteredNumber: false },
  PAN:                  { label: "PAN Card",             icon: <CreditCard fontSize="small" />,     hasRegisteredNumber: false },
  PHOTO:                { label: "Profile Photo",        icon: <Person fontSize="small" />,         hasRegisteredNumber: false },
  POLICE_VERIFICATION:  { label: "Police Verification",  icon: <VerifiedUser fontSize="small" />,   hasRegisteredNumber: false },
  MEDICAL_CERTIFICATE:  { label: "Medical Certificate",  icon: <Description fontSize="small" />,    hasRegisteredNumber: false },
};

const DOC_VERIFY_META: Record<string, { label: string; color: "default" | "success" | "error" | "warning" }> = {
  APPROVED:  { label: "Approved",  color: "success" },
  REJECTED:  { label: "Rejected",  color: "error"   },
  PENDING:   { label: "Pending",   color: "warning"  },
};

const GOV_ID_TYPES = ["AADHAAR", "PAN", "PASSPORT", "VOTER_ID"];

// Docs that need an admin-entered reference number at upload time (no pre-fill from driver row)
const DOCS_WITH_REF_NUMBER: Record<string, string> = {
  AADHAAR: "Aadhaar Number",
  PAN: "PAN Number",
  POLICE_VERIFICATION: "Verification Reference No.",
  MEDICAL_CERTIFICATE: "Certificate No.",
};

// ── API Service ───────────────────────────────────────────────────────────────

const driverAdminService = {
  list: (params: Record<string, unknown> = {}) =>
    apiClient.get<PagedResponse<AdminDriver>>("/admin/drivers", { params }).then(r => r.data),

  getDetail: (id: number) =>
    apiClient.get<DriverDetail>(`/admin/drivers/${id}`).then(r => r.data),

  create: (payload: {
    partner_id: number; full_name: string; mobile: string; email?: string;
    license_number: string; license_expiry_date?: string; date_of_birth?: string;
    joining_date?: string; address?: string; gov_id_type?: string; gov_id_number?: string;
  }) =>
    apiClient.post("/admin/drivers", payload).then(r => r.data),

  approve: (id: number, reason?: string) =>
    apiClient.patch(`/admin/drivers/${id}/approve`, { reason }).then(r => r.data),

  suspend: (id: number, reason?: string) =>
    apiClient.patch(`/admin/drivers/${id}/suspend`, { reason }).then(r => r.data),

  block: (id: number, reason?: string) =>
    apiClient.patch(`/admin/drivers/${id}/block`, { reason }).then(r => r.data),

  verifyDocument: (driverId: number, documentId: number, status: "APPROVED" | "REJECTED", remarks?: string) =>
    apiClient.patch(`/admin/drivers/${driverId}/verify-document/${documentId}`, null, {
      params: { verification_status: status, remarks },
    }).then(r => r.data),

  // NOTE: uses driver UUID (not int id) — backend /drivers/{uuid}/documents endpoint
  uploadDocument: (driverId: number, fileUrl: string, document_type: string, expiry_date?: string) =>
    // Uses admin endpoint: POST /admin/drivers/{id}/documents (JSON body with cloudinary URL)
    apiClient.post(`/admin/drivers/${driverId}/documents`, {
      document_type,
      file_url: fileUrl,
      expiry_date: expiry_date || undefined,
    }).then(r => r.data),
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useDrivers(params: Record<string, unknown>) {
  return useQuery<PagedResponse<AdminDriver>>({
    queryKey: ["admin-drivers", params],
    queryFn: () => driverAdminService.list(params),
    staleTime: 30_000,
  });
}

function useDriverDetail(id: number | null) {
  return useQuery<DriverDetail>({
    queryKey: ["admin-driver-detail", id],
    queryFn: () => driverAdminService.getDetail(id!),
    enabled: !!id,
    staleTime: 15_000,
  });
}

function usePartners() {
  return useQuery<{ items: AdminPartnerListItem[] }>({
    queryKey: ["admin-partners-for-driver"],
    queryFn: () => partnerService.list({ page: 1, page_size: 100 }),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Status Chip ───────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: "default" as const, icon: null };
  return (
    <Chip
      label={meta.label}
      color={meta.color}
      size="small"
      icon={meta.icon as React.ReactElement}
      sx={{ fontWeight: 700, letterSpacing: 0.3, minWidth: 110 }}
    />
  );
}

// ── Availability Badge ────────────────────────────────────────────────────────

function AvailBadge({ status }: { status: string | null }) {
  if (!status) return <Chip label="Unknown" size="small" color="default" />;
  const colorMap: Record<string, "success" | "warning" | "error" | "info"> = {
    ONLINE: "success", OFFLINE: "default" as any, ON_TRIP: "info", BREAK: "warning",
  };
  return <Chip label={status} size="small" color={colorMap[status] ?? "default"} />;
}

// ── Add Driver Modal ──────────────────────────────────────────────────────────

interface AddDriverModalProps {
  open: boolean;
  onClose: () => void;
}

function AddDriverModal({ open, onClose }: AddDriverModalProps) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { data: partnersData, isLoading: partnersLoading } = usePartners();
  const partners = (partnersData?.items ?? []).filter(
    p => !["BLOCKED", "SUSPENDED"].includes(p.status)
  );
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    partner_id: "" as string | number,
    full_name: "", mobile: "", email: "",
    license_number: "", license_expiry_date: "",
    date_of_birth: "", joining_date: "",
    address: "",
    gov_id_type: "", gov_id_number: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const steps = ["Partner & Basic Info", "License & Identity", "Gov ID Details"];

  const set = (k: string, v: string | number) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  };

  const createMut = useMutation({
    mutationFn: () =>
      driverAdminService.create({
        partner_id: Number(form.partner_id),
        full_name: form.full_name,
        mobile: form.mobile,
        email: form.email || undefined,
        license_number: form.license_number,
        license_expiry_date: form.license_expiry_date || undefined,
        date_of_birth: form.date_of_birth || undefined,
        joining_date: form.joining_date || undefined,
        address: form.address || undefined,
        gov_id_type: form.gov_id_type || undefined,
        gov_id_number: form.gov_id_number || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-drivers"] });
      enqueueSnackbar("Driver registered successfully", { variant: "success" });
      handleClose();
    },
    onError: (err: any) => {
      enqueueSnackbar(err?.response?.data?.detail ?? "Failed to create driver", { variant: "error" });
    },
  });

  const handleClose = () => {
    setStep(0);
    setForm({ partner_id: "", full_name: "", mobile: "", email: "", license_number: "", license_expiry_date: "", date_of_birth: "", joining_date: "", address: "", gov_id_type: "", gov_id_number: "" });
    setErrors({});
    onClose();
  };

  const handleNext = () => {
    if (step === 0) {
      const e: Record<string, string> = {};
      if (!form.partner_id) e.partner_id = "Select a partner";
      if (!form.full_name.trim()) e.full_name = "Required";
      if (!form.mobile.trim()) e.mobile = "Required";
      setErrors(e);
      if (Object.keys(e).length > 0) return;
    }
    if (step === 1) {
      const e: Record<string, string> = {};
      if (!form.license_number.trim()) e.license_number = "Required";
      setErrors(e);
      if (Object.keys(e).length > 0) return;
    }
    setStep(s => s + 1);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 3, background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, background: "linear-gradient(135deg, #667eea, #764ba2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DriveEta sx={{ color: "#fff", fontSize: 18 }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ color: "#fff" }}>Register New Driver</Typography>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>Step {step + 1} of {steps.length}</Typography>
            </Box>
          </Stack>
          <IconButton onClick={handleClose} size="small" sx={{ color: "rgba(255,255,255,0.5)" }}><Close fontSize="small" /></IconButton>
        </Stack>
      </DialogTitle>

      <Box sx={{ px: 3, pb: 1 }}>
        <Stepper activeStep={step} alternativeLabel>
          {steps.map(label => (
            <Step key={label}>
              <StepLabel sx={{ "& .MuiStepLabel-label": { color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }, "& .MuiStepLabel-label.Mui-active": { color: "#fff" }, "& .MuiStepLabel-label.Mui-completed": { color: "rgba(255,255,255,0.7)" } }}>
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {createMut.isPending && <LinearProgress />}

      <DialogContent sx={{ pt: 2 }}>
        {step === 0 && (
          <Stack gap={2.5}>
            <FormControl fullWidth error={!!errors.partner_id}>
              <InputLabel sx={{ color: "rgba(255,255,255,0.6)" }}>Partner *</InputLabel>
              <Select
                value={form.partner_id}
                label="Partner *"
                onChange={e => set("partner_id", e.target.value as number)}
                sx={{ color: "#fff", "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.2)" }, "& .MuiSelect-icon": { color: "rgba(255,255,255,0.5)" } }}
              >
                {partnersLoading && (
                  <MenuItem disabled>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <CircularProgress size={14} />
                      <em>Loading partners…</em>
                    </Stack>
                  </MenuItem>
                )}
                {!partnersLoading && partners.length === 0 && (
                  <MenuItem disabled><em>No eligible partners found</em></MenuItem>
                )}
                {partners.map(p => (
                  <MenuItem key={p.id} value={p.id}>
                    <Stack direction="row" alignItems="center" gap={1} sx={{ width: "100%" }}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: "0.75rem", bgcolor: "#667eea", flexShrink: 0 }}>
                        {(p.business_name || p.contact_person || "P").charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {p.business_name || p.contact_person || `Partner #${p.id}`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{p.partner_code}</Typography>
                      </Box>
                      <Chip
                        label={p.status}
                        size="small"
                        color={p.status === "ACTIVE" ? "success" : p.status === "APPROVED" ? "primary" : "default"}
                        sx={{ height: 18, fontSize: "0.6rem", ml: "auto", flexShrink: 0 }}
                      />
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
              {errors.partner_id && <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>{errors.partner_id}</Typography>}
            </FormControl>

            <TextField fullWidth label="Full Name *" value={form.full_name} onChange={e => set("full_name", e.target.value)}
              error={!!errors.full_name} helperText={errors.full_name}
              InputLabelProps={{ sx: { color: "rgba(255,255,255,0.6)" } }}
              InputProps={{ sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.2)" } } }} />

            <Stack direction="row" gap={2}>
              <TextField fullWidth label="Mobile *" value={form.mobile} onChange={e => set("mobile", e.target.value)}
                error={!!errors.mobile} helperText={errors.mobile}
                InputProps={{ startAdornment: <InputAdornment position="start"><Phone sx={{ fontSize: 16, color: "rgba(255,255,255,0.4)" }} /></InputAdornment>, sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.2)" } } }}
                InputLabelProps={{ sx: { color: "rgba(255,255,255,0.6)" } }} />
              <TextField fullWidth label="Email" value={form.email} onChange={e => set("email", e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Email sx={{ fontSize: 16, color: "rgba(255,255,255,0.4)" }} /></InputAdornment>, sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.2)" } } }}
                InputLabelProps={{ sx: { color: "rgba(255,255,255,0.6)" } }} />
            </Stack>

            <TextField fullWidth label="Address" value={form.address} onChange={e => set("address", e.target.value)} multiline rows={2}
              InputProps={{ sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.2)" } } }}
              InputLabelProps={{ sx: { color: "rgba(255,255,255,0.6)" } }} />
          </Stack>
        )}

        {step === 1 && (
          <Stack gap={2.5}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Enter driving license details. Documents can be uploaded after registration.
            </Alert>
            <TextField fullWidth label="License Number *" value={form.license_number} onChange={e => set("license_number", e.target.value)}
              error={!!errors.license_number} helperText={errors.license_number}
              InputProps={{ startAdornment: <InputAdornment position="start"><DriveEta sx={{ fontSize: 16, color: "rgba(255,255,255,0.4)" }} /></InputAdornment>, sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.2)" } } }}
              InputLabelProps={{ sx: { color: "rgba(255,255,255,0.6)" } }} />
            <Stack direction="row" gap={2}>
              <TextField fullWidth label="License Expiry Date" type="date" value={form.license_expiry_date} onChange={e => set("license_expiry_date", e.target.value)}
                InputLabelProps={{ shrink: true, sx: { color: "rgba(255,255,255,0.6)" } }}
                InputProps={{ sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.2)" } } }} />
              <TextField fullWidth label="Date of Birth" type="date" value={form.date_of_birth} onChange={e => set("date_of_birth", e.target.value)}
                InputLabelProps={{ shrink: true, sx: { color: "rgba(255,255,255,0.6)" } }}
                InputProps={{ sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.2)" } } }} />
            </Stack>
            <TextField fullWidth label="Joining Date" type="date" value={form.joining_date} onChange={e => set("joining_date", e.target.value)}
              InputLabelProps={{ shrink: true, sx: { color: "rgba(255,255,255,0.6)" } }}
              InputProps={{ sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.2)" } } }} />
          </Stack>
        )}

        {step === 2 && (
          <Stack gap={2.5}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Government ID details are used for identity verification. Actual documents will be uploaded separately.
            </Alert>
            <FormControl fullWidth>
              <InputLabel sx={{ color: "rgba(255,255,255,0.6)" }}>Gov ID Type</InputLabel>
              <Select value={form.gov_id_type} label="Gov ID Type" onChange={e => set("gov_id_type", e.target.value)}
                sx={{ color: "#fff", "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.2)" }, "& .MuiSelect-icon": { color: "rgba(255,255,255,0.5)" } }}>
                {GOV_ID_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField fullWidth label="Gov ID Number" value={form.gov_id_number} onChange={e => set("gov_id_number", e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><AccountBox sx={{ fontSize: 16, color: "rgba(255,255,255,0.4)" }} /></InputAdornment>, sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.2)" } } }}
              InputLabelProps={{ sx: { color: "rgba(255,255,255,0.6)" } }} />

            {/* Summary review */}
            <Paper sx={{ p: 2, borderRadius: 2, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: "rgba(255,255,255,0.7)", mb: 1.5 }}>Registration Summary</Typography>
              <Stack gap={0.75}>
                {[
                  ["Partner ID", String(form.partner_id)],
                  ["Name", form.full_name],
                  ["Mobile", form.mobile],
                  ["License", form.license_number],
                  ["License Expiry", form.license_expiry_date || "—"],
                ].map(([k, v]) => (
                  <Stack key={k} direction="row" justifyContent="space-between">
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)" }}>{k}</Typography>
                    <Typography variant="caption" fontWeight={600} sx={{ color: "#fff" }}>{v}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        {step > 0 && (
          <Button variant="outlined" onClick={() => setStep(s => s - 1)} sx={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", "&:hover": { borderColor: "rgba(255,255,255,0.4)" } }}>
            Back
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" onClick={handleClose} sx={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.5)" }}>
          Cancel
        </Button>
        {step < steps.length - 1 ? (
          <Button variant="contained" onClick={handleNext}
            sx={{ background: "linear-gradient(135deg, #667eea, #764ba2)", px: 3, fontWeight: 700 }}>
            Next Step
          </Button>
        ) : (
          <Button variant="contained" onClick={() => createMut.mutate()} disabled={createMut.isPending}
            startIcon={createMut.isPending ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
            sx={{ background: "linear-gradient(135deg, #11998e, #38ef7d)", color: "#fff", px: 3, fontWeight: 700 }}>
            Register Driver
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ── Document Upload Dialog ────────────────────────────────────────────────────
// Premium upload dialog — pre-fills license number for DRIVING_LICENSE,
// collects reference number for AADHAAR / PAN / other identity docs.

interface DocUploadDialogProps {
  open: boolean;
  onClose: () => void;
  driver: DriverDetail;
}

function DocUploadDialog({ open, onClose, driver }: DocUploadDialogProps) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [docType, setDocType] = useState("");
  const [expiry, setExpiry] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [pickedUrl, setPickedUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Determine which "number" to show based on doc type selection
  const isLicense = docType === "DRIVING_LICENSE";
  const refLabel = DOCS_WITH_REF_NUMBER[docType] ?? null;
  const registeredLicenseNumber = driver.license_number ?? "";

  const handlePicked = (items: MediaLibraryItem[]) => {
    const url = items[0]?.secure_url ?? "";
    if (url) setPickedUrl(url);
  };

  const handleDocTypeChange = (type: string) => {
    setDocType(type);
    setRefNumber(""); // reset on type change
  };

  const handleUpload = async () => {
    if (!docType || !pickedUrl) {
      enqueueSnackbar("Select document type and file", { variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      await driverAdminService.uploadDocument(driver.id, pickedUrl, docType, expiry);

      qc.invalidateQueries({ queryKey: ["admin-driver-detail", driver.id] });
      enqueueSnackbar(
        docType === "PHOTO" ? "Driver photo uploaded successfully" : "Document uploaded successfully",
        { variant: "success" }
      );
      setDocType(""); setExpiry(""); setPickedUrl(""); setRefNumber("");
      onClose();
    } catch (err: any) {
      enqueueSnackbar(err?.response?.data?.detail ?? "Upload failed", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    setDocType(""); setExpiry(""); setPickedUrl(""); setRefNumber("");
    onClose();
  };

  const selectedMeta = docType ? DOC_META[docType] : null;

  return (
    <>
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 3, background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)", overflow: "hidden" } }}>
      {saving && <LinearProgress sx={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }} />}

      <DialogTitle sx={{ pb: 0, pt: 2.5, px: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Box sx={{ width: 40, height: 40, borderRadius: 2.5, background: "linear-gradient(135deg, #667eea, #764ba2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CloudUpload sx={{ color: "#fff", fontSize: 20 }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ color: "#fff" }}>Upload Document</Typography>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)" }}>
                {driver.full_name} · {driver.driver_code}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={handleClose} size="small" sx={{ color: "rgba(255,255,255,0.4)", "&:hover": { color: "#fff" } }}>
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pt: 2.5, pb: 1 }}>
        <Stack gap={2.5}>
          {/* Document type selector */}
          <FormControl fullWidth>
            <InputLabel sx={{ color: "rgba(255,255,255,0.6)" }}>Document Type *</InputLabel>
            <Select
              value={docType}
              label="Document Type *"
              onChange={e => handleDocTypeChange(e.target.value)}
              sx={{ color: "#fff", "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.2)" }, "& .MuiSelect-icon": { color: "rgba(255,255,255,0.5)" } }}
            >
              {Object.entries(DOC_META).map(([k, v]) => {
                const alreadyUploaded = driver.documents.some(d => d.document_type === k && d.verification_status === "APPROVED");
                return (
                  <MenuItem key={k} value={k}>
                    <Stack direction="row" alignItems="center" gap={1.5} sx={{ width: "100%" }}>
                      <Box sx={{ color: "#667eea" }}>{v.icon}</Box>
                      <Typography variant="body2" flex={1}>{v.label}</Typography>
                      {alreadyUploaded && (
                        <Chip label="Verified" size="small" color="success" sx={{ height: 18, fontSize: "0.6rem" }} />
                      )}
                    </Stack>
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>

          {/* Registered number info banner for DRIVING_LICENSE */}
          {isLicense && registeredLicenseNumber && (
            <Paper sx={{ p: 2, borderRadius: 2, background: "rgba(102,126,234,0.12)", border: "1px solid rgba(102,126,234,0.35)" }}>
              <Stack direction="row" alignItems="center" gap={1.5}>
                <Numbers sx={{ color: "#667eea", fontSize: 20 }} />
                <Box>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.45)", display: "block" }}>
                    License number registered at onboarding
                  </Typography>
                  <Typography variant="body1" fontWeight={700} fontFamily="monospace" sx={{ color: "#a5b4fc", letterSpacing: 1.5 }}>
                    {registeredLicenseNumber}
                  </Typography>
                </Box>
                <Chip label="Pre-filled" size="small" sx={{ ml: "auto", bgcolor: "rgba(102,126,234,0.3)", color: "#a5b4fc", height: 20, fontSize: "0.6rem" }} />
              </Stack>
            </Paper>
          )}

          {/* ID cards — editable reference number field */}
          {!isLicense && refLabel && (
            <TextField
              fullWidth
              label={`${refLabel} (optional)`}
              value={refNumber}
              onChange={e => setRefNumber(e.target.value)}
              placeholder={`Enter ${refLabel.toLowerCase()}`}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Numbers sx={{ fontSize: 16, color: "rgba(255,255,255,0.4)" }} /></InputAdornment>,
                sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.2)" } },
              }}
              InputLabelProps={{ sx: { color: "rgba(255,255,255,0.6)" } }}
            />
          )}

          {/* Expiry date */}
          {docType && docType !== "PHOTO" && (
            <TextField
              fullWidth
              label="Expiry Date (optional)"
              type="date"
              value={expiry}
              onChange={e => setExpiry(e.target.value)}
              InputLabelProps={{ shrink: true, sx: { color: "rgba(255,255,255,0.6)" } }}
              InputProps={{ sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.2)" } } }}
            />
          )}

          {/* File picker trigger — opens MediaPicker */}
          <Box
            onClick={() => setPickerOpen(true)}
            sx={{
              border: `2px dashed`,
              borderColor: pickedUrl ? "success.main" : "rgba(255,255,255,0.15)",
              borderRadius: 3,
              p: 3,
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.2s",
              background: pickedUrl ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.02)",
              "&:hover": { borderColor: "#667eea", background: "rgba(102,126,234,0.06)" },
            }}
          >
            {pickedUrl ? (
              <Stack alignItems="center" gap={1}>
                <TaskAlt sx={{ color: "success.main", fontSize: 36 }} />
                <Typography variant="body2" fontWeight={700} noWrap sx={{ color: "success.light", maxWidth: "100%" }}>
                  {pickedUrl}
                </Typography>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.3)" }}>
                  Click to choose a different file
                </Typography>
              </Stack>
            ) : (
              <Stack alignItems="center" gap={1}>
                <CloudUpload sx={{ color: "rgba(255,255,255,0.2)", fontSize: 40 }} />
                <Typography variant="body2" fontWeight={600} sx={{ color: "rgba(255,255,255,0.5)" }}>
                  Click to browse or pick from media library
                </Typography>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.25)" }}>
                  PDF, JPG, PNG · uploaded to Cloudinary
                </Typography>
              </Stack>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 1 }}>
        <Button variant="outlined" onClick={handleClose} disabled={saving}
          sx={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.6)", "&:hover": { borderColor: "rgba(255,255,255,0.4)" } }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={saving || !docType || !pickedUrl}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <CloudUpload />}
          sx={{ background: "linear-gradient(135deg, #667eea, #764ba2)", fontWeight: 700, px: 3, flexGrow: 1 }}
        >
          {saving ? "Uploading…" : "Upload Document"}
        </Button>
      </DialogActions>
    </Dialog>

    <MediaPicker
      open={pickerOpen}
      onClose={() => setPickerOpen(false)}
      onSelect={handlePicked}
      folder="waytero/drivers"
      uploadFolder="waytero/drivers"
      kind="image"
      assetType={docType === "PHOTO" ? "photo" : "document"}
      accept={docType === "PHOTO" ? "image/*" : ".pdf,image/*"}
      title="Choose driver document"
    />
    </>
  );
}

// ── Driver Detail Modal ───────────────────────────────────────────────────────
// Full-screen modal (replaces side Drawer). Premium dark design.

interface DetailModalProps {
  driverId: number | null;
  onClose: () => void;
}

// Helper: extract driver photo URL from documents (PHOTO type, prefer APPROVED)
function getDriverPhotoUrl(documents: DriverDocument[]): string | null {
  const photos = documents.filter(d => d.document_type === "PHOTO");
  if (photos.length === 0) return null;
  const approved = photos.find(p => p.verification_status === "APPROVED");
  return (approved ?? photos[0]).file_url;
}

function DriverDetailModal({ driverId, onClose }: DetailModalProps) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { data: driver, isLoading } = useDriverDetail(driverId);
  const [activeTab, setActiveTab] = useState(0);
  const [docUploadOpen, setDocUploadOpen] = useState(false);
  const [actionReason, setActionReason] = useState("");
  const [confirmAction, setConfirmAction] = useState<null | { key: string; label: string }>(null);

  const actionMut = useMutation({
    mutationFn: ({ action }: { action: string }) => {
      if (action === "approve") return driverAdminService.approve(driverId!, actionReason);
      if (action === "suspend") return driverAdminService.suspend(driverId!, actionReason);
      if (action === "block")   return driverAdminService.block(driverId!, actionReason);
      return Promise.reject("Unknown action");
    },
    onSuccess: (_, { action }) => {
      qc.invalidateQueries({ queryKey: ["admin-drivers"] });
      qc.invalidateQueries({ queryKey: ["admin-driver-detail", driverId] });
      enqueueSnackbar(`Driver ${action}d successfully`, { variant: "success" });
      setConfirmAction(null);
      setActionReason("");
    },
    onError: (err: any) => {
      enqueueSnackbar(err?.response?.data?.detail ?? "Action failed", { variant: "error" });
    },
  });

  const verifyDocMut = useMutation({
    mutationFn: ({ docId, status }: { docId: number; status: "APPROVED" | "REJECTED" }) =>
      driverAdminService.verifyDocument(driverId!, docId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-driver-detail", driverId] });
      enqueueSnackbar("Document status updated", { variant: "success" });
    },
    onError: (err: any) => {
      enqueueSnackbar(err?.response?.data?.detail ?? "Failed", { variant: "error" });
    },
  });

  const getActions = (status: string) => {
    switch (status) {
      case "PENDING":      return [{ key: "approve", label: "Approve Driver", color: "success" as const }];
      case "UNDER_REVIEW": return [{ key: "approve", label: "Approve", color: "success" as const }, { key: "suspend", label: "Suspend", color: "warning" as const }];
      case "APPROVED":     return [{ key: "approve", label: "Activate", color: "success" as const }, { key: "suspend", label: "Suspend", color: "warning" as const }];
      case "ACTIVE":       return [{ key: "suspend", label: "Suspend", color: "warning" as const }, { key: "block", label: "Block", color: "error" as const }];
      case "SUSPENDED":    return [{ key: "approve", label: "Re-Activate", color: "success" as const }, { key: "block", label: "Block", color: "error" as const }];
      default: return [];
    }
  };

  // Docs completion summary
  const docsCompleted = driver ? Object.keys(DOC_META).filter(k => driver.documents.find(d => d.document_type === k && d.verification_status === "APPROVED")).length : 0;
  const docsTotal = Object.keys(DOC_META).length;

  return (
    <Dialog
      open={!!driverId}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: { xs: 0, sm: 3 },
          background: "linear-gradient(135deg, #0f0f1a 0%, #13132a 100%)",
          color: "#fff",
          height: { xs: "100dvh", sm: "90vh" },
          maxHeight: { xs: "100dvh", sm: "90vh" },
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
      }}
    >
      {/* ── Modal Header ── */}
      <Box sx={{
        background: "linear-gradient(135deg, #1a1a3e 0%, #16213e 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        flexShrink: 0,
      }}>
        {/* Top bar */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 3, pt: 2.5, pb: 0 }}>
          <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.3)", letterSpacing: 2, fontSize: "0.65rem" }}>
            Driver Profile
          </Typography>
          <IconButton onClick={onClose} size="small" sx={{ color: "rgba(255,255,255,0.4)", "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.08)" } }}>
            <Close />
          </IconButton>
        </Stack>

        {/* Driver identity */}
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} gap={2.5} sx={{ px: 3, pt: 2, pb: 2.5 }}>
          {isLoading ? (
            <Skeleton variant="circular" width={72} height={72} sx={{ bgcolor: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
          ) : (
            <Box sx={{ position: "relative", flexShrink: 0 }}>
              <Avatar
                src={driver ? (getDriverPhotoUrl(driver.documents) ?? undefined) : undefined}
                sx={{
                  width: 72, height: 72, fontSize: "1.8rem", fontWeight: 800,
                  background: "linear-gradient(135deg, #667eea, #764ba2)",
                  boxShadow: "0 4px 20px rgba(102,126,234,0.4)",
                  border: driver && getDriverPhotoUrl(driver.documents) ? "3px solid #667eea" : "none",
                }}
              >
                {driver?.full_name?.charAt(0) ?? "D"}
              </Avatar>
              {driver && getDriverPhotoUrl(driver.documents) && (
                <Box sx={{
                  position: "absolute", bottom: -2, right: -2,
                  width: 20, height: 20, borderRadius: "50%",
                  bgcolor: "#10b981", border: "2px solid #0f0f1a",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <CheckCircle sx={{ fontSize: 12, color: "#fff" }} />
                </Box>
              )}
            </Box>
          )}

          <Box sx={{ flex: 1, minWidth: 0 }}>
            {isLoading ? (
              <>
                <Skeleton width={220} height={32} sx={{ bgcolor: "rgba(255,255,255,0.08)" }} />
                <Skeleton width={140} height={20} sx={{ bgcolor: "rgba(255,255,255,0.06)", mt: 0.5 }} />
              </>
            ) : (
              <>
                <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.2 }}>{driver?.full_name}</Typography>
                <Stack direction="row" alignItems="center" gap={1.5} sx={{ mt: 0.5, flexWrap: "wrap" }}>
                  <Typography variant="body2" fontFamily="monospace" sx={{ color: "rgba(255,255,255,0.4)", bgcolor: "rgba(255,255,255,0.06)", px: 1.2, py: 0.25, borderRadius: 1 }}>
                    {driver?.driver_code ?? "—"}
                  </Typography>
                  {driver && <StatusChip status={driver.status} />}
                  {driver?.mobile_number && (
                    <Stack direction="row" alignItems="center" gap={0.5}>
                      <Phone sx={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }} />
                      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)" }}>{driver.mobile_number}</Typography>
                    </Stack>
                  )}
                </Stack>
              </>
            )}
          </Box>

          {/* Stats */}
          {driver && (
            <Stack direction="row" gap={2} sx={{ flexShrink: 0 }}>
              {[
                { label: "Trips", value: driver.completed_trips ?? 0, color: "#667eea" },
                { label: "Rating", value: driver.average_rating ? `${driver.average_rating.toFixed(1)} ★` : "—", color: "#f59e0b" },
                { label: "Docs", value: `${docsCompleted}/${docsTotal}`, color: docsCompleted === docsTotal ? "#10b981" : "#f59e0b" },
              ].map(({ label, value, color }) => (
                <Paper key={label} sx={{
                  px: 2, py: 1.25, textAlign: "center",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 2.5, minWidth: 64,
                }}>
                  <Typography variant="h6" fontWeight={800} sx={{ color, lineHeight: 1 }}>{value}</Typography>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.35)" }}>{label}</Typography>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>

        {/* Action buttons row */}
        {driver && getActions(driver.status).length > 0 && (
          <Stack direction="row" gap={1} sx={{ px: 3, pb: 1.5, flexWrap: "wrap" }}>
            {getActions(driver.status).map(action => (
              <Button key={action.key} variant="contained" size="small" color={action.color}
                onClick={() => setConfirmAction(action)}
                sx={{ fontWeight: 700, borderRadius: 2, textTransform: "none", fontSize: "0.8rem" }}>
                {action.label}
              </Button>
            ))}
          </Stack>
        )}

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            px: 2,
            "& .MuiTab-root": { color: "rgba(255,255,255,0.45)", fontWeight: 600, textTransform: "none", fontSize: "0.85rem" },
            "& .Mui-selected": { color: "#fff" },
            "& .MuiTabs-indicator": { background: "linear-gradient(90deg, #667eea, #764ba2)", height: 3, borderRadius: 2 },
          }}
        >
          <Tab label="Profile" />
          <Tab label={
            <Stack direction="row" alignItems="center" gap={0.75}>
              Documents
              <Chip
                size="small"
                label={driver?.documents?.length ?? 0}
                sx={{ height: 18, fontSize: "0.62rem", bgcolor: "rgba(102,126,234,0.3)", color: "#a5b4fc", fontWeight: 700 }}
              />
            </Stack>
          } />
        </Tabs>
      </Box>

      {/* ── Scrollable Content ── */}
      <Box sx={{ flex: 1, overflow: "auto", p: 3 }}>
        {isLoading ? (
          <Stack gap={1.5}>
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} height={44} sx={{ bgcolor: "rgba(255,255,255,0.05)", borderRadius: 1.5 }} />
            ))}
          </Stack>
        ) : driver ? (
          <>
            {/* ── Profile Tab ── */}
            {activeTab === 0 && (
              <Grid container spacing={2.5}>

                {/* ── Driver Photo Card ── */}
                <Grid item xs={12}>
                  {(() => {
                    const photoUrl = getDriverPhotoUrl(driver.documents);
                    const photoDoc = driver.documents.find(d => d.document_type === "PHOTO");
                    return (
                      <Paper sx={{
                        p: 2.5, borderRadius: 2.5,
                        background: photoUrl
                          ? "linear-gradient(135deg, rgba(102,126,234,0.08), rgba(118,75,162,0.06))"
                          : "rgba(255,255,255,0.02)",
                        border: photoUrl
                          ? "1px solid rgba(102,126,234,0.25)"
                          : "1px dashed rgba(255,255,255,0.1)",
                        transition: "all 0.3s",
                      }}>
                        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
                          <Person sx={{ color: "#667eea", fontSize: 17 }} />
                          <Typography variant="subtitle2" fontWeight={700} sx={{
                            color: "#667eea", fontSize: "0.68rem", letterSpacing: 1, textTransform: "uppercase",
                          }}>
                            Driver Photo
                          </Typography>
                          {photoDoc && (
                            <Chip
                              label={photoDoc.verification_status ?? "PENDING"}
                              size="small"
                              color={
                                photoDoc.verification_status === "APPROVED" ? "success" :
                                photoDoc.verification_status === "REJECTED" ? "error" : "warning"
                              }
                              sx={{ ml: "auto", height: 20, fontSize: "0.65rem", fontWeight: 700 }}
                            />
                          )}
                        </Stack>

                        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} gap={3}>
                          {/* Photo display */}
                          <Box sx={{ flexShrink: 0 }}>
                            {photoUrl ? (
                              <Box
                                component="img"
                                src={photoUrl}
                                alt={`${driver.full_name} profile photo`}
                                sx={{
                                  width: 120, height: 140,
                                  objectFit: "cover",
                                  borderRadius: 2.5,
                                  border: "3px solid rgba(102,126,234,0.4)",
                                  boxShadow: "0 8px 32px rgba(102,126,234,0.25)",
                                  cursor: "pointer",
                                  transition: "transform 0.2s, box-shadow 0.2s",
                                  "&:hover": {
                                    transform: "scale(1.04)",
                                    boxShadow: "0 12px 40px rgba(102,126,234,0.4)",
                                  },
                                }}
                                onClick={() => window.open(photoUrl, "_blank")}
                              />
                            ) : (
                              <Box sx={{
                                width: 120, height: 140,
                                borderRadius: 2.5,
                                background: "rgba(255,255,255,0.04)",
                                border: "2px dashed rgba(255,255,255,0.12)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 1,
                              }}>
                                <Person sx={{ fontSize: 40, color: "rgba(255,255,255,0.12)" }} />
                                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.2)", textAlign: "center", px: 1 }}>
                                  No photo uploaded
                                </Typography>
                              </Box>
                            )}
                          </Box>

                          {/* Photo info & actions */}
                          <Stack gap={1.5} sx={{ flex: 1 }}>
                            {photoUrl ? (
                              <>
                                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
                                  {driver.full_name}
                                </Typography>
                                {photoDoc && (
                                  <Stack gap={0.75}>
                                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.35)" }}>
                                      Uploaded: {new Date(photoDoc.uploaded_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                    </Typography>
                                    {photoDoc.verification_status === "APPROVED" && (
                                      <Stack direction="row" alignItems="center" gap={0.75} sx={{ color: "success.main" }}>
                                        <CheckCircle sx={{ fontSize: 14 }} />
                                        <Typography variant="caption" color="success.main" fontWeight={600}>Photo Verified</Typography>
                                      </Stack>
                                    )}
                                  </Stack>
                                )}
                                <Stack direction="row" gap={1} sx={{ mt: 0.5 }}>
                                  <Button
                                    size="small" variant="outlined"
                                    onClick={() => window.open(photoUrl, "_blank")}
                                    startIcon={<Visibility sx={{ fontSize: 14 }} />}
                                    sx={{ fontSize: "0.72rem", textTransform: "none", borderColor: "rgba(102,126,234,0.4)", color: "#a5b4fc",
                                          "&:hover": { borderColor: "#667eea", bgcolor: "rgba(102,126,234,0.1)" } }}
                                  >
                                    View Full
                                  </Button>
                                  <Button
                                    size="small" variant="outlined"
                                    onClick={() => setDocUploadOpen(true)}
                                    startIcon={<CloudUpload sx={{ fontSize: 14 }} />}
                                    sx={{ fontSize: "0.72rem", textTransform: "none", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)",
                                          "&:hover": { borderColor: "rgba(255,255,255,0.3)", bgcolor: "rgba(255,255,255,0.05)" } }}
                                  >
                                    Replace
                                  </Button>
                                </Stack>
                              </>
                            ) : (
                              <>
                                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.4)" }}>
                                  No profile photo has been uploaded yet for this driver.
                                </Typography>
                                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.25)" }}>
                                  Upload a clear passport-style photo. It will be visible in the admin dashboard and driver records.
                                </Typography>
                                <Button
                                  size="small" variant="contained"
                                  startIcon={<CloudUpload sx={{ fontSize: 15 }} />}
                                  onClick={() => setDocUploadOpen(true)}
                                  sx={{
                                    mt: 0.5, alignSelf: "flex-start",
                                    background: "linear-gradient(135deg, #667eea, #764ba2)",
                                    fontWeight: 700, textTransform: "none", fontSize: "0.8rem",
                                    borderRadius: 2, px: 2,
                                  }}
                                >
                                  Upload Photo
                                </Button>
                              </>
                            )}
                          </Stack>
                        </Stack>
                      </Paper>
                    );
                  })()}
                </Grid>

                <Grid item xs={12} md={6}>
                  {/* Personal Info */}
                  <Paper sx={{ p: 2.5, borderRadius: 2.5, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", height: "100%" }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: "rgba(255,255,255,0.4)", mb: 2, letterSpacing: 1, textTransform: "uppercase", fontSize: "0.68rem" }}>
                      Personal Information
                    </Typography>
                    <Stack gap={1.75}>
                      {[
                        { icon: <Person sx={{ fontSize: 15 }} />, label: "Full Name",    value: driver.full_name },
                        { icon: <Phone sx={{ fontSize: 15 }} />,  label: "Mobile",       value: driver.mobile_number ?? "—" },
                        { icon: <Email sx={{ fontSize: 15 }} />,  label: "Email",        value: driver.email ?? "—" },
                        { icon: <CalendarToday sx={{ fontSize: 15 }} />, label: "Date of Birth", value: driver.date_of_birth ?? "—" },
                        { icon: <CalendarToday sx={{ fontSize: 15 }} />, label: "Joining Date",   value: driver.joining_date ?? "—" },
                      ].map(({ icon, label, value }) => (
                        <Stack key={label} direction="row" alignItems="center" gap={1.5}>
                          <Box sx={{ color: "rgba(255,255,255,0.25)", width: 20, flexShrink: 0 }}>{icon}</Box>
                          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.35)", width: 110, flexShrink: 0 }}>{label}</Typography>
                          <Typography variant="body2" fontWeight={600} sx={{ color: "#fff" }}>{value}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  {/* License */}
                  <Paper sx={{ p: 2.5, borderRadius: 2.5, background: "rgba(102,126,234,0.06)", border: "1px solid rgba(102,126,234,0.2)", mb: 2 }}>
                    <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
                      <DriveEta sx={{ color: "#667eea", fontSize: 18 }} />
                      <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#667eea", fontSize: "0.68rem", letterSpacing: 1, textTransform: "uppercase" }}>
                        Driving License
                      </Typography>
                    </Stack>
                    <Stack gap={1.5}>
                      <Stack direction="row" alignItems="center" gap={1.5}>
                        <Numbers sx={{ fontSize: 15, color: "rgba(255,255,255,0.25)" }} />
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.35)", width: 110 }}>License Number</Typography>
                        <Typography variant="body2" fontWeight={700} fontFamily="monospace" sx={{ color: "#a5b4fc", letterSpacing: 1 }}>
                          {driver.license_number ?? "—"}
                        </Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" gap={1.5}>
                        <CalendarToday sx={{ fontSize: 15, color: "rgba(255,255,255,0.25)" }} />
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.35)", width: 110 }}>Expiry Date</Typography>
                        <Typography variant="body2" fontWeight={600} sx={{ color: "#fff" }}>
                          {driver.license_expiry_date ?? "—"}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Paper>

                  {/* Partner & Timeline */}
                  <Paper sx={{ p: 2.5, borderRadius: 2.5, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: "rgba(255,255,255,0.4)", mb: 2, letterSpacing: 1, textTransform: "uppercase", fontSize: "0.68rem" }}>
                      Account Info
                    </Typography>
                    <Stack gap={1.25}>
                      {[
                        ["Partner ID", `#${driver.partner_id}`],
                        ["Availability", driver.availability_status ?? "Unknown"],
                        ["Registered", new Date(driver.created_at).toLocaleString()],
                        ["Approved At", driver.approved_at ? new Date(driver.approved_at).toLocaleString() : "—"],
                      ].map(([k, v]) => (
                        <Stack key={k} direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.35)" }}>{k}</Typography>
                          <Typography variant="caption" fontWeight={600} sx={{ color: "rgba(255,255,255,0.75)" }}>{v}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Paper>
                </Grid>
              </Grid>
            )}

            {/* ── Documents Tab ── */}
            {activeTab === 1 && (
              <Stack gap={2.5}>
                {/* Header + Upload button */}
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>Driver Documents</Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.35)" }}>
                      {docsCompleted} of {docsTotal} required documents verified
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<CloudUpload sx={{ fontSize: 16 }} />}
                    onClick={() => setDocUploadOpen(true)}
                    sx={{ background: "linear-gradient(135deg, #667eea, #764ba2)", fontWeight: 700, textTransform: "none", borderRadius: 2, px: 2 }}
                  >
                    Upload Document
                  </Button>
                </Stack>

                {/* Docs checklist progress banner */}
                <Paper sx={{ p: 2, borderRadius: 2.5, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, fontSize: "0.65rem" }}>
                      Verification Checklist
                    </Typography>
                    <Typography variant="caption" fontWeight={700} sx={{ color: docsCompleted === docsTotal ? "success.light" : "rgba(255,255,255,0.5)" }}>
                      {docsCompleted}/{docsTotal}
                    </Typography>
                  </Stack>
                  <Grid container spacing={1}>
                    {Object.entries(DOC_META).map(([k, v]) => {
                      const uploaded = driver.documents.find(d => d.document_type === k);
                      const verified = uploaded?.verification_status === "APPROVED";
                      const rejected = uploaded?.verification_status === "REJECTED";
                      return (
                        <Grid item xs={12} sm={6} key={k}>
                          <Stack direction="row" alignItems="center" gap={1}>
                            {verified
                              ? <CheckCircle sx={{ fontSize: 15, color: "success.main" }} />
                              : rejected
                              ? <Cancel sx={{ fontSize: 15, color: "error.main" }} />
                              : uploaded
                              ? <HourglassTop sx={{ fontSize: 15, color: "warning.main" }} />
                              : <ErrorOutline sx={{ fontSize: 15, color: "rgba(255,255,255,0.15)" }} />}
                            <Typography variant="caption" sx={{
                              color: verified ? "success.light" : rejected ? "error.light" : uploaded ? "warning.light" : "rgba(255,255,255,0.25)",
                            }}>
                              {v.label}
                            </Typography>
                          </Stack>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Paper>

                {/* Empty state */}
                {driver.documents.length === 0 && (
                  <Paper sx={{ p: 5, textAlign: "center", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 2.5 }}>
                    <FolderOpen sx={{ fontSize: 52, color: "rgba(255,255,255,0.1)", mb: 1.5 }} />
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.25)" }}>No documents uploaded yet</Typography>
                    <Button size="small" variant="outlined" startIcon={<CloudUpload />} onClick={() => setDocUploadOpen(true)}
                      sx={{ mt: 2, borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)", textTransform: "none" }}>
                      Upload First Document
                    </Button>
                  </Paper>
                )}

                {/* Document cards */}
                <Stack gap={1.5}>
                  {driver.documents.map(doc => {
                    const meta = DOC_META[doc.document_type] ?? { label: doc.document_type, icon: <Description />, hasRegisteredNumber: false };
                    const verifyMeta = DOC_VERIFY_META[doc.verification_status ?? "PENDING"] ?? { label: "Pending", color: "warning" as const };

                    // Determine the reference number to show on the card
                    const showLicenseOnCard = doc.document_type === "DRIVING_LICENSE" && driver.license_number;

                    return (
                      <Paper key={doc.id} sx={{
                        p: 2.5, borderRadius: 2.5,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid",
                        borderColor: doc.verification_status === "APPROVED"
                          ? "rgba(16,185,129,0.25)"
                          : doc.verification_status === "REJECTED"
                          ? "rgba(239,68,68,0.2)"
                          : "rgba(255,255,255,0.07)",
                        transition: "border-color 0.2s",
                        "&:hover": { borderColor: "rgba(102,126,234,0.3)" },
                      }}>
                        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.5}>
                          <Stack direction="row" alignItems="flex-start" gap={2} flex={1} minWidth={0}>
                            {/* Doc icon badge */}
                            <Box sx={{
                              width: 40, height: 40, borderRadius: 2, flexShrink: 0,
                              background: doc.verification_status === "APPROVED"
                                ? "rgba(16,185,129,0.15)"
                                : "rgba(102,126,234,0.12)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              color: doc.verification_status === "APPROVED" ? "success.light" : "#667eea",
                            }}>
                              {meta.icon}
                            </Box>

                            <Box flex={1} minWidth={0}>
                              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                                <Typography variant="body2" fontWeight={700}>{meta.label}</Typography>
                                <Chip
                                  label={verifyMeta.label}
                                  size="small"
                                  color={verifyMeta.color}
                                  sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }}
                                />
                              </Stack>

                              {/* Show registered number from driver record */}
                              {showLicenseOnCard && (
                                <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 0.75 }}>
                                  <Numbers sx={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }} />
                                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.3)" }}>License No:</Typography>
                                  <Typography variant="caption" fontWeight={700} fontFamily="monospace" sx={{ color: "#a5b4fc" }}>
                                    {driver.license_number}
                                  </Typography>
                                </Stack>
                              )}

                              <Stack direction="row" alignItems="center" gap={1.5} sx={{ mt: 0.5, flexWrap: "wrap" }}>
                                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.25)" }}>
                                  Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                                </Typography>
                                {doc.expiry_date && (
                                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.25)" }}>
                                    · Expires {doc.expiry_date}
                                  </Typography>
                                )}
                              </Stack>

                              {doc.remarks && (
                                <Typography variant="caption" sx={{ color: "rgba(239,68,68,0.7)", display: "block", mt: 0.5 }}>
                                  Remark: {doc.remarks}
                                </Typography>
                              )}
                            </Box>
                          </Stack>

                          {/* View button */}
                          <Tooltip title="View Document">
                            <IconButton
                              size="small"
                              onClick={() => window.open(doc.file_url, "_blank")}
                              sx={{ color: "rgba(255,255,255,0.35)", flexShrink: 0, "&:hover": { color: "#667eea", bgcolor: "rgba(102,126,234,0.1)" } }}
                            >
                              <OpenInNew fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>

                        {/* Approve / Reject actions */}
                        {doc.verification_status !== "APPROVED" && (
                          <Stack direction="row" gap={1} sx={{ mt: 2, pt: 1.5, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                            <Button
                              size="small" variant="outlined" color="success"
                              onClick={() => verifyDocMut.mutate({ docId: doc.id, status: "APPROVED" })}
                              disabled={verifyDocMut.isPending}
                              startIcon={<CheckCircle sx={{ fontSize: 14 }} />}
                              sx={{ textTransform: "none", borderRadius: 1.5, fontSize: "0.78rem" }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="small" variant="outlined" color="error"
                              onClick={() => verifyDocMut.mutate({ docId: doc.id, status: "REJECTED" })}
                              disabled={verifyDocMut.isPending}
                              startIcon={<Cancel sx={{ fontSize: 14 }} />}
                              sx={{ textTransform: "none", borderRadius: 1.5, fontSize: "0.78rem" }}
                            >
                              Reject
                            </Button>
                          </Stack>
                        )}

                        {doc.verification_status === "APPROVED" && (
                          <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                            <CheckCircleOutline sx={{ fontSize: 14, color: "success.main" }} />
                            <Typography variant="caption" color="success.main" fontWeight={600}>Document Verified</Typography>
                          </Stack>
                        )}
                      </Paper>
                    );
                  })}
                </Stack>
              </Stack>
            )}
          </>
        ) : null}
      </Box>

      {/* ── Confirm Action Dialog ── */}
      {confirmAction && (
        <Dialog open onClose={() => setConfirmAction(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle fontWeight={700}>{confirmAction.label}</DialogTitle>
          <DialogContent>
            <Stack gap={2}>
              <Typography variant="body2" color="text.secondary">
                Are you sure you want to <strong>{confirmAction.label.toLowerCase()}</strong> this driver?
              </Typography>
              <TextField fullWidth multiline rows={2} label="Reason (optional)" value={actionReason}
                onChange={e => setActionReason(e.target.value)} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button variant="outlined" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button variant="contained"
              color={confirmAction.key === "approve" ? "success" : confirmAction.key === "suspend" ? "warning" : "error"}
              onClick={() => actionMut.mutate({ action: confirmAction.key })}
              disabled={actionMut.isPending}
              startIcon={actionMut.isPending ? <CircularProgress size={16} /> : undefined}>
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* ── Doc Upload ── */}
      {docUploadOpen && driver && (
        <DocUploadDialog open driver={driver} onClose={() => setDocUploadOpen(false)} />
      )}
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DriversPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const params = useMemo(() => ({
    ...(statusFilter ? { status: statusFilter } : {}),
    page: page + 1,
    page_size: pageSize,
  }), [statusFilter, page, pageSize]);

  const { data, isLoading, isFetching, refetch } = useDrivers(params);

  const filtered = useMemo(() => {
    if (!data?.items) return [];
    if (!search.trim()) return data.items;
    const q = search.toLowerCase();
    return data.items.filter(d =>
      d.full_name?.toLowerCase().includes(q) ||
      d.mobile_number?.includes(q) ||
      d.driver_code?.toLowerCase().includes(q) ||
      d.license_number?.toLowerCase().includes(q)
    );
  }, [data, search]);

  const counts = useMemo(() => {
    const items = data?.items ?? [];
    return {
      total: data?.total ?? 0,
      active: items.filter(d => d.status === "ACTIVE").length,
      pending: items.filter(d => ["PENDING", "UNDER_REVIEW"].includes(d.status)).length,
      suspended: items.filter(d => d.status === "SUSPENDED").length,
    };
  }, [data]);

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: -0.5 }}>Driver Management</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Register, verify, and manage partner drivers across the platform
            </Typography>
          </Box>
          <Stack direction="row" gap={1}>
            <Tooltip title="Refresh">
              <IconButton onClick={() => refetch()} disabled={isFetching}
                sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                <Refresh sx={{ fontSize: 18, animation: isFetching ? "spin 1s linear infinite" : "none", "@keyframes spin": { "100%": { transform: "rotate(360deg)" } } }} />
              </IconButton>
            </Tooltip>
            <Button variant="contained" startIcon={<Add />} onClick={() => setAddOpen(true)}
              sx={{ background: "linear-gradient(135deg, #667eea, #764ba2)", fontWeight: 700, borderRadius: 2, textTransform: "none", px: 2.5 }}>
              Add Driver
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* KPI Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: "Total Drivers", value: counts.total, color: "#667eea", icon: <DriveEta /> },
          { label: "Active",        value: counts.active,    color: "#11998e", icon: <PlayArrow /> },
          { label: "Pending Review",value: counts.pending,   color: "#f09819", icon: <PendingActions /> },
          { label: "Suspended",     value: counts.suspended, color: "#e53e3e", icon: <Block /> },
        ].map(({ label, value, color, icon }) => (
          <Grid item xs={6} sm={3} key={label}>
            <Card sx={{ borderRadius: 3, background: "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.06)", transition: "transform 0.2s", "&:hover": { transform: "translateY(-2px)" } }}>
              <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4" fontWeight={800} sx={{ color }}>{isLoading ? "—" : value}</Typography>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>{label}</Typography>
                  </Box>
                  <Box sx={{ width: 42, height: 42, borderRadius: 2, background: `${color}20`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
                    {icon}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 2.5, borderRadius: 3 }}>
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} gap={2} alignItems="center">
            <TextField
              placeholder="Search name, mobile, code, license…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              size="small"
              sx={{ minWidth: 280 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: "text.disabled" }} /></InputAdornment>,
              }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Status Filter</InputLabel>
              <Select value={statusFilter} label="Status Filter" onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
                startAdornment={<FilterList sx={{ fontSize: 16, mr: 0.5, color: "text.disabled" }} />}>
                <MenuItem value=""><em>All Statuses</em></MenuItem>
                {DRIVER_STATUSES.map(s => <MenuItem key={s} value={s}>{STATUS_META[s]?.label ?? s}</MenuItem>)}
              </Select>
            </FormControl>
            {(statusFilter || search) && (
              <Button size="small" onClick={() => { setStatusFilter(""); setSearch(""); }} variant="outlined" color="inherit"
                sx={{ textTransform: "none" }}>
                Clear Filters
              </Button>
            )}
            <Box sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {filtered.length} of {data?.total ?? 0} drivers
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Table */}
      <Card sx={{ borderRadius: 3 }}>
        {isFetching && <LinearProgress />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.75rem", letterSpacing: 0.5, textTransform: "uppercase", color: "text.secondary", whiteSpace: "nowrap" } }}>
                <TableCell>Driver</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>License</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Registered</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(7)].map((_, j) => (
                      <TableCell key={j}><Skeleton height={32} /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Box sx={{ py: 8, textAlign: "center" }}>
                      <DriveEta sx={{ fontSize: 52, color: "text.disabled", mb: 1.5 }} />
                      <Typography variant="h6" color="text.secondary" fontWeight={600}>No Drivers Found</Typography>
                      <Typography variant="body2" color="text.disabled" sx={{ mb: 2.5 }}>
                        {search || statusFilter ? "Try adjusting your filters" : "Add the first driver to get started"}
                      </Typography>
                      {!search && !statusFilter && (
                        <Button variant="contained" startIcon={<Add />} onClick={() => setAddOpen(true)}
                          sx={{ background: "linear-gradient(135deg, #667eea, #764ba2)", textTransform: "none", fontWeight: 700 }}>
                          Add Driver
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(driver => (
                  <TableRow key={driver.id} hover
                    sx={{ cursor: "pointer", "&:hover": { bgcolor: "rgba(102,126,234,0.04)" } }}
                    onClick={() => setSelectedId(driver.id)}>
                    <TableCell>
                      <Stack direction="row" alignItems="center" gap={1.5}>
                        <Avatar sx={{ width: 34, height: 34, fontSize: "0.85rem", background: "linear-gradient(135deg, #667eea, #764ba2)", fontWeight: 700 }}>
                          {driver.full_name?.charAt(0) ?? "D"}
                        </Avatar>
                        <Typography variant="body2" fontWeight={600}>{driver.full_name ?? "—"}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" fontFamily="monospace" sx={{ bgcolor: "rgba(102,126,234,0.1)", px: 1, py: 0.4, borderRadius: 1, fontWeight: 700 }}>
                        {driver.driver_code ?? "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>{driver.mobile_number ?? "—"}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" fontFamily="monospace">{driver.license_number ?? "—"}</Typography>
                    </TableCell>
                    <TableCell><StatusChip status={driver.status} /></TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {new Date(driver.created_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" onClick={e => e.stopPropagation()}>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => setSelectedId(driver.id)}
                          sx={{ color: "text.secondary", "&:hover": { color: "primary.main", bgcolor: "rgba(102,126,234,0.1)" } }}>
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
          count={data?.total ?? 0}
          page={page}
          rowsPerPage={pageSize}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50]}
          sx={{ borderTop: "1px solid", borderColor: "divider" }}
        />
      </Card>

      {/* Add Driver Modal */}
      <AddDriverModal open={addOpen} onClose={() => setAddOpen(false)} />

      {/* Detail Modal (was Drawer) */}
      <DriverDetailModal driverId={selectedId} onClose={() => setSelectedId(null)} />
    </Box>
  );
}
