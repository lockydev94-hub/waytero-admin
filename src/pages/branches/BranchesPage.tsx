// ============================================================
// WAYTERO ADMIN — BRANCH OFFICES PAGE  (SUPER_ADMIN only)
// Backend: /admin/branches (branch_api.py)
//
// The office register. Everything the portal filters by branch reads its
// names from here: the topbar chip, the super admin's switcher, the branch
// column on the queue lists.
//
// Registering an office is a master-data act, not a permission act: adding
// Puri here does not grant anyone access to anything, it gives the Puri staff
// accounts somewhere to belong.
// ============================================================
import { useCallback, useState } from "react";
import {
  alpha, Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Grid, IconButton, Paper, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography, useTheme,
} from "@mui/material";
import { Add, Delete, Edit, Refresh, Storefront } from "@mui/icons-material";
import { useSnackbar } from "notistack";

import { branchService, type Branch } from "../../services/branch.service";
import { useBranches } from "../../hooks/useBranches";
import BranchEditorDialog from "./BranchEditorDialog";
import { apiErrorMessage } from "../../utils/apiError";

export default function BranchesPage() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  // The register is one cached query shared with the topbar switcher, so a
  // save here must push that copy — not a second fetch of its own.
  const { branches, isLoading, isError, refetch } = useBranches();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCount = branches.filter((b) => b.is_active).length;
  const hq = branches.find((b) => b.is_headquarters && b.is_active) ?? null;

  const remove = useCallback(async (branch: Branch) => {
    setDeleting(true);
    try {
      await branchService.delete(branch.id);
      enqueueSnackbar(`${branch.name} removed from the register`, { variant: "success" });
      setConfirmDelete(null);
      refetch();
    } catch (e) {
      // The server refuses while the office still has staff or bookings —
      // the message says which, and closing it is the honest alternative.
      enqueueSnackbar(apiErrorMessage(e, "Delete failed"), { variant: "error" });
    } finally {
      setDeleting(false);
    }
  }, [enqueueSnackbar, refetch]);

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Storefront sx={{ color: "primary.main" }} /> Branch Offices
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            One office per city. Staff accounts belong to one office, and every queue, list and
            count they see is filtered to it.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={refetch} disabled={isLoading}>
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => { setEditing(null); setEditorOpen(true); }}
            sx={{ fontWeight: 600 }}
          >
            Register Branch
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: "Offices registered", value: branches.length, color: "primary.main" as const },
          { label: "Open", value: openCount, color: "success.main" as const },
          { label: "Closed", value: branches.length - openCount, color: "text.secondary" as const },
          { label: "Head office", value: hq ? hq.name : "None", color: "warning.main" as const },
        ].map((s) => (
          <Grid item xs={6} sm={3} key={s.label}>
            <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, background: alpha(theme.palette.primary.main, 0.03) }}>
              <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
                <Typography variant="h5" fontWeight={800} color={s.color} noWrap>
                  {s.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={500}>{s.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={refetch}>Retry</Button>}>
          The office register could not be read.
        </Alert>
      )}

      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
        ) : branches.length === 0 ? (
          <Box py={8} textAlign="center">
            <Storefront sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
            <Typography color="text.secondary">No offices are registered.</Typography>
            <Typography variant="caption" color="text.secondary">
              A staff account has to belong to an office, so the register comes first.
            </Typography>
            <Button variant="outlined" sx={{ mt: 2 }} startIcon={<Add />} onClick={() => { setEditing(null); setEditorOpen(true); }}>
              Register the first office
            </Button>
          </Box>
        ) : (
          <TableContainer component={Paper} elevation={0}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.04), borderBottom: "2px solid", borderColor: "divider" } }}>
                  <TableCell>Office</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>City</TableCell>
                  <TableCell align="center">Head office</TableCell>
                  <TableCell align="center">Open</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {branches.map((b) => (
                  <TableRow key={b.id} hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
                    <TableCell>
                      <Typography fontWeight={600}>{b.name}</Typography>
                      {b.address && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ maxWidth: 320 }} noWrap>
                          {b.address}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={b.code} />
                    </TableCell>
                    <TableCell>
                      {b.city_name ?? "—"}
                      {b.state_name ? <Typography variant="caption" color="text.secondary" display="block">{b.state_name}</Typography> : null}
                    </TableCell>
                    <TableCell align="center">
                      {b.is_headquarters ? <Chip size="small" color="warning" label="HQ" /> : null}
                    </TableCell>
                    <TableCell align="center">
                      {b.is_active
                        ? <Chip size="small" color="success" variant="outlined" label="Open" />
                        : <Chip size="small" label="Closed" />}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit this office">
                        <IconButton size="small" onClick={() => { setEditing(b); setEditorOpen(true); }}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete — refused while staff or bookings still point here">
                        <IconButton size="small" onClick={() => setConfirmDelete(b)}>
                          <Delete fontSize="small" color="error" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <BranchEditorDialog
        open={editorOpen}
        branch={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={refetch}
      />

      <Dialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Delete {confirmDelete?.name}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Only a register mistake should be deleted. An office that had staff or bookings in it is
            closed instead — closing keeps the history and signs its accounts out on their next request.
            Deletion cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={deleting} onClick={() => confirmDelete && remove(confirmDelete)}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
