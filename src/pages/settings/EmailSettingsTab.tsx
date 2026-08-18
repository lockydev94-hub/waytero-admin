// ============================================================
// WAYTERO ADMIN — EMAIL SETTINGS TAB
// SMTP config (saved to system_configurations), test send, and
// a status card linking to the Email Logs page.
// ============================================================
import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Card, CardContent, CardHeader, TextField, Switch,
  FormControlLabel, Button, Alert, AlertTitle, Chip, Grid, Divider,
  Stack, CircularProgress, Link as MuiLink,
} from "@mui/material";
import { Send, Save, Refresh, MarkEmailRead, Email, CheckCircle, ErrorOutline } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { emailService, EmailSettings } from "../../services/email.service";

interface Props {
  enqueueSnackbar: (msg: string, opts?: { variant?: "success" | "error" | "warning" | "info" }) => void;
}

export default function EmailSettingsTab({ enqueueSnackbar }: Props) {
  const navigate = useNavigate();
  const [form, setForm] = useState<EmailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await emailService.getSettings();
      setForm(data);
      setTestEmail(data.from_email || "");
    } catch {
      enqueueSnackbar("Failed to load email settings", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);

  const set = (key: keyof EmailSettings, value: string | boolean | number) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      // The settings GET returns the stored password MASKED as "********" —
      // never send that placeholder back, or the backend would persist it as
      // the real secret and every email would fail auth. Only send a password
      // when the admin actually typed a new one (backend keeps the old secret
      // when the field is omitted).
      const payload: {
        enabled: boolean; host: string; port: number; user: string;
        from_email: string; from_name: string; use_tls: boolean; password?: string;
      } = {
        enabled: form.enabled,
        host: form.host,
        port: form.port,
        user: form.user,
        from_email: form.from_email,
        from_name: form.from_name,
        use_tls: form.use_tls,
      };
      if (form.password && form.password !== "********") {
        payload.password = form.password;
      }
      const updated = await emailService.saveSettings(payload);
      setForm(updated);
      enqueueSnackbar(updated.enabled ? "Email enabled — transactional emails are live" : "Email settings saved (disabled)", { variant: "success" });
    } catch {
      enqueueSnackbar("Save failed — check the values", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testEmail.trim()) {
      enqueueSnackbar("Enter a recipient email for the test", { variant: "warning" });
      return;
    }
    setTesting(true);
    try {
      const res = await emailService.sendTest(testEmail.trim());
      enqueueSnackbar(res.message || "Test email sent", { variant: "success" });
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.message || "Test email failed — check SMTP config", { variant: "error" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!form) return null;

  return (
    <Box>
      <Grid container spacing={3}>
        {/* Left: configuration */}
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 2 }}>
            <CardHeader
              title="Email Configuration"
              subheader="SMTP credentials are stored in the database. Nothing is sent until enabled and configured."
              action={
                <Chip
                  icon={form.enabled ? <CheckCircle sx={{ fontSize: 14 }} /> : <ErrorOutline sx={{ fontSize: 14 }} />}
                  label={form.enabled ? (form.configured ? "Enabled & configured" : "Enabled — incomplete") : "Disabled"}
                  size="small"
                  color={form.enabled && form.configured ? "success" : form.enabled ? "warning" : "default"}
                />
              }
            />
            <CardContent>
              <FormControlLabel
                control={
                  <Switch checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} />
                }
                label={form.enabled ? "Send transactional emails" : "Emailing disabled"}
              />

              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={6}>
                  <TextField label="SMTP Host" fullWidth size="small" value={form.host}
                    onChange={(e) => set("host", e.target.value)}
                    placeholder="smtp.gmail.com" helperText="e.g. smtp.gmail.com / smtp.zoho.com / smtp.mailgun.org" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="SMTP Port" fullWidth size="small" type="number" value={form.port}
                    onChange={(e) => set("port", Number(e.target.value) || 587)}
                    helperText="587 (TLS) or 465 (SSL)" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="SMTP Username" fullWidth size="small" value={form.user}
                    onChange={(e) => set("user", e.target.value)}
                    placeholder="support@yourdomain.com" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="SMTP Password" fullWidth size="small" type="password"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    placeholder={form.password_set ? "•••••••• (leave blank to keep)" : "Enter password"}
                    helperText={form.password_set ? "A password is already stored — leave blank to keep it." : "Required to send."} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="From Email" fullWidth size="small" value={form.from_email}
                    onChange={(e) => set("from_email", e.target.value)} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="From Name" fullWidth size="small" value={form.from_name}
                    onChange={(e) => set("from_name", e.target.value)} />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Switch checked={form.use_tls} onChange={(e) => set("use_tls", e.target.checked)} />}
                    label="Use STARTTLS (port 587)"
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Stack direction="row" spacing={2}>
                <Button variant="contained" startIcon={<Save />} onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save Configuration"}
                </Button>
                <Button variant="outlined" startIcon={<Refresh />} onClick={load}>
                  Reload
                </Button>
              </Stack>

              <Alert severity="info" sx={{ mt: 3 }}>
                <AlertTitle>What happens after you save</AlertTitle>
                Bookings, invoices, payments, registrations, refunds, cancellations, wallet
                recharge and partner settlements automatically send branded emails to the
                customer / partner. Every attempt is recorded in <b>Email Logs</b>.
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Right: test + branding + logs shortcut */}
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 2, mb: 3 }}>
            <CardHeader title="Send Test Email" subheader="Verify the SMTP connection end-to-end" />
            <CardContent>
              <TextField label="Recipient email" fullWidth size="small" value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)} sx={{ mb: 2 }} />
              <Button variant="contained" color="secondary" startIcon={<Send />} fullWidth
                onClick={sendTest} disabled={testing || !form.enabled}>
                {testing ? "Sending…" : "Send Test Email"}
              </Button>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 2, mb: 3 }}>
            <CardHeader title="Branding" subheader="Used in every email (from Platform tab)" />
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1.5 }}>
                {form.logo_url ? (
                  <Box
                    component="img"
                    src={form.logo_url}
                    alt="logo"
                    sx={{ height: 40, borderRadius: 1, bgcolor: "#f5f5f5", p: 0.5 }}
                  />
                ) : (
                  <MarkEmailRead sx={{ fontSize: 40, color: "primary.main" }} />
                )}
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>{form.platform_name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {form.support_email}
                    {form.support_phone ? ` · ${form.support_phone}` : ""}
                  </Typography>
                </Box>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Emails are sent from <b>{form.from_name} &lt;{form.from_email}&gt;</b> with the
                platform logo and support details. Update logo / name / support info on the{" "}
                <b>Platform</b> tab.
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 2 }}>
            <CardHeader
              avatar={<Email sx={{ fontSize: 20, color: "primary.main" }} />}
              title="Email Logs"
              subheader="Delivery status of every transactional email"
              action={
                <MuiLink component="button" onClick={() => navigate("/email/logs")} sx={{ fontSize: 13 }}>
                  Open →
                </MuiLink>
              }
            />
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
