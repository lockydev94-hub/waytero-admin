// ============================================================
// WAYTERO ADMIN — SIDEBAR ACTION-COUNTS SERVICE
// Doc: Backend app/modules/admin/api_dashboard.py — GET /admin/action-counts
//
// One request returns every queue's pending count, keyed by the sidebar's own
// nav keys, so the badges cost one poll per minute instead of eleven.
// A key the server does not return has no honest pending count — it is not
// zero, it is unknown, and the badge stays off.
// ============================================================
import apiClient from "./api";
import type { NavKey } from "../constants";

export type ActionCounts = Partial<Record<NavKey, number>>;

export const actionCountsService = {
  get: async (): Promise<ActionCounts> => {
    const res = await apiClient.get<ActionCounts>("/admin/action-counts");
    return res.data;
  },
};
