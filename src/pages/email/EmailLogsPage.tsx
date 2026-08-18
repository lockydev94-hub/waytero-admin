// ============================================================
// WAYTERO ADMIN — EMAIL LOGS PAGE
// Delivery status of every transactional email with filters,
// a detail drawer (payload + error) and a Resend action for
// failed / wrong-address sends.
// ============================================================
import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Card, CardContent, CardHeader, Tabs, Tab, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper,
  IconButton, Chip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Tooltip, CircularProgress, Alert,
  Pagination, Stack, Drawer, Grid,
} from "@mui/material";
import {
  Refresh, Replay, Search, Visibility, CheckCircle, ErrorOutline,
  MarkEmailRead, EventNote, Person,
} from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { emailService, EmailLogItem, EmailLogsPage as EmailLogsPageData, EmailStats } from "../../services/email.service";

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "SENT", label: "Sent" },
  { key: "FAILED", label: "Failed" },
];

export default function EmailLogsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [data, setData] = useState<EmailLogsPageData | null>(null);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<EmailLogItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [resending, setResending] = useState<number | null>(null);

  const status = STATUS_TABS[tab]?.key ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [logs, st] = await Promise.all([
        emailService.getLogs({ status: status || undefined, search: search || undefined, page, page_size: 20 }),
        emailService.getStats(),
      ]);
      setData(logs);
      setStats(st);
    } catch {
      enqueueSnackbar("Failed to load email logs", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [status, search, page, enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: number) => {
    try {
      const d = await emailService.getLogDetail(id);
      setDetail(d);
      setDetailOpen(true);
    } catch {
      enqueueSnackbar("Failed to load detail", { variant: "error" });
    }
  };

  const resend = async (id: number) => {
    setResending(id);
    try {
      const res = await emailService.resend(id);
      enqueueSnackbar(res.message || "Email re-sent", { variant: "success" });
      setDetailOpen(false);
      load();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.message || "Resend failed", { variant: "error" });
    } finally {
      setResending(null);
    }
  };

  const statusChip = (s: string) =>
    s === "SENT" ? (
      <Chip icon={<CheckCircle sx={{ fontSize: 14 }} />} label="Sent" size="small" color="success" sx={{ height: 22, fontSize: 11 }} />
    ) : (
      <Chip icon={<ErrorOutline sx={{ fontSize: 14 }} />} label="Failed" size="small" color="error" sx={{ height: 22, fontSize: 11 }} />
    );

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Email Logs</Typography>
          <Typography variant="body2" color="text.secondary">
            Delivery status of every transactional email — booking, invoice, payment, wallet, refund, settlement
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<Refresh />} onClick={load}>Refresh</Button>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: "Total emails", value: stats?.total ?? 0, color: "primary", icon: <MarkEmailRead /> },
          { label: "Delivered", value: stats?.sent ?? 0, color: "success", icon: <CheckCircle /> },
          { label: "Failed", value: stats?.failed ?? 0, color: "error", icon: <ErrorOutline /> },
        ].map((s) => (
          <Grid item xs={12} sm={4} key={s.label}>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: `${s.color}.lighter`, color: `${s.color}.main`, display: "flex" }}>
                  {s.icon}
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={800}>{s.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ borderRadius: 2 }}>
        <CardHeader
          title={
            <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(1); }} sx={{ minHeight: 40 }}>
              {STATUS_TABS.map((t) => (
                <Tab key={t.key} label={t.label} sx={{ minHeight: 40, fontSize: 13 }} />
              ))}
            </Tabs>
          }
          action={
            <TextField
              size="small"
              placeholder="Search recipient / subject…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              sx={{ width: 260, "& .MuiInputBase-root": { fontSize: 13 } }}
              InputProps={{ startAdornment: <Search sx={{ fontSize: 16, mr: 0.5, color: "text.secondary" }} /> }}
            />
          }
        />
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: 12, bgcolor: "#F8FAFC" } }}>
                <TableCell>Status</TableCell>
                <TableCell>Event</TableCell>
                <TableCell>Recipient</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Attempts</TableCell>
                <TableCell>Sent at</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} sx={{ textAlign: "center", py: 6 }}><CircularProgress size={28} /></TableCell></TableRow>
              ) : !data || data.items.length === 0 ? (
                <TableRow><TableCell colSpan={7} sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
                  No emails yet — they appear here once transactional emails are sent.
                </TableCell></TableRow>
              ) : (
                data.items.map((row) => (
                  <TableRow key={row.id} hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
                    <TableCell>{statusChip(row.status)}</TableCell>
                    <TableCell>
                      <Chip label={row.event_label} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} sx={{ fontSize: 13 }}>{row.recipient}</Typography>
                      {row.recipient_name && (
                        <Typography variant="caption" color="text.secondary">{row.recipient_name}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 280 }}>
                      <Typography variant="body2" noWrap sx={{ fontSize: 13 }}>{row.subject}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={`${row.attempt_count}x`} size="small" sx={{ height: 20, fontSize: 11 }} />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, color: "text.secondary", whiteSpace: "nowrap" }}>
                      {row.sent_at ? new Date(row.sent_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View detail">
                        <IconButton size="small" onClick={() => openDetail(row.id)}><Visibility fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title={row.status === "FAILED" ? "Resend email" : "Resend to this address"}>
                        <IconButton size="small" color="primary" onClick={() => resend(row.id)} disabled={resending === row.id}>
                          {resending === row.id ? <CircularProgress size={14} /> : <Replay fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {data && data.total_pages > 1 && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <Pagination count={data.total_pages} page={page} onChange={(_, v) => setPage(v)} size="small" />
          </Box>
        )}
      </Paper>

      {/* Detail drawer */}
      <Drawer anchor="right" open={detailOpen} onClose={() => setDetailOpen(false)} PaperProps={{ sx: { width: 460, p: 3 } }}>
        {detail && (
          <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="h6" fontWeight={700}>Email detail</Typography>
              {statusChip(detail.status)}
            </Box>

            <Stack spacing={2}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Person sx={{ fontSize: 16, color: "text.secondary" }} />
                <Typography variant="body2">
                  <b>{detail.recipient}</b>
                  {detail.recipient_name ? ` (${detail.recipient_name})` : ""}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <EventNote sx={{ fontSize: 16, color: "text.secondary" }} />
                <Typography variant="body2">
                  <Chip label={detail.event_label} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                  {"  "}
                  <Typography component="span" variant="caption" color="text.secondary">
                    {detail.related_type ? `#${detail.related_type}:${detail.related_id}` : "no reference"}
                  </Typography>
                </Typography>
              </Box>
              <Typography variant="body2"><b>Subject:</b> {detail.subject}</Typography>
              <Typography variant="body2"><b>Attempts:</b> {detail.attempt_count}</Typography>
              <Typography variant="body2" color="text.secondary">
                <b>Created:</b> {detail.created_at ? new Date(detail.created_at).toLocaleString("en-IN") : "—"}
              </Typography>
              {detail.sent_at && (
                <Typography variant="body2" color="text.secondary">
                  <b>Sent:</b> {new Date(detail.sent_at).toLocaleString("en-IN")}
                </Typography>
              )}

              {detail.status === "FAILED" && detail.error_message && (
                <Alert severity="error" sx={{ fontSize: 12 }}>
                  <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 700 }}>Error</Typography>
                  <Typography variant="body2" sx={{ fontSize: 12, wordBreak: "break-word" }}>{detail.error_message}</Typography>
                </Alert>
              )}

              {detail.payload && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Render payload</Typography>
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "#F8FAFC", maxHeight: 260, overflow: "auto" }}>
                    <Typography component="pre" sx={{ fontSize: 11, m: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {JSON.stringify(detail.payload, null, 2)}
                    </Typography>
                  </Paper>
                </Box>
              )}

              {detail.status === "FAILED" && (
                <Alert severity="info" sx={{ fontSize: 12 }}>
                  Tip: fix the SMTP config under <b>Settings → Email</b>, or fix the recipient
                  address, then resend.
                </Alert>
              )}
            </Stack>

            <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
              <Button variant="contained" startIcon={<Replay />} onClick={() => resend(detail.id)} disabled={resending === detail.id}>
                {resending === detail.id ? "Resending…" : "Resend email"}
              </Button>
              <Button variant="outlined" onClick={() => setDetailOpen(false)}>Close</Button>
            </Stack>
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
