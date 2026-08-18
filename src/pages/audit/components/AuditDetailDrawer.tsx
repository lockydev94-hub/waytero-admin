// ============================================================
// WAYTERO ADMIN — AUDIT DETAIL DRAWER
// Right-side drawer showing one audit event's full record with
// Overview / Changes tabs.
// Doc Ref: Admin API §24
// ============================================================

import {
  Box,
  Chip,
  Drawer,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Typography,
  Paper,
  Divider,
} from "@mui/material";
import { Close } from "@mui/icons-material";
import { useMemo, useState } from "react";
import type { AuditLog } from "../../../services/admin.service";

interface AuditDetailDrawerProps {
  log: AuditLog | null;
  open: boolean;
  onClose: () => void;
}

function MetaRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <Stack direction="row" alignItems="flex-start" gap={2} sx={{ py: 1 }}>
      <Typography variant="caption" sx={{ color: "text.secondary", width: 110, flexShrink: 0, pt: 0.5 }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontFamily: mono ? "monospace" : undefined,
          wordBreak: "break-all",
          flex: 1,
        }}
      >
        {value || <span style={{ color: "var(--mui-palette-text-disabled, #94a3b8)" }}>—</span>}
      </Typography>
    </Stack>
  );
}

interface DiffEntry {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  changed: boolean;
}

function buildDiff(log: AuditLog | null): DiffEntry[] {
  if (!log) return [];
  const oldVals = (log.old_values as Record<string, unknown>) ?? {};
  const newVals = (log.new_values as Record<string, unknown>) ?? {};
  const keys = new Set([...Object.keys(oldVals), ...Object.keys(newVals)]);
  const out: DiffEntry[] = [];
  keys.forEach((k) => {
    const ov = oldVals[k];
    const nv = newVals[k];
    out.push({
      key: k,
      oldValue: ov,
      newValue: nv,
      changed: JSON.stringify(ov) !== JSON.stringify(nv),
    });
  });
  // Unchanged rows go to the bottom so the operator's eye lands on the
  // changes first.
  return out.sort((a, b) => Number(b.changed) - Number(a.changed));
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  if (typeof v === "string" && v.length > 200) return v.slice(0, 200) + "…";
  return String(v);
}

export default function AuditDetailDrawer({ log, open, onClose }: AuditDetailDrawerProps) {
  const [tab, setTab] = useState(0);
  const diff = useMemo(() => buildDiff(log), [log]);

  if (!log) return null;

  const changedCount = diff.filter((d) => d.changed).length;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: "100%", sm: 560 }, display: "flex", flexDirection: "column" },
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                background: "linear-gradient(135deg, #667eea, #764ba2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontFamily: "monospace",
                fontSize: "0.85rem",
              }}
            >
              #{log.id}
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                Audit Event
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(log.created_at).toLocaleString()}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} size="small">
            <Close fontSize="small" />
          </IconButton>
        </Stack>

        <Stack direction="row" gap={1} flexWrap="wrap">
          <Chip label={log.module_name} size="small" color="primary" variant="outlined" />
          <Chip
            label={log.action_type}
            size="small"
            sx={{
              fontFamily: "monospace",
              fontWeight: 600,
              bgcolor: "rgba(102,126,234,0.1)",
              color: "primary.main",
            }}
          />
          {log.entity_name && (
            <Chip
              label={`${log.entity_name}${log.entity_id !== null ? ` #${log.entity_id}` : ""}`}
              size="small"
              variant="outlined"
            />
          )}
          {changedCount > 0 && (
            <Chip
              label={`${changedCount} changed`}
              size="small"
              sx={{ bgcolor: "rgba(245,158,11,0.12)", color: "warning.dark", fontWeight: 700 }}
            />
          )}
        </Stack>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          px: 2,
          "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.85rem" },
        }}
      >
        <Tab label="Overview" />
        <Tab label={`Changes${changedCount > 0 ? ` (${changedCount})` : ""}`} />
      </Tabs>

      {/* Body */}
      <Box sx={{ flex: 1, overflow: "auto", p: 2.5 }}>
        {tab === 0 && (
          <Stack gap={1}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: "text.secondary", fontSize: "0.7rem", letterSpacing: 1, textTransform: "uppercase" }}>
                Event
              </Typography>
              <MetaRow label="Module" value={log.module_name} />
              <Divider sx={{ my: 0.5 }} />
              <MetaRow label="Action" value={log.action_type} mono />
              <Divider sx={{ my: 0.5 }} />
              <MetaRow
                label="Entity"
                value={
                  log.entity_name
                    ? `${log.entity_name}${log.entity_id !== null ? ` #${log.entity_id}` : ""}`
                    : null
                }
              />
              <Divider sx={{ my: 0.5 }} />
              <MetaRow label="Timestamp" value={new Date(log.created_at).toLocaleString()} />
              <Divider sx={{ my: 0.5 }} />
              <MetaRow
                label="User ID"
                value={log.user_id !== null ? String(log.user_id) : null}
                mono
              />
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: "text.secondary", fontSize: "0.7rem", letterSpacing: 1, textTransform: "uppercase" }}>
                Request Context
              </Typography>
              <MetaRow label="IP Address" value={log.ip_address} mono />
              <Divider sx={{ my: 0.5 }} />
              <MetaRow label="User Agent" value={log.user_agent} mono />
              <Divider sx={{ my: 0.5 }} />
              <MetaRow label="Request ID" value={log.request_id} mono />
            </Paper>

            {log.new_values && Object.keys(log.new_values).length > 0 && (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: "text.secondary", fontSize: "0.7rem", letterSpacing: 1, textTransform: "uppercase" }}>
                  New Values
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    color: "success.dark",
                  }}
                >
                  {JSON.stringify(log.new_values, null, 2)}
                </Box>
              </Paper>
            )}

            {log.old_values && Object.keys(log.old_values).length > 0 && (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: "text.secondary", fontSize: "0.7rem", letterSpacing: 1, textTransform: "uppercase" }}>
                  Old Values
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    color: "error.dark",
                  }}
                >
                  {JSON.stringify(log.old_values, null, 2)}
                </Box>
              </Paper>
            )}
          </Stack>
        )}

        {tab === 1 && (
          <Stack gap={1.5}>
            {diff.length === 0 ? (
              <Paper variant="outlined" sx={{ p: 4, textAlign: "center", borderRadius: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  No field-level changes were captured for this event.
                </Typography>
              </Paper>
            ) : (
              diff.map(({ key, oldValue, newValue, changed }) => (
                <Paper
                  key={key}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    borderColor: changed ? "warning.light" : "divider",
                    bgcolor: changed ? "rgba(245,158,11,0.04)" : "transparent",
                  }}
                >
                  <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.75 }}>
                    <Typography variant="caption" fontWeight={700} fontFamily="monospace" sx={{ flex: 1 }}>
                      {key}
                    </Typography>
                    {changed ? (
                      <Chip label="CHANGED" size="small" color="warning" sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }} />
                    ) : (
                      <Chip label="UNCHANGED" size="small" variant="outlined" sx={{ height: 18, fontSize: "0.65rem" }} />
                    )}
                  </Stack>
                  <Stack direction={{ xs: "column", sm: "row" }} gap={1.5}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" sx={{ color: "error.main", fontWeight: 700, fontSize: "0.65rem", letterSpacing: 1, textTransform: "uppercase" }}>
                        OLD
                      </Typography>
                      <Box
                        component="pre"
                        sx={{
                          m: 0,
                          mt: 0.5,
                          p: 1,
                          fontSize: "0.7rem",
                          fontFamily: "monospace",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          bgcolor: "rgba(239,68,68,0.06)",
                          borderRadius: 1,
                          color: "error.dark",
                          minHeight: 28,
                        }}
                      >
                        {renderValue(oldValue)}
                      </Box>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" sx={{ color: "success.main", fontWeight: 700, fontSize: "0.65rem", letterSpacing: 1, textTransform: "uppercase" }}>
                        NEW
                      </Typography>
                      <Box
                        component="pre"
                        sx={{
                          m: 0,
                          mt: 0.5,
                          p: 1,
                          fontSize: "0.7rem",
                          fontFamily: "monospace",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          bgcolor: "rgba(34,197,94,0.06)",
                          borderRadius: 1,
                          color: "success.dark",
                          minHeight: 28,
                        }}
                      >
                        {renderValue(newValue)}
                      </Box>
                    </Box>
                  </Stack>
                </Paper>
              ))
            )}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}
