// ============================================================
// WAYTERO ADMIN — HOTEL APPROVAL DIALOG
// Doc Ref: 03_FRONTEND_DESIGN.md §6 "ApprovalDialog"
// Three modes: APPROVE | OWN_RISK | REJECT
// Own-risk requires justification remark.
// ============================================================

import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, TextField, Typography, Box, Chip,
  Alert, CircularProgress, ToggleButtonGroup, ToggleButton,
  Divider, alpha, useTheme, List, ListItem, ListItemIcon, ListItemText,
} from "@mui/material";
import {
  CheckCircle, Warning, Cancel, FactCheck, TaskAlt,
} from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import hotelService, { HotelDetail, HotelDocument, ReadinessReport } from "../../../services/hotel.service";
import { HOTEL_QUERY_KEYS, DOC_STATUS_COLOR } from "../constants";
import { apiErrorMessage } from "../../../utils/apiError";

type Mode = "APPROVE" | "OWN_RISK" | "REJECT";

interface Props {
  open: boolean;
  hotelId: number;
  hotel: HotelDetail;
  onClose: () => void;
  onActioned: () => void;
}

const REJECT_PRESETS = [
  "Incomplete mandatory documents",
  "Document details do not match",
  "Property location could not be verified",
  "GST/PAN information incorrect",
  "Images do not meet minimum quality standards",
];

export default function ApprovalDialog({ open, hotelId, hotel, onClose, onActioned }: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const [mode, setMode] = useState<Mode>("APPROVE");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setMode("APPROVE"); setRemarks(""); }
  }, [open]);

  const { data: readiness } = useQuery<ReadinessReport>({
    queryKey: [HOTEL_QUERY_KEYS.readiness, hotelId],
    queryFn: () => hotelService.getReadiness(hotelId),
    enabled: open,
  });

  const { data: docs = [] } = useQuery<HotelDocument[]>({
    queryKey: [HOTEL_QUERY_KEYS.documents, hotelId],
    queryFn: () => hotelService.listDocuments(hotelId),
    enabled: open,
    staleTime: 60_000,
  });

  const mandatoryDocs = docs.filter(d => d.verification_status !== 'APPROVED');
  const hasUnverifiedMandatory = mandatoryDocs.some(d => d.verification_status !== "VERIFIED");
  const canApprove = !hasUnverifiedMandatory;

  const isValid = (): boolean => {
    if (mode === "OWN_RISK") return remarks.trim().length >= 20;
    if (mode === "REJECT") return remarks.trim().length >= 5;
    return canApprove;
  };

  const handleAction = async () => {
    setSaving(true);
    try {
      if (mode === "REJECT") {
        await hotelService.reject(hotelId, remarks.trim());
        enqueueSnackbar("Hotel rejected", { variant: "warning" });
      } else {
        await hotelService.approve(hotelId, {
          own_risk: mode === "OWN_RISK",
          remarks: remarks.trim() || undefined,
        });
        enqueueSnackbar(mode === "OWN_RISK" ? "Own-risk approval recorded" : "Hotel approved", {
          variant: mode === "OWN_RISK" ? "warning" : "success",
        });
      }
      onActioned();
      onClose();
    } catch (e: any) {
      enqueueSnackbar(apiErrorMessage(e, "Action failed"), { variant: "error" });
    } finally { setSaving(false); }
  };

  const modeColor = mode === "APPROVE" ? "success" : mode === "OWN_RISK" ? "warning" : "error";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{
        background: mode === "APPROVE"
          ? `linear-gradient(135deg, ${theme.palette.success.dark}, ${theme.palette.success.main})`
          : mode === "OWN_RISK"
          ? `linear-gradient(135deg, ${theme.palette.warning.dark}, ${theme.palette.warning.main})`
          : `linear-gradient(135deg, ${theme.palette.error.dark}, ${theme.palette.error.main})`,
        color: "#fff",
        fontWeight: 800,
      }}>
        Hotel Approval Action
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={2.5}>
          {/* Mode selector */}
          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 1 }}>
              Action
            </Typography>
            <ToggleButtonGroup exclusive value={mode} onChange={(_, v) => v && setMode(v)} size="small" fullWidth>
              <ToggleButton value="APPROVE" color="success" sx={{ fontWeight: 700, fontSize: 12 }}>
                <TaskAlt sx={{ fontSize: 14, mr: 0.5 }} /> Approve
              </ToggleButton>
              <ToggleButton value="OWN_RISK" color="warning" sx={{ fontWeight: 700, fontSize: 12 }}>
                <Warning sx={{ fontSize: 14, mr: 0.5 }} /> Own-Risk
              </ToggleButton>
              <ToggleButton value="REJECT" color="error" sx={{ fontWeight: 700, fontSize: 12 }}>
                <Cancel sx={{ fontSize: 14, mr: 0.5 }} /> Reject
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Approve — show doc checklist */}
          {mode === "APPROVE" && (
            <>
              {hasUnverifiedMandatory && (
                <Alert severity="error" icon={<FactCheck />}>
                  Cannot approve: one or more mandatory documents are not yet verified.
                </Alert>
              )}
              <Box>
                <Typography variant="caption" fontWeight={700} sx={{ display: "block", mb: 1 }}>
                  Mandatory document status
                </Typography>
                <List dense disablePadding>
                  {mandatoryDocs.map(d => (
                    <ListItem key={d.id} disableGutters sx={{ py: 0.25 }}>
                      <ListItemIcon sx={{ minWidth: 28 }}>
                        {d.verification_status === "VERIFIED"
                          ? <CheckCircle sx={{ fontSize: 16, color: "success.main" }} />
                          : <Warning sx={{ fontSize: 16, color: "warning.main" }} />}
                      </ListItemIcon>
                      <ListItemText
                        primary={<Typography variant="caption">{d.document_type.replace(/_/g, " ")}</Typography>}
                        secondary={
                          <Chip label={d.verification_status} size="small"
                            color={(DOC_STATUS_COLOR as any)[d.verification_status] ?? "default"}
                            sx={{ height: 16, fontSize: 10 }}
                          />
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            </>
          )}

          {/* Own-risk warning */}
          {mode === "OWN_RISK" && (
            <Alert severity="warning" sx={{ fontSize: 12 }}>
              <strong>Officer check bypassed.</strong> This approval skips the normal verification officer sign-off. The action is logged and attributed to you. A justification remark is mandatory.
            </Alert>
          )}

          {/* Reject presets */}
          {mode === "REJECT" && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                Common reasons (click to fill)
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.5}>
                {REJECT_PRESETS.map(p => (
                  <Chip
                    key={p}
                    label={p}
                    size="small"
                    variant="outlined"
                    clickable
                    onClick={() => setRemarks(p)}
                    sx={{ fontSize: 11, height: 24 }}
                  />
                ))}
              </Stack>
            </Box>
          )}

          {/* Remarks */}
          {(mode === "OWN_RISK" || mode === "REJECT") && (
            <TextField
              label={mode === "OWN_RISK" ? "Justification (min 20 chars) *" : "Rejection reason *"}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              multiline
              rows={3}
              size="small"
              fullWidth
              required
              helperText={mode === "OWN_RISK"
                ? `${remarks.length}/20 min — explains why the officer check was bypassed`
                : `${remarks.length} chars — will be visible to the partner`}
              error={mode === "OWN_RISK" && remarks.length > 0 && remarks.trim().length < 20}
            />
          )}

          {/* Readiness summary */}
          {readiness && (
            <>
              <Divider />
              <Box>
                <Typography variant="caption" fontWeight={700} sx={{ display: "block", mb: 0.5 }}>
                  Readiness: {readiness.completeness_percent}%
                </Typography>
                {readiness.checks.filter(c => !c.passed).slice(0, 3).map(c => (
                  <Typography key={c.key} variant="caption" color="warning.main" sx={{ display: "block" }}>
                    ⚠ {c.label}: {c.hint}
                  </Typography>
                ))}
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained"
          color={modeColor}
          onClick={handleAction}
          disabled={saving || !isValid()}
          startIcon={saving ? <CircularProgress size={14} /> : undefined}
          sx={{ fontWeight: 700 }}
        >
          {mode === "APPROVE" ? "Approve Hotel"
            : mode === "OWN_RISK" ? "Own-Risk Approve"
            : "Reject Hotel"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
