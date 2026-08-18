// ============================================================
// WAYTERO ADMIN — TAX & GST PAGE
// Route: /tax-gst
//
// Report-style page mirroring the Reports page layout. When the
// platform-level GST_ENABLED config is OFF every tab shows the
// "GST is not enabled" state (the admin must enable it from
// Settings → Platform → Tax/GST Configuration first). When it is
// ON the GST report, TDS report and configuration data load.
//
// Doc Ref: BRD §155 GST Integration | 14_Reporting_Business_Intelligence/04_FINANCIAL_REPORTING.md
// ============================================================
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Tab, Tabs, Paper, Stack, alpha, useTheme, Chip,
  Button, CardContent, Grid, Divider, CircularProgress,
} from "@mui/material";
import {
  Receipt, Business, TuneOutlined, Gavel, ArrowForward,
} from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { useGstEnabled } from "../../hooks/useGstEnabled";
import { settingsService, SystemConfig } from "../../services/settings.service";
import GstTab from "../reports/components/GstTab";
import TdsTab from "../reports/components/TdsTab";

const fmtPct = (v: string | null | undefined, fallback = "—") =>
  v && v.trim() !== "" ? `${v}%` : fallback;

function GstNotEnabledState() {
  const theme = useTheme();
  const navigate = useNavigate();
  return (
    <Paper sx={{ borderRadius: 3, border: `1px dashed ${theme.palette.warning.main}`, p: 6, textAlign: "center" }}>
      <Box sx={{
        width: 72, height: 72, mx: "auto", mb: 2, borderRadius: 3,
        background: alpha(theme.palette.warning.main, 0.1),
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Receipt sx={{ fontSize: 36, color: theme.palette.warning.main }} />
      </Box>
      <Typography variant="h6" fontWeight={800}>GST is not enabled</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460, mx: "auto", mt: 1 }}>
        Tax & GST reporting is currently turned off on the platform. No GST is
        charged on bookings, so no tax reports or challans are available.
        Enable <strong>GST</strong> from Settings → Platform → Tax/GST Configuration
        to start collecting tax and unlock these reports.
      </Typography>
      <Button
        variant="contained"
        startIcon={<TuneOutlined />}
        endIcon={<ArrowForward />}
        onClick={() => navigate("/settings")}
        sx={{ mt: 3, borderRadius: 2, textTransform: "none", fontWeight: 700 }}
      >
        Open Tax Settings
      </Button>
    </Paper>
  );
}

function ConfigTab() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery<SystemConfig[]>({
    queryKey: ["admin-gst-enabled"],
    queryFn: () => settingsService.getConfigurations(),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;
  }

  const map: Record<string, string> = {};
  (data ?? []).forEach((c) => { map[c.config_key] = c.config_value ?? ""; });

  const gstEnabled = (map["GST_ENABLED"] ?? "false").toLowerCase() === "true";

  const rows = [
    { key: "GST_ENABLED", label: "GST Enabled", value: gstEnabled ? "Yes — GST is charged on bookings" : "No — bookings are non-tax receipts", mono: false },
    { key: "GST_RATE", label: "Customer GST Rate", value: fmtPct(map["GST_RATE"], "5% (default)"), mono: true },
    { key: "COMMISSION_GST_RATE", label: "Commission GST Rate", value: fmtPct(map["COMMISSION_GST_RATE"], "18% (default)"), mono: true },
    { key: "GST_PERCENTAGE", label: "Legacy GST Percentage", value: fmtPct(map["GST_PERCENTAGE"]), mono: true },
  ];

  return (
    <Stack gap={2.5}>
      <Paper sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}`, overflow: "hidden" }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: `1px solid ${theme.palette.divider}`, bgcolor: "background.paper" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
            <Stack direction="row" alignItems="center" gap={1}>
              <TuneOutlined fontSize="small" color="primary" />
              <Typography variant="subtitle2" fontWeight={700}>Current GST Configuration</Typography>
            </Stack>
            <Button
              size="small" variant="outlined"
              startIcon={<TuneOutlined fontSize="small" />}
              onClick={() => navigate("/settings")}
            >
              Manage in Settings
            </Button>
          </Stack>
        </Box>
        <CardContent sx={{ p: 2.5 }}>
          <Grid container spacing={2}>
            {rows.map((r) => (
              <Grid item xs={12} sm={6} key={r.key}>
                <Box sx={{
                  p: 1.75, borderRadius: 2,
                  bgcolor: alpha(theme.palette.action.hover, 0.5),
                  border: `1px solid ${theme.palette.divider}`,
                }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {r.label}
                  </Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ fontFamily: r.mono ? "monospace" : undefined }}>
                    {r.value}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          <Divider sx={{ my: 2 }} />
          <AlertBox />
        </CardContent>
      </Paper>
    </Stack>
  );
}

function AlertBox() {
  const theme = useTheme();
  return (
    <Box sx={{
      p: 1.75, borderRadius: 2,
      bgcolor: alpha(theme.palette.info.main, 0.06),
      border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
    }}>
      <Typography variant="body2" color="info.dark">
        <strong>GST Configuration:</strong> rates are edited in <strong>Settings → Platform → Tax/GST Configuration</strong>.
        Toggling GST there reloads the portal so the sidebar menu and these reports update immediately.
        GST applies to new trips after enabling — existing bookings keep the tax snapshot from their close time.
      </Typography>
    </Box>
  );
}

export default function TaxGstPage() {
  const theme = useTheme();
  const { isGstEnabled, isLoading } = useGstEnabled();
  const [activeTab, setActiveTab] = useState(0);

  const TABS = [
    { key: "gst", label: "GST Reports", icon: <Receipt fontSize="small" />, chip: "Tax", component: <GstTab /> },
    { key: "tds", label: "TDS Reports", icon: <Business fontSize="small" />, chip: "B2B", component: <TdsTab /> },
    { key: "config", label: "Configuration", icon: <TuneOutlined fontSize="small" />, component: <ConfigTab /> },
  ];

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" gap={1.5} mb={0.5}>
          <Box sx={{
            p: 1, borderRadius: 2,
            background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.15)}, ${alpha(theme.palette.secondary.main, 0.1)})`,
          }}>
            <Gavel sx={{ color: theme.palette.warning.main, fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700} color="text.primary">Tax & GST</Typography>
            <Typography variant="body2" color="text.secondary">
              GST & TDS compliance — monthly challans, returns and configuration
            </Typography>
          </Box>
        </Stack>
      </Box>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : !isGstEnabled ? (
        <GstNotEnabledState />
      ) : (
        <>
          {/* Tabs Navigation */}
          <Paper sx={{
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            mb: 2.5,
            overflow: "hidden",
          }}>
            <Tabs
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                minHeight: 52,
                borderBottom: `1px solid ${theme.palette.divider}`,
                bgcolor: "background.paper",
                "& .MuiTab-root": {
                  minHeight: 52,
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  textTransform: "none",
                  color: "text.secondary",
                  gap: 0.75,
                  px: 2.5,
                  "&.Mui-selected": { color: theme.palette.primary.main },
                },
                "& .MuiTabs-indicator": {
                  height: 3,
                  borderRadius: "3px 3px 0 0",
                  background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                },
              }}
            >
              {TABS.map((t, i) => (
                <Tab
                  key={t.key}
                  label={
                    <Stack direction="row" alignItems="center" gap={0.75}>
                      {t.icon}
                      <span>{t.label}</span>
                      {t.chip && (
                        <Chip
                          label={t.chip}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            bgcolor: i === activeTab
                              ? alpha(theme.palette.primary.main, 0.12)
                              : alpha(theme.palette.text.secondary, 0.08),
                            color: i === activeTab ? theme.palette.primary.main : "text.secondary",
                          }}
                        />
                      )}
                    </Stack>
                  }
                />
              ))}
            </Tabs>
          </Paper>

          {/* Tab Content */}
          <Box>
            {TABS[activeTab]?.component}
          </Box>
        </>
      )}
    </Box>
  );
}
