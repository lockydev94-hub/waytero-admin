// ============================================================
// WAYTERO ADMIN — GOOGLE MAP PICKER MODAL
// Click / drag / search on Google Maps to pin a location.
//
// Fixes:
//   1. Autocomplete on search input is bound ONCE per modal open
//      (stored in acInstanceRef, not re-created on re-render).
//   2. Map + Marker + Autocomplete are all created in one stable
//      initMap() call and stored in refs — no re-creation on
//      state updates.
//   3. Shared singleton loader (same __gmapsReady callback as
//      CabBookingPage) — only one <script> ever injected.
// ============================================================
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, CircularProgress, Alert,
  IconButton, Stack, alpha,
} from "@mui/material";
import { Close, LocationOn, MyLocation, Search } from "@mui/icons-material";

export interface PickedLocation {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (loc: PickedLocation) => void;
  title: string;
  apiKey: string;
  cityName?: string;
  initialLat?: number;
  initialLng?: number;
  markerColor?: "green" | "red";
}

declare global {
  interface Window {
    google: any;
    __gmapsReady?: () => void;
    _gmapsLoaded?: boolean;
    _gmapsCallbacks?: (() => void)[];
  }
}

// ── Shared singleton loader ────────────────────────────────────
function waitForMaps(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) { resolve(); return; }

    if (window._gmapsLoaded === false) {
      // Script injected but not yet ready — queue callback
      (window._gmapsCallbacks ??= []).push(resolve);
      return;
    }

    // Not started yet — inject script
    window._gmapsLoaded = false;
    window._gmapsCallbacks = [resolve];

    const prev = window.__gmapsReady;
    window.__gmapsReady = () => {
      window._gmapsLoaded = true;
      (window._gmapsCallbacks ?? []).forEach(cb => cb());
      window._gmapsCallbacks = [];
      prev?.();
    };

    // Avoid double-injection if parent already did it
    if (document.querySelector(`script[src*="maps.googleapis.com"]`)) return;

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&callback=__gmapsReady`;
    script.async = true; script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

// ── Reverse geocode ────────────────────────────────────────────
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  return new Promise((resolve) => {
    if (!window.google?.maps?.Geocoder) {
      resolve(`${lat.toFixed(6)}, ${lng.toFixed(6)}`); return;
    }
    new window.google.maps.Geocoder().geocode(
      { location: { lat, lng } },
      (results: any, status: string) => {
        resolve(
          status === "OK" && results?.[0]
            ? results[0].formatted_address
            : `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        );
      }
    );
  });
}

// ── Component ──────────────────────────────────────────────────
export default function GoogleMapPickerModal({
  open, onClose, onConfirm, title, apiKey,
  cityName, initialLat, initialLng, markerColor = "red",
}: Props) {
  // DOM refs
  const mapDivRef   = useRef<HTMLDivElement>(null);
  const searchRef   = useRef<HTMLInputElement>(null);

  // Google Maps object refs (stable across renders)
  const mapRef        = useRef<any>(null);
  const markerRef     = useRef<any>(null);
  const acInstanceRef = useRef<any>(null); // Autocomplete (NOT AutocompleteService)

  // State
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [picked,    setPicked]    = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [resolving, setResolving] = useState(false);

  // ── Build / rebuild the map when the modal opens ─────────────
  const initMap = useCallback(async () => {
    if (!mapDivRef.current || !window.google?.maps) return;

    // Destroy old map / marker / autocomplete instances
    mapRef.current        = null;
    markerRef.current     = null;
    acInstanceRef.current = null;

    // Decide initial center
    let center = { lat: 20.5937, lng: 78.9629 }; // India centroid
    let zoom   = 5;

    if (initialLat && initialLng) {
      center = { lat: initialLat, lng: initialLng };
      zoom   = 15;
    } else if (cityName) {
      await new Promise<void>((res) => {
        new window.google.maps.Geocoder().geocode(
          { address: `${cityName}, India` },
          (results: any, status: string) => {
            if (status === "OK" && results?.[0]) {
              center = results[0].geometry.location.toJSON();
              zoom   = 12;
            }
            res();
          }
        );
      });
    }

    // ── Create Map ──────────────────────────────────────────
    const map = new window.google.maps.Map(mapDivRef.current, {
      center, zoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_CENTER },
    });
    mapRef.current = map;

    // ── Create draggable Marker ─────────────────────────────
    const markerIcon = markerColor === "green"
      ? "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
      : "https://maps.google.com/mapfiles/ms/icons/red-dot.png";

    const marker = new window.google.maps.Marker({
      map,
      draggable: true,
      icon: { url: markerIcon },
      visible: !!(initialLat && initialLng),
      position: center,
    });
    markerRef.current = marker;

    // Pre-fill if initial coords provided
    if (initialLat && initialLng) {
      setResolving(true);
      const addr = await reverseGeocode(initialLat, initialLng);
      setPicked({ lat: initialLat, lng: initialLng, address: addr });
      setResolving(false);
    }

    // Map click → place marker
    map.addListener("click", async (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      marker.setPosition(e.latLng);
      marker.setVisible(true);
      setResolving(true);
      const address = await reverseGeocode(lat, lng);
      setPicked({ lat, lng, address });
      setResolving(false);
    });

    // Marker drag end
    marker.addListener("dragend", async (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setResolving(true);
      const address = await reverseGeocode(lat, lng);
      setPicked({ lat, lng, address });
      setResolving(false);
    });

    // ── Bind Autocomplete to search input ───────────────────
    // IMPORTANT: bind directly to the DOM input element stored in searchRef.
    // This must happen AFTER the map is ready so we can set bounds.
    if (searchRef.current && window.google.maps.places?.Autocomplete) {
      const ac = new window.google.maps.places.Autocomplete(searchRef.current, {
        componentRestrictions: { country: "in" },
        fields: ["formatted_address", "geometry", "place_id", "name"],
      });
      acInstanceRef.current = ac;

      // Bias to current map view so results are city-relevant
      ac.bindTo("bounds", map);

      ac.addListener("place_changed", async () => {
        const place = ac.getPlace();
        if (!place?.geometry?.location) {
          // User pressed Enter without selecting — try to use what's in the box
          return;
        }
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        map.setCenter({ lat, lng });
        map.setZoom(16);
        marker.setPosition({ lat, lng });
        marker.setVisible(true);

        const address = place.formatted_address
          || place.name
          || (searchRef.current?.value ?? "");
        setPicked({ lat, lng, address });
      });
    }

    setLoading(false);
  }, [cityName, initialLat, initialLng, markerColor]);

  // ── Run initMap each time modal opens ────────────────────────
  useEffect(() => {
    if (!open) {
      // Clean up on close
      mapRef.current        = null;
      markerRef.current     = null;
      acInstanceRef.current = null;
      return;
    }

    setLoading(true);
    setError("");
    setPicked(null);

    waitForMaps(apiKey)
      .then(initMap)
      .catch(() => {
        setError(
          "Failed to load Google Maps. Check the API key in Settings → API Integrations."
        );
        setLoading(false);
      });
  }, [open, apiKey, initMap]);

  // ── "Use my location" ────────────────────────────────────────
  const handleMyLocation = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      mapRef.current.setCenter({ lat, lng });
      mapRef.current.setZoom(16);
      markerRef.current?.setPosition({ lat, lng });
      markerRef.current?.setVisible(true);
      setResolving(true);
      const address = await reverseGeocode(lat, lng);
      setPicked({ lat, lng, address });
      setResolving(false);
    });
  };

  const handleConfirm = () => {
    if (!picked) return;
    onConfirm({ address: picked.address, lat: picked.lat, lng: picked.lng });
    onClose();
  };

  const colorGreen = markerColor === "green";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      // keepMounted=false so mapDivRef gets a fresh DOM node each open
      keepMounted={false}
      PaperProps={{ sx: { borderRadius: 3, overflow: "hidden", maxHeight: "92vh" } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1 }}>
        <LocationOn sx={{ color: colorGreen ? "success.main" : "error.main" }} />
        <Typography fontWeight={700} flex={1} fontSize={15}>{title}</Typography>
        <IconButton onClick={onClose} size="small"><Close /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {error && (
          <Alert severity="error" sx={{ m: 2, borderRadius: 2 }}>{error}</Alert>
        )}

        {/* Search bar — the <input> element itself is the Autocomplete target */}
        <Box sx={{
          px: 2, py: 1.5,
          borderBottom: "1px solid", borderColor: "divider",
          bgcolor: alpha("#6366F1", 0.025),
          display: "flex", alignItems: "center", gap: 1,
        }}>
          <Search sx={{ color: "text.secondary", fontSize: 19, flexShrink: 0 }} />
          <input
            ref={searchRef}
            placeholder={`Search address${cityName ? ` in ${cityName}` : ""}…`}
            style={{
              flex: 1, border: "none", outline: "none",
              background: "transparent",
              fontSize: 14, fontFamily: "inherit", color: "inherit",
              minWidth: 0,
            }}
          />
          <IconButton size="small" onClick={handleMyLocation} title="Use my location">
            <MyLocation fontSize="small" />
          </IconButton>
        </Box>

        {/* Map container */}
        <Box position="relative">
          {loading && (
            <Box sx={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              bgcolor: "background.paper", zIndex: 10,
            }}>
              <CircularProgress />
            </Box>
          )}
          {/* mapDivRef must always be present in the DOM so initMap can attach */}
          <Box ref={mapDivRef} sx={{ height: 420, width: "100%" }} />
        </Box>

        {/* Selected location preview bar */}
        <Box sx={{
          px: 2, py: 1.5,
          borderTop: "1px solid", borderColor: "divider",
          bgcolor: picked
            ? alpha(colorGreen ? "#22C55E" : "#EF4444", 0.04)
            : "background.paper",
          minHeight: 52, display: "flex", alignItems: "center", gap: 1,
        }}>
          {resolving ? (
            <>
              <CircularProgress size={14} />
              <Typography fontSize={13} color="text.secondary" ml={1}>
                Resolving address…
              </Typography>
            </>
          ) : picked ? (
            <>
              <LocationOn sx={{
                color: colorGreen ? "success.main" : "error.main",
                fontSize: 18, flexShrink: 0,
              }} />
              <Typography fontSize={13} fontWeight={600} flex={1} sx={{ wordBreak: "break-word" }}>
                {picked.address}
              </Typography>
              <Typography fontSize={11} color="text.secondary" ml="auto" whiteSpace="nowrap" pl={1}>
                {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
              </Typography>
            </>
          ) : (
            <Typography fontSize={13} color="text.secondary">
              Click on the map or search above to pin a location
            </Typography>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5 }}>
        <Button onClick={onClose} variant="outlined"
          sx={{ borderRadius: 2, textTransform: "none" }}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!picked || resolving}
          startIcon={<LocationOn />}
          sx={{
            borderRadius: 2, textTransform: "none", fontWeight: 700,
            bgcolor: colorGreen ? "success.main" : "error.main",
            "&:hover": { bgcolor: colorGreen ? "success.dark" : "error.dark" },
          }}
        >
          Confirm Location
        </Button>
      </DialogActions>
    </Dialog>
  );
}
