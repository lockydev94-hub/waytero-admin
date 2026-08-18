// ============================================================
// WAYTERO ADMIN — HOTEL ASSIGN OFFICER DIALOG
// Doc Ref: 03_FRONTEND_DESIGN.md §6 "AssignOfficerDialog"
// Officer list with current hotel load, optional notes.
// ============================================================

import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, TextField, Typography, Box,
  CircularProgress, RadioGroup, FormControlLabel, Radio,
  Chip, Avatar, Alert, useTheme, alpha,
} from "@mui/material";
import { Person, Assignment, WarningAmber } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import hotelService, { VerificationOfficer } from "../../../services/hotel.service";
import { HOTEL_QUERY_KEYS } from "../constants";
import { apiErrorMessage } from "../../../utils/apiError";

interface Props {
  open: boolean;
  hotelId: number;
  currentOfficerId?: string;
  onClose: () => void;
  onAssigned?: () => void;
  onSaved?: () => void;
}

const ADMIN_TYPES = ["ADMIN", "SUPER_ADMIN"];
const isAdminType = (t?: string): boolean => ADMIN_TYPES.includes(t ?? "");
const roleLabel = (t?: string): string =>
  t === "SUPER_ADMIN" ? "Super Admin" : t === "ADMIN" ? "Admin" : "Officer";

export default function AssignOfficerDialog({ open, hotelId, currentOfficerId, onClose, onAssigned, onSaved }: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const [selectedId, setSelectedId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: officers = [], isLoading } = useQuery<VerificationOfficer[]>({
    queryKey: [HOTEL_QUERY_KEYS.officers],
    queryFn: () => hotelService.listOfficers(),
    enabled: open,
    staleTime: 60_000,
  });

  const selected = officers.find((o) => o.id === selectedId);
  const ownRisk = isAdminType(selected?.user_type);

  const handleAssign = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await hotelService.assignOfficer(hotelId, selectedId, notes.trim() || undefined);
      enqueueSnackbar("Officer assigned successfully", { variant: "success" });
      (onSaved ?? onAssigned)?.();
      onClose();
    } catch (e: any) {
      enqueueSnackbar(apiErrorMessage(e, "Assignment failed"), { variant: "error" });
    } finally { setSaving(false); }
  };

  const handleClose = () => {
    setSelectedId("");
    setNotes("");
    onClose();
  };

  const loadColor = (count: number) => {
    if (count === 0) return theme.palette.success.main;
    if (count <= 3) return theme.palette.info.main;
    if (count <= 6) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{
        background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
        color: "primary.contrastText",
        fontWeight: 800,
      }}>
        Assign Verification Officer
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={2}>
          {isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : officers.length === 0 ? (
            <Alert severity="warning">No verification officers available.</Alert>
          ) : (
            <>
              <Typography variant="caption" color="text.secondary">
                Select a verification officer — current hotel load is shown to balance
                assignments. Admins and super-admins may self-assign to verify at their own risk.
              </Typography>
              <RadioGroup value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                <Stack spacing={1}>
                  {officers.map((o) => (
                    <Box
                      key={o.id}
                      onClick={() => setSelectedId(o.id)}
                      sx={{
                        display: "flex", alignItems: "center", gap: 1.5,
                        p: 1.5, borderRadius: 2,
                        border: `1.5px solid ${selectedId === o.id ? theme.palette.primary.main : theme.palette.divider}`,
                        bgcolor: selectedId === o.id ? alpha(theme.palette.primary.main, 0.04) : "background.paper",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        "&:hover": { borderColor: theme.palette.primary.light },
                      }}
                    >
                      <FormControlLabel
                        value={o.id}
                        control={<Radio size="small" />}
                        label=""
                        sx={{ m: 0 }}
                        onClick={e => e.stopPropagation()}
                      />
                      <Avatar sx={{ width: 34, height: 34, bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main", fontSize: 14, fontWeight: 700 }}>
                        {(o.name ?? "—").charAt(0)}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{o.name ?? "—"}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>{o.email}</Typography>
                      </Box>
                      <Stack spacing={0.5} alignItems="flex-end">
                        <Chip
                          icon={isAdminType(o.user_type) ? <WarningAmber sx={{ fontSize: 12 }} /> : undefined}
                          label={isAdminType(o.user_type) ? `${roleLabel(o.user_type)} · own risk` : roleLabel(o.user_type)}
                          size="small"
                          color={isAdminType(o.user_type) ? "warning" : "default"}
                          variant="outlined"
                          sx={{ fontSize: 10, height: 20, "& .MuiChip-icon": { color: "inherit" } }}
                        />
                        <Chip
                          icon={<Assignment sx={{ fontSize: 12 }} />}
                          label={`${o.active_hotel_count} hotels`}
                          size="small"
                          sx={{
                            fontSize: 11, height: 22,
                            bgcolor: alpha(loadColor(o.active_hotel_count), 0.1),
                            color: loadColor(o.active_hotel_count),
                            border: `1px solid ${alpha(loadColor(o.active_hotel_count), 0.3)}`,
                            "& .MuiChip-icon": { color: "inherit" },
                          }}
                        />
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </RadioGroup>
            </>
          )}

          <TextField
            label="Notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            multiline
            rows={2}
            size="small"
            fullWidth
            placeholder="Any context for the officer..."
            inputProps={{ maxLength: 500 }}
          />

          {ownRisk && (
            <Alert severity="warning" icon={<WarningAmber />}>
              This hotel will be verified by <strong>{selected?.name ?? roleLabel(selected?.user_type)}</strong>{" "}
              ({roleLabel(selected?.user_type)}) at your own risk. Verifying as an admin
              bypasses the independent verification-officer review — you are accountable for
              confirming the hotel's documents, business details and location yourself.
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={handleClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleAssign}
          disabled={saving || !selectedId}
          startIcon={saving ? <CircularProgress size={14} /> : <Person />}
        >
          Assign
        </Button>
      </DialogActions>
    </Dialog>
  );
}
