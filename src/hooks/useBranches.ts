// ============================================================
// WAYTERO ADMIN PORTAL — BRANCH LIST HOOK
// One TanStack Query entry for the office register, shared by the
// topbar chip, the super admin's switcher, the branch column on
// lists and the Branches page.
//
// The register changes rarely and only through this portal, so it is
// cached long and refetched when a mutation invalidates it — not on
// every page change.
// ============================================================
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { branchService, type Branch } from "../services/branch.service";
import { CACHE_TTL } from "../constants";

export interface UseBranchesResult {
  branches: Branch[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useBranches(): UseBranchesResult {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-branches"],
    queryFn: () => branchService.list(),
    staleTime: CACHE_TTL.LONG,
  });

  return { branches: data ?? [], isLoading, isError, refetch: () => void refetch() };
}

/**
 * Which office serves a city. One branch per city is a database constraint, so
 * a row's city is enough to name the office that works it — the branch column
 * on a list needs no extra field from the query above.
 *
 * Rows in a city with no office are the super admin's to notice, so the map
 * simply has no entry for them and the caller labels that case.
 */
export function useOfficeByCity(): Map<number, Branch> {
  const { branches } = useBranches();
  return useMemo(() => new Map(branches.map((b) => [b.city_id, b])), [branches]);
}

export default useBranches;
