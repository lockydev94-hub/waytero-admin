// ============================================================
// WAYTERO ADMIN — WEBSITE PAGES LIST
// Doc Ref: Round 6 · Website → Pages
//  Route: /cms/pages
//
//  The prose pages of the public site in one queue. What matters at this level
//  is only "is a reader seeing copy someone wrote here, or the text shipped
//  with the website" — so the status column says exactly that, per page, and
//  the counts tell you which ones have never been opened.
// ============================================================

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import { Article, CheckCircle, Edit, Public, Warning } from "@mui/icons-material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { SITE_URL } from "../../constants";
import { pagesService, STATE_HINT, STATE_LABEL, type PageContentState, type PageListRow } from "../../services/pages.service";
import { apiErrorMessage } from "../../utils/apiError";

const STATE_COLOR: Record<PageContentState, "success" | "warning" | "error" | "default"> = {
  live: "success",
  "built-in": "default",
  unpublished: "warning",
  empty: "warning",
  corrupt: "error",
};

const KIND_LABEL: Record<PageListRow["kind"], string> = {
  policy: "Policy",
  guide: "Guide",
  trust: "Trust",
  company: "Company",
};

function Kpi({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Card sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
      <CardContent sx={{ p: 2.25 }}>
        <Box sx={{ p: 1.1, borderRadius: 2, bgcolor: alpha(color, 0.1), color, width: "fit-content", mb: 1.25 }}>{icon}</Box>
        <Typography variant="h4" fontWeight={800} sx={{ color, lineHeight: 1 }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function WebsitePagesListPage() {
  const navigate = useNavigate();
  const theme = useTheme();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["website-pages"],
    queryFn: () => pagesService.listPages(),
  });

  const rows = data ?? [];
  const live = rows.filter((r) => r.state === "live").length;
  const attention = rows.filter((r) => r.state === "unpublished" || r.state === "empty" || r.state === "corrupt").length;
  const builtIn = rows.filter((r) => r.state === "built-in").length;

  const openOnSite = (path: string) => window.open(`${SITE_URL}${path}`, "_blank", "noopener,noreferrer");

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
            Website Pages
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The text of the policy, trust and company pages. Everything here is readable by a
            customer without a code change.
          </Typography>
        </Box>
        <Link
          component={RouterLink}
          to="/cms/landing-pages"
          underline="hover"
          variant="body2"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
        >
          <Public fontSize="small" /> Marketing landing pages live here
        </Link>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        <Box sx={{ flex: 1 }}>
          <Kpi label="Serving edited copy" value={live} icon={<CheckCircle fontSize="small" />} color={theme.palette.success.main} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Kpi label="Built-in copy (never edited)" value={builtIn} icon={<Article fontSize="small" />} color={theme.palette.info.main} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Kpi label="Needs attention" value={attention} icon={<Warning fontSize="small" />} color={theme.palette.warning.main} />
        </Box>
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        Refund <strong>percentages</strong> are edited in Cancellation Policy, not here — this page
        only writes the sentences around them. Homepage bands belong to Website CMS, and blog posts
        to Blog. A save here reaches readers within about five minutes; the website caches page text
        and there is no instant purge.
      </Alert>

      <Card sx={{ p: { xs: 2, sm: 3 } }}>
        {isLoading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress />
          </Stack>
        ) : isError ? (
          <Alert severity="error">{apiErrorMessage(error, "Could not load the page list.")}</Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Page</TableCell>
                  <TableCell>Group</TableCell>
                  <TableCell>What the site serves</TableCell>
                  <TableCell align="right">Sections</TableCell>
                  <TableCell>Last saved</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.slug} hover onClick={() => navigate(`/cms/pages/${row.slug}`)} sx={{ cursor: "pointer" }}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {row.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.path}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={KIND_LABEL[row.kind]} />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={STATE_HINT[row.state]}>
                        <span>
                          <Chip size="small" color={STATE_COLOR[row.state]} label={STATE_LABEL[row.state]} />
                        </span>
                      </Tooltip>
                      {row.dataSource && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                          numbers come from {row.dataSource}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {row.sectionCount}
                      {row.hasFaq ? (
                        <Typography variant="caption" color="text.secondary" component="span">
                          {" "}
                          · {row.faqCount} FAQ
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {row.configUpdatedAt ? new Date(row.configUpdatedAt).toLocaleString() : "never"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title={row.state === "live" ? `Open ${row.path}` : "Opens the built-in copy — this page has no live body"}>
                          <span>
                            <Button
                              size="small"
                              startIcon={<Public />}
                              onClick={(e) => {
                                e.stopPropagation();
                                openOnSite(row.path);
                              }}
                            >
                              View
                            </Button>
                          </span>
                        </Tooltip>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Edit />}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/cms/pages/${row.slug}`);
                          }}
                        >
                          Edit
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </Box>
  );
}
