// ============================================================
// WAYTERO ADMIN PORTAL — GST FEATURE FLAG
// Hook: useGstEnabled
//
// Single source of truth for the platform-level "GST is enabled"
// signal in the admin portal. Reads GST_ENABLED from the existing
// GET /admin/settings/configurations payload and shares the result
// across the sidebar, the Tax & GST page, and the Reports GST/TDS
// tabs via one TanStack Query cache entry.
//
// Default-deny: if the query errors, is loading, or the backend
// reports GST_ENABLED=false, the hook returns false. A broken
// backend should not accidentally expose tax pages/features.
// ============================================================
import { useQuery } from "@tanstack/react-query";
import { settingsService } from "../services/settings.service";

export interface UseGstEnabledResult {
  isGstEnabled: boolean;
  isLoading: boolean;
}

const STALE_TIME_MS = 5 * 60 * 1000;

export function useGstEnabled(): UseGstEnabledResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-gst-enabled"],
    queryFn: () => settingsService.getConfigurations(),
    staleTime: STALE_TIME_MS,
    refetchOnMount: "always",
  });

  const config = (data ?? []).find((c) => c.config_key === "GST_ENABLED");
  const isGstEnabled = !isError && (config?.config_value ?? "false").toLowerCase() === "true";

  return { isGstEnabled, isLoading };
}
