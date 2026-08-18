// ============================================================
// WAYTERO ADMIN — DASHBOARD SERVICE
// Doc: Admin API §3 Dashboard — GET /admin/dashboard
//      Admin API §4 Analytics  — GET /admin/analytics
//      Admin API §§ Charts     — GET /admin/dashboard/city-performance
//                                GET /admin/dashboard/revenue-trend
//                                GET /admin/dashboard/recent-activity
// ============================================================
import apiClient from "./api";

export interface DashboardStats {
  today_cab_bookings: number;
  today_hotel_reservations: number;
  active_trips: number;
  today_revenue: number;
  pending_settlements: number;
  pending_partner_approvals: number;
}

export interface AnalyticsData {
  total_customers: number;
  total_partners: number;
  active_partners: number;
  total_hotels: number;
  active_hotels: number;
  monthly_revenue: number;
  pending_hotel_approvals: number;
}

export interface CityPerformanceItem {
  city: string;
  bookings: number;
}

export interface RevenueTrendItem {
  month: string;
  revenue: number;
  bookings: number;
}

export interface RecentActivityItem {
  id: string;
  type: string;
  label: string;
  time: string;
  status: string;
}

export const dashboardService = {
  getStats: async (): Promise<DashboardStats> => {
    const res = await apiClient.get("/admin/dashboard");
    return res.data;
  },

  getAnalytics: async (): Promise<AnalyticsData> => {
    const res = await apiClient.get("/admin/analytics");
    return res.data;
  },

  getCityPerformance: async (): Promise<CityPerformanceItem[]> => {
    const res = await apiClient.get("/admin/dashboard/city-performance");
    return res.data;
  },

  getRevenueTrend: async (): Promise<RevenueTrendItem[]> => {
    const res = await apiClient.get("/admin/dashboard/revenue-trend");
    return res.data;
  },

  getRecentActivity: async (): Promise<RecentActivityItem[]> => {
    const res = await apiClient.get("/admin/dashboard/recent-activity");
    return res.data;
  },

  getHotelPipeline: async () => {
    const res = await apiClient.get("/admin/hotels/stats");
    return res.data as {
      total: number;
      draft: number;
      pending: number;
      under_review: number;
      document_pending: number;
      approved: number;
      active: number;
      rejected: number;
      inactive: number;
      suspended: number;
      blocked: number;
      own_risk_approved: number;
      unassigned_in_pipeline: number;
    };
  },

  getExpiringDocuments: async (days = 30, entity_type?: string) => {
    const params: Record<string, string | number> = { days };
    if (entity_type) params.entity_type = entity_type;
    const res = await apiClient.get("/admin/dashboard/expiring-documents", { params });
    return res.data as {
      items: Array<{
        entity_type: string;
        doc_id: number;
        entity_id: number;
        entity_name: string | null;
        entity_code: string | null;
        document_type: string;
        expiry_date: string | null;
        days_until_expiry: number | null;
        is_expired: boolean;
        verification_status: string | null;
      }>;
      total: number;
      days_window: number;
    };
  },
};
