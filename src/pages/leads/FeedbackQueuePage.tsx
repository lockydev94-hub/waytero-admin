// ============================================================
// WAYTERO ADMIN — GUEST FEEDBACK QUEUE
// Doc Ref: Website Lead Capture §3 — Admin API
// The public /feedback page lands here. Nothing is published to the
// website's TESTIMONIALS band from this queue — approving only marks
// the review verified for the record.
//
// Verifying shows the whole booking (status, money, every service line
// and the registered customer) so the admin judges the feedback with
// the trip in front of them.
// ============================================================
import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, IconButton, MenuItem,
  Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow,
  Tabs, Tab, TextField, Tooltip, Typography,
} from "@mui/material";
import { Block, CheckCircle, RateReview, Refresh, Search } from "@mui/icons-material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  captureService,
  FEEDBACK_STATUS_META,
  FeedbackItem,
  FeedbackStatus,
} from "../../services/capture.service";

const TABS: Array<{ label: string; key: FeedbackStatus | "ALL" }> = [
  { label: "Pending", key: "PENDING" },
  { label: "All", key: "ALL" },
  { label: "Approved", key: "APPROVED" },
  { label: "Rejected", key: "REJECTED" },
];

const SERVICE_TYPES = ["", "CAB", "HOTEL", "TOUR"] as const;

function Stars({ rating }: { rating: number }) {
  return (
    <Tooltip title={`${rating} / 5`}>
      <span>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} style={{ color: i < rating ? "#F59E0B" : "#CBD5E1" }}>★</span>
        ))}
      </span>
    </Tooltip>
  );
}

function money(amount: string) {
  return `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function day(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
}

export default function FeedbackQueuePage() {
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [verifying, setVerifying] = useState<FeedbackItem | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const statusFilter = useMemo(() => {
    const key = TABS[tab]?.key;
    return key === "ALL" ? undefined : key;
  }, [tab]);

  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const listQuery = useQuery({
    queryKey: ["guest-feedback", statusFilter, serviceFilter, page + 1, pageSize, search],
    queryFn: () =>
      captureService.listFeedback({
        status: statusFilter,
        service_type: serviceFilter || undefined,
        search: search || undefined,
        page: page + 1,
        page_size: pageSize,
      }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["guest-feedback"] });

  const approveMutation = useMutation({
    mutationFn: (id: number) => captureService.approveFeedback(id),
    onSuccess: () => {
      enqueueSnackbar("Feedback approved", { variant: "success" });
      invalidate();
      setVerifying(null);
    },
    onError: (e: any) =>
      enqueueSnackbar(e?.response?.data?.message || "Could not approve", { variant: "error" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (vars: { id: number; reason: string }) =>
      captureService.rejectFeedback(vars.id, vars.reason),
    onSuccess: () => {
      enqueueSnackbar("Feedback rejected", { variant: "info" });
      invalidate();
      setVerifying(null);
      setRejecting(false);
      setReason("");
    },
    onError: (e: any) =>
      enqueueSnackbar(e?.response?.data?.message || "Could not reject", { variant: "error" }),
  });

  const items = listQuery.data?.items || [];
  const total = listQuery.data?.total || 0;

  const openVerify = (item: FeedbackItem) => {
    setVerifying(item);
    setRejecting(false);
    setReason("");
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Guest Feedback</Typography>
          <Typography variant="body2" color="text.secondary">
            Reviews submitted from the public feedback page against a booking reference. Verify
            the booking, then approve or reject.
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={() => listQuery.refetch()}><Refresh /></IconButton>
        </Tooltip>
      </Stack>

      <Tabs value={tab} onChange={(_e, v) => { setTab(v); setPage(0); }}>
        {TABS.map((t) => <Tab key={t.key} label={t.label} />)}
      </Tabs>

      <Stack direction="row" spacing={2} justifyContent="flex-end" mb={2}>
        <TextField
          size="small"
          select
          label="Service"
          value={serviceFilter}
          onChange={(e) => { setServiceFilter(e.target.value); setPage(0); }}
          sx={{ minWidth: 140 }}
        >
          {SERVICE_TYPES.map((s) => (
            <MenuItem key={s || "ALL"} value={s}>{s || "All"}</MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          placeholder="Search booking ref / guest / review"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        />
      </Stack>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {listQuery.isLoading ? (
            <Box display="flex" justifyContent="center" py={6}><CircularProgress size={32} /></Box>
          ) : items.length === 0 ? (
            <Alert severity="info" sx={{ m: 2 }}>No feedback matches this filter.</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Rating</TableCell>
                  <TableCell>Guest</TableCell>
                  <TableCell>Booking</TableCell>
                  <TableCell>Review</TableCell>
                  <TableCell>Received</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((it) => {
                  const meta = FEEDBACK_STATUS_META[it.status] ?? { label: it.status, color: "default" as const };
                  return (
                    <TableRow key={it.id} hover>
                      <TableCell><Stars rating={it.rating} /></TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{it.guest_name || "Guest"}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {it.guest_mobile || it.guest_email || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">{it.booking.booking_number}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {it.booking_ref_submitted && it.booking_ref_submitted !== it.booking.booking_number
                            ? `entered as ${it.booking_ref_submitted}`
                            : (it.booking.services || it.booking.booking_status)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 280 }}>
                        <Typography variant="body2" noWrap title={it.review || ""}>
                          {it.review || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{day(it.created_at)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={meta.label} color={meta.color} />
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" variant="outlined" startIcon={<Search />} onClick={() => openVerify(it)}>
                          Verify
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

      <Dialog open={!!verifying} onClose={() => setVerifying(null)} fullWidth maxWidth="sm">
        <DialogTitle>Verify feedback</DialogTitle>
        <DialogContent dividers>
          {verifying && (
            <Stack spacing={2} pt={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <RateReview color="action" />
                <Stars rating={verifying.rating} />
                <Typography variant="body2" color="text.secondary">
                  submitted {new Date(verifying.created_at).toLocaleString("en-IN")}
                </Typography>
              </Stack>

              <Box>
                <Typography variant="caption" color="text.secondary">What they wrote</Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                  {verifying.review || "No comment — rating only."}
                </Typography>
              </Box>

              <Divider>Guest</Divider>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Name</Typography>
                  <Typography variant="body2">{verifying.guest_name || "—"}</Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Mobile</Typography>
                  <Typography variant="body2">{verifying.guest_mobile || "—"}</Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Email</Typography>
                  <Typography variant="body2">{verifying.guest_email || "—"}</Typography>
                </Box>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Reference they entered: {verifying.booking_ref_submitted || "—"}
              </Typography>

              <Divider>Booking</Divider>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Booking number</Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {verifying.booking.booking_number}
                  </Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Services</Typography>
                  <Typography variant="body2">{verifying.booking.services || "—"}</Typography>
                </Box>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Booking status</Typography>
                  <Typography variant="body2">{verifying.booking.booking_status}</Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Payment</Typography>
                  <Typography variant="body2">{verifying.booking.payment_status}</Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Total</Typography>
                  <Typography variant="body2">{money(verifying.booking.total_amount)}</Typography>
                </Box>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Journey</Typography>
                  <Typography variant="body2">
                    {day(verifying.booking.journey_start_date)} → {day(verifying.booking.journey_end_date)}
                  </Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">City</Typography>
                  <Typography variant="body2">{verifying.booking.city || "—"}</Typography>
                </Box>
              </Stack>

              <Divider>Registered customer</Divider>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Name</Typography>
                  <Typography variant="body2">{verifying.booking.customer_name}</Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Mobile</Typography>
                  <Typography variant="body2">{verifying.booking.customer_mobile || "—"}</Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Email</Typography>
                  <Typography variant="body2">{verifying.booking.customer_email || "—"}</Typography>
                </Box>
              </Stack>

              {verifying.status !== "PENDING" && (
                <Alert severity={verifying.status === "APPROVED" ? "success" : "warning"}>
                  {verifying.status === "REJECTED" && verifying.rejection_reason
                    ? `Rejected — ${verifying.rejection_reason}`
                    : `Already ${verifying.status.toLowerCase()}${
                        verifying.moderator_email ? ` by ${verifying.moderator_email}` : ""
                      }.`}
                </Alert>
              )}

              {rejecting && (
                <TextField
                  label="Reason for rejection"
                  required
                  multiline
                  minRows={2}
                  fullWidth
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="We could not match this to the booking…"
                  helperText={reason.trim().length >= 3 ? " " : "A short reason is required"}
                />
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerifying(null)}>Close</Button>
          {rejecting ? (
            <Button
              variant="contained"
              color="error"
              startIcon={<Block />}
              disabled={reason.trim().length < 3 || rejectMutation.isPending}
              onClick={() =>
                rejectMutation.mutate({ id: verifying!.id, reason: reason.trim() })
              }
            >
              {rejectMutation.isPending ? "Rejecting…" : "Confirm rejection"}
            </Button>
          ) : (
            <>
              <Button color="error" startIcon={<Block />} onClick={() => setRejecting(true)}>
                Reject
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircle />}
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate(verifying!.id)}
              >
                {approveMutation.isPending ? "Saving…" : "Approve"}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
