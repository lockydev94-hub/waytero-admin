// ============================================================
// WAYTERO ADMIN — REPORTS SUMMARY CARD
// ============================================================
import { Box, Card, CardContent, Typography, Skeleton, Avatar, alpha } from "@mui/material";

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}

export default function SummaryCard({ label, value, sub, icon, color, loading }: Props) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Box flex={1}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}
              sx={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {label}
            </Typography>
            {loading ? (
              <Skeleton variant="text" width={90} height={44} />
            ) : (
              <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5, lineHeight: 1, color }}>
                {value}
              </Typography>
            )}
            {sub && !loading && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                {sub}
              </Typography>
            )}
          </Box>
          <Avatar sx={{ bgcolor: alpha(color, 0.12), width: 44, height: 44, flexShrink: 0 }}>
            <Box sx={{ color }}>{icon}</Box>
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );
}
