// ============================================================
// WAYTERO ADMIN — USERS PAGE
// Tabs: Customers | Partners | Staff Management
// API:
//   Customers  → GET /admin/users?role=CUSTOMER
//   Partners   → GET /admin/partners (partnerService.list)
//   Staff      → GET /admin/staff    (staffService.list)
// ============================================================
import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Card, CardContent, TextField, MenuItem,
  Chip, IconButton, Tooltip, Stack, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Avatar, alpha, CircularProgress, Alert, Tab, Tabs,
  Divider, Grid, Paper, LinearProgress, Fade,
} from "@mui/material";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import {
  Search, CheckCircle, Block, Visibility, Refresh,
  Person, FilterList, PersonAdd, Badge as BadgeIcon,
  Work, Home, AccountBalance, PeopleAlt, CreditCard,
  Description, Lock, Print, PhotoCamera, Close,
  CloudUpload, DeleteOutline, OpenInNew, CheckCircleOutline,
  VerifiedUser, Edit, Business, SupervisedUserCircle,
} from "@mui/icons-material";
import { useSnackbar } from "notistack";
import {
  adminService, AdminUser, staffService, StaffUser, StaffProfile,
  StaffDocument, StaffUserCreate,
} from "../../services/admin.service";
import {
  partnerService, AdminPartnerListItem, STATUS_META,
} from "../../services/partner.service";
import { settingsService } from "../../services/settings.service";
import { CACHE_TTL } from "../../constants";

// ── Constants ─────────────────────────────────────────────────
const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "CCO", "VERIFICATION_OFFICER", "FINANCE_MANAGER"];
const GENDER_OPTIONS = ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const EMP_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"];
const BANK_TYPES = ["SAVINGS", "CURRENT"];

const ROLE_META: Record<string, { color: string; label: string }> = {
  SUPER_ADMIN:          { color: "#7C3AED", label: "Super Admin" },
  ADMIN:                { color: "#2563EB", label: "Admin" },
  CCO:                  { color: "#0891B2", label: "CCO" },
  VERIFICATION_OFFICER: { color: "#059669", label: "Verif. Officer" },
  FINANCE_MANAGER:      { color: "#D97706", label: "Finance Mgr" },
  CUSTOMER:             { color: "#0F6FFF", label: "Customer" },
  PARTNER:              { color: "#7C3AED", label: "Partner" },
};

const STATUS_COLOR: Record<string, "success" | "error" | "warning" | "default"> = {
  ACTIVE: "success", SUSPENDED: "error", PENDING: "warning",
  BLOCKED: "error", UNDER_REVIEW: "default", DOCUMENT_PENDING: "warning",
  APPROVED: "success", INACTIVE: "default",
};

const ID_CARD_META: Record<string, { color: string; label: string }> = {
  NOT_GENERATED: { color: "#94A3B8", label: "Not Generated" },
  GENERATED:     { color: "#2563EB", label: "Generated" },
  PRINTED:       { color: "#059669", label: "Printed" },
  REVOKED:       { color: "#DC2626", label: "Revoked" },
};

const PARTNER_TYPE_META: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  INDIVIDUAL: { color: "#0891B2", label: "Individual", icon: <Person sx={{ fontSize: 14 }} /> },
  COMPANY:    { color: "#7C3AED", label: "Company",    icon: <Business sx={{ fontSize: 14 }} /> },
};

// ── Helpers ────────────────────────────────────────────────────
function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return value === index ? <Box sx={{ pt: 0 }}>{children}</Box> : null;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.75, borderBottom: "1px solid", borderColor: "divider" }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ minWidth: 140 }}>{label}</Typography>
      <Typography variant="body2" fontWeight={500} sx={{ textAlign: "right" }}>{value || "—"}</Typography>
    </Box>
  );
}

function SectionHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, pb: 1, borderBottom: "2px solid", borderColor: "primary.main" }}>
      <Box sx={{ color: "primary.main" }}>{icon}</Box>
      <Typography variant="subtitle1" fontWeight={700} color="primary.main">{title}</Typography>
    </Stack>
  );
}

// ── Shared grid styles ─────────────────────────────────────────
const gridSx = {
  border: 0,
  "& .MuiDataGrid-columnHeaders": { bgcolor: "action.hover", fontWeight: 700, fontSize: 12, letterSpacing: "0.04em" },
  "& .MuiDataGrid-cell": { borderColor: "divider" },
  "& .MuiDataGrid-footerContainer": { borderTop: "1px solid", borderColor: "divider" },
};

// ═══════════════════════════════════════════════════════════════
// ID CARD PREVIEW
// ═══════════════════════════════════════════════════════════════
function IdCardPreview({ staff, platformName, platformLogo, scale = 1 }: {
  staff: StaffUser; platformName: string; platformLogo: string; scale?: number;
}) {
  const p = staff.profile;
  return (
    <Box sx={{
      width: 300 * scale, background: "linear-gradient(135deg, #1E3A5F 0%, #0F2040 100%)",
      borderRadius: 2.5, overflow: "hidden", color: "#fff",
      boxShadow: "0 8px 24px rgba(0,0,0,0.2)", flexShrink: 0,
    }}>
      <Box sx={{ bgcolor: "rgba(255,255,255,0.07)", px: 2, py: 1 * scale, display: "flex", alignItems: "center", gap: 1 }}>
        {platformLogo
          ? <Box component="img" src={platformLogo} alt="logo" sx={{ height: 22 * scale, objectFit: "contain" }} />
          : <Typography fontWeight={800} fontSize={14 * scale}>{platformName}</Typography>}
        <Chip label="STAFF ID" size="small" sx={{ ml: "auto", bgcolor: "#F59E0B", color: "#1E3A5F", fontWeight: 800, fontSize: 9 * scale, height: 18 * scale }} />
      </Box>
      <Box sx={{ px: 2, py: 1.5 * scale, display: "flex", gap: 1.5 }}>
        <Avatar src={staff.profile_image_url ?? undefined} sx={{ width: 56 * scale, height: 56 * scale, border: "2px solid rgba(255,255,255,0.25)", flexShrink: 0 }}>
          <Person />
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight={800} fontSize={13 * scale} noWrap>{staff.first_name} {staff.last_name ?? ""}</Typography>
          <Typography fontSize={10 * scale} sx={{ color: "#F59E0B", fontWeight: 600 }}>{ROLE_META[staff.user_type]?.label}</Typography>
          {p?.designation && <Typography fontSize={10 * scale} sx={{ color: "rgba(255,255,255,0.7)" }}>{p.designation}</Typography>}
          {p?.department && <Typography fontSize={9 * scale} sx={{ color: "rgba(255,255,255,0.5)" }}>{p.department}</Typography>}
        </Box>
      </Box>
      <Box sx={{ mx: 2, mb: 1.5, bgcolor: "rgba(255,255,255,0.05)", borderRadius: 1, px: 1.5, py: 0.75 }}>
        {[
          ["Employee ID", p?.employee_id ?? "EMP-XXXXXX"],
          ["Joining Date", p?.joining_date ? new Date(p.joining_date).toLocaleDateString("en-IN") : "—"],
          ["Mobile", staff.mobile_number],
          ["Location", p?.city && p?.state ? `${p.city}, ${p.state}` : p?.city],
        ].filter(([, v]) => v).map(([l, v]) => (
          <Box key={l} sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography fontSize={9 * scale} sx={{ color: "rgba(255,255,255,0.45)" }}>{l}</Typography>
            <Typography fontSize={9 * scale} fontWeight={600}>{v}</Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ bgcolor: "rgba(0,0,0,0.25)", px: 2, py: 0.75 * scale }}>
        <Typography fontSize={9 * scale} sx={{ color: "rgba(255,255,255,0.35)" }}>
          {platformName} • Authorised Staff Card
          {p?.id_card_generated_at ? ` • ${new Date(p.id_card_generated_at).toLocaleDateString("en-IN")}` : ""}
        </Typography>
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════
// STAFF DOCUMENT UPLOADER
// ═══════════════════════════════════════════════════════════════
const DOC_TYPES: { type: string; label: string; accept: string; hint: string }[] = [
  { type: "ID_CARD_FRONT", label: "ID Card (Front)",   accept: "image/*",                    hint: "Govt. issued ID front side" },
  { type: "ID_CARD_BACK",  label: "ID Card (Back)",    accept: "image/*",                    hint: "Govt. issued ID back side" },
  { type: "PAN_CARD",      label: "PAN Card",          accept: "image/*,application/pdf",    hint: "Income Tax PAN card" },
  { type: "AADHAR_CARD",   label: "Aadhaar Card",      accept: "image/*,application/pdf",    hint: "UIDAI Aadhaar (front + back)" },
  { type: "DRIVING_LICENSE", label: "Driving License", accept: "image/*,application/pdf",    hint: "Valid DL front side" },
  { type: "OFFER_LETTER",  label: "Offer Letter",      accept: "application/pdf,image/*",    hint: "Signed appointment letter" },
  { type: "OTHER",         label: "Other Document",    accept: "image/*,application/pdf",    hint: "Any other supporting doc" },
];

function StaffDocumentUploader({ staffId, documents, uploading, onUpload }: {
  staffId: string; documents: StaffDocument[]; uploading: string | null;
  onUpload: (file: File, docType: string) => Promise<void>;
}) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const getDoc = (type: string) => documents.find(d => d.document_type === type);
  const isPdf = (url: string) => url.includes(".pdf") || url.includes("/raw/");
  return (
    <Grid container spacing={2}>
      {DOC_TYPES.map(({ type, label, accept, hint }) => {
        const existing = getDoc(type);
        const isLoading = uploading === type;
        return (
          <Grid item xs={12} sm={6} key={type}>
            <input type="file" accept={accept} style={{ display: "none" }}
              ref={el => { inputRefs.current[type] = el; }}
              onChange={async e => { const f = e.target.files?.[0]; if (f) await onUpload(f, type); e.target.value = ""; }}
            />
            <Paper variant="outlined" sx={{
              p: 1.5, borderRadius: 2, height: "100%",
              borderColor: existing ? alpha("#059669", 0.4) : "divider",
              bgcolor: existing ? alpha("#059669", 0.02) : "transparent",
            }}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Box sx={{ width: 52, height: 52, borderRadius: 1.5, overflow: "hidden", bgcolor: "action.hover", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid", borderColor: "divider" }}>
                  {existing
                    ? isPdf(existing.file_url)
                      ? <Description sx={{ color: "#DC2626", fontSize: 28 }} />
                      : <Box component="img" src={existing.file_url} alt={label} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <CloudUpload sx={{ color: "text.disabled", fontSize: 22 }} />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.25 }}>
                    <Typography fontWeight={700} fontSize={12} noWrap>{label}</Typography>
                    {existing && <CheckCircleOutline sx={{ color: "#059669", fontSize: 14 }} />}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75, lineHeight: 1.3 }}>{hint}</Typography>
                  <Stack direction="row" spacing={0.75}>
                    <Button size="small" variant={existing ? "outlined" : "contained"}
                      startIcon={isLoading ? <CircularProgress size={12} color="inherit" /> : <CloudUpload sx={{ fontSize: 14 }} />}
                      onClick={() => inputRefs.current[type]?.click()} disabled={isLoading}
                      sx={{ fontSize: 11, py: 0.4, px: 1, minWidth: 0 }}>
                      {isLoading ? "Uploading…" : existing ? "Replace" : "Upload"}
                    </Button>
                    {existing && (
                      <Tooltip title="View document">
                        <IconButton size="small" onClick={() => window.open(existing.file_url, "_blank")} sx={{ p: 0.4 }}>
                          <OpenInNew sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        );
      })}
    </Grid>
  );
}

// ═══════════════════════════════════════════════════════════════
// STAFF FORM MODAL (8-tab)
// ═══════════════════════════════════════════════════════════════
function StaffModal({ open, onClose, editStaff, platformName, platformLogo }: {
  open: boolean; onClose: () => void; editStaff: StaffUser | null;
  platformName: string; platformLogo: string;
}) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const isEdit = !!editStaff;
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [generatingCard, setGeneratingCard] = useState(false);
  const ep = editStaff?.profile;

  const [firstName, setFirstName] = useState(editStaff?.first_name ?? "");
  const [lastName, setLastName] = useState(editStaff?.last_name ?? "");
  const [email, setEmail] = useState(editStaff?.email ?? "");
  const [mobile, setMobile] = useState(editStaff?.mobile_number ?? "");
  const [userType, setUserType] = useState(editStaff?.user_type ?? "ADMIN");
  const [password, setPassword] = useState("");
  const [photoUrl, setPhotoUrl] = useState(editStaff?.profile_image_url ?? "");
  const [dob, setDob] = useState(ep?.date_of_birth ?? "");
  const [gender, setGender] = useState(ep?.gender ?? "");
  const [bloodGroup, setBloodGroup] = useState(ep?.blood_group ?? "");
  const [personalEmail, setPersonalEmail] = useState(ep?.personal_email ?? "");
  const [emergencyName, setEmergencyName] = useState(ep?.emergency_contact_name ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState(ep?.emergency_contact_phone ?? "");
  const [designation, setDesignation] = useState(ep?.designation ?? "");
  const [department, setDepartment] = useState(ep?.department ?? "");
  const [empType, setEmpType] = useState(ep?.employment_type ?? "FULL_TIME");
  const [joiningDate, setJoiningDate] = useState(ep?.joining_date ?? "");
  const [addr1, setAddr1] = useState(ep?.address_line1 ?? "");
  const [addr2, setAddr2] = useState(ep?.address_line2 ?? "");
  const [city, setCity] = useState(ep?.city ?? "");
  const [stateName, setStateName] = useState(ep?.state ?? "");
  const [pincode, setPincode] = useState(ep?.pincode ?? "");
  const [country, setCountry] = useState(ep?.country ?? "India");
  const [panNumber, setPanNumber] = useState(ep?.pan_number ?? "");
  const [aadharNumber, setAadharNumber] = useState(ep?.aadhar_number ?? "");
  const [dlNumber, setDlNumber] = useState(ep?.driving_license_number ?? "");
  const [bankName, setBankName] = useState(ep?.bank_name ?? "");
  const [bankAccount, setBankAccount] = useState(ep?.bank_account_number ?? "");
  const [bankIfsc, setBankIfsc] = useState(ep?.bank_ifsc_code ?? "");
  const [bankBranch, setBankBranch] = useState(ep?.bank_branch ?? "");
  const [bankType, setBankType] = useState(ep?.bank_account_type ?? "SAVINGS");
  const [nomineeName, setNomineeName] = useState(ep?.nominee_name ?? "");
  const [nomineeRelation, setNomineeRelation] = useState(ep?.nominee_relation ?? "");
  const [nomineePhone, setNomineePhone] = useState(ep?.nominee_phone ?? "");
  const [nomineeAddress, setNomineeAddress] = useState(ep?.nominee_address ?? "");
  const [idCardNotes, setIdCardNotes] = useState(ep?.id_card_notes ?? "");
  const [resetPwd, setResetPwd] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const buildProfile = (): Partial<StaffProfile> => ({
    date_of_birth: dob || undefined, gender: gender || undefined, blood_group: bloodGroup || undefined,
    personal_email: personalEmail || undefined, emergency_contact_name: emergencyName || undefined,
    emergency_contact_phone: emergencyPhone || undefined, designation: designation || undefined,
    department: department || undefined, employment_type: empType || undefined, joining_date: joiningDate || undefined,
    address_line1: addr1 || undefined, address_line2: addr2 || undefined, city: city || undefined,
    state: stateName || undefined, pincode: pincode || undefined, country: country || undefined,
    pan_number: panNumber || undefined, aadhar_number: aadharNumber || undefined,
    driving_license_number: dlNumber || undefined, bank_name: bankName || undefined,
    bank_account_number: bankAccount || undefined, bank_ifsc_code: bankIfsc || undefined,
    bank_branch: bankBranch || undefined, bank_account_type: bankType || undefined,
    nominee_name: nomineeName || undefined, nominee_relation: nomineeRelation || undefined,
    nominee_phone: nomineePhone || undefined, nominee_address: nomineeAddress || undefined,
    id_card_notes: idCardNotes || undefined,
  });

  const handleSave = async () => {
    if (!firstName || !email || !mobile || !userType) {
      enqueueSnackbar("Fill required fields in Basic Info tab", { variant: "warning" }); setTab(0); return;
    }
    if (!isEdit && !password) {
      enqueueSnackbar("Password is required for new staff", { variant: "warning" }); setTab(0); return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await staffService.update(editStaff.id, {
          first_name: firstName, last_name: lastName || undefined,
          email, mobile_number: mobile, user_type: userType,
          profile_image_url: photoUrl || undefined, profile: buildProfile(),
        });
        enqueueSnackbar("Staff member updated", { variant: "success" });
      } else {
        await staffService.create({
          first_name: firstName, last_name: lastName || undefined,
          email, mobile_number: mobile, password, user_type: userType,
          profile_image_url: photoUrl || undefined, profile: buildProfile(),
        } as StaffUserCreate);
        enqueueSnackbar("Staff member created", { variant: "success" });
      }
      qc.invalidateQueries({ queryKey: ["admin-staff"] });
      onClose();
    } catch (err: any) {
      enqueueSnackbar(err?.response?.data?.detail ?? "Failed to save", { variant: "error" });
    } finally { setSaving(false); }
  };

  const handleGenerateIdCard = async () => {
    if (!editStaff) return;
    setGeneratingCard(true);
    try {
      await staffService.generateIdCard(editStaff.id, idCardNotes || undefined);
      qc.invalidateQueries({ queryKey: ["admin-staff"] });
      enqueueSnackbar("ID Card generated — printing now", { variant: "success" });
      setTimeout(() => window.print(), 600);
    } catch { enqueueSnackbar("Failed to generate ID card", { variant: "error" }); }
    finally { setGeneratingCard(false); }
  };

  const handleResetPassword = async () => {
    if (!editStaff || !resetPwd) return;
    try {
      await staffService.resetPassword(editStaff.id, resetPwd);
      enqueueSnackbar("Password reset successfully", { variant: "success" }); setResetPwd("");
    } catch { enqueueSnackbar("Failed to reset password", { variant: "error" }); }
  };

  const TABS = [
    { icon: <Person />, label: "Basic Info" }, { icon: <PeopleAlt />, label: "Personal" },
    { icon: <Work />, label: "Employment" }, { icon: <Home />, label: "Address" },
    { icon: <Description />, label: "Documents" }, { icon: <AccountBalance />, label: "Bank Details" },
    { icon: <PeopleAlt />, label: "Nominee" }, { icon: <BadgeIcon />, label: "ID Card" },
  ];

  const F = { size: "small" as const, fullWidth: true };
  const idStatus = editStaff?.profile?.id_card_status ?? "NOT_GENERATED";
  const previewStaff: StaffUser = editStaff ?? {
    id: "", user_code: null, first_name: firstName || "Staff",
    last_name: lastName || "Member", mobile_number: mobile,
    email, user_type: userType, status: "ACTIVE", is_active: true,
    profile_image_url: photoUrl || null, created_at: new Date().toISOString(),
    last_login_at: null,
    profile: {
      designation: designation || null, department: department || null,
      employee_id: "EMP-XXXXXX", joining_date: joiningDate || null,
      city: city || null, state: stateName || null, address_line1: addr1 || null,
      address_line2: addr2 || null, pincode: pincode || null, id_card_status: "NOT_GENERATED",
      id_card_generated_at: null, id_card_notes: null,
    } as StaffProfile,
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { height: "90vh", maxHeight: 840, borderRadius: 3 } }} TransitionComponent={Fade}>
      <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", gap: 2, background: "linear-gradient(135deg, #1E3A5F 0%, #0F2040 100%)", color: "#fff" }}>
        <Avatar src={photoUrl || undefined} sx={{ width: 48, height: 48, bgcolor: alpha("#fff", 0.15), border: "2px solid rgba(255,255,255,0.3)" }}>
          {firstName ? firstName[0].toUpperCase() : <Person />}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography fontWeight={800} fontSize={16}>{isEdit ? `${editStaff.first_name} ${editStaff.last_name ?? ""}` : "Add New Staff Member"}</Typography>
          {isEdit && (
            <Stack direction="row" spacing={0.75} sx={{ mt: 0.3, flexWrap: "wrap", gap: 0.5 }}>
              <Chip label={ROLE_META[editStaff.user_type]?.label ?? editStaff.user_type} size="small" sx={{ bgcolor: alpha("#fff", 0.15), color: "#fff", fontWeight: 700, fontSize: 10, height: 18 }} />
              {editStaff.profile?.employee_id && <Chip label={editStaff.profile.employee_id} size="small" sx={{ bgcolor: alpha("#F59E0B", 0.2), color: "#F59E0B", fontWeight: 700, fontSize: 10, height: 18 }} />}
              <Chip label={ID_CARD_META[idStatus]?.label ?? idStatus} size="small" sx={{ bgcolor: alpha(ID_CARD_META[idStatus]?.color ?? "#94A3B8", 0.2), color: ID_CARD_META[idStatus]?.color ?? "#94A3B8", fontWeight: 600, fontSize: 10, height: 18 }} />
            </Stack>
          )}
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: "rgba(255,255,255,0.7)" }}><Close /></IconButton>
      </Box>
      <Box sx={{ borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ px: 1, "& .MuiTab-root": { minHeight: 44, fontSize: 12, fontWeight: 600, minWidth: 90, py: 1 } }}>
          {TABS.map((t, i) => <Tab key={i} icon={t.icon} iconPosition="start" label={t.label} />)}
        </Tabs>
      </Box>
      <DialogContent sx={{ px: 3, py: 0, overflow: "auto" }}>
        {/* TAB 0 — Basic */}
        <TabPanel value={tab} index={0}>
          <Box sx={{ pt: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}><TextField {...F} label="First Name *" value={firstName} onChange={e => setFirstName(e.target.value)} /></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} label="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} /></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} label="Work Email *" type="email" value={email} onChange={e => setEmail(e.target.value)} /></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} label="Mobile Number *" value={mobile} onChange={e => setMobile(e.target.value)} /></Grid>
            <Grid item xs={12} sm={!isEdit ? 6 : 12}>
              <TextField {...F} select label="Role *" value={userType} onChange={e => setUserType(e.target.value)}>
                {STAFF_ROLES.map(r => (
                  <MenuItem key={r} value={r}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: ROLE_META[r]?.color }} />
                      {ROLE_META[r]?.label ?? r}
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            {!isEdit && <Grid item xs={12} sm={6}><TextField {...F} label="Password *" type="password" value={password} onChange={e => setPassword(e.target.value)} /></Grid>}
            <Grid item xs={12}>
              <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }}
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file || !editStaff?.id) return;
                  setPhotoUploading(true);
                  try { const u = await staffService.uploadPhoto(editStaff.id, file); setPhotoUrl(u.profile_image_url ?? ""); qc.invalidateQueries({ queryKey: ["admin-staff"] }); enqueueSnackbar("Photo uploaded", { variant: "success" }); }
                  catch (err: any) { enqueueSnackbar(err?.response?.data?.detail ?? "Upload failed", { variant: "error" }); }
                  finally { setPhotoUploading(false); e.target.value = ""; }
                }}
              />
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, display: "flex", alignItems: "center", gap: 2 }}>
                <Avatar src={photoUrl || undefined} sx={{ width: 72, height: 72, border: "2px solid", borderColor: "divider" }}>
                  {firstName ? firstName[0].toUpperCase() : <Person />}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={700} fontSize={13} gutterBottom>Profile Photo</Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>JPG / PNG / WebP · Max 5 MB</Typography>
                  {isEdit
                    ? <Button size="small" variant="outlined" startIcon={photoUploading ? <CircularProgress size={14} /> : <CloudUpload fontSize="small" />} onClick={() => photoInputRef.current?.click()} disabled={photoUploading}>{photoUploading ? "Uploading…" : photoUrl ? "Replace Photo" : "Upload Photo"}</Button>
                    : <Alert severity="info" sx={{ py: 0.5, fontSize: 11 }}>Save first, then upload photo.</Alert>}
                </Box>
              </Paper>
            </Grid>
          </Grid>
          </Box>
        </TabPanel>
        {/* TAB 1 — Personal */}
        <TabPanel value={tab} index={1}>
          <Box sx={{ pt: 3 }}>
          <SectionHead icon={<Person />} title="Personal Information" />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}><TextField {...F} label="Date of Birth" type="date" value={dob} onChange={e => setDob(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} select label="Gender" value={gender} onChange={e => setGender(e.target.value)}><MenuItem value="">— Select —</MenuItem>{GENDER_OPTIONS.map(g => <MenuItem key={g} value={g}>{g.replace(/_/g, " ")}</MenuItem>)}</TextField></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} select label="Blood Group" value={bloodGroup} onChange={e => setBloodGroup(e.target.value)}><MenuItem value="">— Select —</MenuItem>{BLOOD_GROUPS.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}</TextField></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} label="Personal Email" type="email" value={personalEmail} onChange={e => setPersonalEmail(e.target.value)} /></Grid>
            <Grid item xs={12}><Divider sx={{ my: 1 }}><Typography variant="caption" color="text.secondary">Emergency Contact</Typography></Divider></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} label="Emergency Contact Name" value={emergencyName} onChange={e => setEmergencyName(e.target.value)} /></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} label="Emergency Contact Phone" value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} /></Grid>
          </Grid>
          </Box>
        </TabPanel>
        {/* TAB 2 — Employment */}
        <TabPanel value={tab} index={2}>
          <Box sx={{ pt: 3 }}>
          <SectionHead icon={<Work />} title="Employment Details" />
          {isEdit && (editStaff.profile?.employee_id
            ? <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: alpha("#2563EB", 0.04), borderColor: alpha("#2563EB", 0.2), borderRadius: 2 }}><Stack direction="row" spacing={1} alignItems="center"><VerifiedUser sx={{ color: "#2563EB", fontSize: 18 }} /><Typography variant="body2" color="primary" fontWeight={700}>Employee ID: {editStaff.profile.employee_id}</Typography><Typography variant="caption" color="text.secondary">(Auto-generated · read-only)</Typography></Stack></Paper>
            : <Alert severity="info" sx={{ mb: 3, fontSize: 12 }}><strong>Employee ID not yet assigned.</strong> Save to auto-generate.</Alert>)}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}><TextField {...F} label="Designation" value={designation} onChange={e => setDesignation(e.target.value)} /></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} label="Department" value={department} onChange={e => setDepartment(e.target.value)} /></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} select label="Employment Type" value={empType} onChange={e => setEmpType(e.target.value)}>{EMP_TYPES.map(t => <MenuItem key={t} value={t}>{t.replace(/_/g, " ")}</MenuItem>)}</TextField></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} label="Joining Date" type="date" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
          </Grid>
          </Box>
        </TabPanel>
        {/* TAB 3 — Address */}
        <TabPanel value={tab} index={3}>
          <Box sx={{ pt: 3 }}>
          <SectionHead icon={<Home />} title="Residential Address" />
          <Grid container spacing={2}>
            <Grid item xs={12}><TextField {...F} label="Address Line 1" value={addr1} onChange={e => setAddr1(e.target.value)} /></Grid>
            <Grid item xs={12}><TextField {...F} label="Address Line 2" value={addr2} onChange={e => setAddr2(e.target.value)} /></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} label="City" value={city} onChange={e => setCity(e.target.value)} /></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} label="State" value={stateName} onChange={e => setStateName(e.target.value)} /></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} label="Pincode" value={pincode} onChange={e => setPincode(e.target.value)} /></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} label="Country" value={country} onChange={e => setCountry(e.target.value)} /></Grid>
          </Grid>
          </Box>
        </TabPanel>
        {/* TAB 4 — Documents */}
        <TabPanel value={tab} index={4}>
          <Box sx={{ pt: 3 }}>
          <SectionHead icon={<Description />} title="Identity Document Numbers" />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}><TextField {...F} label="PAN Number" value={panNumber} onChange={e => setPanNumber(e.target.value.toUpperCase())} /></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} label="Aadhaar Number" value={aadharNumber} onChange={e => setAadharNumber(e.target.value)} /></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} label="Driving License Number" value={dlNumber} onChange={e => setDlNumber(e.target.value)} /></Grid>
          </Grid>
          </Box>
        </TabPanel>
        {/* TAB 5 — Bank */}
        <TabPanel value={tab} index={5}>
          <Box sx={{ pt: 3 }}>
          <SectionHead icon={<AccountBalance />} title="Bank Details" />
          <Alert severity="warning" sx={{ mb: 2, fontSize: 12 }}>Confidential — authorised personnel only.</Alert>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}><TextField {...F} label="Bank Name" value={bankName} onChange={e => setBankName(e.target.value)} /></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} select label="Account Type" value={bankType} onChange={e => setBankType(e.target.value)}>{BANK_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</TextField></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} label="Account Number" value={bankAccount} onChange={e => setBankAccount(e.target.value)} /></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} label="IFSC Code" value={bankIfsc} onChange={e => setBankIfsc(e.target.value.toUpperCase())} /></Grid>
            <Grid item xs={12}><TextField {...F} label="Bank Branch" value={bankBranch} onChange={e => setBankBranch(e.target.value)} /></Grid>
          </Grid>
          </Box>
        </TabPanel>
        {/* TAB 6 — Nominee */}
        <TabPanel value={tab} index={6}>
          <Box sx={{ pt: 3 }}>
          <SectionHead icon={<PeopleAlt />} title="Nominee Information" />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}><TextField {...F} label="Nominee Name" value={nomineeName} onChange={e => setNomineeName(e.target.value)} /></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} label="Relation" value={nomineeRelation} onChange={e => setNomineeRelation(e.target.value)} /></Grid>
            <Grid item xs={12} sm={6}><TextField {...F} label="Nominee Phone" value={nomineePhone} onChange={e => setNomineePhone(e.target.value)} /></Grid>
            <Grid item xs={12}><TextField {...F} label="Nominee Address" value={nomineeAddress} onChange={e => setNomineeAddress(e.target.value)} multiline rows={2} /></Grid>
          </Grid>
          </Box>
        </TabPanel>
        {/* TAB 7 — ID Card */}
        <TabPanel value={tab} index={7}>
          <Box sx={{ pt: 3 }}>
          <SectionHead icon={<BadgeIcon />} title="Staff ID Card" />
          {isEdit && (
            <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2, borderColor: alpha(ID_CARD_META[idStatus]?.color ?? "#94A3B8", 0.4), bgcolor: alpha(ID_CARD_META[idStatus]?.color ?? "#94A3B8", 0.04) }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <CreditCard sx={{ color: ID_CARD_META[idStatus]?.color }} />
                <Box>
                  <Typography fontWeight={700} fontSize={14}>{ID_CARD_META[idStatus]?.label ?? idStatus}</Typography>
                  {editStaff?.profile?.id_card_generated_at && <Typography variant="caption" color="text.secondary">Generated: {new Date(editStaff.profile.id_card_generated_at).toLocaleString("en-IN")}</Typography>}
                </Box>
              </Stack>
            </Paper>
          )}
          <TextField {...F} label="ID Card Instructions / Printing Notes" value={idCardNotes} onChange={e => setIdCardNotes(e.target.value)} multiline rows={3} sx={{ mb: 3 }} />
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Card Preview</Typography>
          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "flex-start", mb: 3 }}>
            <IdCardPreview staff={previewStaff} platformName={platformName} platformLogo={platformLogo} />
          </Box>
          {isEdit
            ? <Stack direction="row" spacing={1.5}>
                <Button variant="contained" startIcon={generatingCard ? <CircularProgress size={16} color="inherit" /> : <CreditCard />} onClick={handleGenerateIdCard} disabled={generatingCard} sx={{ bgcolor: "#1E3A5F", "&:hover": { bgcolor: "#0F2040" } }}>
                  {(!editStaff?.profile?.id_card_status || editStaff.profile.id_card_status === "NOT_GENERATED") ? "Generate & Print ID Card" : "Regenerate & Print"}
                </Button>
                {(idStatus === "GENERATED" || idStatus === "PRINTED") && <Button variant="outlined" startIcon={<Print />} onClick={() => window.print()}>Print Again</Button>}
              </Stack>
            : <Alert severity="info">Save first, then generate ID card.</Alert>}
          {isEdit && (
            <Box sx={{ mt: 4 }}>
              <Divider sx={{ mb: 2 }}><Typography variant="caption" color="text.secondary">Security</Typography></Divider>
              <SectionHead icon={<Lock />} title="Reset Password" />
              <Stack direction="row" spacing={1.5}>
                <TextField size="small" type="password" label="New Password (min 8 chars)" value={resetPwd} onChange={e => setResetPwd(e.target.value)} sx={{ flex: 1 }} />
                <Button variant="outlined" color="warning" onClick={handleResetPassword} disabled={!resetPwd}>Reset</Button>
              </Stack>
            </Box>
          )}
          </Box>
        </TabPanel>
      </DialogContent>
      {saving && <LinearProgress />}
      <DialogActions sx={{ px: 3, py: 2, borderTop: "1px solid", borderColor: "divider", gap: 1 }}>
        <Box sx={{ flex: 1 }}><Typography variant="caption" color="text.secondary">Tab {tab + 1}/{TABS.length} — {TABS[tab].label}</Typography></Box>
        {tab > 0 && <Button size="small" onClick={() => setTab(t => t - 1)}>← Prev</Button>}
        {tab < TABS.length - 1 && <Button variant="outlined" size="small" onClick={() => setTab(t => t + 1)}>Next →</Button>}
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />} sx={{ minWidth: 120 }}>
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Staff"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// STAFF UPLOADS MODAL
// ═══════════════════════════════════════════════════════════════
function StaffUploadsModal({ staff, onClose, onStaffUpdated }: {
  staff: StaffUser; onClose: () => void; onStaffUpdated: (u: StaffUser) => void;
}) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [photoUploading, setPhotoUploading] = useState(false);
  const [docUploading, setDocUploading] = useState<string | null>(null);
  const [documents, setDocuments] = useState<StaffDocument[]>([]);
  const [photoUrl, setPhotoUrl] = useState(staff.profile_image_url ?? "");
  const [tab, setTab] = useState(0);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { staffService.listDocuments(staff.id).then(r => setDocuments(r.documents)).catch(() => {}); }, [staff.id]);

  const handlePhotoUpload = async (file: File) => {
    setPhotoUploading(true);
    try { const u = await staffService.uploadPhoto(staff.id, file); setPhotoUrl(u.profile_image_url ?? ""); onStaffUpdated(u); qc.invalidateQueries({ queryKey: ["admin-staff"] }); enqueueSnackbar("Photo updated", { variant: "success" }); }
    catch (err: any) { enqueueSnackbar(err?.response?.data?.detail ?? "Upload failed", { variant: "error" }); }
    finally { setPhotoUploading(false); }
  };
  const handleDocUpload = async (file: File, docType: string) => {
    setDocUploading(docType);
    try { const r = await staffService.uploadDocument(staff.id, file, docType); setDocuments(r.documents); enqueueSnackbar("Document uploaded", { variant: "success" }); }
    catch (err: any) { enqueueSnackbar(err?.response?.data?.detail ?? "Upload failed", { variant: "error" }); }
    finally { setDocUploading(null); }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, maxHeight: "88vh" } }}>
      <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", gap: 2, background: "linear-gradient(135deg, #064E3B 0%, #065F46 100%)", color: "#fff" }}>
        <Avatar src={photoUrl || undefined} sx={{ width: 48, height: 48, border: "2px solid rgba(255,255,255,0.3)" }}>{staff.first_name[0]}</Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography fontWeight={800} fontSize={15}>{staff.first_name} {staff.last_name ?? ""}</Typography>
          <Chip label={ROLE_META[staff.user_type]?.label ?? staff.user_type} size="small" sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "#fff", fontWeight: 700, fontSize: 10, height: 18 }} />
        </Box>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", mr: 1 }}>Photo & Documents</Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: "rgba(255,255,255,0.7)" }}><Close /></IconButton>
      </Box>
      <Box sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, "& .MuiTab-root": { minHeight: 44, fontWeight: 700, fontSize: 13 } }}>
          <Tab icon={<PhotoCamera fontSize="small" />} iconPosition="start" label="Profile Photo" />
          <Tab icon={<Description fontSize="small" />} iconPosition="start" label={`Documents (${documents.length})`} />
        </Tabs>
      </Box>
      <DialogContent sx={{ px: 3, py: 3 }}>
        {tab === 0 && (
          <Box>
            <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }}
              onChange={async e => { const f = e.target.files?.[0]; if (f) await handlePhotoUpload(f); e.target.value = ""; }} />
            <Box sx={{ textAlign: "center" }}>
              <Avatar src={photoUrl || undefined} sx={{ width: 140, height: 140, mx: "auto", mb: 2, border: "3px solid", borderColor: "divider" }}><Person sx={{ fontSize: 60 }} /></Avatar>
              <Button variant="contained" startIcon={photoUploading ? <CircularProgress size={16} color="inherit" /> : <CloudUpload />} onClick={() => photoInputRef.current?.click()} disabled={photoUploading} sx={{ bgcolor: "#059669", "&:hover": { bgcolor: "#047857" } }}>
                {photoUploading ? "Uploading…" : photoUrl ? "Replace Photo" : "Upload Photo"}
              </Button>
            </Box>
          </Box>
        )}
        {tab === 1 && (
          <Box>
            <Alert severity="info" sx={{ mb: 2.5, fontSize: 12 }}>Files stored securely on Cloudinary (max 10 MB each).</Alert>
            <StaffDocumentUploader staffId={staff.id} documents={documents} uploading={docUploading} onUpload={handleDocUpload} />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: "1px solid", borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>{documents.length} document{documents.length !== 1 ? "s" : ""} uploaded</Typography>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function UsersPage() {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  // Main tab: 0=Customers, 1=Partners, 2=Staff
  const [viewTab, setViewTab] = useState(0);

  // ── Customer tab state ──────────────────────────────────────
  const [custPage, setCustPage] = useState(0);
  const [custPageSize, setCustPageSize] = useState(20);
  const [custSearch, setCustSearch] = useState("");
  const [custStatus, setCustStatus] = useState("");
  const [custDetail, setCustDetail] = useState<AdminUser | null>(null);

  // ── Partner tab state ───────────────────────────────────────
  const [partPage, setPartPage] = useState(0);
  const [partPageSize, setPartPageSize] = useState(20);
  const [partSearch, setPartSearch] = useState("");
  const [partType, setPartType] = useState("");
  const [partStatus, setPartStatus] = useState("");

  // ── Staff tab state ─────────────────────────────────────────
  const [staffPage, setStaffPage] = useState(0);
  const [staffPageSize, setStaffPageSize] = useState(20);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffRole, setStaffRole] = useState("");
  const [staffStatus, setStaffStatus] = useState("");
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [viewingStaff, setViewingStaff] = useState<StaffUser | null>(null);
  const [uploadsStaff, setUploadsStaff] = useState<StaffUser | null>(null);
  const [loadingStaffId, setLoadingStaffId] = useState<string | null>(null);

  const openStaffView = async (partial: StaffUser) => {
    setLoadingStaffId(partial.id);
    try { setViewingStaff(await staffService.get(partial.id)); } catch { setViewingStaff(partial); } finally { setLoadingStaffId(null); }
  };
  const openStaffEdit = async (partial: StaffUser) => {
    setLoadingStaffId(partial.id);
    try { setEditingStaff(await staffService.get(partial.id)); setStaffModalOpen(true); }
    catch { setEditingStaff(partial); setStaffModalOpen(true); } finally { setLoadingStaffId(null); }
  };
  const openStaffUploads = async (partial: StaffUser) => {
    setLoadingStaffId(partial.id);
    try { setUploadsStaff(await staffService.get(partial.id)); } catch { setUploadsStaff(partial); } finally { setLoadingStaffId(null); }
  };

  // Platform settings
  const { data: settings } = useQuery({ queryKey: ["platform-settings"], queryFn: () => settingsService.getConfigurations(), staleTime: 300000 });
  const settingsMap = Object.fromEntries((settings ?? []).map(s => [s.config_key, s.config_value ?? ""]));
  const platformName = settingsMap["PLATFORM_NAME"] ?? "WayTero";
  const platformLogo = settingsMap["PLATFORM_LOGO_URL"] ?? "";

  // ── Queries ─────────────────────────────────────────────────
  const customerQuery = useQuery({
    queryKey: ["admin-customers", { custPage, custPageSize, custSearch, custStatus }],
    queryFn: () => adminService.listUsers({
      page: custPage + 1, page_size: custPageSize,
      role: "CUSTOMER",
      ...(custSearch && { mobile: custSearch }),
      ...(custStatus && { status: custStatus }),
    }),
    staleTime: CACHE_TTL.SHORT,
  });

  const partnerQuery = useQuery({
    queryKey: ["admin-partners-list", { partPage, partPageSize, partSearch, partType, partStatus }],
    queryFn: () => partnerService.list({
      page: partPage + 1, page_size: partPageSize,
      ...(partType && { partner_type: partType }),
      ...(partStatus && { status: partStatus }),
    }),
    staleTime: CACHE_TTL.SHORT,
  });

  const staffQuery = useQuery({
    queryKey: ["admin-staff", { staffPage, staffPageSize, staffSearch, staffRole, staffStatus }],
    queryFn: () => staffService.list({
      page: staffPage + 1, page_size: staffPageSize,
      ...(staffSearch && { search: staffSearch }),
      ...(staffRole && { role: staffRole }),
      ...(staffStatus && { status: staffStatus }),
    }),
    staleTime: CACHE_TTL.SHORT,
  });

  const activateUser = useMutation({
    mutationFn: (id: string) => adminService.activateUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-customers"] }); enqueueSnackbar("User activated", { variant: "success" }); },
  });
  const suspendUser = useMutation({
    mutationFn: (id: string) => adminService.suspendUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-customers"] }); enqueueSnackbar("User suspended", { variant: "warning" }); },
  });

  // ── Customer columns ─────────────────────────────────────────
  const customerColumns: GridColDef[] = [
    {
      field: "avatar", headerName: "", width: 52, sortable: false,
      renderCell: (p: GridRenderCellParams<AdminUser>) => (
        <Avatar sx={{ width: 34, height: 34, bgcolor: alpha("#0F6FFF", 0.1), color: "#0F6FFF", fontSize: 13, fontWeight: 700 }}>
          {(p.row.first_name?.[0] ?? "?").toUpperCase()}
        </Avatar>
      ),
    },
    {
      field: "name", headerName: "Customer Name", flex: 1, minWidth: 180,
      renderCell: (p: GridRenderCellParams<AdminUser>) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>{p.row.first_name} {p.row.last_name}</Typography>
          <Typography variant="caption" color="text.secondary">{p.row.user_code}</Typography>
        </Box>
      ),
    },
    { field: "mobile_number", headerName: "Mobile", width: 145, renderCell: (p) => <Typography variant="body2" fontFamily="monospace">{p.value}</Typography> },
    { field: "email", headerName: "Email", flex: 1, minWidth: 200, renderCell: (p) => <Typography variant="body2" color="text.secondary">{p.value ?? "—"}</Typography> },
    {
      field: "status", headerName: "Status", width: 115,
      renderCell: (p: GridRenderCellParams<AdminUser>) => (
        <Chip label={p.value ?? "—"} size="small" color={STATUS_COLOR[p.value as string] ?? "default"} variant="outlined" sx={{ fontWeight: 600, fontSize: 11 }} />
      ),
    },
    { field: "created_at", headerName: "Joined", width: 110, renderCell: (p) => <Typography variant="caption" color="text.secondary">{new Date(p.value).toLocaleDateString("en-IN")}</Typography> },
    {
      field: "actions", headerName: "Actions", width: 100, sortable: false,
      renderCell: (p: GridRenderCellParams<AdminUser>) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="View"><IconButton size="small" onClick={() => setCustDetail(p.row)}><Visibility fontSize="small" /></IconButton></Tooltip>
          {p.row.is_active
            ? <Tooltip title="Suspend"><IconButton size="small" color="warning" onClick={() => suspendUser.mutate(p.row.id)}><Block fontSize="small" /></IconButton></Tooltip>
            : <Tooltip title="Activate"><IconButton size="small" color="success" onClick={() => activateUser.mutate(p.row.id)}><CheckCircle fontSize="small" /></IconButton></Tooltip>}
        </Stack>
      ),
    },
  ];

  // ── Partner columns ──────────────────────────────────────────
  const partnerColumns: GridColDef[] = [
    {
      field: "partner_type", headerName: "Type", width: 120,
      renderCell: (p: GridRenderCellParams<AdminPartnerListItem>) => {
        const m = PARTNER_TYPE_META[p.value ?? "INDIVIDUAL"];
        return (
          <Chip
            icon={m?.icon as any}
            label={m?.label ?? p.value ?? "—"}
            size="small"
            sx={{ bgcolor: alpha(m?.color ?? "#94A3B8", 0.1), color: m?.color ?? "#94A3B8", fontWeight: 700, fontSize: 11 }}
          />
        );
      },
    },
    {
      field: "business_name", headerName: "Business / Owner", flex: 1, minWidth: 200,
      renderCell: (p: GridRenderCellParams<AdminPartnerListItem>) => (
        <Box>
          <Typography variant="body2" fontWeight={700}>{p.row.business_name || p.row.contact_person || "—"}</Typography>
          <Typography variant="caption" color="text.secondary">{p.row.partner_code}</Typography>
        </Box>
      ),
    },
    {
      field: "contact_person", headerName: "Contact Person", width: 160,
      renderCell: (p: GridRenderCellParams<AdminPartnerListItem>) => (
        <Typography variant="body2" color="text.secondary">{p.row.contact_person ?? "—"}</Typography>
      ),
    },
    { field: "mobile_number", headerName: "Mobile", width: 140, renderCell: (p) => <Typography variant="body2" fontFamily="monospace">{p.value ?? "—"}</Typography> },
    { field: "email", headerName: "Email", flex: 1, minWidth: 180, renderCell: (p) => <Typography variant="body2" color="text.secondary">{p.value ?? "—"}</Typography> },
    {
      field: "status", headerName: "Status", width: 140,
      renderCell: (p: GridRenderCellParams<AdminPartnerListItem>) => {
        const m = STATUS_META[p.value as string];
        return <Chip label={m?.label ?? p.value ?? "—"} size="small" color={m?.color ?? "default"} sx={{ fontWeight: 600, fontSize: 11 }} />;
      },
    },
    { field: "created_at", headerName: "Registered", width: 110, renderCell: (p) => <Typography variant="caption" color="text.secondary">{new Date(p.value).toLocaleDateString("en-IN")}</Typography> },
    {
      field: "actions", headerName: "Actions", width: 80, sortable: false,
      renderCell: (p: GridRenderCellParams<AdminPartnerListItem>) => (
        <Tooltip title="View Partner Details">
          <IconButton size="small" onClick={() => window.open(`/partners/${p.row.id}`, "_blank")}><OpenInNew fontSize="small" /></IconButton>
        </Tooltip>
      ),
    },
  ];

  // ── Staff columns ────────────────────────────────────────────
  const staffColumns: GridColDef[] = [
    {
      field: "avatar", headerName: "", width: 52, sortable: false,
      renderCell: (p: GridRenderCellParams<StaffUser>) => (
        <Avatar src={p.row.profile_image_url ?? undefined} sx={{ width: 36, height: 36, bgcolor: alpha(ROLE_META[p.row.user_type]?.color ?? "#2563EB", 0.12), color: ROLE_META[p.row.user_type]?.color ?? "#2563EB", fontWeight: 700 }}>
          {p.row.first_name?.[0]?.toUpperCase()}
        </Avatar>
      ),
    },
    {
      field: "name", headerName: "Staff Member", flex: 1, minWidth: 180,
      renderCell: (p: GridRenderCellParams<StaffUser>) => (
        <Box>
          <Typography variant="body2" fontWeight={700}>{p.row.first_name} {p.row.last_name}</Typography>
          <Typography variant="caption" color="text.secondary">{p.row.profile?.employee_id ?? p.row.user_code ?? "—"}</Typography>
        </Box>
      ),
    },
    {
      field: "user_type", headerName: "Role", width: 170,
      renderCell: (p: GridRenderCellParams<StaffUser>) => (
        <Chip label={ROLE_META[p.value]?.label ?? p.value} size="small" sx={{ bgcolor: alpha(ROLE_META[p.value]?.color ?? "#64748B", 0.12), color: ROLE_META[p.value]?.color ?? "#64748B", fontWeight: 700, fontSize: 11 }} />
      ),
    },
    {
      field: "designation", headerName: "Designation", flex: 1, minWidth: 140, sortable: false,
      renderCell: (p: GridRenderCellParams<StaffUser>) => <Typography variant="body2" color="text.secondary">{p.row.profile?.designation ?? "—"}</Typography>,
    },
    {
      field: "id_card_status", headerName: "ID Card", width: 130, sortable: false,
      renderCell: (p: GridRenderCellParams<StaffUser>) => {
        const s = p.row.profile?.id_card_status ?? "NOT_GENERATED";
        const m = ID_CARD_META[s];
        return <Chip label={m?.label ?? s} size="small" sx={{ bgcolor: alpha(m?.color ?? "#94A3B8", 0.1), color: m?.color ?? "#94A3B8", fontWeight: 600, fontSize: 11 }} />;
      },
    },
    {
      field: "status", headerName: "Status", width: 100,
      renderCell: (p: GridRenderCellParams<StaffUser>) => (
        <Chip label={p.value} size="small" color={STATUS_COLOR[p.value] ?? "default"} variant="outlined" sx={{ fontWeight: 600, fontSize: 11 }} />
      ),
    },
    {
      field: "actions", headerName: "Actions", width: 128, sortable: false,
      renderCell: (p: GridRenderCellParams<StaffUser>) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="View Profile">
            <IconButton size="small" onClick={() => openStaffView(p.row)} disabled={loadingStaffId === p.row.id}>
              {loadingStaffId === p.row.id ? <CircularProgress size={14} /> : <Visibility fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit Profile">
            <IconButton size="small" color="primary" onClick={() => openStaffEdit(p.row)} disabled={loadingStaffId === p.row.id}><Edit fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title="Photo & Documents">
            <IconButton size="small" sx={{ color: "#059669" }} onClick={() => openStaffUploads(p.row)} disabled={loadingStaffId === p.row.id}><CloudUpload fontSize="small" /></IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>User Management</Typography>
          <Typography variant="body2" color="text.secondary">Customers, Partners & Staff — all in one place</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {viewTab === 2 && (
            <Button variant="contained" startIcon={<PersonAdd />}
              onClick={() => { setEditingStaff(null); setStaffModalOpen(true); }}
              sx={{ bgcolor: "#1E3A5F", "&:hover": { bgcolor: "#0F2040" } }}>
              Add Staff Member
            </Button>
          )}
          <Tooltip title="Refresh">
            <IconButton onClick={() => { customerQuery.refetch(); partnerQuery.refetch(); staffQuery.refetch(); }}><Refresh /></IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Top-level tabs */}
      <Card sx={{ mb: 0, borderRadius: "12px 12px 0 0", borderBottom: 0 }}>
        <Tabs
          value={viewTab}
          onChange={(_, v) => setViewTab(v)}
          sx={{
            px: 2,
            "& .MuiTab-root": { fontWeight: 700, fontSize: 13, minHeight: 52, gap: 0.5 },
            "& .MuiTabs-indicator": { height: 3, borderRadius: 2 },
          }}
        >
          <Tab
            icon={<SupervisedUserCircle />} iconPosition="start"
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <span>Customers</span>
                {customerQuery.data && (
                  <Chip label={customerQuery.data.total.toLocaleString()} size="small"
                    sx={{ bgcolor: alpha("#0F6FFF", 0.1), color: "#0F6FFF", fontWeight: 700, height: 20, fontSize: 11 }} />
                )}
              </Stack>
            }
          />
          <Tab
            icon={<Business />} iconPosition="start"
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <span>Partners</span>
                {partnerQuery.data && (
                  <Chip label={partnerQuery.data.total.toLocaleString()} size="small"
                    sx={{ bgcolor: alpha("#7C3AED", 0.1), color: "#7C3AED", fontWeight: 700, height: 20, fontSize: 11 }} />
                )}
              </Stack>
            }
          />
          <Tab
            icon={<BadgeIcon />} iconPosition="start"
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <span>Staff Management</span>
                {staffQuery.data && (
                  <Chip label={staffQuery.data.total.toLocaleString()} size="small"
                    sx={{ bgcolor: alpha("#1E3A5F", 0.1), color: "#1E3A5F", fontWeight: 700, height: 20, fontSize: 11 }} />
                )}
              </Stack>
            }
          />
        </Tabs>
      </Card>

      {/* ── TAB 0: CUSTOMERS ─────────────────────────────────── */}
      <TabPanel value={viewTab} index={0}>
        <Card sx={{ mb: 2, borderRadius: "0 0 12px 12px", borderTop: "1px solid", borderColor: "divider" }}>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center">
              <FilterList sx={{ color: "text.secondary" }} />
              <TextField size="small" placeholder="Search by mobile number…" value={custSearch}
                onChange={e => { setCustSearch(e.target.value); setCustPage(0); }} sx={{ flex: 1, minWidth: 200 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
              <TextField select size="small" value={custStatus} onChange={e => { setCustStatus(e.target.value); setCustPage(0); }} sx={{ minWidth: 150 }} label="Status">
                <MenuItem value="">All statuses</MenuItem>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="SUSPENDED">Suspended</MenuItem>
                <MenuItem value="PENDING">Pending</MenuItem>
              </TextField>
            </Stack>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
            {customerQuery.error && <Alert severity="error" sx={{ m: 2 }}>Failed to load customers.</Alert>}
            <DataGrid
              rows={customerQuery.data?.items ?? []} columns={customerColumns}
              rowCount={customerQuery.data?.total ?? 0} loading={customerQuery.isLoading}
              pageSizeOptions={[10, 20, 50]} paginationMode="server"
              paginationModel={{ page: custPage, pageSize: custPageSize }}
              onPaginationModelChange={m => { setCustPage(m.page); setCustPageSize(m.pageSize); }}
              disableRowSelectionOnClick rowHeight={56} sx={gridSx}
              slots={{ loadingOverlay: () => <Box display="flex" justifyContent="center" pt={4}><CircularProgress size={32} /></Box> }}
            />
          </CardContent>
        </Card>
      </TabPanel>

      {/* ── TAB 1: PARTNERS ──────────────────────────────────── */}
      <TabPanel value={viewTab} index={1}>
        <Card sx={{ mb: 2, borderRadius: "0 0 12px 12px", borderTop: "1px solid", borderColor: "divider" }}>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center">
              <FilterList sx={{ color: "text.secondary" }} />
              <TextField select size="small" value={partType} onChange={e => { setPartType(e.target.value); setPartPage(0); }} sx={{ minWidth: 160 }} label="Partner Type">
                <MenuItem value="">All types</MenuItem>
                <MenuItem value="INDIVIDUAL">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#0891B2" }} />
                    Individual
                  </Stack>
                </MenuItem>
                <MenuItem value="COMPANY">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#7C3AED" }} />
                    Company
                  </Stack>
                </MenuItem>
              </TextField>
              <TextField select size="small" value={partStatus} onChange={e => { setPartStatus(e.target.value); setPartPage(0); }} sx={{ minWidth: 170 }} label="Status">
                <MenuItem value="">All statuses</MenuItem>
                <MenuItem value="PENDING">Pending</MenuItem>
                <MenuItem value="UNDER_REVIEW">Under Review</MenuItem>
                <MenuItem value="DOCUMENT_PENDING">Docs Pending</MenuItem>
                <MenuItem value="APPROVED">Approved</MenuItem>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="SUSPENDED">Suspended</MenuItem>
                <MenuItem value="BLOCKED">Blocked</MenuItem>
              </TextField>
              <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
                Showing both INDIVIDUAL and COMPANY partners
              </Typography>
            </Stack>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
            {partnerQuery.error && <Alert severity="error" sx={{ m: 2 }}>Failed to load partners.</Alert>}
            <DataGrid
              rows={partnerQuery.data?.items ?? []} columns={partnerColumns}
              rowCount={partnerQuery.data?.total ?? 0} loading={partnerQuery.isLoading}
              pageSizeOptions={[10, 20, 50]} paginationMode="server"
              paginationModel={{ page: partPage, pageSize: partPageSize }}
              onPaginationModelChange={m => { setPartPage(m.page); setPartPageSize(m.pageSize); }}
              disableRowSelectionOnClick rowHeight={60} sx={gridSx}
              slots={{ loadingOverlay: () => <Box display="flex" justifyContent="center" pt={4}><CircularProgress size={32} /></Box> }}
            />
          </CardContent>
        </Card>
      </TabPanel>

      {/* ── TAB 2: STAFF ─────────────────────────────────────── */}
      <TabPanel value={viewTab} index={2}>
        <Card sx={{ mb: 2, borderRadius: "0 0 12px 12px", borderTop: "1px solid", borderColor: "divider" }}>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center">
              <FilterList sx={{ color: "text.secondary" }} />
              <TextField size="small" placeholder="Search name, email, mobile…" value={staffSearch}
                onChange={e => { setStaffSearch(e.target.value); setStaffPage(0); }} sx={{ flex: 1, minWidth: 200 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
              <TextField select size="small" value={staffRole} onChange={e => { setStaffRole(e.target.value); setStaffPage(0); }} sx={{ minWidth: 170 }} label="Role">
                <MenuItem value="">All roles</MenuItem>
                {STAFF_ROLES.map(r => <MenuItem key={r} value={r}>{ROLE_META[r]?.label ?? r}</MenuItem>)}
              </TextField>
              <TextField select size="small" value={staffStatus} onChange={e => { setStaffStatus(e.target.value); setStaffPage(0); }} sx={{ minWidth: 140 }} label="Status">
                <MenuItem value="">All statuses</MenuItem>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="SUSPENDED">Suspended</MenuItem>
                <MenuItem value="INACTIVE">Inactive</MenuItem>
              </TextField>
            </Stack>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
            {staffQuery.error && <Alert severity="error" sx={{ m: 2 }}>Failed to load staff members.</Alert>}
            <DataGrid
              rows={staffQuery.data?.items ?? []} columns={staffColumns}
              rowCount={staffQuery.data?.total ?? 0} loading={staffQuery.isLoading}
              pageSizeOptions={[10, 20, 50]} paginationMode="server"
              paginationModel={{ page: staffPage, pageSize: staffPageSize }}
              onPaginationModelChange={m => { setStaffPage(m.page); setStaffPageSize(m.pageSize); }}
              disableRowSelectionOnClick rowHeight={60} sx={gridSx}
              slots={{ loadingOverlay: () => <Box display="flex" justifyContent="center" pt={4}><CircularProgress size={32} /></Box> }}
            />
          </CardContent>
        </Card>
      </TabPanel>

      {/* Customer detail dialog */}
      <Dialog open={!!custDetail} onClose={() => setCustDetail(null)} maxWidth="sm" fullWidth>
        {custDetail && (
          <>
            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Avatar sx={{ bgcolor: alpha("#0F6FFF", 0.1), color: "#0F6FFF", fontWeight: 700 }}><Person /></Avatar>
              <Box>
                <Typography fontWeight={700}>{custDetail.first_name} {custDetail.last_name}</Typography>
                <Typography variant="caption" color="text.secondary">{custDetail.user_code}</Typography>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={0}>
                {[
                  ["Mobile", custDetail.mobile_number],
                  ["Email", custDetail.email ?? "—"],
                  ["Status", custDetail.status ?? "—"],
                  ["Active", custDetail.is_active ? "Yes" : "No"],
                  ["Joined", new Date(custDetail.created_at).toLocaleString("en-IN")],
                ].map(([l, v]) => <InfoRow key={l} label={l} value={v} />)}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCustDetail(null)}>Close</Button>
              {custDetail.is_active
                ? <Button color="warning" variant="contained" onClick={() => { suspendUser.mutate(custDetail.id); setCustDetail(null); }} startIcon={<Block />}>Suspend</Button>
                : <Button color="success" variant="contained" onClick={() => { activateUser.mutate(custDetail.id); setCustDetail(null); }} startIcon={<CheckCircle />}>Activate</Button>}
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Staff create/edit modal */}
      {staffModalOpen && (
        <StaffModal
          key={editingStaff?.id ?? "new"} open={staffModalOpen}
          onClose={() => { setStaffModalOpen(false); setEditingStaff(null); }}
          editStaff={editingStaff} platformName={platformName} platformLogo={platformLogo}
        />
      )}

      {/* Staff view (read-only) — simple detail dialog */}
      {viewingStaff && !staffModalOpen && (
        <Dialog open onClose={() => setViewingStaff(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
          <Box sx={{ px: 3, py: 2.5, display: "flex", alignItems: "center", gap: 2, background: "linear-gradient(135deg, #1E3A5F 0%, #0F2040 100%)", color: "#fff" }}>
            <Avatar src={viewingStaff.profile_image_url ?? undefined} sx={{ width: 52, height: 52, border: "2px solid rgba(255,255,255,0.3)" }}>{viewingStaff.first_name[0]}</Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={800} fontSize={15}>{viewingStaff.first_name} {viewingStaff.last_name ?? ""}</Typography>
              <Stack direction="row" spacing={0.75} sx={{ mt: 0.3 }}>
                <Chip label={ROLE_META[viewingStaff.user_type]?.label ?? viewingStaff.user_type} size="small" sx={{ bgcolor: alpha("#fff", 0.15), color: "#fff", fontWeight: 700, fontSize: 10, height: 18 }} />
                <Chip label={viewingStaff.status} size="small" color={STATUS_COLOR[viewingStaff.status] ?? "default"} sx={{ fontWeight: 700, fontSize: 10, height: 18 }} />
              </Stack>
            </Box>
            <IconButton size="small" sx={{ color: "rgba(255,255,255,0.7)" }} onClick={() => setViewingStaff(null)}><Close /></IconButton>
          </Box>
          <DialogContent sx={{ px: 3, pt: 2.5 }}>
            <InfoRow label="Email" value={viewingStaff.email} />
            <InfoRow label="Mobile" value={viewingStaff.mobile_number} />
            <InfoRow label="Employee ID" value={viewingStaff.profile?.employee_id} />
            <InfoRow label="Designation" value={viewingStaff.profile?.designation} />
            <InfoRow label="Department" value={viewingStaff.profile?.department} />
            <InfoRow label="Joining Date" value={viewingStaff.profile?.joining_date ? new Date(viewingStaff.profile.joining_date).toLocaleDateString("en-IN") : undefined} />
            <InfoRow label="ID Card Status" value={ID_CARD_META[viewingStaff.profile?.id_card_status ?? "NOT_GENERATED"]?.label} />
            <InfoRow label="Joined Platform" value={new Date(viewingStaff.created_at).toLocaleString("en-IN")} />
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, borderTop: "1px solid", borderColor: "divider", gap: 1 }}>
            <Box sx={{ flex: 1 }} />
            <Button variant="outlined" onClick={() => { setViewingStaff(null); openStaffUploads(viewingStaff); }} startIcon={<CloudUpload />} sx={{ color: "#059669", borderColor: "#059669" }}>Photo & Docs</Button>
            <Button variant="contained" onClick={() => { setViewingStaff(null); openStaffEdit(viewingStaff); }} startIcon={<Edit />}>Edit Profile</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Staff uploads modal */}
      {uploadsStaff && (
        <StaffUploadsModal key={uploadsStaff.id} staff={uploadsStaff} onClose={() => setUploadsStaff(null)} onStaffUpdated={u => setUploadsStaff(u)} />
      )}
    </Box>
  );
}
