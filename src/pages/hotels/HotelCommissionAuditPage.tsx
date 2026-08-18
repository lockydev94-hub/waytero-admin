// ============================================================
// WAYTERO ADMIN — HOTEL COMMISSION AUDIT PAGE
// Doc Ref: 21_Hotel_Module_Implementation/00_HOTEL_MODULE_MASTER_PLAN.md §3.4
//          (commission resolver, source attribution)
//   Docs/14_Reporting_Business_Intelligence/04_FINANCIAL_REPORTING.md
//
// Route: /hotels/commission-audit
// Purpose: platform-wide view of every hotel's resolved commission, so
// finance can see which properties deviate from the city / global rule
// and which are on the platform default.
// ============================================================

import { useState, useMemo } from "react";
import {
  Box, Typography, Card, CardContent, Stack, Chip, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Skeleton, Alert, TextField, MenuItem, Select,
  FormControl, InputLabel, InputAdornment, Avatar, alpha, useTheme,
} from "@mui/material";
import { Search, Refresh, Hotel, OpenInNew, CheckCircle } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { hotelService, COMMISSION_SOURCE_LABELS } from "../../services/hotel.service";

interface AuditRow {
  hotel_id: number;
  hotel_code: string;
  hotel_name: string;
  status: string;
  city_id: number | null;
  city_name: string | null;
  partner_id: number | null;
  partner_name: string | null;
  partner_code: string | null;
  has_override: boolean;
  override_commission_type: string | null;
  override_commission_percent: number | null;
  override_commission_flat: number | null;
  resolved_source: string | null;
}

const SOURCE_COLORS: Record<string, "primary" | "info" | "warning" | "default"> = {
  HOTEL_OVERRIDE: "primary",
  CITY_RULE: "info",
  GLOBAL_RULE: "warning",
  SYSTEM_DEFAULT: "default",
};

function SourceChip({ source }: { source: string | null }) {
  if (!source) return <Chip label="Unknown" size="small" />;
  const color = SOURCE_COLORS[source] ?? "default";
  const label = COMMISSION_SOURCE_LABELS[source] ?? source;
  return <Chip label={label} size="small" color={color} variant={source === "HOTEL_OVERRIDE" ? "filled" : "outlined"} sx={{ fontWeight: 700 }} />;
}

function OverrideValue({ row }: { row: AuditRow }) {
  if (!row.has_override) return <Typography variant="caption" color="text.disabled">—</Typography>;
  const t = row.override_commission_type ?? "";
  if (t === "PERCENTAGE") {
    return <Typography variant="body2" fontWeight={700}>{row.override_commission_percent}%</Typography>;
  }
  if (t === "FLAT") {
    return <Typography variant="body2" fontWeight={700}>₹{row.override_commission_flat ?? 0}</Typography>;
  }
  if (t === "HYBRID") {
    return (
      <Typography variant="body2" fontWeight={700}>
        ₹{row.override_commission_flat ?? 0} + {row.override_commission_percent ?? 0}%
      </Typography>
    );
  }
  return <Typography variant="caption">{t || "—"}</Typography>;
}

export default function HotelCommissionAuditPage() {
  const theme = useTheme();
  const navigate = useNavigate();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["hotel-commission-audit", search, sourceFilter, page, rowsPerPage],
    queryFn: () =>
      hotelService.commissionAudit({
        search: search || undefined,
        source: sourceFilter || undefined,
        page: page + 1,
        page_size: rowsPerPage,
      }),
    staleTime: 60_000,
  });

  const items: AuditRow[] = data?.items ?? [];
  const total = data?.total ?? 0;

  const stats = useMemo(() => {
    const buckets: Record<string, number> = {};
    items.forEach((i) => {
      const s = i.resolved_source ?? "UNKNOWN";
      buckets[s] = (buckets[s] ?? 0) + 1;
    });
    return buckets;
  }, [items]);

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{ bgcolor: "primary.main", width: 40, height: 40 }}>
            <Hotel />
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight={800}>Hotel Commission Audit</Typography>
            <Typography variant="body2" color="text.secondary">
              Resolved commission per hotel — see who is on which rule.
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1.5}>
          <Tooltip title="Refresh"><IconButton onClick={() => refetch()}><Refresh /></IconButton></Tooltip>
        </Stack>
      </Box>

      {/* Source distribution strip */}
      {!isLoading && items.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
          {Object.entries(stats).map(([source, n]) => (
            <Chip
              key={source}
              label={`${COMMISSION_SOURCE_LABELS[source] ?? source}: ${n}`}
              color={SOURCE_COLORS[source] ?? "default"}
              variant={source === "HOTEL_OVERRIDE" ? "filled" : "outlined"}
              sx={{ fontWeight: 700 }}
            />
          ))}
        </Stack>
      )}

      {/* Filters */}
      <Card variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
            <TextField
              size="small"
              placeholder="Search hotel, code, partner…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>
                ),
              }}
              sx={{ flex: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Source</InputLabel>
              <Select
                label="Source"
                value={sourceFilter}
                onChange={(e) => { setSourceFilter(e.target.value); setPage(0); }}
              >
                <MenuItem value="">All sources</MenuItem>
                <MenuItem value="HOTEL_OVERRIDE">Hotel override</MenuItem>
                <MenuItem value="CITY_RULE">City rule</MenuItem>
                <MenuItem value="GLOBAL_RULE">Global rule</MenuItem>
                <MenuItem value="SYSTEM_DEFAULT">Platform default</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load commission audit.</Alert>}

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        {isLoading && <Box sx={{ height: 4, bgcolor: alpha(theme.palette.primary.main, 0.1) }} />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                <TableCell sx={{ fontWeight: 700 }}>Hotel</TableCell>
                <TableCell sx={{ fontWeight: 700, display: { xs: "none", md: "table-cell" } }}>Partner</TableCell>
                <TableCell sx={{ fontWeight: 700, display: { xs: "none", sm: "table-cell" } }}>City</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Override</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Resolved source</TableCell>
                <TableCell sx={{ fontWeight: 700, display: { xs: "none", md: "table-cell" } }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Open</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(7)].map((__, j) => (
                      <TableCell key={j}><Skeleton animation="wave" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Stack alignItems="center" spacing={1}>
                      <CheckCircle sx={{ fontSize: 40, color: "success.main" }} />
                      <Typography variant="body2" color="text.secondary">
                        No hotels match these filters.
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : items.map((r) => (
                <TableRow key={r.hotel_id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{r.hotel_name}</Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ fontFamily: "monospace" }}>
                      {r.hotel_code}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>{r.partner_name ?? "—"}</Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ fontFamily: "monospace" }}>
                      {r.partner_code ?? ""}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                    <Typography variant="body2">{r.city_name ?? "—"}</Typography>
                  </TableCell>
                  <TableCell><OverrideValue row={r} /></TableCell>
                  <TableCell><SourceChip source={r.resolved_source} /></TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                    <Typography variant="caption">{r.status}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Open hotel detail">
                      <IconButton size="small" onClick={() => navigate(`/hotels`)}>
                        <OpenInNew fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[25, 50, 100]}
        />
      </Card>
    </Box>
  );
}
