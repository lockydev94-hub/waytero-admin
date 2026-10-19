// ============================================================
// WAYTERO ADMIN — MY WORKING HOURS PANEL (profile → hours tab)
// Doc: Admin Portal §39 Security — own attendance record.
//
// Any staff role can read this; only the rows about the calling account come
// back (the route is subject-scoped by the JWT). The super-admin-wide report is
// a different page.
//
// "Active" is time the portal saw real input, so a short day usually means the
// admin stepped away and the idle lock took over — not that they were away all
// day. The column header says so rather than leaving it to be guessed.
// ============================================================
import { useEffect, useState } from "react";
import {
  Alert, Box, Chip, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from "@mui/material";
import { workHoursService, type StaffWorkDay, type WorkHoursTotals } from "../../services/workHours.service";
import { apiErrorMessage } from "../../utils/apiError";

const WINDOW_DAYS = 30;

function timeOf(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} m`;
}

export function MyHoursPanel() {
  const [items, setItems] = useState<StaffWorkDay[]>([]);
  const [totals, setTotals] = useState<WorkHoursTotals | null>(null);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    workHoursService
      .getMyWorkHours(WINDOW_DAYS)
      .then((data) => {
        if (!alive) return;
        setItems(data.items);
        setTotals(data.period_totals);
        setRange({ from: data.date_from, to: data.date_to });
      })
      .catch((err) => {
        if (!alive) return;
        setError(apiErrorMessage(err, "Could not load your working hours."));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <Alert severity="error" sx={{ borderRadius: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        sx={{ mb: 2 }}
      >
        <Typography variant="body2" color="text.secondary">
          {range
            ? `Days from ${range.from} to ${range.to}`
            : `Your last ${WINDOW_DAYS} days in the dashboard`}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Chip
            size="small"
            label={totals ? `${totals.days} day${totals.days === 1 ? "" : "s"}` : "—"}
          />
          <Chip
            size="small"
            color="primary"
            label={totals ? `${minutesLabel(totals.active_minutes)} active` : "—"}
          />
        </Stack>
      </Stack>

      <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>First sign-in</TableCell>
              <TableCell>End of day</TableCell>
              <TableCell align="right">Active time</TableCell>
              <TableCell align="right">Sessions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.secondary">
                    Loading…
                  </Typography>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.secondary">
                    No dashboard time recorded in this window yet.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.work_date}>
                  <TableCell sx={{ fontWeight: 600 }}>{row.work_date}</TableCell>
                  <TableCell>{timeOf(row.first_login_at)}</TableCell>
                  <TableCell>{timeOf(row.last_logout_at)}</TableCell>
                  <TableCell align="right">{minutesLabel(row.active_minutes)}</TableCell>
                  <TableCell align="right">{row.session_count}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
        Active time counts only the minutes this dashboard saw you working —
        mouse, keyboard or scroll. Idle gaps and locked screens are not
        included, so a busy day with a long meeting reads shorter than it felt.
      </Typography>
    </Box>
  );
}
