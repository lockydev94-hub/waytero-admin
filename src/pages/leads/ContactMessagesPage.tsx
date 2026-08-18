// ============================================================
// WAYTERO ADMIN — WEBSITE CONTACT MESSAGES INBOX
// Doc Ref: Website Lead Capture §3 — Admin API
// "Send us a message" submissions from /contact land here.
// ============================================================
import { useMemo, useState } from "react";
import {
  Box, Card, CardContent, Chip, Stack, Typography, Button, IconButton,
  Table, TableHead, TableBody, TableRow, TableCell, TablePagination,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Tabs, Tab, Tooltip, CircularProgress,
} from "@mui/material";
import { Refresh, MarkEmailRead, MarkEmailUnread, Email } from "@mui/icons-material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { leadsService, ContactMessageItem } from "../../services/leads.service";

export default function ContactMessagesPage() {
  const [tab, setTab] = useState(0); // 0 = Unread, 1 = All
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<ContactMessageItem | null>(null);

  const readFilter = useMemo(() => (tab === 0 ? false : undefined), [tab]);

  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const listQuery = useQuery({
    queryKey: ["contact-messages", readFilter, page + 1, pageSize, search],
    queryFn: () => leadsService.listContactMessages({
      read: readFilter,
      search: search || undefined,
      page: page + 1,
      page_size: pageSize,
    }),
  });

  const statsQuery = useQuery({
    queryKey: ["contact-messages-stats"],
    queryFn: () => leadsService.getContactMessageStats(),
    refetchInterval: 60_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (msg: ContactMessageItem) => leadsService.markContactMessageRead(msg.id, !msg.is_read),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-messages"] });
      qc.invalidateQueries({ queryKey: ["contact-messages-stats"] });
    },
    onError: (e: any) => enqueueSnackbar(e?.response?.data?.message || "Update failed", { variant: "error" }),
  });

  const items = listQuery.data?.items || [];
  const total = listQuery.data?.total || 0;

  const openMessage = (msg: ContactMessageItem) => {
    setViewing(msg);
    if (!msg.is_read) markReadMutation.mutate(msg);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Contact Messages</Typography>
          <Typography variant="body2" color="text.secondary">
            "Send us a message" submissions from the website contact page.
          </Typography>
        </Box>
        <Stack direction="row" gap={1} alignItems="center">
          {statsQuery.data && (
            <Chip
              icon={<Email />}
              label={`${statsQuery.data.unread} unread`}
              color={statsQuery.data.unread > 0 ? "warning" : "default"}
            />
          )}
          <Tooltip title="Refresh">
            <IconButton onClick={() => { listQuery.refetch(); statsQuery.refetch(); }}><Refresh /></IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Tabs value={tab} onChange={(_e, v) => { setTab(v); setPage(0); }}>
        <Tab label="Unread" />
        <Tab label="All" />
      </Tabs>

      <Box display="flex" justifyContent="flex-end" mb={2}>
        <TextField
          size="small"
          placeholder="Search name / email / subject"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        />
      </Box>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {listQuery.isLoading ? (
            <Box display="flex" justifyContent="center" py={6}><CircularProgress size={32} /></Box>
          ) : items.length === 0 ? (
            <Alert severity="info" sx={{ m: 2 }}>No contact messages match this filter.</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Sender</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Received</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((m) => (
                  <TableRow key={m.id} hover sx={{ fontWeight: m.is_read ? "normal" : 700 }}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={m.is_read ? "normal" : 700}>{m.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{m.email}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: m.is_read ? "normal" : 700 }}>{m.subject}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.message}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{new Date(m.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={m.is_read ? "Read" : "Unread"} color={m.is_read ? "default" : "warning"} />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="outlined" onClick={() => openMessage(m)}>View</Button>
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

      <Dialog open={!!viewing} onClose={() => setViewing(null)} fullWidth maxWidth="sm">
        <DialogTitle>{viewing?.subject}</DialogTitle>
        <DialogContent dividers>
          {viewing && (
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Name</Typography>
                  <Typography variant="body2">{viewing.name}</Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">Email</Typography>
                  <Typography variant="body2">{viewing.email}</Typography>
                </Box>
              </Stack>
              {viewing.mobile && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Mobile</Typography>
                  <Typography variant="body2">{viewing.mobile}</Typography>
                </Box>
              )}
              <Box>
                <Typography variant="caption" color="text.secondary">Message</Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{viewing.message}</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Received {new Date(viewing.created_at).toLocaleString("en-IN")}
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={viewing?.is_read ? <MarkEmailUnread /> : <MarkEmailRead />}
            onClick={() => viewing && markReadMutation.mutate(viewing)}
          >
            {viewing?.is_read ? "Mark as unread" : "Mark as read"}
          </Button>
          <Button onClick={() => setViewing(null)} variant="contained">Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
