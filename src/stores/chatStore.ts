// ============================================================
// WAYTERO ADMIN — CHAT STORE (Zustand)
// Doc Ref: Website Chat §4 — Admin chat surface
//
// Holds which conversation the admin is currently viewing so the
// global NewChatModal can suppress itself when the admin is already
// inside that thread (otherwise every new message would stack a modal).
// ============================================================
import { create } from "zustand";

interface ChatStore {
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  /** bump counter — ChatPage listens so it can refetch the inbox when
   *  a customer message arrives while the admin is elsewhere. */
  inboxVersion: number;
  bumpInbox: () => void;
}

export const useChatStore = create<ChatStore>()((set) => ({
  activeConversationId: null,
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  inboxVersion: 0,
  bumpInbox: () => set((s) => ({ inboxVersion: s.inboxVersion + 1 })),
}));