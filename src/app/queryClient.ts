// ============================================================
// WAYTERO ADMIN PORTAL — QUERY CLIENT
// The TanStack Query cache, in its own module so anything can reach it
// without importing App.tsx (which would close a cycle back through the
// router and the topbar).
//
// The branch switcher invalidates every query when the super admin picks a
// different office: the lists differ only by the X-Branch-Id header, so a
// cached "All branches" page must not be served after the choice changes.
// ============================================================
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

export default queryClient;
