// ============================================================
// WAYTERO ADMIN — BRANCH FILTER STORE (Zustand, persisted)
// The super admin's "which office am I looking at right now" choice.
//
// It is a viewing preference, not a permission: the server re-reads the
// account's own branch from the user row on every request and ignores this
// header for anyone who is not a super admin. A branch manager cannot use it
// to look at another office, and a super admin cannot use it to see rows the
// account could not see anyway.
//
// `branchId === null` means "All branches", the default.
// ============================================================
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface BranchFilterStore {
  branchId: number | null;
  setBranchId: (id: number | null) => void;
  clear: () => void;
}

export const useBranchFilterStore = create<BranchFilterStore>()(
  persist(
    (set) => ({
      branchId: null,
      setBranchId: (branchId) => set({ branchId }),
      clear: () => set({ branchId: null }),
    }),
    { name: "wt_admin_branch_filter" },
  ),
);

export default useBranchFilterStore;
