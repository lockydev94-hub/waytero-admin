// ============================================================
// WAYTERO ADMIN — HOTEL COMMERCIALS TAB
// Doc Ref: 03_FRONTEND_DESIGN.md §5 "Commercials"
// Commission card (resolved source) + Tax card. With live worked example.
// ============================================================

import { useState } from "react";
import {
  Box, Typography, Stack, Card, CardContent, Button, Chip,
  Alert, CircularProgress, Divider, alpha, useTheme, Table,
  TableHead, TableRow, TableCell, TableBody,
} from "@mui/material";
import { Edit, Delete, AccountBalance } from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import hotelService, { HotelDetail, ResolvedCommission, GstSlab } from "../../../../services/hotel.service";
import { HOTEL_QUERY_KEYS, TAX_MODE_LABELS, inr } from "../../constants";
import CommissionDialog from "../CommissionDialog";
import TaxConfigDialog from "../TaxConfigDialog";
import { apiErrorMessage } from "../../../../utils/apiError";

interface Props { hotel: HotelDetail; hotelId: number; onRefresh: () => void; }

const SOURCE_LABELS: Record<string, string> = {
  HOTEL_OVERRIDE: "Hotel override",
  CITY_RULE: "City rule",
  GLOBAL_RULE: "Global rule",
  SYSTEM_DEFAULT: "Platform default",
};
const SOURCE_COLOR: Record<string, "primary" | "default" | "info" | "warning"> = {
  HOTEL_OVERRIDE: "primary",
  CITY_RULE: "info",
  GLOBAL_RULE: "warning",
  SYSTEM_DEFAULT: "default",
};

export default function CommercialsTab({ hotel, hotelId, onRefresh }: Props) {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [commDialog, setCommDialog] = useState(false);
  const [taxDialog, setTaxDialog] = useState(false);
  const [removingComm, setRemovingComm] = useState(false);

  const { data: commission, isLoading: commLoading, refetch: refetchComm } = useQuery<ResolvedCommission>({
    queryKey: [HOTEL_QUERY_KEYS.commission, hotelId],
    queryFn: () => hotelService.getCommission(hotelId),
    staleTime: 60_000,
  });

  const { data: gstSlabs = [] } = useQuery<GstSlab[]>({
    queryKey: [HOTEL_QUERY_KEYS.gstSlabs],
    queryFn: () => hotelService.listGstSlabs(true),
    staleTime: 5 * 60_000,
  });

  const invalidateAll = () => {
    // Force immediate refetch by removing the query from cache entirely, then refetching.
    // invalidateQueries alone respects staleTime, so a query fetched <60s ago won't refetch.
    queryClient.removeQueries({ queryKey: [HOTEL_QUERY_KEYS.commission, hotelId] });
    queryClient.invalidateQueries({ queryKey: [HOTEL_QUERY_KEYS.detail, hotelId] });
    refetchComm();
    onRefresh();
  };

  const handleRemoveOverride = async () => {
    if (!window.confirm("Remove hotel-level commission override? It will revert to city/global/default rule.")) return;
    setRemovingComm(true);
    try {
      await hotelService.removeCommission(hotelId);
      enqueueSnackbar("Commission override removed — now inheriting from parent rule", { variant: "success" });
      invalidateAll();
    } catch (e: any) {
      enqueueSnackbar(apiErrorMessage(e, "Remove failed"), { variant: "error" });
    } finally { setRemovingComm(false); }
  };

  // Build worked example text from commission.example object
  const exampleLines = commission?.example
    ? Object.entries(commission.example).map(([k, v]) => ({ k, v }))
    : [];

  return (
    <Box>
      {/* Commission card */}
      <Card variant="outlined" sx={{ borderRadius: 2, mb: 2.5 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700}>Commission</Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => setCommDialog(true)}>
                Edit
              </Button>
              {commission?.source === "HOTEL_OVERRIDE" && (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={removingComm ? <CircularProgress size={12} /> : <Delete />}
                  disabled={removingComm}
                  onClick={handleRemoveOverride}
                >
                  Remove override
                </Button>
              )}
            </Stack>
          </Stack>

          {commLoading ? (
            <CircularProgress size={20} />
          ) : commission ? (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={3} flexWrap="wrap">
                <Box>
                  <Typography variant="caption" color="text.secondary">Type</Typography>
                  <Typography variant="body2" fontWeight={700}>{commission.commission_type}</Typography>
                </Box>
                {commission.commission_percent > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Percent</Typography>
                    <Typography variant="body2" fontWeight={700}>{commission.commission_percent}%</Typography>
                  </Box>
                )}
                {commission.commission_flat > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Flat</Typography>
                    <Typography variant="body2" fontWeight={700}>{inr(commission.commission_flat)}</Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary">Applies to</Typography>
                  <Typography variant="body2" fontWeight={700}>{commission.applies_to}</Typography>
                </Box>
                {commission.min_commission !== null && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Min</Typography>
                    <Typography variant="body2" fontWeight={700}>{inr(commission.min_commission)}</Typography>
                  </Box>
                )}
                {commission.max_commission !== null && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Max</Typography>
                    <Typography variant="body2" fontWeight={700}>{inr(commission.max_commission)}</Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary">Source</Typography>
                  <Box sx={{ mt: 0.25 }}>
                    <Chip
                      label={SOURCE_LABELS[commission.source] ?? commission.source}
                      size="small"
                      color={SOURCE_COLOR[commission.source] ?? "default"}
                      sx={{ height: 20, fontSize: 11 }}
                    />
                  </Box>
                </Box>
              </Stack>

              {/* Worked example */}
              {exampleLines.length > 0 && (
                <Box sx={{ bgcolor: alpha(theme.palette.info.main, 0.06), borderRadius: 1.5, p: 1.5 }}>
                  <Typography variant="caption" fontWeight={700} color="info.main" sx={{ display: "block", mb: 0.75 }}>
                    Worked example
                  </Typography>
                  {exampleLines.map(({ k, v }) => (
                    <Stack key={k} direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: "capitalize" }}>
                        {k.replace(/_/g, " ")}
                      </Typography>
                      <Typography variant="caption" fontWeight={600}>
                        {typeof v === "number" && k.includes("amount") ? inr(v) : String(v)}
                      </Typography>
                    </Stack>
                  ))}
                </Box>
              )}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">Commission not configured.</Typography>
          )}
        </CardContent>
      </Card>

      {/* Tax card */}
      <Card variant="outlined" sx={{ borderRadius: 2, mb: 2.5 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700}>Tax Configuration</Typography>
            <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => setTaxDialog(true)}>
              Edit
            </Button>
          </Stack>

          {!hotel.platform_gst_enabled && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Global GST is disabled in platform settings — tax mode is not applied to bookings.
            </Alert>
          )}

          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Tax mode</Typography>
              <Typography variant="body2" fontWeight={600}>{TAX_MODE_LABELS[hotel.tax_mode] ?? hotel.tax_mode}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">GST registered</Typography>
              <Typography variant="body2" fontWeight={600}>{hotel.is_gst_registered ? "Yes" : "No"}</Typography>
            </Stack>
            {hotel.gst_number && (
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">GST number</Typography>
                <Typography variant="body2" fontWeight={600}>{hotel.gst_number}</Typography>
              </Stack>
            )}
          </Stack>

          {/* GST slab table */}
          {hotel.platform_gst_enabled && gstSlabs.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" fontWeight={700} sx={{ display: "block", mb: 1 }}>
                GST slabs (platform-wide, editable in Settings)
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Slab</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Tariff from</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Tariff to</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>GST %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {gstSlabs.map((s) => (
                    <TableRow key={s.id} hover>
                      <TableCell sx={{ fontSize: 12 }}>{s.slab_name}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{inr(s.tariff_from)}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{s.tariff_to ? inr(s.tariff_to) : "& above"}</TableCell>
                      <TableCell sx={{ fontSize: 12, fontWeight: 700 }}>{s.gst_percent}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CommissionDialog
        open={commDialog}
        hotelId={hotelId}
        current={commission}
        onClose={() => setCommDialog(false)}
        onSaved={invalidateAll}
      />
      <TaxConfigDialog
        open={taxDialog}
        hotelId={hotelId}
        hotel={hotel}
        onClose={() => setTaxDialog(false)}
        onSaved={invalidateAll}
      />
    </Box>
  );
}
