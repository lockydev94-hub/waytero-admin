// ============================================================
// WAYTERO ADMIN — CITY SELECT
// The active cities from master data, in a small FormControl.
//
// Screens written before this each fetched and rendered the list
// themselves; this is the one copy that new screens should use.
// ============================================================
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { useCities } from "../../hooks/useCities";

interface CitySelectProps {
  value: number | "";
  onChange: (cityId: number) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

export function CitySelect({
  value,
  onChange,
  label = "City",
  required = false,
  disabled = false,
  fullWidth = true,
}: CitySelectProps) {
  const { cities, isLoading } = useCities();

  return (
    <FormControl size="small" fullWidth={fullWidth} disabled={disabled || isLoading} required={required}>
      <InputLabel>{isLoading ? "Loading cities…" : label}</InputLabel>
      <Select
        value={value}
        label={isLoading ? "Loading cities…" : label}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {cities.map((c) => (
          <MenuItem key={c.id} value={c.id}>
            {c.name}
            {c.state_name ? ` — ${c.state_name}` : ""}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default CitySelect;
