// ============================================================
// WAYTERO ADMIN — AUDIT STATS BAR
// KPI strip for the audit page header.
// Doc Ref: Admin API §24
//          Matches the KPI strip pattern in pages/drivers/DriversPage.tsx
//          and pages/customer-care/components/CareStatsBar.tsx
// ============================================================

import { Card, CardContent, Grid, Skeleton, Stack, Typography, Box } from "@mui/material";
import {
  History,
  Today,
  DateRange,
  Group,
} from "@mui/icons-material";
import type { AuditLogSummary } from "../../../services/admin.service";

interface AuditStatsBarProps {
  summary: AuditLogSummary | undefined;
  isLoading: boolean;
}

interface KpiSpec {
  label: string;
  value: number | string;
  color: string;
  icon: React.ReactNode;
}

export default function AuditStatsBar({ summary, isLoading }: AuditStatsBarProps) {
  const kpis: KpiSpec[] = [
    {
      label: "Total Events",
      value: summary?.total ?? 0,
      color: "#667eea",
      icon: <History />,
    },
    {
      label: "Today",
      value: summary?.today ?? 0,
      color: "#11998e",
      icon: <Today />,
    },
    {
      label: "This Week",
      value: summary?.this_week ?? 0,
      color: "#f09819",
      icon: <DateRange />,
    },
    {
      label: "Active Users Today",
      value: summary?.unique_users_today ?? 0,
      color: "#e53e3e",
      icon: <Group />,
    },
  ];

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {kpis.map(({ label, value, color, icon }) => (
        <Grid item xs={6} sm={3} key={label}>
          <Card
            sx={{
              borderRadius: 3,
              background: "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.06)",
              transition: "transform 0.2s",
              "&:hover": { transform: "translateY(-2px)" },
            }}
          >
            <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  {isLoading ? (
                    <Skeleton width={64} height={36} />
                  ) : (
                    <Typography variant="h4" fontWeight={800} sx={{ color }}>
                      {value}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    {label}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: 2,
                    background: `${color}20`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color,
                  }}
                >
                  {icon}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
