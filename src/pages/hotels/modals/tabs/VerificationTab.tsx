// ============================================================
// WAYTERO ADMIN — HOTEL VERIFICATION TAB
// Doc Ref: 03_FRONTEND_DESIGN.md §5 "Verification"
// Officer assignment, stage tracker, action panel with own-risk flow.
// ============================================================

import { useState } from "react";
import {
  Box, Typography, Stack, Card, CardContent, Button, Avatar,
  Chip, Tooltip, CircularProgress, Alert, alpha, useTheme, Divider,
} from "@mui/material";
import {
  Person, PersonAdd, PersonRemove, FactCheck, Send, Cancel,
  WarningAmber, CheckCircle, RadioButtonUnchecked,
} from "@mui/icons-material";
import { useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import hotelService, { HotelDetail } from "../../../../services/hotel.service";
import { HOTEL_QUERY_KEYS, fmtDateTime } from "../../constants";
import AssignOfficerDialog from "../AssignOfficerDialog";
import ApprovalDialog from "../ApprovalDialog";
import ReasonDialog from "../../components/ReasonDialog";
import { apiErrorMessage } from "../../../../utils/apiError";
import { currentUserType } from "../../../../utils/currentUser";

interface Props { hotel: HotelDetail; hotelId: number; onRefresh: () => void; }

const STAGES = [
  {
    key: "document",
    label: "Document review",
    desc: "All mandatory documents uploaded and verified",
    hint: "Auto-completes when you click “Move to review”.",
  },
  {
    key: "business",
    label: "Business check",
    desc: "Business details and registrations confirmed",
    hint: "Becomes active after “Move to review”; completes on “Approve”.",
  },
  {
    key: "location",
    label: "Location verified",
    desc: "Property location physically confirmed",
    hint: "Confirmed as part of “Approve”.",
  },
  {
    key: "approval",
    label: "Approval",
    desc: "Final approval by admin or officer",
    hint: "Becomes active on “Approve”; completes when you click “Activate”.",
  },
];

const STATUS_STAGE: Record<string, number> = {
  DRAFT: -1,
  PENDING: 0,
  DOCUMENT_PENDING: 0,
  UNDER_REVIEW: 1,
  APPROVED: 3,
  ACTIVE: 4,
};

export default function VerificationTab({ hotel, hotelId, onRefresh }: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [assignDialog, setAssignDialog] = useState(false);
  const [approvalDialog, setApprovalDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [docPendingDialog, setDocPendingDialog] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const userType = currentUserType();
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(userType);
  const isOfficer = userType === "VERIFICATION_OFFICER";

  const { status, assigned_officer, allowed_transitions = [] } = hotel;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.detail, hotelId] });
    queryClient.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.list] });
    queryClient.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.stats] });
    onRefresh();
  };

  const act = async (key: string, fn: () => Promise<any>, msg: string) => {
    setLoading(key);
    try {
      await fn();
      enqueueSnackbar(msg, { variant: "success" });
      invalidate();
    } catch (e: any) {
      enqueueSnackbar(apiErrorMessage(e, "Action failed"), { variant: "error" });
    } finally { setLoading(null); }
  };

  const handleUnassign = () => act("unassign", () => hotelService.unassignOfficer(hotelId), "Officer unassigned");
  const handleMoveToReview = () => act("review", () => hotelService.moveToReview(hotelId), "Moved to Under Review");
  const handleActivate = () => act("activate", () => hotelService.activate(hotelId), "Hotel activated and is now live");

  const can = (t: string) => allowed_transitions.includes(t);

  const stageIdx = STATUS_STAGE[status] ?? -1;

  return (
    <Box>
      {/* Assigned officer card */}
      <Card variant="outlined" sx={{ borderRadius: 2, mb: 2.5 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>Verification Officer</Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" startIcon={<PersonAdd />} onClick={() => setAssignDialog(true)}>
                {assigned_officer?.is_active ? "Reassign" : "Assign officer"}
              </Button>
              {assigned_officer?.is_active && isAdmin && (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={loading === "unassign" ? <CircularProgress size={12} /> : <PersonRemove />}
                  disabled={loading === "unassign"}
                  onClick={handleUnassign}
                >
                  Unassign
                </Button>
              )}
            </Stack>
          </Stack>

          {assigned_officer?.is_active ? (
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ bgcolor: "primary.main", width: 40, height: 40 }}>
                <Person />
              </Avatar>
              <Box>
                <Typography variant="body2" fontWeight={700}>{assigned_officer.officer_name ?? "—"}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {assigned_officer.officer_mobile ?? ""} · Assigned {fmtDateTime(assigned_officer.assigned_at)}
                </Typography>
                {assigned_officer.notes && (
                  <Typography variant="caption" display="block" color="text.secondary">
                    Note: {assigned_officer.notes}
                  </Typography>
                )}
              </Box>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">No officer assigned.</Typography>
          )}
        </CardContent>
      </Card>

      {/* Stage tracker */}
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Verification stages</Typography>
      <Alert severity="info" icon={<FactCheck fontSize="small" />} sx={{ mb: 1.5, borderRadius: 2, py: 0.5 }}>
        These stages advance automatically as the hotel moves through its status — you don’t tick them off
        individually. Use the <strong>Actions</strong> below to move the hotel forward; each stage shows which action completes it.
      </Alert>
      <Card variant="outlined" sx={{ borderRadius: 2, mb: 2.5 }}>
        <CardContent>
          <Stack spacing={1.5}>
            {STAGES.map((stage, i) => {
              const done = i < stageIdx;
              const current = i === stageIdx;
              return (
                <Stack key={stage.key} direction="row" spacing={1.5} alignItems="flex-start">
                  <Box sx={{
                    width: 28, height: 28, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    bgcolor: done ? "success.main" : current ? "primary.main" : "action.disabledBackground",
                    color: done || current ? "white" : "text.disabled",
                    flexShrink: 0, mt: 0.25,
                  }}>
                    {done ? <CheckCircle sx={{ fontSize: 16 }} /> : <RadioButtonUnchecked sx={{ fontSize: 16 }} />}
                  </Box>
                  <Box>
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                      <Typography variant="body2" fontWeight={current ? 700 : 500} color={current ? "primary.main" : done ? "success.main" : "text.secondary"}>
                        {stage.label}
                      </Typography>
                      {done && <Chip label="Done" size="small" color="success" variant="outlined" sx={{ height: 16, fontSize: "0.6rem" }} />}
                      {current && <Chip label="In progress" size="small" color="primary" variant="outlined" sx={{ height: 16, fontSize: "0.6rem" }} />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block">{stage.desc}</Typography>
                    <Typography variant="caption" color="text.disabled" display="block" sx={{ fontStyle: "italic", mt: 0.25 }}>
                      {stage.hint}
                    </Typography>
                  </Box>
                </Stack>
              );
            })}
          </Stack>
        </CardContent>
      </Card>

      {/* Action panel */}
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Actions</Typography>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Stack spacing={1.5}>
            {/* Move to review */}
            {can("UNDER_REVIEW") && (
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" fontWeight={600}>Move to Under Review</Typography>
                  <Typography variant="caption" color="text.secondary">Assign the hotel for officer review</Typography>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={loading === "review" ? <CircularProgress size={12} /> : <FactCheck />}
                  disabled={!!loading}
                  onClick={handleMoveToReview}
                >
                  Move to review
                </Button>
              </Stack>
            )}

            {/* Document pending */}
            {can("DOCUMENT_PENDING") && (
              <>
                <Divider />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Raise document pending</Typography>
                    <Typography variant="caption" color="text.secondary">Flag that documents need resubmission</Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    color="warning"
                    onClick={() => setDocPendingDialog(true)}
                  >
                    Raise
                  </Button>
                </Stack>
              </>
            )}

            {/* Approve / own-risk */}
            {can("APPROVED") && !isOfficer && (
              <>
                <Divider />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Approve</Typography>
                    <Typography variant="caption" color="text.secondary">Approve the hotel for activation</Typography>
                  </Box>
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    startIcon={<CheckCircle />}
                    onClick={() => setApprovalDialog(true)}
                  >
                    Approve…
                  </Button>
                </Stack>
              </>
            )}

            {/* Reject */}
            {can("REJECTED") && (
              <>
                <Divider />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Reject</Typography>
                    <Typography variant="caption" color="text.secondary">Reject the hotel — partner will be notified</Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<Cancel />}
                    onClick={() => setRejectDialog(true)}
                  >
                    Reject…
                  </Button>
                </Stack>
              </>
            )}

            {/* Activate */}
            {can("ACTIVE") && isAdmin && (
              <>
                <Divider />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Activate</Typography>
                    <Typography variant="caption" color="text.secondary">Go live — hotel becomes bookable</Typography>
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={loading === "activate" ? <CircularProgress size={12} color="inherit" /> : <CheckCircle />}
                    disabled={!!loading}
                    onClick={handleActivate}
                  >
                    Activate
                  </Button>
                </Stack>
              </>
            )}

            {allowed_transitions.length === 0 && (
              <Typography variant="body2" color="text.secondary">No actions available for current status ({status}).</Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AssignOfficerDialog
        open={assignDialog}
        hotelId={hotelId}
        currentOfficerId={assigned_officer?.is_active ? assigned_officer.officer_id : undefined}
        onClose={() => setAssignDialog(false)}
        onSaved={invalidate}
      />

      <ApprovalDialog
        open={approvalDialog}
        hotelId={hotelId}
        hotel={hotel}
        onClose={() => setApprovalDialog(false)}
        onActioned={invalidate}
      />

      <ReasonDialog
        open={rejectDialog}
        title="Reject hotel"
        description="Provide a rejection reason. The partner will be notified."
        required
        confirmLabel="Reject"
        actionColor="error"
        onClose={() => setRejectDialog(false)}
        onConfirm={(reason) => {
          setRejectDialog(false);
          act("reject", () => hotelService.reject(hotelId, reason), "Hotel rejected");
        }}
      />

      <ReasonDialog
        open={docPendingDialog}
        title="Raise document pending"
        description="Describe what documents are missing or need re-submission."
        required
        confirmLabel="Raise"
        actionColor="warning"
        onClose={() => setDocPendingDialog(false)}
        onConfirm={(reason) => {
          setDocPendingDialog(false);
          act("docpending", () => hotelService.markDocumentPending(hotelId, reason), "Document pending raised — partner notified");
        }}
      />
    </Box>
  );
}
