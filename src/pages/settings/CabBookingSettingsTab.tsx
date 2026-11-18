// ============================================================
// WAYTERO ADMIN — CAB BOOKING AVAILABILITY
// File: src/pages/settings/CabBookingSettingsTab.tsx
// Doc Ref: Admin Settings → Cab Booking
//
// One switch per bookable cab product. The values live in
// system_configurations (CAB_BOOKING_<TYPE>_ENABLED) and are enforced by the
// public and Customer Care booking APIs, not only hidden in this screen.
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import {
  AirportShuttle,
  CalendarMonth,
  DirectionsCar,
  Loop,
  Route,
  SwapHoriz,
  ToggleOn,
} from "@mui/icons-material";
import { settingsService } from "../../services/settings.service";
import { apiErrorMessage } from "../../utils/apiError";

interface CabTypeSetting {
  code: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  /** A missing row falls back to the launch configuration. */
  defaultEnabled: boolean;
}

const CAB_TYPES: CabTypeSetting[] = [
  {
    code: "LOCAL",
    label: "Local",
    description: "In-city rides and hourly local hire.",
    icon: <DirectionsCar />,
    defaultEnabled: true,
  },
  {
    code: "AIRPORT",
    label: "Airport",
    description: "Airport pickup and drop transfers.",
    icon: <AirportShuttle />,
    defaultEnabled: true,
  },
  {
    code: "OUTSTATION",
    label: "Outstation",
    description: "Inter-city trips, including one-way outstation packages.",
    icon: <Route />,
    defaultEnabled: true,
  },
  {
    code: "ONE_WAY",
    label: "One Way",
    description: "Explicit drop-only inter-city bookings.",
    icon: <SwapHoriz />,
    defaultEnabled: false,
  },
  {
    code: "ROUND_TRIP",
    label: "Round Trip",
    description: "Return journeys back to the pickup city.",
    icon: <Loop />,
    defaultEnabled: true,
  },
  {
    code: "DAILY",
    label: "Cab Rent",
    description: "Daily rental with driver, sold per 24-hour day.",
    icon: <CalendarMonth />,
    defaultEnabled: true,
  },
];

const configKey = (code: string) => `CAB_BOOKING_${code}_ENABLED`;

const isTruthy = (value: string | undefined): boolean =>
  ["1", "true", "yes", "on", "enabled"].includes(
    (value ?? "").trim().toLowerCase(),
  );

export default function CabBookingSettingsTab({
  enqueueSnackbar,
}: {
  enqueueSnackbar: any;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const rows = await settingsService.getConfigurations();
      setValues(
        Object.fromEntries(rows.map((row) => [row.config_key, row.config_value ?? ""])),
      );
    } catch (error) {
      setLoadError(apiErrorMessage(error, "Could not load cab booking settings"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const enabled = useMemo(
    () =>
      Object.fromEntries(
        CAB_TYPES.map((type) => {
          const stored = values[configKey(type.code)];
          return [
            type.code,
            stored === undefined ? type.defaultEnabled : isTruthy(stored),
          ];
        }),
      ) as Record<string, boolean>,
    [values],
  );

  const enabledCount = CAB_TYPES.filter((type) => enabled[type.code]).length;

  const toggle = async (type: CabTypeSetting) => {
    const key = configKey(type.code);
    const previous = enabled[type.code];
    const next = !previous;

    setValues((current) => ({ ...current, [key]: String(next) }));
    setSaving((current) => ({ ...current, [type.code]: true }));
    try {
      await settingsService.upsertConfiguration(
        key,
        String(next),
        `Allow new ${type.label} cab bookings`,
      );
      enqueueSnackbar(
        `${type.label} cab booking ${next ? "enabled" : "disabled"}`,
        { variant: "success" },
      );
    } catch (error) {
      setValues((current) => ({ ...current, [key]: String(previous) }));
      enqueueSnackbar(
        apiErrorMessage(error, `Could not update ${type.label} cab booking`),
        { variant: "error" },
      );
    } finally {
      setSaving((current) => ({ ...current, [type.code]: false }));
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
        <ToggleOn color="primary" />
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Cab booking availability
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Control which cab products customers and the booking desk can sell.
          </Typography>
        </Box>
      </Stack>

      <Alert severity="info" sx={{ my: 2.5, borderRadius: 2 }}>
        Switching a type off removes it from the website and customer app,
        rejects new quotes and bookings on every API, and hides it from the
        Customer Care booking desk. Existing trips are not cancelled or changed.
      </Alert>

      {loadError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {loadError}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Chip
            label={`${enabledCount} of ${CAB_TYPES.length} cab types bookable`}
            size="small"
            color={enabledCount > 0 ? "success" : "warning"}
            variant="outlined"
            sx={{ mb: 2, fontWeight: 600 }}
          />

          <Stack spacing={1.5}>
            {CAB_TYPES.map((type) => {
              const isEnabled = enabled[type.code];
              const isSaving = Boolean(saving[type.code]);
              return (
                <Card key={type.code} variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent
                    sx={{
                      py: 1.5,
                      "&:last-child": { pb: 1.5 },
                      opacity: isSaving ? 0.65 : 1,
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      justifyContent="space-between"
                      spacing={1.5}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: 2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: isEnabled
                              ? "rgba(25, 118, 210, 0.08)"
                              : "action.hover",
                            color: isEnabled ? "primary.main" : "text.disabled",
                            "& svg": { fontSize: 21 },
                          }}
                        >
                          {type.icon}
                        </Box>
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography fontWeight={700} fontSize={14}>
                              {type.label}
                            </Typography>
                            <Chip
                              label={isEnabled ? "Bookable" : "Disabled"}
                              size="small"
                              color={isEnabled ? "success" : "default"}
                              sx={{ height: 20, fontSize: 10.5, fontWeight: 700 }}
                            />
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {type.description}
                          </Typography>
                        </Box>
                      </Stack>

                      <FormControlLabel
                        sx={{ m: 0, flexShrink: 0 }}
                        control={
                          <Switch
                            checked={isEnabled}
                            disabled={isSaving}
                            onChange={() => toggle(type)}
                            inputProps={{
                              "aria-label": `${type.label} cab booking enabled`,
                            }}
                          />
                        }
                        label={
                          <Typography fontSize={12.5} fontWeight={600}>
                            {isSaving ? "Saving…" : isEnabled ? "On" : "Off"}
                          </Typography>
                        }
                      />
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </>
      )}
    </Box>
  );
}
