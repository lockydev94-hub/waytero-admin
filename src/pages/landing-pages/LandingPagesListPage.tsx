// ============================================================
// WAYTERO ADMIN — LANDING PAGES LIST
// Doc Ref: City + Service-Type Landing Pages §Phase 3
//  Route: /cms/landing-pages
//
//  The marketing surface: one row per city/state page the website indexes.
//  Rows carry the two things that decide whether a page is worth publishing —
//  SEO readiness and whether anyone has uploaded real art yet — so the admin
//  works the list top-down instead of opening every editor to look.
// ============================================================

import { useCallback, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputAdornment,
  Link,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add,
  Bolt,
  Edit,
  Image as ImageIcon,
  OpenInNew,
  Place as PlaceIcon,
  Public,
  Search,
} from "@mui/icons-material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { SITE_URL } from "../../constants";
import {
  landingPagesService,
  PAGE_TYPE_LABELS,
  type LandingImageSource,
  type LandingPageType,
} from "../../services/landingPages.service";
import { apiErrorMessage } from "../../utils/apiError";
import { seoFromRecord, seoScore } from "../../utils/seoValidation";
import PublishBlockersDialog, { publishProblems } from "./components/PublishBlockersDialog";

const PAGE_TYPES = Object.keys(PAGE_TYPE_LABELS) as LandingPageType[];

/**
 * "gradient" is not a failure — it is the designed look of a page nobody has
 * uploaded art for yet (owner decision, 2026-10-15: no curated stock). Colour
 * it neutrally so the only red in this table means "needs attention".
 */
const IMAGERY_CHIP: Record<
  LandingImageSource,
  { label: string; color: "success" | "info" | "default" }
> = {
  admin: { label: "Uploaded", color: "success" },
  curated: { label: "Curated", color: "info" },
  gradient: { label: "No art yet", color: "default" },
};

const FIELD_SX = { minWidth: { xs: "100%", sm: 170 } };

export default function LandingPagesListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [blockers, setBlockers] = useState<{ id: number; problems: string[] } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["landing-pages", page, rowsPerPage, search, typeFilter, statusFilter],
    queryFn: () =>
      landingPagesService.listPages({
        page: page + 1,
        per_page: rowsPerPage,
        search: search || undefined,
        page_type: typeFilter || undefined,
        status: statusFilter,
      }),
    placeholderData: keepPreviousData,
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["landing-pages"] });
  }, [qc]);

  const syncMutation = useMutation({
    mutationFn: () => landingPagesService.syncPages(),
    onSuccess: (result) => {
      enqueueSnackbar(
        result.created.length
          ? `Provisioned ${result.created.length} page(s)`
          : "Every active city and state already has pages",
        { variant: "success" }
      );
      invalidate();
    },
    onError: (err) =>
      enqueueSnackbar(apiErrorMessage(err, "Provisioning failed"), { variant: "error" }),
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, confirmed }: { id: number; confirmed: boolean }) =>
      landingPagesService.setPublished(id, true, confirmed),
    onSuccess: () => {
      setBlockers(null);
      enqueueSnackbar("Page published", { variant: "success" });
      invalidate();
    },
    // The backend answers an unready page with the list of what is missing —
    // show it rather than a bare "failed", and let the admin choose.
    onError: (err, vars) => {
      const problems = publishProblems(err);
      if (problems && !vars.confirmed) {
        setBlockers({ id: vars.id, problems });
        return;
      }
      setBlockers(null);
      enqueueSnackbar(apiErrorMessage(err, "Failed to publish"), { variant: "error" });
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: number) => landingPagesService.setPublished(id, false),
    onSuccess: () => {
      enqueueSnackbar("Page unpublished", { variant: "success" });
      invalidate();
    },
    onError: (err) =>
      enqueueSnackbar(apiErrorMessage(err, "Failed to unpublish"), { variant: "error" }),
  });

  const openInWebsite = (slug: string) =>
    window.open(`${SITE_URL}/${slug}`, "_blank", "noopener,noreferrer");

  const hasFilters = !!(search || typeFilter || statusFilter !== "all");

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Landing Pages
          </Typography>
          <Typography variant="body2" color="text.secondary">
            City and state pages the website indexes — one per service, per place.
          </Typography>
          {/* Pages only exist for serviceable cities — deep-link to Master
              Data so admins can add a city without hunting the sidebar. */}
          <Link
            component={RouterLink}
            to="/settings?tab=master-data"
            style={{ fontSize: 13, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <PlaceIcon fontSize="inherit" /> Manage serviceable cities &amp; states
          </Link>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            startIcon={
              syncMutation.isPending ? <CircularProgress size={16} /> : <Bolt />
            }
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            Provision missing pages
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate("/cms/landing-pages/new")}
          >
            New page
          </Button>
        </Stack>
      </Stack>

      <Card sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
          <TextField
            size="small"
            placeholder="Search city, state or slug"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            sx={{ flex: { sm: 1 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={FIELD_SX}>
            <Select
              value={typeFilter}
              displayEmpty
              aria-label="Page type"
              onChange={(e) => {
                setTypeFilter(e.target.value as string);
                setPage(0);
              }}
              renderValue={(v) =>
                v ? PAGE_TYPE_LABELS[v as LandingPageType] : "All page types"
              }
            >
              <MenuItem value="">All page types</MenuItem>
              {PAGE_TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  {PAGE_TYPE_LABELS[t]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 140 } }}>
            <Select
              value={statusFilter}
              aria-label="Publish status"
              onChange={(e) => {
                setStatusFilter(e.target.value as string);
                setPage(0);
              }}
            >
              <MenuItem value="all">All statuses</MenuItem>
              <MenuItem value="published">Published</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
            </Select>
          </FormControl>
          {hasFilters && (
            <Button
              size="small"
              onClick={() => {
                setSearch("");
                setTypeFilter("");
                setStatusFilter("all");
                setPage(0);
              }}
            >
              Clear
            </Button>
          )}
        </Stack>

        {isLoading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress />
          </Stack>
        ) : isError ? (
          <Alert severity="error">Could not load landing pages.</Alert>
        ) : rows.length === 0 ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 6 }}>
            <Public sx={{ fontSize: 40, color: "text.disabled" }} />
            <Typography variant="subtitle1" fontWeight={600}>
              No landing pages yet
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ maxWidth: 440, textAlign: "center" }}
            >
              Provisioning creates a hub, cab, hotel and tour page for every active city.
              Each one already renders with derived copy and live prices — you only add
              what makes this city different.
            </Typography>
            <Button
              variant="contained"
              startIcon={<Bolt />}
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              sx={{ mt: 1 }}
            >
              Provision missing pages
            </Button>
          </Stack>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Page</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Scope</TableCell>
                    <TableCell>Imagery</TableCell>
                    <TableCell>SEO</TableCell>
                    <TableCell align="right">Published</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const seo = seoScore(seoFromRecord(row));
                    const imagery = IMAGERY_CHIP[row.image_source] ?? IMAGERY_CHIP.gradient;
                    return (
                      <TableRow
                        key={row.id}
                        hover
                        onClick={() => navigate(`/cms/landing-pages/${row.id}`)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {row.derived?.headline || row.display_name || row.slug}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            /{row.slug}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={PAGE_TYPE_LABELS[row.page_type] ?? row.page_type}
                          />
                        </TableCell>
                        <TableCell>
                          {(row.page_type === "PLACE_CABS" && row.place_name
                            ? row.place_name
                            : row.city_name || row.state_name) || "—"}
                          {row.page_type === "PLACE_CABS" && row.city_name ? (
                            <Typography component="span" variant="caption" color="text.secondary">
                              {" · "}
                              {row.city_name}
                            </Typography>
                          ) : row.city_name && row.state_name ? (
                            <Typography component="span" variant="caption" color="text.secondary">
                              {" · "}
                              {row.state_name}
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={imagery.color}
                            icon={<ImageIcon sx={{ fontSize: 16 }} />}
                            label={imagery.label}
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip
                            title={
                              seo.missing.length
                                ? `Missing: ${seo.missing.join(", ")}`
                                : "Slug, title, description and keywords are all set"
                            }
                          >
                            <span>
                              <Chip
                                size="small"
                                label={`${4 - seo.missing.length}/4`}
                                color={
                                  seo.missing.length === 0
                                    ? "success"
                                    : seo.missing.length <= 1
                                      ? "warning"
                                      : "default"
                                }
                              />
                            </span>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right">
                          <Switch
                            size="small"
                            checked={row.is_published}
                            disabled={publishMutation.isPending || unpublishMutation.isPending}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (e.target.checked) {
                                publishMutation.mutate({ id: row.id, confirmed: false });
                              } else {
                                unpublishMutation.mutate(row.id);
                              }
                            }}
                            inputProps={{ "aria-label": `Publish ${row.slug}` }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Open in website">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openInWebsite(row.slug);
                                  }}
                                  disabled={!row.is_published}
                                  aria-label={`Open ${row.slug} in website`}
                                >
                                  <OpenInNew fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/cms/landing-pages/${row.id}`);
                                }}
                                aria-label={`Edit ${row.slug}`}
                              >
                                <Edit fontSize="small" />
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
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_, next) => setPage(next)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 20, 50, 100]}
            />
          </>
        )}
      </Card>

      <PublishBlockersDialog
        open={!!blockers}
        problems={blockers?.problems ?? []}
        confirming={publishMutation.isPending}
        onCancel={() => setBlockers(null)}
        onConfirm={() =>
          blockers && publishMutation.mutate({ id: blockers.id, confirmed: true })
        }
      />
    </Box>
  );
}
