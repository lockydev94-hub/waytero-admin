// ============================================================
// WAYTERO ADMIN — ADMIN MANAGEMENT SERVICE
// Doc: Admin API §5 Users, §8 Partners, §9 Drivers,
//      §10 Vehicles, §11 Bookings, §16 Settlements,
//      §23 Reports, §24 Audit Logs
// Base: /admin/*
// ============================================================
import apiClient from "./api";

// ── Pagination wrapper ───────────────────────────────────────
export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// ── User ─────────────────────────────────────────────────────
export interface AdminUser {
  id: string;
  user_code: string | null;
  first_name: string;
  last_name: string | null;
  mobile_number: string;
  email: string | null;
  user_type: string | null;
  status: string | null;
  is_active: boolean;
  created_at: string;
}

// ── Partner ───────────────────────────────────────────────────
export interface AdminPartner {
  id: number;
  partner_code: string | null;
  business_name: string | null;
  contact_person: string | null;
  mobile_number: string | null;
  email: string | null;
  status: string;
  city_id: number | null;
  created_at: string;
}

// ── Driver ────────────────────────────────────────────────────
export interface AdminDriver {
  id: number;
  driver_code: string | null;
  full_name: string | null;
  mobile_number: string | null;
  license_number: string | null;
  status: string;
  city_id: number | null;
  created_at: string;
}

// ── Vehicle ───────────────────────────────────────────────────
export interface AdminVehicle {
  id: number;
  vehicle_code: string | null;
  registration_number: string | null;
  make: string | null;
  model: string | null;
  vehicle_category_id: number | null;
  status: string | null;
  partner_id: number | null;
  created_at: string;
}

// ── Booking ───────────────────────────────────────────────────
export interface AdminBooking {
  id: number;
  booking_number: string | null;
  customer_user_id: string | null;
  booking_status: string;
  payment_status: string;
  total_amount: number | null;
  service_type: string | null;
  pickup_city_id: number | null;
  created_at: string;
}

// ── Settlement ────────────────────────────────────────────────
export interface AdminSettlement {
  id: number;
  settlement_number: string | null;
  partner_id: number | null;
  settlement_amount: number | null;
  status: string | null;
  created_at: string;
}

// ── Audit Log ─────────────────────────────────────────────────
export interface AuditLog {
  id: number;
  user_id: number | null;
  module_name: string;
  entity_name: string | null;
  entity_id: number | null;
  action_type: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  created_at: string;
}

export interface AuditLogSummary {
  total: number;
  today: number;
  this_week: number;
  unique_users_today: number;
  by_module: Record<string, number>;
  by_action_type: Record<string, number>;
}

// ── Reports ───────────────────────────────────────────────────
export interface RevenueReport {
  period: string;
  total_revenue: number;
  total_bookings: number;
  avg_booking_value: number;
}
export interface BookingReport {
  period: string;
  total_bookings: number;
  completed: number;
  cancelled: number;
  pending: number;
}
export interface PartnerReport {
  total_partners: number;
  active: number;
  pending: number;
  suspended: number;
}
export interface SettlementReport {
  total_settlements: number;
  pending_amount: number;
  paid_amount: number;
  pending_count: number;
}

// ── Service ───────────────────────────────────────────────────
export const adminService = {
  // Users
  listUsers: (params: Record<string, unknown> = {}) =>
    apiClient.get<PagedResponse<AdminUser>>("/admin/users", { params }).then((r) => r.data),
  getUser: (id: string) =>
    apiClient.get<AdminUser>(`/admin/users/${id}`).then((r) => r.data),
  activateUser: (id: string) =>
    apiClient.patch(`/admin/users/${id}/activate`, {}).then((r) => r.data),
  suspendUser: (id: string) =>
    apiClient.patch(`/admin/users/${id}/suspend`, {}).then((r) => r.data),

  // Partners
  listPartners: (params: Record<string, unknown> = {}) =>
    apiClient.get<PagedResponse<AdminPartner>>("/admin/partners", { params }).then((r) => r.data),
  approvePartner: (id: number) =>
    apiClient.patch(`/admin/partners/${id}/approve`, {}).then((r) => r.data),
  suspendPartner: (id: number) =>
    apiClient.patch(`/admin/partners/${id}/suspend`, {}).then((r) => r.data),
  rejectPartner: (id: number) =>
    apiClient.patch(`/admin/partners/${id}/reject`, {}).then((r) => r.data),

  // Drivers
  listDrivers: (params: Record<string, unknown> = {}) =>
    apiClient.get<PagedResponse<AdminDriver>>("/admin/drivers", { params }).then((r) => r.data),
  approveDriver: (id: number) =>
    apiClient.patch(`/admin/drivers/${id}/approve`, {}).then((r) => r.data),
  suspendDriver: (id: number) =>
    apiClient.patch(`/admin/drivers/${id}/suspend`, {}).then((r) => r.data),
  blockDriver: (id: number) =>
    apiClient.patch(`/admin/drivers/${id}/block`, {}).then((r) => r.data),

  createDriver: (payload: {
    partner_id: number; full_name: string; mobile: string; email?: string;
    license_number: string; license_expiry_date?: string; date_of_birth?: string;
    joining_date?: string; address?: string; gov_id_type?: string; gov_id_number?: string;
  }) =>
    apiClient.post("/admin/drivers", payload).then((r) => r.data),

  getDriver: (id: number) =>
    apiClient.get(`/admin/drivers/${id}`).then((r) => r.data),

  verifyDriverDocument: (
    driverId: number,
    documentId: number,
    verification_status: "APPROVED" | "REJECTED",
    remarks?: string,
  ) =>
    apiClient
      .patch(`/admin/drivers/${driverId}/verify-document/${documentId}`, null, {
        params: { verification_status, remarks },
      })
      .then((r) => r.data),

  // Vehicles
  listVehicles: (params: Record<string, unknown> = {}) =>
    apiClient.get<PagedResponse<AdminVehicle>>("/admin/vehicles", { params }).then((r) => r.data),
  approveVehicle: (id: number) =>
    apiClient.patch(`/admin/vehicles/${id}/approve`, {}).then((r) => r.data),
  suspendVehicle: (id: number) =>
    apiClient.patch(`/admin/vehicles/${id}/suspend`, {}).then((r) => r.data),

  // Bookings
  listBookings: (params: Record<string, unknown> = {}) =>
    apiClient.get<PagedResponse<AdminBooking>>("/admin/bookings", { params }).then((r) => r.data),
  getBooking: (id: number) =>
    apiClient.get<AdminBooking>(`/admin/bookings/${id}`).then((r) => r.data),
  cancelBooking: (id: number, reason: string) =>
    apiClient.patch(`/admin/bookings/${id}/cancel`, { reason }).then((r) => r.data),
  assignBooking: (id: number, payload: { partner_id?: number; driver_id?: number }) =>
    apiClient.patch(`/admin/bookings/${id}/assign`, payload).then((r) => r.data),

  // Settlements
  listSettlements: (params: Record<string, unknown> = {}) =>
    apiClient.get<PagedResponse<AdminSettlement>>("/admin/settlements", { params }).then((r) => r.data),
  markSettlementPaid: (id: number) =>
    apiClient.patch(`/admin/settlements/${id}/mark-paid`, {}).then((r) => r.data),
  markSettlementProcessing: (id: number) =>
    apiClient.patch(`/admin/settlements/${id}/mark-processing`, {}).then((r) => r.data),

  // Reports
  reportRevenue: (period = "monthly") =>
    apiClient.get<RevenueReport>("/admin/reports/revenue", { params: { period } }).then((r) => r.data),
  reportBookings: (period = "monthly") =>
    apiClient.get<BookingReport>("/admin/reports/bookings", { params: { period } }).then((r) => r.data),
  reportPartners: () =>
    apiClient.get<PartnerReport>("/admin/reports/partners").then((r) => r.data),
  reportSettlements: () =>
    apiClient.get<SettlementReport>("/admin/reports/settlements").then((r) => r.data),

  // Audit
  listAuditLogs: (params: Record<string, unknown> = {}) =>
    apiClient.get<PagedResponse<AuditLog>>("/admin/audit-logs", { params }).then((r) => r.data),
  auditStats: () =>
    apiClient.get<AuditLogSummary>("/admin/audit-logs/stats").then((r) => r.data),

  // Broadcast
  broadcast: (payload: { channel: string; message: string; title?: string }) =>
    apiClient.post("/admin/notifications/broadcast", payload).then((r) => r.data),
};

// ── Staff User ────────────────────────────────────────────────
// Doc Ref: BRD Part 2 §12 | Admin API §5 Staff Management | DB 0014_staff_profiles

export interface StaffDocument {
  id: string;
  document_type: string;
  document_name: string | null;
  file_url: string;
  file_type: string | null;
  is_verified: boolean;
  notes: string | null;
  uploaded_at: string | null;
}

export interface StaffProfile {
  id?: string | null;
  user_id?: string | null;
  // Personal
  date_of_birth?: string | null;
  gender?: string | null;
  blood_group?: string | null;
  personal_email?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  // Employment
  designation?: string | null;
  department?: string | null;
  employment_type?: string | null;
  joining_date?: string | null;
  employee_id?: string | null;
  // Address
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  // Documents
  pan_number?: string | null;
  aadhar_number?: string | null;
  driving_license_number?: string | null;
  // Bank
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc_code?: string | null;
  bank_branch?: string | null;
  bank_account_type?: string | null;
  // Nominee
  nominee_name?: string | null;
  nominee_relation?: string | null;
  nominee_phone?: string | null;
  nominee_address?: string | null;
  // ID Card
  id_card_status?: string | null;
  id_card_generated_at?: string | null;
  id_card_notes?: string | null;
}

export interface StaffUser {
  id: string;
  user_code: string | null;
  first_name: string;
  last_name: string | null;
  mobile_number: string;
  email: string | null;
  user_type: string; // ADMIN | CCO | VERIFICATION_OFFICER | FINANCE_MANAGER | SUPER_ADMIN
  status: string;
  is_active: boolean;
  profile_image_url: string | null;
  created_at: string;
  last_login_at: string | null;
  profile: StaffProfile | null;
}

export interface StaffUserCreate {
  first_name: string;
  last_name?: string;
  email: string;
  mobile_number: string;
  password: string;
  user_type: string;
  profile_image_url?: string;
  profile?: Partial<StaffProfile>;
}

export interface StaffUserUpdate {
  first_name?: string;
  last_name?: string;
  email?: string;
  mobile_number?: string;
  user_type?: string;
  profile_image_url?: string;
  profile?: Partial<StaffProfile>;
}

export const staffService = {
  list: (params: Record<string, unknown> = {}) =>
    apiClient.get<PagedResponse<StaffUser>>("/admin/staff", { params }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<StaffUser>(`/admin/staff/${id}`).then((r) => r.data),

  create: (payload: StaffUserCreate) =>
    apiClient.post<StaffUser>("/admin/staff", payload).then((r) => r.data),

  update: (id: string, payload: StaffUserUpdate) =>
    apiClient.patch<StaffUser>(`/admin/staff/${id}`, payload).then((r) => r.data),

  upsertProfile: (id: string, profile: Partial<StaffProfile>) =>
    apiClient.patch<StaffUser>(`/admin/staff/${id}/profile`, profile).then((r) => r.data),

  activate: (id: string) =>
    apiClient.patch(`/admin/staff/${id}/activate`, {}).then((r) => r.data),

  suspend: (id: string) =>
    apiClient.patch(`/admin/staff/${id}/suspend`, {}).then((r) => r.data),

  resetPassword: (id: string, new_password: string) =>
    apiClient.post(`/admin/staff/${id}/reset-password`, { new_password }).then((r) => r.data),

  generateIdCard: (id: string, notes?: string) =>
    apiClient.post<StaffUser>(`/admin/staff/${id}/generate-id-card`, { notes }).then((r) => r.data),

  uploadPhoto: (id: string, file: File): Promise<StaffUser> => {
    const fd = new FormData();
    fd.append("file", file);
    return apiClient
      .post<StaffUser>(`/admin/staff/${id}/upload-photo`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  uploadDocument: (
    id: string,
    file: File,
    document_type: string,
    document_name?: string,
    notes?: string
  ): Promise<{ documents: StaffDocument[]; uploaded: { id: string; file_url: string } }> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("document_type", document_type);
    if (document_name) fd.append("document_name", document_name);
    if (notes) fd.append("notes", notes);
    return apiClient
      .post(`/admin/staff/${id}/upload-document`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  listDocuments: (id: string): Promise<{ documents: StaffDocument[] }> =>
    apiClient.get(`/admin/staff/${id}/documents`).then((r) => r.data),

  deleteDocument: (staffId: string, docId: string): Promise<void> =>
    apiClient.delete(`/admin/staff/${staffId}/documents/${docId}`).then((r) => r.data),
};
