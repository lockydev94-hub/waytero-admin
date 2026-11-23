// ============================================================
// WAYTERO ADMIN — MPIN INPUT
// Six separate boxes instead of one free-text field: the PIN has a fixed
// length, so the shape of the control should say so before the admin types
// anything. Digits fill left to right, the next empty box carries the focus
// ring, and the sixth digit fires `onComplete` so the lock screen can submit
// without a second click.
//
// One transparent <input> sits over the boxes and does the real work, which
// keeps paste, backspace, arrows, mobile numeric keypads and screen readers
// behaving natively — the boxes are presentation only.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { Box, Button, Stack, Typography, alpha } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";

export const MPIN_LENGTH = 6;

type Tone = "dark" | "light";

const PALETTE: Record<
  Tone,
  {
    box: string;
    boxFilled: string;
    border: string;
    borderFilled: string;
    text: string;
    accent: string;
    label: string;
    hint: string;
    error: string;
  }
> = {
  light: {
    box: "#F8FAFC",
    boxFilled: "#EDF4FF",
    border: "#D6DEEA",
    borderFilled: "#B7CBEC",
    text: "#0F172A",
    accent: "#0F6FFF",
    label: "#64748B",
    hint: "#94A3B8",
    error: "#DC2626",
  },
  dark: {
    box: "rgba(255,255,255,0.05)",
    boxFilled: "rgba(76,141,255,0.18)",
    border: "rgba(255,255,255,0.14)",
    borderFilled: "rgba(127,176,255,0.55)",
    text: "#FFFFFF",
    accent: "#4C8DFF",
    label: "rgba(255,255,255,0.55)",
    hint: "rgba(255,255,255,0.45)",
    error: "#FF6B6B",
  },
};

const SIZES = {
  sm: { width: 40, height: 46, font: 17, gap: 1 },
  md: { width: 46, height: 52, font: 20, gap: 1 },
  lg: { width: 52, height: 58, font: 22, gap: 1.25 },
} as const;

interface MpinInputProps {
  value: string;
  onChange: (next: string) => void;
  /** Called with the full PIN as soon as the last box is filled. */
  onComplete?: (pin: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  error?: boolean;
  helperText?: string;
  tone?: Tone;
  accent?: string;
  size?: keyof typeof SIZES;
  label?: string;
  ariaLabel?: string;
}

export function MpinInput({
  value,
  onChange,
  onComplete,
  length = MPIN_LENGTH,
  disabled = false,
  autoFocus = false,
  error = false,
  helperText,
  tone = "light",
  accent,
  size = "md",
  label,
  ariaLabel,
}: MpinInputProps) {
  const [reveal, setReveal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const palette = PALETTE[tone];
  const dims = SIZES[size];
  const accentColor = accent ?? palette.accent;
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");
  const activeIndex = value.length >= length ? -1 : value.length;

  useEffect(() => {
    if (autoFocus && !disabled) inputRef.current?.focus();
  }, [autoFocus, disabled]);

  return (
    <Box sx={{ width: "100%" }}>
      {label && (
        <Typography
          component="span"
          sx={{
            display: "block",
            mb: 1,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: error ? palette.error : palette.label,
          }}
        >
          {label}
        </Typography>
      )}

      <Box sx={{ position: "relative" }}>
        <Stack
          direction="row"
          spacing={dims.gap}
          aria-hidden
          sx={{
            justifyContent: "center",
            opacity: disabled ? 0.55 : 1,
            animation: error ? "mpinShake 0.36s ease-in-out" : "none",
            "@keyframes mpinShake": {
              "0%, 100%": { transform: "translateX(0)" },
              "20%": { transform: "translateX(-6px)" },
              "40%": { transform: "translateX(6px)" },
              "60%": { transform: "translateX(-4px)" },
              "80%": { transform: "translateX(4px)" },
            },
          }}
        >
          {digits.map((digit, index) => {
            const isActive = !disabled && index === activeIndex;
            return (
              <Box
                key={index}
                sx={{
                  width: dims.width,
                  height: dims.height,
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  fontSize: dims.font,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                  color: palette.text,
                  bgcolor: digit ? palette.boxFilled : palette.box,
                  border: "2px solid",
                  borderColor: error
                    ? palette.error
                    : isActive
                      ? accentColor
                      : digit
                        ? palette.borderFilled
                        : palette.border,
                  boxShadow: isActive
                    ? `0 0 0 4px ${alpha(accentColor, tone === "dark" ? 0.22 : 0.16)}`
                    : "none",
                  transition:
                    "border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease",
                  userSelect: "none",
                }}
              >
                {digit ? (reveal ? digit : "•") : ""}
              </Box>
            );
          })}
        </Stack>

        <Box
          component="input"
          ref={inputRef}
          value={value}
          onChange={(event) => {
            const next = event.target.value
              .replace(/\D/g, "")
              .slice(0, length);
            onChange(next);
            if (next.length === length) onComplete?.(next);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && value.length === length) {
              onComplete?.(value);
            }
          }}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          aria-label={ariaLabel ?? label ?? "Unlock PIN"}
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0,
            border: 0,
            p: 0,
            m: 0,
            background: "transparent",
            color: "transparent",
            caretColor: "transparent",
            cursor: disabled ? "not-allowed" : "text",
            fontSize: 16,
          }}
        />
      </Box>

      <Stack direction="row" justifyContent="center" sx={{ mt: 0.75 }}>
        <Button
          type="button"
          size="small"
          disableRipple
          onClick={() => setReveal((current) => !current)}
          startIcon={
            reveal ? (
              <VisibilityOff sx={{ fontSize: 15 }} />
            ) : (
              <Visibility sx={{ fontSize: 15 }} />
            )
          }
          sx={{
            minWidth: 0,
            py: 0.25,
            px: 1,
            fontSize: 11.5,
            textTransform: "none",
            color: palette.hint,
            "&:hover": { bgcolor: "transparent", color: accentColor },
          }}
        >
          {reveal ? "Hide PIN" : "Show PIN"}
        </Button>
      </Stack>

      {helperText && (
        <Typography
          sx={{
            mt: 0.5,
            fontSize: 12,
            textAlign: "center",
            color: error ? palette.error : palette.hint,
          }}
        >
          {helperText}
        </Typography>
      )}
    </Box>
  );
}
