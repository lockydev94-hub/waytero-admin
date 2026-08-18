// ============================================================
// WAYTERO ADMIN — INVENTORY CALENDAR DIALOG
// Doc Ref: 03_FRONTEND_DESIGN.md §6 "InventoryCalendarDialog"
// Month grid per category: available/total, rate override, stop-sell.
// Click-drag → date range → bulk edit panel.
// Booked counts are read-only.
// ============================================================

import { useState, useCallback } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, Typography, Box, CircularProgress,
  IconButton, Paper, Chip, TextField, Alert,
  Divider, alpha, useTheme, Tooltip, Switch,
  FormControlLabel, InputAdornment, Select, MenuItem, FormControl, InputLabel,
} from "@mui/material";
import {
  ChevronLeft, ChevronRight, Close, Save, Clear, EventAvailable,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import hotelService, { RoomCategory, InventoryDay } from "../../../services/hotel.service";
import { HOTEL_QUERY_KEYS, toIsoDate, inr, DAYS_OF_WEEK } from "../constants";
import { apiErrorMessage } from "../../../utils/apiError";

interface Props {
  open: boolean;
  hotelId: number;
  categories: RoomCategory[];
  onClose: () => void;
}

type CellState = { total: number | null; blocked: number | null; rateOverride: number | null; isStopSell: boolean | null };
const emptyCellState = (): CellState => ({ total: null, blocked: null, rateOverride: null, isStopSell: null });

export default function InventoryCalendarDialog({ open, hotelId, categories, onClose }: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [catId, setCatId] = useState<number>(categories[0]?.id ?? 0);
  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [bulkEdit, setBulkEdit] = useState<CellState>(emptyCellState());
  const [filterDays, setFilterDays] = useState<string[]>([]);
  const [showBulk, setShowBulk] = useState(false);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const dateFrom = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const dateTo = toIsoDate(new Date(year, month + 1, 0));

  const { data: inventory = [], isLoading, refetch } = useQuery<InventoryDay[]>({
    queryKey: [HOTEL_QUERY_KEYS.inventory, hotelId, catId, dateFrom, dateTo],
    queryFn: () => hotelService.getInventory(hotelId, dateFrom, dateTo, catId),
    enabled: open && catId > 0,
    staleTime: 30_000,
  });

  const invMap: Record<string, InventoryDay> = {};
  inventory.forEach(i => { invMap[i.inventory_date] = i; });

  // Whether the visible month has *any* inventory rows. When empty, the calendar
  // shows only "—" cells and bulk edit fails with "No inventory exists for that
  // range" — the admin must generate inventory first.
  const monthHasInventory = inventory.length > 0;

  const selectedCategory = categories.find(c => c.id === catId);

  const { mutate: bulkUpdate, isPending: bulkSaving } = useMutation({
    mutationFn: (payload: Record<string, unknown>) => hotelService.bulkUpdateInventory(hotelId, payload as any),
    onSuccess: () => {
      enqueueSnackbar("Inventory updated", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.inventory, hotelId, catId] });
      queryClient.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.readiness, hotelId] });
      refetch();
      setShowBulk(false);
      setBulkEdit(emptyCellState());
      setSelStart(null);
      setSelEnd(null);
    },
    onError: (e: any) => enqueueSnackbar(apiErrorMessage(e, "Update failed"), { variant: "error" }),
  });

  const { mutate: generateInventory, isPending: generating } = useMutation({
    mutationFn: (payload: { room_category_id: number; date_from: string; date_to: string }) =>
      hotelService.generateInventory(hotelId, payload),
    onSuccess: (data: any) => {
      enqueueSnackbar(
        `Generated ${data.data.created} inventory row(s) for ${data.data.categories} category/categories`,
        { variant: "success" }
      );
      queryClient.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.inventory, hotelId, catId] });
      queryClient.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.readiness, hotelId] });
      refetch();
    },
    onError: (e: any) => enqueueSnackbar(apiErrorMessage(e, "Generate failed"), { variant: "error" }),
  });

  // Calendar helpers
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const dateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const isSelected = (d: string): boolean => {
    if (!selStart) return false;
    const s = selStart < (selEnd ?? selStart) ? selStart : (selEnd ?? selStart);
    const e = selStart < (selEnd ?? selStart) ? (selEnd ?? selStart) : selStart;
    return d >= s && d <= e;
  };

  const handleCellClick = (d: string) => {
    if (!selStart || (selStart && selEnd)) {
      setSelStart(d); setSelEnd(null); setShowBulk(false);
    } else {
      const end = d;
      setSelEnd(end);
      setShowBulk(true);
    }
  };

  const selDateFrom = selStart && selEnd
    ? (selStart < selEnd ? selStart : selEnd)
    : selStart;
  const selDateTo = selStart && selEnd
    ? (selStart < selEnd ? selEnd : selStart)
    : selStart;

  // Does the selected range have at least one existing inventory row? If not,
  // bulk edit will fail — the admin needs to generate for the selection first.
  const selectionHasInventory =
    !!selDateFrom &&
    !!selDateTo &&
    inventory.some(i => i.inventory_date >= selDateFrom && i.inventory_date <= selDateTo);

  // Generate inventory rows for the whole visible month for the selected
  // category. Safe to re-run — the backend skips dates that already exist.
  const handleGenerateMonth = () => {
    if (catId <= 0) return;
    generateInventory({ room_category_id: catId, date_from: dateFrom, date_to: dateTo });
  };

  // Generate inventory only for the currently selected date range.
  const handleGenerateSelection = () => {
    if (catId <= 0 || !selDateFrom || !selDateTo) return;
    generateInventory({ room_category_id: catId, date_from: selDateFrom, date_to: selDateTo });
  };

  const handleBulkSave = () => {
    if (!selDateFrom || !selDateTo) return;
    // Backend expects days_of_week as int[] where 0=Mon, 1=Tue... 6=Sun.
    // The UI collects ["MON", "TUE", ...], so map them to integers.
    const dayMap: Record<string, number> = {
      MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6,
    };
    const daysOfWeekInt = filterDays.length > 0
      ? filterDays.map(d => dayMap[d]).filter(n => n !== undefined)
      : null;

    bulkUpdate({
      room_category_id: catId,
      date_from: selDateFrom,
      date_to: selDateTo,
      days_of_week: daysOfWeekInt,
      total_rooms: bulkEdit.total,
      blocked_rooms: bulkEdit.blocked,
      rate_override: bulkEdit.rateOverride,
      is_stop_sell: bulkEdit.isStopSell,
    });
  };

  const availColor = (avail: number, total: number) => {
    if (total === 0) return theme.palette.text.disabled;
    const pct = avail / total;
    if (pct <= 0) return theme.palette.error.main;
    if (pct <= 0.25) return theme.palette.warning.main;
    return theme.palette.success.main;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, height: "90vh" } }}
    >
      <DialogTitle sx={{
        background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
        color: "primary.contrastText",
        fontWeight: 800,
        pb: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span>Inventory Calendar</span>
        <IconButton onClick={onClose} sx={{ color: "rgba(255,255,255,0.7)" }}><Close /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2, overflow: "auto" }}>
        <Stack spacing={2}>
          {/* Controls */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="flex-start">
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Room Category</InputLabel>
              <Select value={catId} onChange={e => setCatId(Number(e.target.value))} label="Room Category">
                {categories.map(c => (
                  <MenuItem key={c.id} value={c.id}>{c.category_name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack direction="row" alignItems="center" spacing={0.5}>
              <IconButton size="small" onClick={() => setViewDate(new Date(year, month - 1, 1))}>
                <ChevronLeft />
              </IconButton>
              <Typography variant="subtitle2" fontWeight={700}>
                {viewDate.toLocaleString("en-IN", { month: "long", year: "numeric" })}
              </Typography>
              <IconButton size="small" onClick={() => setViewDate(new Date(year, month + 1, 1))}>
                <ChevronRight />
              </IconButton>
            </Stack>

            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
              Click a date, then click another to select a range → bulk edit
            </Typography>

            <Box sx={{ flexGrow: 1 }} />

            <Tooltip title="Creates one inventory row per day for this month so the rooms become sellable. Safe to re-run — existing dates are skipped.">
              <span>
                <Button
                  variant={monthHasInventory ? "outlined" : "contained"}
                  size="small"
                  startIcon={generating ? <CircularProgress size={14} /> : <EventAvailable />}
                  disabled={generating || catId <= 0}
                  onClick={handleGenerateMonth}
                >
                  Generate for this month
                </Button>
              </span>
            </Tooltip>
          </Stack>

          {/* First-run hint: no inventory means nothing is sellable and bulk edit
              will fail. Tell the admin exactly what to do. */}
          {!isLoading && !monthHasInventory && (
            <Alert severity="warning" icon={<EventAvailable fontSize="inherit" />}>
              No inventory exists for{" "}
              <strong>{selectedCategory?.category_name ?? "this category"}</strong> in{" "}
              {viewDate.toLocaleString("en-IN", { month: "long", year: "numeric" })}.
              Click <strong>Generate for this month</strong> above to create sellable days
              (seeded from the category's room count of{" "}
              <strong>{selectedCategory?.total_rooms ?? 0}</strong>). This is what the
              "Inventory generated for every room category" readiness check needs.
              After generating, click two dates to bulk-edit rooms, blocks, rate or stop-sell.
            </Alert>
          )}

          {isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box>
              {/* Day headers */}
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", mb: 0.5 }}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                  <Typography key={d} variant="caption" fontWeight={700} color="text.secondary"
                    sx={{ textAlign: "center", fontSize: 10, pb: 0.5 }}>
                    {d}
                  </Typography>
                ))}
              </Box>

              {/* Grid */}
              {weeks.map((week, wi) => (
                <Box key={wi} sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5, mb: 0.5 }}>
                  {week.map((day, di) => {
                    if (!day) return <Box key={di} sx={{ minHeight: 68 }} />;
                    const ds = dateStr(day);
                    const inv = invMap[ds];
                    const avail = inv ? inv.available_rooms : null;
                    const total = inv ? inv.total_rooms : null;
                    const booked = inv ? inv.booked_rooms : 0;
                    const stopSell = inv?.is_stop_sell;
                    const hasOverride = inv?.rate_override != null;
                    const selected = isSelected(ds);
                    const isToday = ds === toIsoDate(new Date());

                    return (
                      <Paper
                        key={di}
                        elevation={0}
                        onClick={() => handleCellClick(ds)}
                        sx={{
                          minHeight: 68, borderRadius: 1.5, p: 0.75, cursor: "pointer",
                          border: `1.5px solid ${selected ? theme.palette.primary.main : isToday ? theme.palette.secondary.main : theme.palette.divider}`,
                          bgcolor: selected
                            ? alpha(theme.palette.primary.main, 0.08)
                            : stopSell
                            ? alpha(theme.palette.error.main, 0.05)
                            : "background.paper",
                          transition: "all 0.12s",
                          "&:hover": { borderColor: theme.palette.primary.light, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" },
                          display: "flex", flexDirection: "column", gap: 0.25,
                        }}
                      >
                        <Typography variant="caption" fontWeight={isToday ? 800 : 500}
                          color={isToday ? "primary.main" : "text.secondary"} sx={{ fontSize: 10 }}>
                          {day}
                        </Typography>
                        {inv ? (
                          <>
                            <Typography variant="caption" fontWeight={800}
                              sx={{ fontSize: 11, color: stopSell ? "error.main" : availColor(avail ?? 0, total ?? 1) }}>
                              {stopSell ? "STOP" : `${avail ?? "?"}/${total ?? "?"}`}
                            </Typography>
                            <Typography variant="caption" color="text.disabled" sx={{ fontSize: 9 }}>
                              {booked > 0 ? `${booked} bkd` : ""}
                            </Typography>
                            {hasOverride && (
                              <Chip label={inr(inv.rate_override)} size="small"
                                sx={{ height: 14, fontSize: 9, bgcolor: alpha(theme.palette.warning.main, 0.1), color: "warning.dark" }} />
                            )}
                          </>
                        ) : (
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>—</Typography>
                        )}
                      </Paper>
                    );
                  })}
                </Box>
              ))}

              {/* Legend */}
              <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                {[
                  { color: theme.palette.success.main, label: "Available" },
                  { color: theme.palette.warning.main, label: "Low" },
                  { color: theme.palette.error.main, label: "Full / Stop-sell" },
                  { color: theme.palette.warning.dark, label: "Rate override" },
                ].map(({ color, label }) => (
                  <Stack key={label} direction="row" alignItems="center" spacing={0.5}>
                    <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: color }} />
                    <Typography variant="caption" sx={{ fontSize: 10 }}>{label}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}

          {/* Bulk edit panel */}
          {showBulk && selDateFrom && selDateTo && (
            <>
              <Divider />
              <Box sx={{ bgcolor: alpha(theme.palette.primary.main, 0.03), borderRadius: 2, p: 2 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
                  Bulk edit — {selDateFrom} to {selDateTo}
                </Typography>

                {!selectionHasInventory && (
                  <Alert
                    severity="info"
                    icon={<EventAvailable fontSize="inherit" />}
                    sx={{ mb: 2 }}
                    action={
                      <Button
                        color="inherit"
                        size="small"
                        startIcon={generating ? <CircularProgress size={14} /> : <EventAvailable />}
                        disabled={generating}
                        onClick={handleGenerateSelection}
                      >
                        Generate for this range
                      </Button>
                    }
                  >
                    This range has no inventory yet. Generate it first — then you can bulk-edit
                    rooms, blocks, rate or stop-sell below.
                  </Alert>
                )}

                <Stack spacing={2}>
                  {/* Day of week filter */}
                  <Box>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                      Apply only on (leave blank for all days)
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                      {DAYS_OF_WEEK.map(d => (
                        <Chip
                          key={d.value}
                          label={d.label}
                          size="small"
                          variant={filterDays.includes(d.value) ? "filled" : "outlined"}
                          color={filterDays.includes(d.value) ? "primary" : "default"}
                          clickable
                          onClick={() => setFilterDays(prev =>
                            prev.includes(d.value) ? prev.filter(x => x !== d.value) : [...prev, d.value]
                          )}
                          sx={{ height: 24, fontSize: 11 }}
                        />
                      ))}
                    </Stack>
                  </Box>

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      label="Total rooms"
                      type="number"
                      size="small"
                      value={bulkEdit.total ?? ""}
                      onChange={e => setBulkEdit(p => ({ ...p, total: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="Leave blank to keep"
                      inputProps={{ min: 0 }}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Blocked rooms"
                      type="number"
                      size="small"
                      value={bulkEdit.blocked ?? ""}
                      onChange={e => setBulkEdit(p => ({ ...p, blocked: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="Leave blank to keep"
                      inputProps={{ min: 0 }}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Rate override (₹)"
                      type="number"
                      size="small"
                      value={bulkEdit.rateOverride ?? ""}
                      onChange={e => setBulkEdit(p => ({ ...p, rateOverride: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="Leave blank to keep"
                      InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                      sx={{ flex: 1 }}
                    />
                  </Stack>

                  <Stack direction="row" alignItems="center" spacing={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={bulkEdit.isStopSell ?? false}
                          onChange={(_, checked) => setBulkEdit(p => ({ ...p, isStopSell: checked }))}
                        />
                      }
                      label={<Typography variant="body2">Stop sell</Typography>}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Booked rooms are always read-only — they derive from reservations.
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={1}>
                    <Tooltip
                      title={
                        selectionHasInventory
                          ? ""
                          : "Generate inventory for this range first — there is nothing to edit yet."
                      }
                    >
                      <span>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={bulkSaving ? <CircularProgress size={14} /> : <Save />}
                          disabled={bulkSaving || !selectionHasInventory}
                          onClick={handleBulkSave}
                        >
                          Apply changes
                        </Button>
                      </span>
                    </Tooltip>
                    <Button
                      size="small"
                      startIcon={<Clear />}
                      onClick={() => { setSelStart(null); setSelEnd(null); setShowBulk(false); setBulkEdit(emptyCellState()); }}
                    >
                      Clear selection
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
