// ============================================================
// WAYTERO ADMIN — CANCELLATION REQUESTS INBOX
// Doc Ref: BRD Part 3 §46/§47 — partner requests admin to cancel
// Partner cannot cancel directly. Admin reviews + approves / rejects.
// ============================================================
import { useMemo, useState } from "react";
import {
  Box, Card, CardContent, Chip, Stack, Typography, Button, IconButton,
  Table, TableHead, TableBody, TableRow, TableCell, TablePagination,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Avatar, Divider, Alert, Tabs, Tab, Tooltip, Grid, CircularProgress,
} from "@mui/material";
import {
  Cancel, CheckCircle, Block, HourglassBottom, Info,
  Refresh, ThumbDown, ThumbUp, DirectionsCar, Hotel, FlightTakeoff,
} from "@mui/icons-material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { cancellationService, CancellationRequestItem } from "../../services/cancellation.service";

const STATUS_COLORS: Record<string, "default" | "primary" | "warning" | "success" | "error"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "error",
  WITHDRAWN: "default",
  AUTO_CLOSED: "default",
};

export default function CancellationRequestsPage() {
  const [tab, setTab] = useState(0); // 0=PENDING, 1=ALL, 2=APPROVED, 3=REJECTED
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [reviewing, setReviewing] = useState<CancellationRequestItem | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewDecision, setReviewDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");

  const statusFilter = useMemo(() => {
    if (tab === 0) return "PENDING";
    if (tab === 2) return "APPROVED";
    if (tab === 3) return "REJECTED";
    return undefined;
  }, [tab]);

  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const listQuery = useQuery({
    queryKey: ["cancel-requests", statusFilter, page + 1, pageSize],
    queryFn: () => cancellationService.listRequests({
      status: statusFilter,
      page: page + 1,
      page_size: pageSize,
    }),
  });

  const countsQuery = useQuery({
    queryKey: ["cancel-requests-counts"],
    queryFn: () => cancellationService.getRequestCounts(),
    refetchInterval: 30_000,
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      cancellationService.reviewRequest(reviewing!.id, reviewDecision, reviewNote),
    onSuccess: () => {
      enqueueSnackbar(
        reviewDecision === "APPROVED"
          ? "Request approved. Cancellation applied; refund credited."
          : "Request rejected.",
        { variant: reviewDecision === "APPROVED" ? "success" : "info" },
      );
      qc.invalidateQueries({ queryKey: ["cancel-requests"] });
      qc.invalidateQueries({ queryKey: ["cancel-requests-counts"] });
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      setReviewing(null);
      setReviewNote("");
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.detail || "Review failed", { variant: "error" }),
  });

  const items = listQuery.data?.items || [];
  const total = listQuery.data?.total || 0;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Cancellation Requests</Typography>
          <Typography variant="body2" color="text.secondary">
            Partner-initiated cancellation requests. Approve to run the policy engine and credit the refund to the customer wallet.
          </Typography>
        </Box>
        <Stack direction="row" gap={1} alignItems="center">
          {countsQuery.data && (
            <>
              <Chip
                icon={<HourglassBottom />}
                label={`${countsQuery.data.pending} pending`}
                color={countsQuery.data.pending > 0 ? "warning" : "default"}
              />
              <Chip
                icon={<CheckCircle />}
                label={`${countsQuery.data.approved} approved`}
                color="success"
                variant="outlined"
              />
              <Chip
                icon={<Block />}
                label={`${countsQuery.data.rejected} rejected`}
                color="error"
                variant="outlined"
              />
            </>
          )}
          <Tooltip title="Refresh">
            <IconButton onClick={() => listQuery.refetch()}><Refresh /></IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Card>
        <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(0); }}>
          <Tab label="Pending" />
          <Tab label="All" />
          <Tab label="Approved" />
          <Tab label="Rejected" />
        </Tabs>
        <Divider />
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Booking #</TableCell>
              <TableCell>Reason code</TableCell>
              <TableCell>Requested at</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Refund preview</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {listQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            )}
            {!listQuery.isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6, color: "text.secondary" }}>
                  No requests in this filter.
                </TableCell>
              </TableRow>
            )}
            {items.map((req) => {
              const preview: any = req.refund_preview_json || {};
              return (
                <TableRow key={req.id} hover>
                  <TableCell>
                    <Stack direction="row" alignItems="center" gap={0.5}>
                      {req.booking_type === "CAB" ? <DirectionsCar fontSize="small" /> :
                       req.booking_type === "HOTEL" ? <Hotel fontSize="small" /> : <FlightTakeoff fontSize="small" />}
                      <Typography variant="body2" fontWeight={600}>{req.booking_type}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {req.cab_booking_number || req.hotel_reservation_number || req.tour_booking_number || req.master_booking_number || "—"}
                    </Typography>
                    {req.master_booking_number && (
                      <Typography variant="caption" color="text.secondary">
                        Master: {req.master_booking_number}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{req.requested_reason_code || "—"}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{new Date(req.requested_at).toLocaleString()}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={STATUS_COLORS[req.status] || "default"}
                      label={req.status}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {preview.refund_amount != null ? (
                      <Stack alignItems="flex-end">
                        <Typography variant="body2" color="success.main" fontWeight={700}>
                          ₹{Number(preview.refund_amount).toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          tier: {preview.tier_label || "—"}
                        </Typography>
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Info />}
                      onClick={() => { setReviewing(req); setReviewDecision("APPROVED"); setReviewNote(""); }}
                    >
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      </Card>

      <Dialog open={Boolean(reviewing)} onClose={() => setReviewing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: "warning.main" }}><Cancel /></Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>Review cancellation request</Typography>
              <Typography variant="caption" color="text.secondary">
                Request #{reviewing?.id} · {reviewing?.booking_type} ·{" "}
                {reviewing?.cab_booking_number || reviewing?.hotel_reservation_number || reviewing?.tour_booking_number}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent>
          {reviewing && (
            <Stack gap={2} mt={1}>
              <Alert severity="info">
                <strong>Reason:</strong> {reviewing.requested_reason}
              </Alert>
              {reviewing.refund_preview_json && (
                <Box p={2} bgcolor="grey.50" borderRadius={2}>
                  <Typography variant="subtitle2" fontWeight={700} mb={1}>Auto-computed refund</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Charge</Typography>
                      <Typography variant="h6" color="error" fontWeight={700}>
                        ₹{Number((reviewing.refund_preview_json as any).charge || 0).toLocaleString()}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Refund</Typography>
                      <Typography variant="h6" color="success.main" fontWeight={700}>
                        ₹{Number((reviewing.refund_preview_json as any).refund_amount || 0).toLocaleString()}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Refund %</Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {(reviewing.refund_preview_json as any).refund_percent}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Tier</Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {(reviewing.refund_preview_json as any).tier_label}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}
              <TextField
                label="Review note (optional)"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                fullWidth multiline rows={2}
                placeholder="Visible to the partner and on the audit trail"
              />
            </Stack>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setReviewing(null)} variant="outlined" color="inherit">Cancel</Button>
          <Button
            color="error"
            variant="outlined"
            startIcon={<ThumbDown />}
            disabled={reviewMutation.isPending}
            onClick={() => { setReviewDecision("REJECTED"); setTimeout(() => reviewMutation.mutate(), 0); }}
          >
            Reject
          </Button>
          <Button
            color="success"
            variant="contained"
            startIcon={reviewMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <ThumbUp />}
            disabled={reviewMutation.isPending}
            onClick={() => { setReviewDecision("APPROVED"); setTimeout(() => reviewMutation.mutate(), 0); }}
          >
            Approve & Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
