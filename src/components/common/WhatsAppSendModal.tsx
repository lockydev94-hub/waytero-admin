// ============================================================
// WAYTERO ADMIN — WHATSAPP DOCUMENT SEND MODAL
// File: src/components/common/WhatsAppSendModal.tsx
//
// One modal for every customer document (booking voucher, invoice,
// payment receipt). The agent confirms the customer, can correct the
// WhatsApp number, and the browser downloads the PDF and opens a
// WhatsApp Web chat with a ready message.
//
// WhatsApp Web does not allow a website to attach a local file to a
// chat programmatically. The PDF is therefore downloaded first and the
// admin attaches it in the chat that opens — the modal states this
// explicitly so the flow is never mistaken for a silent send.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Download, PictureAsPdf, WhatsApp } from "@mui/icons-material";
import { useSnackbar } from "notistack";

export interface WhatsAppDocumentRequest {
  /** Customer-facing document name, e.g. "Booking confirmation". */
  documentLabel: string;
  /** Service name, e.g. "Cab booking", "Hotel stay", "Tour package". */
  serviceLabel: string;
  /** Booking reference shown to the customer. */
  bookingNumber: string;
  /** Suggested filename for the downloaded PDF. */
  filename: string;
  /** Fetches the actual PDF bytes from the admin API. */
  loadPdf: () => Promise<Blob>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  customerName?: string | null;
  customerMobile?: string | null;
  request: WhatsAppDocumentRequest | null;
}

function normalizeWhatsAppNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // Indian local numbers are 10 digits; prefix the country code. Numbers
  // already carrying 91 (or another country code) are kept as entered.
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function WhatsAppSendModal({
  open,
  onClose,
  customerName,
  customerMobile,
  request,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNumber(customerMobile ?? "");
    setError(null);
    setBusy(false);
  }, [open, customerMobile]);

  const normalized = useMemo(() => normalizeWhatsAppNumber(number), [number]);

  const handleDownload = async () => {
    if (!request) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await request.loadPdf();
      saveBlob(blob, request.filename);
      enqueueSnackbar("PDF downloaded", { variant: "success" });
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not generate the PDF.");
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async () => {
    if (!request) return;
    if (!normalized) {
      setError("Enter a valid WhatsApp number (10-digit Indian or full international).");
      return;
    }

    // Open the tab while the click is still a user gesture, then point it at
    // WhatsApp once the PDF has been generated. Without this the async await
    // can make desktop browsers treat the navigation as a blocked popup.
    const waTab = window.open("about:blank", "_blank");
    setBusy(true);
    setError(null);
    try {
      const blob = await request.loadPdf();
      saveBlob(blob, request.filename);

      const who = customerName?.trim() || "there";
      const message = [
        `Hello ${who},`,
        "",
        `Please find attached your ${request.documentLabel.toLowerCase()} for ${request.serviceLabel.toLowerCase()} (${request.bookingNumber}).`,
        "",
        "Thank you,",
        "WayTero",
      ].join("\n");
      const url = `https://web.whatsapp.com/send?phone=${normalized}&text=${encodeURIComponent(message)}`;

      if (waTab) {
        waTab.location.href = url;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      enqueueSnackbar(
        `PDF downloaded. Attach ${request.filename} in the WhatsApp chat to send it.`,
        { variant: "info", autoHideDuration: 8000 },
      );
      onClose();
    } catch (e: any) {
      waTab?.close();
      setError(e?.response?.data?.detail || "Could not generate the PDF.");
    } finally {
      setBusy(false);
    }
  };

  if (!request) return null;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Avatar sx={{ width: 38, height: 38, bgcolor: "#25D366", color: "#fff" }}>
            <WhatsApp fontSize="small" />
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight={800} lineHeight={1.2}>
              Send {request.documentLabel.toLowerCase()} on WhatsApp
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {request.serviceLabel} · {request.bookingNumber}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2 }}>
          WhatsApp Web opens with a ready message. The PDF downloads first — attach
          the downloaded file in the chat to send it to the customer.
        </Alert>

        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <Avatar sx={{ bgcolor: "primary.main", fontWeight: 800 }}>
            {(customerName || "C").charAt(0).toUpperCase()}
          </Avatar>
          <Box flex={1} minWidth={0}>
            <Typography variant="body2" fontWeight={800} noWrap>
              {customerName || "Customer"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {customerMobile || "No mobile number on profile"}
            </Typography>
          </Box>
        </Stack>

        <TextField
          label="WhatsApp number"
          value={number}
          onChange={(e) => {
            setNumber(e.target.value);
            setError(null);
          }}
          fullWidth
          size="small"
          placeholder="9876543210"
          helperText={
            normalized
              ? `Will open WhatsApp for +${normalized}`
              : "Enter 10 digits, or the full number with country code."
          }
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start">+</InputAdornment>,
            },
          }}
        />

        <Divider sx={{ my: 2.5 }} />

        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}
        >
          <PictureAsPdf color="error" />
          <Box flex={1} minWidth={0}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {request.documentLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {request.filename}
            </Typography>
          </Box>
          <Button
            size="small"
            startIcon={<Download />}
            onClick={handleDownload}
            disabled={busy}
          >
            Download
          </Button>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <WhatsApp />}
          onClick={handleSend}
          disabled={busy || !normalized}
          sx={{ bgcolor: "#25D366", "&:hover": { bgcolor: "#1da851" } }}
        >
          {busy ? "Preparing PDF…" : "Send on WhatsApp"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
