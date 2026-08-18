// ============================================================
// WAYTERO ADMIN PORTAL — LIVE CHAT PAGE
// Doc Ref: Website Chat §4 — Admin chat surface
//
// Three-pane chat board:
//   Left   — conversation inbox (status filters + search, unread badges)
//   Center — live thread (realtime via chat.message, reply box,
//            assign / close)
//   Right  — customer context panel: existing/new badge, profile,
//            recent bookings, payments, wallet balance — everything an
//            agent needs before replying.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  Box, Paper, Typography, Stack, Chip, TextField, InputAdornment,
  List, ListItemButton, ListItemAvatar, Avatar, Badge, Button,
  CircularProgress, Divider, IconButton, Tooltip, Alert, alpha, Grid,
  Card, CardContent, CardHeader,
} from "@mui/material";
import {
  Search, Send, CheckCircle, LockClock, Close as CloseIcon,
  Person, Phone, Email, EventNote, AccountBalanceWallet,
  Payment as PaymentIcon, DirectionsCar, Hotel as HotelIcon,
} from "@mui/icons-material";
import { chatService, type ChatConversationItem, type ChatStatus, type ChatMessageItem } from "../../services/chat.service";
import { useRealtime } from "../../hooks/useRealtime";
import { useChatStore } from "../../stores/chatStore";

const STATUS_META: Record<ChatStatus, { label: string; color: "warning" | "info" | "success" | "error" }> = {
  WAITING: { label: "Offline message", color: "warning" },
  OPEN:    { label: "Open",            color: "success" },
  CLOSED:  { label: "Closed",          color: "error" },
};

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return "now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
    return `${Math.floor(diff / 86_400_000)}d`;
  } catch {
    return "";
  }
}

function fullTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function ChatPage() {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryConversation = searchParams.get("conversation");

  const [statusFilter, setStatusFilter] = useState<ChatStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(queryConversation);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const setActiveConversationId = useChatStore((s) => s.setActiveConversationId);
  const inboxVersion = useChatStore((s) => s.inboxVersion);
  const bumpInbox = useChatStore((s) => s.bumpInbox);

  // Realtime — a new customer message on the open thread arrives here;
  // the notification modal is suppressed while we're viewing it.
  const { subscribe } = useRealtime({ reconnectOnFocus: true });

  useEffect(() => {
    setActiveConversationId(selectedId);
    return () => setActiveConversationId(null);
  }, [selectedId, setActiveConversationId]);

  useEffect(() => {
    const off = subscribe("chat.message", (msg) => {
      const data = msg.data as unknown as { conversation_id?: string };
      if (data?.conversation_id === selectedId) {
        qc.invalidateQueries({ queryKey: ["chat-detail", selectedId] });
      } else {
        bumpInbox();
      }
    });
    return off;
  }, [subscribe, selectedId, qc, bumpInbox]);

  // Keep inbox fresh (polling fallback for other online admins too).
  const inboxQuery = useQuery({
    queryKey: ["chat-inbox", statusFilter, search, inboxVersion],
    queryFn: () => chatService.list({
      status: statusFilter === "ALL" ? undefined : statusFilter,
      q: search || undefined,
      page_size: 100,
    }),
    refetchInterval: 30_000,
  });

  const detailQuery = useQuery({
    queryKey: ["chat-detail", selectedId],
    queryFn: () => (selectedId ? chatService.get(selectedId) : Promise.resolve(null)),
    enabled: Boolean(selectedId),
    refetchInterval: 10_000,
  });

  const conversations: ChatConversationItem[] = inboxQuery.data?.items ?? [];

  const selectedConversation = detailQuery.data?.conversation ?? null;
  const messages: ChatMessageItem[] = detailQuery.data?.messages ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const selectConversation = (id: string) => {
    setSelectedId(id);
    setSearchParams({ conversation: id }, { replace: true });
  };

  const sendMessage = async () => {
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    try {
      await chatService.reply(selectedId, draft.trim());
      setDraft("");
      qc.invalidateQueries({ queryKey: ["chat-detail", selectedId] });
      qc.invalidateQueries({ queryKey: ["chat-inbox"] });
    } catch {
      enqueueSnackbar("Failed to send. Try again.", { variant: "error" });
    } finally {
      setSending(false);
    }
  };

  const closeThread = async () => {
    if (!selectedId) return;
    try {
      await chatService.close(selectedId);
      enqueueSnackbar("Conversation closed", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["chat-inbox"] });
      qc.invalidateQueries({ queryKey: ["chat-detail", selectedId] });
    } catch {
      enqueueSnackbar("Failed to close", { variant: "error" });
    }
  };

  const assignThread = async () => {
    if (!selectedId) return;
    try {
      await chatService.assign(selectedId);
      enqueueSnackbar("Assigned to you", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["chat-inbox"] });
      qc.invalidateQueries({ queryKey: ["chat-detail", selectedId] });
    } catch {
      enqueueSnackbar("Failed to assign", { variant: "error" });
    }
  };

  const ctx = detailQuery.data?.customer_context ?? null;
  const displayName =
    selectedConversation?.customer_name ??
    selectedConversation?.guest_name ??
    (ctx?.profile
      ? [ctx.profile.first_name, ctx.profile.last_name].filter(Boolean).join(" ") || "Customer"
      : "Customer");

  return (
    <Grid container spacing={2} sx={{ height: "calc(100vh - 128px)", minHeight: 480 }}>
      {/* ── Inbox ─────────────────────────────────────────────── */}
      <Grid item xs={12} md={4} lg={3.5} sx={{ height: "100%" }}>
        <Paper elevation={0} variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column", borderRadius: 3, overflow: "hidden" }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
            <Stack direction="row" spacing={0.75} sx={{ mb: 1.5 }}>
              {(["ALL", "OPEN", "WAITING", "CLOSED"] as const).map((s) => (
                <Chip
                  key={s}
                  label={s === "ALL" ? "All" : STATUS_META[s as ChatStatus].label}
                  size="small"
                  color={statusFilter === s ? "primary" : "default"}
                  variant={statusFilter === s ? "filled" : "outlined"}
                  onClick={() => setStatusFilter(s)}
                  sx={{ fontWeight: 600 }}
                />
              ))}
            </Stack>
            <TextField
              fullWidth
              size="small"
              placeholder="Search name or mobile…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>
                  ),
                },
              }}
            />
          </Box>

          <Box sx={{ flex: 1, overflowY: "auto" }}>
            {inboxQuery.isLoading && conversations.length === 0 ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                <CircularProgress size={22} />
              </Box>
            ) : conversations.length === 0 ? (
              <Box sx={{ py: 5, textAlign: "center", px: 2 }}>
                <LockClock sx={{ fontSize: 34, color: "text.disabled", mb: 1 }} />
                <Typography sx={{ fontSize: "0.8rem", color: "text.secondary" }}>
                  No conversations{statusFilter !== "ALL" ? ` in "${STATUS_META[statusFilter].label}"` : ""} yet
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {conversations.map((c) => {
                  const active = c.id === selectedId;
                  return (
                    <ListItemButton
                      key={c.id}
                      onClick={() => selectConversation(c.id)}
                      sx={{
                        px: 2, py: 1.5, gap: 1.25,
                        bgcolor: active ? alpha("#3B82F6", 0.08) : "transparent",
                        borderBottom: 1, borderColor: "divider",
                        "&:hover": { bgcolor: alpha("#3B82F6", 0.06) },
                      }}
                    >
                      <ListItemAvatar sx={{ minWidth: 40 }}>
                        <Badge
                          color="error"
                          variant="dot"
                          invisible={(c.unread_admin_count ?? 0) === 0}
                        >
                          <Avatar sx={{ width: 34, height: 34, bgcolor: "primary.main", fontSize: 13 }}>
                            {(c.customer_name ?? c.guest_name ?? "C")[0].toUpperCase()}
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>
                      <Box flex={1} minWidth={0}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Typography sx={{ fontWeight: active ? 700 : 600, fontSize: "0.85rem" }} noWrap>
                            {c.customer_name ?? c.guest_name ?? "Customer"}
                          </Typography>
                          <Typography sx={{ fontSize: "0.65rem", color: "text.secondary", flexShrink: 0, ml: 1 }}>
                            {relativeTime(c.last_message_at ?? c.created_at)}
                          </Typography>
                        </Stack>
                        <Typography
                          sx={{
                            fontSize: "0.74rem", color: "text.secondary", mt: 0.25,
                            display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {c.last_message_preview ?? (c.status === "WAITING" ? "Left a message while offline" : "No messages yet")}
                        </Typography>
                        <Stack direction="row" spacing={0.75} alignItems="center" mt={0.4}>
                          <Chip
                            label={STATUS_META[c.status].label}
                            size="small"
                            color={STATUS_META[c.status].color}
                            sx={{ height: 16, fontSize: "0.58rem", fontWeight: 700, "& .MuiChip-label": { px: 0.8 } }}
                          />
                          {c.customer_mobile && (
                            <Typography sx={{ fontSize: "0.62rem", color: "text.secondary" }} noWrap>
                              {c.customer_mobile}
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    </ListItemButton>
                  );
                })}
              </List>
            )}
          </Box>
        </Paper>
      </Grid>

      {/* ── Thread ────────────────────────────────────────────── */}
      <Grid item xs={12} md={5} lg={5} sx={{ height: "100%" }}>
        <Paper elevation={0} variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column", borderRadius: 3, overflow: "hidden" }}>
          {!selectedConversation ? (
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
              <LockClock sx={{ fontSize: 42, color: "text.disabled" }} />
              <Typography sx={{ color: "text.secondary", fontSize: "0.9rem" }}>
                Select a conversation to start replying
              </Typography>
            </Box>
          ) : (
            <>
              {/* Thread header */}
              <Box sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", gap: 1.5 }}>
                <Avatar sx={{ width: 36, height: 36, bgcolor: "primary.main", fontSize: 14 }}>
                  {displayName[0].toUpperCase()}
                </Avatar>
                <Box flex={1} minWidth={0}>
                  <Typography sx={{ fontWeight: 700, fontSize: "0.95rem" }} noWrap>
                    {displayName}
                  </Typography>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Chip
                      label={STATUS_META[selectedConversation.status].label}
                      size="small"
                      color={STATUS_META[selectedConversation.status].color}
                      sx={{ height: 16, fontSize: "0.58rem", fontWeight: 700, "& .MuiChip-label": { px: 0.8 } }}
                    />
                    {selectedConversation.subject && (
                      <Typography sx={{ fontSize: "0.68rem", color: "text.secondary" }} noWrap>
                        {selectedConversation.subject}
                      </Typography>
                    )}
                  </Stack>
                </Box>
                {selectedConversation.status !== "CLOSED" && (
                  <>
                    <Tooltip title="Assign to me">
                      <IconButton size="small" onClick={assignThread}><CheckCircle fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="Close conversation">
                      <IconButton size="small" onClick={closeThread}><CloseIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  </>
                )}
              </Box>

              {/* Messages */}
              <Box sx={{ flex: 1, overflowY: "auto", px: 2.5, py: 2, bgcolor: alpha("#3B82F6", 0.03) }}>
                {messages.length === 0 && (
                  <Box sx={{ textAlign: "center", py: 5, color: "text.secondary" }}>
                    <Typography sx={{ fontSize: "0.85rem" }}>No messages yet — say hello!</Typography>
                  </Box>
                )}
                <Stack spacing={1.25}>
                  {messages.map((m) => {
                    const mine = m.sender_type === "ADMIN";
                    const senderLabel =
                      m.sender_type === "ADMIN"
                        ? m.sender_name || "You"
                        : m.sender_name || displayName;
                    return (
                      <Box key={m.id} sx={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                        <Typography
                          sx={{
                            fontSize: "0.62rem", fontWeight: 700, mb: 0.25, px: 0.5,
                            opacity: 0.7, color: mine ? "primary.main" : "text.secondary",
                          }}
                        >
                          {senderLabel}
                        </Typography>
                        <Box sx={{
                          maxWidth: "78%", px: 1.75, py: 1, borderRadius: 2.5,
                          bgcolor: mine ? "primary.main" : "#fff",
                          color: mine ? "#fff" : "text.primary",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                          borderTopRightRadius: mine ? 0.5 : 2.5,
                          borderTopLeftRadius: mine ? 2.5 : 0.5,
                        }}>
                          <Typography sx={{ fontSize: "0.86rem", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                            {m.body}
                          </Typography>
                          <Typography sx={{ fontSize: "0.6rem", mt: 0.5, opacity: 0.75, textAlign: "right" }}>
                            {fullTime(m.created_at)}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
                <div ref={messagesEndRef} />
              </Box>

              {/* Reply box */}
              <Box sx={{ p: 2, borderTop: 1, borderColor: "divider", display: "flex", gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  maxRows={4}
                  placeholder={selectedConversation.status === "CLOSED" ? "Conversation closed" : "Type a reply…"}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={selectedConversation.status === "CLOSED" || sending}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                />
                <Button
                  variant="contained"
                  startIcon={<Send />}
                  onClick={sendMessage}
                  disabled={!draft.trim() || selectedConversation.status === "CLOSED" || sending}
                  sx={{ alignSelf: "flex-end" }}
                >
                  Send
                </Button>
              </Box>
            </>
          )}
        </Paper>
      </Grid>

      {/* ── Customer context panel ────────────────────────────── */}
      <Grid item xs={12} md={3} lg={3.5} sx={{ height: "100%", overflowY: "auto" }}>
        {!ctx ? (
          <Paper elevation={0} variant="outlined" sx={{ height: "100%", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Typography sx={{ color: "text.secondary", fontSize: "0.85rem" }}>
              Customer context appears here
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={2}>
            {/* Profile */}
            <Paper elevation={0} variant="outlined" sx={{ borderRadius: 3, p: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>Customer</Typography>
                <Chip
                  label={ctx.is_existing ? "Existing" : "New"}
                  size="small"
                  color={ctx.is_existing ? "success" : "error"}
                  sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700, "& .MuiChip-label": { px: 0.8 } }}
                />
              </Stack>
              <Stack spacing={0.75}>
                {ctx.profile?.customer_code && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Person sx={{ fontSize: 15, color: "text.secondary" }} />
                    <Typography sx={{ fontSize: "0.78rem" }}>{ctx.profile.customer_code}</Typography>
                  </Stack>
                )}
                {ctx.profile?.mobile_number && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Phone sx={{ fontSize: 15, color: "text.secondary" }} />
                    <Typography sx={{ fontSize: "0.78rem" }}>{ctx.profile.mobile_number}</Typography>
                  </Stack>
                )}
                {ctx.profile?.email && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Email sx={{ fontSize: 15, color: "text.secondary" }} />
                    <Typography sx={{ fontSize: "0.78rem" }} noWrap>{ctx.profile.email}</Typography>
                  </Stack>
                )}
                {ctx.profile?.created_at && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <EventNote sx={{ fontSize: 15, color: "text.secondary" }} />
                    <Typography sx={{ fontSize: "0.78rem" }}>Customer since {new Date(ctx.profile.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</Typography>
                  </Stack>
                )}
              </Stack>
            </Paper>

            {/* Wallet */}
            {ctx.wallet && (
              <Paper elevation={0} variant="outlined" sx={{ borderRadius: 3, p: 2, bgcolor: alpha("#10B981", 0.06) }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <AccountBalanceWallet sx={{ fontSize: 18, color: "#059669" }} />
                  <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>Wallet</Typography>
                </Stack>
                <Typography sx={{ fontSize: "1.2rem", fontWeight: 800, color: "#047857" }}>
                  ₹{Number(ctx.wallet.available_balance ?? 0).toLocaleString("en-IN")}
                </Typography>
                <Typography sx={{ fontSize: "0.68rem", color: "text.secondary" }}>
                  Hold: ₹{Number(ctx.wallet.hold_balance ?? 0).toLocaleString("en-IN")} · {ctx.wallet.wallet_status}
                </Typography>
              </Paper>
            )}

            {/* Recent bookings */}
            <Paper elevation={0} variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
              <CardHeader
                title="Recent bookings"
                titleTypographyProps={{ fontSize: "0.9rem", fontWeight: 700 }}
                sx={{ px: 2, py: 1.5, "& .MuiCardHeader-content": { minWidth: 0 } }}
              />
              {ctx.recent_bookings.length === 0 ? (
                <Typography sx={{ px: 2, pb: 2, fontSize: "0.75rem", color: "text.secondary" }}>
                  No bookings yet
                </Typography>
              ) : (
                <Stack divider={<Divider />}>
                  {ctx.recent_bookings.slice(0, 4).map((b, i) => {
                    const isCab = Boolean(b.booking_number);
                    const number = isCab ? b.booking_number : b.reservation_number;
                    const status = isCab ? b.booking_status : b.reservation_status;
                    return (
                      <Box key={`${b.booking_number ?? b.reservation_number}-${i}`} sx={{ px: 2, py: 1.25 }}>
                        <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                          {isCab ? (
                            <DirectionsCar sx={{ fontSize: 15, color: "primary.main" }} />
                          ) : (
                            <HotelIcon sx={{ fontSize: 15, color: "primary.main" }} />
                          )}
                          <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, fontFamily: "monospace" }} noWrap>
                            {String(number)}
                          </Typography>
                        </Stack>
                        <Typography sx={{ fontSize: "0.68rem", color: "text.secondary" }} noWrap>
                          {isCab
                            ? [b.pickup_location, b.drop_location].filter(Boolean).join(" → ")
                            : String(b.hotel_name ?? "")}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" mt={0.4}>
                          <Chip
                            label={String(status ?? "")}
                            size="small"
                            color={(String(status ?? "").startsWith("COMPLETE") || String(status ?? "").startsWith("CHECKED")) ? "success" : (String(status ?? "").startsWith("CANCELLED") ? "error" : "info")}
                            sx={{ height: 15, fontSize: "0.55rem", fontWeight: 700, "& .MuiChip-label": { px: 0.7 } }}
                          />
                          {Boolean(b.final_amount) && (
                            <Typography sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
                              ₹{Number(b.final_amount).toLocaleString("en-IN")}
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Paper>

            {/* Payments */}
            <Paper elevation={0} variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
              <CardHeader
                title="Recent payments"
                titleTypographyProps={{ fontSize: "0.9rem", fontWeight: 700 }}
                sx={{ px: 2, py: 1.5 }}
              />
              {ctx.recent_payments.length === 0 ? (
                <Typography sx={{ px: 2, pb: 2, fontSize: "0.75rem", color: "text.secondary" }}>
                  No payments yet
                </Typography>
              ) : (
                <Stack divider={<Divider />}>
                  {ctx.recent_payments.slice(0, 4).map((p) => (
                    <Box key={String(p.payment_number)} sx={{ px: 2, py: 1.25 }}>
                      <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                        <PaymentIcon sx={{ fontSize: 15, color: "primary.main" }} />
                        <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, fontFamily: "monospace" }} noWrap>
                          {String(p.payment_number)}
                        </Typography>
                        <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, ml: "auto" }}>
                          ₹{Number(p.amount).toLocaleString("en-IN")}
                        </Typography>
                      </Stack>
                      <Typography sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
                        {String(p.payment_method ?? p.payment_type ?? "")} · {String(p.payment_status ?? "")}
                        {p.payment_datetime ? ` · ${new Date(String(p.payment_datetime)).toLocaleDateString("en-IN")}` : ""}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Paper>
          </Stack>
        )}
      </Grid>
    </Grid>
  );
}