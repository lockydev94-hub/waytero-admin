// ============================================================
// WAYTERO ADMIN — ADMIN LAYOUT
// Doc: Admin Portal §5 Layout — Sidebar + Header + Content
// Sidebar: 260px, collapsible. Header: sticky, 64px (see Topbar.tsx).
// ============================================================
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Box, Drawer, Typography, IconButton,
  Badge, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Avatar, Tooltip, Divider, useMediaQuery, useTheme,
  ListSubheader,
} from "@mui/material";
import { Logout } from "@mui/icons-material";
import { useAuthStore } from "../stores/authStore";
import { useUiStore }   from "../stores/uiStore";
import { authService }  from "../services/auth.service";
import { NAV_SECTIONS, findActiveNavItem } from "../constants";
import { NAV_ICONS }    from "../constants/icons";
import { useGstEnabled } from "../hooks/useGstEnabled";
import { useActionCounts } from "../hooks/useActionCounts";
import { useLockStore } from "../stores/lockStore";
import { Topbar } from "../components/layout/Topbar";
import LockScreen from "../components/layout/LockScreen";
import NewChatModal from "../components/chat/NewChatModal";
import BookingAcceptModal from "../components/bookings/BookingAcceptModal";
import { useAdminPresence } from "../hooks/useAdminPresence";

const DRAWER_WIDTH = 260;

export function AdminLayout() {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate  = useNavigate();
  const location  = useLocation();

  const { user, clearAuth, refreshToken } = useAuthStore();
  const { sidebarOpen, toggleSidebar, setSidebar } = useUiStore();
  const { isGstEnabled } = useGstEnabled();
  const isLocked = useLockStore((s) => s.isLocked);
  const actionCounts = useActionCounts();

  // Presence heartbeat — while this portal tab is open the admin counts
  // as online support, so customer chats can route here (smart routing).
  useAdminPresence({ enabled: !isLocked });

  const drawerOpen = isMobile ? false : sidebarOpen;

  // Locked: the shell is unmounted, not hidden. The sidebar, the notification
  // bell and Ctrl+K search do not exist behind the overlay, so nothing there
  // can navigate or read data while the PIN is outstanding.
  if (isLocked) return <LockScreen />;

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

  // Exactly one row is highlighted: the longest matching nav path, so
  // /bookings/switches does not also light up Bookings.
  const activeNavKey = findActiveNavItem(location.pathname)?.key ?? null;

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
              const active = item.key === activeNavKey;
              const pending = actionCounts[item.key] ?? 0;
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
                      {NAV_ICONS[item.icon]}
                    </ListItemIcon>
                    <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 600 : 400 }} />
                    {/* Zero hides: an empty circle would read as a broken badge. */}
                    {pending > 0 && (
                      <Badge
                        badgeContent={pending}
                        max={99}
                        color={active ? "default" : "error"}
                        sx={{
                          "& .MuiBadge-badge": {
                            position: "static",
                            transform: "none",
                            fontSize: 11,
                            fontWeight: 700,
                            bgcolor: active ? "rgba(255,255,255,0.24)" : "error.main",
                            color: "#fff",
                          },
                        }}
                      >
                        <Box sx={{ width: 8, height: 8 }} />
                      </Badge>
                    )}
                  </ListItemButton>
                </ListItem>
              );
            })}
          </Box>
        ))}
      </List>

      <Divider />

      {/* User footer — the account itself lives at /profile */}
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box
          role="button"
          tabIndex={0}
          onClick={() => { navigate("/profile"); if (isMobile) setSidebar(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") navigate("/profile"); }}
          sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, minWidth: 0, cursor: "pointer", borderRadius: 2, "&:hover": { bgcolor: "action.hover" } }}
        >
          <Avatar sx={{ width: 36, height: 36, bgcolor: "primary.main", fontSize: 14, fontWeight: 700 }}>
            {user?.full_name?.[0] ?? user?.mobile?.[0] ?? 'A'}
          </Avatar>
          <Box flex={1} minWidth={0}>
            <Typography variant="body2" fontWeight={600} noWrap>{user?.full_name ?? user?.mobile}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>{user?.user_type?.replace(/_/g, " ")}</Typography>
          </Box>
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
        <Topbar
          sidebarOpen={drawerOpen}
          onToggleSidebar={toggleSidebar}
          onLogout={handleLogout}
        />

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
