// ============================================================
// WAYTERO ADMIN — NOTICES PAGE
// Publish admin → partner notices (wallet low balance, driver-
// assign pending, document expiry, policy updates…) to all
// partners or a single partner. Partners see them as a banner at
// the top of their portal; dismissals are per-partner and tracked
// here as read %.
// ============================================================
import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Card, CardContent, CardHeader, Tabs, Tab, Table,
  TableHead, TableRow, TableCell, TableBody, TableContainer, Paper,
  IconButton, Chip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Select, InputLabel, FormControl,
  Tooltip, CircularProgress, Alert, Stack, Pagination, Grid, Switch,
  FormControlLabel,
} from "@mui/material";
import {
  Add, Archive, Refresh, Campaign, NotificationsActive, WarningAmber,
  Info, ErrorOutline, Person, Groups,
} from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { noticesService, NOTICE_TYPES, NoticeItem, NoticeStats } from "../../services/notices.service";
import { partnerService, AdminPartnerListItem } from "../../services/partner.service";

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "ARCHIVED", label: "Archived" },
];

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "#DC2626",
  HIGH: "#D97706",
  NORMAL: "#2563EB",
};

export default function NoticesPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState(0);
  const [data, setData] = useState<{ total: number; page: number; total_pages: number; items: NoticeItem[] } | null>(null);
  const [stats, setStats] = useState<NoticeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [noticeType, setNoticeType] = useState("GENERAL_ANNOUNCEMENT");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [audience, setAudience] = useState("ALL_PARTNERS");
  const [partnerId, setPartnerId] = useState<number | "">("");
  const [partners, setPartners] = useState<AdminPartnerListItem[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(false);

  const status = STATUS_TABS[tab]?.key ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, st] = await Promise.all([
        noticesService.list({ status: status || undefined, page, page_size: 20 }),
        noticesService.stats(),
      ]);
      setData(list);
      setStats(st);
    } catch {
      enqueueSnackbar("Failed to load notices", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [status, page, enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);

  const loadPartners = async () => {
    setPartnersLoading(true);
    try {
      const res = await partnerService.list({ page: 1, page_size: 100 });
      setPartners(res.items);
    } catch {
      enqueueSnackbar("Failed to load partners", { variant: "error" });
    } finally {
      setPartnersLoading(false);
    }
  };

  const openCreate = () => {
    setCreateOpen(true);
    setNoticeType("GENERAL_ANNOUNCEMENT");
    setTitle("");
    setBody("");
    setPriority("NORMAL");
    setAudience("ALL_PARTNERS");
    setPartnerId("");
    if (partners.length === 0) loadPartners();
  };

  const create = async () => {
    if (!title.trim()) {
      enqueueSnackbar("Enter a notice title", { variant: "warning" });
      return;
    }
    if (audience === "PARTNER" && !partnerId) {
      enqueueSnackbar("Select a partner for targeted notices", { variant: "warning" });
      return;
    }
    setCreating(true);
    try {
      await noticesService.create({
        notice_type: noticeType,
        title: title.trim(),
        body: body.trim() || undefined,
        priority,
        audience,
        partner_id: audience === "PARTNER" ? Number(partnerId) : null,
      });
      enqueueSnackbar("Notice published — partners will see it at the top of their portal", { variant: "success" });
      setCreateOpen(false);
      load();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.message || "Publish failed", { variant: "error" });
    } finally {
      setCreating(false);
    }
  };

  const archive = async (id: number) => {
    try {
      await noticesService.archive(id);
      enqueueSnackbar("Notice archived", { variant: "success" });
      load();
    } catch {
      enqueueSnackbar("Archive failed", { variant: "error" });
    }
  };

  const typeLabel = (code: string) =>
    NOTICE_TYPES.find((t) => t.code === code)?.label ?? code;

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Partner Notices</Typography>
          <Typography variant="body2" color="text.secondary">
            Publish alerts to partners — wallet low balance, driver-assign pending, document expiry, policy updates
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={load}>Refresh</Button>
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>New Notice</Button>
        </Stack>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: "Active notices", value: stats?.active ?? 0, color: "primary", icon: <NotificationsActive /> },
          { label: "Archived", value: stats?.archived ?? 0, color: "default", icon: <Archive /> },
          { label: "Total published", value: stats?.total ?? 0, color: "success", icon: <Campaign /> },
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
        />
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: 12, bgcolor: "#F8FAFC" } }}>
                <TableCell>Notice</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Audience</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Reads</TableCell>
                <TableCell>Published</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} sx={{ textAlign: "center", py: 6 }}><CircularProgress size={28} /></TableCell></TableRow>
              ) : !data || data.items.length === 0 ? (
                <TableRow><TableCell colSpan={7} sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
                  No notices published yet — create one with "New Notice".
                </TableCell></TableRow>
              ) : (
                data.items.map((n) => (
                  <TableRow key={n.id} hover sx={{ "&:last-child td": { borderBottom: 0 }, opacity: n.status === "ARCHIVED" ? 0.6 : 1 }}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} sx={{ fontSize: 13 }}>{n.title}</Typography>
                      {n.body && (
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", maxWidth: 320 }}>
                          {n.body}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={typeLabel(n.notice_type)} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                    </TableCell>
                    <TableCell>
                      {n.audience === "ALL_PARTNERS" ? (
                        <Chip icon={<Groups sx={{ fontSize: 13 }} />} label="All partners" size="small" sx={{ height: 20, fontSize: 11 }} />
                      ) : (
                        <Chip icon={<Person sx={{ fontSize: 13 }} />} label={n.partner_name ?? `Partner #${n.partner_id}`} size="small" sx={{ height: 20, fontSize: 11 }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={n.priority}
                        size="small"
                        sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: `${PRIORITY_COLOR[n.priority]}18`, color: PRIORITY_COLOR[n.priority] }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: 12 }}>
                        {n.reads} seen
                      </Typography>
                      <Box sx={{ width: 70, mt: 0.5 }}>
                        <Box sx={{ height: 4, borderRadius: 2, bgcolor: "#EEF2F7" }}>
                          <Box sx={{ height: 4, borderRadius: 2, bgcolor: "#2563EB", width: `${Math.min(100, n.read_pct)}%` }} />
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, color: "text.secondary", whiteSpace: "nowrap" }}>
                      {n.created_at ? new Date(n.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                    </TableCell>
                    <TableCell align="right">
                      {n.status === "ACTIVE" && (
                        <Tooltip title="Archive (hide from partners)">
                          <IconButton size="small" onClick={() => archive(n.id)}><Archive fontSize="small" /></IconButton>
                        </Tooltip>
                      )}
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

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
          <Campaign sx={{ color: "primary.main" }} /> Publish Partner Notice
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Notice type</InputLabel>
              <Select value={noticeType} label="Notice type" onChange={(e) => setNoticeType(e.target.value)}>
                {NOTICE_TYPES.map((t) => (
                  <MenuItem key={t.code} value={t.code}>
                    <Stack>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{t.label}</Typography>
                      <Typography sx={{ fontSize: 11, color: "text.secondary" }}>{t.desc}</Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Title"
              fullWidth
              size="small"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Your wallet balance is low — recharge to keep receiving trips"
            />
            <TextField
              label="Details"
              fullWidth
              size="small"
              multiline
              minRows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Full details partners will see when they open the notice…"
            />

            <FormControl fullWidth size="small">
              <InputLabel>Priority</InputLabel>
              <Select value={priority} label="Priority" onChange={(e) => setPriority(e.target.value)}>
                <MenuItem value="NORMAL">Normal</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
                <MenuItem value="URGENT">Urgent</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={audience === "PARTNER"}
                  onChange={(e) => setAudience(e.target.checked ? "PARTNER" : "ALL_PARTNERS")}
                />
              }
              label={audience === "ALL_PARTNERS" ? "Send to all partners" : "Send to a single partner"}
            />

            {audience === "PARTNER" && (
              <FormControl fullWidth size="small">
                <InputLabel>Partner</InputLabel>
                <Select
                  value={partnerId}
                  label="Partner"
                  onChange={(e) => setPartnerId(Number(e.target.value))}
                  disabled={partnersLoading}
                >
                  {partners.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.business_name || p.partner_code || `Partner #${p.id}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Alert severity="info" sx={{ fontSize: 12 }}>
              Partners see active notices as a banner at the top of their portal. Dismissals
              are per-partner — the "Reads" column shows how many partners have seen it.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<Campaign />} onClick={create} disabled={creating}>
            {creating ? "Publishing…" : "Publish Notice"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
