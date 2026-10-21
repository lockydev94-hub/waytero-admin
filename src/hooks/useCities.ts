// ============================================================
// WAYTERO ADMIN PORTAL — CITY MASTER DATA HOOK
// The active cities, in one query entry shared by every screen that
// has to name a city (the branch register first among them).
//
// Screens written before this existed each fetched
// /admin/settings/master/cities themselves; those stay where they
// are until a screen is touched for another reason.
// ============================================================
import { useQuery } from "@tanstack/react-query";
import apiClient from "../services/api";
import type { City } from "../services/settings.service";
import { CACHE_TTL } from "../constants";

export interface UseCitiesResult {
  cities: City[];
  isLoading: boolean;
  isError: boolean;
}

export function useCities(options?: { enabled?: boolean }): UseCitiesResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-cities-active"],
    // Called on the client rather than through settingsService, whose master
    // data methods are Object.assign'd onto the export and therefore invisible
    // to TypeScript — every existing caller needs an `as any` for them.
    queryFn: () =>
      apiClient
        .get<City[]>("/admin/settings/master/cities", { params: { active_only: true } })
        .then((r) => r.data),
    staleTime: CACHE_TTL.LONG,
    enabled: options?.enabled ?? true,
  });

  return { cities: data ?? [], isLoading, isError };
}

export default useCities;
