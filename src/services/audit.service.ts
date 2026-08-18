// ============================================================
// WAYTERO ADMIN — AUDIT LOG SERVICE
// Doc Ref: Admin API §24 — Audit Logs
//          Docs/05_Database/09_DATABASE_SCHEMA_PART_8_AUDIT_NOTIFICATION.md
//
// Canonical location for the audit-logs client. The matching `adminService`
// methods are kept as re-exports for callers that already import from
// admin.service — new code should prefer this module.
// ============================================================

import apiClient from "./api";
import { adminService, type AuditLog, type AuditLogSummary, type PagedResponse } from "./admin.service";

// Re-export types so screens can do `import type { AuditLog } from ".../audit.service"`.
export type { AuditLog, AuditLogSummary } from "./admin.service";

export interface AuditLogFilter {
  page?: number;
  page_size?: number;
  user_id?: number;
  action_type?: string;
  module?: string;
  entity_name?: string;
  date_from?: string; // ISO 8601 — backend accepts datetime
  date_to?: string;
  q?: string; // free-text — backend treats as a module ILIKE match
}

export const auditService = {
  /**
   * Paginated audit log list. Accepts any subset of AuditLogFilter.
   */
  list: (filter: AuditLogFilter = {}) =>
    apiClient
      .get<PagedResponse<AuditLog>>("/admin/audit-logs", {
        params: filter as Record<string, unknown>,
      })
      .then((r) => r.data),

  /**
   * Aggregate counts for the dashboard header strip.
   */
  stats: () =>
    apiClient.get<AuditLogSummary>("/admin/audit-logs/stats").then((r) => r.data),
};

// Backwards-compatible re-exports so `adminService.listAuditLogs` callers
// keep working while we migrate the rest of the app.
export const listAuditLogs = adminService.listAuditLogs;
export const auditStats = adminService.auditStats;
