// ============================================================
// WAYTERO ADMIN — ADMIN LAYOUT
// Doc: Admin Portal §5 Layout — Sidebar + Header + Content
// Sidebar: 260px, collapsible. Header: sticky, 64px (see Topbar.tsx).
//
// The shell wears the same language as the lock screen: a navy sidebar with
// ambient light and a faint grid, a glass topbar, and a light canvas carrying
// soft blue/indigo wash so the cards read as raised paper.
// ============================================================
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Box, Drawer, Typography, IconButton,
  Badge, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Avatar, Tooltip, useMediaQuery, useTheme,
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
import { INK } from "../app/theme";

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
        (!user || n.roles.includes(user.user_type as never)) &&
        (n.key !== "tax-gst" || isGstEnabled)
      ),
    }))
    .filter((section) => section.items.length > 0);

  async function handleLogout() {
    try { if (refreshToken) await authService.logout(refreshToken); } catch { /* session already gone */ }
    clearAuth();
    navigate("/login", { replace: true });
  }

  // Exactly one row is highlighted: the longest matching nav path, so
  // /bookings/switches does not also light up Bookings.
  const activeNavKey = findActiveNavItem(location.pathname)?.key ?? null;

  const hairline = "rgba(255,255,255,0.07)";

  const sidebar = (
    <Box
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        color: "#fff",
        bgcolor: INK,
        borderRight: "1px solid rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}
    >
      {/* Ambient light + grid, same two layers the lock screen uses. */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 10% 0%, rgba(15,111,255,0.30), transparent 44%), radial-gradient(circle at 96% 98%, rgba(99,102,241,0.22), transparent 46%)",
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          opacity: 0.5,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "38px 38px",
          maskImage: "radial-gradient(circle at 28% 8%, black, transparent 74%)",
          WebkitMaskImage: "radial-gradient(circle at 28% 8%, black, transparent 74%)",
        }}
      />

      <Box sx={{ position: "relative", display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Brand */}
        <Box sx={{ px: 2.25, pt: 2.25, pb: 2.25, display: "flex", alignItems: "center", gap: 1.4 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: "12px",
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(140deg, #2E7BFF 0%, #0B4FD8 100%)",
              border: "1px solid rgba(255,255,255,0.18)",
              boxShadow: "0 12px 24px -10px rgba(15,111,255,0.9)",
            }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: 16, lineHeight: 1, letterSpacing: "-0.02em" }}>
              W
            </Typography>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 15.5, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
              WayTero
            </Typography>
            <Typography
              sx={{
                mt: 0.4,
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.42)",
              }}
            >
              Admin Portal
            </Typography>
          </Box>
        </Box>

        <Box sx={{ height: "1px", bgcolor: hairline, mx: 2.25 }} />

        {/* Nav */}
        <Box sx={{ position: "relative", flex: 1, minHeight: 0 }}>
        <List
          sx={{
            height: "100%",
            px: 1.25,
            pt: 1.25,
            pb: 3,
            overflowY: "auto",
            overflowX: "hidden",
            "&::-webkit-scrollbar": { width: 4 },
            "&::-webkit-scrollbar-track": { background: "transparent" },
            "&::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.16)", borderRadius: 4 },
            "&::-webkit-scrollbar-thumb:hover": { background: "rgba(255,255,255,0.28)" },
          }}
        >
          {visibleSections.map((section) => (
            <Box key={section.key} sx={{ mb: 0.5 }}>
              <ListSubheader
                disableSticky
                sx={{
                  bgcolor: "transparent",
                  px: 1.75,
                  pt: 1.25,
                  pb: 0.5,
                  m: 0,
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  color: "rgba(255,255,255,0.34)",
                  textTransform: "uppercase",
                  lineHeight: 1.6,
                }}
              >
                {section.title}
              </ListSubheader>
              {section.items.map((item) => {
                const active = item.key === activeNavKey;
                const pending = actionCounts[item.key] ?? 0;
                return (
                  <ListItem key={item.key} disablePadding sx={{ mb: 0.35 }}>
                    <ListItemButton
                      onClick={() => { navigate(item.path); if (isMobile) setSidebar(false); }}
                      selected={active}
                      sx={{
                        mx: 0.5,
                        minHeight: 38,
                        px: 1.25,
                        borderRadius: "10px",
                        color: active ? "#fff" : "rgba(255,255,255,0.66)",
                        transition: "background-color 160ms ease, color 160ms ease",
                        "& .MuiListItemIcon-root": {
                          minWidth: 32,
                          color: active ? "#fff" : "rgba(255,255,255,0.45)",
                          transition: "color 160ms ease",
                        },
                        "& .MuiListItemText-primary": {
                          fontSize: 13.5,
                          fontWeight: active ? 650 : 500,
                          letterSpacing: "0.005em",
                        },
                        "&:hover": {
                          bgcolor: "rgba(255,255,255,0.06)",
                          color: "#fff",
                          "& .MuiListItemIcon-root": { color: "rgba(255,255,255,0.85)" },
                        },
                        "&.Mui-selected": {
                          color: "#fff",
                          border: "1px solid rgba(255,255,255,0.16)",
                          backgroundImage:
                            "linear-gradient(135deg, rgba(46,123,255,0.98) 0%, rgba(20,94,224,0.9) 100%)",
                          boxShadow: "0 12px 26px -14px rgba(15,111,255,0.95)",
                          "& .MuiListItemIcon-root": { color: "#fff" },
                          "&:hover": {
                            backgroundImage:
                              "linear-gradient(135deg, rgba(60,134,255,0.98) 0%, rgba(26,102,238,0.92) 100%)",
                          },
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {NAV_ICONS[item.icon]}
                      </ListItemIcon>
                      <ListItemText primary={item.label} />
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
                              bgcolor: active ? "rgba(255,255,255,0.24)" : "#EF4444",
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
        {/* Fade the last visible row into the footer instead of slicing it. */}
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 30,
            pointerEvents: "none",
            background: `linear-gradient(to top, ${INK} 18%, rgba(7,12,22,0))`,
          }}
        />
        </Box>

        <Box sx={{ height: "1px", bgcolor: hairline, mx: 2.25 }} />

        {/* User footer — the account itself lives at /profile */}
        <Box sx={{ p: 1.75 }}>
          <Box
            sx={{
              p: 1,
              borderRadius: "12px",
              bgcolor: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Box
              role="button"
              tabIndex={0}
              onClick={() => { navigate("/profile"); if (isMobile) setSidebar(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") navigate("/profile"); }}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                flex: 1,
                minWidth: 0,
                cursor: "pointer",
                borderRadius: "8px",
                p: 0.5,
                "&:hover": { bgcolor: "rgba(255,255,255,0.05)" },
              }}
            >
              <Avatar
                sx={{
                  width: 34,
                  height: 34,
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#fff",
                  background: "linear-gradient(140deg, #4C8DFF 0%, #1D4ED8 100%)",
                  border: "1px solid rgba(255,255,255,0.18)",
                }}
              >
                {user?.full_name?.[0] ?? user?.mobile?.[0] ?? "A"}
              </Avatar>
              <Box flex={1} minWidth={0}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 650, color: "#fff" }} noWrap>
                  {user?.full_name ?? user?.mobile}
                </Typography>
                <Typography
                  sx={{
                    fontSize: 10.5,
                    color: "rgba(255,255,255,0.45)",
                    textTransform: "capitalize",
                  }}
                  noWrap
                >
                  {user?.user_type?.replace(/_/g, " ").toLowerCase()}
                </Typography>
              </Box>
            </Box>
            <Tooltip title="Logout">
              <IconButton
                size="small"
                onClick={handleLogout}
                sx={{
                  color: "rgba(255,255,255,0.55)",
                  "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.08)" },
                }}
              >
                <Logout fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  const canvasWash =
    theme.palette.mode === "dark"
      ? "radial-gradient(1200px 620px at 10% -12%, rgba(15,111,255,0.18), transparent 60%), radial-gradient(900px 520px at 100% 0%, rgba(99,102,241,0.16), transparent 55%)"
      : "radial-gradient(1200px 620px at 10% -12%, rgba(15,111,255,0.07), transparent 60%), radial-gradient(900px 520px at 100% 0%, rgba(99,102,241,0.06), transparent 55%)";

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Sidebar — permanent on desktop, temporary on mobile */}
      {isMobile ? (
        <Drawer
          open={sidebarOpen}
          onClose={() => setSidebar(false)}
          variant="temporary"
          sx={{
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              bgcolor: INK,
            },
          }}
        >
          {sidebar}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          open={drawerOpen}
          sx={{
            width: drawerOpen ? DRAWER_WIDTH : 0,
            flexShrink: 0,
            transition: "width 0.2s",
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
              transform: drawerOpen ? "none" : `translateX(-${DRAWER_WIDTH}px)`,
              transition: "transform 0.2s, width 0.2s",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              bgcolor: INK,
            },
          }}
        >
          {sidebar}
        </Drawer>
      )}

      {/* Main area */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          bgcolor: "background.default",
          backgroundImage: canvasWash,
        }}
      >
        <Topbar
          sidebarOpen={drawerOpen}
          onToggleSidebar={toggleSidebar}
          onLogout={handleLogout}
        />

        {/* Page content */}
        <Box
          component="main"
          sx={{ flex: 1, px: { xs: 2, md: 3.5 }, py: { xs: 2, md: 3 } }}
        >
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
