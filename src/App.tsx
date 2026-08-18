// ============================================================
// WAYTERO ADMIN PORTAL — APP ROOT
// Wires: MUI ThemeProvider, QueryClient, Router, Notistack
// ============================================================
import { useMemo } from "react";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SnackbarProvider } from "notistack";

import { createTheme } from "@mui/material/styles";
import { theme as lightTheme } from "./app/theme";
import { useUiStore } from "./stores/uiStore";
import { AppRoutes } from "./routes/AppRoutes";

const qc = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

export default function App() {
  const { themeMode } = useUiStore();

  const theme = useMemo(() => {
    if (themeMode === "light") return lightTheme;
    return createTheme({
      ...lightTheme,
      palette: {
        ...lightTheme.palette,
        mode: "dark",
        background: { default: "#0F172A", paper: "#1E293B" },
        text: { primary: "#F8FAFC", secondary: "#94A3B8" },
        divider: "#334155",
      },
    });
  }, [themeMode]);

  return (
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider maxSnack={4} anchorOrigin={{ vertical: "top", horizontal: "right" }}>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </SnackbarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
