// ============================================================
// WAYTERO ADMIN — OFFERS PAGE
// Backend: /admin/offers (offer_api.py)
// Website hero slider + /offers/[slug] pages are driven from here.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import {
  Box, Typography, Card, CardContent, Chip, Button, IconButton, Tooltip,
  Stack, Grid, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Paper, TextField, InputAdornment, MenuItem,
  CircularProgress, Alert, Switch, alpha, useTheme, Badge,
} from "@mui/material";
import {
  Add, Edit, Delete, Refresh, LocalOffer, Search,
  Warning, OpenInNew, CheckCircle,
} from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { format, parseISO } from "date-fns";

import { offerService, OfferListItem } from "../../services/offer.service";
import OfferEditorDialog from "./OfferEditorDialog";
import { apiErrorMessage } from "../../utils/apiError";

const SERVICE_COLOR: Record<string, "success" | "warning" | "info"> = {
  CAB: "success", HOTEL: "warning", TOUR: "info",
};

function statusChip(o: OfferListItem): { label: string; color: "success" | "warning" | "error" | "default" } {
  if (!o.is_published) return { label: "Draft", color: "default" };
  if (!o.coupon_active) return { label: "Coupon inactive", color: "error" };
  switch (o.status) {
    case "LIVE": return { label: "Live", color: "success" };
    case "SCHEDULED": return { label: "Scheduled", color: "warning" };
    default: return { label: "Expired", color: "error" };
  }
}

export default function OffersPage() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const [offers, setOffers] = useState<OfferListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterService, setFilterService] = useState("");
  const [filterPublished, setFilterPublished] = useState<"" | "true" | "false">("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params: { is_published?: boolean; service_type?: string } = {};
      if (filterPublished !== "") params.is_published = filterPublished === "true";
      if (filterService) params.service_type = filterService;
      setOffers(await offerService.list(params));
    } catch (e) {
      setLoadError(apiErrorMessage(e, "Failed to load offers"));
    } finally {
      setLoading(false);
    }
  }, [filterPublished, filterService]);

  useEffect(() => { load(); }, [load]);

  const filtered = offers.filter(o => {
    if (!filterSearch) return true;
    const q = filterSearch.toLowerCase();
    return o.title.toLowerCase().includes(q) || o.slug.includes(q) || o.coupon_code.toLowerCase().includes(q);
  });

  async function togglePublish(o: OfferListItem) {
    try {
      await offerService.update(o.id, { is_published: !o.is_published });
      enqueueSnackbar(`Offer ${o.is_published ? "unpublished" : "published"}`, { variant: "success" });
      load();
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e, "Failed to update"), { variant: "error" });
    }
  }

  async function handleDelete(o: OfferListItem) {
    if (!window.confirm(`Delete offer "${o.title}"? Bookings keep their history; the coupon is untouched.`)) return;
    try {
      await offerService.delete(o.id);
      enqueueSnackbar("Offer deleted", { variant: "success" });
      load();
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e, "Delete failed"), { variant: "error" });
    }
  }

  const siteUrl = import.meta.env.VITE_SITE_URL ?? "http://localhost:3002";
  const totalExitRequests = offers.reduce((n, o) => n + o.exit_requests, 0);
  const stats = [
    { label: "Total Offers", value: offers.length, color: "primary.main" as const },
    { label: "Live", value: offers.filter(o => statusChip(o).label === "Live").length, color: "success.main" as const },
    { label: "Draft / Scheduled", value: offers.filter(o => ["Draft", "Scheduled"].includes(statusChip(o).label)).length, color: "warning.main" as const },
    { label: "Exit Requests", value: totalExitRequests, color: totalExitRequests ? ("error.main" as const) : ("text.secondary" as const) },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <LocalOffer sx={{ color: "primary.main" }} /> Offers
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Coupon-backed hero offers — the discount itself lives on the linked coupon
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={load} disabled={loading}>Refresh</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => { setEditId(null); setEditorOpen(true); }} sx={{ fontWeight: 600 }}>
            New Offer
          </Button>
        </Stack>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {stats.map(s => (
          <Grid item xs={6} sm={3} key={s.label}>
            <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, background: alpha(theme.palette.primary.main, 0.03) }}>
              <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
                <Typography variant="h4" fontWeight={800} color={s.color}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={500}>{s.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, mb: 2.5 }}>
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <TextField
              size="small" placeholder="Search title, slug or coupon…"
              value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
              sx={{ minWidth: 240 }}
            />
            <TextField select size="small" label="Service" value={filterService} onChange={e => setFilterService(e.target.value)} sx={{ minWidth: 130 }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="CAB">CAB</MenuItem>
              <MenuItem value="HOTEL">HOTEL</MenuItem>
              <MenuItem value="TOUR">TOUR</MenuItem>
            </TextField>
            <TextField select size="small" label="Published" value={filterPublished} onChange={e => setFilterPublished(e.target.value as any)} sx={{ minWidth: 130 }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Published</MenuItem>
              <MenuItem value="false">Draft</MenuItem>
            </TextField>
            <Box flex={1} />
            <Typography variant="body2" color="text.secondary">{filtered.length} offer{filtered.length !== 1 ? "s" : ""}</Typography>
          </Stack>
        </CardContent>
      </Card>

      {loadError && <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={load}>Retry</Button>}>{loadError}</Alert>}

      {/* Table */}
      <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
        ) : filtered.length === 0 ? (
          <Box py={8} textAlign="center">
            <LocalOffer sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
            <Typography color="text.secondary">No offers found</Typography>
            <Button variant="outlined" sx={{ mt: 2 }} startIcon={<Add />} onClick={() => { setEditId(null); setEditorOpen(true); }}>
              Create First Offer
            </Button>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.04), borderBottom: "2px solid", borderColor: "divider" } }}>
                  <TableCell>Offer</TableCell>
                  <TableCell>Service</TableCell>
                  <TableCell>Coupon</TableCell>
                  <TableCell>Badge</TableCell>
                  <TableCell>Validity</TableCell>
                  <TableCell align="center">Targets</TableCell>
                  <TableCell align="center">Published</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map(o => {
                  const st = statusChip(o);
                  return (
                    <TableRow key={o.id} hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Box component="img" src={o.image_url} alt="" onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
                            sx={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "2px solid", borderColor: "divider", flexShrink: 0 }} />
                          <Box>
                            <Typography variant="body2" fontWeight={700}>{o.title}</Typography>
                            <Typography variant="caption" color="text.secondary" fontFamily="monospace">/{o.slug}</Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell><Chip size="small" label={o.service_type} color={SERVICE_COLOR[o.service_type] ?? "default"} variant="outlined" /></TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" fontWeight={700} color="primary.main">{o.coupon_code}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {o.coupon_type === "PLATFORM" ? "Platform funded" : o.coupon_type === "PARTNER_ONLY" ? "Partner funded" : "Shared funding"}
                        </Typography>
                      </TableCell>
                      <TableCell><Chip size="small" label={o.badge} sx={{ fontWeight: 700 }} /></TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {format(parseISO(o.valid_from), "dd MMM yy")} – {format(parseISO(o.valid_to), "dd MMM yy")}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title={`${o.hotel_links} hotel link(s), ${o.tour_links} package(s)`}>
                          <Typography variant="body2">
                            {o.service_type === "CAB" ? "1 category" : `${o.service_type === "HOTEL" ? o.hotel_links : o.tour_links}`}
                          </Typography>
                        </Tooltip>
                        {o.exit_requests > 0 && (
                          <Tooltip title={`${o.exit_requests} partner exit request(s) pending — open the offer to approve or reject`}>
                            <Badge badgeContent={o.exit_requests} color="error" sx={{ ml: 0.5 }}>
                              <Warning fontSize="small" color="warning" />
                            </Badge>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Switch size="small" checked={o.is_published} onChange={() => togglePublish(o)} color="success" />
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={st.label} size="small" color={st.color} sx={{ fontWeight: 600, minWidth: 72 }}
                          icon={st.label === "Live" ? <CheckCircle sx={{ fontSize: 16 }} /> : undefined} />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="View on website">
                            <IconButton size="small" href={`${siteUrl}/offers/${o.slug}`} target="_blank" rel="noreferrer">
                              <OpenInNew fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => { setEditId(o.id); setEditorOpen(true); }}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => handleDelete(o)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <OfferEditorDialog open={editorOpen} offerId={editId} onClose={() => setEditorOpen(false)} onSaved={load} />
    </Box>
  );
}
