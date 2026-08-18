// ============================================================
// WAYTERO ADMIN — CANCELLATION POLICY EDITOR
// Doc Ref: BRD Part 3 §46/§47 (cab), BRD Part 5 §119 (tour)
// Three surfaces:
//   1. Cab (global)   — admin-editable cab ladder.
//   2. Tour (global)  — admin-editable global tour ladder (fallback for
//                       packages without their own policy).
//   3. Tour packages  — per-package override ladder. Packages without a row
//                       fall back to the global tour ladder.
// Hotel ladders are per-hotel and edited via the partner portal.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import {
  Box, Card, CardContent, Stack, Typography, Button, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Avatar, Divider, Alert, Tooltip, Grid, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell, TablePagination,
  Chip, Tabs, Tab, InputAdornment,
} from "@mui/material";
import {
  Edit, History, Policy, Save, Refresh, Search, FlightTakeoff, DirectionsCar,
} from "@mui/icons-material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  cancellationService, CabLadder, CabLadderHistoryItem, TourPackagePolicy,
} from "../../services/cancellation.service";
import { tourService, TourPackage } from "../../services/tour.service";

// Display order + human label for each cab ladder key.
const CAB_KEY_META: Record<string, { label: string; hint: string; unit: string }> = {
  CANCELLATION_FREE_HOURS_CAB: {
    label: "Free-cancel window",
    hint: "Hours before pickup. ≥ this → 100% refund.",
    unit: "hours",
  },
  CANCELLATION_TIER_1_HOURS_CAB: {
    label: "Tier-1 cutoff",
    hint: "Hours before pickup. Between free and this → Tier 1 refund.",
    unit: "hours",
  },
  CANCELLATION_TIER_1_PERCENT_CAB: {
    label: "Tier-1 refund percent",
    hint: "Refund % at Tier 1.",
    unit: "%",
  },
  CANCELLATION_TIER_2_HOURS_CAB: {
    label: "Tier-2 cutoff",
    hint: "Hours before pickup. Between tier-1 and this → Tier 2 refund.",
    unit: "hours",
  },
  CANCELLATION_TIER_2_PERCENT_CAB: {
    label: "Tier-2 refund percent",
    hint: "Refund % at Tier 2.",
    unit: "%",
  },
  CANCELLATION_SAME_DAY_PERCENT_CAB: {
    label: "Same-day refund percent",
    hint: "Refund % inside the tier-2 window / after pickup.",
    unit: "%",
  },
  CANCELLATION_AFTER_ASSIGNMENT_PERCENT_CAB: {
    label: "Post-assignment refund percent",
    hint: "Override applied once a partner has been notified.",
    unit: "%",
  },
};

// Display order + human label for each global tour ladder key (BRD §119).
const TOUR_KEY_META: Record<string, { label: string; hint: string; unit: string }> = {
  TOUR_CANCELLATION_FREE_DAYS: {
    label: "Free-cancel window",
    hint: "Days before travel. ≥ this → 100% refund.",
    unit: "days",
  },
  TOUR_CANCELLATION_TIER_1_DAYS: {
    label: "Tier-1 cutoff",
    hint: "Days before travel. Between free and this → Tier 1 refund.",
    unit: "days",
  },
  TOUR_CANCELLATION_TIER_1_PERCENT: {
    label: "Tier-1 refund percent",
    hint: "Refund % at Tier 1.",
    unit: "%",
  },
  TOUR_CANCELLATION_TIER_2_DAYS: {
    label: "Tier-2 cutoff",
    hint: "Days before travel. Between tier-1 and this → Tier 2 refund.",
    unit: "days",
  },
  TOUR_CANCELLATION_TIER_2_PERCENT: {
    label: "Tier-2 refund percent",
    hint: "Refund % at Tier 2.",
    unit: "%",
  },
  TOUR_CANCELLATION_TIER_3_PERCENT: {
    label: "Tier-3 refund percent",
    hint: "Refund % inside the tier-2 window (last-minute before cutoff).",
    unit: "%",
  },
  TOUR_CANCELLATION_LAST_MINUTE_PERCENT: {
    label: "Last-minute refund percent",
    hint: "Refund % inside the final window before travel.",
    unit: "%",
  },
};

// Per-package policy form fields.
const PKG_FIELDS: Array<{ key: keyof TourPackagePolicy; label: string; hint: string; unit: string }> = [
  { key: "cancellation_free_days", label: "Free-cancel window", hint: "Days before travel → 100% refund", unit: "days" },
  { key: "cancellation_tier_1_days", label: "Tier-1 cutoff", hint: "Days before travel → Tier 1 refund", unit: "days" },
  { key: "refund_percent_tier_1", label: "Tier-1 refund percent", hint: "Refund % at Tier 1", unit: "%" },
  { key: "cancellation_tier_2_days", label: "Tier-2 cutoff", hint: "Days before travel → Tier 2 refund", unit: "days" },
  { key: "refund_percent_tier_2", label: "Tier-2 refund percent", hint: "Refund % at Tier 2", unit: "%" },
  { key: "refund_percent_tier_3", label: "Tier-3 refund percent", hint: "Refund % inside tier-2 window", unit: "%" },
  { key: "refund_percent_last_minute", label: "Last-minute refund percent", hint: "Refund % in the final window", unit: "%" },
];

const PKG_DEFAULTS: TourPackagePolicy = {
  id: null,
  tour_package_id: 0,
  cancellation_free_days: 30,
  cancellation_tier_1_days: 15,
  refund_percent_tier_1: 100,
  cancellation_tier_2_days: 7,
  refund_percent_tier_2: 75,
  refund_percent_tier_3: 50,
  refund_percent_last_minute: 0,
  cancellation_policy_text: "",
  updated_at: null,
  has_policy: false,
};

export default function CancellationPolicyPage() {
  const [tab, setTab] = useState(0); // 0=Cab, 1=Tour global, 2=Tour packages
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Cancellation Policy</Typography>
          <Typography variant="body2" color="text.secondary">
            Cab uses a global ladder. Tours use a global ladder with an optional per-package override.
            Hotel ladders are per-hotel (partner-editable). Every global edit appends an audit row to
            <code style={{ marginLeft: 4 }}>cancellation_policy_versions</code>.
          </Typography>
        </Box>
      </Stack>

      <Card sx={{ mb: 3, borderRadius: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab icon={<DirectionsCar sx={{ fontSize: 18 }} />} iconPosition="start" label="Cab (global)" />
          <Tab icon={<FlightTakeoff sx={{ fontSize: 18 }} />} iconPosition="start" label="Tour (global)" />
          <Tab label="Tour packages" />
        </Tabs>
      </Card>

      {tab === 0 && <CabLadderEditor qc={qc} enqueueSnackbar={enqueueSnackbar} />}
      {tab === 1 && <TourLadderEditor qc={qc} enqueueSnackbar={enqueueSnackbar} />}
      {tab === 2 && <TourPackagePolicies qc={qc} enqueueSnackbar={enqueueSnackbar} />}
    </Box>
  );
}

// ════════════════════════════════════════════════════════════════
// Shared ladder-card editor (cab + tour)
// ════════════════════════════════════════════════════════════════
function LadderEditor({
  title, alertText, keyMeta, ladderQuery, updateMutation, openEdit,
  historyPrefix, getHistory,
}: {
  title: string;
  alertText: string;
  keyMeta: Record<string, { label: string; hint: string; unit: string }>;
  ladderQuery: { data?: CabLadder; refetch: () => void };
  updateMutation: { isPending: boolean; mutate: () => void };
  openEdit: (key: string, value: string) => void;
  historyPrefix: string;
  getHistory: (params?: { config_key?: string; page?: number; page_size?: number }) => Promise<{ total: number; items: CabLadderHistoryItem[] }>;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyKey, setHistoryKey] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const historyQuery = useQuery({
    queryKey: [historyPrefix, historyKey, page + 1, pageSize],
    queryFn: () => getHistory({ config_key: historyKey, page: page + 1, page_size: pageSize }),
    enabled: historyOpen,
  });

  useEffect(() => { setPage(0); }, [historyKey]);

  const orderedKeys = Object.keys(keyMeta);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6" fontWeight={700}>{title}</Typography>
        <Stack direction="row" gap={1}>
          <Button
            variant="outlined"
            startIcon={<History />}
            onClick={() => { setHistoryKey(undefined); setHistoryOpen(true); }}
          >
            Audit History
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={() => ladderQuery.refetch()}><Refresh /></IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Alert severity="info" icon={<Policy />} sx={{ mb: 3 }}>
        {alertText}
      </Alert>

      <Grid container spacing={2}>
        {orderedKeys.map((key) => {
          const entry = ladderQuery.data?.[key];
          const meta = keyMeta[key];
          return (
            <Grid item xs={12} sm={6} md={4} key={key}>
              <Card sx={{ borderRadius: 3, height: "100%" }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography variant="overline" color="text.secondary">{key}</Typography>
                    <Chip size="small" label={meta.unit} />
                  </Stack>
                  <Typography variant="h5" fontWeight={800} gutterBottom>
                    {entry?.value ?? "—"}
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                      {meta.unit}
                    </Typography>
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40 }}>
                    {meta.label} — {meta.hint}
                  </Typography>
                  <Stack direction="row" gap={1} mt={2}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Edit />}
                      onClick={() => openEdit(key, entry?.value || "0")}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<History />}
                      onClick={() => { setHistoryKey(key); setHistoryOpen(true); }}
                    >
                      History
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: "info.main" }}><History /></Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Ladder audit history</Typography>
              <Typography variant="caption" color="text.secondary">
                {historyKey || "All keys"} · append-only
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Key</TableCell>
                <TableCell>Previous</TableCell>
                <TableCell>New</TableCell>
                <TableCell>Reason</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {historyQuery.isLoading && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
              )}
              {!historyQuery.isLoading && (historyQuery.data?.items || []).map((row: CabLadderHistoryItem) => (
                <TableRow key={row.id} hover>
                  <TableCell><Typography variant="caption">{new Date(row.created_at).toLocaleString()}</Typography></TableCell>
                  <TableCell><Typography variant="caption" sx={{ fontFamily: "monospace" }}>{row.config_key}</Typography></TableCell>
                  <TableCell><Chip size="small" label={row.previous_value || "—"} /></TableCell>
                  <TableCell><Chip size="small" color="primary" label={row.new_value} /></TableCell>
                  <TableCell>
                    <Typography variant="caption">{row.change_reason || "—"}</Typography>
                  </TableCell>
                </TableRow>
              ))}
              {!historyQuery.isLoading && (historyQuery.data?.items || []).length === 0 && (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.secondary" }}>No edits recorded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={historyQuery.data?.total || 0}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryOpen(false)} variant="outlined">Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(updateMutation.isPending)}>
        <DialogContent><CircularProgress /></DialogContent>
      </Dialog>
    </Box>
  );
}

// ════════════════════════════════════════════════════════════════
// Cab tab
// ════════════════════════════════════════════════════════════════
function CabLadderEditor({ qc, enqueueSnackbar }: { qc: ReturnType<typeof useQueryClient>; enqueueSnackbar: (m: string, o?: object) => void }) {
  const [editing, setEditing] = useState<{ key: string; value: string; reason: string } | null>(null);
  const [historyKey, setHistoryKey] = useState<string | undefined>(undefined);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const ladderQuery = useQuery<CabLadder>({
    queryKey: ["cab-ladder"],
    queryFn: () => cancellationService.getCabLadder(),
    staleTime: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: () => cancellationService.updateCabLadderKey(
      editing!.key, editing!.value, editing!.reason,
    ),
    onSuccess: (res) => {
      enqueueSnackbar(`Updated ${res.config_key}: ${res.previous_value} → ${res.new_value}`, { variant: "success" });
      qc.invalidateQueries({ queryKey: ["cab-ladder"] });
      qc.invalidateQueries({ queryKey: ["cab-ladder-history"] });
      setEditing(null);
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || "Update failed", { variant: "error" }),
  });

  return (
    <Box>
      <LadderEditor
        title="Cab — global ladder"
        alertText="Refund amount is capped at the live advance collected from the customer. Post-assignment rule overrides the time-based ladder once a partner has been notified."
        keyMeta={CAB_KEY_META}
        ladderQuery={ladderQuery}
        updateMutation={updateMutation}
        openEdit={(key, value) => setEditing({ key, value, reason: "" })}
        historyPrefix="cab-ladder-history"
        getHistory={cancellationService.getCabLadderHistory}
      />

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: "primary.main" }}><Edit /></Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Edit ladder key</Typography>
              <Typography variant="caption" color="text.secondary">{editing?.key}</Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent>
          {editing && (
            <Stack gap={2} mt={1}>
              <Alert severity="info">
                Current value: <strong>{ladderQuery.data?.[editing.key]?.value ?? "—"}</strong>.
                Saving appends a row to <code>cancellation_policy_versions</code> BEFORE the new value lands.
              </Alert>
              <TextField
                label={`New value (${CAB_KEY_META[editing.key]?.unit || ""})`}
                value={editing.value}
                onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                fullWidth
                type="number"
                inputProps={{ min: 0, step: CAB_KEY_META[editing.key]?.unit === "%" ? "0.01" : "1" }}
              />
              <TextField
                label="Change reason (recorded in audit)"
                value={editing.reason}
                onChange={(e) => setEditing({ ...editing, reason: e.target.value })}
                fullWidth multiline rows={2}
                placeholder="e.g. Q4 marketing push — soften tier 1 to retain goodwill"
              />
            </Stack>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setEditing(null)} variant="outlined" color="inherit">Cancel</Button>
          <Button
            variant="contained"
            startIcon={updateMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <Save />}
            disabled={!editing || updateMutation.isPending || editing.value === (ladderQuery.data?.[editing.key]?.value ?? "")}
            onClick={() => updateMutation.mutate()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ════════════════════════════════════════════════════════════════
// Tour global tab
// ════════════════════════════════════════════════════════════════
function TourLadderEditor({ qc, enqueueSnackbar }: { qc: ReturnType<typeof useQueryClient>; enqueueSnackbar: (m: string, o?: object) => void }) {
  const [editing, setEditing] = useState<{ key: string; value: string; reason: string } | null>(null);

  const ladderQuery = useQuery<CabLadder>({
    queryKey: ["tour-ladder"],
    queryFn: () => cancellationService.getTourLadder(),
    staleTime: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: () => cancellationService.updateTourLadderKey(
      editing!.key, editing!.value, editing!.reason,
    ),
    onSuccess: (res) => {
      enqueueSnackbar(`Updated ${res.config_key}: ${res.previous_value} → ${res.new_value}`, { variant: "success" });
      qc.invalidateQueries({ queryKey: ["tour-ladder"] });
      setEditing(null);
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || "Update failed", { variant: "error" }),
  });

  return (
    <Box>
      <LadderEditor
        title="Tour — global ladder (fallback for packages without their own policy)"
        alertText="BRD Part 5 §119: free 30 days → 100%, tier-1 15 days → 75%, tier-2 7 days → 50%, last-minute → 0%. A tour package with its own policy overrides this ladder."
        keyMeta={TOUR_KEY_META}
        ladderQuery={ladderQuery}
        updateMutation={updateMutation}
        openEdit={(key, value) => setEditing({ key, value, reason: "" })}
        historyPrefix="tour-ladder-history"
        getHistory={cancellationService.getTourLadderHistory}
      />

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: "primary.main" }}><Edit /></Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Edit tour ladder key</Typography>
              <Typography variant="caption" color="text.secondary">{editing?.key}</Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent>
          {editing && (
            <Stack gap={2} mt={1}>
              <Alert severity="info">
                Current value: <strong>{ladderQuery.data?.[editing.key]?.value ?? "—"}</strong>.
                Saving appends a row to <code>cancellation_policy_versions</code> BEFORE the new value lands.
              </Alert>
              <TextField
                label={`New value (${TOUR_KEY_META[editing.key]?.unit || ""})`}
                value={editing.value}
                onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                fullWidth
                type="number"
                inputProps={{ min: 0, step: TOUR_KEY_META[editing.key]?.unit === "%" ? "0.01" : "1" }}
              />
              <TextField
                label="Change reason (recorded in audit)"
                value={editing.reason}
                onChange={(e) => setEditing({ ...editing, reason: e.target.value })}
                fullWidth multiline rows={2}
                placeholder="e.g. Relax free-cancel window for festive season"
              />
            </Stack>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setEditing(null)} variant="outlined" color="inherit">Cancel</Button>
          <Button
            variant="contained"
            startIcon={updateMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <Save />}
            disabled={!editing || updateMutation.isPending || editing.value === (ladderQuery.data?.[editing.key]?.value ?? "")}
            onClick={() => updateMutation.mutate()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ════════════════════════════════════════════════════════════════
// Tour packages tab — pick a package, edit its ladder
// ════════════════════════════════════════════════════════════════
function TourPackagePolicies({ qc, enqueueSnackbar }: { qc: ReturnType<typeof useQueryClient>; enqueueSnackbar: (m: string, o?: object) => void }) {
  const [search, setSearch] = useState("");
  const [editingPkg, setEditingPkg] = useState<TourPackage | null>(null);
  const [form, setForm] = useState<TourPackagePolicy>(PKG_DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  const packagesQuery = useQuery({
    queryKey: ["admin-tour-packages"],
    queryFn: () => tourService.listPackages({ page: 1, page_size: 100 }),
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const list: TourPackage[] = packagesQuery.data ?? [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((p: TourPackage) =>
      `${p.package_name} ${p.destination ?? ""} ${p.package_code}`.toLowerCase().includes(q),
    );
  }, [packagesQuery.data, search]);

  const policyQuery = useQuery<TourPackagePolicy>({
    queryKey: ["tour-package-policy", editingPkg?.id],
    queryFn: () => cancellationService.getTourPackagePolicy(editingPkg!.id),
    enabled: Boolean(editingPkg),
    retry: false,
  });

  // Load the policy into the form (defaults when no row exists yet).
  useEffect(() => {
    if (!editingPkg) return;
    if (policyQuery.isLoading) { setLoaded(false); return; }
    if (policyQuery.data) {
      setForm({ ...PKG_DEFAULTS, ...policyQuery.data, tour_package_id: editingPkg.id });
    } else if (policyQuery.isError) {
      setForm({ ...PKG_DEFAULTS, tour_package_id: editingPkg.id });
    }
    setLoaded(true);
  }, [editingPkg, policyQuery.isLoading, policyQuery.data, policyQuery.isError]);

  const saveMutation = useMutation({
    mutationFn: () => cancellationService.updateTourPackagePolicy(editingPkg!.id, {
      cancellation_free_days: Number(form.cancellation_free_days),
      cancellation_tier_1_days: Number(form.cancellation_tier_1_days),
      refund_percent_tier_1: Number(form.refund_percent_tier_1),
      cancellation_tier_2_days: Number(form.cancellation_tier_2_days),
      refund_percent_tier_2: Number(form.refund_percent_tier_2),
      refund_percent_tier_3: Number(form.refund_percent_tier_3),
      refund_percent_last_minute: Number(form.refund_percent_last_minute),
      cancellation_policy_text: form.cancellation_policy_text,
    }),
    onSuccess: () => {
      enqueueSnackbar(`Policy saved for ${editingPkg?.package_name}.`, { variant: "success" });
      qc.invalidateQueries({ queryKey: ["tour-package-policy"] });
      setEditingPkg(null);
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || "Save failed", { variant: "error" }),
  });

  return (
    <Box>
      <Alert severity="info" icon={<Policy />} sx={{ mb: 3 }}>
        Each tour package can carry its own cancellation ladder. Packages without one use the global
        tour ladder (previous tab). The engine records which source applied in each booking's policy snapshot.
      </Alert>

      <TextField
        size="small"
        fullWidth
        placeholder="Search packages by name, destination or code…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2, maxWidth: 420 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment>,
        }}
      />

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Package</TableCell>
            <TableCell>Destination</TableCell>
            <TableCell>Duration</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Policy</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {packagesQuery.isLoading && (
            <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><CircularProgress size={26} /></TableCell></TableRow>
          )}
          {!packagesQuery.isLoading && filtered.length === 0 && (
            <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6, color: "text.secondary" }}>
              {search ? "No packages match your search." : "No tour packages found."}
            </TableCell></TableRow>
          )}
          {filtered.map((p: TourPackage) => (
            <TableRow key={p.id} hover>
              <TableCell>
                <Typography variant="body2" fontWeight={600}>{p.package_name}</Typography>
                <Typography variant="caption" color="text.secondary">{p.package_code}</Typography>
              </TableCell>
              <TableCell><Typography variant="body2">{p.destination}</Typography></TableCell>
              <TableCell><Typography variant="body2">{p.duration_days}D / {p.duration_nights}N</Typography></TableCell>
              <TableCell><Chip size="small" label={p.status} /></TableCell>
              <TableCell align="right">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Edit />}
                  onClick={() => { setEditingPkg(p); setForm(PKG_DEFAULTS); setLoaded(false); }}
                >
                  Edit policy
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={Boolean(editingPkg)} onClose={() => setEditingPkg(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: "primary.main" }}><Edit /></Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Tour package cancellation policy</Typography>
              <Typography variant="caption" color="text.secondary">
                {editingPkg?.package_name} · {editingPkg?.package_code}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent>
          {!loaded ? (
            <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress size={26} /></Stack>
          ) : (
            <Stack gap={2} mt={1}>
              <Grid container spacing={2}>
                {PKG_FIELDS.map((f) => (
                  <Grid item xs={6} key={f.key}>
                    <TextField
                      label={`${f.label} (${f.unit})`}
                      value={(form as any)[f.key]}
                      onChange={(e) => setForm({ ...form, [f.key]: Number(e.target.value) })}
                      fullWidth
                      type="number"
                      inputProps={{ min: 0, max: f.unit === "%" ? 100 : undefined, step: f.unit === "%" ? "0.01" : "1" }}
                      helperText={f.hint}
                      size="small"
                    />
                  </Grid>
                ))}
              </Grid>
              <TextField
                label="Cancellation policy text (shown to customers)"
                value={form.cancellation_policy_text ?? ""}
                onChange={(e) => setForm({ ...form, cancellation_policy_text: e.target.value })}
                fullWidth multiline rows={3}
                placeholder="e.g. Free cancellation up to 30 days before travel; 75% refund up to 15 days; 50% up to 7 days."
              />
              {!form.has_policy && (
                <Alert severity="info">
                  No policy row yet — this package currently uses the <strong>global tour ladder</strong>.
                  Saving creates this package's own override.
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setEditingPkg(null)} variant="outlined" color="inherit">Cancel</Button>
          <Button
            variant="contained"
            startIcon={saveMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <Save />}
            disabled={!loaded || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Save policy
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
