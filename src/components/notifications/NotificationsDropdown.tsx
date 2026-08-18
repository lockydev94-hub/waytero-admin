// ============================================================
// WAYTERO ADMIN PORTAL — NOTIFICATIONS DROPDOWN
// Doc Ref: BRD Part 7 §155 — Realtime inbox
//
// Bell icon in the topbar. Shows unread badge, opens a dropdown
// with the latest inbox items, and surfaces partner accept/reject
// events in real time. The dropdown mounts its own WebSocket
// subscriber so it works on any page — even ones that don't pull
// in the admin realtime hook.
// ============================================================

import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  Box, IconButton, Tooltip, Menu, MenuItem, Typography,
  Stack, Chip, Badge, Divider, Button, CircularProgress, alpha,
} from "@mui/material";
import {
  NotificationsNone, Circle, CheckCircle, HourglassTop,
  Block, AssignmentInd, DoneAll,
} from "@mui/icons-material";
import { notificationService, type NotificationItem } from "../../services/notification.service";
import { useRealtime } from "../../hooks/useRealtime";

const ICONS: Record<string, JSX.Element> = {
  PARTNER_ASSIGNMENT_REQUESTED: <HourglassTop sx={{ fontSize: 16, color: "#F59E0B" }} />,
  BOOKING_PARTNER_RESPONDED: <AssignmentInd sx={{ fontSize: 16, color: "#3B82F6" }} />,
  BOOKING_ADMIN_REFRESH: <CheckCircle sx={{ fontSize: 16, color: "#10B981" }} />,
};

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  } catch {
    return "";
  }
}

export default function NotificationsDropdown() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  // Mount a WS subscriber for inbox invalidation. The connection is
  // shared globally via the singleton manager on the backend so this
  // is cheap (a few bytes/sec of keepalive).
  const { subscribe } = useRealtime({ reconnectOnFocus: true });
  const [bumpVersion, setBumpVersion] = useState(0);

  useEffect(() => {
    const off = subscribe("BOOKING_PARTNER_RESPONDED", () => {
      setBumpVersion((v) => v + 1);
    });
    return off;
  }, [subscribe]);

  const inboxQuery = useQuery({
    queryKey: ["admin-notifications", bumpVersion],
    queryFn: () => notificationService.list({ limit: 10, offset: 0 }),
    enabled: open || bumpVersion > 0,
    staleTime: 10_000,
  });

  const unreadQuery = useQuery({
    queryKey: ["admin-notifications-unread", bumpVersion],
    queryFn: () => notificationService.unreadCount(),
    refetchInterval: 60_000,
  });

  const items: NotificationItem[] = useMemo(() => inboxQuery.data?.items ?? [], [inboxQuery.data]);

  const markAllRead = async () => {
    try {
      const res = await notificationService.markAllRead();
      enqueueSnackbar(`${res.marked} marked as read`, { variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin-notifications"] });
      qc.invalidateQueries({ queryKey: ["admin-notifications-unread"] });
    } catch {
      enqueueSnackbar("Failed to mark all read", { variant: "error" });
    }
  };

  const markRead = async (id: number) => {
    try {
      await notificationService.markRead(id);
      qc.invalidateQueries({ queryKey: ["admin-notifications"] });
      qc.invalidateQueries({ queryKey: ["admin-notifications-unread"] });
    } catch {
      /* ignore */
    }
  };

  const onItemClick = (n: NotificationItem) => {
    if (!n.read_at) markRead(n.id);
    if (n.booking_id && (n.data as any)?.master_booking_id) {
      const mbId = (n.data as any).master_booking_id;
      navigate(`/bookings/${mbId}`);
      setAnchorEl(null);
    } else if (n.booking_id) {
      navigate(`/bookings/${n.booking_id}`);
      setAnchorEl(null);
    }
  };

  const unreadCount = unreadQuery.data ?? inboxQuery.data?.unread_count ?? 0;

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          size="small"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{ color: "inherit" }}
        >
          <Badge
            badgeContent={unreadCount}
            color="error"
            sx={{
              "& .MuiBadge-badge": {
                fontSize: "0.62rem", height: 16, minWidth: 16, px: 0.5,
                fontWeight: 800,
              },
            }}
          >
            <NotificationsNone fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1, borderRadius: 2.5, width: 360,
              boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
            },
          },
        }}
      >
        {/* Header */}
        <Box sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: "divider" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>
                Notifications
              </Typography>
              <Typography sx={{ fontSize: "0.7rem", color: "text.secondary" }}>
                {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
              </Typography>
            </Box>
            {unreadCount > 0 && (
              <Tooltip title="Mark all as read">
                <IconButton
                  size="small"
                  onClick={markAllRead}
                  color="primary"
                >
                  <DoneAll sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Box>

        {/* List */}
        <Box sx={{ maxHeight: 420, overflowY: "auto" }}>
          {inboxQuery.isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={20} />
            </Box>
          ) : items.length === 0 ? (
            <Box sx={{ py: 4, textAlign: "center", px: 2 }}>
              <NotificationsNone sx={{ fontSize: 36, color: "text.disabled", mb: 1 }} />
              <Typography sx={{ fontSize: "0.82rem", color: "text.secondary", mb: 0.5 }}>
                No notifications yet
              </Typography>
              <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
                Partner accept / reject events will appear here in real time.
              </Typography>
            </Box>
          ) : (
            items.map((n) => {
              const unread = !n.read_at;
              return (
                <MenuItem
                  key={n.id}
                  onClick={() => onItemClick(n)}
                  sx={{
                    alignItems: "flex-start",
                    px: 2, py: 1.5, gap: 1.5,
                    borderBottom: 1, borderColor: "divider",
                    bgcolor: unread ? alpha("#3B82F6", 0.04) : "transparent",
                    whiteSpace: "normal",
                    "&:hover": { bgcolor: alpha("#3B82F6", 0.08) },
                  }}
                >
                  <Box sx={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0, mt: 0.25,
                    bgcolor: "action.hover", display: "flex",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    {ICONS[n.event_type] ?? (
                      <NotificationsNone sx={{ fontSize: 14, color: "text.secondary" }} />
                    )}
                  </Box>
                  <Box flex={1} minWidth={0}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      {unread && (
                        <Circle sx={{ fontSize: 8, color: "primary.main", flexShrink: 0 }} />
                      )}
                      <Typography
                        sx={{
                          fontSize: "0.82rem",
                          fontWeight: unread ? 700 : 500,
                          lineHeight: 1.3,
                        }}
                        noWrap
                      >
                        {n.title}
                      </Typography>
                    </Stack>
                    {n.body && (
                      <Typography
                        sx={{
                          fontSize: "0.72rem", color: "text.secondary", mt: 0.25,
                          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {n.body}
                      </Typography>
                    )}
                    <Stack direction="row" alignItems="center" spacing={0.5} mt={0.5}>
                      <Typography sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
                        {relativeTime(n.created_at)}
                      </Typography>
                      {n.delivered_via && n.delivered_via !== "none" && (
                        <Chip
                          label={n.delivered_via.toUpperCase()}
                          size="small"
                          sx={{
                            height: 14, fontSize: "0.55rem", fontWeight: 700,
                            bgcolor: alpha("#10B981", 0.12),
                            color: "#059669",
                            "& .MuiChip-label": { px: 0.6 },
                          }}
                        />
                      )}
                    </Stack>
                  </Box>
                </MenuItem>
              );
            })
          )}
        </Box>

        <Divider />
        <MenuItem
          onClick={() => setAnchorEl(null)}
          sx={{ fontSize: "0.8rem", justifyContent: "center", color: "primary.main", fontWeight: 600, py: 1.25 }}
        >
          Close
        </MenuItem>
      </Menu>
    </>
  );
}
