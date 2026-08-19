// ============================================================
// WAYTERO ADMIN — ONBOARDING DOCS SERVICE
// Base URL: /admin/onboarding-docs
// All endpoints match Backend onboarding_docs_api.py
//
// Downloads partner onboarding guides + hand-fillable registration
// forms as print-quality PDFs (invoice-style platform header).
// ============================================================
import apiClient from "./api";

export type OnboardingDocType = "partner" | "driver" | "vehicle";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Guides ───────────────────────────────────────────────────

// Download the "what to prepare" guide for a step (partner/driver/vehicle).
// PDF is generated on the backend with the platform header, so the
// filename is resolved from the response's Content-Disposition.
export async function downloadOnboardingGuide(docType: OnboardingDocType): Promise<void> {
  const res = await apiClient.get(`/admin/onboarding-docs/guide/${docType}`, {
    responseType: "blob",
  });
  const filename = contentTypeFilename(res.headers["content-disposition"]) ?? `WayTero_${docType}_Guide.pdf`;
  triggerDownload(res.data as Blob, filename);
}

// ── Forms ────────────────────────────────────────────────────

// Download a hand-fillable registration form (partner/vehicle/driver).
export async function downloadOnboardingForm(formType: OnboardingDocType): Promise<void> {
  const res = await apiClient.get(`/admin/onboarding-docs/form/${formType}`, {
    responseType: "blob",
  });
  const filename = contentTypeFilename(res.headers["content-disposition"]) ?? `WayTero_${formType}_Form.pdf`;
  triggerDownload(res.data as Blob, filename);
}

// ── Helper ───────────────────────────────────────────────────

function contentTypeFilename(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = /filename="?([^";]+)"?/.exec(header);
  return match?.[1];
}