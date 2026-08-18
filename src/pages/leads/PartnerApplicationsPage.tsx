// ============================================================
// WAYTERO ADMIN — PARTNER APPLICATIONS INBOX
// Doc Ref: Website Lead Capture §3 — Admin API
// Website "Become a Partner" submissions (/partner) land here.
// Admin contacts the lead, then marks CONVERTED (and creates the
// real partner via /partners page) or REJECTED.
// ============================================================
import { useMemo, useState } from "react";
import {
  Box, Card, CardContent, Chip, Stack, Typography, Button, IconButton,
  Table, TableHead, TableBody, TableRow, TableCell, TablePagination,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Tabs, Tab, Tooltip, CircularProgress, MenuItem,
} from "@mui/material";
import {
  Refresh, Handshake, Person, Phone, Email, LocationOn,
  Notes, CheckCircle, Block,
} from "@mui/icons-material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  leadsService,
  PartnerApplicationItem,
  APPLICATION_STATUS_META,
  ApplicationStatus,
} from "../../services/leads.service";

const TABS: Array<{ label: string; key: ApplicationStatus | "ALL" }> = [
  { label: "New", key: "NEW" },
  { label: "All", key: "ALL" },
  { label: "Contacted", key: "CONTACTED" },
  { label: "Converted", key: "CONVERTED" },
  { label: "Rejected", key: "REJECTED" },
];

export default function PartnerApplicationsPage() {
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [reviewing, setReviewing] = useState<PartnerApplicationItem | null>(null);
  const [reviewStatus, setReviewStatus] = useState<ApplicationStatus>("CONTACTED");
  const [reviewNotes, setReviewNotes] = useState("");

  const statusFilter = useMemo(() => {
    const key = TABS[tab]?.key;
    return key === "ALL" ? undefined : key;
  }, [tab]);

  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const listQuery = useQuery({
    queryKey: ["partner-applications", statusFilter, page + 1, pageSize, search],
    queryFn: () => leadsService.listPartnerApplications({
      status: statusFilter,
      search: search || undefined,
      page: page + 1,
      page_size: pageSize,
    }),
  });

  const statsQuery = useQuery({
    queryKey: ["partner-applications-stats"],
    queryFn: () => leadsService.getPartnerApplicationStats(),
    refetchInterval: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      leadsService.updatePartnerApplication(reviewing!.id, {
        status: reviewStatus,
        admin_notes: reviewNotes,
      }),
    onSuccess: () => {
      enqueueSnackbar(`Application marked ${reviewStatus}`, { variant: "success" });
      qc.invalidateQueries({ queryKey: ["partner-applications"] });
      qc.invalidateQueries({ queryKey: ["partner-applications-stats"] });
      setReviewing(null);
      setReviewNotes("");
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.message || "Update failed", { variant: "error" }),
  });

  const items = listQuery.data?.items || [];
  const total = listQuery.data?.total || 0;

  const openReview = (item: PartnerApplicationItem) => {
    setReviewing(item);
    setReviewStatus((item.status as ApplicationStatus) || "CONTACTED");
    setReviewNotes(item.admin_notes || "");
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Partner Applications</Typography>
          <Typography variant="body2" color="text.secondary">
            "Become a Partner" submissions from the website. Contact the lead, then convert or reject.
          </Typography>
        </Box>
        <Stack direction="row" gap={1} alignItems="center">
          {statsQuery.data && (
            <Chip
              icon={<Handshake />}
              label={`${statsQuery.data.new} new`}
              color={statsQuery.data.new > 0 ? "warning" : "default"}
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
          placeholder="Search business / person / mobile / email"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        />
      </Box>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {listQuery.isLoading ? (
            <Box display="flex" justifyContent="center" py={6}><CircularProgress size={32} /></Box>
          ) : items.length === 0 ? (
            <Alert severity="info" sx={{ m: 2 }}>No partner applications match this filter.</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Business</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>City</TableCell>
                  <TableCell>Received</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((it) => {
                  const meta = APPLICATION_STATUS_META[it.status] ?? { label: it.status, color: "default" };
                  return (
                    <TableRow key={it.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{it.business_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{it.business_type}</Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Person fontSize="inherit" color="action" />
                          <Typography variant="body2">{it.contact_person}</Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Phone fontSize="inherit" color="action" />
                          <Typography variant="body2">{it.mobile}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <LocationOn fontSize="inherit" color="action" />
                          <Typography variant="body2">{it.city || "—"}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{new Date(it.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={meta.label} color={meta.color} />
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" variant="outlined" onClick={() => openReview(it)}>
                          Review
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

      <Dialog open={!!reviewing} onClose={() => setReviewing(null)} fullWidth maxWidth="sm">
        <DialogTitle>Review application</DialogTitle>
        <DialogContent dividers>
          {reviewing && (
            <Stack spacing={2} pt={1}>
              <Alert severity="info" icon={<Handshake />}>
                <strong>{reviewing.business_name}</strong> · {reviewing.business_type}
              </Alert>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Contact person</Typography>
                  <Typography variant="body2"><Person fontSize="inherit" sx={{ verticalAlign: "middle", mr: 0.5 }} />{reviewing.contact_person}</Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Mobile</Typography>
                  <Typography variant="body2"><Phone fontSize="inherit" sx={{ verticalAlign: "middle", mr: 0.5 }} />{reviewing.mobile}</Typography>
                </Box>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Email</Typography>
                  <Typography variant="body2"><Email fontSize="inherit" sx={{ verticalAlign: "middle", mr: 0.5 }} />{reviewing.email}</Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">City</Typography>
                  <Typography variant="body2"><LocationOn fontSize="inherit" sx={{ verticalAlign: "middle", mr: 0.5 }} />{reviewing.city || "—"}</Typography>
                </Box>
              </Stack>
              {reviewing.details && (
                <Box>
                  <Typography variant="caption" color="text.secondary">About the business</Typography>
                  <Typography variant="body2">{reviewing.details}</Typography>
                </Box>
              )}
              <TextField
                select
                label="Status"
                fullWidth
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value as ApplicationStatus)}
              >
                <MenuItem value="NEW">New</MenuItem>
                <MenuItem value="CONTACTED">Contacted</MenuItem>
                <MenuItem value="CONVERTED">Converted</MenuItem>
                <MenuItem value="REJECTED">Rejected</MenuItem>
              </TextField>
              <TextField
                label="Admin notes"
                multiline
                minRows={3}
                fullWidth
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Call outcome, follow-up, reason for rejection…"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewing(null)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={reviewStatus === "CONVERTED" ? <CheckCircle /> : reviewStatus === "REJECTED" ? <Block /> : <Notes />}
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "Saving…" : `Mark ${reviewStatus}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
