// ============================================================
// WAYTERO ADMIN — VEHICLE MAINTENANCE SERVICE
// Doc Ref: BRD Part 3 §133-138 — Vehicle Maintenance Records
// Backend: /admin/vehicles/*/maintenance
// ============================================================

import apiClient from "./api";

export interface MaintenanceRecord {
  id: number;
  vehicle_id: number;
  maintenance_type: string | null;
  service_date: string | null;
  next_due_date: string | null;
  cost: number | null;
  remarks: string | null;
  days_until_due: number | null;
  is_overdue: boolean;
  created_at: string;
}

export interface MaintenanceListResponse {
  items: MaintenanceRecord[];
  total: number;
}

export interface DueMaintenanceItem {
  vehicle_id: number;
  registration_number: string;
  vehicle_code: string | null;
  partner_name: string | null;
  partner_code: string | null;
  category_name: string | null;
  maintenance_type: string | null;
  service_date: string | null;
  next_due_date: string;
  cost: number | null;
  remarks: string | null;
  days_until_due: number;
  is_overdue: boolean;
}

export const vehicleMaintenanceService = {
  /** GET /admin/vehicles/{vehicle_id}/maintenance */
  listForVehicle: (vehicle_id: number, limit = 50) =>
    apiClient
      .get<MaintenanceListResponse>(`/admin/vehicles/${vehicle_id}/maintenance`, { params: { limit } })
      .then((r) => r.data),

  /** POST /admin/vehicles/{vehicle_id}/maintenance */
  create: (
    vehicle_id: number,
    payload: {
      maintenance_type: string;
      service_date: string;
      next_due_date?: string | null;
      cost?: number | null;
      remarks?: string | null;
    }
  ) =>
    apiClient.post(`/admin/vehicles/${vehicle_id}/maintenance`, payload).then((r) => r.data),

  /** PATCH /admin/vehicles/{vehicle_id}/maintenance/{maintenance_id} */
  update: (
    vehicle_id: number,
    maintenance_id: number,
    payload: Partial<{
      maintenance_type: string;
      service_date: string;
      next_due_date: string | null;
      cost: number | null;
      remarks: string | null;
    }>
  ) =>
    apiClient
      .patch(`/admin/vehicles/${vehicle_id}/maintenance/${maintenance_id}`, payload)
      .then((r) => r.data),

  /** DELETE /admin/vehicles/{vehicle_id}/maintenance/{maintenance_id} */
  remove: (vehicle_id: number, maintenance_id: number) =>
    apiClient
      .delete(`/admin/vehicles/${vehicle_id}/maintenance/${maintenance_id}`)
      .then((r) => r.data),

  /** GET /admin/vehicles/maintenance/due */
  dueFleet: (days = 30, limit = 100) =>
    apiClient
      .get<{ items: DueMaintenanceItem[]; total: number; days_window: number }>(
        `/admin/vehicles/maintenance/due`,
        { params: { days, limit } }
      )
      .then((r) => r.data),
};

export default vehicleMaintenanceService;
