// ============================================================
// WAYTERO ADMIN — AUDIT LOGS PAGE
// Doc Ref: Admin API §24 — Audit Logs
// Pattern mirrors pages/drivers/DriversPage.tsx
//   Header → KPI strip → Filter Card → Table Card → Pagination
// ============================================================

import { useMemo, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
  Tooltip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Chip,
} from "@mui/material";
import {
  Refresh,
  Search,
  FileDownload,
  ClearAll,
  FilterList,
} from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import AuditStatsBar from "./components/AuditStatsBar";
import AuditLogsTable from "./components/AuditLogsTable";
import AuditDetailDrawer from "./components/AuditDetailDrawer";
import { auditService, type AuditLog } from "../../services/audit.service";
import type { AuditLogFilter } from "../../services/audit.service";
import { AUDIT_MODULES, AUDIT_ACTION_TYPES } from "../../constants";

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useAuditLogs(params: AuditLogFilter) {
  return useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => auditService.list(params),
    staleTime: 30_000,
  });
}

function useAuditStats() {
  return useQuery({
    queryKey: ["audit-logs-stats"],
    queryFn: () => auditService.stats(),
    staleTime: 30_000,
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const { enqueueSnackbar } = useSnackbar();

  // Filter state
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Pagination — MUI is 0-based, backend is 1-based.
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // Detail drawer
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const params = useMemo<AuditLogFilter>(
    () => ({
      page: page + 1,
      page_size: pageSize,
      ...(moduleFilter ? { module: moduleFilter } : {}),
      ...(actionFilter ? { action_type: actionFilter } : {}),
      ...(userId.trim() ? { user_id: Number(userId) || undefined } : {}),
      ...(dateFrom ? { date_from: new Date(dateFrom).toISOString() } : {}),
      ...(dateTo ? { date_to: new Date(`${dateTo}T23:59:59`).toISOString() } : {}),
    }),
    [page, pageSize, moduleFilter, actionFilter, userId, dateFrom, dateTo],
  );

  const { data, isLoading, isFetching, refetch } = useAuditLogs(params);
  const { data: stats, isLoading: statsLoading } = useAuditStats();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const hasActiveFilters =
    !!search.trim() || !!moduleFilter || !!actionFilter || !!userId.trim() || !!dateFrom || !!dateTo;

  const clearFilters = () => {
    setSearch("");
    setModuleFilter("");
    setActionFilter("");
    setUserId("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  };

  const handleExportCsv = async () => {
    try {
      const exportData = await auditService.list({
        page: 1,
        page_size: 200,
        ...(moduleFilter ? { module: moduleFilter } : {}),
        ...(actionFilter ? { action_type: actionFilter } : {}),
      });
      const rows = exportData.items;
      if (rows.length === 0) {
        enqueueSnackbar("No rows to export", { variant: "info" });
        return;
      }
      const headers = [
        "id",
        "created_at",
        "module_name",
        "action_type",
        "entity_name",
        "entity_id",
        "user_id",
        "ip_address",
        "old_values",
        "new_values",
      ];
      const csv = [
        headers.join(","),
        ...rows.map((r) =>
          headers
            .map((h) => {
              const v = (r as unknown as Record<string, unknown>)[h];
              if (v === null || v === undefined) return "";
              const s = typeof v === "object" ? JSON.stringify(v) : String(v);
              return `"${s.replace(/"/g, '""')}"`;
            })
            .join(","),
        ),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      enqueueSnackbar(`Exported ${rows.length} rows`, { variant: "success" });
    } catch (err) {
      enqueueSnackbar("Export failed", { variant: "error" });
    }
  };

  return (
    <Box>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          flexWrap="wrap"
          gap={2}
        >
          <Box>
            <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: -0.5 }}>
              Audit Logs
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Platform-wide audit trail of administrative actions
            </Typography>
          </Box>
          <Stack direction="row" gap={1}>
            <Tooltip title="Refresh">
              <IconButton
                onClick={() => refetch()}
                disabled={isFetching}
                sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}
              >
                <Refresh
                  fontSize="small"
                  sx={{
                    animation: isFetching ? "spin 1s linear infinite" : "none",
                    "@keyframes spin": { "100%": { transform: "rotate(360deg)" } },
                  }}
                />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<FileDownload />}
              onClick={handleExportCsv}
              disabled={items.length === 0}
              sx={{
                textTransform: "none",
                fontWeight: 600,
                borderColor: "divider",
                color: "text.secondary",
              }}
            >
              Export CSV
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* ── KPI Strip ───────────────────────────────────────────────────── */}
      <AuditStatsBar summary={stats} isLoading={statsLoading} />

      {/* ── Filter Card ─────────────────────────────────────────────────── */}
      <Card sx={{ mb: 2.5, borderRadius: 3 }}>
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            gap={2}
            alignItems={{ xs: "stretch", md: "center" }}
            flexWrap="wrap"
          >
            <TextField
              placeholder="Search module, action, entity…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              sx={{ minWidth: 260, flex: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ fontSize: 18, color: "text.disabled" }} />
                  </InputAdornment>
                ),
              }}
            />

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Module</InputLabel>
              <Select
                value={moduleFilter}
                label="Module"
                onChange={(e) => {
                  setModuleFilter(e.target.value);
                  setPage(0);
                }}
                startAdornment={<FilterList sx={{ fontSize: 16, mr: 0.5, color: "text.disabled" }} />}
              >
                <MenuItem value="">
                  <em>All Modules</em>
                </MenuItem>
                {AUDIT_MODULES.map((m) => (
                  <MenuItem key={m} value={m}>
                    {m}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Action</InputLabel>
              <Select
                value={actionFilter}
                label="Action"
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">
                  <em>All Actions</em>
                </MenuItem>
                {AUDIT_ACTION_TYPES.map((a) => (
                  <MenuItem key={a} value={a}>
                    {a}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="User ID"
              size="small"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setPage(0);
              }}
              sx={{ width: 120 }}
              type="number"
            />

            <TextField
              label="From"
              size="small"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(0);
              }}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160 }}
            />

            <TextField
              label="To"
              size="small"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(0);
              }}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160 }}
            />

            {hasActiveFilters && (
              <Button
                size="small"
                onClick={clearFilters}
                variant="outlined"
                color="inherit"
                startIcon={<ClearAll fontSize="small" />}
                sx={{ textTransform: "none" }}
              >
                Clear
              </Button>
            )}

            <Box sx={{ flex: 1 }} />

            <Stack direction="row" gap={1} alignItems="center">
              {stats && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${total.toLocaleString()} total`}
                  sx={{ fontWeight: 600 }}
                />
              )}
              {hasActiveFilters && (
                <Chip
                  size="small"
                  color="primary"
                  label="Filtered"
                  sx={{ fontWeight: 600 }}
                />
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <AuditLogsTable
        items={items}
        total={total}
        page={page}
        pageSize={pageSize}
        isLoading={isLoading}
        isFetching={isFetching}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onRowClick={setSelectedLog}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />

      {/* ── Detail Drawer ───────────────────────────────────────────────── */}
      <AuditDetailDrawer
        log={selectedLog}
        open={selectedLog !== null}
        onClose={() => setSelectedLog(null)}
      />
    </Box>
  );
}
