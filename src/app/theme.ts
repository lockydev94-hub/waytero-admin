// ============================================================
// WAYTERO ADMIN PORTAL — MUI THEME
// Design System: docs/07_Frontend_Architecture/07_UI_DESIGN_SYSTEM.md
// Primary: #0F6FFF | Secondary: #14B8A6 | Accent: #F59E0B
// Font: Inter (display) — clean, professional, travel-focused
//
// Surface language follows the lock screen: deep-navy chrome, glass panels,
// soft 16px cards with a hairline border on a light canvas, pill chips and a
// gradient primary action. Dark mode reuses the same shapes with dark tokens.
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

/** Chrome colours shared with the lock screen. */
export const INK = "#070C16";
export const NAVY = "#0B1220";
const HAIRLINE = "#E4EAF3";

const CARD_SHADOW =
  "0 1px 2px rgba(15,23,42,0.04), 0 18px 40px -28px rgba(15,23,42,0.35)";

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
    background: { default: "#F5F8FD", paper: "#FFFFFF" },
    text: { primary: "#0F172A", secondary: "#64748B" },
    divider: HAIRLINE,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
    h1: { fontSize: "2rem",     fontWeight: 800, letterSpacing: "-0.02em" },
    h2: { fontSize: "1.75rem",  fontWeight: 800, letterSpacing: "-0.02em" },
    h3: { fontSize: "1.5rem",   fontWeight: 700, letterSpacing: "-0.01em" },
    h4: { fontSize: "1.25rem",  fontWeight: 700, letterSpacing: "-0.01em" },
    h5: { fontSize: "1rem",     fontWeight: 700 },
    h6: { fontSize: "0.875rem", fontWeight: 700 },
    body1: { fontSize: "1rem",     lineHeight: 1.6 },
    body2: { fontSize: "0.875rem", lineHeight: 1.5 },
    caption: { fontSize: "0.75rem" },
    button: { fontWeight: 600, letterSpacing: 0 },
  },
  // Kept at 10 deliberately: pages all over the portal use numeric radii
  // (borderRadius: 2, 3…) that scale off this unit. Cards opt into 16 explicitly.
  shape: { borderRadius: 10 },
  shadows: [
    "none",
    "0 1px 2px rgba(15,23,42,0.05)",
    "0 4px 12px rgba(15,23,42,0.08)",
    "0 4px 14px rgba(15,23,42,0.10)",
    "0 12px 32px rgba(15,23,42,0.12)",
    "0 16px 38px rgba(15,23,42,0.16)",
    ...Array(19).fill("none"),
  ] as never,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        },
        "::selection": { backgroundColor: alpha("#0F6FFF", 0.18) },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 650,
          borderRadius: 10,
          padding: "8px 20px",
        },
        sizeLarge:  { height: 46, fontSize: "0.95rem" },
        sizeMedium: { height: 40 },
        sizeSmall:  { height: 32, fontSize: "0.8125rem" },
        containedPrimary: ({ theme }) => ({
          backgroundImage: "linear-gradient(135deg, #2E7BFF 0%, #145EE0 100%)",
          boxShadow:
            theme.palette.mode === "dark"
              ? "0 10px 24px -14px rgba(46,123,255,0.75)"
              : "0 10px 22px -12px rgba(15,111,255,0.65)",
          "&:hover": {
            backgroundImage: "linear-gradient(135deg, #3C86FF 0%, #1A66EE 100%)",
          },
        }),
      },
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 16,
          border: `1px solid ${
            theme.palette.mode === "dark" ? "rgba(148,163,184,0.18)" : HAIRLINE
          }`,
          boxShadow:
            theme.palette.mode === "dark"
              ? "0 1px 2px rgba(0,0,0,0.45)"
              : CARD_SHADOW,
          backgroundImage:
            theme.palette.mode === "dark"
              ? "none"
              : "linear-gradient(180deg, #FFFFFF 0%, #FCFDFF 100%)",
          transition: "box-shadow 200ms ease, border-color 200ms ease",
        }),
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 16 },
        outlined: ({ theme }) => ({
          borderColor:
            theme.palette.mode === "dark" ? "rgba(148,163,184,0.18)" : HAIRLINE,
        }),
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }) => ({
          boxShadow: "none",
          borderBottom: `1px solid ${
            theme.palette.mode === "dark" ? "rgba(148,163,184,0.16)" : "rgba(15,23,42,0.06)"
          }`,
          backgroundColor:
            theme.palette.mode === "dark"
              ? "rgba(11,18,32,0.82)"
              : "rgba(255,255,255,0.82)",
          backgroundImage: "none",
          backdropFilter: "blur(16px) saturate(160%)",
          WebkitBackdropFilter: "blur(16px) saturate(160%)",
          color: theme.palette.text.primary,
        }),
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRight: "none", boxShadow: "none", backgroundImage: "none" },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 10,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor:
              theme.palette.mode === "dark" ? "rgba(148,163,184,0.24)" : HAIRLINE,
          },
        }),
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, fontSize: "0.72rem", borderRadius: 999, height: 24 },
        sizeSmall: { height: 22, fontSize: "0.7rem" },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderColor:
            theme.palette.mode === "dark" ? "rgba(148,163,184,0.14)" : "#EDF1F7",
        }),
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: ({ theme }) => ({
          "& .MuiTableCell-head": {
            backgroundColor:
              theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "#F7FAFF",
            fontWeight: 700,
            color: theme.palette.text.secondary,
            fontSize: "0.7rem",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          },
        }),
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRadius: 20,
          border: `1px solid ${
            theme.palette.mode === "dark" ? "rgba(148,163,184,0.18)" : HAIRLINE
          }`,
          boxShadow: "0 36px 80px -32px rgba(15,23,42,0.45)",
        }),
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRadius: 14,
          marginTop: 8,
          border: `1px solid ${
            theme.palette.mode === "dark" ? "rgba(148,163,184,0.18)" : HAIRLINE
          }`,
          boxShadow: "0 24px 48px -24px rgba(15,23,42,0.35)",
        }),
      },
    },
    MuiMenuItem: {
      styleOverrides: { root: { borderRadius: 8, margin: "2px 6px", fontSize: "0.85rem" } },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: NAVY,
          borderRadius: 8,
          fontSize: "0.72rem",
          fontWeight: 500,
          padding: "6px 10px",
          boxShadow: "0 12px 28px -16px rgba(0,0,0,0.6)",
        },
        arrow: { color: NAVY },
      },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: 12 } },
    },
    MuiListItemButton: {
      styleOverrides: { root: { borderRadius: 10 } },
    },
    MuiLinearProgress: {
      styleOverrides: { root: { borderRadius: 999, height: 6 } },
    },
    MuiAvatar: {
      styleOverrides: { root: { fontWeight: 700 } },
    },
    MuiTabs: {
      styleOverrides: { indicator: { borderRadius: 999, height: 3 } },
    },
  },
});
