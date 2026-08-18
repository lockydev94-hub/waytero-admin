// ============================================================
// WAYTERO ADMIN — SECTION HEADER
// Doc Ref: 03_FRONTEND_DESIGN.md §2 — copied from PartnersPage.
// ============================================================
import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

export default function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
      <Box sx={{ color: "primary.main", display: "flex" }}>{icon}</Box>
      <Typography variant="subtitle2" fontWeight={800} color="primary.main" letterSpacing={0.5}>
        {title}
      </Typography>
    </Box>
  );
}
