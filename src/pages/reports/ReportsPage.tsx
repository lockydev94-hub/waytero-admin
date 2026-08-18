// ============================================================
// WAYTERO ADMIN — REPORTS PAGE (Full Implementation)
// Doc Ref: 14_Reporting_Business_Intelligence/
//          04_FINANCIAL_REPORTING.md
//          05_CUSTOMER_ANALYTICS.md
//          07_PARTNER_ANALYTICS.md
//
// Tabs:
//   1. Bookings       — Completed/settled booking records
//   2. GST            — Monthly GST breakdown + challan generation
//   3. TDS            — TDS for B2B company partners
//   4. Partner Report — Per-partner breakdown + PDF/Excel export
//   5. Customer Report — Advanced filtered customer records
// ============================================================

import { useState } from "react";
import {
  Box, Typography, Tab, Tabs, Paper, Stack, alpha, useTheme, Chip,
} from "@mui/material";
import {
  ConfirmationNumber, Receipt, Business, Handshake, Person,
  BarChart,
} from "@mui/icons-material";
import BookingsTab from "./components/BookingsTab";
import GstTab from "./components/GstTab";
import TdsTab from "./components/TdsTab";
import PartnerReportTab from "./components/PartnerReportTab";
import CustomerReportTab from "./components/CustomerReportTab";

interface TabConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
  chip?: string;
  component: React.ReactNode;
}

const TABS: TabConfig[] = [
  { key: "bookings", label: "Booking Reports",    icon: <ConfirmationNumber fontSize="small" />, component: <BookingsTab /> },
  { key: "gst",      label: "GST Reports",        icon: <Receipt fontSize="small" />,            chip: "Tax",    component: <GstTab /> },
  { key: "tds",      label: "TDS Reports",        icon: <Business fontSize="small" />,           chip: "B2B",    component: <TdsTab /> },
  { key: "partner",  label: "Partner Report",     icon: <Handshake fontSize="small" />,          component: <PartnerReportTab /> },
  { key: "customer", label: "Customer Report",    icon: <Person fontSize="small" />,             component: <CustomerReportTab /> },
];

export default function ReportsPage() {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" gap={1.5} mb={0.5}>
          <Box sx={{
            p: 1, borderRadius: 2,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)}, ${alpha(theme.palette.secondary.main, 0.1)})`,
          }}>
            <BarChart sx={{ color: theme.palette.primary.main, fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700} color="text.primary">Reports & Analytics</Typography>
            <Typography variant="body2" color="text.secondary">
              Booking analytics, GST & TDS compliance, partner and customer intelligence
            </Typography>
          </Box>
        </Stack>
      </Box>

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
              "&.Mui-selected": {
                color: theme.palette.primary.main,
              },
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
    </Box>
  );
}
