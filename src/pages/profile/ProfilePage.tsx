// ============================================================
// WAYTERO ADMIN — PROFILE PAGE
// Doc: Admin Portal §39 Security — the signed-in admin's own account.
//
// Everything here is about ONE account: the one holding the session. There is
// no user picker and no id in the URL — /auth/me and /auth/admin/* are
// subject-scoped by the JWT, which is what keeps this page safe to hand to
// every dashboard role.
//
// The "must set a PIN" banner exists because the lock is opt-in per account:
// with no PIN the shell can only log the admin out on idle (SessionManager
// picks the mode from `has_mpin`), so a new admin gets today's old behaviour
// until they install one.
// ============================================================
import { type ReactNode } from "react";
import {
  Alert, Box, Button, Card, CardContent, Divider, Grid, Stack, Tab, Tabs,
  Typography,
} from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock as LockIcon } from "@mui/icons-material";
import { useAuthStore } from "../../stores/authStore";
import { useLockStore } from "../../stores/lockStore";
import { MpinPanel } from "./MpinPanel";
import { IdleLockPanel } from "./IdleLockPanel";
import { MyHoursPanel } from "./MyHoursPanel";

const TABS = [
  { key: "identity", label: "Identity" },
  { key: "security", label: "Unlock PIN" },
  { key: "idle", label: "Idle lock" },
  { key: "hours", label: "My working hours" },
] as const;

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Grid item xs={12} sm={6}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ wordBreak: "break-word" }}>
        {value ?? "—"}
      </Typography>
    </Grid>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const config = useLockStore((s) => s.sessionConfig);
  const [params, setParams] = useSearchParams();
  // The tab lives in the URL so "My working hours" in the account menu can
  // deep-link straight to it.
  const tab = Math.max(
    0,
    TABS.findIndex((t) => t.key === params.get("tab"))
  );
  const selectTab = (index: number) => {
    const next = new URLSearchParams(params);
    next.set("tab", TABS[index].key);
    setParams(next, { replace: true });
  };
  const active = TABS[tab].key;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>My profile</Typography>
        <Typography variant="body2" color="text.secondary">
          Your own account, your unlock PIN and the hours this dashboard has
          recorded for you
        </Typography>
      </Box>

      {user?.must_set_mpin && (
        <Alert
          severity="info"
          icon={<LockIcon fontSize="small" />}
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button size="small" color="inherit" onClick={() => selectTab(1)}>
              Set one now
            </Button>
          }
        >
          You have no unlock PIN, so this dashboard signs you out when you go
          idle instead of locking. Set a PIN and inactivity becomes a lock you
          can open again in seconds.
        </Alert>
      )}

      <Card sx={{ borderRadius: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, i) => selectTab(i)}
          sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
          variant="scrollable"
          scrollButtons="auto"
        >
          {TABS.map((t) => (
            <Tab key={t.key} label={t.label} sx={{ textTransform: "none", fontWeight: 600 }} />
          ))}
        </Tabs>

        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          {active === "identity" && (
            <Box>
              <Grid container spacing={2.5}>
                <Row label="Name" value={user?.full_name} />
                <Row label="Account code" value={user?.user_code} />
                <Row label="Mobile" value={user?.mobile} />
                <Row label="Email" value={user?.email} />
                <Row
                  label="Role"
                  value={user?.user_type?.replace(/_/g, " ") ?? undefined}
                />
                <Row label="Status" value={user?.status} />
                <Row
                  label="Verified"
                  value={[
                    user?.is_mobile_verified ? "Mobile" : null,
                    user?.is_email_verified ? "Email" : null,
                  ]
                    .filter(Boolean)
                    .join(", ") || "None"}
                />
                <Row
                  label="Last sign-in"
                  value={
                    user?.last_login_at
                      ? new Date(user.last_login_at).toLocaleString()
                      : "This is your first recorded sign-in"
                  }
                />
              </Grid>

              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Dashboard session
              </Typography>
              <Grid container spacing={2.5}>
                <Row
                  label="Unlock PIN"
                  value={config ? (config.has_mpin ? "Set" : "Not set") : "Loading…"}
                />
                <Row
                  label="Locks after"
                  value={
                    config
                      ? `${config.idle_minutes} min of inactivity${
                          config.idle_lock_minutes === null
                          ? " (platform default)"
                          : ""
                        }`
                      : "—"
                  }
                />
                <Row
                  label="Daily sign-out"
                  value={
                    config
                      ? `${String(config.daily_logout_hour).padStart(2, "0")}:00 ${config.timezone}`
                      : "—"
                  }
                />
                <Row
                  label="Session ends"
                  value={
                    config?.session_expires_at
                      ? new Date(config.session_expires_at).toLocaleString()
                      : "—"
                  }
                />
              </Grid>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
                Everyone in the dashboard is signed out at the daily cut-off, so
                each working day starts fresh. Super admins set that hour in
                Settings.
              </Typography>
            </Box>
          )}

          {active === "security" && <MpinPanel />}
          {active === "idle" && <IdleLockPanel />}
          {active === "hours" && <MyHoursPanel />}
        </CardContent>
      </Card>

      <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
        <Button variant="outlined" onClick={() => navigate("/dashboard")}>
          Back to dashboard
        </Button>
      </Stack>
    </Box>
  );
}
