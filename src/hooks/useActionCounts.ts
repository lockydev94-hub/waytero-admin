// ============================================================
// WAYTERO ADMIN — USE ACTION COUNTS
// Polls the sidebar badges once a minute. Stops while the portal is locked:
// the counts are operational data, and reading them behind a lock screen would
// be a hole in the freeze that /auth/admin/* is designed to close.
// ============================================================
import { useQuery } from "@tanstack/react-query";
import { actionCountsService, type ActionCounts } from "../services/actionCounts.service";
import { useAuthStore } from "../stores/authStore";
import { useLockStore } from "../stores/lockStore";

export function useActionCounts(): ActionCounts {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLocked = useLockStore((s) => s.isLocked);

  const { data } = useQuery({
    queryKey: ["admin", "action-counts"],
    queryFn: actionCountsService.get,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    enabled: isAuthenticated && !isLocked,
  });

  return data ?? {};
}
