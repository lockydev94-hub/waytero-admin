// ============================================================
// WAYTERO ADMIN — SETTINGS PAGE (Full Implementation)
// Tabs: Platform | System Config | API Integrations |
//       App Versions | Commission | Pricing | Notifications
// Doc Ref: Admin API §25 | DB Schema Part 1 §12-14 | Part 2 §14-15
// ============================================================
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box, Typography, Card, CardContent, CardHeader, Tabs, Tab,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Paper, IconButton, Chip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Switch, FormControlLabel, Select, MenuItem,
  InputLabel, FormControl, Tooltip, CircularProgress, Alert, AlertTitle, Divider,
  Stack, Grid, InputAdornment, Collapse, LinearProgress, alpha,
} from "@mui/material";
import {
  Edit, Delete, Add, Save, Refresh, Settings, CloudUpload,
  Notifications, PriceChange, Groups, PhoneAndroid,
  TuneOutlined, KeyboardArrowDown, KeyboardArrowUp, CheckCircle,
  ErrorOutline, Public, Link, StorageOutlined, LocationCity, MarkEmailRead,
  DirectionsCar, FilterAlt, ExpandLess, ExpandMore,
  InfoOutlined, Check, Close,
  Business, AddLocationAlt, CropOriginal, Image, Store, AccountBalance,
  ZoomIn, ZoomOut, RotateLeft, CheckCircleOutline, UploadFileOutlined,
  ReceiptLong, Percent, ToggleOn, Hotel, Spa, Whatshot, ContentPasteGo, Code,
  MyLocation,
} from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { settingsService, uploadMedia, MediaUploadResult, SystemConfig, ApiIntegration, CommissionGroup, AppVersion, NotificationTemplate, City, VehicleCategory, VehiclePricingRule, State, SERVICE_TYPES, DefaultPricingRule, TRIP_TYPES, ServiceTypeRecord } from "../../services/settings.service";
import { hotelService } from "../../services/hotel.service";
import EmailSettingsTab from "./EmailSettingsTab";

// ── helpers ─────────────────────────────────────────────────────────────────

function safeParseJSON(str: string): Record<string, string> {
  try { return JSON.parse(str) ?? {}; } catch { return {}; }
}

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

const SECTION_GROUPS: Record<string, string[]> = {
  "Platform Details": ["PLATFORM_NAME", "PLATFORM_TAGLINE", "PLATFORM_COUNTRY", "SUPPORT_EMAIL", "SUPPORT_PHONE"],
  "Timezone & Currency": ["PLATFORM_TIMEZONE", "PLATFORM_CURRENCY", "PLATFORM_CURRENCY_SYMBOL", "PLATFORM_LOCALE"],
  "Booking & Cancellation": ["BOOKING_CANCELLATION_HOURS", "GST_PERCENTAGE", "PLATFORM_COMMISSION_PERCENTAGE"],
  "Auth & Security": ["OTP_EXPIRY_MINUTES", "MAX_LOGIN_ATTEMPTS", "WALLET_MINIMUM_BALANCE"],
};

const INTEGRATION_FIELDS: Record<string, string[]> = {
  CLOUDINARY: ["cloud_name", "api_key", "api_secret", "upload_preset"],
  FIREBASE: ["project_id", "private_key_id", "private_key", "client_email", "web_api_key", "storage_bucket"],
  GOOGLE_MAPS: ["api_key", "map_id"],
  RAZORPAY: ["key_id", "key_secret", "webhook_secret"],
  MSG91: ["auth_key", "sender_id", "route"],
  WHATSAPP: ["api_key", "phone_number_id", "business_account_id"],
  FCM: ["server_key", "sender_id"],
  MINIO: ["endpoint", "access_key", "secret_key", "bucket"],
  SMTP: ["host", "port", "username", "password", "from_email"],
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState(0);
  const { enqueueSnackbar } = useSnackbar();

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Settings</Typography>
          <Typography variant="body2" color="text.secondary">
            Platform configuration, integrations & operational rules
          </Typography>
        </Box>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3, borderRadius: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}
        >
          <Tab icon={<Public sx={{ fontSize: 16 }} />} iconPosition="start" label="Platform" />
          <Tab icon={<TuneOutlined sx={{ fontSize: 16 }} />} iconPosition="start" label="System Config" />
          <Tab icon={<Link sx={{ fontSize: 16 }} />} iconPosition="start" label="API Integrations" />
          <Tab icon={<PhoneAndroid sx={{ fontSize: 16 }} />} iconPosition="start" label="App Versions" />
          <Tab icon={<Groups sx={{ fontSize: 16 }} />} iconPosition="start" label="Commission" />
          <Tab icon={<PriceChange sx={{ fontSize: 16 }} />} iconPosition="start" label="Pricing Rules" />
          <Tab icon={<Notifications sx={{ fontSize: 16 }} />} iconPosition="start" label="Notifications" />
          <Tab icon={<MarkEmailRead sx={{ fontSize: 16 }} />} iconPosition="start" label="Email" />
          <Tab icon={<StorageOutlined sx={{ fontSize: 16 }} />} iconPosition="start" label="Master Data" />
        </Tabs>
      </Paper>

      <TabPanel value={tab} index={0}><PlatformTab enqueueSnackbar={enqueueSnackbar} /></TabPanel>
      <TabPanel value={tab} index={1}><SystemConfigTab enqueueSnackbar={enqueueSnackbar} /></TabPanel>
      <TabPanel value={tab} index={2}><ApiIntegrationsTab enqueueSnackbar={enqueueSnackbar} /></TabPanel>
      <TabPanel value={tab} index={3}><AppVersionsTab enqueueSnackbar={enqueueSnackbar} /></TabPanel>
      <TabPanel value={tab} index={4}><CommissionTab enqueueSnackbar={enqueueSnackbar} /></TabPanel>
      <TabPanel value={tab} index={5}><PricingTab enqueueSnackbar={enqueueSnackbar} /></TabPanel>
      <TabPanel value={tab} index={6}><NotificationTemplatesTab enqueueSnackbar={enqueueSnackbar} /></TabPanel>
      <TabPanel value={tab} index={7}><EmailSettingsTab enqueueSnackbar={enqueueSnackbar} /></TabPanel>
      <TabPanel value={tab} index={8}><MasterDataTab enqueueSnackbar={enqueueSnackbar} /></TabPanel>
    </Box>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 0 — PLATFORM (Brand Media + Business Details + Office Addresses)
// Doc Ref: Migration 0013_platform_profile — system_configurations keys
//          Backend route POST /admin/settings/upload-media
//          BRD §204 — GST Configuration
// ══════════════════════════════════════════════════════════════

// ── types ──────────────────────────────────────────────────────
interface OfficeAddress {
  label: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  is_primary: boolean;
}

// ── CropModal ─────────────────────────────────────────────────
function CropModal({
  open, file, assetType, onClose, onCropped,
}: {
  open: boolean;
  file: File | null;
  assetType: "logo" | "favicon" | "og_image";
  onClose: () => void;
  onCropped: (blob: Blob) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const SPECS: Record<string, { w: number; h: number; label: string }> = {
    logo:     { w: 400, h: 120, label: "400 × 120 px" },
    favicon:  { w: 32,  h: 32,  label: "32 × 32 px" },
    og_image: { w: 1200, h: 630, label: "1200 × 630 px" },
  };
  const spec = SPECS[assetType] ?? { w: 400, h: 120, label: "400 × 120 px" };
  // canvas preview size (scaled down for display)
  const MAX_PREVIEW_W = 560;
  const previewScale = Math.min(1, MAX_PREVIEW_W / spec.w);
  const previewW = Math.round(spec.w * previewScale);
  const previewH = Math.round(spec.h * previewScale);

  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    const img = new window.Image();
    img.onload = () => {
      imgRef.current = img;
      // auto-fit: scale image to fill canvas
      const sX = spec.w / img.width;
      const sY = spec.h / img.height;
      const s = Math.max(sX, sY);
      setScale(s);
      setOffsetX((spec.w - img.width * s) / 2);
      setOffsetY((spec.h - img.height * s) / 2);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!canvasRef.current || !imgRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, previewW, previewH);
    ctx.drawImage(
      imgRef.current,
      offsetX * previewScale,
      offsetY * previewScale,
      imgRef.current.width * scale * previewScale,
      imgRef.current.height * scale * previewScale,
    );
  });

  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffsetX(e.clientX - dragStart.x);
    setOffsetY(e.clientY - dragStart.y);
  };
  const onMouseUp = () => setDragging(false);

  const confirmCrop = () => {
    if (!imgRef.current) return;
    // render at actual spec dimensions
    const offscreen = document.createElement("canvas");
    offscreen.width = spec.w;
    offscreen.height = spec.h;
    const ctx = offscreen.getContext("2d")!;
    ctx.drawImage(
      imgRef.current,
      offsetX, offsetY,
      imgRef.current.width * scale,
      imgRef.current.height * scale,
    );
    offscreen.toBlob(blob => { if (blob) onCropped(blob); }, "image/png");
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <CropOriginal color="primary" />
          <Box>
            <Typography fontWeight={700} fontSize={18}>Adjust & Crop</Typography>
            <Typography variant="caption" color="text.secondary">
              {assetType.replace(/_/g, " ").toUpperCase()} — Target size: {spec.label} · Drag to reposition · Scroll to zoom
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2, pt: 1,
          }}
        >
          {/* Canvas crop area */}
          <Box
            sx={{
              border: "2px dashed", borderColor: "primary.main", borderRadius: 2,
              overflow: "hidden", cursor: dragging ? "grabbing" : "grab",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              position: "relative",
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={e => {
              e.preventDefault();
              setScale(s => Math.max(0.1, s - e.deltaY * 0.001));
            }}
          >
            <canvas
              ref={canvasRef}
              width={previewW}
              height={previewH}
              style={{ display: "block", background: "repeating-conic-gradient(#e0e0e0 0% 25%, white 0% 50%) 0 0 / 12px 12px" }}
            />
            {/* corner guides */}
            {["top-left","top-right","bottom-left","bottom-right"].map(pos => (
              <Box key={pos} sx={{
                position: "absolute",
                ...(pos.includes("top") ? { top: 0 } : { bottom: 0 }),
                ...(pos.includes("left") ? { left: 0 } : { right: 0 }),
                width: 16, height: 16,
                borderTop: pos.includes("top") ? "3px solid" : "none",
                borderBottom: pos.includes("bottom") ? "3px solid" : "none",
                borderLeft: pos.includes("left") ? "3px solid" : "none",
                borderRight: pos.includes("right") ? "3px solid" : "none",
                borderColor: "primary.main",
              }} />
            ))}
          </Box>
          {/* Zoom controls */}
          <Stack direction="row" spacing={2} alignItems="center">
            <Tooltip title="Zoom out">
              <IconButton onClick={() => setScale(s => Math.max(0.1, s - 0.1))}><ZoomOut /></IconButton>
            </Tooltip>
            <Typography variant="caption" fontFamily="monospace" color="text.secondary" sx={{ minWidth: 50, textAlign: "center" }}>
              {Math.round(scale * 100)}%
            </Typography>
            <Tooltip title="Zoom in">
              <IconButton onClick={() => setScale(s => s + 0.1)}><ZoomIn /></IconButton>
            </Tooltip>
            <Tooltip title="Reset">
              <IconButton onClick={() => {
                if (!imgRef.current) return;
                const sX = spec.w / imgRef.current.width;
                const sY = spec.h / imgRef.current.height;
                const s = Math.max(sX, sY);
                setScale(s);
                setOffsetX((spec.w - imgRef.current.width * s) / 2);
                setOffsetY((spec.h - imgRef.current.height * s) / 2);
              }}>
                <RotateLeft />
              </IconButton>
            </Tooltip>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Scroll to zoom · Drag to reposition · Final output: {spec.label}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2 }}>Cancel</Button>
        <Button onClick={confirmCrop} variant="contained" startIcon={<CheckCircleOutline />} sx={{ borderRadius: 2 }}>
          Confirm & Upload
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── MediaUploadCard ────────────────────────────────────────────
function MediaUploadCard({
  configKey, assetType, label, description, specLabel,
  currentUrl, onSaved, enqueueSnackbar,
}: {
  configKey: string;
  assetType: "logo" | "favicon" | "og_image";
  label: string;
  description: string;
  specLabel: string;
  currentUrl: string;
  onSaved: (url: string) => void;
  enqueueSnackbar: any;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPendingFile(f);
    setCropOpen(true);
    e.target.value = "";
  };

  const onCropped = async (blob: Blob) => {
    setCropOpen(false);
    setUploading(true);
    try {
      const croppedFile = new File([blob], `${assetType}.png`, { type: "image/png" });
      const result: MediaUploadResult = await uploadMedia(croppedFile, assetType);
      const url = result.secure_url;
      setSaving(true);
      await settingsService.upsertConfiguration(configKey, url);
      enqueueSnackbar(`${label} uploaded successfully`, { variant: "success" });
      onSaved(url);
    } catch (err: any) {
      enqueueSnackbar(
        err?.response?.data?.detail ?? `Failed to upload ${label}`,
        { variant: "error" }
      );
    } finally {
      setUploading(false);
      setSaving(false);
      setPendingFile(null);
    }
  };

  const isBusy = uploading || saving;

  return (
    <>
      <Card
        variant="outlined"
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          transition: "box-shadow 0.2s",
          "&:hover": { boxShadow: "0 4px 20px rgba(0,0,0,0.10)" },
        }}
      >
        {/* Preview strip */}
        <Box
          sx={{
            height: assetType === "favicon" ? 80 : assetType === "logo" ? 100 : 140,
            bgcolor: "grey.50",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderBottom: "1px solid",
            borderColor: "divider",
            position: "relative",
            background: "repeating-conic-gradient(#f5f5f5 0% 25%, white 0% 50%) 0 0 / 16px 16px",
          }}
        >
          {currentUrl ? (
            <Box
              component="img"
              src={currentUrl}
              alt={label}
              sx={{
                maxHeight: "90%",
                maxWidth: "90%",
                objectFit: "contain",
                borderRadius: assetType === "favicon" ? "50%" : 1,
              }}
            />
          ) : (
            <Stack alignItems="center" spacing={0.5}>
              {assetType === "favicon" ? (
                <Store sx={{ fontSize: 32, color: "grey.300" }} />
              ) : assetType === "logo" ? (
                <Image sx={{ fontSize: 40, color: "grey.300" }} />
              ) : (
                <Public sx={{ fontSize: 40, color: "grey.300" }} />
              )}
              <Typography variant="caption" color="text.disabled">No image uploaded</Typography>
            </Stack>
          )}
          {isBusy && (
            <Box sx={{
              position: "absolute", inset: 0,
              bgcolor: "rgba(255,255,255,0.8)",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 1,
            }}>
              <CircularProgress size={28} />
              <Typography variant="caption" color="text.secondary">
                {uploading ? "Uploading to Cloudinary…" : "Saving…"}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Card body */}
        <CardContent sx={{ pb: "12px !important" }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={1}>
            <Box>
              <Typography fontWeight={700} fontSize={14}>{label}</Typography>
              <Typography variant="caption" color="text.secondary">{description}</Typography>
            </Box>
            {currentUrl && (
              <Tooltip title="Image uploaded ✓">
                <CheckCircleOutline sx={{ color: "success.main", fontSize: 20, mt: 0.3 }} />
              </Tooltip>
            )}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
            <Chip
              label={specLabel}
              size="small"
              variant="outlined"
              sx={{ fontFamily: "monospace", fontSize: 11 }}
            />
            <Chip label="PNG / JPG / SVG / WebP" size="small" variant="outlined" sx={{ fontSize: 11 }} />
          </Stack>

          {currentUrl && (
            <Box
              sx={{
                mb: 1.5, p: 1, bgcolor: "action.hover", borderRadius: 1.5,
                display: "flex", alignItems: "center", gap: 1, overflow: "hidden",
              }}
            >
              <Link sx={{ fontSize: 14, color: "text.secondary", flexShrink: 0 }} />
              <Typography
                variant="caption"
                fontFamily="monospace"
                color="primary.main"
                sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10 }}
              >
                {currentUrl}
              </Typography>
            </Box>
          )}

          <input
            ref={fileRef}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,image/x-icon"
            onChange={onFileChange}
          />
          <Button
            fullWidth
            variant={currentUrl ? "outlined" : "contained"}
            startIcon={isBusy ? <CircularProgress size={14} color="inherit" /> : <CloudUpload />}
            onClick={() => fileRef.current?.click()}
            disabled={isBusy}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
          >
            {isBusy ? "Processing…" : currentUrl ? "Replace Image" : "Upload Image"}
          </Button>
        </CardContent>
      </Card>

      {pendingFile && (
        <CropModal
          open={cropOpen}
          file={pendingFile}
          assetType={assetType}
          onClose={() => { setCropOpen(false); setPendingFile(null); }}
          onCropped={onCropped}
        />
      )}
    </>
  );
}

// ── OfficeAddressCard ──────────────────────────────────────────
function OfficeAddressCard({
  address, index, onEdit, onDelete, onSetPrimary,
}: {
  address: OfficeAddress;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onSetPrimary: () => void;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2, borderRadius: 2.5,
        borderColor: address.is_primary ? "primary.main" : "divider",
        background: address.is_primary
          ? "linear-gradient(135deg, rgba(25,118,210,0.03), rgba(25,118,210,0.01))"
          : "transparent",
        transition: "all 0.2s",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {address.is_primary && (
        <Box sx={{
          position: "absolute", top: 0, right: 0,
          bgcolor: "primary.main", color: "white",
          px: 1.5, py: 0.25,
          borderBottomLeftRadius: 8,
          fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
        }}>
          PRIMARY
        </Box>
      )}
      <Stack direction="row" alignItems="flex-start" spacing={1.5}>
        <Box sx={{
          width: 40, height: 40, borderRadius: 2, flexShrink: 0,
          bgcolor: address.is_primary ? "primary.main" : "action.hover",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <AddLocationAlt sx={{ color: address.is_primary ? "white" : "text.secondary", fontSize: 20 }} />
        </Box>
        <Box flex={1} minWidth={0}>
          <Typography fontWeight={700} fontSize={14}>{address.label || `Office ${index + 1}`}</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.25}>
            {[address.line1, address.line2].filter(Boolean).join(", ")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {[address.city, address.state, address.pincode].filter(Boolean).join(", ")}
          </Typography>
          {address.phone && (
            <Typography variant="caption" color="primary.main" mt={0.25} display="block">
              📞 {address.phone}
            </Typography>
          )}
        </Box>
        <Stack spacing={0.5} flexShrink={0}>
          {!address.is_primary && (
            <Tooltip title="Set as primary">
              <IconButton size="small" onClick={onSetPrimary}>
                <CheckCircle fontSize="small" sx={{ color: "text.disabled" }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Edit">
            <IconButton size="small" onClick={onEdit}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Remove">
            <IconButton size="small" color="error" onClick={onDelete} disabled={address.is_primary}>
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Paper>
  );
}

// ── AddressDialog ─────────────────────────────────────────────
function AddressDialog({
  open, address, onClose, onSave,
}: {
  open: boolean;
  address: OfficeAddress | null;
  onClose: () => void;
  onSave: (addr: OfficeAddress) => void;
}) {
  const EMPTY: OfficeAddress = { label: "", line1: "", line2: "", city: "", state: "", pincode: "", phone: "", is_primary: false };
  const [form, setForm] = useState<OfficeAddress>({ ...EMPTY });

  useEffect(() => {
    setForm(address ? { ...address } : { ...EMPTY });
  }, [address, open]);

  const isValid = !!form.label.trim() && !!form.line1.trim() && !!form.city.trim() && !!form.state.trim();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <AddLocationAlt color="primary" />
          <Box>
            <Typography fontWeight={700} fontSize={18}>{address ? "Edit Office Address" : "Add Office Address"}</Typography>
            <Typography variant="caption" color="text.secondary">Address shown on invoices, receipts & contact pages</Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid item xs={12}>
            <TextField
              size="small" fullWidth required label="Office Label"
              placeholder="e.g. Head Office, Branch – Mumbai"
              value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField size="small" fullWidth required label="Address Line 1"
              value={form.line1} onChange={e => setForm(p => ({ ...p, line1: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField size="small" fullWidth label="Address Line 2 (optional)"
              value={form.line2} onChange={e => setForm(p => ({ ...p, line2: e.target.value }))} />
          </Grid>
          <Grid item xs={5}>
            <TextField size="small" fullWidth required label="City"
              value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
          </Grid>
          <Grid item xs={4}>
            <TextField size="small" fullWidth required label="State"
              value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} />
          </Grid>
          <Grid item xs={3}>
            <TextField size="small" fullWidth label="PIN Code" inputProps={{ maxLength: 10 }}
              value={form.pincode} onChange={e => setForm(p => ({ ...p, pincode: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <TextField size="small" fullWidth label="Phone / WhatsApp"
              placeholder="+91 XXXXX XXXXX"
              value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={<Switch checked={form.is_primary} onChange={e => setForm(p => ({ ...p, is_primary: e.target.checked }))} color="primary" />}
              label="Set as primary office address"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2 }}>Cancel</Button>
        <Button
          onClick={() => { if (isValid) onSave(form); }}
          disabled={!isValid}
          variant="contained"
          startIcon={<Save />}
          sx={{ borderRadius: 2 }}
        >
          {address ? "Save Changes" : "Add Address"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── PlatformTab (Main) ────────────────────────────────────────
function PlatformTab({ enqueueSnackbar }: any) {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // media urls (live from configs)
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");

  // business details edits
  const [biz, setBiz] = useState({
    BUSINESS_LEGAL_NAME: "",
    BUSINESS_GST_NUMBER: "",
    BUSINESS_PAN_NUMBER: "",
    BUSINESS_REGISTRATION_NUMBER: "",
    BUSINESS_INCORPORATION_DATE: "",
    BUSINESS_REGISTERED_ADDRESS: "",
  });

  // office addresses
  const [addresses, setAddresses] = useState<OfficeAddress[]>([]);
  const [addrDialog, setAddrDialog] = useState<{ open: boolean; idx: number | null }>({ open: false, idx: null });
  const [savingAddresses, setSavingAddresses] = useState(false);

  // general settings (platform name, timezone etc.)
  const [platformKeys, setPlatformKeys] = useState<Record<string, string>>({});
  const GENERAL_KEYS = ["PLATFORM_NAME", "PLATFORM_TAGLINE", "PLATFORM_COUNTRY", "SUPPORT_EMAIL", "SUPPORT_PHONE",
    "PLATFORM_TIMEZONE", "PLATFORM_CURRENCY", "PLATFORM_CURRENCY_SYMBOL", "PLATFORM_LOCALE",
    "GST_PERCENTAGE", "PLATFORM_COMMISSION_PERCENTAGE", "BOOKING_CANCELLATION_HOURS",
    "GST_ENABLED", "GST_RATE", "COMMISSION_GST_RATE"];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingsService.getConfigurations();
      setConfigs(data);
      const map: Record<string, string> = {};
      data.forEach(c => { map[c.config_key] = c.config_value ?? ""; });

      setLogoUrl(map["PLATFORM_LOGO_URL"] ?? "");
      setFaviconUrl(map["PLATFORM_FAVICON_URL"] ?? "");
      setOgImageUrl(map["PLATFORM_OG_IMAGE_URL"] ?? "");

      setBiz({
        BUSINESS_LEGAL_NAME: map["BUSINESS_LEGAL_NAME"] ?? "",
        BUSINESS_GST_NUMBER: map["BUSINESS_GST_NUMBER"] ?? "",
        BUSINESS_PAN_NUMBER: map["BUSINESS_PAN_NUMBER"] ?? "",
        BUSINESS_REGISTRATION_NUMBER: map["BUSINESS_REGISTRATION_NUMBER"] ?? "",
        BUSINESS_INCORPORATION_DATE: map["BUSINESS_INCORPORATION_DATE"] ?? "",
        BUSINESS_REGISTERED_ADDRESS: map["BUSINESS_REGISTERED_ADDRESS"] ?? "",
      });

      try {
        const raw = map["PLATFORM_OFFICE_ADDRESSES"] ?? "[]";
        setAddresses(JSON.parse(raw));
      } catch { setAddresses([]); }

      const gmap: Record<string, string> = {};
      GENERAL_KEYS.forEach(k => { gmap[k] = map[k] ?? ""; });
      setPlatformKeys(gmap);
    } catch { enqueueSnackbar("Failed to load platform settings", { variant: "error" }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveKey = async (key: string, value: string) => {
    setSaving(key);
    try {
      await settingsService.upsertConfiguration(key, value);
      enqueueSnackbar(`Saved`, { variant: "success" });
    } catch { enqueueSnackbar(`Failed to save ${key}`, { variant: "error" }); }
    finally { setSaving(null); }
  };

  const saveBusiness = async () => {
    setSaving("BIZ_ALL");
    try {
      await Promise.all(Object.entries(biz).map(([k, v]) => settingsService.upsertConfiguration(k, v)));
      enqueueSnackbar("Business details saved", { variant: "success" });
    } catch { enqueueSnackbar("Failed to save business details", { variant: "error" }); }
    finally { setSaving(null); }
  };

  const saveAddresses = async (newList: OfficeAddress[]) => {
    setSavingAddresses(true);
    try {
      await settingsService.upsertConfiguration("PLATFORM_OFFICE_ADDRESSES", JSON.stringify(newList));
      setAddresses(newList);
      enqueueSnackbar("Office addresses saved", { variant: "success" });
    } catch { enqueueSnackbar("Failed to save addresses", { variant: "error" }); }
    finally { setSavingAddresses(false); }
  };

  const addOrEditAddress = async (addr: OfficeAddress) => {
    let updated: OfficeAddress[];
    if (addr.is_primary) {
      updated = addresses.map(a => ({ ...a, is_primary: false }));
    } else {
      updated = [...addresses];
    }
    if (addrDialog.idx !== null) {
      updated[addrDialog.idx] = addr;
      if (!addr.is_primary) updated = updated;
    } else {
      updated = [...updated, addr];
    }
    setAddrDialog({ open: false, idx: null });
    await saveAddresses(updated);
  };

  const deleteAddress = async (idx: number) => {
    const updated = addresses.filter((_, i) => i !== idx);
    await saveAddresses(updated);
  };

  const setPrimaryAddress = async (idx: number) => {
    const updated = addresses.map((a, i) => ({ ...a, is_primary: i === idx }));
    await saveAddresses(updated);
  };

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;

  const BIZ_FIELDS: { key: keyof typeof biz; label: string; placeholder?: string; type?: string; multiline?: boolean; rows?: number }[] = [
    { key: "BUSINESS_LEGAL_NAME",         label: "Legal Company Name",          placeholder: "e.g. WayTero India Pvt. Ltd." },
    { key: "BUSINESS_GST_NUMBER",         label: "GSTIN",                       placeholder: "15-character GST number" },
    { key: "BUSINESS_PAN_NUMBER",         label: "PAN",                         placeholder: "e.g. AABCW1234F" },
    { key: "BUSINESS_REGISTRATION_NUMBER",label: "CIN / Registration Number",   placeholder: "e.g. U62099MH2020PTC123456" },
    { key: "BUSINESS_INCORPORATION_DATE", label: "Date of Incorporation",       type: "date" },
    { key: "BUSINESS_REGISTERED_ADDRESS", label: "Registered Address (MCA)",    placeholder: "Full registered address as on MCA records", multiline: true, rows: 2 },
  ];

  const GENERAL_GROUPS: { title: string; keys: string[]; desc?: string }[] = [
    { title: "Platform Identity", keys: ["PLATFORM_NAME", "PLATFORM_TAGLINE", "PLATFORM_COUNTRY", "SUPPORT_EMAIL", "SUPPORT_PHONE"] },
    { title: "Locale & Currency", keys: ["PLATFORM_TIMEZONE", "PLATFORM_CURRENCY", "PLATFORM_CURRENCY_SYMBOL", "PLATFORM_LOCALE"] },
    { title: "Operational Rules",  keys: ["GST_PERCENTAGE", "PLATFORM_COMMISSION_PERCENTAGE", "BOOKING_CANCELLATION_HOURS"] },
  ];

  const configDesc: Record<string, string> = {};
  configs.forEach(c => { configDesc[c.config_key] = c.description ?? c.config_key; });

  return (
    <Box>
      {/* ─────────────────────────────────────────────────────
          SECTION 1 — BRAND MEDIA
      ───────────────────────────────────────────────────── */}
      <Box mb={4}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={2.5}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 2, bgcolor: "primary.main",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Image sx={{ color: "white", fontSize: 20 }} />
          </Box>
          <Box>
            <Typography fontWeight={700} fontSize={16}>Brand Media</Typography>
            <Typography variant="caption" color="text.secondary">
              Upload logo, favicon & OG image — cropped to correct size and stored in Cloudinary
            </Typography>
          </Box>
        </Stack>

        <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2 }}>
          Cloudinary integration must be active in <strong>API Integrations</strong> tab before uploading. 
          Images are automatically resized and optimized when uploaded.
        </Alert>

        <Grid container spacing={2.5}>
          <Grid item xs={12} sm={6} md={4}>
            <MediaUploadCard
              configKey="PLATFORM_LOGO_URL"
              assetType="logo"
              label="Platform Logo"
              description="Shown in admin header, emails, and documents"
              specLabel="400 × 120 px"
              currentUrl={logoUrl}
              onSaved={url => setLogoUrl(url)}
              enqueueSnackbar={enqueueSnackbar}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <MediaUploadCard
              configKey="PLATFORM_FAVICON_URL"
              assetType="favicon"
              label="Favicon"
              description="Browser tab icon — shows in bookmarks & address bar"
              specLabel="32 × 32 px"
              currentUrl={faviconUrl}
              onSaved={url => setFaviconUrl(url)}
              enqueueSnackbar={enqueueSnackbar}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <MediaUploadCard
              configKey="PLATFORM_OG_IMAGE_URL"
              assetType="og_image"
              label="OG / Social Share Image"
              description="Shown when links are shared on WhatsApp, Facebook, Twitter"
              specLabel="1200 × 630 px"
              currentUrl={ogImageUrl}
              onSaved={url => setOgImageUrl(url)}
              enqueueSnackbar={enqueueSnackbar}
            />
          </Grid>
        </Grid>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* ─────────────────────────────────────────────────────
          SECTION 2 — BUSINESS & LEGAL DETAILS
      ───────────────────────────────────────────────────── */}
      <Box mb={4}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2.5}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{
              width: 36, height: 36, borderRadius: 2, bgcolor: "warning.main",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <AccountBalance sx={{ color: "white", fontSize: 20 }} />
            </Box>
            <Box>
              <Typography fontWeight={700} fontSize={16}>Business & Legal Details</Typography>
              <Typography variant="caption" color="text.secondary">
                GST, PAN, CIN — used on invoices, tax documents & legal filings
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="contained"
            color="warning"
            startIcon={saving === "BIZ_ALL" ? <CircularProgress size={14} color="inherit" /> : <Save />}
            onClick={saveBusiness}
            disabled={saving === "BIZ_ALL"}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
          >
            Save Business Details
          </Button>
        </Stack>

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Grid container spacing={2.5}>
              {BIZ_FIELDS.map(f => (
                <Grid item xs={12} sm={f.multiline ? 12 : 6} key={f.key}>
                  <TextField
                    fullWidth
                    size="small"
                    label={f.label}
                    placeholder={f.placeholder}
                    type={f.type ?? "text"}
                    multiline={f.multiline}
                    rows={f.rows}
                    value={biz[f.key]}
                    onChange={e => setBiz(p => ({ ...p, [f.key]: e.target.value }))}
                    InputLabelProps={f.type === "date" ? { shrink: true } : undefined}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5 } }}
                  />
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* ─────────────────────────────────────────────────────
          SECTION 3 — OFFICE ADDRESSES
      ───────────────────────────────────────────────────── */}
      <Box mb={4}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2.5}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{
              width: 36, height: 36, borderRadius: 2, bgcolor: "success.main",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <AddLocationAlt sx={{ color: "white", fontSize: 20 }} />
            </Box>
            <Box>
              <Typography fontWeight={700} fontSize={16}>Office Addresses</Typography>
              <Typography variant="caption" color="text.secondary">
                Add multiple offices — the primary address appears on invoices & customer communications
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="contained"
            color="success"
            startIcon={<Add />}
            onClick={() => setAddrDialog({ open: true, idx: null })}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
          >
            Add Office
          </Button>
        </Stack>

        {addresses.length === 0 ? (
          <Paper
            variant="outlined"
            sx={{ p: 5, textAlign: "center", borderRadius: 3, borderStyle: "dashed" }}
          >
            <AddLocationAlt sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
            <Typography color="text.secondary" mb={2}>No office addresses added yet</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => setAddrDialog({ open: true, idx: null })}>
              Add First Office
            </Button>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {addresses.map((addr, idx) => (
              <Grid item xs={12} sm={6} md={4} key={idx}>
                <OfficeAddressCard
                  address={addr}
                  index={idx}
                  onEdit={() => setAddrDialog({ open: true, idx })}
                  onDelete={() => deleteAddress(idx)}
                  onSetPrimary={() => setPrimaryAddress(idx)}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* ─────────────────────────────────────────────────────
          SECTION 4 — GENERAL PLATFORM SETTINGS
      ───────────────────────────────────────────────────── */}
      <Box>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={2.5}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 2, bgcolor: "secondary.main",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <TuneOutlined sx={{ color: "white", fontSize: 20 }} />
          </Box>
          <Box>
            <Typography fontWeight={700} fontSize={16}>General Settings</Typography>
            <Typography variant="caption" color="text.secondary">
              Platform identity, locale, currency & booking rules
            </Typography>
          </Box>
        </Stack>

        <Grid container spacing={2.5}>
          {GENERAL_GROUPS.map(group => (
            <Grid item xs={12} md={4} key={group.title}>
              <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
                <CardHeader
                  title={<Typography fontWeight={700} fontSize={14}>{group.title}</Typography>}
                  sx={{ pb: 0, pt: 2 }}
                />
                <CardContent>
                  <Stack spacing={2}>
                    {group.keys.map(key => (
                      <Box key={key}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                          {configDesc[key] || key.replace(/_/g, " ")}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <TextField
                            fullWidth size="small"
                            value={platformKeys[key] ?? ""}
                            onChange={e => setPlatformKeys(p => ({ ...p, [key]: e.target.value }))}
                            placeholder={key}
                            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5 } }}
                          />
                          <Tooltip title="Save">
                            <span>
                              <IconButton
                                size="small" color="primary"
                                onClick={() => saveKey(key, platformKeys[key] ?? "")}
                                disabled={saving === key}
                                sx={{ flexShrink: 0 }}
                              >
                                {saving === key ? <CircularProgress size={16} /> : <Save fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* ── Address Dialog ─────────────────────────────────── */}
      <AddressDialog
        open={addrDialog.open}
        address={addrDialog.idx !== null ? addresses[addrDialog.idx] ?? null : null}
        onClose={() => setAddrDialog({ open: false, idx: null })}
        onSave={addOrEditAddress}
      />

      {/* ══ TAX / GST SETTINGS CARD ═════════════════════════════ */}
      <GstTaxCard
        platformKeys={platformKeys}
        setPlatformKeys={setPlatformKeys}
        saveKey={saveKey}
        saving={saving}
      />
    </Box>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 0 — GST / TAX CARD (sub-component of PlatformTab)
// Doc Ref: BRD §155 (GST Integration), §204 (GST Configuration)
//          Migration 0024 — GST_ENABLED / GST_RATE / COMMISSION_GST_RATE
// ══════════════════════════════════════════════════════════════

function GstTaxCard({ platformKeys, setPlatformKeys, saveKey, saving }: {
  platformKeys: Record<string, string>;
  setPlatformKeys: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saveKey: (key: string, value: string) => Promise<void>;
  saving: string | null;
}) {
  const gstEnabled     = (platformKeys["GST_ENABLED"] ?? "false").toLowerCase() === "true";
  const gstRate        = platformKeys["GST_RATE"] ?? "5";
  const commGstRate    = platformKeys["COMMISSION_GST_RATE"] ?? "18";

  const handleToggle = async () => {
    const newVal = gstEnabled ? "false" : "true";
    setPlatformKeys((p: Record<string, string>) => ({ ...p, GST_ENABLED: newVal }));
    await saveKey("GST_ENABLED", newVal);
    // The sidebar menu, the Tax & GST page and the Reports GST/TDS tabs all
    // key off GST_ENABLED — reload so they reflect the new state immediately.
    window.location.reload();
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
        <ReceiptLong sx={{ color: "warning.main", fontSize: 22 }} />
        <Box>
          <Typography variant="h6" fontWeight={800}>Tax / GST Configuration</Typography>
          <Typography variant="body2" color="text.secondary">
            BRD §155 — Indian GST on cab bookings. Applies to new trips after enabling.
          </Typography>
        </Box>
      </Stack>

      <Card variant="outlined" sx={{ borderRadius: 2, border: gstEnabled ? "1.5px solid" : undefined, borderColor: gstEnabled ? "warning.main" : undefined }}>
        <CardContent>
          <Stack spacing={3}>

            {/* GST Enabled toggle */}
            <Box sx={{
              p: 2.5, borderRadius: 2,
              bgcolor: gstEnabled ? "warning.50" : "action.hover",
              border: "1px solid",
              borderColor: gstEnabled ? "warning.main" : "divider",
              transition: "all 0.2s",
            }}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1}>
                <Box>
                  <Typography fontWeight={700} variant="body1">
                    {gstEnabled ? "✅  GST Enabled" : "GST Disabled"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>
                    {gstEnabled
                      ? `GST @ ${gstRate}% is added to each fare and shown on the tax invoice PDF.`
                      : "No GST is charged on bookings. Invoices are issued as non-tax receipts."}
                  </Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={gstEnabled}
                      onChange={handleToggle}
                      color="warning"
                      disabled={saving === "GST_ENABLED"}
                    />
                  }
                  label={
                    <Typography variant="body2" fontWeight={700} color={gstEnabled ? "warning.dark" : "text.secondary"}>
                      {saving === "GST_ENABLED" ? "Saving…" : gstEnabled ? "ON" : "OFF"}
                    </Typography>
                  }
                  labelPlacement="start"
                />
              </Stack>
            </Box>

            {/* Rate fields — only active when GST enabled */}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Customer GST Rate (%)"
                  type="number"
                  value={gstRate}
                  disabled={!gstEnabled}
                  onChange={e => setPlatformKeys((p: Record<string, string>) => ({ ...p, GST_RATE: e.target.value }))}
                  onBlur={() => saveKey("GST_RATE", gstRate)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end"><Percent sx={{ fontSize: 16 }} /></InputAdornment>,
                    startAdornment: saving === "GST_RATE" ? <InputAdornment position="start"><CircularProgress size={12} /></InputAdornment> : undefined,
                  }}
                  helperText="GST charged to customer on cab fare (Indian transport = 5%)"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Commission GST Rate (%)"
                  type="number"
                  value={commGstRate}
                  disabled={!gstEnabled}
                  onChange={e => setPlatformKeys((p: Record<string, string>) => ({ ...p, COMMISSION_GST_RATE: e.target.value }))}
                  onBlur={() => saveKey("COMMISSION_GST_RATE", commGstRate)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end"><Percent sx={{ fontSize: 16 }} /></InputAdornment>,
                    startAdornment: saving === "COMMISSION_GST_RATE" ? <InputAdornment position="start"><CircularProgress size={12} /></InputAdornment> : undefined,
                  }}
                  helperText="GST on platform commission charged to partners (standard B2B = 18%)"
                />
              </Grid>
            </Grid>

            {/* Info note on partner type logic */}
            <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: "info.50", border: "1px solid", borderColor: "info.light" }}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <InfoOutlined sx={{ fontSize: 18, color: "info.main", mt: 0.15, flexShrink: 0 }} />
                <Box>
                  <Typography variant="caption" fontWeight={700} color="info.dark" sx={{ display: "block", mb: 0.5 }}>
                    Partner Type &amp; GST Logic
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    <strong>INDIVIDUAL partner</strong> — not GST-registered. Platform collects GST from customer and records it separately during settlement.<br />
                    <strong>COMPANY partner</strong> — GST-registered (has GSTIN). They are responsible for their own GST filings; platform still records the GST amount for invoice compliance.<br />
                    TDS handling is Phase 2 (BRD §156) and will be added in a future migration.
                  </Typography>
                </Box>
              </Stack>
            </Box>

            {/* Existing bookings note */}
            <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: "action.hover", border: "1px solid", borderColor: "divider" }}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <CheckCircle sx={{ fontSize: 16, color: "success.main", mt: 0.15, flexShrink: 0 }} />
                <Typography variant="caption" color="text.secondary">
                  <strong>Existing bookings</strong> (before migration 0024) are automatically marked as <em>non-tax receipts</em> and will never show GST — regardless of this toggle.
                  Only new trips closed after enabling will generate tax invoices.
                </Typography>
              </Stack>
            </Box>

          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 1 — SYSTEM CONFIG (all key-value, inline edit)
// ══════════════════════════════════════════════════════════════

function SystemConfigTab({ enqueueSnackbar }: any) {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [addKey, setAddKey] = useState("");
  const [addVal, setAddVal] = useState("");
  const [addDesc, setAddDesc] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingsService.getConfigurations();
      setConfigs(data);
      const map: Record<string, string> = {};
      data.forEach(c => { map[c.config_key] = c.config_value ?? ""; });
      setEdits(map);
    } catch { enqueueSnackbar("Failed to load configurations", { variant: "error" }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (key: string, desc?: string) => {
    setSaving(key);
    try {
      await settingsService.upsertConfiguration(key, edits[key] ?? "", desc);
      enqueueSnackbar(`Saved ${key}`, { variant: "success" });
      load();
    } catch { enqueueSnackbar("Save failed", { variant: "error" }); }
    finally { setSaving(null); }
  };

  const del = async (key: string) => {
    try {
      await settingsService.deleteConfiguration(key);
      enqueueSnackbar(`Deleted ${key}`, { variant: "success" });
      load();
    } catch { enqueueSnackbar("Delete failed", { variant: "error" }); }
  };

  const addNew = async () => {
    if (!addKey.trim()) return;
    await save(addKey.trim());
    setAddKey(""); setAddVal(""); setAddDesc("");
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardHeader
        title={<Typography fontWeight={700}>All System Configurations</Typography>}
        action={
          <Tooltip title="Refresh">
            <IconButton onClick={load}><Refresh /></IconButton>
          </Tooltip>
        }
      />
      <CardContent>
        {/* Add new */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: "action.hover" }}>
          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 1, display: "block" }}>
            ADD NEW KEY
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField size="small" label="Key" value={addKey} onChange={e => setAddKey(e.target.value)} sx={{ flex: 1 }} />
            <TextField size="small" label="Value" value={addVal}
              onChange={e => { setAddVal(e.target.value); setEdits(p => ({ ...p, [addKey]: e.target.value })); }} sx={{ flex: 1 }} />
            <TextField size="small" label="Description" value={addDesc} onChange={e => setAddDesc(e.target.value)} sx={{ flex: 2 }} />
            <Button variant="contained" startIcon={<Add />} onClick={addNew} sx={{ flexShrink: 0 }}>Add</Button>
          </Stack>
        </Paper>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "action.hover" } }}>
                  <TableCell>Key</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Updated</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {configs.map(cfg => (
                  <TableRow key={cfg.config_key} hover>
                    <TableCell>
                      <Typography variant="caption" fontFamily="monospace" fontWeight={600} color="primary.main">
                        {cfg.config_key}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={edits[cfg.config_key] ?? ""}
                        onChange={e => setEdits(p => ({ ...p, [cfg.config_key]: e.target.value }))}
                        sx={{ minWidth: 150 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">{cfg.description}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(cfg.updated_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Save">
                          <span>
                            <IconButton size="small" color="primary" onClick={() => save(cfg.config_key, cfg.description ?? undefined)} disabled={saving === cfg.config_key}>
                              {saving === cfg.config_key ? <CircularProgress size={14} /> : <Save fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => del(cfg.config_key)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 2 — API INTEGRATIONS (Cloudinary, Firebase, Google Maps…)
// ══════════════════════════════════════════════════════════════

function ApiIntegrationsTab({ enqueueSnackbar }: any) {
  const [integrations, setIntegrations] = useState<ApiIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editMap, setEditMap] = useState<Record<number, Record<string, string>>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newType, setNewType] = useState("CLOUDINARY");
  const [newName, setNewName] = useState("Cloudinary");
  const [newConfig, setNewConfig] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await (settingsService as any).getApiIntegrations();
      setIntegrations(data);
      const map: Record<number, Record<string, string>> = {};
      data.forEach((ai: ApiIntegration) => { map[ai.id] = ai.configuration ?? {}; });
      setEditMap(map);
    } catch { enqueueSnackbar("Failed to load integrations", { variant: "error" }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (ai: ApiIntegration) => {
    setSaving(ai.id);
    try {
      await (settingsService as any).updateApiIntegration(ai.id, {
        configuration: editMap[ai.id] ?? {},
        is_active: ai.is_active,
      });
      enqueueSnackbar(`${ai.service_name} saved`, { variant: "success" });
      load();
    } catch { enqueueSnackbar("Save failed", { variant: "error" }); }
    finally { setSaving(null); }
  };

  const toggleActive = async (ai: ApiIntegration) => {
    try {
      await (settingsService as any).updateApiIntegration(ai.id, { is_active: !ai.is_active });
      enqueueSnackbar(`${ai.service_name} ${!ai.is_active ? "enabled" : "disabled"}`, { variant: "success" });
      load();
    } catch { enqueueSnackbar("Update failed", { variant: "error" }); }
  };

  const del = async (id: number) => {
    try {
      await (settingsService as any).deleteApiIntegration(id);
      enqueueSnackbar("Deleted", { variant: "success" });
      load();
    } catch { enqueueSnackbar("Delete failed", { variant: "error" }); }
  };

  const addNew = async () => {
    try {
      await (settingsService as any).createApiIntegration({
        service_name: newName,
        service_type: newType,
        configuration: newConfig,
        is_active: false,
      });
      enqueueSnackbar(`${newName} added`, { variant: "success" });
      setAddOpen(false);
      setNewConfig({});
      load();
    } catch { enqueueSnackbar("Add failed", { variant: "error" }); }
  };

  const SERVICE_ICONS: Record<string, string> = {
    CLOUDINARY: "☁️", FIREBASE: "🔥", GOOGLE_MAPS: "🗺️",
    RAZORPAY: "💳", MSG91: "📱", WHATSAPP: "💬", FCM: "📲", MINIO: "🗄️", SMTP: "📧",
  };

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;

  return (
    <>
      <Stack direction="row" justifyContent="flex-end" mb={2}>
        <Button variant="contained" startIcon={<Add />} onClick={() => setAddOpen(true)}>
          Add Integration
        </Button>
      </Stack>

      <Stack spacing={2}>
        {integrations.map(ai => {
          const fields = INTEGRATION_FIELDS[ai.service_type] ?? Object.keys(ai.configuration ?? {});
          const isExpanded = expanded === ai.id;
          return (
            <Card key={ai.id} variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ pb: "12px !important" }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Typography fontSize={24}>{SERVICE_ICONS[ai.service_type] ?? "🔌"}</Typography>
                  <Box flex={1}>
                    <Typography fontWeight={700}>{ai.service_name}</Typography>
                    <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                      {ai.service_type}
                    </Typography>
                  </Box>
                  <Chip
                    label={ai.is_active ? "Active" : "Inactive"}
                    color={ai.is_active ? "success" : "default"}
                    size="small"
                    onClick={() => toggleActive(ai)}
                    clickable
                  />
                  <Tooltip title={isExpanded ? "Collapse" : "Configure"}>
                    <IconButton size="small" onClick={() => setExpanded(isExpanded ? null : ai.id)}>
                      {isExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => del(ai.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>

                <Collapse in={isExpanded}>
                  <Divider sx={{ my: 2 }} />
                  <Grid container spacing={2}>
                    {fields.map(field => (
                      <Grid item xs={12} sm={6} key={field}>
                        <TextField
                          fullWidth
                          size="small"
                          label={field.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                          value={editMap[ai.id]?.[field] ?? ""}
                          onChange={e => setEditMap(p => ({
                            ...p,
                            [ai.id]: { ...p[ai.id], [field]: e.target.value }
                          }))}
                          type={field.toLowerCase().includes("secret") || field.toLowerCase().includes("key") || field.toLowerCase().includes("password") ? "password" : "text"}
                          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5 } }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                  <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
                    <Button
                      variant="contained"
                      startIcon={saving === ai.id ? <CircularProgress size={14} color="inherit" /> : <Save />}
                      onClick={() => save(ai)}
                      disabled={saving === ai.id}
                    >
                      Save Configuration
                    </Button>
                  </Box>
                </Collapse>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      {/* Add dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add API Integration</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Service Type</InputLabel>
              <Select
                value={newType}
                label="Service Type"
                onChange={e => {
                  setNewType(e.target.value);
                  setNewName(e.target.value.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()));
                  const fields = INTEGRATION_FIELDS[e.target.value] ?? [];
                  const cfg: Record<string, string> = {};
                  fields.forEach(f => { cfg[f] = ""; });
                  setNewConfig(cfg);
                }}
              >
                {Object.keys(INTEGRATION_FIELDS).map(t => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField size="small" fullWidth label="Display Name" value={newName} onChange={e => setNewName(e.target.value)} />
            {(INTEGRATION_FIELDS[newType] ?? []).map(field => (
              <TextField
                key={field}
                size="small"
                fullWidth
                label={field.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                value={newConfig[field] ?? ""}
                onChange={e => setNewConfig(p => ({ ...p, [field]: e.target.value }))}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={addNew}>Add</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 3 — APP VERSIONS
// ══════════════════════════════════════════════════════════════

function AppVersionsTab({ enqueueSnackbar }: any) {
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ platform: "ANDROID", version: "", is_force_update: false, release_notes: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try { setVersions(await settingsService.getAppVersions()); }
    catch { enqueueSnackbar("Failed to load app versions", { variant: "error" }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    try {
      await settingsService.createAppVersion(form as any);
      enqueueSnackbar("App version created", { variant: "success" });
      setDialogOpen(false);
      setForm({ platform: "ANDROID", version: "", is_force_update: false, release_notes: "" });
      load();
    } catch { enqueueSnackbar("Failed to create version", { variant: "error" }); }
  };

  const del = async (id: number) => {
    try {
      await settingsService.deleteAppVersion(id);
      enqueueSnackbar("Deleted", { variant: "success" });
      load();
    } catch { enqueueSnackbar("Delete failed", { variant: "error" }); }
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardHeader
        title={<Typography fontWeight={700}>App Versions</Typography>}
        action={
          <Stack direction="row" spacing={1}>
            <IconButton onClick={load}><Refresh /></IconButton>
            <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>Add Version</Button>
          </Stack>
        }
      />
      <CardContent>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "action.hover" } }}>
                  <TableCell>Platform</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Force Update</TableCell>
                  <TableCell>Release Notes</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {versions.map(v => (
                  <TableRow key={v.id} hover>
                    <TableCell>
                      <Chip
                        label={v.platform}
                        size="small"
                        color={v.platform === "ANDROID" ? "success" : "primary"}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell><Typography fontWeight={600}>{v.version}</Typography></TableCell>
                    <TableCell>
                      <Chip
                        label={v.is_force_update ? "Force Update" : "Optional"}
                        size="small"
                        color={v.is_force_update ? "error" : "default"}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 200, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.release_notes}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(v.created_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="error" onClick={() => del(v.id)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add App Version</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Platform</InputLabel>
              <Select value={form.platform} label="Platform" onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}>
                <MenuItem value="ANDROID">Android</MenuItem>
                <MenuItem value="IOS">iOS</MenuItem>
              </Select>
            </FormControl>
            <TextField size="small" fullWidth label="Version (e.g. 1.2.3)" value={form.version} onChange={e => setForm(p => ({ ...p, version: e.target.value }))} />
            <TextField size="small" fullWidth multiline rows={3} label="Release Notes" value={form.release_notes} onChange={e => setForm(p => ({ ...p, release_notes: e.target.value }))} />
            <FormControlLabel
              control={<Switch checked={form.is_force_update} onChange={e => setForm(p => ({ ...p, is_force_update: e.target.checked }))} />}
              label="Force Update"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save}>Create</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 4 — COMMISSION GROUPS  (full CRUD: groups + rules)
// Doc Ref: DB Schema Part 2 §14-15 | BRD §138-140
// service_type: CAB | HOTEL | TOUR
// commission_type: PERCENTAGE | FLAT
// ══════════════════════════════════════════════════════════════

const SERVICE_TYPE_COLOR: Record<string, "primary" | "warning" | "secondary"> = {
  CAB: "primary", HOTEL: "warning", TOUR: "secondary",
};
const SERVICE_TYPE_ICON: Record<string, string> = { CAB: "🚕", HOTEL: "🏨", TOUR: "🗺️" };

// ── Add Rule Dialog ───────────────────────────────────────────
function AddRuleDialog({
  open, groupId, onClose, onSaved, enqueueSnackbar,
}: { open: boolean; groupId: number; onClose: () => void; onSaved: () => void; enqueueSnackbar: any }) {
  const EMPTY = { service_type: "CAB", commission_type: "PERCENTAGE", commission_value: "", city_id: "", effective_from: "", effective_to: "", is_active: true };
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [dbServiceTypes, setDbServiceTypes] = useState<Array<{ type_code: string; label: string }>>([]);
  useEffect(() => {
    (settingsService as any).getCities(true).then((data: City[]) => setCities(data)).catch(() => {});
    (settingsService as any).getServiceTypes().then((data: any[]) => {
      const active = data.filter((st: any) => st.is_active !== false);
      setDbServiceTypes(active);
    }).catch(() => {});
  }, []);

  const save = async () => {
    if (!form.commission_value) return;
    setSaving(true);
    try {
      await settingsService.addCommissionRule(groupId, {
        service_type: form.service_type,
        commission_type: form.commission_type as any,
        commission_value: Number(form.commission_value),
        city_id: form.city_id ? Number(form.city_id) : undefined,
        effective_from: form.effective_from || undefined,
        effective_to: form.effective_to || undefined,
        is_active: form.is_active,
      });
      enqueueSnackbar("Rule added", { variant: "success" });
      setForm({ ...EMPTY });
      onSaved();
    } catch { enqueueSnackbar("Failed to add rule", { variant: "error" }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography fontWeight={700} fontSize={18}>Add Commission Rule</Typography>
        <Typography variant="caption" color="text.secondary">Define rate for a service type within this group</Typography>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Service Type</InputLabel>
              <Select value={form.service_type} label="Service Type" onChange={e => setForm(p => ({ ...p, service_type: e.target.value }))}>
                {(dbServiceTypes.length > 0 ? dbServiceTypes : [{ type_code: "CAB", label: "CAB" }, { type_code: "HOTEL", label: "HOTEL" }, { type_code: "TOUR", label: "TOUR" }]).map(st => (
                  <MenuItem key={st.type_code} value={st.type_code}>
                    {(SERVICE_TYPE_ICON as any)[st.type_code] ?? "🔧"} {st.label || st.type_code}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Commission Type</InputLabel>
              <Select value={form.commission_type} label="Commission Type" onChange={e => setForm(p => ({ ...p, commission_type: e.target.value }))}>
                <MenuItem value="PERCENTAGE">Percentage (%)</MenuItem>
                <MenuItem value="FLAT">Flat (₹)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth size="small" required
              label={form.commission_type === "PERCENTAGE" ? "Commission (%)" : "Commission (₹)"}
              type="number" inputProps={{ min: 0, step: "0.01" }}
              value={form.commission_value}
              onChange={e => setForm(p => ({ ...p, commission_value: e.target.value }))}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    {form.commission_type === "PERCENTAGE" ? "%" : "₹"}
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>City (blank = all)</InputLabel>
              <Select
                value={form.city_id}
                label="City (blank = all)"
                onChange={e => setForm(p => ({ ...p, city_id: e.target.value as string }))}
              >
                <MenuItem value=""><em>All Cities</em></MenuItem>
                {cities.map(c => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    {c.name}{c.state_name ? ` · ${c.state_name}` : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth size="small" type="date" label="Effective From"
              InputLabelProps={{ shrink: true }}
              value={form.effective_from}
              onChange={e => setForm(p => ({ ...p, effective_from: e.target.value }))}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth size="small" type="date" label="Effective To"
              InputLabelProps={{ shrink: true }}
              value={form.effective_to}
              onChange={e => setForm(p => ({ ...p, effective_to: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={<Switch checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} color="success" />}
              label="Active immediately"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained" onClick={save} disabled={saving || !form.commission_value}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Add />}
        >
          Add Rule
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Edit Group Dialog ─────────────────────────────────────────
function EditGroupDialog({
  open, group, onClose, onSaved, enqueueSnackbar,
}: { open: boolean; group: CommissionGroup | null; onClose: () => void; onSaved: () => void; enqueueSnackbar: any }) {
  const [form, setForm] = useState({ group_name: "", description: "", is_active: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (group) setForm({ group_name: group.group_name, description: group.description ?? "", is_active: group.is_active });
  }, [group]);

  const save = async () => {
    if (!group) return;
    setSaving(true);
    try {
      await settingsService.updateCommissionGroup(group.id, form);
      enqueueSnackbar("Group updated", { variant: "success" });
      onSaved();
    } catch { enqueueSnackbar("Update failed", { variant: "error" }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle>Edit Commission Group</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField size="small" fullWidth label="Group Name" value={form.group_name} onChange={e => setForm(p => ({ ...p, group_name: e.target.value }))} />
          <TextField size="small" fullWidth multiline rows={2} label="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          <FormControlLabel
            control={<Switch checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} color="success" />}
            label="Active"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save />}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Commission Tab ───────────────────────────────────────
function CommissionTab({ enqueueSnackbar }: any) {
  const [groups, setGroups] = useState<CommissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [cityMap, setCityMap] = useState<Record<number, string>>({});

  // New group dialog
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newForm, setNewForm] = useState({ group_name: "", description: "" });
  const [creating, setCreating] = useState(false);

  // Edit group dialog
  const [editGroup, setEditGroup] = useState<CommissionGroup | null>(null);

  // Add rule dialog
  const [addRuleGroupId, setAddRuleGroupId] = useState<number | null>(null);

  // Delete rule confirm
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setGroups(await settingsService.getCommissionGroups()); }
    catch { enqueueSnackbar("Failed to load commission groups", { variant: "error" }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    (settingsService as any).getCities(true)
      .then((data: City[]) => {
        const m: Record<number, string> = {};
        data.forEach((c: City) => { m[c.id] = c.name; });
        setCityMap(m);
      })
      .catch(() => {});
  }, [load]);

  const createGroup = async () => {
    if (!newForm.group_name.trim()) return;
    setCreating(true);
    try {
      const grp = await settingsService.createCommissionGroup(newForm);
      enqueueSnackbar(`"${grp.group_name}" group created`, { variant: "success" });
      setNewGroupOpen(false);
      setNewForm({ group_name: "", description: "" });
      setExpanded(grp.id);
      load();
    } catch { enqueueSnackbar("Create failed", { variant: "error" }); }
    finally { setCreating(false); }
  };

  const deleteGroup = async (id: number, name: string) => {
    if (!window.confirm(`Delete group "${name}"? This will also delete all its rules.`)) return;
    try {
      await settingsService.deleteCommissionGroup(id);
      enqueueSnackbar("Group deleted", { variant: "success" });
      if (expanded === id) setExpanded(null);
      load();
    } catch { enqueueSnackbar("Delete failed", { variant: "error" }); }
  };

  const deleteRule = async (ruleId: number) => {
    setDeletingRuleId(ruleId);
    try {
      await settingsService.deleteCommissionRule(ruleId);
      enqueueSnackbar("Rule deleted", { variant: "success" });
      load();
    } catch { enqueueSnackbar("Delete failed", { variant: "error" }); }
    finally { setDeletingRuleId(null); }
  };

  const toggleRuleActive = async (rule: CommissionGroup["rules"][0]) => {
    try {
      await settingsService.updateCommissionRule(rule.id, { is_active: !rule.is_active });
      enqueueSnackbar(rule.is_active ? "Rule deactivated" : "Rule activated", { variant: "success" });
      load();
    } catch { enqueueSnackbar("Update failed", { variant: "error" }); }
  };

  return (
    <>
      {/* ── Header ─────────────────────────────────────────── */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Commission Groups & Rules</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage partner commission structures — service-wise rates (CAB · HOTEL · TOUR)
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={load} disabled={loading}><Refresh /></IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<Add />} onClick={() => setNewGroupOpen(true)}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}>
            New Group
          </Button>
        </Stack>
      </Box>

      {/* ── Groups List ────────────────────────────────────── */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : groups.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center", borderRadius: 3, borderStyle: "dashed" }}>
          <Typography color="text.secondary" mb={2}>No commission groups yet</Typography>
          <Button variant="contained" startIcon={<Add />} onClick={() => setNewGroupOpen(true)}>Create First Group</Button>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {groups.map(grp => {
            const isOpen = expanded === grp.id;
            return (
              <Card
                key={grp.id}
                variant="outlined"
                sx={{
                  borderRadius: 3,
                  overflow: "hidden",
                  borderColor: isOpen ? "primary.main" : "divider",
                  transition: "border-color 0.2s",
                  boxShadow: isOpen ? "0 0 0 1px rgba(25,118,210,0.15)" : "none",
                }}
              >
                {/* ── Group Header Row ── */}
                <Box
                  sx={{ px: 2.5, py: 2, display: "flex", alignItems: "center", gap: 1.5, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
                  onClick={() => setExpanded(isOpen ? null : grp.id)}
                >
                  {/* icon */}
                  <Box sx={{
                    width: 40, height: 40, borderRadius: 2,
                    bgcolor: grp.is_active ? "primary.main" : "action.disabledBackground",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Groups sx={{ color: "white", fontSize: 20 }} />
                  </Box>

                  {/* name + desc */}
                  <Box flex={1} minWidth={0}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography fontWeight={700} fontSize={15}>{grp.group_name}</Typography>
                      {grp.group_name === "DEFAULT" && (
                        <Chip label="Default" size="small" color="primary" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {grp.description || "No description"}
                    </Typography>
                  </Box>

                  {/* meta chips */}
                  <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
                    <Chip
                      label={grp.rules?.length === 0 ? "0 rules" : `${grp.rules?.length} rule${grp.rules?.length !== 1 ? "s" : ""}`}
                      size="small"
                      variant="outlined"
                      color={grp.rules?.length > 0 ? "primary" : "default"}
                    />
                    <Chip
                      label={grp.is_active ? "Active" : "Inactive"}
                      size="small"
                      color={grp.is_active ? "success" : "default"}
                    />
                  </Stack>

                  {/* actions */}
                  <Stack direction="row" spacing={0.5} onClick={e => e.stopPropagation()}>
                    <Tooltip title="Edit Group">
                      <IconButton size="small" onClick={() => setEditGroup(grp)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Group">
                      <IconButton size="small" color="error" onClick={() => deleteGroup(grp.id, grp.group_name)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <IconButton size="small">
                      {isOpen ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                    </IconButton>
                  </Stack>
                </Box>

                {/* ── Expanded Rules Panel ── */}
                <Collapse in={isOpen}>
                  <Divider />
                  <Box sx={{ p: 2.5 }}>
                    {/* rules table header */}
                    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                      <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5, fontSize: 11 }}>
                        Commission Rules
                      </Typography>
                      <Button
                        size="small" variant="outlined" startIcon={<Add />}
                        onClick={() => setAddRuleGroupId(grp.id)}
                        sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 600 }}
                      >
                        Add Rule
                      </Button>
                    </Stack>

                    {grp.rules?.length === 0 ? (
                      <Paper
                        variant="outlined"
                        sx={{ p: 3, textAlign: "center", borderRadius: 2, borderStyle: "dashed", bgcolor: "action.hover" }}
                      >
                        <Typography variant="body2" color="text.secondary" mb={1}>
                          No rules yet. Add a rule to define commission rates.
                        </Typography>
                        <Button
                          size="small" variant="contained" startIcon={<Add />}
                          onClick={() => setAddRuleGroupId(grp.id)}
                          sx={{ borderRadius: 1.5, textTransform: "none" }}
                        >
                          Add a Rule
                        </Button>
                      </Paper>
                    ) : (
                      <Stack spacing={1.5}>
                        {grp.rules?.map(r => (
                          <Paper
                            key={r.id}
                            variant="outlined"
                            sx={{
                              p: 1.5, borderRadius: 2, display: "flex", alignItems: "center", gap: 1.5,
                              opacity: r.is_active ? 1 : 0.55,
                              borderColor: r.is_active ? "divider" : "action.disabledBackground",
                            }}
                          >
                            {/* service icon */}
                            <Box sx={{
                              width: 36, height: 36, borderRadius: 1.5, flexShrink: 0,
                              bgcolor: `${SERVICE_TYPE_COLOR[r.service_type ?? ""] ?? "grey"}.50`,
                              border: 1, borderColor: `${SERVICE_TYPE_COLOR[r.service_type ?? ""] ?? "grey"}.200`,
                              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                            }}>
                              {SERVICE_TYPE_ICON[r.service_type ?? ""] ?? "💰"}
                            </Box>

                            {/* service type */}
                            <Chip
                              label={r.service_type}
                              size="small"
                              color={SERVICE_TYPE_COLOR[r.service_type ?? ""] ?? "default"}
                              sx={{ fontWeight: 700, minWidth: 60 }}
                            />

                            {/* rate value — big and clear */}
                            <Box sx={{ flex: 1 }}>
                              <Typography fontWeight={800} fontSize={17} lineHeight={1}>
                                {r.commission_type === "PERCENTAGE"
                                  ? `${r.commission_value}%`
                                  : `₹${r.commission_value}`}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {r.commission_type === "PERCENTAGE" ? "of booking value" : "flat per booking"}
                                {r.city_id ? ` · ${cityMap[r.city_id] ?? `City ${r.city_id}`}` : " · All cities"}
                              </Typography>
                            </Box>

                            {/* dates */}
                            <Box sx={{ textAlign: "right", minWidth: 100 }}>
                              {r.effective_from ? (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {r.effective_from} → {r.effective_to ?? "∞"}
                                </Typography>
                              ) : (
                                <Typography variant="caption" color="text.secondary">Always active</Typography>
                              )}
                            </Box>

                            {/* active toggle + delete */}
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <Tooltip title={r.is_active ? "Deactivate rule" : "Activate rule"}>
                                <Switch
                                  size="small"
                                  checked={r.is_active}
                                  onChange={() => toggleRuleActive(r)}
                                  color="success"
                                />
                              </Tooltip>
                              <Tooltip title="Delete rule">
                                <span>
                                  <IconButton
                                    size="small" color="error"
                                    onClick={() => deleteRule(r.id)}
                                    disabled={deletingRuleId === r.id}
                                  >
                                    {deletingRuleId === r.id
                                      ? <CircularProgress size={14} />
                                      : <Delete fontSize="small" />}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                          </Paper>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Collapse>
              </Card>
            );
          })}
        </Stack>
      )}

      {/* ── New Group Dialog ──────────────────────────────── */}
      <Dialog open={newGroupOpen} onClose={() => setNewGroupOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography fontWeight={700} fontSize={18}>New Commission Group</Typography>
          <Typography variant="caption" color="text.secondary">
            Group partners together under a shared commission structure
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              size="small" fullWidth required
              label="Group Name (e.g. Group A, Premium)"
              value={newForm.group_name}
              onChange={e => setNewForm(p => ({ ...p, group_name: e.target.value }))}
              helperText="Must be unique. Partners will be assigned to this group."
            />
            <TextField
              size="small" fullWidth multiline rows={2}
              label="Description (optional)"
              value={newForm.description}
              onChange={e => setNewForm(p => ({ ...p, description: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNewGroupOpen(false)} disabled={creating}>Cancel</Button>
          <Button
            variant="contained" onClick={createGroup}
            disabled={creating || !newForm.group_name.trim()}
            startIcon={creating ? <CircularProgress size={14} color="inherit" /> : <Add />}
          >
            Create Group
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Group Dialog ─────────────────────────────── */}
      <EditGroupDialog
        open={!!editGroup}
        group={editGroup}
        onClose={() => setEditGroup(null)}
        onSaved={() => { setEditGroup(null); load(); }}
        enqueueSnackbar={enqueueSnackbar}
      />

      {/* ── Add Rule Dialog ───────────────────────────────── */}
      {addRuleGroupId !== null && (
        <AddRuleDialog
          open={addRuleGroupId !== null}
          groupId={addRuleGroupId}
          onClose={() => setAddRuleGroupId(null)}
          onSaved={() => { setAddRuleGroupId(null); load(); }}
          enqueueSnackbar={enqueueSnackbar}
        />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 5 — PRICING RULES
// ══════════════════════════════════════════════════════════════

function PricingTab({ enqueueSnackbar }: any) {
  const EMPTY_FORM = {
    city_id: "", vehicle_category_id: "", trip_type: "LOCAL",
    base_fare: "", per_km_rate: "",
    minimum_km: "", driver_allowance: "", night_charge: "",
    effective_from: "", effective_to: "",
  };

  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [duplicateWarning, setDuplicateWarning] = useState("");

  // Live city + category data
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [masterLoading, setMasterLoading] = useState(true);

  // Lookup maps: id → display name
  const cityMap = Object.fromEntries(cities.map(c => [c.id, c.name])) as Record<number, string>;
  const catMap = Object.fromEntries(categories.map(c => [c.id, c.category_name])) as Record<number, string>;

  const load = useCallback(async () => {
    setLoading(true);
    try { setRules(await settingsService.getPricingRules()); }
    catch { enqueueSnackbar("Failed to load pricing rules", { variant: "error" }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    setMasterLoading(true);
    Promise.all([
      (settingsService as any).getCities(true),
      (settingsService as any).getVehicleCategories(true),
    ]).then(([c, v]) => { setCities(c); setCategories(v); })
      .catch(() => {})
      .finally(() => setMasterLoading(false));
  }, [load]);

  // ── Default Pricing Rules State ────────────────────────────────────────────
  const [defaultRules, setDefaultRules] = useState<DefaultPricingRule[]>([]);
  const [defaultLoading, setDefaultLoading] = useState(true);
  const [defaultEdits, setDefaultEdits] = useState<Record<number, Partial<DefaultPricingRule>>>({});
  const [defaultSaving, setDefaultSaving] = useState<Record<number, boolean>>({});
  const [showDefaultSection, setShowDefaultSection] = useState(false);

  const loadDefaultRules = useCallback(async () => {
    setDefaultLoading(true);
    try {
      const data = await (settingsService as any).getDefaultPricingRules() as DefaultPricingRule[];
      setDefaultRules(data);
    } catch {
      enqueueSnackbar("Failed to load default pricing rules", { variant: "error" });
    } finally {
      setDefaultLoading(false);
    }
  }, [enqueueSnackbar]);

  const updateDefaultField = (id: number, field: keyof DefaultPricingRule, value: string) => {
    setDefaultEdits(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? {}),
        // Enum/text fields (driver_allowance_type) are stored as strings;
        // everything else in this table is a numeric price component.
        [field]: field === "driver_allowance_type" || field === "night_charge_type"
          ? value
          : value === ""
            ? 0
            : Number(value),
      },
    }));
  };

  const saveDefaultRule = async (rule: DefaultPricingRule) => {
    const edits = defaultEdits[rule.id];
    if (!edits || Object.keys(edits).length === 0) return;
    setDefaultSaving(prev => ({ ...prev, [rule.id]: true }));
    try {
      await (settingsService as any).updateDefaultPricingRule(rule.id, edits);
      enqueueSnackbar(`Default rule updated for ${catMap[rule.vehicle_category_id] ?? "category"} · ${rule.trip_type}`, { variant: "success" });
      setDefaultEdits(prev => { const n = { ...prev }; delete n[rule.id]; return n; });
      loadDefaultRules();
    } catch {
      enqueueSnackbar("Failed to save default pricing rule", { variant: "error" });
    } finally {
      setDefaultSaving(prev => ({ ...prev, [rule.id]: false }));
    }
  };

  const cancelDefaultEdit = (id: number) => {
    setDefaultEdits(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  // Load default pricing rules on mount (declared here so it's available when called)
  useEffect(() => {
    loadDefaultRules();
  }, [loadDefaultRules]);

  // Group default rules by vehicle_category_id for the matrix display
  const defaultByCategory = defaultRules.reduce((acc, r) => {
    const key = r.vehicle_category_id;
    if (!acc[key]) acc[key] = {};
    acc[key][r.trip_type] = r;
    return acc;
  }, {} as Record<number, Record<string, DefaultPricingRule>>);

  // Check duplicate: same city + category + trip_type already exists
  const checkDuplicate = (cityId: string, catId: string, tripType: string) => {
    if (!cityId || !catId) { setDuplicateWarning(""); return; }
    const exists = rules.find(r =>
      String(r.city_id) === cityId &&
      String(r.vehicle_category_id) === catId &&
      r.trip_type === tripType
    );
    if (exists) {
      const cname = cityMap[Number(cityId)] ?? `City ${cityId}`;
      const vname = catMap[Number(catId)] ?? `Category ${catId}`;
      setDuplicateWarning(`A rule for ${vname} · ${cname} · ${tripType} already exists. Creating another will cause ambiguity.`);
    } else {
      setDuplicateWarning("");
    }
  };

  const setField = (key: string, value: string) => {
    const next = { ...form, [key]: value };
    setForm(next);
    if (["city_id", "vehicle_category_id", "trip_type"].includes(key)) {
      checkDuplicate(
        key === "city_id" ? value : form.city_id,
        key === "vehicle_category_id" ? value : form.vehicle_category_id,
        key === "trip_type" ? value : form.trip_type,
      );
    }
  };

  const add = async () => {
    if (!form.city_id || !form.vehicle_category_id || !form.base_fare || !form.per_km_rate) return;
    try {
      await settingsService.createPricingRule({
        city_id: Number(form.city_id),
        vehicle_category_id: Number(form.vehicle_category_id),
        trip_type: form.trip_type,
        base_fare: Number(form.base_fare),
        per_km_rate: Number(form.per_km_rate),
        ...(form.minimum_km ? { minimum_km: Number(form.minimum_km) } : {}),
        ...(form.driver_allowance ? { driver_allowance: Number(form.driver_allowance) } : {}),
        ...(form.night_charge ? { night_charge: Number(form.night_charge) } : {}),
        ...(form.effective_from ? { effective_from: form.effective_from } : {}),
        ...(form.effective_to ? { effective_to: form.effective_to } : {}),
      });
      enqueueSnackbar("Pricing rule created", { variant: "success" });
      setDialogOpen(false);
      setForm({ ...EMPTY_FORM });
      setDuplicateWarning("");
      load();
    } catch { enqueueSnackbar("Create failed — rule may conflict with an existing one", { variant: "error" }); }
  };

  const del = async (id: number) => {
    if (!window.confirm("Delete this pricing rule?")) return;
    try {
      await settingsService.deletePricingRule(id);
      enqueueSnackbar("Rule deleted", { variant: "success" });
      load();
    } catch { enqueueSnackbar("Delete failed", { variant: "error" }); }
  };

  const openDialog = () => {
    setForm({ ...EMPTY_FORM });
    setDuplicateWarning("");
    setDialogOpen(true);
  };

  const TRIP_TYPE_COLOR: Record<string, any> = {
    LOCAL: "default", AIRPORT: "primary", OUTSTATION: "warning",
    ONE_WAY: "info", ROUND_TRIP: "secondary",
  };

  // Group rules by vehicle category for the table — makes duplicates obvious
  const rulesByCategory = rules.reduce((acc, r) => {
    const key = catMap[r.vehicle_category_id] ?? `Category ${r.vehicle_category_id}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {} as Record<string, any[]>);

  const isFormValid = !!form.city_id && !!form.vehicle_category_id && !!form.base_fare && !!form.per_km_rate;

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardHeader
        title={
          <Box>
            <Typography fontWeight={700}>Vehicle Pricing Rules</Typography>
            <Typography variant="caption" color="text.secondary">
              City × Vehicle Category × Trip Type combinations — each combination should have at most one rule
            </Typography>
          </Box>
        }
        action={
          <Stack direction="row" spacing={1}>
            <IconButton onClick={load} disabled={loading}><Refresh /></IconButton>
            <Button variant="contained" startIcon={<Add />} onClick={openDialog} sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}>
              Add Rule
            </Button>
          </Stack>
        }
      />
      <CardContent>
        {/* Fare Formula Explanation Banner */}
        <Box sx={{
          mb: 2, p: 1.5, borderRadius: 2,
          bgcolor: "info.50",
          border: "1px solid",
          borderColor: "info.200",
          display: "flex", gap: 1.5, alignItems: "flex-start",
        }}>
          <Box sx={{ fontSize: 18, mt: 0.1 }}>💡</Box>
          <Box>
            <Typography variant="caption" fontWeight={800} color="info.dark" sx={{ letterSpacing: 0.5, textTransform: "uppercase", display: "block", mb: 0.5 }}>
              Fare Calculation Formula
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              <strong>Final Fare = Base Fare + max(0, Actual KM − Included KM) × Per KM Rate</strong>
              <br />
              <strong>Included KM</strong> = the km already covered by the base fare (no extra charge up to this distance).
              Beyond that, every additional km is charged at the Per KM Rate.
              <br />
              <em>Example: Base ₹200, Incl. 5 km, ₹12/km → A 12 km trip = ₹200 + (12−5) × ₹12 = <strong>₹284</strong>. A 3 km trip = ₹200 (base fare applies, no extra).</em>
            </Typography>
          </Box>
        </Box>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
        ) : rules.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <DirectionsCar sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
            <Typography color="text.secondary" mb={2}>No pricing rules configured yet</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={openDialog}>Add First Rule</Button>
          </Box>
        ) : (
          <Stack spacing={2}>
            {Object.entries(rulesByCategory).sort(([a], [b]) => a.localeCompare(b)).map(([catName, catRulesRaw]) => { const catRules = catRulesRaw as VehiclePricingRule[]; return (
              <Card key={catName} variant="outlined" sx={{ borderRadius: 2 }}>
                <CardHeader
                  title={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <DirectionsCar sx={{ fontSize: 16, color: "primary.main" }} />
                      <Typography fontWeight={700} fontSize={14} fontFamily="monospace">{catName}</Typography>
                      <Chip label={`${catRules.length} rule${catRules.length !== 1 ? "s" : ""}`} size="small" variant="outlined" color="primary" />
                      {/* warn if same city+tripType duplicated under this category */}
                      {catRules.length > 1 && (() => {
                        const seen = new Set<string>();
                        const hasDup = catRules.some(r => {
                          const k = `${r.city_id}:${r.trip_type}`;
                          if (seen.has(k)) return true;
                          seen.add(k); return false;
                        });
                        return hasDup ? (
                          <Chip label="⚠ Duplicate rules detected" size="small" color="error" />
                        ) : null;
                      })()}
                    </Stack>
                  }
                  sx={{ pb: 0, pt: 1.5 }}
                />
                <CardContent sx={{ pt: 1 }}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "action.hover", fontSize: 12 } }}>
                          <TableCell>City</TableCell>
                          <TableCell>Trip Type</TableCell>
                          <TableCell>Base Fare</TableCell>
                          <TableCell>Per KM</TableCell>
                          <TableCell><span title="KM included in base fare — extra km charged at per-km rate">Incl. KM ⓘ</span></TableCell>
                          <TableCell>Driver Allow.</TableCell>
                          <TableCell>Night Charge</TableCell>
                          <TableCell>Effective</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {catRules.map((r: any) => (
                          <TableRow key={r.id} hover>
                            <TableCell>
                              <Stack direction="row" alignItems="center" spacing={0.5}>
                                <LocationCity sx={{ fontSize: 13, color: "text.secondary" }} />
                                <Typography fontSize={13} fontWeight={600}>
                                  {cityMap[r.city_id] ?? `City ${r.city_id}`}
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Chip label={r.trip_type?.replace(/_/g, " ")} size="small" color={TRIP_TYPE_COLOR[r.trip_type] ?? "default"} />
                            </TableCell>
                            <TableCell><Typography fontWeight={700} color="success.main" fontSize={13}>₹{r.base_fare}</Typography></TableCell>
                            <TableCell><Typography fontSize={13}>₹{r.per_km_rate}/km</Typography></TableCell>
                            <TableCell><Typography fontSize={13} color="text.secondary" title="KM included in base fare">{r.minimum_km != null && r.minimum_km > 0 ? `${r.minimum_km} km` : <span style={{color:"#aaa"}}>0 km</span>}</Typography></TableCell>
                            <TableCell>
                              {r.driver_allowance
                                ? <Chip label={`₹${r.driver_allowance}`} size="small" variant="outlined" color="info" />
                                : <Typography fontSize={12} color="text.disabled">—</Typography>}
                            </TableCell>
                            <TableCell>
                              {r.night_charge
                                ? <Chip label={`₹${r.night_charge}`} size="small" variant="outlined" color="warning" />
                                : <Typography fontSize={12} color="text.disabled">—</Typography>}
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">
                                {r.effective_from ? `${r.effective_from} → ${r.effective_to ?? "∞"}` : "Always"}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <IconButton size="small" color="error" onClick={() => del(r.id)}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            ); })}
          </Stack>
        )}
      </CardContent>

      {/* ══ Add Pricing Rule Dialog ══ */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <PriceChange color="primary" />
            <Box>
              <Typography fontWeight={700} fontSize={18}>Add Pricing Rule</Typography>
              <Typography variant="caption" color="text.secondary">
                City × Vehicle Category × Trip Type — each combination must be unique
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>

            {/* Row 1: City + Category */}
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth size="small" required>
                  <InputLabel>City *</InputLabel>
                  <Select
                    value={form.city_id}
                    label="City *"
                    onChange={e => setField("city_id", e.target.value)}
                    disabled={masterLoading}
                  >
                    {masterLoading
                      ? <MenuItem disabled><CircularProgress size={14} sx={{ mr: 1 }} /> Loading…</MenuItem>
                      : cities.map(c => (
                          <MenuItem key={c.id} value={String(c.id)}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <LocationCity sx={{ fontSize: 13, color: "text.secondary" }} />
                              <span>{c.name}</span>
                              {c.state_name && <Typography variant="caption" color="text.secondary">· {c.state_name}</Typography>}
                            </Stack>
                          </MenuItem>
                        ))
                    }
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth size="small" required>
                  <InputLabel>Vehicle Category *</InputLabel>
                  <Select
                    value={form.vehicle_category_id}
                    label="Vehicle Category *"
                    onChange={e => setField("vehicle_category_id", e.target.value)}
                    disabled={masterLoading}
                  >
                    {masterLoading
                      ? <MenuItem disabled><CircularProgress size={14} sx={{ mr: 1 }} /> Loading…</MenuItem>
                      : categories.map(cat => (
                          <MenuItem key={cat.id} value={String(cat.id)}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <DirectionsCar sx={{ fontSize: 13, color: "text.secondary" }} />
                              <span>{cat.category_name}</span>
                              {cat.seating_capacity && <Typography variant="caption" color="text.secondary">· {cat.seating_capacity} seats</Typography>}
                            </Stack>
                          </MenuItem>
                        ))
                    }
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Duplicate warning */}
            {duplicateWarning && (
              <Alert severity="warning" sx={{ borderRadius: 1.5, fontSize: 12 }}>{duplicateWarning}</Alert>
            )}

            {/* Row 2: Trip Type */}
            <FormControl fullWidth size="small">
              <InputLabel>Trip Type</InputLabel>
              <Select value={form.trip_type} label="Trip Type" onChange={e => setField("trip_type", e.target.value)}>
                {["LOCAL", "AIRPORT", "OUTSTATION", "ONE_WAY", "ROUND_TRIP"].map(t => (
                  <MenuItem key={t} value={t}>{t.replace(/_/g, " ")}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Divider><Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>REQUIRED FARES</Typography></Divider>

            {/* Row 3: Required fares */}
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  size="small" fullWidth required
                  label="Base Fare (₹)" type="number" inputProps={{ min: 0, step: "0.01" }}
                  value={form.base_fare}
                  onChange={e => setField("base_fare", e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                  helperText="Minimum charged fare"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  size="small" fullWidth required
                  label="Per KM Rate (₹)" type="number" inputProps={{ min: 0, step: "0.01" }}
                  value={form.per_km_rate}
                  onChange={e => setField("per_km_rate", e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                  helperText="Charged per kilometre"
                />
              </Grid>
            </Grid>

            <Divider><Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>OPTIONAL CHARGES</Typography></Divider>

            {/* Row 4: Optional charges */}
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <TextField
                  size="small" fullWidth
                  label="Included KM (in base fare)" type="number" inputProps={{ min: 0 }}
                  value={form.minimum_km}
                  onChange={e => setField("minimum_km", e.target.value)}
                  helperText="Minimum distance billed"
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  size="small" fullWidth
                  label="Driver Allowance (₹)" type="number" inputProps={{ min: 0, step: "0.01" }}
                  value={form.driver_allowance}
                  onChange={e => setField("driver_allowance", e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                  helperText="Per-day driver stay fee"
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  size="small" fullWidth
                  label="Night Charge (₹)" type="number" inputProps={{ min: 0, step: "0.01" }}
                  value={form.night_charge}
                  onChange={e => setField("night_charge", e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                  helperText="Extra fee after 10 PM"
                />
              </Grid>
            </Grid>

            <Divider><Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>OPTIONAL VALIDITY</Typography></Divider>

            {/* Row 5: Effective dates */}
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  size="small" fullWidth type="date"
                  label="Effective From" InputLabelProps={{ shrink: true }}
                  value={form.effective_from}
                  onChange={e => setField("effective_from", e.target.value)}
                  helperText="Leave blank = always active"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  size="small" fullWidth type="date"
                  label="Effective To" InputLabelProps={{ shrink: true }}
                  value={form.effective_to}
                  onChange={e => setField("effective_to", e.target.value)}
                  helperText="Leave blank = no expiry"
                />
              </Grid>
            </Grid>

          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained" onClick={add}
            disabled={!isFormValid}
            sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
          >
            Create Rule
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══════════════════════════════════════════════════════
          DEFAULT PRICING — Platform Fallback Rules
          BRD Part 3 §35 — Fare engine must not hardcode values
          BRD Part 3 §36 — Shown when no city-specific rule exists
      ══════════════════════════════════════════════════════ */}
      <Box mt={3}>
        <Card
          variant="outlined"
          sx={{
            borderRadius: 3,
            borderColor: showDefaultSection ? "primary.main" : "divider",
            transition: "border-color 0.2s",
          }}
        >
          {/* Collapsible header */}
          <CardHeader
            onClick={() => setShowDefaultSection(p => !p)}
            sx={{
              cursor: "pointer",
              bgcolor: showDefaultSection ? "primary.50" : "action.hover",
              borderRadius: showDefaultSection ? "12px 12px 0 0" : 3,
              transition: "background 0.2s",
              "&:hover": { bgcolor: "primary.50" },
              "& .MuiCardHeader-title": { display: "flex", alignItems: "center", gap: 1 },
            }}
            title={
              <Stack direction="row" alignItems="center" justifyContent="space-between" width="100%">
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Box
                    sx={{
                      width: 36, height: 36, borderRadius: 2,
                      bgcolor: "primary.main", display: "flex",
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <DirectionsCar sx={{ color: "#fff", fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography fontWeight={700} fontSize={15}>
                      Default Platform Pricing
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Fallback rates used when no city-specific rule is configured · {defaultRules.length} rules loaded
                    </Typography>
                  </Box>
                  <Chip
                    label="Fallback"
                    size="small"
                    sx={{
                      bgcolor: "warning.100",
                      color: "warning.dark",
                      fontWeight: 700,
                      fontSize: 10,
                      height: 20,
                    }}
                  />
                </Stack>
                <Box sx={{ color: "primary.main", display: "flex", alignItems: "center" }}>
                  {showDefaultSection
                    ? <ExpandLess />
                    : <ExpandMore />
                  }
                </Box>
              </Stack>
            }
          />

          {showDefaultSection && (
            <CardContent sx={{ pt: 0 }}>
              {/* Info banner */}
              <Alert
                severity="info"
                icon={<InfoOutlined />}
                sx={{ mb: 3, mt: 2, borderRadius: 2, bgcolor: "info.50", border: "1px solid", borderColor: "info.200" }}
              >
                <AlertTitle sx={{ fontWeight: 700, fontSize: 13 }}>
                  How Fallback Pricing Works
                </AlertTitle>
                <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
                  When a booking is created for a city that <strong>has no city-specific pricing rule</strong> for the
                  selected vehicle category and trip type, the fare engine automatically uses these platform defaults.
                  You can edit any value inline — changes take effect immediately for new bookings.
                </Typography>
                <Box mt={1}>
                  <Chip label="city-specific rule" size="small" color="success" sx={{ mr: 0.5 }} />
                  <Typography component="span" variant="caption" color="text.secondary">takes priority → falls back to </Typography>
                  <Chip label="platform default" size="small" color="warning" sx={{ ml: 0.5 }} />
                </Box>
              </Alert>

              {defaultLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : defaultRules.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 4 }}>
                  <Typography color="text.secondary">
                    No default rules found. Run migration 0011_default_vehicle_pricing to seed defaults.
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={2}>
                  {Object.entries(defaultByCategory)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([catId, tripMap]) => {
                      const catName = catMap[Number(catId)] ?? `Category ${catId}`;
                      const tripEntries = Object.entries(tripMap).sort(([a], [b]) => a.localeCompare(b));
                      return (
                        <Box key={catId}>
                          {/* Category header */}
                          <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                            <Box
                              sx={{
                                width: 6, height: 6, borderRadius: "50%",
                                bgcolor: "primary.main",
                              }}
                            />
                            <Typography
                              fontWeight={700}
                              fontSize={12}
                              fontFamily="monospace"
                              color="primary.main"
                              textTransform="uppercase"
                              letterSpacing={1}
                            >
                              {catName}
                            </Typography>
                            <Chip
                              label={`${tripEntries.length} trip type${tripEntries.length !== 1 ? "s" : ""}`}
                              size="small"
                              variant="outlined"
                              sx={{ height: 18, fontSize: 10 }}
                            />
                          </Stack>

                          <TableContainer
                            component={Paper}
                            variant="outlined"
                            sx={{ borderRadius: 2, mb: 1, overflow: "hidden" }}
                          >
                            <Table size="small">
                              <TableHead>
                                <TableRow
                                  sx={{ bgcolor: "action.selected", "& th": { fontWeight: 700, fontSize: 11, py: 1 } }}
                                >
                                  <TableCell>Trip Type</TableCell>
                                  <TableCell align="right">Base Fare (₹)</TableCell>
                                  <TableCell align="right" title="KM included in base fare — extra km above this are charged per-km rate">Incl. KM ⓘ</TableCell>
                                  <TableCell align="right">Per KM (₹)</TableCell>
                                  <TableCell align="right">Driver Allow. (₹)</TableCell>
                                  <TableCell align="right">Driver Allow. Type</TableCell>
                                  <TableCell align="right">Night Charge (₹)</TableCell>
                                  <TableCell align="center" width={90}>Actions</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {tripEntries.map(([tripType, rule]) => {
                                  const edits = defaultEdits[rule.id] ?? {};
                                  const isDirty = Object.keys(edits).length > 0;
                                  const isSaving = defaultSaving[rule.id] ?? false;

                                  const tripColors: Record<string, any> = {
                                    LOCAL: "default", AIRPORT: "primary", OUTSTATION: "warning",
                                    ONE_WAY: "info", ROUND_TRIP: "secondary",
                                  };

                                  const numField = (
                                    field: keyof DefaultPricingRule,
                                    align: "right" | "center" = "right"
                                  ) => (
                                    <TableCell align={align} sx={{ py: 0.5, px: 1 }}>
                                      <TextField
                                        size="small"
                                        type="number"
                                        value={edits[field] !== undefined ? edits[field] : (rule[field] as number)}
                                        onChange={e => updateDefaultField(rule.id, field, e.target.value)}
                                        inputProps={{ min: 0, step: 0.5, style: { textAlign: "right", fontSize: 12, padding: "4px 6px" } }}
                                        sx={{
                                          width: 90,
                                          "& .MuiOutlinedInput-root": {
                                            bgcolor: isDirty && edits[field] !== undefined
                                              ? "warning.50"
                                              : "transparent",
                                            borderRadius: 1,
                                          },
                                        }}
                                        disabled={isSaving}
                                      />
                                    </TableCell>
                                  );

                                  const DA_TYPES = ["PER_TRIP", "PER_DAY", "PER_KM", "NONE"] as const;
                                  const selectField = (
                                    field: "driver_allowance_type" | "night_charge_type",
                                    options: readonly string[],
                                    width = 104,
                                  ) => (
                                    <TableCell align="right" sx={{ py: 0.5, px: 1 }}>
                                      <TextField
                                        size="small"
                                        select
                                        value={edits[field] !== undefined ? (edits[field] as string) : String(rule[field] ?? "")}
                                        onChange={e => updateDefaultField(rule.id, field, e.target.value)}
                                        sx={{
                                          width,
                                          "& .MuiOutlinedInput-root": {
                                            bgcolor: isDirty && edits[field] !== undefined
                                              ? "warning.50"
                                              : "transparent",
                                            borderRadius: 1,
                                          },
                                          "& .MuiSelect-select": { fontSize: 12, py: 0.8, px: 1 },
                                        }}
                                        disabled={isSaving}
                                      >
                                        {options.map(opt => (
                                          <MenuItem key={opt} value={opt} sx={{ fontSize: 12 }}>
                                            {opt.replace("_", " ")}
                                          </MenuItem>
                                        ))}
                                      </TextField>
                                    </TableCell>
                                  );

                                  return (
                                    <TableRow
                                      key={tripType}
                                      sx={{
                                        bgcolor: isDirty ? "warning.50" : "inherit",
                                        "&:hover": { bgcolor: isDirty ? "warning.100" : "action.hover" },
                                        transition: "background 0.15s",
                                      }}
                                    >
                                      <TableCell sx={{ py: 0.5 }}>
                                        <Chip
                                          label={tripType.replace("_", " ")}
                                          size="small"
                                          color={tripColors[tripType] ?? "default"}
                                          sx={{ fontWeight: 700, fontSize: 10, height: 20 }}
                                        />
                                      </TableCell>
                                      {numField("base_fare")}
                                      {numField("minimum_km")}
                                      {numField("per_km_rate")}
                                      {numField("driver_allowance")}
                                      {selectField("driver_allowance_type", DA_TYPES)}
                                      {numField("night_charge")}
                                      <TableCell align="center" sx={{ py: 0.5 }}>
                                        {isDirty ? (
                                          <Stack direction="row" spacing={0.5} justifyContent="center">
                                            <Tooltip title="Save changes">
                                              <span>
                                                <IconButton
                                                  size="small"
                                                  color="success"
                                                  onClick={() => saveDefaultRule(rule)}
                                                  disabled={isSaving}
                                                  sx={{ bgcolor: "success.100", "&:hover": { bgcolor: "success.200" } }}
                                                >
                                                  {isSaving ? <CircularProgress size={14} /> : <Check fontSize="small" />}
                                                </IconButton>
                                              </span>
                                            </Tooltip>
                                            <Tooltip title="Discard changes">
                                              <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => cancelDefaultEdit(rule.id)}
                                                disabled={isSaving}
                                                sx={{ bgcolor: "error.50", "&:hover": { bgcolor: "error.100" } }}
                                              >
                                                <Close fontSize="small" />
                                              </IconButton>
                                            </Tooltip>
                                          </Stack>
                                        ) : (
                                          <Tooltip title={`Last updated: ${new Date(rule.updated_at).toLocaleDateString()}`}>
                                            <Typography variant="caption" color="text.disabled" fontSize={10}>
                                              {new Date(rule.updated_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                            </Typography>
                                          </Tooltip>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Box>
                      );
                    })}
                </Stack>
              )}

              <Box mt={2} display="flex" justifyContent="flex-end">
                <Button
                  size="small"
                  startIcon={<Refresh />}
                  onClick={loadDefaultRules}
                  disabled={defaultLoading}
                  sx={{ textTransform: "none", color: "text.secondary" }}
                >
                  Refresh Defaults
                </Button>
              </Box>
            </CardContent>
          )}
        </Card>
      </Box>

    </Card>
  );
}


// ══════════════════════════════════════════════════════════════
// TAB 6 — NOTIFICATION TEMPLATES
// ══════════════════════════════════════════════════════════════

// ── Firebase Setup card (Doc Ref: BRD Part 7 §155) ──
// Stored as a single api_integrations row with service_type=FIREBASE
// and configuration = the full Admin SDK JSON object. The backend's
// notification engine loads this row on first push and uses
// firebase_admin.credentials.Certificate(dict) to authenticate.

interface FirebaseSetupCardProps {
  enqueueSnackbar: any;
}

function FirebaseSetupCard({ enqueueSnackbar }: FirebaseSetupCardProps) {
  const [integration, setIntegration] = useState<ApiIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Load existing FIREBASE row on mount.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await (settingsService as any).getApiIntegrations();
      const fb = (all as ApiIntegration[]).find(
        (a) => a.service_type === "FIREBASE"
      );
      setIntegration(fb ?? null);
      setJsonText(fb?.configuration ? JSON.stringify(fb.configuration, null, 2) : "");
    } catch {
      enqueueSnackbar("Failed to load Firebase configuration", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  // Validate the paste is a Firebase Admin SDK credential dict.
  // Firebase credentials must have: type, project_id, private_key,
  // client_email. If any are missing we surface a clear error.
  const validateJson = (raw: string): { ok: true; dict: Record<string, unknown> } | { ok: false; reason: string } => {
    if (!raw.trim()) {
      return { ok: false, reason: "Paste the JSON you downloaded from Firebase Console." };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, reason: "Not valid JSON. Check for trailing commas or unescaped quotes." };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, reason: "JSON must be an object, not a list or scalar." };
    }
    const obj = parsed as Record<string, unknown>;
    const required = ["type", "project_id", "private_key", "client_email"];
    const missing = required.filter((k) => !obj[k] || typeof obj[k] !== "string");
    if (missing.length) {
      return {
        ok: false,
        reason: `Missing Firebase credential fields: ${missing.join(", ")}. Make sure you pasted the Service Account JSON, not a Web API key.`,
      };
    }
    if (obj.type !== "service_account") {
      return {
        ok: false,
        reason: `"type" must be "service_account". Got "${String(obj.type)}". This is the Admin SDK credential, not the Web SDK config.`,
      };
    }
    return { ok: true, dict: obj };
  };

  const save = async () => {
    const v = validateJson(jsonText);
    if (!v.ok) {
      setParseError(v.reason);
      return;
    }
    setParseError(null);
    setSaving(true);
    try {
      if (integration) {
        await (settingsService as any).updateApiIntegration(integration.id, {
          configuration: v.dict as any,
          is_active: true,
        });
      } else {
        await (settingsService as any).createApiIntegration({
          service_name: "Firebase Cloud Messaging",
          service_type: "FIREBASE",
          configuration: v.dict as any,
          is_active: true,
        });
      }
      enqueueSnackbar("Firebase credentials saved", { variant: "success" });
      setEditing(false);
      await load();
    } catch {
      enqueueSnackbar("Save failed", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!integration) return;
    try {
      await (settingsService as any).updateApiIntegration(integration.id, {
        is_active: !integration.is_active,
      });
      enqueueSnackbar(
        `Firebase push ${!integration.is_active ? "enabled" : "disabled"}`,
        { variant: "success" }
      );
      await load();
    } catch {
      enqueueSnackbar("Update failed", { variant: "error" });
    }
  };

  // The backend exposes /admin/notifications/test-push as a convenience
  // — we call it with a stub device token (the row that registers the
  // FCM token from a browser is the real test target).
  const testPush = async () => {
    setTesting(true);
    try {
      // We use the existing in-app notification endpoint as the closest
      // proxy: it dispatches via WS + FCM if the current user has a
      // registered token. Useful for verifying the engine round-trips.
      await fetch("/api/v1/admin/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Firebase test push",
          body: "If your device is registered with FCM you should see this notification.",
        }),
      });
      enqueueSnackbar("Test push dispatched", { variant: "info" });
    } catch {
      enqueueSnackbar("Test push failed — check backend logs", { variant: "error" });
    } finally {
      setTesting(false);
    }
  };

  const configured = integration && integration.is_active && integration.configuration;

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, mb: 2.5, borderColor: configured ? "success.light" : "warning.light" }}>
      <CardHeader
        avatar={
          <Box sx={{
            width: 40, height: 40, borderRadius: 1.5,
            background: "linear-gradient(135deg, #FF6F00, #F57C00)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Whatshot sx={{ color: "#fff", fontSize: 22 }} />
          </Box>
        }
        title={
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Typography fontWeight={700}>Firebase Cloud Messaging</Typography>
            {loading ? null : configured ? (
              <Chip label="Active" color="success" size="small" sx={{ fontWeight: 700 }} />
            ) : (
              <Chip label={integration ? "Inactive" : "Not configured"} color="warning" size="small" sx={{ fontWeight: 700 }} />
            )}
          </Stack>
        }
        subheader={
          <Typography variant="caption" color="text.secondary">
            Powers real-time push notifications when admin assigns a cab to a partner. Upload the Admin SDK service-account JSON.
          </Typography>
        }
        action={
          integration ? (
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                onClick={toggleActive}
                startIcon={<ToggleOn />}
              >
                {integration.is_active ? "Disable" : "Enable"}
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={() => setEditing(true)}
                startIcon={<ContentPasteGo />}
              >
                {editing ? "Cancel" : "Update JSON"}
              </Button>
            </Stack>
          ) : (
            <Button
              size="small"
              variant="contained"
              onClick={() => setEditing(true)}
              startIcon={<ContentPasteGo />}
            >
              Configure
            </Button>
          )
        }
        sx={{ pb: 1 }}
      />
      <CardContent sx={{ pt: 0 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}><CircularProgress size={20} /></Box>
        ) : editing ? (
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Alert severity="info" icon={<InfoOutlined fontSize="small" />}>
              From <strong>Firebase Console → Project Settings → Service Accounts</strong>,
              click <em>Generate new private key</em> and paste the downloaded JSON below.
              <br />
              <Typography variant="caption" color="text.secondary">
                Required fields: <code>type</code>, <code>project_id</code>, <code>private_key</code>, <code>client_email</code>.
              </Typography>
            </Alert>
            <TextField
              multiline
              minRows={10}
              maxRows={20}
              fullWidth
              size="small"
              placeholder='{ "type": "service_account", "project_id": "...", ... }'
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                setParseError(null);
              }}
              InputProps={{
                sx: { fontFamily: "monospace", fontSize: "0.78rem" },
              }}
            />
            {parseError && (
              <Alert severity="error" icon={<ErrorOutline fontSize="small" />}>
                {parseError}
              </Alert>
            )}
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button onClick={() => { setEditing(false); setParseError(null); }}>Cancel</Button>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save />}
                onClick={save}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save & Activate"}
              </Button>
            </Stack>
          </Stack>
        ) : configured ? (
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Project ID</Typography>
              <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                {String(integration.configuration?.project_id ?? "—")}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Client Email</Typography>
              <Typography variant="body2" fontFamily="monospace" fontWeight={600} noWrap>
                {String(integration.configuration?.client_email ?? "—")}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Chip
                  label={integration.configuration?.private_key ? "Private key present ✓" : "Private key missing"}
                  color={integration.configuration?.private_key ? "success" : "error"}
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
                <Chip
                  label="WebSocket + FCM dual channel"
                  color="primary"
                  variant="outlined"
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
              </Stack>
            </Grid>
          </Grid>
        ) : (
          <Alert severity="warning" sx={{ mt: 1 }}>
            Firebase is not configured — partner assignments will only be delivered via in-app WebSocket.
            Configure it above to enable push notifications for offline / background tabs.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function NotificationTemplatesTab({ enqueueSnackbar }: any) {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ template_code: "", channel: "SMS", template_name: "", template_content: "", is_active: true });

  const load = useCallback(async () => {
    setLoading(true);
    try { setTemplates(await settingsService.getNotificationTemplates(channelFilter || undefined)); }
    catch { enqueueSnackbar("Failed to load templates", { variant: "error" }); }
    finally { setLoading(false); }
  }, [channelFilter]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    try {
      await settingsService.createNotificationTemplate(form as any);
      enqueueSnackbar("Template created", { variant: "success" });
      setDialogOpen(false);
      load();
    } catch { enqueueSnackbar("Create failed", { variant: "error" }); }
  };

  const del = async (id: number) => {
    try {
      await settingsService.deleteNotificationTemplate(id);
      enqueueSnackbar("Deleted", { variant: "success" });
      load();
    } catch { enqueueSnackbar("Delete failed", { variant: "error" }); }
  };

  const CHANNEL_COLOR: Record<string, any> = { SMS: "info", EMAIL: "primary", PUSH: "warning", IN_APP: "secondary" };

  return (
    <Box>
      {/* ── Firebase Setup card (Doc Ref: BRD Part 7 §155) ── */}
      <FirebaseSetupCard enqueueSnackbar={enqueueSnackbar} />

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardHeader
          title={<Typography fontWeight={700}>Notification Templates</Typography>}
          action={
            <Stack direction="row" spacing={1} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Channel</InputLabel>
                <Select value={channelFilter} label="Channel" onChange={e => setChannelFilter(e.target.value)}>
                  <MenuItem value="">All</MenuItem>
                  {["SMS","EMAIL","PUSH","IN_APP"].map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
              <IconButton onClick={load}><Refresh /></IconButton>
              <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>Add Template</Button>
            </Stack>
          }
        />
        <CardContent>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "action.hover" } }}>
                    <TableCell>Code</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Channel</TableCell>
                    <TableCell>Content Preview</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {templates.map(t => (
                    <TableRow key={t.id} hover>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace" fontWeight={600} color="primary.main">
                          {t.template_code}
                        </Typography>
                      </TableCell>
                      <TableCell>{t.template_name}</TableCell>
                      <TableCell>
                        <Chip label={t.channel} size="small" color={CHANNEL_COLOR[t.channel] ?? "default"} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 250, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.template_content}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={t.is_active ? "Active" : "Inactive"} color={t.is_active ? "success" : "default"} size="small" />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" color="error" onClick={() => del(t.id)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add Notification Template</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField size="small" fullWidth label="Template Code (e.g. BOOKING_CONFIRMED)" value={form.template_code} onChange={e => setForm(p => ({ ...p, template_code: e.target.value.toUpperCase() }))} />
              <TextField size="small" fullWidth label="Template Name" value={form.template_name} onChange={e => setForm(p => ({ ...p, template_name: e.target.value }))} />
              <FormControl fullWidth size="small">
                <InputLabel>Channel</InputLabel>
                <Select value={form.channel} label="Channel" onChange={e => setForm(p => ({ ...p, channel: e.target.value }))}>
                  {["SMS","EMAIL","PUSH","IN_APP"].map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" fullWidth multiline rows={4} label="Template Content (use {{variable}})" value={form.template_content} onChange={e => setForm(p => ({ ...p, template_content: e.target.value }))} />
              <FormControlLabel control={<Switch checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />} label="Active" />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={add}>Create</Button>
          </DialogActions>
        </Dialog>
      </Card>
    </Box>
  );
}


// ══════════════════════════════════════════════════════════════
// TAB 7 — MASTER DATA  (Cities + Vehicle Categories)
// Doc Ref: DB Schema Part 1 §11 (cities) | Part 3 §10-11 (vehicle_categories)
// Backend: GET/POST/PATCH/DELETE /admin/settings/master/cities
//          GET/POST/PATCH/DELETE /admin/settings/master/vehicle-categories
//          GET /admin/settings/master/states (read-only, for city form)
// service_type values (CAB | HOTEL | TOUR) are fixed enum — NOT DB-managed
// vehicle_categories power CAB bookings (booking asset)
// ══════════════════════════════════════════════════════════════

const VEHICLE_TYPE_ICONS: Record<string, string> = {
  HATCHBACK: "🚗", SEDAN: "🚙", SUV: "🛻", MUV: "🚐",
  TEMPO_TRAVELLER: "🚌", MINI_BUS: "🚍", LUXURY: "🏎️",
};

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  CAB: "Cab / vehicle bookings (uses vehicle categories as booking assets)",
  HOTEL: "Hotel / accommodation bookings",
  TOUR: "Tour package bookings",
};

// ── City Dialog ───────────────────────────────────────────────
function CityDialog({
  open, city, states, onClose, onSaved, enqueueSnackbar,
}: { open: boolean; city: City | null; states: State[]; onClose: () => void; onSaved: () => void; enqueueSnackbar: any }) {
  const isEdit = !!city;
  const [form, setForm] = useState<{
    name: string;
    city_code: string;
    state_id: number;
    is_active: boolean;
    latitude: number | "";
    longitude: number | "";
  }>({ name: "", city_code: "", state_id: 0, is_active: true, latitude: "", longitude: "" });
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeAddress, setGeocodeAddress] = useState<string | null>(null);

  useEffect(() => {
    setGeocodeAddress(null);
    if (city) {
      setForm({
        name: city.name,
        city_code: city.city_code ?? "",
        state_id: city.state_id,
        is_active: city.is_active,
        latitude: city.latitude ?? "",
        longitude: city.longitude ?? "",
      });
    } else {
      setForm({
        name: "",
        city_code: "",
        state_id: states[0]?.id ?? 0,
        is_active: true,
        latitude: "",
        longitude: "",
      });
    }
  }, [city, states]);

  const findCoordinates = async () => {
    if (!form.name.trim()) {
      enqueueSnackbar("Enter a city name first", { variant: "warning" });
      return;
    }
    const stateName = states.find(s => s.id === form.state_id)?.name;
    setGeocoding(true);
    try {
      const result = await (settingsService as any).geocodeCity(form.name.trim(), stateName);
      setForm(p => ({ ...p, latitude: result.latitude, longitude: result.longitude }));
      setGeocodeAddress(result.formatted_address);
      enqueueSnackbar("Coordinates found", { variant: "success" });
    } catch (e: any) {
      // Try to surface the backend's HTTPException detail if present.
      const detail = e?.response?.data?.detail;
      enqueueSnackbar(detail ?? "Could not find coordinates for this city", { variant: "error" });
    } finally {
      setGeocoding(false);
    }
  };

  const save = async () => {
    if (!form.name.trim() || !form.state_id) return;
    setSaving(true);
    // Coerce the "" sentinel back to undefined so the backend treats the
    // field as omitted (rather than trying to coerce "" to a number).
    const payload: Record<string, unknown> = {
      name: form.name,
      city_code: form.city_code || undefined,
      is_active: form.is_active,
      latitude: form.latitude === "" ? null : Number(form.latitude),
      longitude: form.longitude === "" ? null : Number(form.longitude),
    };
    try {
      if (isEdit) {
        await (settingsService as any).updateCity(city!.id, payload);
      } else {
        await (settingsService as any).createCity({ ...payload, state_id: form.state_id });
      }
      enqueueSnackbar(isEdit ? "City updated" : "City created", { variant: "success" });
      onSaved();
    } catch { enqueueSnackbar(isEdit ? "Update failed" : "Create failed", { variant: "error" }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <LocationCity color="primary" />
          <Box>
            <Typography fontWeight={700} fontSize={18}>{isEdit ? "Edit City" : "Add City"}</Typography>
            <Typography variant="caption" color="text.secondary">
              Cities are used in commission rules, pricing rules, and booking locations
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl fullWidth size="small" required>
            <InputLabel>State</InputLabel>
            <Select
              value={form.state_id || ""}
              label="State"
              onChange={e => setForm(p => ({ ...p, state_id: Number(e.target.value) }))}
              disabled={isEdit}
            >
              {states.map(s => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small" fullWidth required
            label="City Name"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            helperText="e.g. Mumbai, Bengaluru, Hyderabad"
          />
          <TextField
            size="small" fullWidth
            label="City Code (optional)"
            value={form.city_code}
            onChange={e => setForm(p => ({ ...p, city_code: e.target.value.toUpperCase() }))}
            helperText="Short code e.g. BOM, BLR, HYD"
            inputProps={{ maxLength: 50 }}
          />

          {/* ── Coordinates ─────────────────────────────────────────────
              Used to bias Google Places autocomplete in the customer-web
              hero search. Admin can fill them manually or click the
              "Find from address" button to use the admin-configured Google
              Maps key (Settings → API Integrations). */}
          <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 1.5, bgcolor: "action.hover" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ letterSpacing: 0.4, textTransform: "uppercase" }}>
                Coordinates
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={geocoding ? <CircularProgress size={14} /> : <MyLocation />}
                onClick={findCoordinates}
                disabled={geocoding || !form.name.trim()}
              >
                Find from address
              </Button>
            </Stack>
            <Grid container spacing={1.5}>
              <Grid item xs={6}>
                <TextField
                  size="small" fullWidth
                  label="Latitude"
                  type="number"
                  value={form.latitude}
                  onChange={e => setForm(p => ({ ...p, latitude: e.target.value === "" ? "" : Number(e.target.value) }))}
                  inputProps={{ step: "any", min: -90, max: 90 }}
                  helperText="-90 to 90"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  size="small" fullWidth
                  label="Longitude"
                  type="number"
                  value={form.longitude}
                  onChange={e => setForm(p => ({ ...p, longitude: e.target.value === "" ? "" : Number(e.target.value) }))}
                  inputProps={{ step: "any", min: -180, max: 180 }}
                  helperText="-180 to 180"
                />
              </Grid>
            </Grid>
            {geocodeAddress && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                Resolved to: <strong>{geocodeAddress}</strong>
              </Typography>
            )}
          </Box>

          <FormControlLabel
            control={<Switch checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} color="success" />}
            label="Active (appears in city pickers)"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained" onClick={save}
          disabled={saving || !form.name.trim() || !form.state_id}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : (isEdit ? <Save /> : <Add />)}
        >
          {isEdit ? "Save Changes" : "Add City"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Vehicle Category Dialog ───────────────────────────────────
// ── VehicleCategoryImageCropModal ─────────────────────────────────────────────
// Reusable crop modal for category image (16:9  1200x675) and icon (1:1  200x200)
function VehicleCategoryCropModal({
  open, file, mode, onClose, onCropped,
}: {
  open: boolean;
  file: File | null;
  mode: "image" | "icon";
  onClose: () => void;
  onCropped: (blob: Blob) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const SPECS = {
    image: { w: 1200, h: 675,  label: "1200 × 675 px (16:9)", hint: "Hero image for website category page — best with a real vehicle photo" },
    icon:  { w: 200,  h: 200,  label: "200 × 200 px (1:1)",   hint: "Square icon shown in filter chips, cards and the customer app" },
  };
  const spec = SPECS[mode];
  const MAX_PREVIEW_W = 560;
  const previewScale = Math.min(1, MAX_PREVIEW_W / spec.w);
  const previewW = Math.round(spec.w * previewScale);
  const previewH = Math.round(spec.h * previewScale);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    const img = new window.Image();
    img.onload = () => {
      imgRef.current = img;
      const s = Math.max(spec.w / img.width, spec.h / img.height);
      setScale(s);
      setOffsetX((spec.w - img.width * s) / 2);
      setOffsetY((spec.h - img.height * s) / 2);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, mode]);

  useEffect(() => {
    if (!canvasRef.current || !imgRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, previewW, previewH);
    ctx.drawImage(imgRef.current,
      offsetX * previewScale, offsetY * previewScale,
      imgRef.current.width * scale * previewScale,
      imgRef.current.height * scale * previewScale,
    );
  });

  const resetView = () => {
    if (!imgRef.current) return;
    const s = Math.max(spec.w / imgRef.current.width, spec.h / imgRef.current.height);
    setScale(s);
    setOffsetX((spec.w - imgRef.current.width * s) / 2);
    setOffsetY((spec.h - imgRef.current.height * s) / 2);
  };

  const confirmCrop = () => {
    if (!imgRef.current) return;
    const offscreen = document.createElement("canvas");
    offscreen.width = spec.w; offscreen.height = spec.h;
    const ctx = offscreen.getContext("2d")!;
    if (mode === "icon") {
      // circle clip for icon
      ctx.beginPath();
      ctx.arc(spec.w / 2, spec.h / 2, spec.w / 2, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.drawImage(imgRef.current, offsetX, offsetY,
      imgRef.current.width * scale, imgRef.current.height * scale,
    );
    offscreen.toBlob(blob => { if (blob) onCropped(blob); }, "image/png");
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: 3, background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, background: "linear-gradient(135deg, #667eea, #764ba2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CropOriginal sx={{ color: "#fff", fontSize: 18 }} />
          </Box>
          <Box>
            <Typography fontWeight={700} fontSize={17} sx={{ color: "#fff" }}>
              {mode === "icon" ? "Crop Category Icon" : "Crop Category Image"}
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.45)" }}>
              {spec.hint}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack alignItems="center" gap={2} pt={1}>
          {/* Target size badge */}
          <Chip
            label={`Target: ${spec.label}`}
            size="small"
            sx={{ bgcolor: "rgba(102,126,234,0.2)", color: "#a5b4fc", fontWeight: 600, border: "1px solid rgba(102,126,234,0.3)" }}
          />
          {/* Canvas */}
          <Box sx={{
            border: "2px dashed", borderColor: "rgba(102,126,234,0.5)", borderRadius: mode === "icon" ? "50%" : 2,
            overflow: "hidden", cursor: dragging ? "grabbing" : "grab",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
            onMouseDown={e => { setDragging(true); setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY }); }}
            onMouseMove={e => { if (!dragging) return; setOffsetX(e.clientX - dragStart.x); setOffsetY(e.clientY - dragStart.y); }}
            onMouseUp={() => setDragging(false)} onMouseLeave={() => setDragging(false)}
            onWheel={e => { e.preventDefault(); setScale(s => Math.max(0.1, s - e.deltaY * 0.001)); }}
          >
            <canvas ref={canvasRef} width={previewW} height={previewH}
              style={{ display: "block", background: "repeating-conic-gradient(#2a2a4a 0% 25%, #1a1a3e 0% 50%) 0 0 / 12px 12px" }}
            />
          </Box>
          {/* Zoom controls */}
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Zoom out"><IconButton onClick={() => setScale(s => Math.max(0.1, s - 0.1))} sx={{ color: "rgba(255,255,255,0.6)" }}><ZoomOut /></IconButton></Tooltip>
            <Chip label={`${Math.round(scale * 100)}%`} size="small" sx={{ minWidth: 60, fontFamily: "monospace", bgcolor: "rgba(255,255,255,0.08)", color: "#fff" }} />
            <Tooltip title="Zoom in"><IconButton onClick={() => setScale(s => s + 0.1)} sx={{ color: "rgba(255,255,255,0.6)" }}><ZoomIn /></IconButton></Tooltip>
            <Tooltip title="Reset view"><IconButton onClick={resetView} sx={{ color: "rgba(255,255,255,0.6)" }}><RotateLeft /></IconButton></Tooltip>
          </Stack>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.3)" }}>
            Drag to reposition · Scroll to zoom · Final export: {spec.label}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2, borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.6)" }}>Cancel</Button>
        <Button onClick={confirmCrop} variant="contained" startIcon={<CheckCircleOutline />}
          sx={{ borderRadius: 2, background: "linear-gradient(135deg, #667eea, #764ba2)", fontWeight: 700 }}>
          Confirm & Use
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── VehicleCategoryDialog (Premium) ──────────────────────────────────────────
function VehicleCategoryDialog({
  open, category, onClose, onSaved, enqueueSnackbar,
}: { open: boolean; category: VehicleCategory | null; onClose: () => void; onSaved: () => void; enqueueSnackbar: any }) {
  const isEdit = !!category;
  const [activeSection, setActiveSection] = useState(0); // 0=Basic 1=Media 2=SEO

  // Form state
  const [form, setForm] = useState({
    category_name: "", seating_capacity: "", luggage_capacity: "",
    is_active: true, display_order: "0",
    seo_title: "", seo_description: "", seo_keywords: "",
  });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [iconUrl, setIconUrl]   = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Crop modal state
  const [cropFile, setCropFile]   = useState<File | null>(null);
  const [cropMode, setCropMode]   = useState<"image" | "icon">("image");
  const [cropOpen, setCropOpen]   = useState(false);
  const [uploading, setUploading] = useState<"image" | "icon" | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (category) {
      setForm({
        category_name:    category.category_name,
        seating_capacity: category.seating_capacity != null ? String(category.seating_capacity) : "",
        luggage_capacity: category.luggage_capacity != null ? String(category.luggage_capacity) : "",
        is_active:        category.is_active,
        display_order:    String(category.display_order ?? 0),
        seo_title:        category.seo_title ?? "",
        seo_description:  category.seo_description ?? "",
        seo_keywords:     category.seo_keywords ?? "",
      });
      setImageUrl(category.image_url ?? null);
      setIconUrl(category.icon_url ?? null);
    } else {
      setForm({ category_name: "", seating_capacity: "", luggage_capacity: "", is_active: true, display_order: "0", seo_title: "", seo_description: "", seo_keywords: "" });
      setImageUrl(null); setIconUrl(null);
    }
    setActiveSection(0);
  }, [category, open]);

  const handleImageFile = (file: File, mode: "image" | "icon") => {
    setCropFile(file);
    setCropMode(mode);
    setCropOpen(true);
  };

  const handleCropped = async (blob: Blob) => {
    setCropOpen(false);
    setUploading(cropMode);
    try {
      const file = new File([blob], `vehicle_category_${cropMode}.png`, { type: "image/png" });
      const result = await uploadMedia(file, "general", { folderOverride: `vehicle-categories/${cropMode}` });
      if (cropMode === "image") setImageUrl(result.secure_url);
      else setIconUrl(result.secure_url);
      enqueueSnackbar(`Category ${cropMode} uploaded`, { variant: "success" });
    } catch {
      enqueueSnackbar("Upload failed", { variant: "error" });
    } finally {
      setUploading(null);
      setCropFile(null);
    }
  };

  const save = async () => {
    if (!form.category_name.trim()) { enqueueSnackbar("Category name is required", { variant: "warning" }); return; }
    setSaving(true);
    const payload = {
      category_name:    form.category_name.trim().toUpperCase().replace(/\s+/g, "_"),
      seating_capacity: form.seating_capacity ? Number(form.seating_capacity) : undefined,
      luggage_capacity: form.luggage_capacity ? Number(form.luggage_capacity) : undefined,
      is_active:        form.is_active,
      display_order:    Number(form.display_order) || 0,
      image_url:        imageUrl ?? undefined,
      icon_url:         iconUrl  ?? undefined,
      seo_title:        form.seo_title.trim()       || undefined,
      seo_description:  form.seo_description.trim() || undefined,
      seo_keywords:     form.seo_keywords.trim()    || undefined,
    };
    try {
      if (isEdit) await (settingsService as any).updateVehicleCategory(category!.id, payload);
      else        await (settingsService as any).createVehicleCategory(payload);
      enqueueSnackbar(isEdit ? "Category updated" : "Category created", { variant: "success" });
      onSaved();
    } catch { enqueueSnackbar(isEdit ? "Update failed" : "Create failed", { variant: "error" }); }
    finally { setSaving(false); }
  };

  const SECTIONS = ["Basic Info", "Media & Icon", "SEO Details"];
  const seoTitleLen = form.seo_title.length;
  const seoDescLen  = form.seo_description.length;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3, background: "linear-gradient(135deg, #0f0f1a 0%, #13132a 100%)", color: "#fff", overflow: "hidden" } }}>
        {/* Header */}
        <Box sx={{ background: "linear-gradient(135deg, #1a1a3e 0%, #16213e 100%)", borderBottom: "1px solid rgba(255,255,255,0.08)", px: 3, pt: 2.5, pb: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" gap={2}>
              {/* Icon / Image preview */}
              <Box sx={{
                width: 52, height: 52, borderRadius: 2,
                background: iconUrl ? "transparent" : "linear-gradient(135deg, #667eea20, #764ba220)",
                border: "1px solid rgba(102,126,234,0.3)",
                overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {iconUrl
                  ? <Box component="img" src={iconUrl} alt="icon" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <DirectionsCar sx={{ color: "#667eea", fontSize: 26 }} />
                }
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700} sx={{ color: "#fff" }}>
                  {isEdit ? "Edit Vehicle Category" : "New Vehicle Category"}
                </Typography>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)" }}>
                  {isEdit ? `Editing: ${category?.category_name}` : "Set up basic info, upload media & configure SEO"}
                </Typography>
              </Box>
            </Stack>
            <IconButton onClick={onClose} size="small" sx={{ color: "rgba(255,255,255,0.4)", "&:hover": { color: "#fff" } }}>
              <Close fontSize="small" />
            </IconButton>
          </Stack>

          {/* Section Tabs */}
          <Stack direction="row" gap={0.5} sx={{ mt: 2 }}>
            {SECTIONS.map((label, i) => (
              <Button key={label} size="small" onClick={() => setActiveSection(i)}
                sx={{
                  textTransform: "none", borderRadius: 2, fontWeight: 600, fontSize: "0.8rem", px: 2,
                  bgcolor: activeSection === i ? "rgba(102,126,234,0.25)" : "transparent",
                  color: activeSection === i ? "#a5b4fc" : "rgba(255,255,255,0.4)",
                  border: "1px solid",
                  borderColor: activeSection === i ? "rgba(102,126,234,0.4)" : "transparent",
                  "&:hover": { bgcolor: "rgba(102,126,234,0.12)", color: "rgba(255,255,255,0.8)" },
                }}>
                {i + 1}. {label}
              </Button>
            ))}
          </Stack>
        </Box>

        {saving && <LinearProgress sx={{ bgcolor: "rgba(102,126,234,0.1)", "& .MuiLinearProgress-bar": { bgcolor: "#667eea" } }} />}

        <DialogContent sx={{ p: 3 }}>

          {/* ── Section 0: Basic Info ── */}
          {activeSection === 0 && (
            <Stack gap={2.5}>
              <Paper sx={{ p: 2.5, borderRadius: 2.5, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: "rgba(255,255,255,0.4)", mb: 2, fontSize: "0.68rem", letterSpacing: 1, textTransform: "uppercase" }}>
                  Category Details
                </Typography>
                <Stack gap={2}>
                  <TextField
                    fullWidth required
                    label="Category Name"
                    value={form.category_name}
                    onChange={e => setForm(p => ({ ...p, category_name: e.target.value }))}
                    helperText="Will be auto-uppercased & underscored (e.g. 'Mini SUV' → 'MINI_SUV')"
                    inputProps={{ maxLength: 100 }}
                    InputLabelProps={{ sx: { color: "rgba(255,255,255,0.5)" } }}
                    InputProps={{ sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" }, "&:hover fieldset": { borderColor: "rgba(255,255,255,0.3)" } } }}
                    FormHelperTextProps={{ sx: { color: "rgba(255,255,255,0.3)" } }}
                  />
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <TextField fullWidth label="Seating Capacity" type="number"
                        inputProps={{ min: 1 }} value={form.seating_capacity}
                        onChange={e => setForm(p => ({ ...p, seating_capacity: e.target.value }))}
                        InputLabelProps={{ sx: { color: "rgba(255,255,255,0.5)" } }}
                        InputProps={{ sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } },
                          startAdornment: <InputAdornment position="start"><Box sx={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>👥</Box></InputAdornment> }}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField fullWidth label="Luggage Capacity (bags)" type="number"
                        inputProps={{ min: 0 }} value={form.luggage_capacity}
                        onChange={e => setForm(p => ({ ...p, luggage_capacity: e.target.value }))}
                        InputLabelProps={{ sx: { color: "rgba(255,255,255,0.5)" } }}
                        InputProps={{ sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } },
                          startAdornment: <InputAdornment position="start"><Box sx={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>🧳</Box></InputAdornment> }}
                      />
                    </Grid>
                  </Grid>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <TextField fullWidth label="Display Order" type="number"
                        inputProps={{ min: 0 }} value={form.display_order}
                        onChange={e => setForm(p => ({ ...p, display_order: e.target.value }))}
                        helperText="Lower = appears first on website"
                        InputLabelProps={{ sx: { color: "rgba(255,255,255,0.5)" } }}
                        InputProps={{ sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } } }}
                        FormHelperTextProps={{ sx: { color: "rgba(255,255,255,0.3)" } }}
                      />
                    </Grid>
                    <Grid item xs={6} sx={{ display: "flex", alignItems: "center" }}>
                      <FormControlLabel
                        control={<Switch checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} color="success" />}
                        label={<Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)" }}>Active (visible in bookings)</Typography>}
                      />
                    </Grid>
                  </Grid>
                </Stack>
              </Paper>
            </Stack>
          )}

          {/* ── Section 1: Media & Icon ── */}
          {activeSection === 1 && (
            <Stack gap={2.5}>
              {/* Hero Image */}
              <Paper sx={{ p: 2.5, borderRadius: 2.5, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Stack direction="row" alignItems="center" gap={1} mb={2}>
                  <Image sx={{ color: "#667eea", fontSize: 18 }} />
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#667eea", fontSize: "0.68rem", letterSpacing: 1, textTransform: "uppercase" }}>
                      Category Hero Image
                    </Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.3)" }}>
                      1200 × 675 px (16:9) · Shown on website category listing & detail page
                    </Typography>
                  </Box>
                </Stack>

                {imageUrl ? (
                  <Stack gap={1.5}>
                    <Box sx={{
                      width: "100%", height: 200, borderRadius: 2, overflow: "hidden",
                      border: "1px solid rgba(102,126,234,0.3)", position: "relative",
                    }}>
                      <Box component="img" src={imageUrl} alt="category" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <Box sx={{
                        position: "absolute", top: 8, right: 8,
                        bgcolor: "rgba(0,0,0,0.6)", borderRadius: 1, px: 1, py: 0.25,
                      }}>
                        <Typography variant="caption" sx={{ color: "#a5b4fc", fontWeight: 600 }}>1200 × 675</Typography>
                      </Box>
                    </Box>
                    <Stack direction="row" gap={1}>
                      <Button size="small" variant="outlined" startIcon={<CloudUpload sx={{ fontSize: 14 }} />}
                        onClick={() => imageInputRef.current?.click()}
                        disabled={!!uploading}
                        sx={{ textTransform: "none", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", "&:hover": { borderColor: "#667eea", color: "#a5b4fc" } }}>
                        Replace Image
                      </Button>
                      <Button size="small" variant="outlined" color="error"
                        onClick={() => setImageUrl(null)}
                        sx={{ textTransform: "none", borderColor: "rgba(255,80,80,0.3)", color: "rgba(255,100,100,0.7)" }}>
                        Remove
                      </Button>
                    </Stack>
                  </Stack>
                ) : (
                  <Box
                    onClick={() => imageInputRef.current?.click()}
                    sx={{
                      width: "100%", height: 160,
                      border: "2px dashed rgba(102,126,234,0.3)", borderRadius: 2,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      gap: 1.5, cursor: "pointer",
                      transition: "all 0.2s",
                      "&:hover": { borderColor: "rgba(102,126,234,0.6)", bgcolor: "rgba(102,126,234,0.05)" },
                    }}>
                    {uploading === "image" ? (
                      <><CircularProgress size={28} sx={{ color: "#667eea" }} /><Typography variant="caption" sx={{ color: "#a5b4fc" }}>Uploading…</Typography></>
                    ) : (
                      <>
                        <CloudUpload sx={{ fontSize: 36, color: "rgba(102,126,234,0.4)" }} />
                        <Typography variant="body2" fontWeight={600} sx={{ color: "rgba(255,255,255,0.5)" }}>Click to upload hero image</Typography>
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.25)" }}>PNG, JPG, WEBP — will be cropped to 1200×675 px</Typography>
                      </>
                    )}
                  </Box>
                )}
                <input ref={imageInputRef} type="file" hidden accept="image/*"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f, "image"); e.target.value = ""; }} />
              </Paper>

              {/* Icon */}
              <Paper sx={{ p: 2.5, borderRadius: 2.5, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Stack direction="row" alignItems="center" gap={1} mb={2}>
                  <DirectionsCar sx={{ color: "#a78bfa", fontSize: 18 }} />
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#a78bfa", fontSize: "0.68rem", letterSpacing: 1, textTransform: "uppercase" }}>
                      Category Icon
                    </Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.3)" }}>
                      200 × 200 px (1:1 square) · Used in customer app, filter chips, and category cards
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction="row" alignItems="center" gap={3}>
                  {/* Icon preview */}
                  <Box sx={{
                    width: 100, height: 100, borderRadius: 2.5, flexShrink: 0,
                    border: "1px solid rgba(167,139,250,0.3)",
                    overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                    background: iconUrl ? "transparent" : "rgba(167,139,250,0.05)",
                  }}>
                    {iconUrl
                      ? <Box component="img" src={iconUrl} alt="icon" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <DirectionsCar sx={{ fontSize: 42, color: "rgba(167,139,250,0.25)" }} />
                    }
                  </Box>

                  <Stack gap={1.5} flex={1}>
                    {iconUrl ? (
                      <Stack direction="row" gap={1}>
                        <Button size="small" variant="outlined" startIcon={<CloudUpload sx={{ fontSize: 14 }} />}
                          onClick={() => iconInputRef.current?.click()} disabled={!!uploading}
                          sx={{ textTransform: "none", borderColor: "rgba(167,139,250,0.3)", color: "rgba(167,139,250,0.7)", "&:hover": { borderColor: "#a78bfa", color: "#c4b5fd" } }}>
                          Replace Icon
                        </Button>
                        <Button size="small" variant="outlined" color="error"
                          onClick={() => setIconUrl(null)}
                          sx={{ textTransform: "none", borderColor: "rgba(255,80,80,0.3)", color: "rgba(255,100,100,0.7)" }}>
                          Remove
                        </Button>
                      </Stack>
                    ) : (
                      <Button variant="outlined" startIcon={uploading === "icon" ? <CircularProgress size={14} sx={{ color: "#a78bfa" }} /> : <CloudUpload sx={{ fontSize: 15 }} />}
                        onClick={() => iconInputRef.current?.click()} disabled={!!uploading}
                        sx={{ textTransform: "none", borderColor: "rgba(167,139,250,0.3)", color: "rgba(167,139,250,0.7)", alignSelf: "flex-start",
                          "&:hover": { borderColor: "#a78bfa", bgcolor: "rgba(167,139,250,0.08)" } }}>
                        {uploading === "icon" ? "Uploading…" : "Upload Icon"}
                      </Button>
                    )}
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.25)" }}>
                      Transparent PNG recommended. Will be cropped to a 200×200 square.
                    </Typography>
                  </Stack>
                </Stack>
                <input ref={iconInputRef} type="file" hidden accept="image/*"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f, "icon"); e.target.value = ""; }} />
              </Paper>
            </Stack>
          )}

          {/* ── Section 2: SEO Details ── */}
          {activeSection === 2 && (
            <Stack gap={2.5}>
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                SEO metadata is used by the WayTero website for the vehicle category landing pages. Optimised meta tags improve search engine rankings.
              </Alert>

              <Paper sx={{ p: 2.5, borderRadius: 2.5, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: "rgba(255,255,255,0.4)", mb: 2, fontSize: "0.68rem", letterSpacing: 1, textTransform: "uppercase" }}>
                  Page SEO
                </Typography>
                <Stack gap={2.5}>
                  {/* SEO Title */}
                  <Box>
                    <TextField fullWidth label="SEO Title (meta title)"
                      value={form.seo_title}
                      onChange={e => setForm(p => ({ ...p, seo_title: e.target.value }))}
                      inputProps={{ maxLength: 120 }}
                      helperText={`${seoTitleLen}/120 chars · Ideal: 50–60 chars · e.g. "Book Sedan Cabs in India — WayTero"`}
                      InputLabelProps={{ sx: { color: "rgba(255,255,255,0.5)" } }}
                      InputProps={{ sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } } }}
                      FormHelperTextProps={{ sx: { color: seoTitleLen > 60 ? "#f59e0b" : "rgba(255,255,255,0.3)" } }}
                    />
                    {/* Live preview of Google snippet title */}
                    {form.seo_title && (
                      <Box sx={{ mt: 0.75, px: 1.5, py: 0.5, borderRadius: 1, bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <Typography variant="caption" sx={{ color: "#8ab4f8", fontWeight: 600, fontSize: "0.8rem" }}>
                          {form.seo_title.slice(0, 60)}{form.seo_title.length > 60 ? "…" : ""}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* SEO Description */}
                  <Box>
                    <TextField fullWidth multiline rows={3} label="SEO Description (meta description)"
                      value={form.seo_description}
                      onChange={e => setForm(p => ({ ...p, seo_description: e.target.value }))}
                      inputProps={{ maxLength: 320 }}
                      helperText={`${seoDescLen}/320 chars · Ideal: 150–160 chars`}
                      InputLabelProps={{ sx: { color: "rgba(255,255,255,0.5)" } }}
                      InputProps={{ sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } } }}
                      FormHelperTextProps={{ sx: { color: seoDescLen > 160 ? "#f59e0b" : "rgba(255,255,255,0.3)" } }}
                    />
                    {/* Live Google snippet preview */}
                    {(form.seo_title || form.seo_description) && (
                      <Box sx={{ mt: 1, p: 1.5, borderRadius: 2, bgcolor: "#fff", border: "1px solid #dfe1e5" }}>
                        <Typography variant="caption" sx={{ color: "#202124", fontWeight: 400, fontSize: "0.7rem" }}>waytero.com › categories › {form.category_name.toLowerCase().replace(/_/g, "-")}</Typography>
                        <Typography sx={{ color: "#1a0dab", fontWeight: 500, fontSize: "0.92rem", lineHeight: 1.3, mb: 0.25 }}>
                          {form.seo_title || form.category_name || "Category Page"}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#4d5156", fontSize: "0.78rem", lineHeight: 1.4 }}>
                          {(form.seo_description || "No description set.").slice(0, 160)}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* SEO Keywords */}
                  <TextField fullWidth label="SEO Keywords"
                    value={form.seo_keywords}
                    onChange={e => setForm(p => ({ ...p, seo_keywords: e.target.value }))}
                    inputProps={{ maxLength: 500 }}
                    helperText="Comma-separated · e.g. sedan cab, outstation taxi, ac cab booking"
                    placeholder="sedan cab, taxi booking, outstation sedan, airport transfer"
                    InputLabelProps={{ sx: { color: "rgba(255,255,255,0.5)" } }}
                    InputProps={{ sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } } }}
                    FormHelperTextProps={{ sx: { color: "rgba(255,255,255,0.3)" } }}
                  />

                  {/* Keyword preview chips */}
                  {form.seo_keywords && (
                    <Stack direction="row" flexWrap="wrap" gap={0.75}>
                      {form.seo_keywords.split(",").map(k => k.trim()).filter(Boolean).map(kw => (
                        <Chip key={kw} label={kw} size="small"
                          sx={{ bgcolor: "rgba(102,126,234,0.15)", color: "#a5b4fc", border: "1px solid rgba(102,126,234,0.25)", fontSize: "0.7rem" }} />
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Paper>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {/* Section navigation */}
          {activeSection > 0 && (
            <Button variant="outlined" onClick={() => setActiveSection(s => s - 1)}
              sx={{ borderRadius: 2, borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)", textTransform: "none" }}>
              ← Previous
            </Button>
          )}
          {activeSection < SECTIONS.length - 1 && (
            <Button variant="outlined" onClick={() => setActiveSection(s => s + 1)}
              sx={{ borderRadius: 2, borderColor: "rgba(102,126,234,0.4)", color: "#a5b4fc", textTransform: "none", fontWeight: 600 }}>
              Next →
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={onClose} disabled={saving}
            sx={{ borderRadius: 2, color: "rgba(255,255,255,0.4)", textTransform: "none" }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={save}
            disabled={saving || !form.category_name.trim() || !!uploading}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : (isEdit ? <Save /> : <Add />)}
            sx={{ background: "linear-gradient(135deg, #667eea, #764ba2)", fontWeight: 700, borderRadius: 2, textTransform: "none", px: 3 }}>
            {isEdit ? "Save Changes" : "Create Category"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Crop modal */}
      <VehicleCategoryCropModal
        open={cropOpen}
        file={cropFile}
        mode={cropMode}
        onClose={() => { setCropOpen(false); setCropFile(null); }}
        onCropped={handleCropped}
      />
    </>
  );
}

// ── ServiceTypeCreateDialog ────────────────────────────────────────────────────
function ServiceTypeCreateDialog({
  open, onClose, onSaved, enqueueSnackbar,
}: { open: boolean; onClose: () => void; onSaved: () => void; enqueueSnackbar: any }) {
  const [form, setForm] = useState({
    type_code: "", label: "", description: "", display_order: "0", is_active: true,
    seo_title: "", seo_description: "", seo_keywords: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ type_code: "", label: "", description: "", display_order: "0", is_active: true,
                seo_title: "", seo_description: "", seo_keywords: "" });
    }
  }, [open]);

  const save = async () => {
    if (!form.type_code.trim()) { enqueueSnackbar("Type code is required", { variant: "warning" }); return; }
    if (!form.label.trim())     { enqueueSnackbar("Label is required", { variant: "warning" }); return; }
    if (!/^[A-Z0-9_]+$/.test(form.type_code.toUpperCase())) {
      enqueueSnackbar("Type code must be uppercase letters, digits or underscores (e.g. FERRY, BUS_TOUR)", { variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      await (settingsService as any).createServiceType({
        type_code:       form.type_code.trim().toUpperCase(),
        label:           form.label.trim(),
        description:     form.description.trim() || null,
        display_order:   Number(form.display_order) || 0,
        is_active:       form.is_active,
        seo_title:       form.seo_title.trim() || null,
        seo_description: form.seo_description.trim() || null,
        seo_keywords:    form.seo_keywords.trim() || null,
      });
      enqueueSnackbar(`Service type '${form.type_code.toUpperCase()}' created`, { variant: "success" });
      onSaved();
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? "Failed to create service type";
      enqueueSnackbar(msg, { variant: "error" });
    } finally { setSaving(false); }
  };

  const F = (label: string, key: keyof typeof form, opts?: { multiline?: boolean; rows?: number; helper?: string; inputProps?: any }) => (
    <TextField
      label={label}
      fullWidth
      value={form[key] as string}
      onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
      multiline={opts?.multiline}
      rows={opts?.rows}
      helperText={opts?.helper}
      inputProps={opts?.inputProps}
      size="small"
      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
    />
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 2, display: "flex", alignItems: "center",
            justifyContent: "center", bgcolor: "primary.main", color: "white", fontSize: 18,
          }}>📋</Box>
          <Box>
            <Typography fontWeight={800} fontSize={17}>Add New Service Type</Typography>
            <Typography variant="caption" color="text.secondary">
              Create a new platform service category (e.g. FERRY, BUS_TOUR)
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2.5 }}>
        <Stack spacing={2.5}>
          {/* Type code — monospace, uppercase */}
          <TextField
            label="Type Code *"
            fullWidth
            size="small"
            value={form.type_code}
            onChange={e => setForm(p => ({ ...p, type_code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") }))}
            helperText="Uppercase letters, digits, underscores only — e.g. FERRY, BUS_TOUR. Cannot be changed after creation."
            inputProps={{ style: { fontFamily: "monospace", fontWeight: 700, letterSpacing: 2 }, maxLength: 50 }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
          />
          {F("Display Label *", "label", { helper: "Shown to admin users everywhere service types appear" })}
          {F("Description", "description", { multiline: true, rows: 2, helper: "Brief description of this service category" })}
          <Stack direction="row" spacing={2}>
            {F("Display Order", "display_order", { inputProps: { type: "number", min: 0 } })}
            <FormControlLabel
              control={
                <Switch checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} color="success" />
              }
              label={<Typography variant="body2" fontWeight={600}>{form.is_active ? "Active" : "Inactive"}</Typography>}
              sx={{ mt: 1, flexShrink: 0 }}
            />
          </Stack>

          <Divider><Typography variant="caption" color="text.secondary">SEO (optional)</Typography></Divider>
          {F("SEO Title", "seo_title", { inputProps: { maxLength: 120 }, helper: `${form.seo_title.length}/120` })}
          {F("SEO Description", "seo_description", { multiline: true, rows: 2, inputProps: { maxLength: 320 }, helper: `${form.seo_description.length}/320` })}
          {F("SEO Keywords", "seo_keywords", { helper: "Comma-separated" })}

          <Alert severity="info" sx={{ borderRadius: 2, fontSize: 12 }}>
            After creating, edit the card to upload an icon and banner image via the <strong>Edit</strong> button.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} disabled={saving} sx={{ borderRadius: 2 }}>Cancel</Button>
        <Button
          variant="contained" onClick={save} disabled={saving || !form.type_code || !form.label}
          sx={{ borderRadius: 2, fontWeight: 700, minWidth: 130 }}
        >
          {saving ? <CircularProgress size={18} sx={{ color: "inherit" }} /> : "Create Service Type"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── ServiceTypeDialog (Premium) ───────────────────────────────────────────────
const SERVICE_TYPE_EMOJI: Record<string, string> = {
  CAB: "🚖", HOTEL: "🏨", TOUR: "🗺️",
};
const SERVICE_TYPE_GRADIENT: Record<string, string> = {
  CAB:   "linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)",
  HOTEL: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
  TOUR:  "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
};
const SERVICE_TYPE_ACCENT: Record<string, string> = {
  CAB: "#818cf8", HOTEL: "#fbbf24", TOUR: "#34d399",
};

function ServiceTypeDialog({
  open, serviceType, onClose, onSaved, enqueueSnackbar,
}: { open: boolean; serviceType: ServiceTypeRecord | null; onClose: () => void; onSaved: () => void; enqueueSnackbar: any }) {
  const [activeSection, setActiveSection] = useState(0); // 0=Basic 1=Media 2=SEO

  const [form, setForm] = useState({
    label: "", description: "", display_order: "0",
    is_active: true,
    seo_title: "", seo_description: "", seo_keywords: "",
  });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [iconUrl,  setIconUrl]  = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);

  // Crop state
  const [cropFile, setCropFile]   = useState<File | null>(null);
  const [cropMode, setCropMode]   = useState<"image" | "icon">("image");
  const [cropOpen, setCropOpen]   = useState(false);
  const [uploading, setUploading] = useState<"image" | "icon" | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (serviceType) {
      setForm({
        label:           serviceType.label ?? "",
        description:     serviceType.description ?? "",
        display_order:   String(serviceType.display_order ?? 0),
        is_active:       serviceType.is_active,
        seo_title:       serviceType.seo_title ?? "",
        seo_description: serviceType.seo_description ?? "",
        seo_keywords:    serviceType.seo_keywords ?? "",
      });
      setImageUrl(serviceType.image_url ?? null);
      setIconUrl(serviceType.icon_url ?? null);
    }
    setActiveSection(0);
  }, [serviceType, open]);

  const handleImageFile = (file: File, mode: "image" | "icon") => {
    setCropFile(file); setCropMode(mode); setCropOpen(true);
  };

  const handleCropped = async (blob: Blob) => {
    setCropOpen(false);
    setUploading(cropMode);
    try {
      const typeCode = serviceType?.type_code?.toLowerCase() ?? "service";
      const file = new File([blob], `service_type_${typeCode}_${cropMode}.png`, { type: "image/png" });
      const result = await uploadMedia(file, "general", { folderOverride: `service-types/${typeCode}/${cropMode}` });
      if (cropMode === "image") setImageUrl(result.secure_url);
      else setIconUrl(result.secure_url);
      enqueueSnackbar(`Service type ${cropMode} uploaded`, { variant: "success" });
    } catch {
      enqueueSnackbar("Upload failed", { variant: "error" });
    } finally {
      setUploading(null); setCropFile(null);
    }
  };

  const save = async () => {
    if (!form.label.trim()) { enqueueSnackbar("Label is required", { variant: "warning" }); return; }
    if (!serviceType) return;
    setSaving(true);
    const payload = {
      label:           form.label.trim(),
      description:     form.description.trim() || null,
      is_active:       form.is_active,
      display_order:   Number(form.display_order) || 0,
      image_url:       imageUrl  ?? null,
      icon_url:        iconUrl   ?? null,
      seo_title:       form.seo_title.trim()       || null,
      seo_description: form.seo_description.trim() || null,
      seo_keywords:    form.seo_keywords.trim()    || null,
    };
    try {
      await (settingsService as any).updateServiceType(serviceType.id, payload);
      enqueueSnackbar("Service type updated", { variant: "success" });
      onSaved();
    } catch { enqueueSnackbar("Update failed", { variant: "error" }); }
    finally   { setSaving(false); }
  };

  if (!serviceType) return null;

  const accent  = SERVICE_TYPE_ACCENT[serviceType.type_code]  ?? "#a5b4fc";
  const grad    = SERVICE_TYPE_GRADIENT[serviceType.type_code] ?? "linear-gradient(135deg,#667eea,#764ba2)";
  const emoji   = SERVICE_TYPE_EMOJI[serviceType.type_code]   ?? "📋";
  const SECTIONS = ["Basic Info", "Media & Icon", "SEO Details"];
  const seoTitleLen = form.seo_title.length;
  const seoDescLen  = form.seo_description.length;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3, background: "linear-gradient(135deg, #0f0f1a 0%, #13132a 100%)", color: "#fff", overflow: "hidden" } }}>

        {/* Header */}
        <Box sx={{ background: "linear-gradient(135deg, #1a1a3e 0%, #16213e 100%)", borderBottom: "1px solid rgba(255,255,255,0.08)", px: 3, pt: 2.5, pb: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" gap={2}>
              {/* Icon preview */}
              <Box sx={{
                width: 52, height: 52, borderRadius: 2,
                background: iconUrl ? "transparent" : `${grad}20`,
                border: `1px solid ${accent}40`,
                overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {iconUrl
                  ? <Box component="img" src={iconUrl} alt="icon" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <Typography fontSize={26}>{emoji}</Typography>
                }
              </Box>
              <Box>
                <Stack direction="row" alignItems="center" gap={1.5}>
                  <Typography variant="h6" fontWeight={700} sx={{ color: "#fff" }}>
                    Edit Service Type
                  </Typography>
                  <Chip
                    label={serviceType.type_code}
                    size="small"
                    sx={{
                      background: grad, color: "#fff", fontFamily: "monospace",
                      fontWeight: 800, fontSize: "0.7rem", letterSpacing: 1,
                    }}
                  />
                </Stack>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)" }}>
                  Type code is immutable · Edit label, description, media & SEO
                </Typography>
              </Box>
            </Stack>
            <IconButton onClick={onClose} size="small" sx={{ color: "rgba(255,255,255,0.4)", "&:hover": { color: "#fff" } }}>
              <Close fontSize="small" />
            </IconButton>
          </Stack>

          {/* Section tabs */}
          <Stack direction="row" gap={0.5} sx={{ mt: 2 }}>
            {SECTIONS.map((label, i) => (
              <Button key={label} size="small" onClick={() => setActiveSection(i)}
                sx={{
                  textTransform: "none", borderRadius: 2, fontWeight: 600, fontSize: "0.8rem", px: 2,
                  bgcolor: activeSection === i ? `${accent}25` : "transparent",
                  color:   activeSection === i ? accent : "rgba(255,255,255,0.4)",
                  border: "1px solid",
                  borderColor: activeSection === i ? `${accent}50` : "transparent",
                  "&:hover": { bgcolor: `${accent}15`, color: "rgba(255,255,255,0.8)" },
                }}>
                {i + 1}. {label}
              </Button>
            ))}
          </Stack>
        </Box>

        {saving && <Box sx={{ height: 3, background: grad, opacity: 0.8 }} />}

        <DialogContent sx={{ p: 3 }}>

          {/* ── Section 0: Basic Info ── */}
          {activeSection === 0 && (
            <Stack gap={2.5}>
              {/* Type code read-only banner */}
              <Paper sx={{
                p: 2, borderRadius: 2, display: "flex", alignItems: "center", gap: 2,
                background: `${accent}10`, border: `1px solid ${accent}25`,
              }}>
                <Typography fontSize={32}>{emoji}</Typography>
                <Box flex={1}>
                  <Typography variant="caption" sx={{ color: accent, fontWeight: 700, fontSize: "0.65rem", letterSpacing: 1.2, textTransform: "uppercase" }}>
                    Platform Type Code (Read-only)
                  </Typography>
                  <Typography fontFamily="monospace" fontWeight={800} fontSize="1.25rem" sx={{ color: "#fff" }}>
                    {serviceType.type_code}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.3)" }}>
                    This code is used in commission rules, partner services, and bookings. Cannot be changed.
                  </Typography>
                </Box>
                <Chip label="Immutable" size="small"
                  sx={{ bgcolor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)", fontSize: "0.65rem" }} />
              </Paper>

              <Paper sx={{ p: 2.5, borderRadius: 2.5, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Typography variant="subtitle2" fontWeight={700}
                  sx={{ color: "rgba(255,255,255,0.4)", mb: 2, fontSize: "0.68rem", letterSpacing: 1, textTransform: "uppercase" }}>
                  Display Details
                </Typography>
                <Stack gap={2}>
                  <TextField
                    fullWidth required
                    label="Display Label"
                    value={form.label}
                    onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                    helperText="Shown to admin users and on the website (e.g. 'Cab Booking', 'Hotel Stay')"
                    inputProps={{ maxLength: 150 }}
                    InputLabelProps={{ sx: { color: "rgba(255,255,255,0.5)" } }}
                    InputProps={{ sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" }, "&:hover fieldset": { borderColor: accent } } }}
                    FormHelperTextProps={{ sx: { color: "rgba(255,255,255,0.3)" } }}
                  />
                  <TextField
                    fullWidth multiline rows={3}
                    label="Description"
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    helperText="Short description used in admin panels and website service cards"
                    InputLabelProps={{ sx: { color: "rgba(255,255,255,0.5)" } }}
                    InputProps={{ sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } } }}
                    FormHelperTextProps={{ sx: { color: "rgba(255,255,255,0.3)" } }}
                  />
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <TextField fullWidth label="Display Order" type="number"
                        inputProps={{ min: 0 }} value={form.display_order}
                        onChange={e => setForm(p => ({ ...p, display_order: e.target.value }))}
                        helperText="Lower = appears first on website"
                        InputLabelProps={{ sx: { color: "rgba(255,255,255,0.5)" } }}
                        InputProps={{ sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } } }}
                        FormHelperTextProps={{ sx: { color: "rgba(255,255,255,0.3)" } }}
                      />
                    </Grid>
                    <Grid item xs={6} sx={{ display: "flex", alignItems: "center" }}>
                      <FormControlLabel
                        control={<Switch checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} color="success" />}
                        label={<Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)" }}>Active (visible on platform)</Typography>}
                      />
                    </Grid>
                  </Grid>
                </Stack>
              </Paper>
            </Stack>
          )}

          {/* ── Section 1: Media & Icon ── */}
          {activeSection === 1 && (
            <Stack gap={2.5}>
              {/* Hero Image */}
              <Paper sx={{ p: 2.5, borderRadius: 2.5, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Stack direction="row" alignItems="center" gap={1} mb={2}>
                  <Image sx={{ color: accent, fontSize: 18 }} />
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700}
                      sx={{ color: accent, fontSize: "0.68rem", letterSpacing: 1, textTransform: "uppercase" }}>
                      Service Hero Image
                    </Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.3)" }}>
                      1200 × 675 px (16:9) · Shown on website service landing page
                    </Typography>
                  </Box>
                </Stack>

                {imageUrl ? (
                  <Stack gap={1.5}>
                    <Box sx={{
                      width: "100%", height: 200, borderRadius: 2, overflow: "hidden",
                      border: `1px solid ${accent}40`, position: "relative",
                    }}>
                      <Box component="img" src={imageUrl} alt="service" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <Box sx={{ position: "absolute", top: 8, right: 8, bgcolor: "rgba(0,0,0,0.6)", borderRadius: 1, px: 1, py: 0.25 }}>
                        <Typography variant="caption" sx={{ color: accent, fontWeight: 600 }}>1200 × 675</Typography>
                      </Box>
                    </Box>
                    <Stack direction="row" gap={1}>
                      <Button size="small" variant="outlined" startIcon={<CloudUpload sx={{ fontSize: 14 }} />}
                        onClick={() => imageInputRef.current?.click()} disabled={!!uploading}
                        sx={{ textTransform: "none", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", "&:hover": { borderColor: accent, color: accent } }}>
                        Replace Image
                      </Button>
                      <Button size="small" variant="outlined" color="error"
                        onClick={() => setImageUrl(null)}
                        sx={{ textTransform: "none", borderColor: "rgba(255,80,80,0.3)", color: "rgba(255,100,100,0.7)" }}>
                        Remove
                      </Button>
                    </Stack>
                  </Stack>
                ) : (
                  <Box onClick={() => imageInputRef.current?.click()}
                    sx={{
                      width: "100%", height: 160,
                      border: `2px dashed ${accent}30`, borderRadius: 2,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      gap: 1.5, cursor: "pointer", transition: "all 0.2s",
                      "&:hover": { borderColor: `${accent}70`, bgcolor: `${accent}08` },
                    }}>
                    {uploading === "image" ? (
                      <><CircularProgress size={28} sx={{ color: accent }} /><Typography variant="caption" sx={{ color: accent }}>Uploading…</Typography></>
                    ) : (
                      <>
                        <CloudUpload sx={{ fontSize: 36, color: `${accent}60` }} />
                        <Typography variant="body2" fontWeight={600} sx={{ color: "rgba(255,255,255,0.5)" }}>Click to upload hero image</Typography>
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.25)" }}>PNG, JPG, WEBP — cropped to 1200×675 px</Typography>
                      </>
                    )}
                  </Box>
                )}
                <input ref={imageInputRef} type="file" hidden accept="image/*"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f, "image"); e.target.value = ""; }} />
              </Paper>

              {/* Icon */}
              <Paper sx={{ p: 2.5, borderRadius: 2.5, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Stack direction="row" alignItems="center" gap={1} mb={2}>
                  <Store sx={{ color: "#a78bfa", fontSize: 18 }} />
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700}
                      sx={{ color: "#a78bfa", fontSize: "0.68rem", letterSpacing: 1, textTransform: "uppercase" }}>
                      Service Icon
                    </Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.3)" }}>
                      200 × 200 px (1:1 square) · Used in app cards, filter chips, admin labels
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction="row" alignItems="center" gap={3}>
                  <Box sx={{
                    width: 100, height: 100, borderRadius: 2.5, flexShrink: 0,
                    border: "1px solid rgba(167,139,250,0.3)", overflow: "hidden",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: iconUrl ? "transparent" : "rgba(167,139,250,0.05)",
                  }}>
                    {iconUrl
                      ? <Box component="img" src={iconUrl} alt="icon" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <Typography fontSize={42}>{emoji}</Typography>
                    }
                  </Box>
                  <Stack gap={1.5} flex={1}>
                    {iconUrl ? (
                      <Stack direction="row" gap={1}>
                        <Button size="small" variant="outlined" startIcon={<CloudUpload sx={{ fontSize: 14 }} />}
                          onClick={() => iconInputRef.current?.click()} disabled={!!uploading}
                          sx={{ textTransform: "none", borderColor: "rgba(167,139,250,0.3)", color: "rgba(167,139,250,0.7)", "&:hover": { borderColor: "#a78bfa", color: "#c4b5fd" } }}>
                          Replace Icon
                        </Button>
                        <Button size="small" variant="outlined" color="error"
                          onClick={() => setIconUrl(null)}
                          sx={{ textTransform: "none", borderColor: "rgba(255,80,80,0.3)", color: "rgba(255,100,100,0.7)" }}>
                          Remove
                        </Button>
                      </Stack>
                    ) : (
                      <Button variant="outlined"
                        startIcon={uploading === "icon" ? <CircularProgress size={14} sx={{ color: "#a78bfa" }} /> : <CloudUpload sx={{ fontSize: 15 }} />}
                        onClick={() => iconInputRef.current?.click()} disabled={!!uploading}
                        sx={{ textTransform: "none", borderColor: "rgba(167,139,250,0.3)", color: "rgba(167,139,250,0.7)", alignSelf: "flex-start",
                          "&:hover": { borderColor: "#a78bfa", bgcolor: "rgba(167,139,250,0.08)" } }}>
                        {uploading === "icon" ? "Uploading…" : "Upload Icon"}
                      </Button>
                    )}
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.25)" }}>
                      Transparent PNG recommended. Will be cropped to 200×200 square.
                    </Typography>
                  </Stack>
                </Stack>
                <input ref={iconInputRef} type="file" hidden accept="image/*"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f, "icon"); e.target.value = ""; }} />
              </Paper>
            </Stack>
          )}

          {/* ── Section 2: SEO Details ── */}
          {activeSection === 2 && (
            <Stack gap={2.5}>
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                SEO metadata is used by the WayTero website for service landing pages. Optimised meta tags improve search rankings for each service.
              </Alert>
              <Paper sx={{ p: 2.5, borderRadius: 2.5, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Typography variant="subtitle2" fontWeight={700}
                  sx={{ color: "rgba(255,255,255,0.4)", mb: 2, fontSize: "0.68rem", letterSpacing: 1, textTransform: "uppercase" }}>
                  Page SEO
                </Typography>
                <Stack gap={2.5}>
                  <Box>
                    <TextField fullWidth label="SEO Title (meta title)"
                      value={form.seo_title}
                      onChange={e => setForm(p => ({ ...p, seo_title: e.target.value }))}
                      inputProps={{ maxLength: 120 }}
                      helperText={`${seoTitleLen}/120 chars · Ideal: 50–60 chars`}
                      InputLabelProps={{ sx: { color: "rgba(255,255,255,0.5)" } }}
                      InputProps={{ sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } } }}
                      FormHelperTextProps={{ sx: { color: seoTitleLen > 60 ? "#f59e0b" : "rgba(255,255,255,0.3)" } }}
                    />
                    {form.seo_title && (
                      <Box sx={{ mt: 0.75, px: 1.5, py: 0.5, borderRadius: 1, bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <Typography variant="caption" sx={{ color: "#8ab4f8", fontWeight: 600, fontSize: "0.8rem" }}>
                          {form.seo_title.slice(0, 60)}{form.seo_title.length > 60 ? "…" : ""}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  <Box>
                    <TextField fullWidth multiline rows={3} label="SEO Description (meta description)"
                      value={form.seo_description}
                      onChange={e => setForm(p => ({ ...p, seo_description: e.target.value }))}
                      inputProps={{ maxLength: 320 }}
                      helperText={`${seoDescLen}/320 chars · Ideal: 150–160 chars`}
                      InputLabelProps={{ sx: { color: "rgba(255,255,255,0.5)" } }}
                      InputProps={{ sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } } }}
                      FormHelperTextProps={{ sx: { color: seoDescLen > 160 ? "#f59e0b" : "rgba(255,255,255,0.3)" } }}
                    />
                    {(form.seo_title || form.seo_description) && (
                      <Box sx={{ mt: 1, p: 1.5, borderRadius: 2, bgcolor: "#fff", border: "1px solid #dfe1e5" }}>
                        <Typography variant="caption" sx={{ color: "#202124", fontWeight: 400, fontSize: "0.7rem" }}>
                          waytero.com › services › {serviceType.type_code.toLowerCase()}
                        </Typography>
                        <Typography sx={{ color: "#1a0dab", fontWeight: 500, fontSize: "0.92rem", lineHeight: 1.3, mb: 0.25 }}>
                          {form.seo_title || form.label || serviceType.type_code}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#4d5156", fontSize: "0.78rem", lineHeight: 1.4 }}>
                          {(form.seo_description || "No description set.").slice(0, 160)}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  <TextField fullWidth label="SEO Keywords"
                    value={form.seo_keywords}
                    onChange={e => setForm(p => ({ ...p, seo_keywords: e.target.value }))}
                    inputProps={{ maxLength: 500 }}
                    helperText="Comma-separated · e.g. cab booking, online taxi, outstation cab"
                    placeholder="cab booking, taxi, ride hailing, airport transfer"
                    InputLabelProps={{ sx: { color: "rgba(255,255,255,0.5)" } }}
                    InputProps={{ sx: { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } } }}
                    FormHelperTextProps={{ sx: { color: "rgba(255,255,255,0.3)" } }}
                  />
                  {form.seo_keywords && (
                    <Stack direction="row" flexWrap="wrap" gap={0.75}>
                      {form.seo_keywords.split(",").map(k => k.trim()).filter(Boolean).map(kw => (
                        <Chip key={kw} label={kw} size="small"
                          sx={{ bgcolor: `${accent}18`, color: accent, border: `1px solid ${accent}30`, fontSize: "0.7rem" }} />
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Paper>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {activeSection > 0 && (
            <Button variant="outlined" onClick={() => setActiveSection(s => s - 1)}
              sx={{ borderRadius: 2, borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)", textTransform: "none" }}>
              ← Previous
            </Button>
          )}
          {activeSection < SECTIONS.length - 1 && (
            <Button variant="outlined" onClick={() => setActiveSection(s => s + 1)}
              sx={{ borderRadius: 2, borderColor: `${accent}50`, color: accent, textTransform: "none", fontWeight: 600 }}>
              Next →
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={onClose} disabled={saving}
            sx={{ borderRadius: 2, color: "rgba(255,255,255,0.4)", textTransform: "none" }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={save}
            disabled={saving || !form.label.trim() || !!uploading}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save />}
            sx={{ background: grad, fontWeight: 700, borderRadius: 2, textTransform: "none", px: 3 }}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reuse VehicleCategoryCropModal for image cropping */}
      <VehicleCategoryCropModal
        open={cropOpen}
        file={cropFile}
        mode={cropMode}
        onClose={() => { setCropOpen(false); setCropFile(null); }}
        onCropped={handleCropped}
      />
    </>
  );
}

// ── Master Data Main Tab ──────────────────────────────────────
function MasterDataTab({ enqueueSnackbar }: any) {
  const [subTab, setSubTab] = useState(0);

  // Cities state
  const [cities, setCities] = useState<City[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState("");
  const [cityDialog, setCityDialog] = useState<{ open: boolean; city: City | null }>({ open: false, city: null });

  // Vehicle categories state
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);
  const [catDialog, setCatDialog] = useState<{ open: boolean; cat: VehicleCategory | null }>({ open: false, cat: null });

  // Service types state
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeRecord[]>([]);

  // Hotel master data state
  const [hotelCategories, setHotelCategories] = useState<any[]>([]);
  const [hotelAmenities, setHotelAmenities] = useState<any[]>([]);
  const [gstSlabs, setGstSlabs] = useState<any[]>([]);
  const [hotelMasterLoading, setHotelMasterLoading] = useState(false);
  const [stLoading, setStLoading] = useState(true);
  const [stDialog, setStDialog] = useState<{ open: boolean; st: ServiceTypeRecord | null }>({ open: false, st: null });
  const [stCreateOpen, setStCreateOpen] = useState(false);

  const loadCities = useCallback(async () => {
    setCitiesLoading(true);
    try {
      const [c, s] = await Promise.all([
        (settingsService as any).getCities(),
        (settingsService as any).getStates(),
      ]);
      setCities(c);
      setStates(s);
    } catch { enqueueSnackbar("Failed to load cities", { variant: "error" }); }
    finally { setCitiesLoading(false); }
  }, []);

  const loadCategories = useCallback(async () => {
    setCatsLoading(true);
    try { setCategories(await (settingsService as any).getVehicleCategories()); }
    catch { enqueueSnackbar("Failed to load vehicle categories", { variant: "error" }); }
    finally { setCatsLoading(false); }
  }, []);

  const loadServiceTypes = useCallback(async () => {
    setStLoading(true);
    try { setServiceTypes(await (settingsService as any).getServiceTypes()); }
    catch { enqueueSnackbar("Failed to load service types", { variant: "error" }); }
    finally { setStLoading(false); }
  }, []);

  useEffect(() => { loadCities(); loadCategories(); loadServiceTypes(); loadHotelMasters(); }, [loadCities, loadCategories, loadServiceTypes]);

  const loadHotelMasters = async () => {
    setHotelMasterLoading(true);
    try {
      const [cats, ams, slabs] = await Promise.all([
        hotelService.listCategories(true),
        hotelService.listAmenities(true),
        hotelService.listGstSlabs(true),
      ]);
      setHotelCategories(cats);
      setHotelAmenities(ams);
      setGstSlabs(slabs);
    } catch { enqueueSnackbar("Failed to load hotel master data", { variant: "error" }); }
    finally { setHotelMasterLoading(false); }
  };

  const deleteCity = async (id: number, name: string) => {
    if (!window.confirm(`Delete city "${name}"? This cannot be undone.`)) return;
    try {
      await (settingsService as any).deleteCity(id);
      enqueueSnackbar("City deleted", { variant: "success" });
      loadCities();
    } catch { enqueueSnackbar("Delete failed — city may be in use by bookings or commission rules", { variant: "error" }); }
  };

  const deleteCategory = async (id: number, name: string) => {
    if (!window.confirm(`Delete vehicle category "${name}"? This cannot be undone.`)) return;
    try {
      await (settingsService as any).deleteVehicleCategory(id);
      enqueueSnackbar("Category deleted", { variant: "success" });
      loadCategories();
    } catch { enqueueSnackbar("Delete failed — category may be in use by pricing rules or vehicles", { variant: "error" }); }
  };

  const filteredCities = cities.filter(c =>
    !cityFilter || c.name.toLowerCase().includes(cityFilter.toLowerCase()) ||
    (c.state_name ?? "").toLowerCase().includes(cityFilter.toLowerCase()) ||
    (c.city_code ?? "").toLowerCase().includes(cityFilter.toLowerCase())
  );

  // Group cities by state
  const citiesByState = filteredCities.reduce((acc, city) => {
    const key = city.state_name ?? "Unknown State";
    if (!acc[key]) acc[key] = [];
    acc[key].push(city);
    return acc;
  }, {} as Record<string, City[]>);

  return (
    <Box>
      {/* Sub-tab Header */}
      <Paper variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
        <Tabs value={subTab} onChange={(_, v) => setSubTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}>
          <Tab
            icon={<LocationCity sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={`Cities ${cities.length > 0 ? `(${cities.length})` : ""}`}
          />
          <Tab
            icon={<DirectionsCar sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={`Vehicle Categories (CAB Assets) ${categories.length > 0 ? `(${categories.length})` : ""}`}
          />
          <Tab
            icon={<FilterAlt sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={`Service Types ${serviceTypes.length > 0 ? `(${serviceTypes.length})` : ""}`}
          />
          <Tab
            icon={<Hotel sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={`Hotel Categories ${hotelCategories.length > 0 ? `(${hotelCategories.length})` : ""}`}
          />
          <Tab
            icon={<Spa sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={`Hotel Amenities ${hotelAmenities.length > 0 ? `(${hotelAmenities.length})` : ""}`}
          />
          <Tab
            icon={<AccountBalance sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={`GST Slabs (Hotel) ${gstSlabs.length > 0 ? `(${gstSlabs.length})` : ""}`}
          />
        </Tabs>
      </Paper>

      {/* ── Sub-tab 0: Cities ───────────────────────────────── */}
      {subTab === 0 && (
        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
            <Box>
              <Typography variant="h6" fontWeight={700}>City Management</Typography>
              <Typography variant="body2" color="text.secondary">
                Cities used in commission rules, pricing rules, partner locations & bookings
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                placeholder="Search cities..."
                value={cityFilter}
                onChange={e => setCityFilter(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start">🔍</InputAdornment> }}
                sx={{ width: 220 }}
              />
              <Tooltip title="Refresh">
                <IconButton onClick={loadCities}><Refresh /></IconButton>
              </Tooltip>
              <Button
                variant="contained" startIcon={<Add />}
                onClick={() => setCityDialog({ open: true, city: null })}
                sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
              >
                Add City
              </Button>
            </Stack>
          </Stack>

          {citiesLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
          ) : cities.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 6, textAlign: "center", borderRadius: 3, borderStyle: "dashed" }}>
              <LocationCity sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
              <Typography color="text.secondary" mb={2}>No cities configured yet</Typography>
              <Button variant="contained" startIcon={<Add />} onClick={() => setCityDialog({ open: true, city: null })}>
                Add First City
              </Button>
            </Paper>
          ) : (
            <Stack spacing={2}>
              {Object.entries(citiesByState).sort(([a], [b]) => a.localeCompare(b)).map(([stateName, stateCities]) => (
                <Card key={stateName} variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardHeader
                    title={
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Chip label={stateName} size="small" color="primary" variant="outlined" />
                        <Typography variant="caption" color="text.secondary">{stateCities.length} cities</Typography>
                      </Stack>
                    }
                    sx={{ pb: 0, pt: 1.5 }}
                  />
                  <CardContent sx={{ pt: 1 }}>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "action.hover", fontSize: 12 } }}>
                            <TableCell>City Name</TableCell>
                            <TableCell>Code</TableCell>
                            <TableCell>Coordinates</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {stateCities.map(city => (
                            <TableRow key={city.id} hover sx={{ opacity: city.is_active ? 1 : 0.6 }}>
                              <TableCell>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                  <LocationCity sx={{ fontSize: 14, color: "text.secondary" }} />
                                  <Typography fontWeight={600} fontSize={13}>{city.name}</Typography>
                                </Stack>
                              </TableCell>
                              <TableCell>
                                {city.city_code ? (
                                  <Chip label={city.city_code} size="small" variant="outlined" sx={{ fontFamily: "monospace", fontSize: 11 }} />
                                ) : (
                                  <Typography variant="caption" color="text.disabled">—</Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                {city.latitude != null && city.longitude != null ? (
                                  <Tooltip title="City-centre coordinates used to bias Google Places autocomplete">
                                    <Typography
                                      variant="caption"
                                      sx={{ fontFamily: "monospace", fontSize: 11, color: "text.secondary" }}
                                    >
                                      {city.latitude.toFixed(4)}, {city.longitude.toFixed(4)}
                                    </Typography>
                                  </Tooltip>
                                ) : (
                                  <Tooltip title="No coordinates — autocomplete will not be biased for this city">
                                    <Chip label="Missing" size="small" color="warning" variant="outlined" sx={{ fontSize: 10, height: 20 }} />
                                  </Tooltip>
                                )}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={city.is_active ? "Active" : "Inactive"}
                                  size="small"
                                  color={city.is_active ? "success" : "default"}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                  <Tooltip title="Edit city">
                                    <IconButton size="small" onClick={() => setCityDialog({ open: true, city })}>
                                      <Edit fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Delete city">
                                    <IconButton size="small" color="error" onClick={() => deleteCity(city.id, city.name)}>
                                      <Delete fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Box>
      )}

      {/* ── Sub-tab 1: Vehicle Categories ───────────────────── */}
      {subTab === 1 && (
        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
            <Box>
              <Typography variant="h6" fontWeight={700}>Vehicle Categories (CAB Booking Assets)</Typography>
              <Typography variant="body2" color="text.secondary">
                Vehicle types used in CAB bookings, vehicle pricing rules, and driver vehicle assignments
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Refresh">
                <IconButton onClick={loadCategories}><Refresh /></IconButton>
              </Tooltip>
              <Button
                variant="contained" startIcon={<Add />}
                onClick={() => setCatDialog({ open: true, cat: null })}
                sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
              >
                Add Category
              </Button>
            </Stack>
          </Stack>

          {catsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
          ) : categories.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 6, textAlign: "center", borderRadius: 3, borderStyle: "dashed" }}>
              <DirectionsCar sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
              <Typography color="text.secondary" mb={2}>No vehicle categories configured yet</Typography>
              <Button variant="contained" startIcon={<Add />} onClick={() => setCatDialog({ open: true, cat: null })}>
                Add First Category
              </Button>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {categories.map(cat => (
                <Grid item xs={12} sm={6} md={4} key={cat.id}>
                  <Card
                    variant="outlined"
                    sx={{
                      borderRadius: 2, height: "100%",
                      opacity: cat.is_active ? 1 : 0.6,
                      borderColor: cat.is_active ? "divider" : "action.disabledBackground",
                      transition: "box-shadow 0.2s",
                      "&:hover": { boxShadow: "0 2px 12px rgba(0,0,0,0.1)" },
                    }}
                  >
                    <CardContent sx={{ p: 0 }}>
                      {cat.image_url && (
                        <Box sx={{ width: "100%", height: 100, overflow: "hidden", borderRadius: "8px 8px 0 0" }}>
                          <Box component="img" src={cat.image_url} alt={cat.category_name}
                            sx={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s", "&:hover": { transform: "scale(1.05)" } }} />
                        </Box>
                      )}
                      <Box sx={{ p: 2 }}>
                      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={1.5}>
                        <Box sx={{
                          width: 52, height: 52, borderRadius: 2, overflow: "hidden",
                          bgcolor: cat.is_active ? "primary.50" : "action.hover",
                          border: 1, borderColor: cat.is_active ? "primary.200" : "divider",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
                          flexShrink: 0,
                        }}>
                          {cat.icon_url
                            ? <Box component="img" src={cat.icon_url} alt={cat.category_name}
                                sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : (VEHICLE_TYPE_ICONS[cat.category_name] ?? "🚘")
                          }
                        </Box>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => setCatDialog({ open: true, cat })}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => deleteCategory(cat.id, cat.category_name)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Stack>

                      <Typography fontWeight={700} fontSize={14} fontFamily="monospace" mb={0.5}>
                        {cat.category_name}
                      </Typography>

                      <Stack direction="row" spacing={1} mb={1.5} flexWrap="wrap" gap={0.5}>
                        {cat.seating_capacity != null && (
                          <Chip label={`${cat.seating_capacity} seats`} size="small" variant="outlined" color="primary" />
                        )}
                        {cat.luggage_capacity != null && (
                          <Chip label={`${cat.luggage_capacity} bags`} size="small" variant="outlined" />
                        )}
                      </Stack>

                      <Chip
                        label={cat.is_active ? "Active" : "Inactive"}
                        size="small"
                        color={cat.is_active ? "success" : "default"}
                      />
                      {(cat.seo_title || cat.seo_description) && (
                        <Tooltip title={cat.seo_title ?? "SEO configured"}>
                          <Chip label="SEO ✓" size="small" variant="outlined" color="info"
                            sx={{ mt: 0.75, fontSize: "0.65rem", height: 18 }} />
                        </Tooltip>
                      )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* ── Sub-tab 2: Service Types (editable) ────────────── */}
      {subTab === 2 && (
        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
            <Box>
              <Typography variant="h6" fontWeight={700}>Service Types</Typography>
              <Typography variant="body2" color="text.secondary">
                Platform service categories — edit labels, images, icons and SEO metadata for each type
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title="Refresh">
                <IconButton onClick={loadServiceTypes}><Refresh /></IconButton>
              </Tooltip>
              <Button
                variant="contained"
                size="small"
                startIcon={<Add />}
                onClick={() => setStCreateOpen(true)}
                sx={{ borderRadius: 2, fontWeight: 700, px: 2 }}
              >
                Add Service Type
              </Button>
            </Stack>
          </Stack>

          {stLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
          ) : (
            <Grid container spacing={3}>
              {serviceTypes.map(st => {
                const accent   = SERVICE_TYPE_ACCENT[st.type_code]   ?? "#a5b4fc";
                const grad     = SERVICE_TYPE_GRADIENT[st.type_code] ?? "linear-gradient(135deg,#667eea,#764ba2)";
                const emoji    = SERVICE_TYPE_EMOJI[st.type_code]    ?? "📋";
                return (
                  <Grid item xs={12} sm={4} key={st.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        borderRadius: 3,
                        opacity: st.is_active ? 1 : 0.6,
                        overflow: "hidden",
                        position: "relative",
                        transition: "box-shadow 0.2s, transform 0.2s",
                        "&:hover": { boxShadow: `0 8px 32px ${accent}44`, transform: "translateY(-2px)" },
                        border: `1.5px solid ${accent}55`,
                        background: `linear-gradient(180deg, ${accent}0a 0%, transparent 60%)`,
                      }}
                    >
                      {/* Hero banner */}
                      {st.image_url ? (
                        <Box sx={{ width: "100%", height: 120, overflow: "hidden", position: "relative" }}>
                          <Box
                            component="img" src={st.image_url} alt={st.label}
                            sx={{ width: "100%", height: "100%", objectFit: "cover",
                                  transition: "transform 0.4s", "&:hover": { transform: "scale(1.06)" } }}
                          />
                          <Box sx={{
                            position: "absolute", inset: 0,
                            background: `linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.55))`,
                          }} />
                        </Box>
                      ) : (
                        <Box sx={{
                          width: "100%", height: 120, display: "flex", alignItems: "center", justifyContent: "center",
                          background: grad, fontSize: 56,
                        }}>
                          {emoji}
                        </Box>
                      )}

                      <CardContent sx={{ p: 2.5 }}>
                        {/* Icon + actions row */}
                        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={1.5}>
                          <Box sx={{
                            width: 52, height: 52, borderRadius: 2, overflow: "hidden",
                            border: `2px solid ${accent}88`,
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
                            background: `${accent}18`, flexShrink: 0, mt: -5,
                            boxShadow: `0 4px 14px ${accent}44`,
                          }}>
                            {st.icon_url
                              ? <Box component="img" src={st.icon_url} alt={st.label}
                                     sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : emoji}
                          </Box>
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title={`Edit ${st.label}`}>
                              <IconButton
                                size="small"
                                onClick={() => setStDialog({ open: true, st })}
                                sx={{ color: accent, border: `1px solid ${accent}44`,
                                      "&:hover": { bgcolor: `${accent}18` } }}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Stack>

                        {/* Type code badge */}
                        <Chip
                          label={st.type_code}
                          size="small"
                          sx={{
                            mb: 1, fontFamily: "monospace", fontWeight: 700, fontSize: 11,
                            bgcolor: `${accent}22`, color: accent,
                            border: `1px solid ${accent}44`,
                          }}
                        />

                        {/* Label */}
                        <Typography fontWeight={700} fontSize={15} mb={0.5} noWrap>
                          {st.label}
                        </Typography>

                        {/* Description */}
                        {st.description && (
                          <Typography variant="body2" color="text.secondary" fontSize={12}
                            sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {st.description}
                          </Typography>
                        )}

                        {/* Chips row */}
                        <Stack direction="row" spacing={0.5} mt={1.5} flexWrap="wrap" gap={0.5}>
                          <Chip
                            label={st.is_active ? "Active" : "Inactive"}
                            size="small"
                            color={st.is_active ? "success" : "default"}
                          />
                          {st.display_order != null && (
                            <Chip label={`Order: ${st.display_order}`} size="small" variant="outlined" />
                          )}
                          {(st.seo_title || st.seo_description) && (
                            <Tooltip title={st.seo_title ?? "SEO configured"}>
                              <Chip label="SEO ✓" size="small" variant="outlined" color="info"
                                sx={{ fontSize: "0.65rem", height: 18 }} />
                            </Tooltip>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}

          {/* Usage reference table */}
          <Box mt={4}>
            <Typography variant="subtitle2" fontWeight={700} mb={1.5} color="text.secondary">
              How Service Types Are Used
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "action.hover" } }}>
                    <TableCell>Context</TableCell>
                    <TableCell>CAB</TableCell>
                    <TableCell>HOTEL</TableCell>
                    <TableCell>TOUR</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[
                    { ctx: "Commission Rules", cab: "✅ Per vehicle trip", hotel: "✅ Per booking", tour: "✅ Per package" },
                    { ctx: "Partner Services", cab: "✅ Partner provides cab rides", hotel: "✅ Partner manages hotel", tour: "✅ Partner sells tours" },
                    { ctx: "Booking Engine", cab: "✅ Cab booking module", hotel: "✅ Hotel booking module", tour: "✅ Tour booking module" },
                    { ctx: "Pricing Rules", cab: "✅ Vehicle × city × trip type", hotel: "➖ Room-level pricing", tour: "➖ Package-level pricing" },
                  ].map(row => (
                    <TableRow key={row.ctx} hover>
                      <TableCell><Typography variant="caption" fontWeight={600}>{row.ctx}</Typography></TableCell>
                      <TableCell><Typography variant="caption" color="primary.main">{row.cab}</Typography></TableCell>
                      <TableCell><Typography variant="caption" color="warning.main">{row.hotel}</Typography></TableCell>
                      <TableCell><Typography variant="caption" color="secondary.main">{row.tour}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Box>
      )}

      {/* ── Dialogs ──────────────────────────────────────────── */}
      <CityDialog
        open={cityDialog.open}
        city={cityDialog.city}
        states={states}
        onClose={() => setCityDialog({ open: false, city: null })}
        onSaved={() => { setCityDialog({ open: false, city: null }); loadCities(); }}
        enqueueSnackbar={enqueueSnackbar}
      />
      <VehicleCategoryDialog
        open={catDialog.open}
        category={catDialog.cat}
        onClose={() => setCatDialog({ open: false, cat: null })}
        onSaved={() => { setCatDialog({ open: false, cat: null }); loadCategories(); }}
        enqueueSnackbar={enqueueSnackbar}
      />
      <ServiceTypeDialog
        open={stDialog.open}
        serviceType={stDialog.st}
        onClose={() => setStDialog({ open: false, st: null })}
        onSaved={() => { setStDialog({ open: false, st: null }); loadServiceTypes(); }}
        enqueueSnackbar={enqueueSnackbar}
      />
      <ServiceTypeCreateDialog
        open={stCreateOpen}
        onClose={() => setStCreateOpen(false)}
        onSaved={() => { setStCreateOpen(false); loadServiceTypes(); }}
        enqueueSnackbar={enqueueSnackbar}
      />

      {/* ── Sub-tab 3: Hotel Categories ────────────────────── */}
      {subTab === 3 && (
        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
            <Box>
              <Typography variant="h6" fontWeight={700}>Hotel Categories</Typography>
              <Typography variant="body2" color="text.secondary">
                Property types — Boutique, Budget, Heritage, etc.
              </Typography>
            </Box>
            <Tooltip title="Refresh"><IconButton onClick={loadHotelMasters}><Refresh /></IconButton></Tooltip>
          </Stack>
          {hotelMasterLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
          ) : (
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04) }}>
                    <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Label</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Active</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {hotelCategories.map((c: any) => (
                    <TableRow key={c.id} hover>
                      <TableCell><Chip label={c.category_code} size="small" variant="outlined" /></TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{c.label}</TableCell>
                      <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>{c.description ?? "—"}</TableCell>
                      <TableCell>
                        <Chip
                          label={c.is_active ? "Active" : "Inactive"}
                          size="small"
                          color={c.is_active ? "success" : "default"}
                          sx={{ height: 20, fontSize: 11 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {hotelCategories.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ textAlign: "center", py: 4, color: "text.secondary" }}>
                        No hotel categories found — they are seeded from the migration.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </Box>
      )}

      {/* ── Sub-tab 4: Hotel Amenities ─────────────────────── */}
      {subTab === 4 && (
        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
            <Box>
              <Typography variant="h6" fontWeight={700}>Hotel Amenities</Typography>
              <Typography variant="body2" color="text.secondary">
                Amenities partners can assign to hotels and room categories
              </Typography>
            </Box>
            <Tooltip title="Refresh"><IconButton onClick={loadHotelMasters}><Refresh /></IconButton></Tooltip>
          </Stack>
          {hotelMasterLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
          ) : (
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04) }}>
                    <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Group</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Icon</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Active</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {hotelAmenities.map((a: any) => (
                    <TableRow key={a.id} hover>
                      <TableCell><Chip label={a.amenity_code} size="small" variant="outlined" /></TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{a.amenity_name}</TableCell>
                      <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>{a.amenity_group ?? "—"}</TableCell>
                      <TableCell sx={{ fontSize: 18 }}>{a.icon ?? "—"}</TableCell>
                      <TableCell>
                        <Chip
                          label={a.is_active ? "Active" : "Inactive"}
                          size="small"
                          color={a.is_active ? "success" : "default"}
                          sx={{ height: 20, fontSize: 11 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {hotelAmenities.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ textAlign: "center", py: 4, color: "text.secondary" }}>
                        No amenities found — they are seeded from the migration.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </Box>
      )}

      {/* ── Sub-tab 5: GST Slabs ──────────────────────────── */}
      {subTab === 5 && (
        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
            <Box>
              <Typography variant="h6" fontWeight={700}>Hotel GST Slabs</Typography>
              <Typography variant="body2" color="text.secondary">
                GST rate slabs applied to hotel bookings based on nightly tariff
              </Typography>
            </Box>
            <Tooltip title="Refresh"><IconButton onClick={loadHotelMasters}><Refresh /></IconButton></Tooltip>
          </Stack>
          {hotelMasterLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
          ) : (
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04) }}>
                    <TableCell sx={{ fontWeight: 700 }}>Slab name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Tariff from (₹)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Tariff to (₹)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>GST %</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Effective from</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Active</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {gstSlabs.map((s: any) => (
                    <TableRow key={s.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{s.slab_name}</TableCell>
                      <TableCell>₹{Number(s.tariff_from).toLocaleString("en-IN")}</TableCell>
                      <TableCell>{s.tariff_to ? `₹${Number(s.tariff_to).toLocaleString("en-IN")}` : "& above"}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{s.gst_percent}%</TableCell>
                      <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>
                        {s.effective_from ? new Date(s.effective_from).toLocaleDateString("en-IN") : "—"}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={s.is_active ? "Active" : "Inactive"}
                          size="small"
                          color={s.is_active ? "success" : "default"}
                          sx={{ height: 20, fontSize: 11 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {gstSlabs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ textAlign: "center", py: 4, color: "text.secondary" }}>
                        No GST slabs found — they are seeded from the migration.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </Box>
      )}
    </Box>
  );
}
