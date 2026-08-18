// ============================================================
// HOTEL DETAIL — ROOMS TAB (C6 part 1)
// Doc Ref: 03_FRONTEND_DESIGN.md §5 — accordion per category
// Full CRUD for room categories + physical rooms list.
// Heavy dialog (RoomCategoryDialog) deferred as a TODO placeholder
// that opens an inline dialog for now.
// ============================================================
import React, { useState, lazy, Suspense } from "react";
import {
  Box, Typography, Stack, Button, Card, CardContent,
  Accordion, AccordionSummary, AccordionDetails,
  Chip, IconButton, Tooltip, CircularProgress,
  Switch, FormControlLabel, Alert, Divider, Table,
  TableBody, TableCell, TableHead, TableRow, alpha, useTheme,
} from "@mui/material";
import {
  ExpandMore, Add, Edit, Delete, MeetingRoom,
  TableChart, Inventory, BedOutlined,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { hotelService, HotelDetail, RoomCategory, Room } from "../../../../services/hotel.service";
import { HOTEL_QUERY_KEYS } from "../../constants";
import { apiErrorMessage } from "../../../../utils/apiError";

// Lazy-loaded dialogs (built separately in Phase C6)
const RoomCategoryDialog = lazy(() => import("../RoomCategoryDialog").catch(() => ({ default: () => <div /> })));
const InventoryCalendarDialog = lazy(() => import("../InventoryCalendarDialog").catch(() => ({ default: () => <div /> })));
const BulkRoomsDialog = lazy(() => import("../BulkRoomsDialog").catch(() => ({ default: () => <div /> })));

interface Props {
  hotel: HotelDetail;
  isOfficer: boolean;
  onRefresh: () => void;
}

// Must stay in step with backend MEAL_PLANS (hotel/constants): EP, CP, MAP, AP.
// "AI" is not an accepted value — the server 422s on it.
const MEAL_PLAN_LABELS: Record<string, string> = {
  EP: "Room Only", CP: "With Breakfast", MAP: "Half Board", AP: "Full Board",
};

function RoomStatusChip({ status }: { status: string }) {
  const color: any = status === "AVAILABLE" ? "success" : status === "UNDER_MAINTENANCE" ? "warning" : "default";
  return <Chip label={status.replace(/_/g, " ")} size="small" color={color} sx={{ height: 18, fontSize: "0.6rem" }} />;
}

function PhysicalRoomsTable({ hotelId, categoryId }: { hotelId: number; categoryId: number }) {
  const { data: rooms = [], isLoading } = useQuery<Room[]>({
    queryKey: ["hotel-rooms", hotelId, categoryId],
    queryFn: () => hotelService.listRooms(hotelId, categoryId),
    staleTime: 30_000,
  });

  if (isLoading) return <CircularProgress size={20} />;
  if (!rooms.length) return <Typography variant="caption" color="text.secondary">No physical rooms added yet.</Typography>;

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>Room #</TableCell>
          <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>Floor</TableCell>
          <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>Status</TableCell>
          <TableCell sx={{ fontWeight: 700, fontSize: "0.72rem" }}>Remarks</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rooms.map((r) => (
          <TableRow key={r.id} sx={{ opacity: r.is_active ? 1 : 0.5 }}>
            <TableCell sx={{ fontSize: "0.8rem", fontWeight: 600 }}>{r.room_number}</TableCell>
            <TableCell sx={{ fontSize: "0.8rem" }}>{r.floor_number ?? "—"}</TableCell>
            <TableCell><RoomStatusChip status={r.room_status} /></TableCell>
            <TableCell sx={{ fontSize: "0.75rem", color: "text.secondary" }}>{r.remarks ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CategoryAccordion({
  cat,
  hotel,
  isOfficer,
  onRefresh,
  onEdit,
  onBulkAdd,
}: {
  cat: RoomCategory;
  hotel: HotelDetail;
  isOfficer: boolean;
  onRefresh: () => void;
  onEdit: (cat: RoomCategory) => void;
  onBulkAdd: (cat: RoomCategory) => void;
}) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [showRooms, setShowRooms] = useState(false);

  const toggleActive = useMutation({
    mutationFn: () => hotelService.updateRoomCategory(hotel.id, cat.id, { is_active: !cat.is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.rooms, hotel.id] });
      onRefresh();
    },
    onError: (e: any) => enqueueSnackbar(apiErrorMessage(e, "Failed"), { variant: "error" }),
  });

  const occupancyLabel = `${cat.base_occupancy}A${cat.max_children > 0 ? `+${cat.max_children}C` : ""}`;
  const priceLabel = `₹${cat.base_price.toLocaleString()}`;

  return (
    <Accordion
      variant="outlined"
      sx={{ borderRadius: "8px !important", mb: 1, "&:before": { display: "none" } }}
    >
      <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2, py: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1, mr: 1, minWidth: 0 }}>
          <Box sx={{ flexShrink: 0 }}>
            <MeetingRoom color="primary" />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="subtitle2" fontWeight={700} noWrap>{cat.category_name}</Typography>
              {cat.room_type && <Chip label={cat.room_type.replace(/_/g, " ")} size="small" variant="outlined" sx={{ height: 18, fontSize: "0.6rem" }} />}
              {!cat.is_active && <Chip label="Inactive" size="small" color="default" sx={{ height: 18, fontSize: "0.6rem" }} />}
            </Stack>
            <Stack direction="row" spacing={1.5} sx={{ mt: 0.25 }}>
              <Typography variant="caption" color="text.secondary">{priceLabel}/night</Typography>
              <Typography variant="caption" color="text.secondary">·</Typography>
              <Typography variant="caption" color="text.secondary">{occupancyLabel}</Typography>
              {cat.bed_type && <>
                <Typography variant="caption" color="text.secondary">·</Typography>
                <Typography variant="caption" color="text.secondary">{cat.bed_type}</Typography>
              </>}
              <Typography variant="caption" color="text.secondary">·</Typography>
              <Typography variant="caption" color="text.secondary">{cat.total_rooms} rooms</Typography>
            </Stack>
          </Box>

          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
            <Chip label={MEAL_PLAN_LABELS[cat.meal_plan] ?? cat.meal_plan} size="small" color="info" variant="outlined" sx={{ height: 20, fontSize: "0.65rem" }} />
            {!isOfficer && (
              <>
                <Tooltip title="Edit category">
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(cat); }}>
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Switch
                  size="small"
                  checked={cat.is_active}
                  onChange={(e) => { e.stopPropagation(); toggleActive.mutate(); }}
                  onClick={(e) => e.stopPropagation()}
                />
              </>
            )}
          </Stack>
        </Stack>
      </AccordionSummary>

      <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
        <Divider sx={{ mb: 1.5 }} />

        {/* Details grid */}
        <Stack direction="row" spacing={3} sx={{ mb: 2 }} flexWrap="wrap">
          {cat.view_type && <Box><Typography variant="caption" color="text.secondary">View</Typography><Typography variant="body2">{cat.view_type}</Typography></Box>}
          {cat.room_size_sqft && <Box><Typography variant="caption" color="text.secondary">Size</Typography><Typography variant="body2">{cat.room_size_sqft} sqft</Typography></Box>}
          <Box><Typography variant="caption" color="text.secondary">Max Occupancy</Typography><Typography variant="body2">{cat.max_occupancy}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Published Price</Typography><Typography variant="body2">{cat.published_price ? `₹${cat.published_price.toLocaleString()}` : "—"}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Min Sellable</Typography><Typography variant="body2">{cat.min_sellable_price ? `₹${cat.min_sellable_price.toLocaleString()}` : "—"}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Refundable</Typography><Typography variant="body2">{cat.is_refundable ? "Yes" : "No"}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Rate Plans</Typography><Typography variant="body2">{cat.rate_plan_count}</Typography></Box>
        </Stack>

        {/* Physical rooms toggle + bulk add */}
        {!isOfficer && (
          <Box>
            <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<TableChart />}
                onClick={() => setShowRooms((s) => !s)}
              >
                {showRooms ? "Hide" : "Show"} Physical Rooms ({cat.physical_room_count})
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Add />}
                onClick={() => onBulkAdd(cat)}
              >
                Bulk Add Rooms
              </Button>
            </Stack>
            {showRooms && <PhysicalRoomsTable hotelId={hotel.id} categoryId={cat.id} />}
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

export default function RoomsTab({ hotel, isOfficer, onRefresh }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [editCat, setEditCat] = useState<RoomCategory | null | "new">(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [bulkAddCat, setBulkAddCat] = useState<RoomCategory | null>(null);

  const { data: categories = [], isLoading } = useQuery<RoomCategory[]>({
    queryKey: [HOTEL_QUERY_KEYS.rooms, hotel.id],
    queryFn: () => hotelService.listRoomCategories(hotel.id),
    staleTime: 30_000,
  });

  const handleSave = () => {
    qc.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.rooms, hotel.id] });
    qc.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.detail, hotel.id] });
    setEditCat(null);
    onRefresh();
  };

  if (isLoading) return <Box sx={{ display: "flex", justifyContent: "center", pt: 6 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 3 }}>
      {!isOfficer && (
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Inventory />}
            onClick={() => setInventoryOpen(true)}
            disabled={categories.length === 0}
          >
            Manage Inventory Calendar
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setEditCat("new")}>
            Add Room Category
          </Button>
        </Box>
      )}

      {categories.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8, color: "text.disabled" }}>
          <BedOutlined sx={{ fontSize: 56, mb: 1 }} />
          <Typography variant="h6" gutterBottom>No room categories yet</Typography>
          <Typography variant="body2">Add at least one room category before submitting for verification.</Typography>
          {!isOfficer && (
            <Button variant="contained" startIcon={<Add />} onClick={() => setEditCat("new")} sx={{ mt: 2 }}>
              Add First Room Category
            </Button>
          )}
        </Box>
      ) : (
        <Stack>
          {categories.map((cat) => (
            <CategoryAccordion
              key={cat.id}
              cat={cat}
              hotel={hotel}
              isOfficer={isOfficer}
              onRefresh={onRefresh}
              onEdit={(c) => setEditCat(c)}
              onBulkAdd={(c) => setBulkAddCat(c)}
            />
          ))}
        </Stack>
      )}

      {/* RoomCategoryDialog — builds in Phase C6 */}
      {editCat !== null && (
        <Suspense fallback={<CircularProgress />}>
          <RoomCategoryDialog
            open
            hotelId={hotel.id}
            category={editCat === "new" ? undefined : editCat ?? undefined}
            onClose={() => setEditCat(null)}
            onSaved={handleSave}
          />
        </Suspense>
      )}

      {/* Inventory Calendar Dialog */}
      {inventoryOpen && (
        <Suspense fallback={<CircularProgress />}>
          <InventoryCalendarDialog
            open
            hotelId={hotel.id}
            categories={categories}
            onClose={() => setInventoryOpen(false)}
          />
        </Suspense>
      )}

      {/* Bulk Add Rooms Dialog */}
      {bulkAddCat && (
        <Suspense fallback={<CircularProgress />}>
          <BulkRoomsDialog
            open
            hotelId={hotel.id}
            categoryId={bulkAddCat.id}
            categoryName={bulkAddCat.category_name}
            onClose={() => setBulkAddCat(null)}
            onSaved={() => {
              setBulkAddCat(null);
              handleSave();
            }}
          />
        </Suspense>
      )}
    </Box>
  );
}
