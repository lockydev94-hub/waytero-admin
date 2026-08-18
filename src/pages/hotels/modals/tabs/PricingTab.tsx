// ============================================================
// WAYTERO ADMIN — HOTEL PRICING TAB
// Doc Ref: 03_FRONTEND_DESIGN.md §5 "Pricing"
// Category selector → rate plan table → RatePreviewCalendar.
// ============================================================

import { useState } from "react";
import {
  Box, Typography, Stack, Card, CardContent, Button, IconButton,
  Select, MenuItem, FormControl, InputLabel, Chip, Tooltip,
  Table, TableHead, TableRow, TableCell, TableBody, Switch,
  CircularProgress, Alert, alpha, useTheme,
} from "@mui/material";
import { Add, Edit, Delete } from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import hotelService, { HotelDetail, RoomCategory, RatePlan } from "../../../../services/hotel.service";
import { HOTEL_QUERY_KEYS, RATE_PLAN_TYPE_LABELS, inr, fmtDate } from "../../constants";
import RatePlanDialog from "../RatePlanDialog";
import RatePreviewCalendar from "../RatePreviewCalendar";
import { apiErrorMessage } from "../../../../utils/apiError";

interface Props { hotel: HotelDetail; hotelId: number; onRefresh: () => void; }

const PLAN_TYPE_COLOR: Record<string, "default" | "primary" | "warning" | "success" | "info"> = {
  PROMOTIONAL: "primary",
  WEEKEND: "info",
  SEASONAL: "warning",
  FESTIVAL: "success",
};

export default function PricingTab({ hotel, hotelId }: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [selectedCatId, setSelectedCatId] = useState<number | "">("");
  const [editPlan, setEditPlan] = useState<{ open: boolean; plan?: RatePlan }>({ open: false });
  const [deleting, setDeleting] = useState<number | null>(null);

  const { data: categories = [], isLoading: catsLoading } = useQuery<RoomCategory[]>({
    queryKey: [HOTEL_QUERY_KEYS.roomCategories, hotelId],
    queryFn: () => hotelService.listRoomCategories(hotelId),
    staleTime: 60_000,
  });

  // Auto-select first category
  const effectiveCatId = selectedCatId !== "" ? selectedCatId : (categories[0]?.id ?? "");

  const { data: ratePlans = [], isLoading: plansLoading, refetch } = useQuery<RatePlan[]>({
    queryKey: [HOTEL_QUERY_KEYS.ratePlans, hotelId, effectiveCatId],
    queryFn: () => hotelService.listRatePlans(hotelId, typeof effectiveCatId === "number" ? effectiveCatId : undefined),
    staleTime: 30_000,
    enabled: !!effectiveCatId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.ratePlans, hotelId] });
    queryClient.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.ratePreview, hotelId] });
    refetch();
  };

  const handleDelete = async (plan: RatePlan) => {
    if (!window.confirm(`Delete rate plan "${plan.plan_name}"?`)) return;
    setDeleting(plan.id);
    try {
      await hotelService.deleteRatePlan(hotelId, plan.id);
      enqueueSnackbar("Rate plan deleted", { variant: "success" });
      invalidate();
    } catch (e: any) {
      enqueueSnackbar(apiErrorMessage(e, "Delete failed"), { variant: "error" });
    } finally { setDeleting(null); }
  };

  const handleToggleActive = async (plan: RatePlan) => {
    try {
      await hotelService.updateRatePlan(hotelId, plan.id, { is_active: !plan.is_active });
      invalidate();
    } catch (e: any) {
      enqueueSnackbar(apiErrorMessage(e, "Update failed"), { variant: "error" });
    }
  };

  const selectedCat = categories.find((c) => c.id === effectiveCatId);

  if (catsLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (categories.length === 0) {
    return (
      <Alert severity="info">
        Add room categories first — pricing is configured per room category.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Category selector */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Room category</InputLabel>
          <Select
            value={effectiveCatId}
            label="Room category"
            onChange={(e) => setSelectedCatId(e.target.value as number)}
          >
            {categories.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.category_name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="contained"
          size="small"
          startIcon={<Add />}
          disabled={!effectiveCatId}
          onClick={() => setEditPlan({ open: true })}
          sx={{ borderRadius: 2, fontWeight: 700, ml: "auto" }}
        >
          Add Rate Plan
        </Button>
      </Stack>

      {/* Rate plans table */}
      <Card variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
        {plansLoading ? (
          <CardContent sx={{ textAlign: "center", py: 4 }}>
            <CircularProgress size={24} />
          </CardContent>
        ) : ratePlans.length === 0 ? (
          <CardContent sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              No rate plans for this category yet. The base price applies.
            </Typography>
          </CardContent>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                <TableCell sx={{ fontWeight: 700 }}>Plan name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Dates</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Mode</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Value</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Min nights</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Active</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {ratePlans.map((plan) => (
                <TableRow key={plan.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{plan.plan_name}</TableCell>
                  <TableCell>
                    <Chip
                      label={RATE_PLAN_TYPE_LABELS[plan.plan_type] ?? plan.plan_type}
                      size="small"
                      color={PLAN_TYPE_COLOR[plan.plan_type] ?? "default"}
                      sx={{ height: 20, fontSize: 11 }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {fmtDate(plan.date_from)} – {fmtDate(plan.date_to)}
                    {plan.day_of_week_mask && (
                      <Typography variant="caption" display="block" color="text.secondary">
                        {plan.day_of_week_mask}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{plan.rate_mode}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {plan.rate_mode === "PERCENT" ? `${plan.rate_value}%` : inr(plan.rate_value)}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{plan.min_nights || "—"}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{plan.priority}</TableCell>
                  <TableCell>
                    <Switch
                      size="small"
                      checked={plan.is_active}
                      onChange={() => handleToggleActive(plan)}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Edit plan">
                        <IconButton size="small" onClick={() => setEditPlan({ open: true, plan })} aria-label="Edit plan">
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete plan">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={deleting === plan.id}
                            onClick={() => handleDelete(plan)}
                            aria-label="Delete plan"
                          >
                            {deleting === plan.id ? <CircularProgress size={14} /> : <Delete fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Rate preview calendar */}
      {selectedCat && (
        <RatePreviewCalendar
          hotelId={hotelId}
          roomCategory={selectedCat}
        />
      )}

      {/* Dialog */}
      {editPlan.open && selectedCat && (
        <RatePlanDialog
          open={editPlan.open}
          hotelId={hotelId}
          roomCategory={selectedCat}
          plan={editPlan.plan ?? undefined}
          onClose={() => setEditPlan({ open: false })}
          onSaved={invalidate}
        />
      )}
    </Box>
  );
}
