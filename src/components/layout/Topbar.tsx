// ============================================================
// WAYTERO ADMIN — TOPBAR
// Doc: Admin Portal §5 Layout — Header
// Holds the sidebar toggle, the page title, global search, theme
// switch, notifications and the account menu.
// ============================================================
import { useState } from "react";
import { useLocation } from "react-router-dom";
import {
  AppBar, Toolbar, Typography, IconButton, Avatar, Tooltip, Menu,
  MenuItem, Divider, Box,
} from "@mui/material";
import {
  Menu as MenuIcon, ChevronLeft, LightMode, DarkMode, Logout,
} from "@mui/icons-material";
import { useAuthStore } from "../../stores/authStore";
import { useUiStore } from "../../stores/uiStore";
import { resolveNavTitle } from "../../constants";
import { GlobalSearch } from "../search/GlobalSearch";
import NotificationsDropdown from "../notifications/NotificationsDropdown";

interface TopbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onLogout: () => void;
}

export function Topbar({ sidebarOpen, onToggleSidebar, onLogout }: TopbarProps) {
  const location = useLocation();
  const { user } = useAuthStore();
  const { themeMode, toggleTheme } = useUiStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const openMenu = (el: HTMLElement | null) => setAnchorEl(el);
  const closeMenu = () => setAnchorEl(null);

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
