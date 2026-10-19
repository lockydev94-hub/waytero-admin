// ============================================================
// WAYTERO ADMIN — UNAUTHORIZED
// Doc: Admin Portal §39 Security — Route Guards, Role Based Menus
// RouteGuard sends a role-mismatch here. It lives inside AdminLayout,
// so the signed-in admin keeps the shell and can navigate to a page
// their role actually owns.
// ============================================================
import { useNavigate } from "react-router-dom";
import { Box, Button, Paper, Typography } from "@mui/material";
import { Gavel } from "@mui/icons-material";
import { useAuthStore } from "../../stores/authStore";

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  return (
    <Box display="flex" alignItems="center" justifyContent="center" minHeight="60vh">
      <Paper elevation={0} sx={{ p: 4, maxWidth: 460, textAlign: "center", border: 1, borderColor: "divider" }}>
        <Box sx={{ color: "warning.main", fontSize: 40, mb: 1 }}>
          <Gavel />
        </Box>
        <Typography variant="h6" gutterBottom>
          You don&apos;t have access to this page
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {user
            ? `Your role (${user.user_type.replace(/_/g, " ").toLowerCase()}) can't open this screen. Nothing is wrong with your login — pick another page from the sidebar, or ask a super admin if you need this access.`
            : "This screen isn't available for your role."}
        </Typography>
        <Button variant="contained" onClick={() => navigate("/dashboard")}>
          Go to Dashboard
        </Button>
      </Paper>
    </Box>
  );
}
