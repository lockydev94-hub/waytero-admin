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

export interface MediaLibraryItem {
  public_id: string;
  secure_url: string;
  width: number | null;
  height: number | null;
  format: string;
  folder: string;
  bytes: number | null;
  created_at: string | null;
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
}

export const mediaService = {
  /** Browse existing Cloudinary images (media library / gallery). */
  listMedia: (params: ListMediaParams = {}): Promise<MediaLibraryResult> =>
    apiClient
      .get<MediaLibraryResult>("/admin/settings/media-library", {
        params: {
          folder: params.folder || undefined,
          query: params.query || undefined,
          next_cursor: params.nextCursor || undefined,
          page_size: params.pageSize ?? 30,
        },
      })
      .then((r) => r.data),

  /** Destroy a single Cloudinary asset. Returns deleted public_ids. */
  deleteMedia: (publicId: string): Promise<{ public_id: string; deleted: string[] }> =>
    apiClient
      .delete<{ public_id: string; deleted: string[] }>(
        `/admin/settings/media-library/${encodeURIComponent(publicId)}`
      )
      .then((r) => r.data),
};