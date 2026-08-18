// ============================================================
// WAYTERO ADMIN PORTAL — REALTIME BOOKING ACCEPT MODAL
// Doc Ref: BRD Part 7 §155 — Realtime channel
//
// Mounted once in AdminLayout (only rendered while logged in).
//
// Behaviour:
//   - Subscribes to ADMIN_BOOKING_REQUESTED WS events — when a
//     customer books a cab / hotel / tour on the website the backend
//     fans the event out to every active admin user and this modal
//     pops up with a ringtone (public/sound/ringtone.mp3).
//   - On mount it pulls GET /admin/bookings/accept-queue, so bookings
//     that arrived while the admin was logged out are caught up and
//     shown in the same modal (the "hold for accept" requirement).
//   - Accept (per booking) or Accept All → POST /admin/bookings/{id}/accept.
//   - Once every pending booking is accepted the ringtone stops and
//     the admin is redirected to the Bookings page.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, Stack, Chip, IconButton, Alert,
  CircularProgress, List, ListItem, ListItemAvatar, Avatar, alpha, useTheme,
} from "@mui/material";
import {
  DirectionsCar, Hotel, Tour, CheckCircle, DoneAll, Close,
  NotificationsActive, Person, LocationOn, Event, Payments,
} from "@mui/icons-material";
import {
  bookingService,
  type AdminAcceptQueueItem,
} from "../../services/booking.service";
import { useRealtime, type WSMessage } from "../../hooks/useRealtime";
import {
  installAudioUnlocker, playRingtone, stopRingtone, showLocalNotification,
} from "../../utils/audio";

const SERVICE_META: Record<
  "CAB" | "HOTEL" | "TOUR",
  { label: string; icon: JSX.Element; color: string }
> = {
  CAB:   { label: "Cab",   icon: <DirectionsCar sx={{ fontSize: 20 }} />,   color: "#F59E0B" },
  HOTEL: { label: "Hotel", icon: <Hotel sx={{ fontSize: 20 }} />,           color: "#3B82F6" },
  TOUR:  { label: "Tour",  icon: <Tour sx={{ fontSize: 20 }} />,            color: "#8B5CF6" },
};

interface AdminBookingRequestedData {
  master_booking_id: number;
  service_type: "CAB" | "HOTEL" | "TOUR";
  booking_number: string;
  service_id?: number;
  // CAB
  pickup_location?: string;
  pickup_datetime?: string;
  trip_type?: string;
  // HOTEL
  hotel_name?: string;
  check_in_date?: string;
  check_out_date?: string;
  // TOUR
  package_name?: string;
  travel_start_date?: string;
  persons_count?: number;
  // all
  amount?: number;
}

function wsItemToQueueItem(data: AdminBookingRequestedData): AdminAcceptQueueItem {
  const st = data.service_type;
  const base = {
    master_booking_id: data.master_booking_id,
    master_booking_number: "",
    service_type: st,
    service_id: data.service_id ?? data.master_booking_id,
    service_number: data.booking_number,
    amount: data.amount ?? 0,
    customer_name: null,
    city_name: null,
    created_at: new Date().toISOString(),
  };
  if (st === "CAB") {
    return { ...base, headline: data.pickup_location ?? null, datetime: data.pickup_datetime ?? null };
  }
  if (st === "HOTEL") {
    return { ...base, headline: data.hotel_name ?? null, datetime: data.check_in_date ?? null };
  }
  return { ...base, headline: data.package_name ?? null, datetime: data.travel_start_date ?? null };
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function BookingAcceptModal() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [queue, setQueue] = useState<AdminAcceptQueueItem[]>([]);
  const [open, setOpen] = useState(false);
  const [accepting, setAccepting] = useState<Set<number>>(new Set());
  const [acceptingAll, setAcceptingAll] = useState(false);
  const loadedOnceRef = useRef(false);
  // Only redirect to /bookings when the ADMIN accepted the last booking.
  // If a partner resolves the queue (fixed-assignment hotel/tour), we close
  // the modal + stop the ringtone but don't yank the admin to /bookings.
  const adminAcceptedRef = useRef(false);

  const { subscribe } = useRealtime({ reconnectOnFocus: true });

  // Audio unlock on mount so the first booking can ring.
  useEffect(() => {
    const remove = installAudioUnlocker();
    return remove;
  }, []);

  const refreshQueue = useCallback(async (opts?: { openIfAny?: boolean }) => {
    try {
      const res = await bookingService.acceptQueue();
      const items = res?.items ?? [];
      setQueue(items);
      loadedOnceRef.current = true;
      if (opts?.openIfAny && items.length > 0) {
        setOpen(true);
        playRingtone().catch(() => { /* gesture retry is scheduled */ });
      }
    } catch {
      /* offline / not yet logged in — ignore, WS events still work */
    }
  }, []);

  // Catch-up: bookings that arrived while the admin was logged out
  // (or the WS was down) still need to surface on login.
  useEffect(() => {
    refreshQueue({ openIfAny: true });
  }, [refreshQueue]);

  // Real-time: a customer just booked on the website.
  useEffect(() => {
    const off = subscribe<AdminBookingRequestedData>("ADMIN_BOOKING_REQUESTED", (msg: WSMessage<AdminBookingRequestedData>) => {
      const d = msg.data;
      if (!d || !d.master_booking_id || !d.service_type) return;
      const item = wsItemToQueueItem(d);
      let isNew = false;
      setQueue((prev) => {
        if (prev.some((q) => q.master_booking_id === item.master_booking_id)) {
          return prev;
        }
        isNew = true;
        return [item, ...prev];
      });
      if (isNew) {
        setOpen(true);
        playRingtone().catch(() => { /* retry scheduled on next gesture */ });
        showLocalNotification(`New ${SERVICE_META[d.service_type].label.toLowerCase()} booking`, {
          body: `${d.booking_number} — ${item.headline ?? "new booking"}`,
          tag: `accept-${item.master_booking_id}`,
        });
      }
    });
    return off;
  }, [subscribe]);

  // Real-time: a partner accepted/rejected a hotel/tour booking — drop it
  // from the admin queue so the modal doesn't keep ringing for a booking
  // that's already resolved.
  useEffect(() => {
    const off = subscribe<{
      master_booking_id?: number;
      service_type?: string;
      service_number?: string;
      decision?: string;
      resolved_by?: string;
    }>("BOOKING_RESOLVED", (msg) => {
      const d = msg.data;
      if (!d || !d.master_booking_id) return;
      setQueue((prev) => prev.filter((q) => q.master_booking_id !== d.master_booking_id));
    });
    return off;
  }, [subscribe]);

  const closeAndSilence = useCallback(() => {
    stopRingtone();
    setOpen(false);
  }, []);

  const removeFromQueue = useCallback((masterId: number) => {
    setQueue((prev) => prev.filter((q) => q.master_booking_id !== masterId));
  }, []);

  const acceptOne = useCallback(
    async (item: AdminAcceptQueueItem) => {
      setAccepting((prev) => new Set(prev).add(item.master_booking_id));
      adminAcceptedRef.current = true;
      try {
        const res = await bookingService.acceptBooking(item.master_booking_id, item.service_type);
        enqueueSnackbar(res?.message ?? `${item.service_number} accepted`, { variant: "success" });
        removeFromQueue(item.master_booking_id);
      } catch (e: any) {
        enqueueSnackbar(e?.response?.data?.detail ?? "Failed to accept booking", { variant: "error" });
        // It may have been accepted in another tab — refresh authoritative queue.
        refreshQueue();
      } finally {
        setAccepting((prev) => {
          const next = new Set(prev);
          next.delete(item.master_booking_id);
          return next;
        });
      }
    },
    [enqueueSnackbar, removeFromQueue, refreshQueue]
  );

  // When the queue empties → silence. Redirect to Bookings only when the
  // ADMIN accepted the last booking (partner-resolved queues just close).
  useEffect(() => {
    if (queue.length === 0 && loadedOnceRef.current) {
      stopRingtone();
      if (open) {
        setOpen(false);
        if (adminAcceptedRef.current) {
          adminAcceptedRef.current = false;
          navigate("/bookings");
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length]);

  const acceptAll = async () => {
    if (acceptingAll || queue.length === 0) return;
    setAcceptingAll(true);
    const snapshot = [...queue];
    try {
      for (const item of snapshot) {
        try {
          await bookingService.acceptBooking(item.master_booking_id, item.service_type);
          removeFromQueue(item.master_booking_id);
        } catch (e: any) {
          enqueueSnackbar(e?.response?.data?.detail ?? `Failed to accept ${item.service_number}`, { variant: "error" });
        }
      }
      enqueueSnackbar(`${snapshot.length} booking(s) accepted`, { variant: "success" });
      adminAcceptedRef.current = true;
      refreshQueue();
    } finally {
      setAcceptingAll(false);
    }
  };

  const busy = acceptingAll || accepting.size > 0;

  const subtitle = useMemo(() => {
    if (queue.length === 0) return "No pending bookings";
    const counts = queue.reduce<Record<string, number>>((acc, q) => {
      acc[q.service_type] = (acc[q.service_type] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([st, n]) => `${n} ${SERVICE_META[st as "CAB" | "HOTEL" | "TOUR"].label.toLowerCase()}${n > 1 ? "s" : ""}`)
      .join(" · ");
  }, [queue]);

  return (
    <Dialog
      open={open}
      onClose={(_e, reason) => {
        if (reason !== "backdropClick" || queue.length === 0) closeAndSilence();
      }}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            border: `1.5px solid ${alpha(theme.palette.warning.main, 0.6)}`,
            boxShadow: "0 24px 64px rgba(245, 158, 11, 0.22), 0 2px 8px rgba(0,0,0,0.1)",
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1, pt: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2,
            background: "linear-gradient(135deg, #F59E0B, #D97706)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(245,158,11,0.35)",
          }}>
            <NotificationsActive sx={{ color: "#fff", fontSize: 22 }} />
          </Box>
          <Box flex={1}>
            <Typography variant="h6" fontWeight={800} lineHeight={1.2}>
              New Booking{queue.length !== 1 ? "s" : ""} Awaiting Acceptance
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          </Box>
          <Chip
            icon={<DoneAll sx={{ fontSize: 14 }} />}
            label={`${queue.length} pending`}
            color="warning"
            sx={{ fontWeight: 700 }}
          />
          <IconButton size="small" onClick={closeAndSilence} sx={{ ml: 0.5 }}>
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5, pb: 1 }}>
        <Alert severity="info" sx={{ mb: 1.5, borderRadius: 2 }} icon={<NotificationsActive fontSize="small" />}>
          Customers placed these bookings on the website. Accept to confirm
          {queue.some((q) => q.service_type === "CAB") ? " and start assigning a partner" : ""}.
        </Alert>

        {queue.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <CheckCircle sx={{ fontSize: 40, color: "success.main", mb: 1 }} />
            <Typography color="text.secondary">All bookings accepted</Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ maxHeight: 380, overflowY: "auto" }}>
            {queue.map((item) => {
              const meta = SERVICE_META[item.service_type];
              const isBusy = accepting.has(item.master_booking_id);
              return (
                <ListItem
                  key={item.master_booking_id}
                  disableGutters
                  sx={{
                    px: 1.5, py: 1.25, mb: 1,
                    border: 1, borderColor: "divider",
                    borderRadius: 2.5,
                    bgcolor: alpha(meta.color, 0.05),
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: alpha(meta.color, 0.15), color: meta.color, width: 40, height: 40 }}>
                      {meta.icon}
                    </Avatar>
                  </ListItemAvatar>
                  <Box flex={1} minWidth={0}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" fontWeight={800} fontFamily="monospace" noWrap>
                        {item.service_number}
                      </Typography>
                      <Chip
                        label={meta.label}
                        size="small"
                        sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700, bgcolor: alpha(meta.color, 0.15), color: meta.color }}
                      />
                    </Stack>
                    {item.headline && (
                      <Stack direction="row" alignItems="center" spacing={0.5} mt={0.25}>
                        <LocationOn sx={{ fontSize: 13, color: "text.secondary" }} />
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {item.headline}
                        </Typography>
                      </Stack>
                    )}
                    <Stack direction="row" spacing={1.5} mt={0.25} flexWrap="wrap">
                      {item.customer_name && (
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Person sx={{ fontSize: 13, color: "text.secondary" }} />
                          <Typography variant="caption" color="text.secondary">{item.customer_name}</Typography>
                        </Stack>
                      )}
                      {item.city_name && (
                        <Typography variant="caption" color="text.secondary">{item.city_name}</Typography>
                      )}
                      {item.datetime && (
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Event sx={{ fontSize: 13, color: "text.secondary" }} />
                          <Typography variant="caption" color="text.secondary">{formatDateTime(item.datetime)}</Typography>
                        </Stack>
                      )}
                      {item.amount > 0 && (
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Payments sx={{ fontSize: 13, color: "text.secondary" }} />
                          <Typography variant="caption" fontWeight={700}>
                            ₹{item.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                          </Typography>
                        </Stack>
                      )}
                    </Stack>
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    onClick={() => acceptOne(item)}
                    disabled={busy}
                    startIcon={isBusy ? <CircularProgress size={12} color="inherit" /> : <CheckCircle />}
                    sx={{ ml: 1, borderRadius: 2, fontWeight: 700, flexShrink: 0 }}
                  >
                    {isBusy ? "…" : "Accept"}
                  </Button>
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 1, gap: 1, flexWrap: "wrap" }}>
        <Button
          onClick={closeAndSilence}
          disabled={busy}
          sx={{ borderRadius: 2, fontWeight: 700 }}
        >
          Close
        </Button>
        <Box flex={1} />
        <Button
          onClick={acceptAll}
          variant="contained"
          color="primary"
          disabled={queue.length === 0 || busy}
          startIcon={acceptingAll ? <CircularProgress size={14} color="inherit" /> : <DoneAll />}
          sx={{ borderRadius: 2, fontWeight: 800 }}
        >
          {acceptingAll ? "Accepting…" : `Accept All (${queue.length})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
