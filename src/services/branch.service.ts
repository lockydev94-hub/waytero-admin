// ============================================================
// WAYTERO ADMIN — BRANCH (OFFICE) SERVICE
// Base URL: /admin/branches  → Backend app/modules/admin/branch_api.py
//
// One branch is one city's office. Reading the register is open to every staff
// role (a branch account needs its own name for the topbar, a super admin needs
// all of them for the switcher and the branch column); writing it is super
// admin only, because whoever can create an office can move their own account
// into it and make every scoping rule a rule about a row they authored.
// ============================================================
import apiClient from "./api";

/** Mirrors backend BranchOut */
export interface Branch {
  id: number;
  name: string;
  code: string;
  city_id: number;
  address: string | null;
  is_headquarters: boolean;
  is_active: boolean;
  city_name: string | null;
  state_name: string | null;
}

export interface BranchCreatePayload {
  name: string;
  code: string;
  city_id: number;
  address?: string | null;
  is_headquarters?: boolean;
  is_active?: boolean;
}

/** Partial update — a field left out of the body stays exactly as it is. */
export type BranchUpdatePayload = Partial<Omit<BranchCreatePayload, "name">> & {
  name?: string;
};

export const branchService = {
  list: (): Promise<Branch[]> =>
    apiClient.get<Branch[]>("/admin/branches").then((r) => r.data),

  get: (id: number): Promise<Branch> =>
    apiClient.get<Branch>(`/admin/branches/${id}`).then((r) => r.data),

  create: (payload: BranchCreatePayload): Promise<Branch> =>
    apiClient.post<Branch>("/admin/branches", payload).then((r) => r.data),

  update: (id: number, payload: BranchUpdatePayload): Promise<Branch> =>
    apiClient.patch<Branch>(`/admin/branches/${id}`, payload).then((r) => r.data),

  delete: (id: number): Promise<Branch> =>
    apiClient.delete<Branch>(`/admin/branches/${id}`).then((r) => r.data),
};

export default branchService;
