// ============================================================
// WAYTERO ADMIN — TOPBAR
// Doc: Admin Portal §5 Layout — Header
// Holds the sidebar toggle, the page title, global search, theme
// switch, notifications and the account menu.
// ============================================================
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AppBar, Toolbar, Typography, IconButton, Avatar, Tooltip, Menu,
  MenuItem, Divider, Box, Chip,
} from "@mui/material";
import {
  Menu as MenuIcon, ChevronLeft, LightMode, DarkMode, Logout, Lock as LockIcon,
  Person, Schedule, Groups,
} from "@mui/icons-material";
import { useAuthStore } from "../../stores/authStore";
import { useUiStore } from "../../stores/uiStore";
import { useLockStore } from "../../stores/lockStore";
import { postSessionMessage } from "../../hooks/useBroadcastSession";
import { resolveNavTitle } from "../../constants";
import { GlobalSearch } from "../search/GlobalSearch";
import NotificationsDropdown from "../notifications/NotificationsDropdown";

interface TopbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onLogout: () => void;
}

function mmss(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function Topbar({ sidebarOpen, onToggleSidebar, onLogout }: TopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { themeMode, toggleTheme } = useUiStore();
  const idleRemainingMs = useLockStore((s) => s.idleRemainingMs);
  const hasMpin = useLockStore((s) => Boolean(s.sessionConfig?.has_mpin));
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const openMenu = (el: HTMLElement | null) => setAnchorEl(el);
  const closeMenu = () => setAnchorEl(null);

  const lockNow = () => {
    closeMenu();
    useLockStore.getState().lock();
    postSessionMessage({ type: "lock" });
  };

  return (
    <AppBar position="sticky" elevation={0}>
      <Toolbar sx={{ gap: 1 }}>
        <IconButton edge="start" onClick={onToggleSidebar} size="small" sx={{ mr: 1 }}>
          {sidebarOpen ? <ChevronLeft /> : <MenuIcon />}
        </IconButton>

        {/* Page title — longest matching nav path, or the detail-route name */}
        <Typography variant="h6" fontWeight={600} sx={{ display: { xs: "none", md: "block" }, mr: 1, whiteSpace: "nowrap" }}>
          {resolveNavTitle(location.pathname)}
        </Typography>

        <GlobalSearch />

        {/* Idle countdown — only meaningful once an unlock PIN exists */}
        {hasMpin && (
          <Tooltip title="The dashboard locks after this much inactivity. Move the mouse or press a key to reset it.">
            <Chip
              size="small"
              variant="outlined"
              icon={<LockIcon />}
              label={`locks in ${mmss(idleRemainingMs)}`}
              sx={{ display: { xs: "none", sm: "flex" }, fontVariantNumeric: "tabular-nums" }}
            />
          </Tooltip>
        )}

        <Tooltip title={themeMode === "light" ? "Dark mode" : "Light mode"}>
          <IconButton onClick={toggleTheme} size="small">
            {themeMode === "light" ? <DarkMode fontSize="small" /> : <LightMode fontSize="small" />}
          </IconButton>
        </Tooltip>

        {/* Notifications bell (Doc Ref: BRD Part 7 §155) */}
        <NotificationsDropdown />

        <Tooltip title="Account">
          <IconButton size="small" onClick={(e) => openMenu(e.currentTarget)}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", fontSize: 13, fontWeight: 700 }}>
              {user?.full_name?.[0] ?? user?.mobile?.[0] ?? "A"}
            </Avatar>
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={closeMenu}
          slotProps={{ paper: { sx: { minWidth: 240 } } }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {user?.full_name ?? user?.mobile ?? "Account"}
            </Typography>
            {user?.email && (
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {user.email}
              </Typography>
            )}
            <Typography variant="caption" color="primary.main" sx={{ textTransform: "capitalize" }}>
              {user?.user_type?.replace(/_/g, " ").toLowerCase()}
            </Typography>
          </Box>

          <Divider />

          <MenuItem onClick={() => { closeMenu(); navigate("/profile"); }}>
            <Person fontSize="small" sx={{ mr: 1.5 }} /> Profile
          </MenuItem>

          <MenuItem onClick={() => { closeMenu(); navigate("/profile?tab=hours"); }}>
            <Schedule fontSize="small" sx={{ mr: 1.5 }} /> My working hours
          </MenuItem>

          {user?.user_type === "SUPER_ADMIN" && (
            <MenuItem onClick={() => { closeMenu(); navigate("/work-hours"); }}>
              <Groups fontSize="small" sx={{ mr: 1.5 }} /> Staff working hours
            </MenuItem>
          )}

          {hasMpin && (
            <MenuItem onClick={lockNow}>
              <LockIcon fontSize="small" sx={{ mr: 1.5 }} /> Lock now
            </MenuItem>
          )}

          <MenuItem
            onClick={() => { closeMenu(); onLogout(); }}
            sx={{ color: "error.main" }}
          >
            <Logout fontSize="small" sx={{ mr: 1.5 }} /> Logout
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
