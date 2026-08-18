// ============================================================
// WAYTERO ADMIN — CUSTOMER CARE PAGE
// Main page: stats bar + logs table + modals + profile drawer
// Route: /customer-care
// ============================================================
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Stack, Typography, Button, TextField, Select,
  MenuItem, FormControl, InputLabel, InputAdornment,
  IconButton, Tooltip, alpha, useTheme, Chip, Snackbar, Alert,
} from "@mui/material";
import {
  HeadsetMic, Add, Search, Refresh, FilterList,
  Close as CloseIcon,
} from "@mui/icons-material";

import { customerCareService, CareLogItem, CareStats, CustomerLookup } from "../../services/customerCare.service";

// components
import CareStatsBar        from "./components/CareStatsBar";
import CareLogsTable       from "./components/CareLogsTable";
import CustomerLookupModal from "./components/CustomerLookupModal";
import IssueLogModal       from "./components/IssueLogModal";
import CustomerProfileDrawer from "./components/CustomerProfileDrawer";
import LogDetailModal      from "./components/LogDetailModal";

// ── Types ─────────────────────────────────────────────────────
interface LogsState {
  items: CareLogItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export default function CustomerCarePage() {
  const theme    = useTheme();
  const navigate = useNavigate();

  // ── Data state ──────────────────────────────────────────────
  const [stats,     setStats]     = useState<CareStats>();
  const [logs,      setLogs]      = useState<LogsState>({ items: [], total: 0, page: 1, page_size: 20, total_pages: 1 });
  const [loading,   setLoading]   = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  // ── Filter state ────────────────────────────────────────────
  const [search,    setSearch]    = useState("");
  const [statusFilter,  setStatusFilter]  = useState("");
  const [issueTypeFilter, setIssueTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // ── Modal/Drawer state ──────────────────────────────────────
  const [lookupOpen,   setLookupOpen]   = useState(false);
  const [issueOpen,    setIssueOpen]    = useState(false);
  const [detailOpen,   setDetailOpen]   = useState(false);
  const [drawerOpen,   setDrawerOpen]   = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerLookup | null>(null);
  const [selectedLog,      setSelectedLog]      = useState<CareLogItem | null>(null);

  // ── Snackbar ────────────────────────────────────────────────
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: "success" | "error" }>({
    open: false, msg: "", sev: "success",
  });

  // ── Load stats ───────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const s = await customerCareService.stats();
      setStats(s);
    } catch {}
    finally { setStatsLoading(false); }
  }, []);

  // ── Load logs ────────────────────────────────────────────────
  const loadLogs = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const data = await customerCareService.list({
        page, page_size: pageSize,
        status: statusFilter || undefined,
        issue_type: issueTypeFilter || undefined,
        priority: priorityFilter || undefined,
        search: search || undefined,
      });
      setLogs({ ...data });
    } catch {}
    finally { setLoading(false); }
  }, [search, statusFilter, issueTypeFilter, priorityFilter]);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadLogs(1, logs.page_size);
  }, [statusFilter, issueTypeFilter, priorityFilter]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { loadLogs(1, logs.page_size); }, 500);
    return () => clearTimeout(t);
  }, [search]);

  function refresh() { loadStats(); loadLogs(logs.page, logs.page_size); }

  // ── Customer care session flow ───────────────────────────────
  function handleCustomerSelected(
    customer: CustomerLookup,
    action: "booking" | "issue",
    service?: "CAB" | "HOTEL" | "TOUR",
  ) {
    setSelectedCustomer(customer);
    if (action === "booking") {
      // Route to the chosen service's dedicated booking page.
      if (service === "HOTEL") {
        navigate(`/customer-care/hotel-booking/${customer.customer_id}`);
      } else if (service === "TOUR") {
        navigate(`/customer-care/tour-booking/${customer.customer_id}`);
      } else {
        navigate(`/customer-care/cab-booking/${customer.customer_id}`);
      }
    } else {
      setIssueOpen(true);
    }
  }

  function handleViewLog(log: CareLogItem) {
    // View log detail — open profile drawer with customer context
    setSelectedLog(log);
    if (log.customer_id) {
      setSelectedCustomer({
        found: true,
        customer_id: log.customer_id,
        full_name: log.customer_name || undefined,
        mobile_number: log.customer_mobile || undefined,
      });
    }
    setDetailOpen(true);
  }

  function handleEditLog(log: CareLogItem) {
    setSelectedLog(log);
    setDetailOpen(true);
  }

  function handleLogCreated(log: CareLogItem) {
    setSnack({ open: true, msg: `Issue logged — ${log.log_number}`, sev: "success" });
    refresh();
  }

  function handleLogUpdated(log: CareLogItem) {
    setSnack({ open: true, msg: `Log ${log.log_number} updated`, sev: "success" });
    setLogs(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === log.id ? log : i),
    }));
    loadStats();
  }

  const activeFilters = [statusFilter, issueTypeFilter, priorityFilter].filter(Boolean).length;

  return (
    <Box>
      {/* ── Page Header ─────────────────────────────────────── */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
          border: "1px solid", borderColor: alpha(theme.palette.primary.main, 0.12),
          borderRadius: 3, p: 3, mb: 3,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Stack direction="row" alignItems="center" gap={2}>
            <Box sx={{
              width: 48, height: 48, borderRadius: 2.5,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              display: "flex", alignItems: "center", justifyContent: "center", boxShadow: 3,
            }}>
              <HeadsetMic sx={{ color: "#fff", fontSize: 26 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={800} letterSpacing={-0.5}>Customer Care</Typography>
              <Typography variant="body2" color="text.secondary">
                Manage customer sessions, bookings & issues
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" gap={1.5} flexWrap="wrap">
            <Tooltip title="Refresh">
              <IconButton onClick={refresh} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setLookupOpen(true)}
              sx={{
                borderRadius: 2.5, textTransform: "none", fontWeight: 700, px: 2.5,
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`,
              }}
            >
              New Session
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* ── Stats Bar ───────────────────────────────────────── */}
      <Box mb={3}>
        <CareStatsBar stats={stats} loading={statsLoading} />
      </Box>

      {/* ── Filters Row ─────────────────────────────────────── */}
      <Stack direction="row" gap={1.5} mb={2} flexWrap="wrap" alignItems="center">
        <TextField
          size="small"
          placeholder="Search by name or mobile…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch("")}><CloseIcon fontSize="small" /></IconButton>
              </InputAdornment>
            ) : null,
            sx: { borderRadius: 2.5 },
          }}
          sx={{ minWidth: 260, flex: 1 }}
        />

        <Button
          variant={showFilters ? "contained" : "outlined"}
          startIcon={<FilterList />}
          onClick={() => setShowFilters(v => !v)}
          sx={{ borderRadius: 2.5, textTransform: "none", fontWeight: 600, minWidth: 110 }}
          endIcon={activeFilters > 0 ? <Chip label={activeFilters} size="small" color="error" sx={{ height: 18, fontSize: 11, fontWeight: 800 }} /> : null}
        >
          Filters
        </Button>

        {(statusFilter || issueTypeFilter || priorityFilter) && (
          <Button size="small" onClick={() => { setStatusFilter(""); setIssueTypeFilter(""); setPriorityFilter(""); }}
            sx={{ textTransform: "none", color: "error.main" }}>
            Clear
          </Button>
        )}
      </Stack>

      {/* ── Filter dropdowns ─────────────────────────────────── */}
      {showFilters && (
        <Stack direction="row" gap={2} mb={2.5} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} label="Status" sx={{ borderRadius: 2 }}>
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="OPEN">Open</MenuItem>
              <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
              <MenuItem value="RESOLVED">Resolved</MenuItem>
              <MenuItem value="CLOSED">Closed</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Issue Type</InputLabel>
            <Select value={issueTypeFilter} onChange={e => setIssueTypeFilter(e.target.value)} label="Issue Type" sx={{ borderRadius: 2 }}>
              <MenuItem value="">All Types</MenuItem>
              <MenuItem value="BOOKING_ISSUE">Booking Issue</MenuItem>
              <MenuItem value="PAYMENT_ISSUE">Payment Issue</MenuItem>
              <MenuItem value="INQUIRY">Inquiry</MenuItem>
              <MenuItem value="COMPLAINT">Complaint</MenuItem>
              <MenuItem value="OTHER">Other</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Priority</InputLabel>
            <Select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} label="Priority" sx={{ borderRadius: 2 }}>
              <MenuItem value="">All Priorities</MenuItem>
              <MenuItem value="LOW">Low</MenuItem>
              <MenuItem value="MEDIUM">Medium</MenuItem>
              <MenuItem value="HIGH">High</MenuItem>
              <MenuItem value="URGENT">Urgent</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      )}

      {/* ── Logs Table ──────────────────────────────────────── */}
      <CareLogsTable
        items={logs.items}
        total={logs.total}
        page={logs.page}
        pageSize={logs.page_size}
        loading={loading}
        onPageChange={(p) => { setLogs(prev => ({ ...prev, page: p })); loadLogs(p, logs.page_size); }}
        onPageSizeChange={(s) => { setLogs(prev => ({ ...prev, page_size: s })); loadLogs(1, s); }}
        onView={handleViewLog}
        onEdit={handleEditLog}
      />

      {/* ── Modals ──────────────────────────────────────────── */}
      <CustomerLookupModal
        open={lookupOpen}
        onClose={() => setLookupOpen(false)}
        onCustomerSelected={handleCustomerSelected}
      />

      <IssueLogModal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        customer={selectedCustomer}
        onCreated={handleLogCreated}
      />

      <LogDetailModal
        open={detailOpen}
        log={selectedLog}
        onClose={() => setDetailOpen(false)}
        onUpdated={handleLogUpdated}
      />

      <CustomerProfileDrawer
        open={drawerOpen}
        customer={selectedCustomer}
        onClose={() => setDrawerOpen(false)}
        onCreateBooking={(c, service) => {
          setDrawerOpen(false);
          if (service === "HOTEL") navigate(`/customer-care/hotel-booking/${c.customer_id}`);
          else if (service === "TOUR") navigate(`/customer-care/tour-booking/${c.customer_id}`);
          else navigate(`/customer-care/cab-booking/${c.customer_id}`);
        }}
        onLogIssue={(c) => { setSelectedCustomer(c); setDrawerOpen(false); setIssueOpen(true); }}
      />

      {/* ── Snackbar ─────────────────────────────────────────── */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={snack.sev} variant="filled" sx={{ borderRadius: 2.5 }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
