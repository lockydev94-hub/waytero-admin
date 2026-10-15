// ============================================================
// WAYTERO ADMIN — PUBLISH BLOCKERS DIALOG
// Doc Ref: City + Service-Type Landing Pages §Phase 3
//
//  The backend refuses to publish a page that is not worth indexing and
//  answers with {message, errors: {problems: [...]}}. This dialog is where
//  those problems get shown, because the only way to learn them is to try.
//
//  "Publish anyway" re-sends with confirmed=true. That is a real override, not
//  a decorative button: an admin who knows a page should go live thin still has
//  to be able to do it, but they have to see the list first.
// ============================================================

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography,
} from "@mui/material";

interface Props {
  open: boolean;
  problems: string[];
  onCancel: () => void;
  onConfirm: () => void;
  confirming?: boolean;
}

export default function PublishBlockersDialog({
  open,
  problems,
  onCancel,
  onConfirm,
  confirming,
}: Props) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Publish this page anyway?</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          This page is not ready to publish. Going live with it indexed and thin
          costs more SEO than not publishing it at all.
        </Alert>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          What the platform found:
        </Typography>
        <List dense sx={{ pt: 0 }}>
          {problems.map((problem) => (
            <ListItem key={problem} sx={{ alignItems: "flex-start" }}>
              <ListItemText
              primary={problem}
                slotProps={{ primary: { variant: "body2" } }}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Go back and fix</Button>
        <Button
          variant="contained"
          color="warning"
          onClick={onConfirm}
          disabled={confirming}
        >
          Publish anyway
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Read the blocker list out of a failed publish call. Returns null when the
 * error is something else entirely, so the caller can fall back to a plain
 * error message rather than opening an empty dialog.
 */
export function publishProblems(error: any): string[] | null {
  const problems = error?.response?.data?.errors?.problems;
  return Array.isArray(problems) && problems.length ? problems.map(String) : null;
}