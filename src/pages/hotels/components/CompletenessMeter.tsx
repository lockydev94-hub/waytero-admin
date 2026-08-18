// ============================================================
// WAYTERO ADMIN — COMPLETENESS METER
// Doc Ref: 03_FRONTEND_DESIGN.md §3, §5
//
// Surfaces the server-computed readiness so an admin sees what is missing
// before pressing Submit rather than being rejected by it. The server stays
// authoritative — this only renders what /readiness returned.
// ============================================================
import { useState } from "react";
import {
  Box,
  Chip,
  CircularProgress,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Popover,
  Stack,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import { CheckCircle, ErrorOutline, RadioButtonUnchecked } from "@mui/icons-material";
import type { ReadinessReport } from "../../../services/hotel.service";

interface Props {
  percent: number;
  readiness?: ReadinessReport | null;
  variant?: "compact" | "ring";
  label?: string;
}

const toneFor = (p: number): "success" | "warning" | "error" =>
  p >= 100 ? "success" : p >= 50 ? "warning" : "error";

export default function CompletenessMeter({
  percent,
  readiness,
  variant = "compact",
  label,
}: Props) {
  const theme = useTheme();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const tone = toneFor(percent);
  const main = theme.palette[tone].main;
  const failing = (readiness?.checks ?? []).filter((c) => !c.passed);
  const interactive = Boolean(readiness);

  const open = (e: React.MouseEvent<HTMLElement>) => {
    if (!interactive) return;
    e.stopPropagation();
    setAnchor(e.currentTarget);
  };

  const body =
    variant === "ring" ? (
      <Box sx={{ position: "relative", display: "inline-flex" }}>
        <CircularProgress
          variant="determinate"
          value={Math.min(percent, 100)}
          size={52}
          thickness={4}
          sx={{ color: main }}
        />
        <Box
          sx={{
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            position: "absolute",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography variant="caption" fontWeight={800} sx={{ color: main }}>
            {percent}%
          </Typography>
        </Box>
      </Box>
    ) : (
      <Box sx={{ minWidth: 96 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.25 }}>
          <Typography variant="caption" fontWeight={700} sx={{ color: main }}>
            {percent}%
          </Typography>
          {failing.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {failing.length} left
            </Typography>
          )}
        </Stack>
        <LinearProgress
          variant="determinate"
          value={Math.min(percent, 100)}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: alpha(main, 0.15),
            "& .MuiLinearProgress-bar": { bgcolor: main, borderRadius: 3 },
          }}
        />
      </Box>
    );

  return (
    <>
      <Tooltip title={interactive ? "Click for the readiness checklist" : `${percent}% complete`}>
        <Box
          onClick={open}
          aria-label={`Readiness ${percent} percent${label ? ` — ${label}` : ""}`}
          sx={{ cursor: interactive ? "pointer" : "default", display: "inline-block" }}
        >
          {body}
        </Box>
      </Tooltip>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        PaperProps={{ sx: { borderRadius: 2, maxWidth: 360 } }}
      >
        <Box sx={{ p: 1.5, pb: 0.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2" fontWeight={800}>
              Readiness
            </Typography>
            <Chip
              size="small"
              label={readiness?.can_submit ? "Ready to submit" : "Not ready"}
              color={readiness?.can_submit ? "success" : "warning"}
              sx={{ fontWeight: 700 }}
            />
          </Stack>
        </Box>
        <List dense sx={{ pt: 0 }}>
          {(readiness?.checks ?? []).map((c) => (
            <ListItem key={c.key} alignItems="flex-start">
              <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                {c.passed ? (
                  <CheckCircle fontSize="small" color="success" />
                ) : c.blocks_submit ? (
                  <ErrorOutline fontSize="small" color="warning" />
                ) : (
                  <RadioButtonUnchecked fontSize="small" color="disabled" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={c.label}
                secondary={!c.passed ? c.hint : undefined}
                primaryTypographyProps={{
                  variant: "body2",
                  fontWeight: c.passed ? 400 : 600,
                }}
                secondaryTypographyProps={{ variant: "caption" }}
              />
            </ListItem>
          ))}
        </List>
      </Popover>
    </>
  );
}
