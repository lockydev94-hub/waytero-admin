// ============================================================
// WAYTERO ADMIN — UI STORE (Zustand)
// Doc: State Management §10 — sidebar, theme, modals
// ============================================================
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiStore {
  sidebarOpen:  boolean;
  themeMode:    "light" | "dark";
  toggleSidebar:  () => void;
  setSidebar:     (open: boolean) => void;
  toggleTheme:    () => void;
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      themeMode:   "light",
      toggleSidebar:  () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebar:     (open) => set({ sidebarOpen: open }),
      toggleTheme:    () => set((s) => ({ themeMode: s.themeMode === "light" ? "dark" : "light" })),
    }),
    { name: "wt_admin_ui" }
  )
);
