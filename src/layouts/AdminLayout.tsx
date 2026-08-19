// ============================================================
// WAYTERO ADMIN — ADMIN LAYOUT
// Doc: Admin Portal §5 Layout — Sidebar + Header + Content
// Sidebar: 260px, collapsible. Header: sticky, 64px.
// ============================================================
import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Box, Drawer, AppBar, Toolbar, Typography, IconButton,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Avatar, Tooltip, Badge, Divider, useMediaQuery, useTheme,
  Menu, MenuItem, ListSubheader,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Dashboard, ConfirmationNumber, Handshake, Person, DirectionsCar,
  Hotel, Tour,   AccountBalance, BarChart, ManageAccounts, Settings,
  History, Notifications, ChevronLeft, Logout, LightMode, DarkMode, LocalOffer, HeadsetMic, DirectionsRun,
  AccountBalanceWallet, Build, SwapHoriz, Cancel, Gavel, Web, Article, Email, Forum,
  Receipt, PersonOff, MarkEmailRead, Campaign,
  Description,
} from "@mui/icons-material";
import { useAuthStore } from "../stores/authStore";
import { useUiStore }   from "../stores/uiStore";
import { authService }  from "../services/auth.service";
import { NAV_ITEMS, NAV_SECTIONS } from "../constants";
import { useGstEnabled } from "../hooks/useGstEnabled";
import { GlobalSearch } from "../components/search/GlobalSearch";
import NotificationsDropdown from "../components/notifications/NotificationsDropdown";
import NewChatModal from "../components/chat/NewChatModal";
import BookingAcceptModal from "../components/bookings/BookingAcceptModal";
import { useAdminPresence } from "../hooks/useAdminPresence";

const DRAWER_WIDTH = 260;

const ICON_MAP: Record<string, React.ReactNode> = {
  Dashboard:       <Dashboard />,
  ConfirmationNumber: <ConfirmationNumber />,
  Handshake:       <Handshake />,
  Person:          <Person />,
  DirectionsCar:   <DirectionsCar />,
  Hotel:           <Hotel />,
  Tour:            <Tour />,
  AccountBalance:  <AccountBalance />,
  BarChart:        <BarChart />,
  ManageAccounts:  <ManageAccounts />,
  Settings:        <Settings />,
  History:         <History />,
  LocalOffer:      <LocalOffer />,
  HeadsetMic:      <HeadsetMic />,
  DirectionsRun:   <DirectionsRun />,
  AccountBalanceWallet: <AccountBalanceWallet />,
  Build:           <Build />,
  SwapHoriz:       <SwapHoriz />,
  Cancel:          <Cancel />,
  Gavel:           <Gavel />,
  Web:             <Web />,
  Article:         <Article />,
  Email:           <Email />,
  Forum:           <Forum />,
  Receipt:         <Receipt />,
  PersonOff:       <PersonOff />,
  MarkEmailRead:   <MarkEmailRead />,
  Campaign:        <Campaign />,
  Description:     <Description />,
};

export function AdminLayout() {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate  = useNavigate();
  const location  = useLocation();

  const { user, clearAuth, refreshToken } = useAuthStore();
  const { sidebarOpen, toggleSidebar, setSidebar, themeMode, toggleTheme } = useUiStore();
  const { isGstEnabled } = useGstEnabled();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Presence heartbeat — while this portal tab is open the admin counts
  // as online support, so customer chats can route here (smart routing).
  useAdminPresence();

  const drawerOpen = isMobile ? false : sidebarOpen;

  // Role filter + feature-flag filter: the Tax & GST entry only appears
  // when the platform-level GST_ENABLED config is on (toggled in Settings).
  // Sections with no visible items (after role/flag filtering) are dropped.
  const visibleSections = NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((n) =>
        (!user || n.roles.includes(user.user_type as any)) &&
        (n.key !== "tax-gst" || isGstEnabled)
      ),
    }))
    .filter((section) => section.items.length > 0);

  async function handleLogout() {
    try { if (refreshToken) await authService.logout(refreshToken); } catch {}
    clearAuth();
    navigate("/login", { replace: true });
  }

  const sidebar = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Brand */}
      <Box sx={{ px: 2.5, py: 2, display: "flex", alignItems: "center", gap: 1.5, minHeight: 64 }}>
        <Box sx={{ width: 32, height: 32, borderRadius: 1.5, background: "linear-gradient(135deg,#0F6FFF,#14B8A6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 14, lineHeight: 1 }}>W</Typography>
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: "primary.main", lineHeight: 1 }}>WayTero</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1 }}>Admin Portal</Typography>
        </Box>
      </Box>

      <Divider />

      {/* Nav */}
      <List sx={{
          flex: 1, px: 1, py: 1,
          overflowY: "auto",
          overflowX: "hidden",
          "&::-webkit-scrollbar": { width: 4 },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": { background: "rgba(0,0,0,0.15)", borderRadius: 4 },
          "&::-webkit-scrollbar-thumb:hover": { background: "rgba(0,0,0,0.3)" },
        }}>
        {visibleSections.map((section) => (
          <Box key={section.key} sx={{ mb: 1 }}>
            <ListSubheader
              disableSticky
              sx={{
                bgcolor: "transparent",
                px: 2, py: 0.5, m: 0,
                fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                color: "text.secondary", textTransform: "uppercase", lineHeight: 1.6,
              }}
            >
              {section.title}
            </ListSubheader>
            {section.items.map((item) => {
              const active = location.pathname.startsWith(item.path);
              return (
                <ListItem key={item.key} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => { navigate(item.path); if (isMobile) setSidebar(false); }}
                    selected={active}
                    sx={{
                      borderRadius: 2,
                      "&.Mui-selected": {
                        backgroundColor: "primary.main",
                        color: "#fff",
                        "& .MuiListItemIcon-root": { color: "#fff" },
                        "&:hover": { backgroundColor: "primary.dark" },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36, color: active ? "#fff" : "text.secondary" }}>
                      {ICON_MAP[item.icon]}
                    </ListItemIcon>
                    <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 600 : 400 }} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </Box>
        ))}
      </List>

      <Divider />

      {/* User footer */}
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: "primary.main", fontSize: 14, fontWeight: 700 }}>
          {user?.full_name?.[0] ?? user?.mobile?.[0] ?? 'A'}
        </Avatar>
        <Box flex={1} minWidth={0}>
          <Typography variant="body2" fontWeight={600} noWrap>{user?.full_name ?? user?.mobile}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{user?.user_type?.replace(/_/g, " ")}</Typography>
        </Box>
        <Tooltip title="Logout">
          <IconButton size="small" onClick={handleLogout}><Logout fontSize="small" /></IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Sidebar — permanent on desktop, temporary on mobile */}
      {isMobile ? (
        <Drawer open={sidebarOpen} onClose={() => setSidebar(false)} variant="temporary" sx={{ "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box", display: "flex", flexDirection: "column" } }}>
          {sidebar}
        </Drawer>
      ) : (
        <Drawer variant="permanent" open={drawerOpen}
          sx={{
            width: drawerOpen ? DRAWER_WIDTH : 0,
            flexShrink: 0,
            transition: "width 0.2s",
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box", transform: drawerOpen ? "none" : `translateX(-${DRAWER_WIDTH}px)`, transition: "transform 0.2s, width 0.2s", overflow: "hidden", display: "flex", flexDirection: "column" },
          }}
        >
          {sidebar}
        </Drawer>
      )}

      {/* Main area */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* AppBar */}
        <AppBar position="sticky" elevation={0}>
          <Toolbar sx={{ gap: 1 }}>
            <IconButton edge="start" onClick={toggleSidebar} size="small" sx={{ mr: 1 }}>
              {drawerOpen ? <ChevronLeft /> : <MenuIcon />}
            </IconButton>

            {/* Page title from pathname */}
            <Typography variant="h6" fontWeight={600} sx={{ display: { xs: "none", md: "block" }, mr: 1 }}>
              {NAV_ITEMS.find((n) => location.pathname.startsWith(n.path))?.label ?? "WayTero Admin"}
            </Typography>

            {/* Global page search — type to jump to any page */}
            <GlobalSearch />

            <Tooltip title={themeMode === "light" ? "Dark mode" : "Light mode"}>
              <IconButton onClick={toggleTheme} size="small">
                {themeMode === "light" ? <DarkMode fontSize="small" /> : <LightMode fontSize="small" />}
              </IconButton>
            </Tooltip>

            {/* Notifications bell (Doc Ref: BRD Part 7 §155) */}
            <NotificationsDropdown />

            <Tooltip title="Account">
              <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", fontSize: 13, fontWeight: 700 }}>
                  {user?.full_name?.[0] ?? user?.mobile?.[0] ?? 'A'}
                </Avatar>
              </IconButton>
            </Tooltip>

            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
              <MenuItem onClick={() => { setAnchorEl(null); handleLogout(); }}>
                <Logout fontSize="small" sx={{ mr: 1 }} /> Logout
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {/* Page content */}
        <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>

      {/* Global new-chat alert — pops up when a customer messages while
          the admin is anywhere in the portal. */}
      <NewChatModal />

      {/* Global realtime booking-accept modal — rings + pops up when a
          customer books cab/hotel/tour on the website, and catches up on
          bookings that queued while the admin was logged out. */}
      <BookingAcceptModal />
    </Box>
  );
}
