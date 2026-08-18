// ============================================================
// WAYTERO ADMIN — RATE PREVIEW CALENDAR
// Doc Ref: 03_FRONTEND_DESIGN.md §5 "Pricing" + §6
// Month grid — each cell shows resolved nightly rate tinted
// by the winning plan type. Legend below.
// ============================================================

import { useState } from "react";
import {
  Box, Typography, Stack, Chip, CircularProgress,
  IconButton, Tooltip, alpha, useTheme, Paper,
} from "@mui/material";
import { ChevronLeft, ChevronRight, Info } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";

import hotelService, { RoomCategory, RatePreviewNight } from "../../../services/hotel.service";
import { HOTEL_QUERY_KEYS, toIsoDate, inr, RATE_PLAN_TYPE_LABELS } from "../constants";

interface Props {
  hotelId: number;
  roomCategory: RoomCategory;
}

const PLAN_BG: Record<string, string> = {
  PROMOTIONAL: "#EFF6FF",
  WEEKEND: "#EEF2FF",
  SEASONAL: "#FFFBEB",
  FESTIVAL: "#F0FDF4",
  BASE: "#F8FAFC",
};
const PLAN_BORDER: Record<string, string> = {
  PROMOTIONAL: "#3B82F6",
  WEEKEND: "#6366F1",
  SEASONAL: "#F59E0B",
  FESTIVAL: "#10B981",
  BASE: "#E2E8F0",
};

function monthStart(y: number, m: number) {
  return new Date(y, m, 1);
}

export default function RatePreviewCalendar({ hotelId, roomCategory }: Props) {
  const theme = useTheme();
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const dateFrom = toIsoDate(monthStart(year, month));
  const dateTo = (() => {
    const last = new Date(year, month + 1, 0);
    return toIsoDate(last);
  })();

  const { data, isLoading } = useQuery({
    queryKey: [HOTEL_QUERY_KEYS.ratePreview, hotelId, roomCategory.id, dateFrom, dateTo],
    queryFn: () => hotelService.getRatePreview(hotelId, roomCategory.id, dateFrom, dateTo),
    staleTime: 5 * 60_000,
  });

  const nightMap: Record<string, RatePreviewNight> = {};
  (data?.nights ?? []).forEach((n) => { nightMap[n.date] = n; });

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  // Build calendar weeks
  const firstDay = monthStart(year, month);
  const startOffset = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const monthName = viewDate.toLocaleString("en-IN", { month: "long", year: "numeric" });
  const planTypes = [...new Set((data?.nights ?? []).map(n => n.source ?? "BASE"))];

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <IconButton size="small" onClick={prevMonth}><ChevronLeft /></IconButton>
          <Typography variant="subtitle2" fontWeight={700}>{monthName}</Typography>
          <IconButton size="small" onClick={nextMonth}><ChevronRight /></IconButton>
        </Stack>
        <Tooltip title="Shows the resolved nightly rate for each date, tinted by the winning rate plan">
          <Info sx={{ fontSize: 16, color: "text.secondary" }} />
        </Tooltip>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <>
          {/* Day headers */}
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", mb: 0.5 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <Typography key={d} variant="caption" fontWeight={700} color="text.secondary"
                sx={{ textAlign: "center", fontSize: 10, pb: 0.5 }}>
                {d}
              </Typography>
            ))}
          </Box>

          {/* Calendar grid */}
          {weeks.map((week, wi) => (
            <Box key={wi} sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.25, mb: 0.25 }}>
              {week.map((day, di) => {
                if (!day) return <Box key={di} sx={{ minHeight: 48 }} />;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const night = nightMap[dateStr];
                const planType = night?.source ?? "BASE";
                const rate = night?.rate ?? roomCategory.base_price ?? 0;
                const isToday = dateStr === toIsoDate(new Date());

                return (
                  <Paper
                    key={di}
                    elevation={0}
                    sx={{
                      minHeight: 48,
                      borderRadius: 1.5,
                      p: 0.5,
                      border: `1.5px solid ${isToday ? theme.palette.primary.main : PLAN_BORDER[planType] ?? "#E2E8F0"}`,
                      bgcolor: PLAN_BG[planType] ?? "#F8FAFC",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Typography
                      variant="caption"
                      fontWeight={isToday ? 800 : 500}
                      color={isToday ? "primary.main" : "text.secondary"}
                      sx={{ fontSize: 10 }}
                    >
                      {day}
                    </Typography>
                    <Typography variant="caption" fontWeight={700} sx={{ fontSize: 10, color: "text.primary" }}>
                      {inr(rate)}
                    </Typography>
                  </Paper>
                );
              })}
            </Box>
          ))}

          {/* Legend */}
          {planTypes.length > 0 && (
            <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1.5 }}>
              {planTypes.map(pt => (
                <Box key={pt} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Box sx={{
                    width: 12, height: 12, borderRadius: 0.5,
                    bgcolor: PLAN_BG[pt] ?? "#F8FAFC",
                    border: `1.5px solid ${PLAN_BORDER[pt] ?? "#E2E8F0"}`,
                  }} />
                  <Typography variant="caption" sx={{ fontSize: 10 }}>
                    {pt === "BASE" ? "Base rate" : RATE_PLAN_TYPE_LABELS[pt] ?? pt}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </>
      )}
    </Box>
  );
}
