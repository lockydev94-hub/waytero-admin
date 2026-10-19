// ============================================================
// WAYTERO ADMIN — STAFF WORKING HOURS PAGE (SUPER_ADMIN)
// Doc: Admin Portal §39 Security — leave / attendance record.
//
// Reads staff_work_daily (migration 0084), one row per person per
// platform-timezone day. `active` is time the portal saw real input, so a day
// with a long meeting reads shorter than it felt — the record answers "was this
// account working in the dashboard", not "was this person busy".
//
// A non-super-admin reaching this URL is bounced by RouteGuard to
// /unauthorized; the API gate is the server's, this page is only the view.
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Alert, Box, Button, Chip, MenuItem, Paper, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { workHoursService, type StaffWorkDay, type WorkHoursTotals } from "../../services/workHours.service";
import { staffService, type StaffUser } from "../../services/admin.service";
import { apiErrorMessage } from "../../utils/apiError";
import { useAuthStore } from "../../stores/authStore";

const PAGE_SIZE = 50;

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: toYmd(from), to: toYmd(to) };
}

function timeOf(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} m`;
}

const roleLabel = (userType: string) => userType.replace(/_/g, " ").toLowerCase();

export default function WorkHoursPage() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.user_type === "SUPER_ADMIN";
  const initial = useMemo(defaultRange, []);
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [userId, setUserId] = useState<string>("");
  const [page, setPage] = useState(1);

  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [items, setItems] = useState<StaffWorkDay[]>([]);
  const [totals, setTotals] = useState<WorkHoursTotals | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    let alive = true;
    staffService
      .list({ page: 1, page_size: 200 })
      .then((res) => {
        if (alive) setStaff(res.items);
      })
      .catch(() => {
        // The staff filter is a convenience; the report still works without it.
      });
    return () => {
      alive = false;
    };
  }, [isSuperAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await workHoursService.listStaffWorkHours({
        date_from: dateFrom,
        date_to: dateTo,
        user_id: userId || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      setItems(res.items);
      setTotals(res.period_totals);
      setTotal(res.total);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load the working-hours report."));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, userId, page]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    if (!dateFrom || !dateTo || dateTo < dateFrom) return;
    void load();
  }, [load, isSuperAdmin, dateFrom, dateTo]);

  const reversed = Boolean(dateFrom && dateTo && dateTo < dateFrom);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // The report reads everybody's rows, so the server gate is SUPER_ADMIN. The
  // client check keeps a wrong role off a page that would only show errors.
  if (!isSuperAdmin) return <Navigate to="/unauthorized" replace />;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Staff working hours</Typography>
        <Typography variant="body2" color="text.secondary">
          Dashboard sign-in, sign-out and actively worked minutes per person per
          day
        </Typography>
      </Box>

      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="flex-end">
          <TextField
            label="From"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            disabled={loading}
            sx={{ minWidth: 180 }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="To"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            disabled={loading}
            sx={{ minWidth: 180 }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            select
            label="Staff member"
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              setPage(1);
            }}
            disabled={loading}
            sx={{ minWidth: 240, flexGrow: 1 }}
            SelectProps={{ displayEmpty: true }}
          >
            <MenuItem value="">
              <Box component="span" fontStyle="italic">
                All staff
              </Box>
            </MenuItem>
            {staff.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {[s.first_name, s.last_name].filter(Boolean).join(" ") || "Unnamed"}
                {s.user_code ? ` · ${s.user_code}` : ""}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="outlined" onClick={() => void load()} disabled={loading || reversed}>
            Refresh
          </Button>
        </Stack>
        {reversed && (
          <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
            The end date is before the start date — pick a range the other way
            round.
          </Alert>
        )}
      </Paper>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Chip size="small" label={totals ? `${totals.days} day-records` : "—"} />
        <Chip size="small" label={totals ? `${totals.staff_count} staff` : "—"} />
        <Chip
          size="small"
          color="primary"
          label={totals ? `${minutesLabel(totals.active_minutes)} active in range` : "—"}
        />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Staff member</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>First sign-in</TableCell>
              <TableCell>End of day</TableCell>
              <TableCell align="right">Active</TableCell>
              <TableCell align="right">Sessions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary">
                    Loading…
                  </Typography>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary">
                    No dashboard time recorded for this range.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={`${row.work_date}-${row.user_id}`}>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{row.work_date}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {row.full_name || "Unnamed"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.user_code ?? "—"}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>{roleLabel(row.user_type)}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{timeOf(row.first_login_at)}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{timeOf(row.last_logout_at)}</TableCell>
                  <TableCell align="right">{minutesLabel(row.active_minutes)}</TableCell>
                  <TableCell align="right">{row.session_count}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="flex-end" sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {total} row{total === 1 ? "" : "s"} · page {page} of {pages}
        </Typography>
        <Button size="small" variant="outlined" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
          Back
        </Button>
        <Button size="small" variant="outlined" disabled={page >= pages || loading} onClick={() => setPage((p) => p + 1)}>
          Next
        </Button>
      </Stack>
    </Box>
  );
}
