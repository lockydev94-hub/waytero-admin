// ============================================================
// HOTEL DETAIL — MEDIA TAB
// Doc Ref: 03_FRONTEND_DESIGN.md §5 — image management
// ============================================================
import React, { useState, useCallback } from "react";
import {
  Box, Typography, Card, Stack, IconButton, Alert,
  Tooltip, Chip, CircularProgress, alpha, useTheme,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from "@mui/material";
import { Star, Delete, Edit, CloudUpload, CheckCircle } from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { hotelService, HotelDetail, HotelImage, HOTEL_UPLOAD_FOLDERS } from "../../../../services/hotel.service";
import HotelImageUpload from "../../components/HotelImageUpload";
import { HOTEL_QUERY_KEYS } from "../../constants";

const MIN_IMAGES = 3;

interface Props {
  hotel: HotelDetail;
  isOfficer: boolean;
  onRefresh: () => void;
}

function ImageCard({
  image,
  hotelId,
  isOfficer,
  onRefresh,
}: {
  image: HotelImage;
  hotelId: number;
  isOfficer: boolean;
  onRefresh: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [caption, setCaption] = useState(image.caption ?? "");
  const [saving, setSaving] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.detail, hotelId] });

  const handleSetPrimary = async () => {
    try {
      await hotelService.setPrimaryImage(hotelId, image.id);
      enqueueSnackbar("Primary image updated", { variant: "success" });
      invalidate();
      onRefresh();
    } catch { enqueueSnackbar("Failed", { variant: "error" }); }
  };

  const handleDelete = async () => {
    try {
      await hotelService.deleteImage(hotelId, image.id);
      enqueueSnackbar("Image removed", { variant: "success" });
      invalidate();
      onRefresh();
    } catch { enqueueSnackbar("Delete failed", { variant: "error" }); }
  };

  const handleSaveCaption = async () => {
    setSaving(true);
    try {
      await hotelService.updateImage(hotelId, image.id, { caption });
      enqueueSnackbar("Caption saved", { variant: "success" });
      setEditOpen(false);
      invalidate();
    } catch { enqueueSnackbar("Save failed", { variant: "error" }); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Card
        variant="outlined"
        sx={{
          borderRadius: 2,
          overflow: "hidden",
          position: "relative",
          "&:hover .overlay": { opacity: 1 },
          border: image.is_primary ? "2px solid" : "1px solid",
          borderColor: image.is_primary ? "primary.main" : "divider",
        }}
      >
        <Box sx={{ position: "relative", paddingTop: "66%", bgcolor: "grey.100" }}>
          <Box
            component="img"
            src={image.image_url}
            alt={image.caption ?? "Hotel image"}
            sx={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
          {image.is_primary && (
            <Chip
              label="Primary"
              size="small"
              icon={<Star sx={{ fontSize: "0.75rem !important" }} />}
              color="primary"
              sx={{ position: "absolute", top: 6, left: 6, height: 20, fontSize: "0.65rem" }}
            />
          )}
          {!isOfficer && (
            <Box
              className="overlay"
              sx={{
                position: "absolute", inset: 0,
                bgcolor: "rgba(0,0,0,0.55)",
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 0.5, opacity: 0, transition: "opacity 0.2s",
              }}
            >
              {!image.is_primary && (
                <Tooltip title="Set as primary">
                  <IconButton size="small" onClick={handleSetPrimary} sx={{ color: "white", bgcolor: "rgba(255,255,255,0.1)" }}>
                    <Star fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Edit caption">
                <IconButton size="small" onClick={() => setEditOpen(true)} sx={{ color: "white", bgcolor: "rgba(255,255,255,0.1)" }}>
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton size="small" onClick={handleDelete} sx={{ color: "white", bgcolor: "rgba(255,255,255,0.1)" }}>
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>
        {image.caption && (
          <Box sx={{ px: 1, py: 0.5 }}>
            <Typography variant="caption" color="text.secondary" noWrap>{image.caption}</Typography>
          </Box>
        )}
      </Card>

      {/* Caption edit dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Caption</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            label="Caption"
            sx={{ mt: 1 }}
            inputProps={{ maxLength: 200 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveCaption} variant="contained" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default function MediaTab({ hotel, isOfficer, onRefresh }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const images = hotel.images ?? [];
  const shortfall = Math.max(0, MIN_IMAGES - images.length);

  const handleUploaded = useCallback(async (secureUrl: string) => {
    await hotelService.addImage(hotel.id, {
      image_url: secureUrl,
      image_type: "GALLERY",
    });
    qc.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.detail, hotel.id] });
    onRefresh();
  }, [hotel.id, qc, onRefresh]);

  return (
    <Box sx={{ p: 3 }}>
      {shortfall > 0 && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          {shortfall} more image{shortfall > 1 ? "s" : ""} required before submission (minimum {MIN_IMAGES}).
        </Alert>
      )}
      {images.length >= MIN_IMAGES && (
        <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 2, borderRadius: 2 }}>
          Image requirement met ({images.length}/{MIN_IMAGES}+).
        </Alert>
      )}

      {!isOfficer && (
        <Box sx={{ mb: 3 }}>
          <HotelImageUpload folder={HOTEL_UPLOAD_FOLDERS.images} onUploaded={handleUploaded} multiple />
        </Box>
      )}

      {images.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6, color: "text.disabled" }}>
          <CloudUpload sx={{ fontSize: 48, mb: 1 }} />
          <Typography>No images yet — upload at least {MIN_IMAGES} to proceed</Typography>
        </Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 2 }}>
          {images.map((img) => (
            <ImageCard key={img.id} image={img} hotelId={hotel.id} isOfficer={isOfficer} onRefresh={onRefresh} />
          ))}
        </Box>
      )}
    </Box>
  );
}
