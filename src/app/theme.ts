// ============================================================
// WAYTERO ADMIN PORTAL — MUI THEME
// Design System: docs/07_Frontend_Architecture/07_UI_DESIGN_SYSTEM.md
// Primary: #0F6FFF | Secondary: #14B8A6 | Accent: #F59E0B
// Font: Inter (display) — clean, professional, travel-focused
// ============================================================
import { createTheme, alpha } from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    accent: Palette["primary"];
  }
  interface PaletteOptions {
    accent?: PaletteOptions["primary"];
  }
}

export const theme = createTheme({
  palette: {
    mode: "light",
    primary:   { main: "#0F6FFF", light: "#4D96FF", dark: "#0050CC", contrastText: "#FFFFFF" },
    secondary: { main: "#14B8A6", light: "#5EEAD4", dark: "#0E9688", contrastText: "#FFFFFF" },
    accent:    { main: "#F59E0B", light: "#FCD34D", dark: "#D97706", contrastText: "#FFFFFF" },
    success:   { main: "#22C55E" },
    warning:   { main: "#F59E0B" },
    error:     { main: "#EF4444" },
    info:      { main: "#3B82F6" },
    background: { default: "#F8FAFC", paper: "#FFFFFF" },
    text: { primary: "#0F172A", secondary: "#64748B" },
    divider: "#E2E8F0",
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
    h1: { fontSize: "2rem",    fontWeight: 700, letterSpacing: "-0.02em" },
    h2: { fontSize: "1.75rem", fontWeight: 600, letterSpacing: "-0.01em" },
    h3: { fontSize: "1.5rem",  fontWeight: 600 },
    h4: { fontSize: "1.25rem", fontWeight: 600 },
    h5: { fontSize: "1rem",    fontWeight: 600 },
    h6: { fontSize: "0.875rem",fontWeight: 600 },
    body1: { fontSize: "1rem",    lineHeight: 1.6 },
    body2: { fontSize: "0.875rem",lineHeight: 1.5 },
    caption: { fontSize: "0.75rem" },
  },
  shape: { borderRadius: 10 },
  shadows: [
    "none",
    "0 1px 2px rgba(0,0,0,0.05)",
    "0 4px 12px rgba(0,0,0,0.08)",
    "0 4px 12px rgba(0,0,0,0.10)",
    "0 10px 30px rgba(0,0,0,0.12)",
    "0 10px 30px rgba(0,0,0,0.15)",
    ...Array(19).fill("none"),
  ] as any,
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600, borderRadius: 8, padding: "8px 20px" },
        sizeLarge:  { height: 48, fontSize: "1rem" },
        sizeMedium: { height: 40 },
        sizeSmall:  { height: 32, fontSize: "0.8125rem" },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)", border: "1px solid #E2E8F0" },
      },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined", size: "small" },
      styleOverrides: {
        root: { "& .MuiOutlinedInput-root": { borderRadius: 8 } },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600, fontSize: "0.75rem", borderRadius: 6 } },
    },
    MuiTableHead: {
      styleOverrides: {
        root: { "& .MuiTableCell-head": { backgroundColor: "#F8FAFC", fontWeight: 600, color: "#64748B", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" } },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRight: "1px solid #E2E8F0", boxShadow: "none" },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { boxShadow: "0 1px 0 #E2E8F0", backgroundColor: "#FFFFFF", color: "#0F172A" },
      },
    },
    MuiLinearProgress: {
      styleOverrides: { root: { borderRadius: 4 } },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: 8 } },
    },
  },
});
