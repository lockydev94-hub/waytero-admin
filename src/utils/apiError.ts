// ============================================================
// WAYTERO ADMIN — API ERROR MESSAGE EXTRACTOR
// Doc Ref: Backend app/main.py exception handlers
//
// The backend speaks two error dialects and neither of them is `detail`:
//
//   WayTeroException  → {success:false, message, code, errors}
//   FastAPI validation→ {detail: [{loc, msg, type}, ...]}   (HTTP 422)
//
// Reading `data.detail` alone therefore renders "[object Object]" for a 422
// and silently falls through to a generic string for every business error —
// which is how a wrong-field 422 ends up on screen as "Save failed".
// ============================================================

interface ValidationItem {
  loc?: (string | number)[];
  msg?: string;
}

/** Turn one FastAPI validation item into "field: message". */
function formatValidationItem(item: ValidationItem): string {
  const path = (item.loc ?? [])
    .filter((p) => p !== "body" && p !== "query" && p !== "path")
    .join(".");
  const msg = item.msg ?? "is invalid";
  return path ? `${path}: ${msg}` : msg;
}

/**
 * Best-effort human-readable message from an axios error.
 * Falls back to `fallback` only when the response carries nothing usable.
 */
export function apiErrorMessage(error: any, fallback = "Something went wrong"): string {
  const data = error?.response?.data;
  if (!data) return error?.message || fallback;

  // WayTeroException envelope — the common case for business rule failures.
  if (typeof data.message === "string" && data.message.trim()) return data.message;

  const detail = data.detail;
  if (typeof detail === "string" && detail.trim()) return detail;

  // FastAPI 422 — an array of per-field validation items.
  if (Array.isArray(detail) && detail.length) {
    return detail.map(formatValidationItem).join("; ");
  }

  return fallback;
}

export default apiErrorMessage;
