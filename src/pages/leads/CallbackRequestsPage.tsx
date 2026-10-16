// ============================================================
// WAYTERO ADMIN — CALLBACK REQUESTS
// Doc Ref: Website Lead Capture §3 — Admin API
// The public "Request a Callback" card on customer-web lands here.
// The CCO marks the attempt, then works the number in the existing
// Customer Care lookup (register / ticket / book) — nothing is
// duplicated here.
// ============================================================
import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, IconButton, MenuItem,
  Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow,
  Tabs, Tab, TextField, Tooltip, Typography,
} from "@mui/material";
import { ArrowForward, Phone, PhoneCallback, Refresh, Visibility } from "@mui/icons-material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import {
  captureService,
  CALLBACK_STATUS_META,
  CallbackItem,
  CallbackStatus,
} from "../../services/capture.service";

const TABS: Array<{ label: string; key: CallbackStatus | "ALL" }> = [
  { label: "New", key: "NEW" },
  { label: "All", key: "ALL" },
  { label: "Called", key: "CALLED" },
  { label: "Not picked", key: "NOT_PICKED" },
  { label: "Done", key: "DONE" },
];

export default function CallbackRequestsPage() {
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [reviewing, setReviewing] = useState<CallbackItem | null>(null);
  const [status, setStatus] = useState<CallbackStatus>("CALLED");
  const [note, setNote] = useState("");

  const statusFilter = useMemo(() => {
    const key = TABS[tab]?.key;
    return key === "ALL" ? undefined : key;
  }, [tab]);

  const qc = useQueryClient();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const listQuery = useQuery({
    queryKey: ["callback-requests", statusFilter, page + 1, pageSize, search],
    queryFn: () =>
      captureService.listCallbacks({
        status: statusFilter,
        search: search || undefined,
        page: page + 1,
        page_size: pageSize,
      }),
  });

  const statsQuery = useQuery({
    queryKey: ["callback-requests-stats"],
    queryFn: () => captureService.callbackStats(),
    refetchInterval: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: () => captureService.updateCallback(reviewing!.id, { status, handle_note: note }),
    onSuccess: () => {
      enqueueSnackbar(`Callback marked ${CALLBACK_STATUS_META[status].label}`, { variant: "success" });
      qc.invalidateQueries({ queryKey: ["callback-requests"] });
      qc.invalidateQueries({ queryKey: ["callback-requests-stats"] });
      setReviewing(null);
    },
    onError: (e: any) =>
      enqueueSnackbar(e?.response?.data?.message || "Update failed", { variant: "error" }),
  });

  const items = listQuery.data?.items || [];
  const total = listQuery.data?.total || 0;

  const openReview = (item: CallbackItem) => {
    setReviewing(item);
    setStatus(item.status === "NEW" ? "CALLED" : item.status);
    setNote(item.handle_note || "");
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Callback Requests</Typography>
          <Typography variant="body2" color="text.secondary">
            Customers who asked us to call them. Mark the attempt, then work the number in
            Customer Care.
          </Typography>
        </Box>
        <Stack direction="row" gap={1} alignItems="center">
          {statsQuery.data && (
            <Chip
              icon={<PhoneCallback />}
              label={`${statsQuery.data.open} waiting`}
              color={statsQuery.data.open > 0 ? "warning" : "default"}
            />
          )}
          <Tooltip title="Refresh">
            <IconButton onClick={() => { listQuery.refetch(); statsQuery.refetch(); }}><Refresh /></IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Tabs value={tab} onChange={(_e, v) => { setTab(v); setPage(0); }}>
        {TABS.map((t) => <Tab key={t.key} label={t.label} />)}
      </Tabs>

      <Box display="flex" justifyContent="flex-end" mb={2}>
        <TextField
          size="small"
          placeholder="Search mobile / name"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        />
      </Box>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {listQuery.isLoading ? (
            <Box display="flex" justifyContent="center" py={6}><CircularProgress size={32} /></Box>
          ) : items.length === 0 ? (
            <Alert severity="info" sx={{ m: 2 }}>No callback requests match this filter.</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Mobile</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Requested</TableCell>
                  <TableCell>Last attempt</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((it) => {
                  const meta = CALLBACK_STATUS_META[it.status] ?? { label: it.status, color: "default" as const };
                  return (
                    <TableRow key={it.id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Phone fontSize="inherit" color="action" />
                          <Typography variant="body2" fontWeight={600}>{it.mobile}</Typography>
                        </Stack>
                        {it.customer_found ? (
                          <Chip size="small" label="Existing customer" color="success" variant="outlined" />
                        ) : (
                          <Chip size="small" label="New number" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{it.name || "—"}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(it.created_at).toLocaleString("en-IN", {
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {it.called_at ? new Date(it.called_at).toLocaleString("en-IN") : "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={meta.label} color={meta.color} />
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" variant="outlined" startIcon={<Visibility />} onClick={() => openReview(it)}>
                          Handle
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_e, p) => setPage(p)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={[10, 20, 50]}
      />

      <Dialog open={!!reviewing} onClose={() => setReviewing(null)} fullWidth maxWidth="xs">
        <DialogTitle>Handle callback</DialogTitle>
        <DialogContent dividers>
          {reviewing && (
            <Stack spacing={2} pt={1}>
              <Alert severity="info" icon={<Phone />}>
                <strong>{reviewing.mobile}</strong>
                {reviewing.name ? ` · ${reviewing.name}` : ""}
                <br />
                {reviewing.customer_found
                  ? "Already a WayTero customer."
                  : "Not registered yet — you can register them from Customer Care."}
              </Alert>

              <Button
                variant="outlined"
                endIcon={<ArrowForward />}
                onClick={() => navigate(`/customer-care?mobile=${reviewing.mobile}`)}
              >
                {reviewing.customer_found ? "Open in Customer Care" : "Register in Customer Care"}
              </Button>

              <Divider />

              <TextField
                select
                label="Status"
                fullWidth
                value={status}
                onChange={(e) => setStatus(e.target.value as CallbackStatus)}
              >
                {(Object.keys(CALLBACK_STATUS_META) as CallbackStatus[]).map((s) => (
                  <MenuItem key={s} value={s}>{CALLBACK_STATUS_META[s].label}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="Handling note"
                multiline
                minRows={3}
                fullWidth
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Called, no answer — retry tomorrow evening…"
              />
              {reviewing.handler_email && (
                <Typography variant="caption" color="text.secondary">
                  Last handled by {reviewing.handler_email}
                </Typography>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewing(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "Saving…" : `Mark ${CALLBACK_STATUS_META[status].label}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
