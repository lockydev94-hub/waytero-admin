// ============================================================
// WAYTERO ADMIN — LOCATION AUTOCOMPLETE
// Google Places predictions biased to selected city.
// Falls back to plain TextField when Maps API not configured.
//
// Root causes fixed:
//   1. Service init now re-runs when apiKey transitions "" → real key
//      AND also on mount if window.google already exists (loaded by parent)
//   2. City bias is done via `locationBias` (LatLngBounds) when possible,
//      NOT by mutating the query string — so dropdown shows clean addresses
//   3. acRef init is also triggered by a MutationObserver-free polling
//      loop that starts fresh whenever apiKey changes
// ============================================================
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Box, TextField, List, ListItem, ListItemIcon, ListItemText,
  Paper, CircularProgress, InputAdornment, IconButton, alpha,
  Typography,
} from "@mui/material";
import { LocationOn, Map as MapIcon } from "@mui/icons-material";

interface Props {
  label: string;
  value: string;
  onChange: (val: string) => void;
  onCoordinates?: (lat: number, lng: number, address: string) => void;
  onMapPickClick?: () => void;
  apiKey?: string;        // empty string → manual / fallback mode
  cityName?: string;      // bias predictions to this city
  markerColor?: "green" | "red";
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

interface Suggestion {
  description: string;
  placeId: string;
  mainText?: string;
  secondaryText?: string;
}

// City-name → approximate LatLng bias bounds (India cities)
// Used to give Google a location hint without polluting the query string.
// Returns undefined if city unknown → Google falls back to component restriction.
function cityBounds(name?: string): any | undefined {
  if (!name || !window.google?.maps) return undefined;
  // We'll geocode the city on first use and cache it
  return undefined; // handled asynchronously in initServices
}

export default function LocationAutocomplete({
  label, value, onChange, onCoordinates, onMapPickClick,
  apiKey, cityName, markerColor = "red", required, placeholder, disabled,
}: Props) {
  const acRef        = useRef<any>(null);    // AutocompleteService instance
  const sessionRef   = useRef<any>(null);    // AutocompleteSessionToken
  const geocoderRef  = useRef<any>(null);    // Geocoder instance
  const cityBoundsRef = useRef<any>(null);   // cached LatLngBounds for city bias
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen]               = useState(false);
  const [loading, setLoading]         = useState(false);
  const [servicesReady, setServicesReady] = useState(false);

  // ── Init Places services ─────────────────────────────────────
  // Called whenever Google Maps script finishes loading.
  // Safe to call multiple times — idempotent.
  const initServices = useCallback(() => {
    if (!window.google?.maps?.places) return false;
    if (!acRef.current) {
      acRef.current     = new window.google.maps.places.AutocompleteService();
      sessionRef.current = new window.google.maps.places.AutocompleteSessionToken();
      geocoderRef.current = new window.google.maps.Geocoder();
    }
    // Geocode city name once to get bias bounds
    if (cityName && !cityBoundsRef.current && geocoderRef.current) {
      geocoderRef.current.geocode(
        { address: `${cityName}, India` },
        (results: any, status: string) => {
          if (status === "OK" && results?.[0]?.geometry?.viewport) {
            cityBoundsRef.current = results[0].geometry.viewport;
          }
        }
      );
    }
    return true;
  }, [cityName]);

  // ── Re-init when apiKey changes (including "" → real key) ───
  useEffect(() => {
    if (!apiKey) {
      // No key — clear everything
      acRef.current       = null;
      sessionRef.current  = null;
      geocoderRef.current = null;
      setServicesReady(false);
      setSuggestions([]);
      return;
    }

    // Reset services so initServices re-creates them with fresh city bias
    acRef.current       = null;
    sessionRef.current  = null;
    geocoderRef.current = null;
    cityBoundsRef.current = null;

    // Try immediately (script may already be loaded)
    if (initServices()) {
      setServicesReady(true);
      return;
    }

    // Poll until the script finishes loading
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (initServices()) {
        setServicesReady(true);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 250);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [apiKey, initServices]);

  // ── Re-geocode city when cityName changes ───────────────────
  useEffect(() => {
    cityBoundsRef.current = null;
    if (servicesReady && cityName && geocoderRef.current) {
      geocoderRef.current.geocode(
        { address: `${cityName}, India` },
        (results: any, status: string) => {
          if (status === "OK" && results?.[0]?.geometry?.viewport) {
            cityBoundsRef.current = results[0].geometry.viewport;
          }
        }
      );
    }
  }, [cityName, servicesReady]);

  // ── Fetch predictions ────────────────────────────────────────
  const fetchSuggestions = useCallback((input: string) => {
    if (!acRef.current || !input || input.length < 2) {
      setSuggestions([]); setOpen(false); return;
    }
    setLoading(true);

    const req: any = {
      input,                                        // unmodified user text
      componentRestrictions: { country: "in" },     // restrict to India
      sessionToken: sessionRef.current,
    };

    // Apply viewport bias if we have geocoded city bounds
    if (cityBoundsRef.current) {
      req.locationBias = cityBoundsRef.current;
    }

    acRef.current.getPlacePredictions(req, (predictions: any[], status: string) => {
      setLoading(false);
      if (status === "OK" && Array.isArray(predictions) && predictions.length) {
        setSuggestions(
          predictions.slice(0, 6).map((p: any) => ({
            description:   p.description,
            placeId:       p.place_id,
            mainText:      p.structured_formatting?.main_text,
            secondaryText: p.structured_formatting?.secondary_text,
          }))
        );
        setOpen(true);
      } else {
        setSuggestions([]); setOpen(false);
      }
    });
  }, []);

  // ── Handle text input ────────────────────────────────────────
  const handleInput = (val: string) => {
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (servicesReady && acRef.current) {
      debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
    }
  };

  // ── Select a suggestion ──────────────────────────────────────
  const selectSuggestion = (sug: Suggestion) => {
    // Fill input with clean description (not biased query string)
    onChange(sug.description);
    setSuggestions([]); setOpen(false);

    // Geocode to get coordinates
    if (onCoordinates && geocoderRef.current) {
      geocoderRef.current.geocode(
        { placeId: sug.placeId },
        (results: any, status: string) => {
          if (status === "OK" && results?.[0]) {
            const loc = results[0].geometry.location;
            onCoordinates(
              loc.lat(),
              loc.lng(),
              results[0].formatted_address || sug.description
            );
          }
        }
      );
    }

    // Rotate session token after a selection (Google billing best practice)
    if (window.google?.maps?.places) {
      sessionRef.current = new window.google.maps.places.AutocompleteSessionToken();
    }
  };

  const colorGreen = markerColor === "green";

  return (
    <Box position="relative">
      <TextField
        label={label}
        value={value}
        onChange={e => handleInput(e.target.value)}
        onBlur={() => debounceRef.current
          ? setTimeout(() => setOpen(false), 180)
          : setOpen(false)
        }
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        fullWidth
        size="small"
        required={required}
        placeholder={
          placeholder ||
          (servicesReady
            ? `Type to search${cityName ? ` in ${cityName}` : ""}…`
            : "Enter location…")
        }
        disabled={disabled}
        autoComplete="off"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <LocationOn sx={{
                color: colorGreen ? "success.main" : "error.main",
                fontSize: 18,
              }} />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              {loading && <CircularProgress size={13} sx={{ mr: 0.5 }} />}
              {onMapPickClick && !disabled && (
                <IconButton
                  size="small"
                  onClick={onMapPickClick}
                  title="Pin location on map"
                  sx={{ color: "primary.main", "&:hover": { bgcolor: alpha("#6366F1", 0.08) } }}
                >
                  <MapIcon fontSize="small" />
                </IconButton>
              )}
            </InputAdornment>
          ),
        }}
        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
      />

      {/* Predictions dropdown */}
      {open && suggestions.length > 0 && (
        <Paper
          elevation={8}
          onMouseDown={e => e.preventDefault()} // prevent blur before click
          sx={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            zIndex: 1500, borderRadius: 2, overflow: "hidden",
            border: "1px solid", borderColor: "divider",
            maxHeight: 300, overflowY: "auto",
          }}
        >
          <List dense disablePadding>
            {suggestions.map((sug, i) => (
              <ListItem
                key={sug.placeId || i}
                onClick={() => selectSuggestion(sug)}
                sx={{
                  py: 1, px: 1.5, cursor: "pointer",
                  borderBottom: i < suggestions.length - 1 ? "1px solid" : "none",
                  borderColor: "divider",
                  "&:hover": { bgcolor: alpha("#6366F1", 0.06) },
                  transition: "background 0.1s",
                  flexDirection: "column",
                  alignItems: "flex-start",
                }}
              >
                <Box display="flex" alignItems="center" gap={1} width="100%">
                  <LocationOn sx={{ fontSize: 15, color: "text.secondary", flexShrink: 0 }} />
                  <Box flex={1} minWidth={0}>
                    <Typography fontSize={13} fontWeight={600} noWrap>
                      {sug.mainText || sug.description}
                    </Typography>
                    {sug.secondaryText && (
                      <Typography fontSize={11} color="text.secondary" noWrap>
                        {sug.secondaryText}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
}
