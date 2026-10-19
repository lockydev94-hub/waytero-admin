// ============================================================
// WAYTERO ADMIN — WORKING HOURS SERVICE
// Doc: Admin Portal §39 Security — session tracking / leave details
//
//   GET /auth/admin/work-hours?days=30   this admin's own days (any staff)
//   GET /admin/staff-work-hours          everybody's days (SUPER_ADMIN only)
//
// A "day" is one staff member in one platform-timezone day. `active_minutes`
// counts only time the portal saw real input: idle gaps, a locked screen and a
// laptop that was simply closed are not work time. Where no logout was
// recorded, the server bounds the day at the last beat plus a minute, so a
// crash yields a short day rather than a fourteen-hour one.
// ============================================================
import apiClient from "./api";

/** Mirrors backend StaffWorkDay */
export interface StaffWorkDay {
  user_id: string;
  user_code: string | null;
  full_name: string | null;
  user_type: string;
  work_date: string;
  first_login_at: string;
  /** recorded sign-out, or the bounded fallback when the tab just disappeared */
  last_logout_at: string | null;
  last_seen_at: string;
  session_count: number;
  heartbeat_count: number;
  active_seconds: number;
  active_minutes: number;
}

/** Mirrors backend WorkHoursTotals */
export interface WorkHoursTotals {
  days: number;
  staff_count: number;
  active_seconds: number;
  active_minutes: number;
}

/** Mirrors backend StaffWorkHoursResponse — flat, the /admin/* envelope rule */
export interface StaffWorkHoursResponse {
  items: StaffWorkDay[];
  period_totals: WorkHoursTotals;
  total: number;
  page: number;
  page_size: number;
  date_from: string;
  date_to: string;
}

interface MyWorkHoursData {
  items: StaffWorkDay[];
  period_totals: WorkHoursTotals;
  date_from: string;
  date_to: string;
}

export const workHoursService = {
  getMyWorkHours: async (days = 30): Promise<MyWorkHoursData> => {
    const res = await apiClient.get<{ success: boolean; data: MyWorkHoursData }>(
      "/auth/admin/work-hours",
      { params: { days } }
    );
    return res.data.data;
  },

  listStaffWorkHours: async (params: {
    date_from: string;
    date_to: string;
    user_id?: string;
    page?: number;
    page_size?: number;
  }): Promise<StaffWorkHoursResponse> => {
    const res = await apiClient.get<StaffWorkHoursResponse>(
      "/admin/staff-work-hours",
      { params }
    );
    return res.data;
  },
};
