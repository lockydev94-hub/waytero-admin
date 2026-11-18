// ============================================================
// WAYTERO ADMIN — EMAIL TEMPLATES
// Every transactional email the platform can send, with the
// built-in default shown until an admin saves an override.
// Subject/body/CTA are editable; the logo, platform name and
// support footer always come from Platform settings.
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, CardHeader, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  FormControlLabel, Grid, IconButton, InputAdornment, MenuItem, Stack,
  Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from "@mui/material";
import {
  Add, Edit, MarkEmailRead, Refresh, RestartAlt, Save, Search, Visibility,
} from "@mui/icons-material";
import { useSnackbar } from "notistack";
import {
  emailService, EmailTemplate, EmailTemplateInput, EmailTemplatesResponse,
} from "../../services/email.service";

export default function EmailTemplatesPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [data, setData] = useState<EmailTemplatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState<EmailTemplateInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickCode, setPickCode] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await emailService.getTemplates());
    } catch {
      enqueueSnackbar("Failed to load email templates", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data?.items ?? [];
    return (data?.items ?? []).filter((t) =>
      [t.label, t.subject, t.event_type].some((v) => v.toLowerCase().includes(q))
    );
  }, [data, search]);

  const startEdit = (tpl: EmailTemplate) => {
    setEditing(tpl);
    setForm({
      label: tpl.label,
      subject: tpl.subject,
      heading: tpl.heading,
      body: tpl.body,
      cta_label: tpl.cta_label,
      cta_url: tpl.cta_url,
      tone: tpl.tone || "#1A56DB",
      is_active: tpl.is_active,
    });
  };

  const closeEditor = () => {
    if (saving) return;
    setEditing(null);
    setForm(null);
  };

  const set = <K extends keyof EmailTemplateInput>(key: K, value: EmailTemplateInput[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = async () => {
    if (!editing || !form) return;
    if (!form.subject.trim()) {
      enqueueSnackbar("A subject is required", { variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      const saved = await emailService.saveTemplate(editing.event_type, form);
      enqueueSnackbar(`${saved.label} template saved`, { variant: "success" });
      setEditing(null);
      setForm(null);
      load();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.message || "Could not save the template", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const runPreview = async () => {
    if (!editing || !form) return;
    setPreviewing(true);
    try {
      setPreview(await emailService.previewTemplate(editing.event_type, form));
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.message || "Preview failed", { variant: "error" });
    } finally {
      setPreviewing(false);
    }
  };

  const reset = async (tpl: EmailTemplate) => {
    if (!window.confirm(`Reset "${tpl.label}" to the built-in WayTero template?`)) return;
    setResetting(tpl.event_type);
    try {
      const res = await emailService.resetTemplate(tpl.event_type);
      enqueueSnackbar(res.message || "Template reset", { variant: "success" });
      load();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.message || "Reset failed", { variant: "error" });
    } finally {
      setResetting(null);
    }
  };

  const confirmPick = () => {
    const tpl = data?.items.find((t) => t.event_type === pickCode);
    setPickOpen(false);
    if (tpl) startEdit(tpl);
  };

  const branding = data?.branding;

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Email Templates</Typography>
          <Typography variant="body2" color="text.secondary">
            Add or edit the subject and message for every transactional email. Sending still requires
            email to be enabled with working SMTP.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={load}>Refresh</Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              setPickCode(data?.items[0]?.event_type ?? "");
              setPickOpen(true);
            }}
            disabled={!data}
          >
            Add template
          </Button>
        </Stack>
      </Box>

      {/* Branding is never edited here — it is applied by the email engine. */}
      <Card sx={{ borderRadius: 2, mb: 3 }}>
        <CardHeader
          avatar={<MarkEmailRead sx={{ color: "primary.main" }} />}
          title="Branding is applied automatically"
          subheader="Logo, platform name, sender details and the support footer come from Platform settings on every send."
          action={<Chip label={branding?.platform_name ?? "WayTero"} size="small" variant="outlined" />}
        />
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center">
            {branding?.logo_url ? (
              <Box
                component="img"
                src={branding.logo_url}
                alt="Platform logo"
                sx={{ height: 42, maxWidth: 160, objectFit: "contain", bgcolor: "#F8FAFC", p: 0.5, borderRadius: 1 }}
              />
            ) : (
              <MarkEmailRead sx={{ fontSize: 38, color: "text.secondary" }} />
            )}
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>{branding?.platform_name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {branding?.support_email}{branding?.support_phone ? ` · ${branding.support_phone}` : ""}
                {branding?.web_url ? ` · ${branding.web_url}` : ""}
              </Typography>
            </Box>
          </Stack>
          <Alert severity="info" sx={{ mt: 2, fontSize: 13 }}>
            Templates only control the words. Placeholders like{" "}
            {["{name}", "{service}", "{booking_number}", "{amount}", "{web_url}"].map((p) => (
              <Box component="code" key={p} sx={{ mx: 0.4, px: 0.5, bgcolor: "rgba(0,0,0,0.06)", borderRadius: 0.5 }}>{p}</Box>
            ))}
            are replaced at send time. A blank body keeps the built-in message.
          </Alert>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 2 }}>
        <CardHeader
          title="All email events"
          subheader={`${items.length} template${items.length === 1 ? "" : "s"} · a saved template overrides the built-in copy`}
          action={
            <TextField
              size="small"
              placeholder="Search name, subject or event…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ width: 280, "& .MuiInputBase-root": { fontSize: 13 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ fontSize: 16 }} />
                  </InputAdornment>
                ),
              }}
            />
          }
        />
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: 12, bgcolor: "#F8FAFC" } }}>
                <TableCell>Template</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Copy</TableCell>
                <TableCell>Sending</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: "center", py: 6 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
                    No templates match this search.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((tpl) => (
                  <TableRow key={tpl.event_type} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700} sx={{ fontSize: 13 }}>{tpl.label}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                        {tpl.event_type}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 300 }}>
                      <Typography variant="body2" noWrap sx={{ fontSize: 13 }}>{tpl.subject}</Typography>
                      {tpl.heading && (
                        <Typography variant="caption" color="text.secondary" noWrap>{tpl.heading}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={tpl.is_custom ? "Customised" : "Built-in"}
                        color={tpl.is_custom ? "primary" : "default"}
                        variant={tpl.is_custom ? "filled" : "outlined"}
                        sx={{ height: 22, fontSize: 11 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={tpl.is_active ? "On" : "Off"}
                        color={tpl.is_active ? "success" : "default"}
                        sx={{ height: 22, fontSize: 11 }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, color: "text.secondary", whiteSpace: "nowrap" }}>
                      {tpl.updated_at
                        ? new Date(tpl.updated_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                        : "Default"}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <Tooltip title="Edit template">
                        <IconButton size="small" onClick={() => startEdit(tpl)}><Edit fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Reset to built-in">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => reset(tpl)}
                            disabled={!tpl.is_custom || resetting === tpl.event_type}
                          >
                            {resetting === tpl.event_type ? <CircularProgress size={14} /> : <RestartAlt fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Add: pick an event, then open the same editor used for edit. */}
      <Dialog open={pickOpen} onClose={() => setPickOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add a template</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Every event already has a working built-in email. Pick one to customise its words.
          </Typography>
          <TextField select fullWidth label="Email event" value={pickCode} onChange={(e) => setPickCode(e.target.value)}>
            {(data?.items ?? []).map((tpl) => (
              <MenuItem key={tpl.event_type} value={tpl.event_type}>
                {tpl.label}{tpl.is_custom ? " (customised)" : ""}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPickOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={confirmPick} disabled={!pickCode}>Continue</Button>
        </DialogActions>
      </Dialog>

      {/* Editor */}
      <Dialog open={Boolean(editing && form)} onClose={closeEditor} maxWidth="md" fullWidth>
        {editing && form && (
          <>
            <DialogTitle>
              Edit email — {editing.label}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontFamily: "monospace" }}>
                {editing.event_type}
              </Typography>
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Template name"
                    fullWidth
                    size="small"
                    value={form.label ?? ""}
                    onChange={(e) => set("label", e.target.value)}
                    helperText="Shown in this list and in Email Logs."
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.is_active}
                        onChange={(e) => set("is_active", e.target.checked)}
                      />
                    }
                    label={form.is_active ? "Send this email" : "Do not send this email"}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Subject"
                    fullWidth
                    size="small"
                    required
                    value={form.subject}
                    onChange={(e) => set("subject", e.target.value)}
                    helperText="Plain text. Placeholders are allowed, e.g. “Your booking {booking_number} is confirmed”."
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Heading"
                    fullWidth
                    size="small"
                    value={form.heading ?? ""}
                    onChange={(e) => set("heading", e.target.value)}
                    helperText="Large title inside the email. Blank uses the subject."
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Message"
                    fullWidth
                    multiline
                    minRows={6}
                    value={form.body ?? ""}
                    onChange={(e) => set("body", e.target.value)}
                    helperText="Blank line starts a new paragraph. Blank message keeps the built-in copy. Placeholders: {name}, {service}, {booking_number}, {amount}, {wallet_type}, {ticket_number}, {status_label}, {web_url}."
                  />
                </Grid>
                <Grid item xs={12} sm={5}>
                  <TextField
                    label="Button label"
                    fullWidth
                    size="small"
                    value={form.cta_label ?? ""}
                    onChange={(e) => set("cta_label", e.target.value)}
                    helperText="Blank hides the button."
                  />
                </Grid>
                <Grid item xs={12} sm={5}>
                  <TextField
                    label="Button URL"
                    fullWidth
                    size="small"
                    value={form.cta_url ?? ""}
                    onChange={(e) => set("cta_url", e.target.value)}
                    helperText="Use {web_url}/bookings for the customer site."
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    label="Button colour"
                    type="color"
                    fullWidth
                    size="small"
                    value={form.tone || "#1A56DB"}
                    onChange={(e) => set("tone", e.target.value)}
                  />
                </Grid>
              </Grid>
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="text.secondary">
                Branding — logo, platform name and support footer — is added by the platform and cannot be
                edited here. Emails are only sent when email is enabled under Settings → Email and the
                customer has an address on file.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeEditor} disabled={saving}>Cancel</Button>
              <Button
                variant="outlined"
                startIcon={<Visibility />}
                onClick={runPreview}
                disabled={previewing || saving}
              >
                {previewing ? "Rendering…" : "Preview"}
              </Button>
              <Button variant="contained" startIcon={<Save />} onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save template"}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Preview */}
      <Dialog open={Boolean(preview)} onClose={() => setPreview(null)} maxWidth="md" fullWidth>
        <DialogTitle>Preview — {preview?.subject}</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {preview && (
            <Box
              component="iframe"
              title="Email preview"
              srcDoc={preview.html}
              sx={{ width: "100%", height: "70vh", border: 0, display: "block", bgcolor: "#F1F5F9" }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Typography variant="caption" color="text.secondary" sx={{ mr: "auto", pl: 1 }}>
            Sample data · live platform branding
          </Typography>
          <Button onClick={() => setPreview(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
