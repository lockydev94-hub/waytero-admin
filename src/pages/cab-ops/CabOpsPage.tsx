// ============================================================
// WAYTERO ADMIN — CAB OPERATIONS PAGE
// Doc Ref:
//   BRD Part 3 §40 — Auto Assignment Engine
//   BRD Part 3 §44 — Live Trip Tracking
//   BRD Part 7 §155 — Realtime + push channel
//
// Route: /cab-ops  (registered in AppRoutes + NAV_ITEMS)
// Roles: SUPER_ADMIN, ADMIN, CCO
//
// Three tabs:
//   1. Queue     — PENDING_PARTNER_ACCEPTANCE (partner has the booking, ticking clock)
//   2. In-Trip   — DRIVER_ASSIGNED + STARTED  (the road)
//   3. SOS       — booking_timeline entries flagged SOS_RAISED / ESCALATION / BREAKDOWN
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Tabs, Tab, Card, CardContent, Stack, Typography, Chip, Button, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Skeleton, Alert, IconButton, Avatar, alpha, useTheme, Grid, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Select, FormControl,
  InputLabel, TextField, RadioGroup, FormControlLabel, Radio,
} from "@mui/material";
import {
  DirectionsCar, Timer, Refresh, OpenInNew, WarningAmber, LocationOn,
  HourglassTop, CheckCircle, AssignmentReturn, FlashOn, Person, Route,
  SwapHoriz, Handshake, BuildCircle, ArrowForward,
} from "@mui/icons-material";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { cabOpsService, CabOpsQueueItem, CabOpsInTripItem, CabOpsSosAlert } from "../../services/cabOps.service";
import { breakdownService, ActiveBreakdownItem, AvailableVehicle, AvailablePartner, BreakdownReason } from "../../services/breakdown.service";
import { apiErrorMessage } from "../../utils/apiError";

const QUEUE_QUERY_KEY = "cab-ops-queue";
const IN_TRIP_QUERY_KEY = "cab-ops-in-trip";
const SOS_QUERY_KEY = "cab-ops-sos";

function fmtSeconds(secs: number | null | undefined): { label: string; color: "success" | "warning" | "error" | "default" } {
  if (secs == null) return { label: "—", color: "default" };
  if (secs <= 0) return { label: "Expired", color: "error" };
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m < 1) return { label: `${s}s`, color: "warning" };
  if (m < 3) return { label: `${m}m ${s}s`, color: "warning" };
  return { label: `${m}m ${s}s`, color: "success" };
}

function StatusChip({ status }: { status: string }) {
  const cfg: Record<string, { color: any; label: string }> = {
    PENDING_PARTNER_ACCEPTANCE: { color: "warning", label: "Pending Partner" },
    DRIVER_ASSIGNED: { color: "info", label: "Driver Assigned" },
    STARTED: { color: "primary", label: "Trip Started" },
  };
  const c = cfg[status] ?? { color: "default", label: status };
  return <Chip label={c.label} size="small" color={c.color} variant="outlined" sx={{ fontWeight: 600 }} />;
}

function SosFlagChip({ flag }: { flag: string }) {
  const cfg: Record<string, { color: any; label: string; icon: React.ReactNode }> = {
    SOS_RAISED: { color: "error", label: "SOS", icon: <WarningAmber sx={{ fontSize: 14 }} /> },
    ESCALATION_RAISED: { color: "warning", label: "Escalation", icon: <WarningAmber sx={{ fontSize: 14 }} /> },
    BREAKDOWN_REPORTED: { color: "error", label: "Breakdown", icon: <FlashOn sx={{ fontSize: 14 }} /> },
  };
  const c = cfg[flag] ?? { color: "default", label: flag, icon: <WarningAmber sx={{ fontSize: 14 }} /> };
  return <Chip label={c.label} size="small" color={c.color} icon={c.icon as any} sx={{ fontWeight: 700 }} />;
}

// ── Queue Tab ──────────────────────────────────────────────────
function QueueTab() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [QUEUE_QUERY_KEY],
    queryFn: () => cabOpsService.listQueue({ limit: 100 }),
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

  const reassign = useMutation({
    mutationFn: ({ id, remarks }: { id: number; remarks?: string }) =>
      cabOpsService.reassign(id, remarks),
    onSuccess: () => {
      enqueueSnackbar("Returned to PENDING_ASSIGNMENT", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: [QUEUE_QUERY_KEY] });
    },
    onError: (e) => enqueueSnackbar(apiErrorMessage(e, "Reassign failed"), { variant: "error" }),
  });

  const items: CabOpsQueueItem[] = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Timer sx={{ color: "warning.main" }} />
          <Typography variant="subtitle1" fontWeight={700}>
            {total} booking{total !== 1 ? "s" : ""} waiting on a partner
          </Typography>
        </Stack>
        <Tooltip title="Refresh">
          <IconButton onClick={() => refetch()}><Refresh /></IconButton>
        </Tooltip>
      </Stack>

      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load queue.</Alert>}

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.warning.main, 0.05) }}>
                <TableCell sx={{ fontWeight: 700 }}>Booking</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Customer</TableCell>
                <TableCell sx={{ fontWeight: 700, display: { xs: "none", md: "table-cell" } }}>City · Trip</TableCell>
                <TableCell sx={{ fontWeight: 700, display: { xs: "none", sm: "table-cell" } }}>Pending Partner</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Deadline</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(6)].map((__, j) => (
                      <TableCell key={j}><Skeleton animation="wave" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Stack alignItems="center" spacing={1}>
                      <CheckCircle sx={{ fontSize: 40, color: "success.main" }} />
                      <Typography variant="body2" color="text.secondary">No bookings waiting — every partner is on top of it.</Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : items.map((it) => {
                const dl = fmtSeconds(it.seconds_to_deadline);
                return (
                  <TableRow key={it.cab_booking_id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{it.booking_number}</Typography>
                      <Typography variant="caption" color="text.disabled">{it.trip_type ?? "—"}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{it.customer_name ?? "—"}</Typography>
                      <Typography variant="caption" color="text.secondary">{it.customer_mobile ?? ""}</Typography>
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                      <Typography variant="body2">{it.city_name ?? "—"}</Typography>
                      <Typography variant="caption" color="text.secondary">{it.vehicle_category_label ?? "—"}</Typography>
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                      <Typography variant="body2">{it.pending_partner_name ?? "—"}</Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ fontFamily: "monospace" }}>
                        {it.pending_partner_code ?? ""}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={dl.label} size="small" color={dl.color} sx={{ fontWeight: 700 }} />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Open booking">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/bookings/${it.master_booking_id}/cab/${it.cab_booking_id}`)}
                          >
                            <OpenInNew fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Force reassign now">
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              startIcon={<AssignmentReturn fontSize="small" />}
                              disabled={reassign.isPending}
                              onClick={() => reassign.mutate({ id: it.cab_booking_id, remarks: "Manual reassign from cab-ops" })}
                            >
                              Reassign
                            </Button>
                          </span>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}

// ── In-Trip Tab ────────────────────────────────────────────────
function InTripTab() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [IN_TRIP_QUERY_KEY],
    queryFn: () => cabOpsService.listInTrip({ limit: 100 }),
    staleTime: 15_000,
    refetchInterval: 20_000,
  });
  const items: CabOpsInTripItem[] = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <DirectionsCar sx={{ color: "info.main" }} />
          <Typography variant="subtitle1" fontWeight={700}>
            {total} trip{total !== 1 ? "s" : ""} on the road
          </Typography>
        </Stack>
        <Tooltip title="Refresh">
          <IconButton onClick={() => refetch()}><Refresh /></IconButton>
        </Tooltip>
      </Stack>

      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load in-trip feed.</Alert>}

      <Grid container spacing={2}>
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <Grid item xs={12} md={6} key={i}>
              <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 2 }} />
            </Grid>
          ))
        ) : items.length === 0 ? (
          <Grid item xs={12}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Stack alignItems="center" spacing={1} sx={{ py: 4 }}>
                  <Route sx={{ fontSize: 40, color: "text.disabled" }} />
                  <Typography variant="body2" color="text.secondary">No active trips right now.</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ) : items.map((t) => (
          <Grid item xs={12} md={6} key={t.cab_booking_id}>
            <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ bgcolor: "info.main", width: 36, height: 36 }}>
                      <DirectionsCar fontSize="small" />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={700}>{t.booking_number}</Typography>
                      <Typography variant="caption" color="text.secondary">{t.city_name ?? "—"}</Typography>
                    </Box>
                  </Stack>
                  <StatusChip status={t.cab_status} />
                </Stack>

                <Divider sx={{ mb: 1.5 }} />

                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <LocationOn sx={{ fontSize: 14, color: "success.main", mt: 0.25 }} />
                    <Typography variant="caption" sx={{ flex: 1 }}>{t.pickup_location ?? "—"}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <LocationOn sx={{ fontSize: 14, color: "error.main", mt: 0.25 }} />
                    <Typography variant="caption" sx={{ flex: 1 }}>{t.drop_location ?? "—"}</Typography>
                  </Stack>
                </Stack>

                <Divider sx={{ my: 1.5 }} />

                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block">Driver</Typography>
                    <Typography variant="body2" fontWeight={600}>{t.driver_name ?? "—"}</Typography>
                    <Typography variant="caption" color="text.disabled">{t.vehicle_number ?? ""}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block">Partner</Typography>
                    <Typography variant="body2" fontWeight={600} noWrap>{t.partner_name ?? "—"}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block">Customer</Typography>
                    <Typography variant="body2" noWrap>{t.customer_name ?? "—"}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block">Payment</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {t.payment_mode ?? "—"}
                      {t.final_amount != null ? ` · ₹${t.final_amount.toLocaleString("en-IN")}` : ""}
                    </Typography>
                  </Grid>
                </Grid>

                <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
                  <Button
                    size="small"
                    endIcon={<OpenInNew fontSize="small" />}
                    onClick={() => navigate(`/bookings/${t.master_booking_id}/cab/${t.cab_booking_id}`)}
                  >
                    Open
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

// ── SOS Tab ────────────────────────────────────────────────────
function SosTab() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [SOS_QUERY_KEY],
    queryFn: () => cabOpsService.listSosAlerts(50),
    staleTime: 15_000,
    refetchInterval: 20_000,
  });
  const items: CabOpsSosAlert[] = data?.items ?? [];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <WarningAmber sx={{ color: "error.main" }} />
          <Typography variant="subtitle1" fontWeight={700}>
            {items.length} open alert{items.length !== 1 ? "s" : ""}
          </Typography>
        </Stack>
        <Tooltip title="Refresh">
          <IconButton onClick={() => refetch()}><Refresh /></IconButton>
        </Tooltip>
      </Stack>

      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load alerts.</Alert>}

      <Stack spacing={1.5}>
        {isLoading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} variant="rectangular" height={80} sx={{ borderRadius: 2 }} />)
        ) : items.length === 0 ? (
          <Alert severity="success" icon={<CheckCircle />}>No open SOS or escalation alerts.</Alert>
        ) : items.map((a) => (
          <Card key={`${a.cab_booking_id}-${a.flag}-${a.raised_at}`} variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1.5}>
                <Stack spacing={0.5} sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <SosFlagChip flag={a.flag} />
                    <Typography variant="body2" fontWeight={700}>{a.booking_number}</Typography>
                    <Chip label={a.cab_status} size="small" variant="outlined" />
                    <Typography variant="caption" color="text.secondary">
                      {new Date(a.raised_at).toLocaleString()}
                    </Typography>
                  </Stack>
                  {a.note && <Typography variant="body2" color="text.secondary">"{a.note}"</Typography>}
                  <Stack direction="row" spacing={2} flexWrap="wrap">
                    <Typography variant="caption" color="text.secondary">
                      <Person sx={{ fontSize: 12, mr: 0.5 }} />{a.customer_name ?? "—"} · {a.customer_mobile ?? ""}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Driver: {a.driver_name ?? "—"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Partner: {a.partner_name ?? "—"}
                    </Typography>
                  </Stack>
                </Stack>
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  endIcon={<OpenInNew fontSize="small" />}
                  onClick={() => navigate(`/bookings/${a.master_booking_id}/cab/${a.cab_booking_id}`)}
                >
                  Resolve
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}

// ── Breakdowns Tab ─────────────────────────────────────────────
const BREAKDOWN_QUERY_KEY = "cab-ops-breakdowns";

function BreakdownStatusChip({ status }: { status: string }) {
  const cfg: Record<string, { color: any; label: string }> = {
    BREAKDOWN_REPORTED: { color: "error", label: "Reported" },
    AWAITING_SWAP: { color: "warning", label: "Awaiting swap" },
  };
  const c = cfg[status] ?? { color: "default", label: status };
  return <Chip label={c.label} size="small" color={c.color} variant="outlined" sx={{ fontWeight: 700 }} />;
}

function ReasonChip({ code }: { code: string | null }) {
  if (!code) return <Chip label="—" size="small" variant="outlined" />;
  const cfg: Record<string, { color: any; label: string }> = {
    VEHICLE_BREAKDOWN: { color: "error", label: "Vehicle breakdown" },
    ACCIDENT: { color: "error", label: "Accident" },
    DRIVER_UNWELL: { color: "warning", label: "Driver unwell" },
    OTHER: { color: "default", label: "Other" },
  };
  const c = cfg[code] ?? { color: "default", label: code };
  return <Chip label={c.label} size="small" color={c.color} variant="outlined" />;
}

function ReportBreakdownDialog({
  open,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { reason_code: string; notes: string }) => void;
  isPending: boolean;
}) {
  const { data } = useQuery({
    queryKey: ["breakdown-reasons"],
    queryFn: () => breakdownService.listReasons(),
    enabled: open,
    staleTime: 600_000,
  });
  const reasons: BreakdownReason[] = data?.items ?? [];
  const [reason, setReason] = useState("VEHICLE_BREAKDOWN");
  const [notes, setNotes] = useState("");

  function reset() {
    setReason("VEHICLE_BREAKDOWN");
    setNotes("");
  }

  return (
    <Dialog open={open} onClose={() => { reset(); onClose(); }} maxWidth="xs" fullWidth>
      <DialogTitle>Report Breakdown</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="reason-lbl">Reason</InputLabel>
            <Select
              labelId="reason-lbl"
              label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {reasons.map((r) => (
                <MenuItem key={r.code} value={r.code}>{r.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Notes (optional)"
            multiline
            minRows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. engine overheating near Durgapur"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { reset(); onClose(); }} disabled={isPending}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => onSubmit({ reason_code: reason, notes })}
          disabled={isPending}
        >
          Report Breakdown
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SwapSamePartnerDialog({
  open,
  onClose,
  item,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  item: ActiveBreakdownItem | null;
  onSubmit: (payload: { new_vehicle_id: number; new_driver_id: number }) => void;
  isPending: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["available-vehicles", item?.cab_booking_id],
    queryFn: () => breakdownService.listAvailableVehicles(item!.cab_booking_id),
    enabled: open && !!item,
    staleTime: 30_000,
  });
  const [selected, setSelected] = useState<string>("");

  // Reset on item change
  useState(() => setSelected(""));

  const list: AvailableVehicle[] = data?.same_partner ?? [];
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <SwapHoriz color="primary" />
          <span>Swap to another {item?.original_partner_name} vehicle</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Same-partner swap. Commission / payout unchanged — the booking
          stays with the current partner.
        </Typography>
        {isLoading ? (
          <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
        ) : list.length === 0 ? (
          <Alert severity="warning">No free vehicles in this partner's fleet.</Alert>
        ) : (
          <FormControl component="fieldset">
            <RadioGroup
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {list.map((v) => (
                <FormControlLabel
                  key={v.vehicle_id}
                  value={String(v.vehicle_id)}
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {v.registration_number}
                        {v.vehicle_category_name ? ` · ${v.vehicle_category_name}` : ""}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Driver: {v.driver_name ?? "—"} · {v.driver_mobile ?? ""}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </RadioGroup>
          </FormControl>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => {
            const v = list.find((x) => String(x.vehicle_id) === selected);
            if (v) onSubmit({ new_vehicle_id: v.vehicle_id, new_driver_id: v.driver_id ?? 0 });
          }}
          disabled={isPending || !selected || !list.find((x) => String(x.vehicle_id) === selected)?.driver_id}
        >
          Swap
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function HandoverDialog({
  open,
  onClose,
  item,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  item: ActiveBreakdownItem | null;
  onSubmit: (payload: { new_partner_id: number; acceptance_deadline_minutes: number }) => void;
  isPending: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["available-partners", item?.cab_booking_id],
    queryFn: () => breakdownService.listAvailablePartners(item!.cab_booking_id),
    enabled: open && !!item,
    staleTime: 30_000,
  });
  const [selected, setSelected] = useState<string>("");
  const [deadline, setDeadline] = useState<number>(15);

  const list: AvailablePartner[] = data?.items ?? [];
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <Handshake color="warning" />
          <span>Hand over to another partner</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Original partner ({item?.original_partner_name}) will receive
          <strong> zero payout</strong>. Their cash + advances stay with
          them for offline reconciliation.
        </Alert>
        {isLoading ? (
          <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
        ) : list.length === 0 ? (
          <Alert severity="warning">No other active partners in this city with free vehicles.</Alert>
        ) : (
          <Stack spacing={2}>
            <FormControl component="fieldset">
              <RadioGroup
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {list.map((p) => (
                  <FormControlLabel
                    key={p.partner_id}
                    value={String(p.partner_id)}
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {p.business_name}
                          <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 1, fontFamily: "monospace" }}>
                            {p.partner_code}
                          </Typography>
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {p.free_vehicle_count} free vehicle{p.free_vehicle_count !== 1 ? "s" : ""} · {p.city_name ?? ""} · {p.mobile ?? ""}
                        </Typography>
                      </Box>
                    }
                  />
                ))}
              </RadioGroup>
            </FormControl>
            <TextField
              type="number"
              label="Acceptance deadline (minutes)"
              size="small"
              value={deadline}
              onChange={(e) => setDeadline(Math.max(1, Math.min(240, parseInt(e.target.value, 10) || 15)))}
              inputProps={{ min: 1, max: 240 }}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>Cancel</Button>
        <Button
          variant="contained"
          color="warning"
          startIcon={<ArrowForward />}
          onClick={() => {
            if (selected) onSubmit({ new_partner_id: parseInt(selected, 10), acceptance_deadline_minutes: deadline });
          }}
          disabled={isPending || !selected}
        >
          Handover
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function BreakdownTab() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [reportOpen, setReportOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<ActiveBreakdownItem | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [BREAKDOWN_QUERY_KEY],
    queryFn: () => breakdownService.listActive({ limit: 100 }),
    staleTime: 15_000,
    refetchInterval: 20_000,
  });
  const items: ActiveBreakdownItem[] = data?.items ?? [];
  const total = data?.total ?? 0;

  const reportMutation = useMutation({
    mutationFn: ({ cabId, payload }: { cabId: number; payload: { reason_code: string; notes: string } }) =>
      breakdownService.report(cabId, { reason_code: payload.reason_code, notes: payload.notes }),
    onSuccess: () => {
      enqueueSnackbar("Breakdown reported", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: [BREAKDOWN_QUERY_KEY] });
      setReportOpen(false);
    },
    onError: (e) => enqueueSnackbar(apiErrorMessage(e, "Report failed"), { variant: "error" }),
  });

  const swapMutation = useMutation({
    mutationFn: ({ cabId, payload }: { cabId: number; payload: { new_vehicle_id: number; new_driver_id: number } }) =>
      breakdownService.swapSamePartner(cabId, payload),
    onSuccess: () => {
      enqueueSnackbar("Vehicle swapped within partner", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: [BREAKDOWN_QUERY_KEY] });
      setSwapOpen(false);
    },
    onError: (e) => enqueueSnackbar(apiErrorMessage(e, "Swap failed"), { variant: "error" }),
  });

  const handoverMutation = useMutation({
    mutationFn: ({ cabId, payload }: { cabId: number; payload: { new_partner_id: number; acceptance_deadline_minutes: number } }) =>
      breakdownService.handover(cabId, payload),
    onSuccess: () => {
      enqueueSnackbar("Handover initiated — new partner has been notified", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: [BREAKDOWN_QUERY_KEY] });
      setHandoverOpen(false);
    },
    onError: (e) => enqueueSnackbar(apiErrorMessage(e, "Handover failed"), { variant: "error" }),
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <BuildCircle sx={{ color: "error.main" }} />
          <Typography variant="subtitle1" fontWeight={700}>
            {total} active breakdown{total !== 1 ? "s" : ""}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={() => refetch()}><Refresh /></IconButton>
          </Tooltip>
          <Button
            variant="contained"
            color="error"
            startIcon={<WarningAmber />}
            onClick={() => setReportOpen(true)}
          >
            Manual Report
          </Button>
        </Stack>
      </Stack>

      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load breakdown feed.</Alert>}

      <Grid container spacing={2}>
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <Grid item xs={12} md={6} key={i}>
              <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 2 }} />
            </Grid>
          ))
        ) : items.length === 0 ? (
          <Grid item xs={12}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent>
                <Stack alignItems="center" spacing={1} sx={{ py: 4 }}>
                  <CheckCircle sx={{ fontSize: 40, color: "success.main" }} />
                  <Typography variant="body2" color="text.secondary">
                    No active breakdowns — every vehicle is on the road without issues.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ) : items.map((it) => (
          <Grid item xs={12} md={6} key={it.cab_booking_id}>
            <Card variant="outlined" sx={{ borderRadius: 2, height: "100%", borderColor: "error.light" }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ bgcolor: "error.main", width: 36, height: 36 }}>
                      <BuildCircle fontSize="small" />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={700}>{it.booking_number}</Typography>
                      <Typography variant="caption" color="text.secondary">{it.city_name ?? "—"}</Typography>
                    </Box>
                  </Stack>
                  <BreakdownStatusChip status={it.cab_status} />
                </Stack>

                <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap" gap={1}>
                  <ReasonChip code={it.breakdown_reason} />
                  <Chip
                    label={`By ${it.breakdown_reported_by ?? "—"}`}
                    size="small"
                    variant="outlined"
                  />
                  {it.swap_count > 0 && (
                    <Chip label={`${it.swap_count} swap${it.swap_count !== 1 ? "s" : ""}`} size="small" color="warning" variant="outlined" />
                  )}
                </Stack>

                <Divider sx={{ mb: 1.5 }} />

                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block">Customer</Typography>
                    <Typography variant="body2" noWrap>{it.customer_name ?? "—"}</Typography>
                    <Typography variant="caption" color="text.disabled">{it.customer_mobile ?? ""}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block">Original partner</Typography>
                    <Typography variant="body2" fontWeight={600} noWrap>{it.original_partner_name ?? "—"}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block">Active partner</Typography>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {it.active_partner_name ?? "—"}
                      {it.active_partner_id && it.active_partner_id !== it.original_partner_id && (
                        <Typography component="span" variant="caption" color="warning.main" sx={{ ml: 0.5 }}>
                          (handovered)
                        </Typography>
                      )}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" display="block">Active vehicle / driver</Typography>
                    <Typography variant="body2" noWrap>
                      {it.active_vehicle_number ?? "—"} · {it.active_driver_name ?? "—"}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary" display="block">Km covered when breakdown reported</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {it.pre_swap_actual_km != null ? `${it.pre_swap_actual_km.toFixed(1)} km` : "—"}
                      {it.breakdown_reported_at && (
                        <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                          · {new Date(it.breakdown_reported_at).toLocaleString()}
                        </Typography>
                      )}
                    </Typography>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 1.5 }} />

                <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                  <Button
                    size="small"
                    startIcon={<OpenInNew />}
                    onClick={() => navigate(`/bookings/${it.master_booking_id}/cab/${it.cab_booking_id}`)}
                  >
                    Open
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    startIcon={<SwapHoriz />}
                    onClick={() => { setActiveItem(it); setSwapOpen(true); }}
                  >
                    Same-partner swap
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="warning"
                    startIcon={<Handshake />}
                    onClick={() => { setActiveItem(it); setHandoverOpen(true); }}
                  >
                    Handover
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <ReportBreakdownDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        isPending={reportMutation.isPending}
        onSubmit={(p) => {
          // Manual report is for an arbitrary cab — pick from the topmost
          // item or open a picker. For now we require an item context.
          if (activeItem) {
            reportMutation.mutate({ cabId: activeItem.cab_booking_id, payload: p });
          } else {
            enqueueSnackbar("Pick a booking from the list first", { variant: "warning" });
          }
        }}
      />

      <SwapSamePartnerDialog
        open={swapOpen}
        onClose={() => setSwapOpen(false)}
        item={activeItem}
        isPending={swapMutation.isPending}
        onSubmit={(p) => activeItem && swapMutation.mutate({ cabId: activeItem.cab_booking_id, payload: p })}
      />

      <HandoverDialog
        open={handoverOpen}
        onClose={() => setHandoverOpen(false)}
        item={activeItem}
        isPending={handoverMutation.isPending}
        onSubmit={(p) => activeItem && handoverMutation.mutate({ cabId: activeItem.cab_booking_id, payload: p })}
      />
    </Box>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function CabOpsPage() {
  const [tab, setTab] = useState(0);
  const { data: sos } = useQuery({
    queryKey: [SOS_QUERY_KEY],
    queryFn: () => cabOpsService.listSosAlerts(50),
    staleTime: 30_000,
  });
  const sosCount = sos?.total ?? 0;

  const { data: active } = useQuery({
    queryKey: [BREAKDOWN_QUERY_KEY],
    queryFn: () => breakdownService.listActive({ limit: 100 }),
    staleTime: 15_000,
    refetchInterval: 20_000,
  });
  const breakdownCount = active?.total ?? 0;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={800}>Cab Operations</Typography>
        <Typography variant="body2" color="text.secondary">
          Live console for the auto-assignment queue, in-trip feed, breakdowns and SOS alerts.
        </Typography>
      </Box>

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ borderBottom: 1, borderColor: "divider", px: 1 }}
        >
          <Tab icon={<HourglassTop fontSize="small" />} iconPosition="start" label="Assignment Queue" />
          <Tab icon={<DirectionsCar fontSize="small" />} iconPosition="start" label="In-Trip" />
          <Tab
            icon={<BuildCircle fontSize="small" />}
            iconPosition="start"
            label={breakdownCount > 0 ? `Breakdowns · ${breakdownCount}` : "Breakdowns"}
          />
          <Tab
            icon={<WarningAmber fontSize="small" />}
            iconPosition="start"
            label={sosCount > 0 ? `SOS & Alerts · ${sosCount}` : "SOS & Alerts"}
          />
        </Tabs>
        <CardContent>
          {tab === 0 && <QueueTab />}
          {tab === 1 && <InTripTab />}
          {tab === 2 && <BreakdownTab />}
          {tab === 3 && <SosTab />}
        </CardContent>
      </Card>
    </Box>
  );
}
