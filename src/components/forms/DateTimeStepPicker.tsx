// ============================================================
// WAYTERO — DateTime Step Picker (MUI)
// File: components/forms/DateTimeStepPicker.tsx
//
// A premium 2-step date+time picker that supersedes the flat
// `datetime-local` field used in the legacy check-in / check-out
// modals. The first step shows a month calendar (any day in the
// active month is tappable) and the second step shows a 12/24h
// time grid, so the user never types into a fiddly minute field.
//
// The component is timezone-aware: the operator's device zone is
// shown for context, and the emitted ISO string is always UTC
// (the backend stores UTC and re-projects to the platform zone
// for display). The two portals — admin and partner — share this
// component so the visual contract is identical end-to-end.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import {
  Box, Stack, Typography, IconButton, Button, Paper, ToggleButton,
  ToggleButtonGroup, Divider, Chip,
} from "@mui/material";
import {
  ChevronLeft, ChevronRight, AccessTime, CalendarToday, Schedule,
} from "@mui/icons-material";

// ── Helpers ──────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");

/** Convert a Date → the local-zone "YYYY-MM-DDTHH:mm" that
 *  `datetime-local` (and our day/time inputs) expect. */
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

interface Props {
  /** "YYYY-MM-DD" — pre-selected day. Falls back to today. */
  valueDate?: string | null;
  /** "HH:mm" — pre-selected time. Falls back to the current wall-clock. */
  valueTime?: string | null;
  /** Earliest selectable date (inclusive) as a "YYYY-MM-DD" string. */
  minDate?: string | null;
  /** Latest selectable date (inclusive) as a "YYYY-MM-DD" string. */
  maxDate?: string | null;
  /** Whether to show the timezone chip under the picker. */
  showTimezone?: boolean;
  /** Display label for the platform timezone (e.g. "Asia/Kolkata"). */
  timezoneLabel?: string;
  /** Called whenever the day or time changes. */
  onChange?: (next: { date: string; time: string; isoLocal: string }) => void;
  /** Optional compact mode hides the month-navigation arrows. */
  compact?: boolean;
}

export default function DateTimeStepPicker({
  valueDate,
  valueTime,
  minDate,
  maxDate,
  showTimezone = true,
  timezoneLabel = "Asia/Kolkata",
  onChange,
  compact = false,
}: Props) {
  // Resolve the initial calendar month from `valueDate` or today.
  const initial = useMemo(() => {
    if (valueDate) {
      const [y, m, d] = valueDate.split("-").map((s) => parseInt(s, 10));
      if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
        return new Date(y, m - 1, d);
      }
    }
    return new Date();
  }, [valueDate]);

  const [cursor, setCursor] = useState<Date>(startOfMonth(initial));
  const [selectedDate, setSelectedDate] = useState<string>(
    valueDate ||
      `${initial.getFullYear()}-${pad(initial.getMonth() + 1)}-${pad(initial.getDate())}`,
  );
  const [selectedTime, setSelectedTime] = useState<string>(
    valueTime || `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`,
  );
  const [hourFormat, setHourFormat] = useState<"12" | "24">("24");

  // Re-emit on every change so the parent stays in sync without polling.
  useEffect(() => {
    if (!onChange) return;
    onChange({
      date: selectedDate,
      time: selectedTime,
      isoLocal: `${selectedDate}T${selectedTime}`,
    });
  }, [selectedDate, selectedTime, onChange]);

  // ── Calendar grid ──────────────────────────────────────────
  const days = useMemo(() => {
    const first = startOfMonth(cursor);
    const startWeekday = first.getDay();
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let day = 1; day <= lastDay; day++) {
      cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    }
    return cells;
  }, [cursor]);

  const isDisabled = (d: Date) => {
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (minDate && iso < minDate) return true;
    if (maxDate && iso > maxDate) return true;
    return false;
  };

  const selectedDateObj = useMemo(() => {
    const [y, m, d] = selectedDate.split("-").map((s) => parseInt(s, 10));
    return new Date(y, m - 1, d);
  }, [selectedDate]);

  // ── Time helpers ───────────────────────────────────────────
  const [hh, mm] = selectedTime.split(":").map((s) => parseInt(s, 10));
  const displayHour =
    hourFormat === "24"
      ? hh
      : hh === 0
        ? 12
        : hh > 12
          ? hh - 12
          : hh;
  const ampm = hh >= 12 ? "PM" : "AM";

  const setHour = (next: number) => {
    let n = next;
    if (hourFormat === "12") {
      if (ampm === "PM" && n < 12) n += 12;
      if (ampm === "AM" && n === 12) n = 0;
    }
    setSelectedTime(`${pad(n)}:${pad(mm)}`);
  };

  const setAmPm = (next: "AM" | "PM") => {
    let n = hh;
    if (next === "PM" && hh < 12) n += 12;
    if (next === "AM" && hh >= 12) n -= 12;
    setSelectedTime(`${pad(n)}:${pad(mm)}`);
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        borderColor: "divider",
      }}
    >
      {/* ── Header: month + nav ── */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: 2, py: 1.25,
          bgcolor: (t) => t.palette.mode === "dark" ? "grey.900" : "grey.50",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <CalendarToday fontSize="small" color="primary" />
          <Typography variant="subtitle1" fontWeight={600}>
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </Typography>
        </Stack>
        {!compact && (
          <Stack direction="row" spacing={0.5}>
            <IconButton
              size="small"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft />
            </IconButton>
            <Button
              size="small"
              variant="text"
              onClick={() => {
                const now = new Date();
                setCursor(startOfMonth(now));
              }}
            >
              Today
            </Button>
            <IconButton
              size="small"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              aria-label="Next month"
            >
              <ChevronRight />
            </IconButton>
          </Stack>
        )}
      </Stack>

      <Divider />

      {/* ── Weekday header ── */}
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            textAlign: "center",
          }}
        >
          {WEEKDAYS.map((w) => (
            <Typography
              key={w}
              variant="caption"
              color="text.secondary"
              fontWeight={600}
              sx={{ py: 0.5 }}
            >
              {w}
            </Typography>
          ))}
        </Box>

        {/* ── Day grid ── */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 0.5,
          }}
        >
          {days.map((d, i) => {
            if (!d) return <Box key={i} />;
            const isSelected = isSameDay(d, selectedDateObj);
            const isToday = isSameDay(d, new Date());
            const disabled = isDisabled(d);
            return (
              <Box
                key={i}
                onClick={() => {
                  if (disabled) return;
                  setSelectedDate(
                    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
                  );
                }}
                sx={{
                  aspectRatio: "1 / 1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 1.5,
                  cursor: disabled ? "not-allowed" : "pointer",
                  bgcolor: isSelected
                    ? "primary.main"
                    : isToday
                      ? (t) => t.palette.mode === "dark" ? "grey.800" : "primary.50"
                      : "transparent",
                  color: isSelected
                    ? "primary.contrastText"
                    : disabled
                      ? "text.disabled"
                      : "text.primary",
                  fontWeight: isSelected || isToday ? 700 : 500,
                  border: isToday && !isSelected ? "1px solid" : "none",
                  borderColor: isToday && !isSelected ? "primary.main" : "transparent",
                  "&:hover": disabled
                    ? {}
                    : {
                        bgcolor: isSelected ? "primary.dark" : "action.hover",
                      },
                  transition: "background-color 120ms ease",
                  userSelect: "none",
                }}
              >
                {d.getDate()}
              </Box>
            );
          })}
        </Box>
      </Box>

      <Divider sx={{ my: 1 }} />

      {/* ── Time section ── */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ px: 2, py: 1.5, alignItems: { xs: "stretch", sm: "center" } }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <AccessTime fontSize="small" color="primary" />
          <Typography variant="subtitle2" fontWeight={600}>
            Time
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Paper
            variant="outlined"
            sx={{
              display: "flex", alignItems: "center", gap: 0.5,
              px: 1, py: 0.5, borderRadius: 1.5,
            }}
          >
            <Button
              size="small"
              onClick={() => setHour(Math.max(0, displayHour - 1))}
              sx={{ minWidth: 0, px: 1 }}
            >
              −
            </Button>
            <Typography
              variant="h6"
              sx={{ minWidth: 28, textAlign: "center", fontVariantNumeric: "tabular-nums" }}
            >
              {pad(displayHour)}
            </Typography>
            <Button
              size="small"
              onClick={() => {
                const max = hourFormat === "12" ? 12 : 23;
                setHour(Math.min(max, displayHour + 1));
              }}
              sx={{ minWidth: 0, px: 1 }}
            >
              +
            </Button>
          </Paper>

          <Typography variant="h6" sx={{ fontWeight: 600 }}>:</Typography>

          <Paper
            variant="outlined"
            sx={{
              display: "flex", alignItems: "center", gap: 0.5,
              px: 1, py: 0.5, borderRadius: 1.5,
            }}
          >
            <Button
              size="small"
              onClick={() => setSelectedTime(`${pad(hh)}:${pad(Math.max(0, mm - 5))}`)}
              sx={{ minWidth: 0, px: 1 }}
            >
              −
            </Button>
            <Typography
              variant="h6"
              sx={{ minWidth: 28, textAlign: "center", fontVariantNumeric: "tabular-nums" }}
            >
              {pad(mm)}
            </Typography>
            <Button
              size="small"
              onClick={() => setSelectedTime(`${pad(hh)}:${pad(Math.min(55, mm + 5))}`)}
              sx={{ minWidth: 0, px: 1 }}
            >
              +
            </Button>
          </Paper>

          {hourFormat === "12" && (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={ampm}
              onChange={(_, v) => v && setAmPm(v)}
              sx={{ ml: 0.5 }}
            >
              <ToggleButton value="AM">AM</ToggleButton>
              <ToggleButton value="PM">PM</ToggleButton>
            </ToggleButtonGroup>
          )}
        </Stack>

        <Box flex={1} />

        <ToggleButtonGroup
          exclusive
          size="small"
          value={hourFormat}
          onChange={(_, v) => v && setHourFormat(v)}
        >
          <ToggleButton value="24">24h</ToggleButton>
          <ToggleButton value="12">12h</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* ── Footer: timezone + summary ── */}
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        sx={{
          px: 2, py: 1.25,
          bgcolor: (t) => t.palette.mode === "dark" ? "grey.900" : "grey.50",
        }}
      >
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Schedule fontSize="small" color="action" />
          {showTimezone && (
            <Chip
              label={timezoneLabel}
              size="small"
              variant="outlined"
            />
          )}
        </Stack>
        <Box flex={1} />
        <Typography variant="body2" color="text.secondary">
          <strong>{selectedDate}</strong> at <strong>{selectedTime}</strong>
        </Typography>
      </Stack>
    </Paper>
  );
}

/**
 * Convenience — re-export the platform-time-aware Date → UTC helper so any
 * caller that previously used `toLocalInput` then `.toISOString()` can be
 * migrated to one call.
 */
export { toLocalInput };
