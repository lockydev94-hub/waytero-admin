// ============================================================
// WAYTERO ADMIN — PARTNER SERVICE
// Doc Ref: BRD Part 2 §17-22 | DB Schema Part 2 §4-19
// API Routes: /admin/partners/* (admin actions & list)
//             /partners/*       (partner-scoped CRUD)
// ============================================================
import apiClient from "./api";

// ── Types ────────────────────────────────────────────────────

export interface PartnerDocument {
  id: number;
  document_type: string;
  document_number: string | null;
  file_url: string;
  verification_status: string | null;
  remarks: string | null;
  expiry_date: string | null;
  uploaded_at: string;
  verified_at: string | null;
}

export interface PartnerBankAccount {
  id: number;
  account_holder_name: string | null;
  account_number_encrypted: string | null;
  ifsc_code: string | null;
  bank_name: string | null;
  branch_name: string | null;
  account_type: string | null;
  is_primary: boolean;
  verification_status: string | null;
  created_at: string;
}

export interface PartnerVerificationLog {
  id: number;
  action: string;
  remarks: string | null;
  created_at: string;
}

export interface PartnerGSTDetails {
  id: number;
  gst_number: string | null;
  pan_number: string | null;
  legal_name: string | null;
  trade_name: string | null;
  registration_date: string | null;
  gst_status: string | null;
  verified_at: string | null;
}

export interface PartnerDetail {
  id: number;
  uuid: string;
  partner_code: string;
  partner_type: string;       // INDIVIDUAL | COMPANY
  business_name: string | null;
  owner_name: string;
  mobile: string;
  email: string | null;
  city_id: number;
  logo_url: string | null;
  // Office address — BRD Part 2 §20 | Migration 0016
  office_address_line_1: string | null;
  office_address_line_2: string | null;
  office_city_id: number | null;
  office_state_id: number | null;
  office_postal_code: string | null;
  status: string;
  onboarding_source: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  documents: PartnerDocument[];
  bank_accounts: PartnerBankAccount[];
  verification_logs: PartnerVerificationLog[];
  gst_details: PartnerGSTDetails | null;
  commission_group: {
    id: number;
    group_name: string;
    description: string | null;
    is_active: boolean;
    assigned_at: string;
  } | null;
  allowed_transitions: string[];
  services: { service_type: string; is_active: boolean }[];
}

/** Row shape from GET /admin/partners */
export interface AdminPartnerListItem {
  id: number;
  partner_code: string | null;
  partner_type: string | null;    // INDIVIDUAL | COMPANY
  business_name: string | null;
  contact_person: string | null;
  mobile_number: string | null;
  email: string | null;
  status: string;
  city_id: number | null;
  created_at: string;
}

export interface AdminPartnerPage {
  items: AdminPartnerListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface PartnerRegisterPayload {
  partner_type: "INDIVIDUAL" | "COMPANY";
  owner_name: string;
  business_name?: string;
  mobile: string;
  email?: string;
  city_id: number;
  onboarding_source?: string;
  // Logo — upload to Cloudinary first, pass URL here
  logo_url?: string;
  // Office address — BRD Part 2 §20 | Migration 0016 (office_city_id auto-set = city_id)
  office_address_line_1?: string;
  office_address_line_2?: string;
  office_city_id?: number;
  office_state_id?: number;
  office_postal_code?: string;
  // Tax — COMPANY requires gst_number (BRD Rule 14)
  gst_number?: string;
  pan_number?: string;
  gst_legal_name?: string;
  gst_trade_name?: string;
  services?: string[];        // ["CAB","HOTEL","TOUR"] — saved to partner_services
  commission_group_id?: number; // Assign to commission group at registration
}

export interface AdminBankAccountPayload {
  account_holder_name: string;
  account_number_encrypted: string;
  ifsc_code: string;
  bank_name: string;
  branch_name?: string;
  account_type: "SAVINGS" | "CURRENT";
  is_primary: boolean;
}

// ── Status flow (DB Schema Part 2 §6) ────────────────────────
// PENDING → UNDER_REVIEW → DOCUMENT_PENDING → APPROVED → ACTIVE → SUSPENDED → BLOCKED
export const PARTNER_STATUSES = [
  "PENDING", "UNDER_REVIEW", "DOCUMENT_PENDING",
  "APPROVED", "ACTIVE", "SUSPENDED", "BLOCKED",
] as const;

export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

// Doc Ref: DB Schema Part 2 §10 — Document Types
export const DOCUMENT_TYPES = [
  "AADHAAR", "PAN", "GST_CERTIFICATE", "TRADE_LICENSE",
  "BUSINESS_REGISTRATION", "BANK_PROOF", "AGREEMENT",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

// Document metadata — label + which number field to show
export const DOCUMENT_META: Record<string, { label: string; numberLabel?: string; numberPlaceholder?: string; hasExpiry?: boolean }> = {
  AADHAAR:              { label: "Aadhaar Card",             numberLabel: "Aadhaar Number",       numberPlaceholder: "XXXX XXXX XXXX", hasExpiry: false },
  PAN:                  { label: "PAN Card",                 numberLabel: "PAN Number",            numberPlaceholder: "ABCDE1234F",     hasExpiry: false },
  GST_CERTIFICATE:      { label: "GST Certificate",          numberLabel: "GSTIN",                 numberPlaceholder: "22AAAAA0000A1Z5", hasExpiry: false },
  TRADE_LICENSE:        { label: "Trade License",            numberLabel: "License Number",        numberPlaceholder: "TL-2024-XXXXX",  hasExpiry: true  },
  BUSINESS_REGISTRATION:{ label: "Business Registration",   numberLabel: "Registration Number",   numberPlaceholder: "CIN/LLC Number", hasExpiry: false },
  BANK_PROOF:           { label: "Bank Proof / Cancelled Cheque", numberLabel: "Account Number (last 4)", numberPlaceholder: "XXXX",  hasExpiry: false },
  AGREEMENT:            { label: "Signed Agreement",         numberLabel: undefined,               numberPlaceholder: undefined,        hasExpiry: false },
};

export const SERVICE_TYPES = ["CAB", "HOTEL", "TOUR"] as const;

// ── Status display metadata ───────────────────────────────────
export const STATUS_META: Record<string, { label: string; color: "default" | "warning" | "info" | "primary" | "success" | "error" | "secondary" }> = {
  PENDING:          { label: "Pending",          color: "warning"  },
  UNDER_REVIEW:     { label: "Under Review",     color: "info"     },
  DOCUMENT_PENDING: { label: "Docs Pending",     color: "secondary"},
  APPROVED:         { label: "Approved",         color: "primary"  },
  ACTIVE:           { label: "Active",           color: "success"  },
  SUSPENDED:        { label: "Suspended",        color: "error"    },
  BLOCKED:          { label: "Blocked",          color: "error"    },
};

// ── Service ──────────────────────────────────────────────────
export const partnerService = {
  /** Admin: paginated partner list */
  list: (params: {
    status?: string;
    page?: number;
    page_size?: number;
    partner_type?: string;
    city_id?: number;
  } = {}): Promise<AdminPartnerPage> =>
    apiClient.get<AdminPartnerPage>("/admin/partners", { params }).then((r) => r.data),

  /** Admin: full partner detail with documents, bank, log */
  getDetail: (id: number): Promise<PartnerDetail> =>
    apiClient.get<PartnerDetail>(`/admin/partners/${id}`).then((r) => r.data),

  /** Admin: status transitions — each has its own endpoint for clear audit trail */
  review:          (id: number, reason?: string) =>
    apiClient.patch(`/admin/partners/${id}/review`,           { reason }).then((r) => r.data),
  documentPending: (id: number, reason?: string) =>
    apiClient.patch(`/admin/partners/${id}/document-pending`, { reason }).then((r) => r.data),
  approve:         (id: number, reason?: string) =>
    apiClient.patch(`/admin/partners/${id}/approve`,          { reason }).then((r) => r.data),
  activate:        (id: number, reason?: string) =>
    apiClient.patch(`/admin/partners/${id}/activate`,         { reason }).then((r) => r.data),
  suspend:         (id: number, reason?: string) =>
    apiClient.patch(`/admin/partners/${id}/suspend`,          { reason }).then((r) => r.data),
  unsuspend:       (id: number, reason?: string) =>
    apiClient.patch(`/admin/partners/${id}/unsuspend`,        { reason }).then((r) => r.data),
  block:           (id: number, reason?: string) =>
    apiClient.patch(`/admin/partners/${id}/block`,            { reason }).then((r) => r.data),

  /** Admin: verify/reject a single KYC document */
  verifyDocument: (
    partnerId: number,
    documentId: number,
    verification_status: "APPROVED" | "REJECTED",
    remarks?: string,
  ) =>
    apiClient
      .patch(`/admin/partners/${partnerId}/verify-document/${documentId}`, null, {
        params: { verification_status, remarks },
      })
      .then((r) => r.data),

  /** Admin: create new partner (user + partner record) via admin endpoint.
   *  Uses POST /admin/partners — NOT /partners/register which binds to the
   *  caller\'s JWT user_id and would 409 if admin already has a partner record.
   */
  register: (payload: PartnerRegisterPayload): Promise<{ success: boolean; message: string; data: { partner_id: number; partner_code: string; status: string } }> =>
    apiClient.post("/admin/partners", payload).then((r) => r.data),

  /** Admin: upload partner logo directly (multipart) */
  uploadLogo: async (partnerId: number, file: File): Promise<{ message: string }> => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await apiClient.post<{ message: string }>(
      `/admin/partners/${partnerId}/upload-logo`,
      fd,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return r.data;
  },

  /** Admin: upload KYC document for partner (multipart, all-in-one) */
  uploadDocument: async (
    partnerId: number,
    file: File,
    document_type: string,
    document_number?: string,
    expiry_date?: string,
  ): Promise<{ message: string }> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("document_type", document_type);
    if (document_number) fd.append("document_number", document_number);
    if (expiry_date) fd.append("expiry_date", expiry_date);
    const r = await apiClient.post<{ message: string }>(
      `/admin/partners/${partnerId}/documents`,
      fd,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return r.data;
  },

  /** Admin: add bank account for partner */
  addBankAccount: (partnerId: number, payload: AdminBankAccountPayload) =>
    apiClient.post(`/admin/partners/${partnerId}/bank-accounts`, payload).then((r) => r.data),

  /** Admin: verify bank account */
  verifyBankAccount: (partnerId: number, accountId: number, verification_status: "VERIFIED" | "REJECTED") =>
    apiClient
      .patch(`/admin/partners/${partnerId}/bank-accounts/${accountId}/verify`, null, {
        params: { verification_status },
      })
      .then((r) => r.data),

  /** Admin: assign commission group to a partner */
  assignCommissionGroup: (partnerId: number, commission_group_id: number) =>
    apiClient.post(`/admin/partners/${partnerId}/commission-group`, { commission_group_id }).then((r) => r.data),

  /** Admin: remove commission group from a partner */
  removeCommissionGroup: (partnerId: number) =>
    apiClient.delete(`/admin/partners/${partnerId}/commission-group`).then((r) => r.data),

  /** Admin: edit partner profile details */
  editPartner: (
    partnerId: number,
    payload: Partial<{
      owner_name: string;
      business_name: string;
      mobile: string;
      email: string;
      city_id: number;
      partner_type: string;
      onboarding_source: string;
      logo_url: string;
      // Office address — BRD Part 2 §20
      office_address_line_1: string;
      office_address_line_2: string;
      office_city_id: number;
      office_state_id: number;
      office_postal_code: string;
      // Tax / GST — required for COMPANY (BRD Rule 14)
      gst_number: string;
      pan_number: string;
      gst_legal_name: string;
      gst_trade_name: string;
    }>,
  ) =>
    apiClient.patch(`/admin/partners/${partnerId}`, payload).then((r) => r.data),

  /** PATCH /admin/partners/{id}/services — update partner service links */
  updateServices: (partnerId: number, services: string[]) =>
    apiClient.patch(`/admin/partners/${partnerId}/services`, { services }).then((r) => r.data),

  /** Upload file to Cloudinary via admin settings upload-media, returns secure_url */
  uploadFile: async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("asset_type", "general");
    const r = await apiClient.post<{ secure_url: string }>("/admin/settings/upload-media", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return r.data.secure_url;
  },
};
