// ============================================================
// WAYTERO ADMIN — KPI CARD
// Doc Ref: 03_FRONTEND_DESIGN.md §3
// Copied from VehiclesPage KpiCard; palette-derived so dark mode holds.
// ============================================================
import { Avatar, Box, Card, CardContent, Stack, Typography, alpha, useTheme } from "@mui/material";
import type { ReactNode } from "react";

interface Props {
  label: string;
  value: number;
  color: "primary" | "secondary" | "success" | "warning" | "error" | "info";
  icon: ReactNode;
  onClick?: () => void;
  selected?: boolean;
}

export default function KpiCard({ label, value, color, icon, onClick, selected }: Props) {
  const theme = useTheme();
  const main = theme.palette[color].main;
  return (
    <Card
      variant="outlined"
      onClick={onClick}
      sx={{
        borderRadius: 2,
        height: "100%",
        border: `1px solid ${alpha(main, selected ? 0.6 : 0.2)}`,
        background: `linear-gradient(135deg, ${alpha(main, selected ? 0.14 : 0.06)} 0%, transparent 100%)`,
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 120ms, background 120ms",
        "&:hover": onClick ? { borderColor: alpha(main, 0.5) } : undefined,
      }}
    >
      <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{ bgcolor: alpha(main, 0.12), color: `${color}.main`, width: 40, height: 40 }}>
            {icon}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" fontWeight={800} color={`${color}.main`} lineHeight={1.2}>
              {value}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {label}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
