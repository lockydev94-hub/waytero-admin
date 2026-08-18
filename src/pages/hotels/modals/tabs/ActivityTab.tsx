// ============================================================
// HOTEL DETAIL — ACTIVITY TAB
// Doc Ref: 03_FRONTEND_DESIGN.md §5 — verification log timeline
// ============================================================
import React from "react";
import {
  Box, Typography, Stack, Chip, CircularProgress, alpha, useTheme,
} from "@mui/material";
import { HistoryOutlined, ArrowForward } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { hotelService, HotelDetail, HotelLog, HOTEL_STATUS_META } from "../../../../services/hotel.service";

interface Props { hotel: HotelDetail; }

const ACTION_COLORS: Record<string, any> = {
  CREATED: "primary", SUBMITTED: "info", ASSIGNED: "info",
  MOVED_TO_REVIEW: "info", APPROVED: "success", ACTIVATED: "success",
  REJECTED: "error", SUSPENDED: "warning", DOCUMENT_PENDING: "warning",
  OWN_RISK_APPROVED: "warning",
};

function LogItem({ log, last }: { log: HotelLog; last: boolean }) {
  const theme = useTheme();
  const fromMeta = log.from_status ? HOTEL_STATUS_META[log.from_status] : null;
  const toMeta = log.to_status ? HOTEL_STATUS_META[log.to_status] : null;
  const dotColor = ACTION_COLORS[log.action] ?? "grey";
  const dotBg =
    dotColor === "grey" ? theme.palette.grey[400] : (theme.palette as any)[dotColor]?.main ?? theme.palette.grey[400];

  return (
    <Stack direction="row" spacing={2}>
      <Stack alignItems="center" sx={{ pt: 0.5, minWidth: 12 }}>
        <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: dotBg, flexShrink: 0 }} />
        {!last && <Box sx={{ width: 2, flexGrow: 1, bgcolor: alpha(theme.palette.divider, 0.8), mt: 0.5 }} />}
      </Stack>
      <Box sx={{ pb: 2.5, flex: 1 }}>
        <Stack spacing={0.25}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="body2" fontWeight={700}>{log.action.replace(/_/g, " ")}</Typography>
            {fromMeta && toMeta && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Chip label={fromMeta.label} size="small" color={fromMeta.color} variant="outlined" sx={{ height: 18, fontSize: "0.6rem" }} />
                <ArrowForward sx={{ fontSize: 12, color: "text.secondary" }} />
                <Chip label={toMeta.label} size="small" color={toMeta.color} sx={{ height: 18, fontSize: "0.6rem" }} />
              </Stack>
            )}
          </Stack>
          {log.performed_by_name && <Typography variant="caption" color="text.secondary">by {log.performed_by_name}</Typography>}
          {log.remarks && <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>"{log.remarks}"</Typography>}
          <Typography variant="caption" color="text.disabled">{new Date(log.created_at).toLocaleString()}</Typography>
        </Stack>
      </Box>
    </Stack>
  );
}

export default function ActivityTab({ hotel }: Props) {
  const { data: logs = [], isLoading } = useQuery<HotelLog[]>({
    queryKey: ["hotel-activity", hotel.id],
    queryFn: () => hotelService.getLogs(hotel.id, 200),
    staleTime: 30_000,
  });

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", pt: 6 }}><CircularProgress /></Box>;
  if (!logs.length) return (
    <Box sx={{ textAlign: "center", py: 8, color: "text.disabled" }}>
      <HistoryOutlined sx={{ fontSize: 48, mb: 1 }} />
      <Typography>No activity recorded yet.</Typography>
    </Box>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
        Activity · {logs.length} event{logs.length !== 1 ? "s" : ""}
      </Typography>
      <Box>
        {logs.map((log, i) => <LogItem key={log.id} log={log} last={i === logs.length - 1} />)}
      </Box>
    </Box>
  );
}
