// ============================================================
// WAYTERO ADMIN — FAVICON BOOTSTRAP
// Loads the admin-uploaded favicon (Settings → Platform Profile)
// from the backend and swaps the browser tab icon. Falls back to
// the bundled /favicon.svg when nothing is configured or the API
// is unreachable. Idempotent — safe to call once at startup.
// ============================================================
import { API_BASE_URL } from "../constants";

const FALLBACK_ICON = "/favicon.svg";
const CACHE_KEY = "waytero_favicon_url";

function setIcon(href: string): void {
  const base = API_BASE_URL.startsWith("http")
    ? new URL(API_BASE_URL).origin
    : window.location.origin;
  const absolute = href.startsWith("http") ? href : `${base}${href}`;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = absolute;
  // Apple touch icon (device homescreens)
  let apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (!apple) {
    apple = document.createElement("link");
    apple.rel = "apple-touch-icon";
    document.head.appendChild(apple);
  }
  apple.href = absolute;
}

export async function bootstrapFavicon(): Promise<void> {
  // Instant fallback so the tab never shows the default globe.
  setIcon(FALLBACK_ICON);

  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    setIcon(cached);
  }

  try {
    const res = await fetch(`${API_BASE_URL}/public/platform-profile`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`platform-profile ${res.status}`);
    const json = (await res.json()) as {
      data?: { favicon_url?: string };
      favicon_url?: string;
    };
    const faviconUrl = json.data?.favicon_url ?? json.favicon_url ?? "";
    if (faviconUrl) {
      setIcon(faviconUrl);
      try {
        localStorage.setItem(CACHE_KEY, faviconUrl);
      } catch {
        /* storage full / private mode — ignore */
      }
    }
  } catch {
    // Unreachable API — keep the bundled fallback (or cached value).
  }
}
