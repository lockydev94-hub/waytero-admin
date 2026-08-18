// ============================================================
// WAYTERO ADMIN — GLOBAL PAGE SEARCH
// Doc: Admin Portal §5 Header — type-ahead over every page in the
// sidebar (NAV_SECTIONS), role-aware, keyboard shortcut Ctrl+K.
// Selecting a result navigates straight to that page.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Autocomplete,
  Box,
  Chip,
  TextField,
  Typography,
  IconButton,
  Tooltip,
  useTheme,
} from "@mui/material";
import {
  Search,
  Dashboard, ConfirmationNumber, Handshake, Person, DirectionsCar,
  Hotel, Tour, AccountBalance, BarChart, ManageAccounts, Settings,
  History, LocalOffer, HeadsetMic, DirectionsRun, AccountBalanceWallet,
  Build, SwapHoriz, Cancel, Gavel, Web, Article, Email, Forum,
  Receipt, PersonOff, MarkEmailRead, Campaign,
} from "@mui/icons-material";
import { NAV_SECTIONS, NAV_ITEMS } from "../../constants";
import { useAuthStore } from "../../stores/authStore";
import { useGstEnabled } from "../../hooks/useGstEnabled";

const ICON_MAP: Record<string, React.ReactNode> = {
  Dashboard: <Dashboard />, ConfirmationNumber: <ConfirmationNumber />,
  Handshake: <Handshake />, Person: <Person />, DirectionsCar: <DirectionsCar />,
  Hotel: <Hotel />, Tour: <Tour />, AccountBalance: <AccountBalance />,
  BarChart: <BarChart />, ManageAccounts: <ManageAccounts />, Settings: <Settings />,
  History: <History />, LocalOffer: <LocalOffer />, HeadsetMic: <HeadsetMic />,
  DirectionsRun: <DirectionsRun />, AccountBalanceWallet: <AccountBalanceWallet />,
  Build: <Build />, SwapHoriz: <SwapHoriz />, Cancel: <Cancel />, Gavel: <Gavel />,
  Web: <Web />, Article: <Article />, Email: <Email />, Forum: <Forum />,
  Receipt: <Receipt />, PersonOff: <PersonOff />, MarkEmailRead: <MarkEmailRead />,
  Campaign: <Campaign />,
};

interface SearchOption {
  key: string;
  label: string;
  section: string;
  path: string;
  icon: string;
}

export function GlobalSearch() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { isGstEnabled } = useGstEnabled();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Pages visible to the current role (+ GST feature flag), flattened
  // with their section title for grouping in the dropdown.
  const options = useMemo<SearchOption[]>(() => {
    return NAV_SECTIONS.flatMap((section) =>
      section.items
        .filter((n) =>
          (!user || n.roles.includes(user.user_type as never)) &&
          (n.key !== "tax-gst" || isGstEnabled)
        )
        .map((n) => ({ key: n.key, label: n.label, section: section.title, path: n.path, icon: n.icon }))
    );
  }, [user, isGstEnabled]);

  // Ctrl+K / Cmd+K toggles the search.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Focus the input when the dropdown opens.
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      o.label.toLowerCase().includes(q) ||
      o.section.toLowerCase().includes(q) ||
      (NAV_ITEMS.find((n) => n.key === o.key)?.keywords ?? "").toLowerCase().includes(q)
    );
  }, [options, query]);

  return (
    <Box sx={{ position: "relative", display: "flex", alignItems: "center", flex: 1, maxWidth: 480, minWidth: { xs: 140, md: 320 } }}>
      <Autocomplete
        size="small"
        freeSolo
        options={filtered}
        groupBy={(o) => o.section}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        inputValue={query}
        onInputChange={(_, v) => setQuery(v)}
        onChange={(_, value) => {
          const opt = typeof value === "string" ? null : value;
          if (opt?.path) {
            navigate(opt.path);
            setOpen(false);
            setQuery("");
          }
        }}
        getOptionLabel={(o) => (typeof o === "string" ? o : o.label)}
        isOptionEqualToValue={(a, b) => a.key === b.key}
        renderOption={(props, option) => (
          <li {...props} key={option.key}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, width: "100%" }}>
              <Box sx={{ color: "text.secondary", display: "flex", fontSize: 20 }}>{ICON_MAP[option.icon]}</Box>
              <Typography variant="body2" sx={{ flex: 1 }}>{option.label}</Typography>
              <Chip label={option.section} size="small" sx={{ height: 20, fontSize: 11 }} />
            </Box>
          </li>
        )}
        noOptionsText="No matching pages"
        sx={{
          flex: 1,
          "& .MuiAutocomplete-inputRoot": { borderRadius: 3, pr: 7, bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" },
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            inputRef={inputRef}
            placeholder="Search pages…  (Ctrl+K)"
            variant="outlined"
            fullWidth
            InputProps={{
              ...params.InputProps,
              startAdornment: <Search fontSize="small" sx={{ mr: 0.5, color: "text.secondary" }} />,
              endAdornment: null,
            }}
          />
        )}
      />
      <Tooltip title="Search (Ctrl+K)" placement="bottom">
        <IconButton
          size="small"
          sx={{
            position: "absolute",
            right: 4,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            px: 0.75,
            py: 0.25,
            fontSize: 11,
            color: "text.secondary",
            "&:hover": { bgcolor: "action.hover" },
          }}
          onClick={() => { setOpen(true); setQuery(""); }}
        >
          Ctrl K
        </IconButton>
      </Tooltip>
    </Box>
  );
}