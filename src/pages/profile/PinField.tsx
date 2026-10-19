// ============================================================
// WAYTERO ADMIN — SECRET FIELD
// Profile-tab input for a PIN, a password or an OTP: digits-only when
// `numeric`, masked by default with a show/hide toggle, and never written
// anywhere but the request body.
// ============================================================
import { useState } from "react";
import {
  IconButton, InputAdornment, OutlinedInput, FormControl, FormHelperText,
  InputLabel,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";

interface PinFieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  /** digits only, and how many are allowed */
  numeric?: boolean;
  minLength?: number;
  maxLength?: number;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
}

export function PinField({
  label,
  value,
  onChange,
  numeric = true,
  minLength = 1,
  maxLength = numeric ? 12 : 128,
  error = false,
  helperText,
  disabled = false,
}: PinFieldProps) {
  const [show, setShow] = useState(false);

  return (
    <FormControl fullWidth error={error} disabled={disabled}>
      <InputLabel shrink>{label}</InputLabel>
      <OutlinedInput
        label={label}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) =>
          onChange(
            numeric
              ? e.target.value.replace(/\D/g, "").slice(0, maxLength)
              : e.target.value.slice(0, maxLength)
          )
        }
        inputProps={{
          inputMode: numeric ? "numeric" : "text",
          autoComplete: "off",
          minLength,
        }}
        endAdornment={
          <InputAdornment position="end">
            <IconButton
              size="small"
              onClick={() => setShow((v) => !v)}
              edge="end"
              aria-label={show ? "Hide" : "Show"}
            >
              {show ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
            </IconButton>
          </InputAdornment>
        }
        sx={{ fontVariantNumeric: "tabular-nums" }}
      />
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
}
