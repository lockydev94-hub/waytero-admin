// ============================================================
// WAYTERO ADMIN — GST DISABLED STATE (reports)
// Shown inside the Reports GST/TDS tabs (and reused wherever a
// tax surface needs it) when the platform-level GST_ENABLED
// config is OFF. Mirrors the "feature not present" semantics —
// no tax was charged, so there is nothing to report.
// ============================================================
import { Box, Stack, Typography, alpha, useTheme } from "@mui/material";
import { Receipt } from "@mui/icons-material";

export default function GstDisabledState() {
  const theme = useTheme();
  return (
    <Box sx={{
      p: 5, borderRadius: 2, textAlign: "center",
      bgcolor: "background.paper",
      border: `1px dashed ${theme.palette.warning.main}`,
    }}>
      <Stack alignItems="center" spacing={1}>
        <Box sx={{
          width: 56, height: 56, borderRadius: 2.5,
          bgcolor: alpha(theme.palette.warning.main, 0.1),
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Receipt sx={{ fontSize: 28, color: theme.palette.warning.main }} />
        </Box>
        <Typography variant="h6" fontWeight={800}>GST is not enabled</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480 }}>
          Platform tax is turned off, so no GST was charged on bookings and this
          report has no data. Enable <strong>GST</strong> from Settings → Platform →
          Tax/GST Configuration — once enabled, tax invoices are raised on new
          trips and this report populates automatically.
        </Typography>
      </Stack>
    </Box>
  );
}
