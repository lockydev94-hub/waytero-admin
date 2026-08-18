// ============================================================
// WAYTERO ADMIN — AUDIT LOGS TABLE
// Table + empty / loading states. Pagination is hoisted to the parent.
// Doc Ref: Admin API §24
// Pattern matches pages/drivers/DriversPage.tsx:1554-1650
// ============================================================

import {
  Box,
  Card,
  Chip,
  IconButton,
  LinearProgress,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  History,
  Visibility,
} from "@mui/icons-material";
import type { AuditLog } from "../../../services/admin.service";

interface AuditLogsTableProps {
  items: AuditLog[];
  total: number;
  page: number; // 0-based for MUI TablePagination
  pageSize: number;
  isLoading: boolean;
  isFetching: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRowClick: (log: AuditLog) => void;
  hasActiveFilters: boolean;
  onClearFilters?: () => void;
}

// Color a chip by module. Sourced from the platform palette so it stays
// consistent with the sidebar nav and other admin pages.
type ModuleColor =
  | "default"
  | "primary"
  | "secondary"
  | "info"
  | "success"
  | "warning"
  | "error";

const MODULE_META: Record<string, ModuleColor> = {
  AUTH:         "secondary",
  PARTNER:      "primary",
  DRIVER:       "info",
  VEHICLE:      "info",
  HOTEL:        "warning",
  TOUR:         "warning",
  BOOKING:      "primary",
  PAYMENT:      "success",
  WALLET:       "success",
  SETTLEMENT:   "success",
  COUPON:       "warning",
  NOTIFICATION: "default",
  ROLE:         "default",
  CONFIG:       "default",
  STAFF:        "default",
};

function ModuleChip({ module }: { module: string }) {
  const color: ModuleColor = MODULE_META[module] ?? "default";
  return (
    <Chip
      label={module}
      size="small"
      color={color}
      variant="outlined"
      sx={{ fontWeight: 700, letterSpacing: 0.3, minWidth: 90, justifyContent: "center" }}
    />
  );
}

function ActionChip({ action }: { action: string }) {
  return (
    <Chip
      label={action}
      size="small"
      sx={{
        fontWeight: 600,
        bgcolor: "rgba(102, 126, 234, 0.1)",
        color: "primary.main",
        fontFamily: "monospace",
        fontSize: "0.7rem",
      }}
    />
  );
}

function ChangesChip({ log }: { log: AuditLog }) {
  // Show whether this event has before / after values.
  const hasOld = log.old_values && Object.keys(log.old_values).length > 0;
  const hasNew = log.new_values && Object.keys(log.new_values).length > 0;
  if (!hasOld && !hasNew) {
    return (
      <Typography variant="caption" sx={{ color: "text.disabled" }}>
        —
      </Typography>
    );
  }
  const changed =
    hasOld && hasNew
      ? Object.keys(log.new_values ?? {}).filter(
          (k) => JSON.stringify(log.old_values?.[k]) !== JSON.stringify(log.new_values?.[k]),
        ).length
      : 0;
  return (
    <Chip
      label={
        hasOld && hasNew
          ? `${changed} field${changed === 1 ? "" : "s"}`
          : hasNew
            ? `${Object.keys(log.new_values ?? {}).length} new`
            : `${Object.keys(log.old_values ?? {}).length} old`
      }
      size="small"
      sx={{
        fontWeight: 700,
        bgcolor: changed > 0 ? "rgba(245, 158, 11, 0.12)" : "rgba(100, 116, 139, 0.12)",
        color: changed > 0 ? "warning.dark" : "text.secondary",
      }}
    />
  );
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export default function AuditLogsTable({
  items,
  total,
  page,
  pageSize,
  isLoading,
  isFetching,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  hasActiveFilters,
}: AuditLogsTableProps) {
  return (
    <Card sx={{ borderRadius: 3 }}>
      {isFetching && <LinearProgress />}

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow
              sx={{
                "& th": {
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  color: "text.secondary",
                  whiteSpace: "nowrap",
                },
              }}
            >
              <TableCell>Timestamp</TableCell>
              <TableCell>Module</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Entity</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Changes</TableCell>
              <TableCell>IP Address</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(8)].map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton height={28} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <Box sx={{ py: 8, textAlign: "center" }}>
                    <History sx={{ fontSize: 52, color: "text.disabled", mb: 1.5 }} />
                    <Typography variant="h6" color="text.secondary" fontWeight={600}>
                      No Audit Events
                    </Typography>
                    <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
                      {hasActiveFilters
                        ? "Try adjusting your filters to widen the search"
                        : "Platform audit events will appear here as admins take actions"}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              items.map((log) => (
                <TableRow
                  key={log.id}
                  hover
                  sx={{
                    cursor: "pointer",
                    "&:hover": { bgcolor: "rgba(102,126,234,0.04)" },
                  }}
                  onClick={() => onRowClick(log)}
                >
                  <TableCell>
                    <Typography variant="caption" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
                      {formatTimestamp(log.created_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <ModuleChip module={log.module_name} />
                  </TableCell>
                  <TableCell>
                    <ActionChip action={log.action_type} />
                  </TableCell>
                  <TableCell>
                    {log.entity_name ? (
                      <Stack direction="row" alignItems="center" gap={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          {log.entity_name}
                        </Typography>
                        {log.entity_id !== null && (
                          <Typography
                            variant="caption"
                            fontFamily="monospace"
                            fontWeight={700}
                            sx={{
                              bgcolor: "rgba(102,126,234,0.1)",
                              px: 0.75,
                              py: 0.25,
                              borderRadius: 0.75,
                            }}
                          >
                            #{log.entity_id}
                          </Typography>
                        )}
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.disabled">
                        —
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {log.user_id !== null ? (
                      <Typography
                        variant="caption"
                        fontFamily="monospace"
                        fontWeight={600}
                      >
                        {log.user_id}
                      </Typography>
                    ) : (
                      <Chip
                        label="system"
                        size="small"
                        sx={{
                          fontSize: "0.65rem",
                          bgcolor: "rgba(100,116,139,0.12)",
                          color: "text.secondary",
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <ChangesChip log={log} />
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      fontFamily="monospace"
                      sx={{ color: log.ip_address ? "text.secondary" : "text.disabled" }}
                    >
                      {log.ip_address ?? "—"}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Tooltip title="View details">
                      <IconButton
                        size="small"
                        onClick={() => onRowClick(log)}
                        sx={{
                          color: "text.secondary",
                          "&:hover": { color: "primary.main", bgcolor: "rgba(102,126,234,0.1)" },
                        }}
                      >
                        <Visibility fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={total}
        page={page}
        rowsPerPage={pageSize}
        onPageChange={(_, p) => onPageChange(p)}
        onRowsPerPageChange={(e) => {
          onPageSizeChange(Number(e.target.value));
          onPageChange(0);
        }}
        rowsPerPageOptions={[10, 20, 50, 100]}
        sx={{ borderTop: "1px solid", borderColor: "divider" }}
      />
    </Card>
  );
}
