// ============================================================
// WAYTERO ADMIN — PARTNER SUPPORT TRIAGE
// Partners raise help tickets from the partner app. This queue
// lets support staff prioritise, work, and resolve them.
// ============================================================
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Refresh, Send, SupportAgent } from "@mui/icons-material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  partnerSupportService,
  PartnerSupportPriority,
  PartnerSupportStatus,
  PartnerSupportTicket,
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITY_META,
  SUPPORT_STATUS_META,
} from "../../services/partnerSupport.service";

const TABS: Array<{ label: string; status?: PartnerSupportStatus }> = [
  { label: "Open", status: "OPEN" },
  { label: "In progress", status: "IN_PROGRESS" },
  { label: "All" },
  { label: "Resolved", status: "RESOLVED" },
  { label: "Closed", status: "CLOSED" },
];

const STATUSES = Object.keys(SUPPORT_STATUS_META) as PartnerSupportStatus[];
const PRIORITIES = Object.keys(SUPPORT_PRIORITY_META) as PartnerSupportPriority[];

function when(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function categoryLabel(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export default function PartnerSupportPage() {
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<PartnerSupportPriority | "">("");
  const [managing, setManaging] = useState<PartnerSupportTicket | null>(null);
  const [nextStatus, setNextStatus] = useState<PartnerSupportStatus>("OPEN");
  const [nextPriority, setNextPriority] = useState<PartnerSupportPriority>("NORMAL");
  const [notes, setNotes] = useState("");
  const [reply, setReply] = useState("");

  const deferredSearch = useDeferredValue(search.trim());
  const statusFilter = TABS[tab]?.status;
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const queryKey = [
    "partner-support",
    statusFilter,
    category,
    priority,
    deferredSearch,
    page + 1,
    pageSize,
  ];

  const listQuery = useQuery({
    queryKey,
    queryFn: () =>
      partnerSupportService.list({
        status: statusFilter,
        category: category || undefined,
        priority: priority || undefined,
        search: deferredSearch || undefined,
        page: page + 1,
        page_size: pageSize,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ["partner-support-ticket", managing?.id],
    queryFn: () => partnerSupportService.getDetail(managing!.id),
    enabled: !!managing,
  });

  useEffect(() => {
    if (!managing || !detailQuery.isSuccess) return;
    // Opening the thread clears its unread replies on the server.
    qc.invalidateQueries({ queryKey: ["partner-support"] });
    qc.invalidateQueries({ queryKey: ["admin", "action-counts"] });
  }, [managing, detailQuery.isSuccess, detailQuery.dataUpdatedAt, qc]);

  const replyMutation = useMutation({
    mutationFn: () => partnerSupportService.reply(managing!.id, reply.trim()),
    onSuccess: () => {
      setReply("");
      qc.invalidateQueries({ queryKey: ["partner-support-ticket", managing?.id] });
      qc.invalidateQueries({ queryKey: ["partner-support"] });
    },
    onError: (error: any) =>
      enqueueSnackbar(
        error?.response?.data?.message ||
          error?.response?.data?.detail ||
          "Could not send the reply",
        { variant: "error" },
      ),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      partnerSupportService.update(managing!.id, {
        status: nextStatus,
        priority: nextPriority,
        resolution_notes: notes.trim() || undefined,
      }),
    onSuccess: (ticket) => {
      enqueueSnackbar(`${ticket.ticket_number} updated`, { variant: "success" });
      qc.invalidateQueries({ queryKey: ["partner-support"] });
      qc.invalidateQueries({ queryKey: ["partner-support-ticket", ticket.id] });
      setManaging(null);
    },
    onError: (error: any) =>
      enqueueSnackbar(
        error?.response?.data?.message ||
          error?.response?.data?.detail ||
          "Could not update the ticket",
        { variant: "error" },
      ),
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const thread = detailQuery.data?.messages ?? [];

  const openTicket = (ticket: PartnerSupportTicket) => {
    setManaging(ticket);
    setNextStatus(ticket.status);
    setNextPriority(ticket.priority);
    setNotes(ticket.resolution_notes ?? "");
    setReply("");
  };

  const resetFilters = () => {
    setSearch("");
    setCategory("");
    setPriority("");
    setPage(0);
  };

  const hasFilters = useMemo(
    () => Boolean(search.trim() || category || priority),
    [search, category, priority],
  );

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Partner Support</Typography>
          <Typography variant="body2" color="text.secondary">
            Help tickets raised by partners from the app. Set priority, track work, and record the resolution.
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={() => listQuery.refetch()}><Refresh /></IconButton>
        </Tooltip>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_event, value) => {
          setTab(value);
          setPage(0);
        }}
      >
        {TABS.map((item) => <Tab key={item.label} label={item.label} />)}
      </Tabs>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        justifyContent="flex-end"
        alignItems={{ xs: "stretch", sm: "center" }}
        my={2}
      >
        <TextField
          size="small"
          select
          label="Category"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(0);
          }}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="">All categories</MenuItem>
          {SUPPORT_CATEGORIES.map((item) => (
            <MenuItem key={item} value={item}>{categoryLabel(item)}</MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          select
          label="Priority"
          value={priority}
          onChange={(event) => {
            setPriority(event.target.value as PartnerSupportPriority | "");
            setPage(0);
          }}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">All priorities</MenuItem>
          {PRIORITIES.map((item) => (
            <MenuItem key={item} value={item}>{SUPPORT_PRIORITY_META[item].label}</MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label="Search"
          placeholder="Ticket, partner, mobile, subject"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
          sx={{ minWidth: 260 }}
        />
        {hasFilters && <Button onClick={resetFilters}>Clear</Button>}
      </Stack>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {listQuery.isLoading ? (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress size={32} />
            </Box>
          ) : listQuery.isError ? (
            <Alert severity="error" sx={{ m: 2 }}>
              Could not load partner support tickets. Refresh to try again.
            </Alert>
          ) : items.length === 0 ? (
            <Alert severity="info" sx={{ m: 2 }}>
              No partner support tickets match this filter.
            </Alert>
          ) : (
            <TableContainer>
              <Table size="small" sx={{ minWidth: 980 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Ticket</TableCell>
                    <TableCell>Partner</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Raised</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((ticket) => {
                    const status = SUPPORT_STATUS_META[ticket.status];
                    const level = SUPPORT_PRIORITY_META[ticket.priority];
                    return (
                      <TableRow key={ticket.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace" fontWeight={700}>
                            {ticket.ticket_number}
                          </Typography>
                          <Typography
                            variant="body2"
                            noWrap
                            title={ticket.subject}
                            sx={{ maxWidth: 320 }}
                          >
                            {ticket.subject}
                          </Typography>
                          {ticket.unread_count > 0 && (
                            <Typography variant="caption" color="warning.main" fontWeight={700} display="block">
                              {ticket.unread_count} unread repl{ticket.unread_count === 1 ? "y" : "ies"}
                            </Typography>
                          )}
                          {ticket.booking_reference && (
                            <Typography variant="caption" color="text.secondary">
                              Booking {ticket.booking_reference}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {ticket.business_name || ticket.owner_name || "Partner"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {ticket.owner_name && ticket.business_name ? `${ticket.owner_name} · ` : ""}
                            {ticket.partner_code || `#${ticket.partner_id}`}
                          </Typography>
                          {ticket.mobile && (
                            <Typography variant="caption" color="text.secondary">
                              {ticket.mobile}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{categoryLabel(ticket.category)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={level.label} color={level.color} />
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={status.label} color={status.color} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{when(ticket.created_at)}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<SupportAgent />}
                            onClick={() => openTicket(ticket)}
                          >
                            Manage
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_event, value) => setPage(value)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(event) => {
          setPageSize(parseInt(event.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[10, 20, 50]}
      />

      <Dialog
        open={!!managing}
        onClose={() => {
          if (!updateMutation.isPending) setManaging(null);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {managing?.ticket_number} · {managing?.subject}
        </DialogTitle>
        <DialogContent dividers>
          {managing && (
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  label={SUPPORT_PRIORITY_META[managing.priority].label}
                  color={SUPPORT_PRIORITY_META[managing.priority].color}
                />
                <Chip
                  size="small"
                  label={SUPPORT_STATUS_META[managing.status].label}
                  color={SUPPORT_STATUS_META[managing.status].color}
                />
                <Typography variant="caption" color="text.secondary">
                  Raised {when(managing.created_at)}
                </Typography>
              </Stack>

              <Box>
                <Typography variant="caption" color="text.secondary">Partner</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {managing.business_name || managing.owner_name || "Partner"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {[managing.owner_name, managing.partner_code, managing.mobile]
                    .filter(Boolean)
                    .join(" · ")}
                </Typography>
              </Box>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Category</Typography>
                  <Typography variant="body2">{categoryLabel(managing.category)}</Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Booking reference</Typography>
                  <Typography variant="body2" fontFamily={managing.booking_reference ? "monospace" : "inherit"}>
                    {managing.booking_reference || "—"}
                  </Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Resolved</Typography>
                  <Typography variant="body2">{when(managing.resolved_at)}</Typography>
                </Box>
              </Stack>

              <Divider />

              <Box>
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                  <Typography variant="subtitle1" fontWeight={700}>Conversation</Typography>
                  <Chip size="small" label={`${thread.length} message${thread.length === 1 ? "" : "s"}`} />
                </Stack>

                {detailQuery.isLoading ? (
                  <Box display="flex" justifyContent="center" py={3}>
                    <CircularProgress size={26} />
                  </Box>
                ) : detailQuery.isError ? (
                  <Alert severity="error">Could not load this conversation.</Alert>
                ) : (
                  <Stack spacing={1.5} sx={{ maxHeight: 320, overflowY: "auto", pr: 0.5 }}>
                    {thread.map((message) => {
                      const mine = message.author_type === "ADMIN";
                      return (
                        <Box
                          key={message.id}
                          display="flex"
                          justifyContent={mine ? "flex-end" : "flex-start"}
                        >
                          <Box
                            sx={{
                              maxWidth: "84%",
                              p: 1.25,
                              borderRadius: 2,
                              bgcolor: mine ? "primary.main" : "action.hover",
                              color: mine ? "#fff" : "text.primary",
                            }}
                          >
                            <Typography
                              variant="caption"
                              display="block"
                              sx={{ mb: 0.5, opacity: 0.8 }}
                            >
                              {mine ? "WayTero Support" : message.author_name || "Partner"}
                              {" · "}
                              {when(message.created_at)}
                            </Typography>
                            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                              {message.body}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Stack>
                )}

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} mt={2} alignItems="flex-end">
                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    maxRows={4}
                    label="Reply to partner"
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    disabled={managing.status === "CLOSED"}
                  />
                  <Button
                    variant="contained"
                    startIcon={<Send />}
                    onClick={() => replyMutation.mutate()}
                    disabled={
                      managing.status === "CLOSED" ||
                      !reply.trim() ||
                      replyMutation.isPending
                    }
                  >
                    {replyMutation.isPending ? "Sending…" : "Send"}
                  </Button>
                </Stack>
                {managing.status === "CLOSED" && (
                  <Typography variant="caption" color="text.secondary">
                    This ticket is closed. Reopen it before replying.
                  </Typography>
                )}
              </Box>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  select
                  fullWidth
                  label="Status"
                  value={nextStatus}
                  onChange={(event) => setNextStatus(event.target.value as PartnerSupportStatus)}
                >
                  {STATUSES.map((item) => (
                    <MenuItem key={item} value={item}>{SUPPORT_STATUS_META[item].label}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  fullWidth
                  label="Priority"
                  value={nextPriority}
                  onChange={(event) => setNextPriority(event.target.value as PartnerSupportPriority)}
                >
                  {PRIORITIES.map((item) => (
                    <MenuItem key={item} value={item}>{SUPPORT_PRIORITY_META[item].label}</MenuItem>
                  ))}
                </TextField>
              </Stack>

              <TextField
                label="Resolution notes"
                multiline
                minRows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="What was checked, what changed, and what the partner was told"
                helperText="Visible to support staff on this ticket."
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManaging(null)} disabled={updateMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => updateMutation.mutate()}
            disabled={!managing || updateMutation.isPending}
          >
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
