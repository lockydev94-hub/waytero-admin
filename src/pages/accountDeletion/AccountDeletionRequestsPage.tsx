// ============================================================
// WAYTERO ADMIN — ACCOUNT DELETION REQUESTS INBOX
// Doc Ref: Account Deletion — Admin Inbox
// Website /customer submits a deletion request → it lands here.
// Approve → account soft-deleted + anonymised, sessions killed.
// ============================================================
import { useMemo, useState } from "react";
import {
  Box, Card, CardContent, Chip, Stack, Typography, Button, IconButton,
  Table, TableHead, TableBody, TableRow, TableCell, TablePagination,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Tabs, Tab, Tooltip, CircularProgress, Divider,
} from "@mui/material";
import { Refresh, PersonOff, CheckCircle, Block, DeleteForever } from "@mui/icons-material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  accountDeletionService,
  DeletionRequestItem,
  DeletionRequestStatus,
} from "../../services/accountDeletion.service";

const STATUS_CHIP: Record<DeletionRequestStatus, { label: string; color: "warning" | "success" | "error" }> = {
  PENDING: { label: "Pending", color: "warning" },
  APPROVED: { label: "Approved", color: "success" },
  REJECTED: { label: "Rejected", color: "error" },
};

export default function AccountDeletionRequestsPage() {
  const [tab, setTab] = useState(0); // 0 = Pending, 1 = All, 2 = Approved, 3 = Rejected
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [reviewing, setReviewing] = useState<DeletionRequestItem | null>(null);
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const statusFilter = useMemo<DeletionRequestStatus | undefined>(() => {
    if (tab === 0) return "PENDING";
    if (tab === 2) return "APPROVED";
    if (tab === 3) return "REJECTED";
    return undefined;
  }, [tab]);

  const listQuery = useQuery({
    queryKey: ["account-deletion", statusFilter, page + 1, pageSize],
    queryFn: () => accountDeletionService.listRequests({
      status: statusFilter,
      page: page + 1,
      page_size: pageSize,
    }),
  });

  const countsQuery = useQuery({
    queryKey: ["account-deletion-counts"],
    queryFn: () => accountDeletionService.getCounts(),
    refetchInterval: 60_000,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: "APPROVED" | "REJECTED" }) =>
      accountDeletionService.reviewRequest(id, decision, note || undefined),
    onSuccess: (res) => {
      enqueueSnackbar(res.message || "Request updated", { variant: res.status === "APPROVED" ? "success" : "info" });
      qc.invalidateQueries({ queryKey: ["account-deletion"] });
      qc.invalidateQueries({ queryKey: ["account-deletion-counts"] });
      setReviewing(null);
      setNote("");
      setConfirmDelete(false);
    },
    onError: (e: any) =>
      enqueueSnackbar(e?.response?.data?.message || "Action failed — please try again", { variant: "error" }),
  });

  const items = listQuery.data?.items || [];
  const total = listQuery.data?.total || 0;
  const counts = countsQuery.data;

  const openReview = (item: DeletionRequestItem) => {
    setReviewing(item);
    setNote("");
    setConfirmDelete(false);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Account Deletion Requests</Typography>
          <Typography variant="body2" color="text.secondary">
            Customers asked to delete their accounts. Approving anonymises the profile and deactivates every session.
          </Typography>
        </Box>
        <Stack direction="row" gap={1} alignItems="center">
          {counts && (
            <Chip
              icon={<PersonOff />}
              label={`${counts.pending} pending`}
              color={counts.pending > 0 ? "warning" : "default"}
            />
          )}
          <Tooltip title="Refresh">
            <IconButton onClick={() => { listQuery.refetch(); countsQuery.refetch(); }}><Refresh /></IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Tabs value={tab} onChange={(_e, v) => { setTab(v); setPage(0); }}>
        <Tab label={`Pending${counts?.pending ? ` (${counts.pending})` : ""}`} />
        <Tab label="All" />
        <Tab label="Approved" />
        <Tab label="Rejected" />
      </Tabs>

      <Card sx={{ mt: 2 }}>
        <CardContent sx={{ p: 0 }}>
          {listQuery.isLoading ? (
            <Box display="flex" justifyContent="center" py={6}><CircularProgress size={32} /></Box>
          ) : items.length === 0 ? (
            <Alert severity="info" sx={{ m: 2 }}>No account-deletion requests match this filter.</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Requested</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>#{r.id}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{r.full_name || "—"}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.mobile}</Typography>
                      {r.email && (
                        <Typography variant="caption" color="text.secondary" display="block">{r.email}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {r.reason}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={r.request_source === "LOGGED_IN" ? "Logged in" : "Public form"} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(r.requested_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={STATUS_CHIP[r.status].label} color={STATUS_CHIP[r.status].color} />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="outlined" onClick={() => openReview(r)}>
                        {r.status === "PENDING" ? "Review" : "View"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
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

      <Dialog open={!!reviewing} onClose={() => setReviewing(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          Review deletion request #{reviewing?.id}
        </DialogTitle>
        <DialogContent dividers>
          {reviewing && (
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Full name</Typography>
                  <Typography variant="body2">{reviewing.full_name || "—"}</Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Mobile</Typography>
                  <Typography variant="body2">{reviewing.mobile}</Typography>
                </Box>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Email</Typography>
                  <Typography variant="body2">{reviewing.email || "—"}</Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Requested via</Typography>
                  <Typography variant="body2">
                    {reviewing.request_source === "LOGGED_IN" ? "Logged-in customer" : "Public website form"}
                  </Typography>
                </Box>
              </Stack>
              <Box>
                <Typography variant="caption" color="text.secondary">Reason for deletion</Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", bgcolor: "background.paper", p: 1.5, borderRadius: 1 }}>
                  {reviewing.reason}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Requested {new Date(reviewing.requested_at).toLocaleString("en-IN")}
                {reviewing.reviewed_at && ` · reviewed ${new Date(reviewing.reviewed_at).toLocaleString("en-IN")}`}
              </Typography>

              {reviewing.status !== "PENDING" && (
                <Alert severity={reviewing.status === "APPROVED" ? "success" : "info"}>
                  {reviewing.status === "APPROVED"
                    ? "Deletion was initiated. The account is anonymised and sessions were deactivated."
                    : "This request was rejected."}
                  {reviewing.review_note && ` Note: ${reviewing.review_note}`}
                </Alert>
              )}

              {reviewing.status === "PENDING" && (
                <>
                  <Divider />
                  <TextField
                    label="Review note (optional)"
                    multiline
                    minRows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Visible to the requester / audit trail"
                  />
                  <Alert severity="error" icon={<DeleteForever />}>
                    <strong>Approving is irreversible.</strong> The account is permanently anonymised, all sessions are
                    killed, and the customer can no longer log in. Bookings &amp; wallet ledgers are retained in
                    anonymised form for legal/tax reasons.
                  </Alert>
                  <Box display="flex" alignItems="center" gap={1}>
                    <input
                      type="checkbox"
                      id="confirm-delete"
                      checked={confirmDelete}
                      onChange={(e) => setConfirmDelete(e.target.checked)}
                    />
                    <label htmlFor="confirm-delete" style={{ fontSize: "0.85rem", color: "text.secondary" }}>
                      I confirm this deletion request is genuine and verified.
                    </label>
                  </Box>
                </>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewing(null)}>Close</Button>
          {reviewing?.status === "PENDING" && (
            <>
              <Button
                startIcon={<Block />}
                onClick={() => reviewMutation.mutate({ id: reviewing.id, decision: "REJECTED" })}
                disabled={reviewMutation.isPending}
              >
                Reject
              </Button>
              <Button
                startIcon={<CheckCircle />}
                variant="contained"
                color="error"
                onClick={() => reviewMutation.mutate({ id: reviewing.id, decision: "APPROVED" })}
                disabled={reviewMutation.isPending || !confirmDelete}
              >
                {reviewMutation.isPending ? "Processing…" : "Approve & delete account"}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
