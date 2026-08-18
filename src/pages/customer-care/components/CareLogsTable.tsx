// ============================================================
// CUSTOMER CARE — LOGS TABLE COMPONENT
// ============================================================
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Tooltip, Typography, Box, Stack, Skeleton,
  Avatar, alpha, useTheme, Paper, TablePagination,
} from "@mui/material";
import {
  OpenInNew, CheckCircleOutline, HourglassEmpty, ReportProblemOutlined,
  VisibilityOutlined, EditOutlined,
} from "@mui/icons-material";
import { format } from "date-fns";
import type { CareLogItem } from "../../../services/customerCare.service";

// ── Status / Priority configs ─────────────────────────────────
const STATUS_CONFIG: Record<string, { color: "default" | "warning" | "info" | "success" | "error"; label: string }> = {
  OPEN:        { color: "warning",  label: "Open" },
  IN_PROGRESS: { color: "info",     label: "In Progress" },
  RESOLVED:    { color: "success",  label: "Resolved" },
  CLOSED:      { color: "default",  label: "Closed" },
  CANCELLED:   { color: "error",    label: "Cancelled" },
};

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  LOW:    { color: "#6B7280", label: "Low" },
  MEDIUM: { color: "#3B82F6", label: "Medium" },
  HIGH:   { color: "#F59E0B", label: "High" },
  URGENT: { color: "#EF4444", label: "Urgent" },
};

const ISSUE_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  BOOKING_ISSUE: { color: "#8B5CF6", label: "Booking Issue" },
  PAYMENT_ISSUE: { color: "#F59E0B", label: "Payment Issue" },
  INQUIRY:       { color: "#3B82F6", label: "Inquiry" },
  COMPLAINT:     { color: "#EF4444", label: "Complaint" },
  OTHER:         { color: "#6B7280", label: "Other" },
};

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

interface Props {
  items: CareLogItem[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onView: (log: CareLogItem) => void;
  onEdit: (log: CareLogItem) => void;
}

export default function CareLogsTable({
  items, total, page, pageSize, loading,
  onPageChange, onPageSizeChange, onView, onEdit,
}: Props) {
  const theme = useTheme();

  const cols = ["Log #", "Customer", "Type", "Subject", "Priority", "Status", "Booking", "Created", "Actions"];

  return (
    <Paper sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
              {cols.map(c => (
                <TableCell key={c} sx={{ fontWeight: 700, fontSize: 12, color: "text.secondary", whiteSpace: "nowrap", py: 1.75 }}>
                  {c}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {cols.map(c => (
                  <TableCell key={c}><Skeleton height={28} /></TableCell>
                ))}
              </TableRow>
            )) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={cols.length} align="center" sx={{ py: 8 }}>
                  <Box textAlign="center">
                    <Typography color="text.secondary" fontSize={14}>No customer care logs found</Typography>
                    <Typography color="text.disabled" fontSize={12} mt={0.5}>Use the "New Session" button to start a customer care session</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : items.map(row => {
              const sc = STATUS_CONFIG[row.status] ?? { color: "default" as const, label: row.status };
              const pc = PRIORITY_CONFIG[row.priority] ?? { color: "#6B7280", label: row.priority };
              const itc = ISSUE_TYPE_CONFIG[row.issue_type] ?? { color: "#6B7280", label: row.issue_type };

              return (
                <TableRow key={row.id} hover sx={{
                  cursor: "pointer",
                  "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.03) },
                }}>
                  <TableCell>
                    <Typography variant="caption" fontWeight={700} fontFamily="monospace" color="primary.main">
                      {row.log_number}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: 11, fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.15), color: "primary.main" }}>
                        {getInitials(row.customer_name)}
                      </Avatar>
                      <Box>
                        <Typography fontSize={13} fontWeight={600} noWrap sx={{ maxWidth: 120 }}>
                          {row.customer_name || "—"}
                        </Typography>
                        <Typography fontSize={11} color="text.secondary">{row.customer_mobile || ""}</Typography>
                      </Box>
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <Box sx={{ display: "inline-block", px: 1.25, py: 0.25, borderRadius: 1.5, bgcolor: alpha(itc.color, 0.1), color: itc.color, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {itc.label}
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Typography fontSize={13} noWrap sx={{ maxWidth: 200 }} title={row.subject}>{row.subject}</Typography>
                  </TableCell>

                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: pc.color }} />
                      <Typography fontSize={12} fontWeight={600} color={pc.color}>{pc.label}</Typography>
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Chip size="small" label={sc.label} color={sc.color} sx={{ fontWeight: 600, fontSize: 11 }} />
                  </TableCell>

                  <TableCell>
                    {row.booking_number ? (
                      <Typography variant="caption" fontFamily="monospace" color="secondary.main" fontWeight={600}>
                        {row.booking_number}
                      </Typography>
                    ) : <Typography color="text.disabled" fontSize={12}>—</Typography>}
                  </TableCell>

                  <TableCell>
                    <Typography fontSize={12} color="text.secondary" noWrap>
                      {format(new Date(row.created_at), "dd MMM yy, HH:mm")}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Stack direction="row" gap={0.5}>
                      <Tooltip title="View details">
                        <IconButton size="small" onClick={() => onView(row)} sx={{ color: "primary.main" }}>
                          <VisibilityOutlined sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit status">
                        <IconButton size="small" onClick={() => onEdit(row)} sx={{ color: "text.secondary" }}>
                          <EditOutlined sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={total}
        page={page - 1}
        rowsPerPage={pageSize}
        rowsPerPageOptions={[10, 20, 50]}
        onPageChange={(_, p) => onPageChange(p + 1)}
        onRowsPerPageChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
        sx={{ borderTop: "1px solid", borderColor: "divider" }}
      />
    </Paper>
  );
}
