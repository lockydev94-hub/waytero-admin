// ============================================================
// WAYTERO ADMIN — BULK ROOMS DIALOG
// Doc Ref: 03_FRONTEND_DESIGN.md §6 "BulkRoomsDialog"
// Prefix+count or range input, collision preview.
// ============================================================

import { useState, useMemo } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, Typography, Chip, Alert,
  CircularProgress, ToggleButtonGroup, ToggleButton,
  Box,
} from "@mui/material";
import { useSnackbar } from "notistack";

import hotelService from "../../../services/hotel.service";
import { apiErrorMessage } from "../../../utils/apiError";

interface Props {
  open: boolean;
  hotelId: number;
  categoryId: number;
  categoryName: string;
  onClose: () => void;
  onSaved: () => void;
}

type Mode = "range" | "prefix";

/** Server caps a batch at 500 (BulkRoomCreate.count le=500); stay well inside. */
const MAX_ROOMS = 100;

export default function BulkRoomsDialog({ open, hotelId, categoryId, categoryName, onClose, onSaved }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [mode, setMode] = useState<Mode>("prefix");
  const [prefix, setPrefix] = useState("10");
  const [count, setCount] = useState("10");
  const [range, setRange] = useState("101-120");
  const [saving, setSaving] = useState(false);

  // Mirrors the server's generator exactly (services/rooms.py bulk_create_rooms):
  //   f"{prefix}{str(start_number + n).zfill(pad_width)}" for n in range(count)
  // Preview and payload are derived from the same values, so what the admin
  // sees in the chips is what actually gets created.
  const { prefix: sentPrefix, startNumber, count: sentCount, padWidth } = useMemo(() => {
    if (mode === "prefix") {
      return {
        prefix: prefix.trim(),
        startNumber: 1,
        count: Math.min(Math.max(1, Number(count) || 0), MAX_ROOMS),
        padWidth: 2,
      };
    }
    const [rawStart, rawEnd] = range.split("-");
    const start = Number(rawStart);
    const end = Number(rawEnd);
    const valid =
      range.split("-").length === 2 &&
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      end >= start;
    return {
      prefix: "",
      startNumber: valid ? start : 0,
      count: valid ? Math.min(end - start + 1, MAX_ROOMS) : 0,
      padWidth: 0,
    };
  }, [mode, prefix, count, range]);

  const preview = useMemo(
    (): string[] =>
      Array.from({ length: sentCount }, (_, i) =>
        `${sentPrefix}${String(startNumber + i).padStart(padWidth, "0")}`
      ),
    [sentPrefix, startNumber, sentCount, padWidth]
  );

  const handleSave = async () => {
    if (preview.length === 0) { enqueueSnackbar("No valid room numbers to create", { variant: "warning" }); return; }
    setSaving(true);
    try {
      await hotelService.bulkCreateRooms(hotelId, {
        room_category_id: categoryId,
        prefix: sentPrefix,
        start_number: startNumber,
        count: sentCount,
        pad_width: padWidth,
      });
      enqueueSnackbar(`${preview.length} rooms created`, { variant: "success" });
      onSaved();
      onClose();
    } catch (e: any) {
      enqueueSnackbar(apiErrorMessage(e, "Create failed"), { variant: "error" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Add Physical Rooms — {categoryName}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_, v) => v && setMode(v)}
            size="small"
          >
            <ToggleButton value="prefix">Prefix + count</ToggleButton>
            <ToggleButton value="range">Range</ToggleButton>
          </ToggleButtonGroup>

          {mode === "prefix" ? (
            <Stack direction="row" spacing={2}>
              <TextField label="Prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} size="small" sx={{ flex: 1 }} placeholder="e.g. 10" />
              <TextField label="Count" type="number" value={count} onChange={(e) => setCount(e.target.value)} size="small" sx={{ flex: 1 }} inputProps={{ min: 1, max: 100 }} />
            </Stack>
          ) : (
            <TextField label="Room number range" value={range} onChange={(e) => setRange(e.target.value)} size="small" fullWidth placeholder="e.g. 101-120" helperText="Numeric range, up to 100 rooms" />
          )}

          {/* Preview */}
          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 1 }}>
              Preview ({preview.length} rooms)
            </Typography>
            {preview.length === 0 ? (
              <Alert severity="warning" sx={{ py: 0.5 }}>Invalid range or count.</Alert>
            ) : (
              <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                {preview.slice(0, 30).map((r) => (
                  <Chip key={r} label={r} size="small" variant="outlined" sx={{ height: 22, fontSize: 11 }} />
                ))}
                {preview.length > 30 && (
                  <Chip label={`+${preview.length - 30} more`} size="small" sx={{ height: 22, fontSize: 11 }} />
                )}
              </Stack>
            )}
          </Box>

          {preview.length >= 100 && (
            <Alert severity="info" sx={{ py: 0.5 }}>Showing first 100 — full batch will be created.</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={saving || preview.length === 0}
          onClick={handleSave}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          Create {preview.length} rooms
        </Button>
      </DialogActions>
    </Dialog>
  );
}
