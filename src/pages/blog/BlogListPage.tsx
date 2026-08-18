// ============================================================
// WAYTERO ADMIN — BLOG LIST PAGE
// Doc Ref: Blog System §4 — Admin Portal
//
//  Route: /cms/blog
//
//  Premium content-management list for blog posts:
//    • KPI summary cards (Total / Published / Drafts)
//    • Search by title/excerpt
//    • Tag filter (live dropdown of tags in use)
//    • Status filter (all / published / draft)
//    • Pagination
//    • Quick publish/unpublish toggle
//    • Navigate to editor for create/edit
// ============================================================

import { useState, useCallback } from "react";
import {
  Box, Card, CardContent, Typography, Button, TextField,
  Stack, Chip, IconButton, Tooltip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Switch, CircularProgress, Alert, InputAdornment,
  Select, MenuItem, FormControl, InputLabel, Avatar, alpha, useTheme,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import {
  Add, Edit, Delete, Search, FilterList, Article, Image,
  PublishedWithChanges, Drafts, PostAdd,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { blogService, BlogPostListSummary } from "../../services/cms.service";
import { apiErrorMessage } from "../../utils/apiError";

export default function BlogListPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [publishedFilter, setPublishedFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<BlogPostListSummary | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["blog-posts", page, rowsPerPage, search, tagFilter, publishedFilter],
    queryFn: () =>
      blogService.listPosts({
        page: page + 1,
        per_page: rowsPerPage,
        search: search || undefined,
        tag: tagFilter || undefined,
        status: publishedFilter as "all" | "published" | "draft",
      }),
    placeholderData: keepPreviousData,
  });

  // Tag list for the filter dropdown
  const { data: allTags = [] } = useQuery({
    queryKey: ["blog-tags"],
    queryFn: blogService.listTags,
  });

  // Lightweight counts for the KPI cards (per_page=1 keeps them cheap)
  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ["blog-counts"],
    queryFn: async () => {
      const [all, published, drafts] = await Promise.all([
        blogService.listPosts({ per_page: 1, status: "all" }),
        blogService.listPosts({ per_page: 1, status: "published" }),
        blogService.listPosts({ per_page: 1, status: "draft" }),
      ]);
      return {
        total: all.total,
        published: published.total,
        drafts: drafts.total,
      };
    },
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => blogService.deletePost(id),
    onSuccess: () => {
      enqueueSnackbar("Post deleted", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["blog-posts"] });
      qc.invalidateQueries({ queryKey: ["blog-counts"] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      enqueueSnackbar(apiErrorMessage(err, "Failed to delete"), { variant: "error" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: number) => blogService.togglePublish(id),
    onSuccess: () => {
      enqueueSnackbar("Publish status updated", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["blog-posts"] });
      qc.invalidateQueries({ queryKey: ["blog-counts"] });
    },
    onError: (err) => {
      enqueueSnackbar(apiErrorMessage(err, "Failed to toggle publish"), { variant: "error" });
    },
  });

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
      setPage(0);
    },
    []
  );

  const posts = data?.data ?? [];
  const total = data?.total ?? 0;

  const kpiCards = [
    {
      label: "Total Posts",
      value: counts?.total,
      icon: <PostAdd />,
      color: theme.palette.primary.main,
    },
    {
      label: "Published",
      value: counts?.published,
      icon: <PublishedWithChanges />,
      color: theme.palette.success.main,
    },
    {
      label: "Drafts",
      value: counts?.drafts,
      icon: <Drafts />,
      color: theme.palette.warning.main,
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Blog Posts
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Create, edit and publish stories for the WayTero travel blog.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate("/cms/blog/new")}
          sx={{ alignSelf: { xs: "stretch", sm: "auto" } }}
        >
          New Post
        </Button>
      </Stack>

      {/* KPI cards */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        {kpiCards.map((kpi) => (
          <Card key={kpi.label} sx={{ flex: 1 }}>
            <CardContent sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 2 }}>
              <Avatar
                sx={{
                  bgcolor: alpha(kpi.color, 0.12),
                  color: kpi.color,
                  width: 48,
                  height: 48,
                }}
              >
                {kpi.icon}
              </Avatar>
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={600}
                  sx={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
                >
                  {kpi.label}
                </Typography>
                <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                  {countsLoading ? (
                    <CircularProgress size={18} sx={{ color: kpi.color }} />
                  ) : (
                    kpi.value ?? "—"
                  )}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <TextField
              size="small"
              placeholder="Search title or excerpt..."
              value={search}
              onChange={handleSearch}
              sx={{ minWidth: 280 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Tag</InputLabel>
              <Select
                value={tagFilter}
                label="Tag"
                onChange={(e) => {
                  setTagFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">All tags</MenuItem>
                {allTags.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={publishedFilter}
                label="Status"
                onChange={(e) => {
                  setPublishedFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="published">Published</MenuItem>
                <MenuItem value="draft">Drafts</MenuItem>
              </Select>
            </FormControl>
            {(search || tagFilter || publishedFilter !== "all") && (
              <Button
                size="small"
                startIcon={<FilterList />}
                onClick={() => {
                  setSearch("");
                  setTagFilter("");
                  setPublishedFilter("all");
                  setPage(0);
                }}
              >
                Clear
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : isError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            Failed to load blog posts. Please try again.
          </Alert>
        ) : posts.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Article sx={{ fontSize: 56, color: "text.disabled", mb: 2 }} />
            <Typography variant="h6" fontWeight={600}>
              {search || tagFilter || publishedFilter !== "all"
                ? "No posts match your filters"
                : "No blog posts yet"}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {search || tagFilter || publishedFilter !== "all"
                ? "Try adjusting your search or filters."
                : "Create your first story for the WayTero travel blog."}
            </Typography>
            {!(search || tagFilter || publishedFilter !== "all") && (
              <Button variant="contained" startIcon={<Add />} onClick={() => navigate("/cms/blog/new")}>
                Create your first post
              </Button>
            )}
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Title</TableCell>
                    <TableCell>Author</TableCell>
                    <TableCell>Tags</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell>Published</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {posts.map((post) => (
                    <TableRow
                      key={post.id}
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() => navigate(`/cms/blog/${post.id}`)}
                    >
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          {post.featured_image_url ? (
                            <Box
                              component="img"
                              src={post.featured_image_url}
                              alt=""
                              sx={{
                                width: 56,
                                height: 38,
                                borderRadius: 1.5,
                                objectFit: "cover",
                                bgcolor: "action.hover",
                                boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.12)}`,
                              }}
                            />
                          ) : (
                            <Box
                              sx={{
                                width: 56,
                                height: 38,
                                borderRadius: 1.5,
                                bgcolor: "action.hover",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Image fontSize="small" color="disabled" />
                            </Box>
                          )}
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 320 }}>
                              {post.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              /{post.slug}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {post.author_avatar_url ? (
                            <Avatar src={post.author_avatar_url} sx={{ width: 28, height: 28 }} />
                          ) : (
                            <Avatar sx={{ width: 28, height: 28, bgcolor: "primary.main", fontSize: 13 }}>
                              {(post.author_name?.[0] ?? "W").toUpperCase()}
                            </Avatar>
                          )}
                          <Typography variant="body2">{post.author_name || "—"}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ maxWidth: 220 }}>
                          {post.tags.slice(0, 3).map((t) => (
                            <Chip key={t} label={t} size="small" variant="outlined" />
                          ))}
                          {post.tags.length > 3 && (
                            <Chip label={`+${post.tags.length - 3}`} size="small" />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="center">
                        <Switch
                          checked={post.is_published}
                          onChange={(e) => {
                            e.stopPropagation();
                            publishMutation.mutate(post.id);
                          }}
                          size="small"
                          color="primary"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {post.published_at
                            ? new Date(post.published_at).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/cms/blog/${post.id}`);
                              }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(post);
                              }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
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
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 20, 50]}
            />
          </>
        )}
      </Card>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle>Delete Post?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deleteTarget?.title}</strong>?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}