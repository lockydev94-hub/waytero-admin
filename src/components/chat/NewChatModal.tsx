// ============================================================
// WAYTERO ADMIN PORTAL — NEW CHAT NOTIFICATION MODAL
// Doc Ref: Website Chat §4 — Realtime new-message alert
//
// Subscribes to CHAT_NEW_MESSAGE on the shared /ws channel. When a
// customer sends a message the modal pops up on any page with the
// sender, a preview and two actions: reply inline (jumps to the chat
// page after sending) or open the thread. If the admin is already
// viewing that conversation, the modal stays quiet.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Stack, Chip, TextField, Button, IconButton,
} from "@mui/material";
import { Close, Forum, Send } from "@mui/icons-material";
import { useRealtime } from "../../hooks/useRealtime";
import { useChatStore } from "../../stores/chatStore";
import { chatService } from "../../services/chat.service";

interface NewChatNotice {
  conversation_id: string;
  customer_name: string;
  subject: string | null;
  preview: string;
}

export default function NewChatModal() {
  const navigate = useNavigate();
  const { subscribe } = useRealtime({ reconnectOnFocus: true });
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const bumpInbox = useChatStore((s) => s.bumpInbox);

  const queueRef = useRef<NewChatNotice[]>([]);
  const [current, setCurrent] = useState<NewChatNotice | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const openThread = (conversationId: string) => {
    queueRef.current = queueRef.current.filter(
      (n) => n.conversation_id !== conversationId,
    );
    setCurrent(queueRef.current[0] ?? null);
    navigate(`/chat?conversation=${conversationId}`);
  };

  useEffect(() => {
    const off = subscribe("CHAT_NEW_MESSAGE", (msg) => {
      const data = msg.data as unknown as NewChatNotice;
      if (!data?.conversation_id) return;
      bumpInbox();
      // Admin already inside this thread — let the chat page handle it.
      if (data.conversation_id === activeConversationId) return;
      queueRef.current = [...queueRef.current.filter(
        (n) => n.conversation_id !== data.conversation_id,
      ), data];
      setCurrent(queueRef.current[0] ?? null);
    });
    return off;
  }, [subscribe, activeConversationId, bumpInbox]);

  const dismiss = () => {
    queueRef.current = queueRef.current.slice(1);
    setCurrent(queueRef.current[0] ?? null);
    setReply("");
  };

  const sendReply = async () => {
    if (!current || !reply.trim()) return;
    setSending(true);
    try {
      await chatService.reply(current.conversation_id, reply.trim());
      openThread(current.conversation_id);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={Boolean(current)}
      onClose={dismiss}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3 } } }}
    >
      {current && (
        <>
          <DialogTitle sx={{ pb: 1, display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{
              width: 34, height: 34, borderRadius: "50%", bgcolor: "primary.main",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Forum sx={{ fontSize: 18 }} />
            </Box>
            <Box flex={1} minWidth={0}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.95rem" }} noWrap>
                {current.customer_name || "New customer"}
              </Typography>
              <Typography sx={{ fontSize: "0.7rem", color: "text.secondary" }} noWrap>
                New message
              </Typography>
            </Box>
            <IconButton size="small" onClick={dismiss}><Close fontSize="small" /></IconButton>
          </DialogTitle>

          <DialogContent sx={{ pb: 1 }}>
            {current.subject && (
              <Chip
                label={current.subject}
                size="small"
                color="info"
                variant="outlined"
                sx={{ mb: 1, fontWeight: 600, fontSize: "0.68rem" }}
              />
            )}
            <Typography
              sx={{
                fontSize: "0.85rem", color: "text.primary", mb: 2,
                display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {current.preview}
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={2}
              maxRows={4}
              size="small"
              placeholder="Reply to this customer…"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              disabled={sending}
              slotProps={{ input: { sx: { fontSize: "0.85rem" } } }}
            />
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => openThread(current.conversation_id)}
            >
              Open chat
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<Send />}
              onClick={sendReply}
              disabled={!reply.trim() || sending}
            >
              {sending ? "Sending…" : "Reply"}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}