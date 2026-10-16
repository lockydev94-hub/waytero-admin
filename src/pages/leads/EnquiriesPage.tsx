// ============================================================
// WAYTERO ADMIN — WEBSITE ENQUIRIES
// Doc Ref: Website Lead Capture §3 — Admin API
// The public "ENQUIRY NOW" rail on customer-web lands here. The CCO
// calls the person, quotes them, then books them through the existing
// Customer Care flow — this page never books anything itself.
// ============================================================
import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, IconButton, MenuItem,
  Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow,
  Tabs, Tab, TextField, Tooltip, Typography,
} from "@mui/material";
import {
  Add, ArrowForward, Description, Email, Person, Phone, Refresh,
} from "@mui/icons-material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import {
  captureService,
  ENQUIRY_STATUS_META,
  QuotationItem,
  EnquiryItem,
  EnquiryStatus,
  SERVICE_TYPE_LABEL,
  CaptureServiceType,
} from "../../services/capture.service";

const TABS: Array<{ label: string; key: EnquiryStatus | "ALL" }> = [
  { label: "New", key: "NEW" },
  { label: "All", key: "ALL" },
  { label: "Contacted", key: "CONTACTED" },
  { label: "Quoted", key: "QUOTED" },
  { label: "Booked", key: "BOOKED" },
  { label: "Closed", key: "CLOSED" },
];

const EMPTY_QUOTE = { summary: "", amount: "", valid_till: "", terms: "" };

export default function EnquiriesPage() {
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [reviewing, setReviewing] = useState<EnquiryItem | null>(null);
  const [status, setStatus] = useState<EnquiryStatus>("CONTACTED");
  const [note, setNote] = useState("");
  const [quoteForm, setQuoteForm] = useState(EMPTY_QUOTE);
  const [quoteOpen, setQuoteOpen] = useState(false);

  const statusFilter = useMemo(() => {
    const key = TABS[tab]?.key;
    return key === "ALL" ? undefined : key;
  }, [tab]);

  const qc = useQueryClient();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const listQuery = useQuery({
    queryKey: ["enquiries", statusFilter, serviceFilter, page + 1, pageSize, search],
    queryFn: () =>
      captureService.listEnquiries({
        status: statusFilter,
        service_type: serviceFilter || undefined,
        search: search || undefined,
        page: page + 1,
        page_size: pageSize,
      }),
  });

  const statsQuery = useQuery({
    queryKey: ["enquiries-stats"],
    queryFn: () => captureService.enquiryStats(),
    refetchInterval: 60_000,
  });

  const quotationsQuery = useQuery({
    queryKey: ["enquiry-quotations", reviewing?.id],
    queryFn: () => captureService.listQuotations({ enquiry_id: reviewing!.id, page_size: 50 }),
    enabled: !!reviewing,
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      captureService.updateEnquiry(reviewing!.id, { status, handle_note: note }),
    onSuccess: () => {
      enqueueSnackbar(`Enquiry marked ${status}`, { variant: "success" });
      qc.invalidateQueries({ queryKey: ["enquiries"] });
      setReviewing(null);
    },
    onError: (e: any) =>
      enqueueSnackbar(e?.response?.data?.message || "Update failed", { variant: "error" }),
  });

  const quoteMutation = useMutation({
    mutationFn: () =>
      captureService.createQuotation(reviewing!.id, {
        summary: quoteForm.summary,
        amount: quoteForm.amount,
        valid_till: quoteForm.valid_till || undefined,
        terms: quoteForm.terms || undefined,
      }),
    onSuccess: () => {
      enqueueSnackbar("Quotation raised", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["enquiry-quotations"] });
      qc.invalidateQueries({ queryKey: ["enquiries"] });
      setQuoteForm(EMPTY_QUOTE);
      setQuoteOpen(false);
    },
    onError: (e: any) =>
      enqueueSnackbar(e?.response?.data?.message || "Could not raise the quotation", {
        variant: "error",
      }),
  });

  const quoteStatusMutation = useMutation({
    mutationFn: (vars: { id: number; status: string }) =>
      captureService.updateQuotation(vars.id, { status: vars.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["enquiry-quotations"] }),
    onError: (e: any) =>
      enqueueSnackbar(e?.response?.data?.message || "Update failed", { variant: "error" }),
  });

  const items = listQuery.data?.items || [];
  const total = listQuery.data?.total || 0;
  const quotations: QuotationItem[] = quotationsQuery.data?.items || [];

  const openReview = (item: EnquiryItem) => {
    setReviewing(item);
    setStatus(item.status);
    setNote(item.handle_note || "");
    setQuoteOpen(false);
    setQuoteForm(EMPTY_QUOTE);
  };

  const amountInvalid = quoteForm.amount !== "" && !/^\d+(\.\d{1,2})?$/.test(quoteForm.amount);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Website Enquiries</Typography>
          <Typography variant="body2" color="text.secondary">
            "Enquiry Now" submissions from the website. Call the customer, quote them, then book
            them through Customer Care.
          </Typography>
        </Box>
        <Stack direction="row" gap={1} alignItems="center">
          {statsQuery.data && (
            <Chip
              icon={<Description />}
              label={`${statsQuery.data.open} open`}
              color={statsQuery.data.open > 0 ? "warning" : "default"}
            />
          )}
          <Tooltip title="Refresh">
            <IconButton onClick={() => { listQuery.refetch(); statsQuery.refetch(); }}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Stack>
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
          <MenuItem value="">All</MenuItem>
          {(Object.keys(SERVICE_TYPE_LABEL) as CaptureServiceType[]).map((k) => (
            <MenuItem key={k} value={k}>{SERVICE_TYPE_LABEL[k]}</MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          placeholder="Search name / mobile / email / message"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        />
      </Stack>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {listQuery.isLoading ? (
            <Box display="flex" justifyContent="center" py={6}><CircularProgress size={32} /></Box>
          ) : items.length === 0 ? (
            <Alert severity="info" sx={{ m: 2 }}>No enquiries match this filter.</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Customer</TableCell>
                  <TableCell>Mobile</TableCell>
                  <TableCell>Service</TableCell>
                  <TableCell>Message</TableCell>
                  <TableCell>Received</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((it) => {
                  const meta = ENQUIRY_STATUS_META[it.status] ?? { label: it.status, color: "default" as const };
                  return (
                    <TableRow key={it.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {`${it.first_name} ${it.last_name || ""}`.trim()}
                        </Typography>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Email fontSize="inherit" color="action" />
                          <Typography variant="caption" color="text.secondary">{it.email}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Phone fontSize="inherit" color="action" />
                          <Typography variant="body2">{it.mobile}</Typography>
                        </Stack>
                        {it.customer_found ? (
                          <Chip size="small" label="Existing customer" color="success" variant="outlined" />
                        ) : (
                          <Chip size="small" label="New number" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={SERVICE_TYPE_LABEL[it.service_type] || it.service_type} />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 260 }}>
                        <Typography variant="body2" noWrap title={it.message || ""}>
                          {it.message || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(it.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={meta.label} color={meta.color} />
                        {it.quotation_count > 0 && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            {it.quotation_count} quote{it.quotation_count > 1 ? "s" : ""}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" variant="outlined" onClick={() => openReview(it)}>
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

      <Dialog open={!!reviewing} onClose={() => setReviewing(null)} fullWidth maxWidth="sm">
        <DialogTitle>Handle enquiry</DialogTitle>
        <DialogContent dividers>
          {reviewing && (
            <Stack spacing={2} pt={1}>
              <Alert severity="info" icon={<Person />}>
                <strong>{`${reviewing.first_name} ${reviewing.last_name || ""}`.trim()}</strong>
                {" · "}{SERVICE_TYPE_LABEL[reviewing.service_type] || reviewing.service_type}
                {" · "}{reviewing.source.replace(/_/g, " ").toLowerCase()}
              </Alert>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Mobile</Typography>
                  <Typography variant="body2">
                    <Phone fontSize="inherit" sx={{ verticalAlign: "middle", mr: 0.5 }} />
                    {reviewing.mobile}
                  </Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Email</Typography>
                  <Typography variant="body2">
                    <Email fontSize="inherit" sx={{ verticalAlign: "middle", mr: 0.5 }} />
                    {reviewing.email}
                  </Typography>
                </Box>
              </Stack>

              {reviewing.message && (
                <Box>
                  <Typography variant="caption" color="text.secondary">What they asked for</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{reviewing.message}</Typography>
                </Box>
              )}

              <Button
                variant="outlined"
                endIcon={<ArrowForward />}
                onClick={() => navigate(`/customer-care?mobile=${reviewing.mobile}`)}
              >
                {reviewing.customer_found ? "Open in Customer Care" : "Register & book in Customer Care"}
              </Button>

              <Divider>Quotations</Divider>

              {quotationsQuery.isLoading ? (
                <Box display="flex" justifyContent="center" py={2}><CircularProgress size={24} /></Box>
              ) : quotations.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No quotation raised yet.
                </Typography>
              ) : (
                quotations.map((q) => (
                  <Stack key={q.id} direction="row" alignItems="center" spacing={1}>
                    <Box flex={1}>
                      <Typography variant="body2" fontWeight={600}>
                        ₹{Number(q.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        <Typography component="span" variant="caption" color="text.secondary">
                          {" "}{q.currency}
                          {q.valid_till ? ` · valid till ${q.valid_till}` : ""}
                        </Typography>
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {q.summary}
                      </Typography>
                    </Box>
                    <TextField
                      size="small"
                      select
                      label="Quote status"
                      value={q.status}
                      onChange={(e) => quoteStatusMutation.mutate({ id: q.id, status: e.target.value })}
                      sx={{ minWidth: 130 }}
                    >
                      {["DRAFT", "SENT", "ACCEPTED", "DECLINED", "EXPIRED"].map((s) => (
                        <MenuItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                ))
              )}

              {quoteOpen ? (
                <Stack spacing={1.5} pl={1}>
                  <TextField
                    size="small"
                    label="Summary"
                    required
                    fullWidth
                    value={quoteForm.summary}
                    onChange={(e) => setQuoteForm({ ...quoteForm, summary: e.target.value })}
                    placeholder="Bhubaneswar → Puri day trip, Innova, 4 passengers"
                  />
                  <Stack direction="row" spacing={1.5}>
                    <TextField
                      size="small"
                      label="Amount (₹)"
                      required
                      value={quoteForm.amount}
                      onChange={(e) => setQuoteForm({ ...quoteForm, amount: e.target.value })}
                      error={amountInvalid}
                      helperText={amountInvalid ? "Use digits, up to 2 decimals" : " "}
                      inputProps={{ inputMode: "decimal" }}
                      sx={{ minWidth: 140 }}
                    />
                    <TextField
                      size="small"
                      type="date"
                      label="Valid till"
                      InputLabelProps={{ shrink: true }}
                      value={quoteForm.valid_till}
                      onChange={(e) => setQuoteForm({ ...quoteForm, valid_till: e.target.value })}
                      sx={{ minWidth: 170 }}
                    />
                  </Stack>
                  <TextField
                    size="small"
                    label="Terms"
                    multiline
                    minRows={2}
                    fullWidth
                    value={quoteForm.terms}
                    onChange={(e) => setQuoteForm({ ...quoteForm, terms: e.target.value })}
                    placeholder="Excludes tolls and parking. Payable at confirmation."
                  />
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => quoteMutation.mutate()}
                      disabled={
                        quoteMutation.isPending ||
                        quoteForm.summary.trim().length < 2 ||
                        !quoteForm.amount ||
                        amountInvalid
                      }
                    >
                      {quoteMutation.isPending ? "Saving…" : "Save quotation"}
                    </Button>
                    <Button size="small" onClick={() => setQuoteOpen(false)}>Cancel</Button>
                  </Stack>
                </Stack>
              ) : (
                <Button
                  size="small"
                  startIcon={<Add />}
                  onClick={() => setQuoteOpen(true)}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Raise a quotation
                </Button>
              )}

              <Divider />

              <TextField
                select
                label="Status"
                fullWidth
                value={status}
                onChange={(e) => setStatus(e.target.value as EnquiryStatus)}
              >
                {(Object.keys(ENQUIRY_STATUS_META) as EnquiryStatus[]).map((s) => (
                  <MenuItem key={s} value={s}>{ENQUIRY_STATUS_META[s].label}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="Handling note"
                multiline
                minRows={3}
                fullWidth
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Call outcome, quoted price, follow-up date…"
              />
              {reviewing.handler_email && (
                <Typography variant="caption" color="text.secondary">
                  Last handled by {reviewing.handler_email}
                  {reviewing.handled_at ? ` · ${new Date(reviewing.handled_at).toLocaleString("en-IN")}` : ""}
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
            {updateMutation.isPending ? "Saving…" : `Mark ${ENQUIRY_STATUS_META[status]?.label || status}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
