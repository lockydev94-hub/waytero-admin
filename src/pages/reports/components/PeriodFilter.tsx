// ============================================================
// WAYTERO ADMIN — SHARED PERIOD FILTER COMPONENT
// ============================================================
import {
  Stack, ToggleButton, ToggleButtonGroup, TextField, Typography,
  alpha, useTheme,
} from "@mui/material";

export type PeriodType = "today" | "week" | "month" | "year" | "custom" | "all";

interface Props {
  value: PeriodType;
  onChange: (v: PeriodType) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (v: string) => void;
  onDateToChange?: (v: string) => void;
}

const PERIODS: { value: PeriodType; label: string }[] = [
  { value: "today",  label: "Today" },
  { value: "week",   label: "This Week" },
  { value: "month",  label: "This Month" },
  { value: "year",   label: "This Year" },
  { value: "all",    label: "All Time" },
  { value: "custom", label: "Custom" },
];

export default function PeriodFilter({ value, onChange, dateFrom = "", dateTo = "", onDateFromChange, onDateToChange }: Props) {
  const theme = useTheme();

  return (
    <Stack direction={{ xs: "column", sm: "row" }} gap={1.5} alignItems={{ sm: "center" }} flexWrap="wrap">
      <ToggleButtonGroup
        value={value}
        exclusive
        onChange={(_, v) => v && onChange(v)}
        size="small"
        sx={{
          "& .MuiToggleButton-root": {
            border: `1px solid ${theme.palette.divider}`,
            fontWeight: 600,
            fontSize: "0.8rem",
            px: 2,
            py: 0.75,
            color: "text.secondary",
            "&.Mui-selected": {
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: "primary.main",
              borderColor: theme.palette.primary.main,
            },
          },
        }}
      >
        {PERIODS.map(p => (
          <ToggleButton key={p.value} value={p.value}>{p.label}</ToggleButton>
        ))}
      </ToggleButtonGroup>

      {value === "custom" && (
        <Stack direction="row" gap={1} alignItems="center">
          <TextField
            size="small"
            type="date"
            label="From"
            value={dateFrom}
            onChange={e => onDateFromChange?.(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 145 }}
          />
          <Typography color="text.secondary" fontSize={12}>to</Typography>
          <TextField
            size="small"
            type="date"
            label="To"
            value={dateTo}
            onChange={e => onDateToChange?.(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 145 }}
          />
        </Stack>
      )}
    </Stack>
  );
}
