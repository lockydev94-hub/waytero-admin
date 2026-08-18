// ============================================================
// CUSTOMER CARE — STATS BAR COMPONENT
// ============================================================
import { Box, Card, CardContent, Typography, Skeleton, Stack, alpha, useTheme } from "@mui/material";
import {
  HeadsetMic, FiberNew, HourglassTop, CheckCircle, PriorityHigh, TodayOutlined,
} from "@mui/icons-material";
import type { CareStats } from "../../../services/customerCare.service";

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}

function StatCard({ label, value, icon, color, loading }: StatCardProps) {
  const theme = useTheme();
  return (
    <Card sx={{
      borderRadius: 3, border: "1px solid", borderColor: "divider",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      transition: "transform 0.15s, box-shadow 0.15s",
      "&:hover": { transform: "translateY(-2px)", boxShadow: "0 6px 24px rgba(0,0,0,0.1)" },
      flex: 1, minWidth: 130,
    }}>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={1.5}>
          <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: alpha(color, 0.12), color, display: "flex" }}>{icon}</Box>
        </Stack>
        {loading ? (
          <Skeleton width={50} height={38} />
        ) : (
          <Typography variant="h4" fontWeight={800} sx={{ color, lineHeight: 1.1 }}>
            {value.toLocaleString()}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ mt: 0.5, display: "block" }}>
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}

interface Props { stats: CareStats | undefined; loading: boolean; }

export default function CareStatsBar({ stats, loading }: Props) {
  const theme = useTheme();
  const cards = [
    { label: "Total Logs",     value: stats?.total ?? 0,            icon: <HeadsetMic />,    color: theme.palette.primary.main },
    { label: "Open",           value: stats?.open_count ?? 0,       icon: <FiberNew />,      color: "#F59E0B" },
    { label: "In Progress",    value: stats?.in_progress_count ?? 0,icon: <HourglassTop />,  color: "#3B82F6" },
    { label: "Resolved",       value: stats?.resolved_count ?? 0,   icon: <CheckCircle />,   color: "#22C55E" },
    { label: "Urgent",         value: stats?.urgent_count ?? 0,     icon: <PriorityHigh />,  color: "#EF4444" },
    { label: "Today",          value: stats?.today_count ?? 0,      icon: <TodayOutlined />, color: "#8B5CF6" },
  ];
  return (
    <Stack direction="row" gap={2} flexWrap="wrap">
      {cards.map(c => (
        <StatCard key={c.label} loading={loading} {...c} />
      ))}
    </Stack>
  );
}
