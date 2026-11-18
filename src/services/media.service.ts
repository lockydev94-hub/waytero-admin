// ============================================================
// WAYTERO ADMIN — MEDIA LIBRARY SERVICE
// Doc Ref: Backend /admin/settings/media-library (Cloudinary Admin API)
//
//  Browse & delete assets already stored in Cloudinary so the admin
//  portal can offer a "pick from gallery" picker instead of only
//  fresh uploads.
//
//    GET    /admin/settings/media-library            — list w/ folder+search+pagination
//    DELETE /admin/settings/media-library/{public_id} — destroy an asset
// ============================================================
import apiClient from "./api";

export type MediaResourceType = "image" | "raw";

export interface MediaLibraryItem {
  public_id: string;
  secure_url: string;
  width: number | null;
  height: number | null;
  format: string;
  folder: string;
  bytes: number | null;
  created_at: string | null;
  /** Cloudinary resource type — PDFs live under "raw". Needed for delete. */
  resource_type?: MediaResourceType;
}

export interface MediaLibraryResult {
  items: MediaLibraryItem[];
  next_cursor: string;
  total_count: number;
}

export interface ListMediaParams {
  /** Optional Cloudinary folder prefix, e.g. "waytero/cms" or "waytero". */
  folder?: string;
  /** Free-text filter on public_id / filename. */
  query?: string;
  /** Pagination cursor from a previous page. */
  nextCursor?: string;
  /** Number of results per page (1–100, default 30). */
  pageSize?: number;
  /**
   * Which Cloudinary resource types to browse. Defaults to images only.
   * Document pickers pass ["image", "raw"] because a scanned KYC document is
   * stored as an image while a PDF is stored as raw — one gallery, both.
   */
  resourceTypes?: MediaResourceType[];
}

export const mediaService = {
  /** Browse existing Cloudinary assets (media library / gallery). */
  listMedia: async (params: ListMediaParams = {}): Promise<MediaLibraryResult> => {
    const types = params.resourceTypes?.length ? params.resourceTypes : ["image" as const];

    const fetchType = (type: MediaResourceType) =>
      apiClient
        .get<MediaLibraryResult>("/admin/settings/media-library", {
          params: {
            folder: params.folder || undefined,
            query: params.query || undefined,
            next_cursor: params.nextCursor || undefined,
            page_size: params.pageSize ?? 30,
            resource_type: type,
          },
        })
        .then((r) => r.data);

    if (types.length === 1) return fetchType(types[0]);

    const pages = await Promise.all(types.map(fetchType));
    const seen = new Set<string>();
    const items = pages
      .flatMap((p) => p.items)
      .filter((i) => !seen.has(i.public_id) && seen.add(i.public_id))
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

    // A cursor belongs to one resource type, so a merged listing is a single
    // page of each. Document pickers page in 30s per type, which is plenty;
    // "Load more" would otherwise silently skip the other type.
    return { items, next_cursor: "", total_count: items.length };
  },

  /** Destroy a single Cloudinary asset. Returns deleted public_ids. */
  deleteMedia: (
    publicId: string,
    resourceType: MediaResourceType = "image"
  ): Promise<{ public_id: string; deleted: string[] }> =>
    apiClient
      .delete<{ public_id: string; deleted: string[] }>(
        `/admin/settings/media-library/${encodeURIComponent(publicId)}`,
        { params: { resource_type: resourceType } }
      )
      .then((r) => r.data),
};