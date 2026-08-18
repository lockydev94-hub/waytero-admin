// ============================================================
// HOTEL DETAIL — DOCUMENTS TAB
// Doc Ref: 03_FRONTEND_DESIGN.md §5 — upload + verify docs
// ============================================================
import React, { useState } from "react";
import {
  Box, Typography, Card, CardContent, Stack, Chip, Button,
  IconButton, Tooltip, Alert, Divider, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, alpha, useTheme, Link,
} from "@mui/material";
import {
  Upload, CheckCircle, Cancel, HourglassEmpty, WarningAmber,
  OpenInNew, Delete, Refresh,
} from "@mui/icons-material";
import { useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { hotelService, HotelDetail, HotelDocument, HOTEL_UPLOAD_FOLDERS } from "../../../../services/hotel.service";
import { uploadMedia } from "../../../../services/settings.service";
import { HOTEL_QUERY_KEYS } from "../../constants";
import { isAdminOrOfficer } from "../../../../utils/currentUser";

// Codes must match Backend/app/modules/hotel/constants/__init__.py (HOTEL_DOCUMENT_TYPES).
// Mandatory set mirrors HOTEL_REQUIRED_DOCUMENT_TYPES; GST is conditional (only when the
// hotel is GST-registered) so it sits with the optional set here.
const REQUIRED_TYPES = ["PAN_CARD", "TRADE_LICENSE", "BANK_PROOF"];
const OPTIONAL_TYPES = [
  "GST_CERTIFICATE",
  "FIRE_SAFETY_CERTIFICATE",
  "FSSAI_LICENSE",
  "PROPERTY_OWNERSHIP_PROOF",
  "TOURISM_REGISTRATION",
  "OTHER",
];

const DOC_LABELS: Record<string, string> = {
  PAN_CARD: "PAN Card",
  TRADE_LICENSE: "Trade License",
  BANK_PROOF: "Bank Proof",
  GST_CERTIFICATE: "GST Certificate",
  FIRE_SAFETY_CERTIFICATE: "Fire Safety Certificate",
  FSSAI_LICENSE: "FSSAI License",
  PROPERTY_OWNERSHIP_PROOF: "Property Ownership Proof",
  TOURISM_REGISTRATION: "Tourism Registration",
  OTHER: "Other",
};

const STATUS_META: Record<string, { label: string; color: any; icon: React.ReactNode }> = {
  PENDING: { label: "Pending", color: "default", icon: <HourglassEmpty fontSize="small" /> },
  VERIFIED: { label: "Verified", color: "success", icon: <CheckCircle fontSize="small" /> },
  REJECTED: { label: "Rejected", color: "error", icon: <Cancel fontSize="small" /> },
};

function isExpiringSoon(date: string | null) {
  if (!date) return false;
  const diff = (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 30;
}

interface Props {
  hotel: HotelDetail;
  isOfficer: boolean;
  onRefresh: () => void;
}

function DocRow({
  docType,
  document,
  hotelId,
  isOfficer,
  onRefresh,
}: {
  docType: string;
  document?: HotelDocument;
  hotelId: number;
  isOfficer: boolean;
  onRefresh: () => void;
}) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [remarks, setRemarks] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.detail, hotelId] });
    onRefresh();
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadMedia(file, "document", {
        folderOverride: HOTEL_UPLOAD_FOLDERS.documents,
      });
      await hotelService.addDocument(hotelId, {
        document_type: docType,
        file_url: result.secure_url,
      });
      enqueueSnackbar("Document uploaded", { variant: "success" });
      invalidate();
    } catch { enqueueSnackbar("Upload failed", { variant: "error" }); }
    finally { setUploading(false); }
  };

  const handleVerify = async () => {
    if (!document) return;
    try {
      await hotelService.verifyDocument(hotelId, document.id, { verification_status: "VERIFIED", remarks: "" });
      enqueueSnackbar("Document verified", { variant: "success" });
      invalidate();
    } catch { enqueueSnackbar("Failed", { variant: "error" }); }
  };

  const handleReject = async () => {
    if (!document || !remarks.trim()) return;
    try {
      await hotelService.verifyDocument(hotelId, document.id, { verification_status: "REJECTED", remarks });
      enqueueSnackbar("Document rejected", { variant: "warning" });
      setRejectOpen(false);
      setRemarks("");
      invalidate();
    } catch { enqueueSnackbar("Failed", { variant: "error" }); }
  };

  const statusMeta = document ? (STATUS_META[document.verification_status] ?? STATUS_META.PENDING) : null;
  const expiring = isExpiringSoon(document?.expiry_date ?? null);

  return (
    <>
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        sx={{
          py: 1.5, px: 2,
          borderRadius: 1.5,
          bgcolor: document ? "transparent" : alpha(theme.palette.warning.main, 0.05),
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" fontWeight={600}>{DOC_LABELS[docType] ?? docType}</Typography>
            {!document && <Chip label="Missing" size="small" color="warning" variant="outlined" sx={{ height: 18, fontSize: "0.65rem" }} />}
            {document && (
              <Chip
                label={statusMeta!.label}
                size="small"
                color={statusMeta!.color}
                icon={statusMeta!.icon as any}
                sx={{ height: 20, fontSize: "0.68rem" }}
              />
            )}
            {expiring && (
              <Chip
                label="Expiring soon"
                size="small"
                color="warning"
                icon={<WarningAmber sx={{ fontSize: "0.75rem !important" }} />}
                sx={{ height: 20, fontSize: "0.65rem" }}
              />
            )}
          </Stack>
          {document?.document_number && (
            <Typography variant="caption" color="text.secondary">Doc #: {document.document_number}</Typography>
          )}
          {document?.expiry_date && (
            <Typography variant="caption" color={expiring ? "warning.main" : "text.secondary"} sx={{ display: "block" }}>
              Expires: {new Date(document.expiry_date).toLocaleDateString()}
            </Typography>
          )}
        </Box>

        <Stack direction="row" spacing={0.5} alignItems="center">
          {document?.file_url && (
            <Tooltip title="View document">
              <IconButton size="small" component="a" href={document.file_url} target="_blank" rel="noreferrer">
                <OpenInNew fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {/* Admin or Officer actions */}
          {isAdminOrOfficer() && document && document.verification_status === "PENDING" && (
            <>
              <Button size="small" color="success" variant="outlined" onClick={handleVerify} sx={{ height: 28, fontSize: "0.72rem" }}>
                Approve
              </Button>
              <Button size="small" color="error" variant="outlined" onClick={() => setRejectOpen(true)} sx={{ height: 28, fontSize: "0.72rem" }}>
                Reject
              </Button>
            </>
          )}

          {/* Admin upload */}
          {!isOfficer && (
            <Button
              size="small"
              component="label"
              variant="outlined"
              startIcon={uploading ? <CircularProgress size={12} /> : <Upload />}
              disabled={uploading}
              sx={{ height: 28, fontSize: "0.72rem" }}
            >
              {document ? "Replace" : "Upload"}
              <input type="file" hidden accept="application/pdf,image/*" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            </Button>
          )}
        </Stack>
      </Stack>

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Reject Document</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth multiline rows={3}
            value={remarks} onChange={(e) => setRemarks(e.target.value)}
            label="Rejection reason *" placeholder="State the reason clearly..."
            size="small" sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)}>Cancel</Button>
          <Button onClick={handleReject} color="error" variant="contained" disabled={!remarks.trim()}>Reject</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default function DocumentsTab({ hotel, isOfficer, onRefresh }: Props) {
  const docs = hotel.documents ?? [];
  const getDoc = (type: string) => docs.find((d) => d.document_type === type);

  const verifiedRequired = REQUIRED_TYPES.filter((t) => getDoc(t)?.verification_status === "VERIFIED").length;

  return (
    <Box sx={{ p: 3 }}>
      {verifiedRequired < REQUIRED_TYPES.length && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          {REQUIRED_TYPES.length - verifiedRequired} mandatory document{REQUIRED_TYPES.length - verifiedRequired > 1 ? "s" : ""} pending verification.
        </Alert>
      )}

      {/* Mandatory */}
      <Card variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
        <CardContent sx={{ pb: "8px !important" }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Mandatory Documents</Typography>
          <Stack divider={<Divider />}>
            {REQUIRED_TYPES.map((type) => (
              <DocRow key={type} docType={type} document={getDoc(type)} hotelId={hotel.id} isOfficer={isOfficer} onRefresh={onRefresh} />
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* Optional */}
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ pb: "8px !important" }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Optional Documents</Typography>
          <Stack divider={<Divider />}>
            {OPTIONAL_TYPES.map((type) => (
              <DocRow key={type} docType={type} document={getDoc(type)} hotelId={hotel.id} isOfficer={isOfficer} onRefresh={onRefresh} />
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
