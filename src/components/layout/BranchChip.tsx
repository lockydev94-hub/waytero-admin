// ============================================================
// WAYTERO ADMIN — BRANCH CHIP / SWITCHER
// The office the numbers on screen belong to.
//
// A branch account sees its own office as a static chip — that is not a
// choice it gets to make, and the server decides the same thing from the
// user row on every request. A super admin gets a switcher instead: All
// branches, or one office narrowed down. Picking one changes the X-Branch-Id
// header the axios interceptor attaches, and invalidates every cached query,
// because two branch views differ only by that header and a stale page from
// the other office must not be served.
// ============================================================
import { useEffect } from "react";
import { Chip, MenuItem, Select, Tooltip } from "@mui/material";
import { Storefront } from "@mui/icons-material";
import { useAuthStore } from "../../stores/authStore";
import { useBranchFilterStore } from "../../stores/branchFilterStore";
import { useBranches } from "../../hooks/useBranches";
import { queryClient } from "../../app/queryClient";

const ALL = "all";

export function BranchChip() {
  const user = useAuthStore((s) => s.user);
  const branch = user?.branch ?? null;
  const isSuper = user?.user_type === "SUPER_ADMIN";
  const { branches } = useBranches();
  const selectedId = useBranchFilterStore((s) => s.branchId);
  const setBranchId = useBranchFilterStore((s) => s.setBranchId);

  // Only an open office can be looked at: the server refuses a closed one, so
  // offering it would be a chip that 403s every list page it touches.
  const openBranches = branches.filter((b) => b.is_active);

  // Closing or deleting the office currently selected would otherwise leave
  // the whole portal filtered to a branch nobody can open.
  useEffect(() => {
    if (selectedId === null || branches.length === 0) return;
    if (!branches.some((b) => b.id === selectedId && b.is_active)) setBranchId(null);
  }, [branches]);

  if (!isSuper) {
    if (!branch) return null;
    return (
      <Tooltip
        title={
          branch.is_headquarters
            ? "Your office is the head office, so work that no one has assigned a city to yet is yours too."
            : `Your account works from ${branch.name}, and only its rows are shown to you.`
        }
      >
        <Chip
          size="small"
          variant="outlined"
          icon={<Storefront />}
          label={branch.is_headquarters ? `${branch.name} · HQ` : branch.name}
          sx={{ display: { xs: "none", sm: "flex" } }}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title="Look at one office at a time. The branch column on lists says which office a row belongs to.">
      <Select
        size="small"
        value={openBranches.some((b) => b.id === selectedId) ? selectedId! : ALL}
        onChange={(e) => {
          const value = e.target.value;
          setBranchId(value === ALL ? null : Number(value));
          queryClient.invalidateQueries();
        }}
        displayEmpty
        sx={{
          minWidth: 158,
          maxWidth: 220,
          fontSize: 13,
          "& .MuiSelect-select": { py: 0.75, pl: 1.25, display: "flex", alignItems: "center", gap: 0.75 },
        }}
      >
        <MenuItem value={ALL}>
          <Storefront fontSize="small" sx={{ mr: 1 }} /> All branches
        </MenuItem>
        {openBranches.map((b) => (
          <MenuItem key={b.id} value={b.id}>
            {b.name}
            {b.is_headquarters ? " · HQ" : ""}
            {b.city_name ? ` — ${b.city_name}` : ""}
          </MenuItem>
        ))}
      </Select>
    </Tooltip>
  );
}

export default BranchChip;
