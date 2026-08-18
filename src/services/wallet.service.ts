// ============================================================
// WAYTERO ADMIN — WALLET SERVICE
// Base URL: /admin/wallets
// BRD Part 6 §128-136 (Partner), §150 (Adjustments), §157 (Ledger)
// ============================================================
import apiClient from "./api";

// ── Types ─────────────────────────────────────────────────────

export interface WalletLedgerEntry {
  id: number;
  ref: string;
  ref_type: string;
  debit: number;
  credit: number;
  balance_after: number;
  narration: string;
  created_at: string;
}

export interface PartnerWalletItem {
  wallet_id: number;
  partner_id: number;
  partner_code: string;
  partner_type: string;
  partner_name: string;
  mobile: string;
  partner_status: string;
  wallet_type: string;
  wallet_status: string;
  available_balance: number;
  hold_balance: number;
  credit_limit: number;
  total_balance: number;
}

export interface CustomerWalletItem {
  wallet_id: number;
  customer_id: number;
  customer_name: string;
  mobile: string;
  email: string | null;
  wallet_status: string;
  available_balance: number;
  hold_balance: number;
  total_balance: number;
}

export interface PartnerWalletListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: PartnerWalletItem[];
}

export interface CustomerWalletListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: CustomerWalletItem[];
}

export interface PartnerWalletDetail {
  partner: {
    id: number;
    partner_code: string;
    partner_type: string;
    partner_name: string;
    mobile: string;
    partner_status: string;
  };
  wallet: {
    id: number;
    wallet_type: string;
    wallet_status: string;
    available_balance: number;
    hold_balance: number;
    credit_limit: number;
    total_balance: number;
  };
  ledger: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    entries: WalletLedgerEntry[];
  };
}

export interface CustomerWalletDetail {
  customer: {
    id: number;
    name: string;
    mobile: string;
    email: string | null;
  };
  wallet: {
    id: number;
    wallet_status: string;
    available_balance: number;
    hold_balance: number;
    total_balance: number;
  };
  ledger: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    entries: WalletLedgerEntry[];
  };
}

export interface WalletSummary {
  partner_wallets: {
    total_partners: number;
    total_available: number;
    total_hold: number;
    active_count: number;
    suspended_count: number;
  };
  customer_wallets: {
    total_customers: number;
    total_available: number;
    total_hold: number;
  };
  recent_partner_activity: Array<{
    id: number;
    partner_id: number;
    partner_name: string;
    ref: string;
    ref_type: string;
    debit: number;
    credit: number;
    balance_after: number;
    narration: string;
    created_at: string;
  }>;
  recent_customer_activity: Array<{
    id: number;
    customer_id: number;
    customer_name: string;
    ref: string;
    ref_type: string;
    debit: number;
    credit: number;
    balance_after: number;
    narration: string;
    created_at: string;
  }>;
}

const base = "/admin/wallets";

export const walletService = {
  // Dashboard summary
  getSummary: (): Promise<WalletSummary> =>
    apiClient.get(`${base}/summary`).then(r => r.data),

  // Partner wallet list
  listPartnerWallets: (params: {
    page?: number; page_size?: number; search?: string; status?: string;
  } = {}): Promise<PartnerWalletListResponse> =>
    apiClient.get(`${base}/partners`, { params }).then(r => r.data),

  // Customer wallet list
  listCustomerWallets: (params: {
    page?: number; page_size?: number; search?: string;
  } = {}): Promise<CustomerWalletListResponse> =>
    apiClient.get(`${base}/customers`, { params }).then(r => r.data),

  // Partner wallet detail + ledger
  getPartnerWallet: (partnerId: number, params: {
    ledger_page?: number; ledger_page_size?: number;
  } = {}): Promise<PartnerWalletDetail> =>
    apiClient.get(`${base}/partners/${partnerId}`, { params }).then(r => r.data),

  // Customer wallet detail + ledger
  getCustomerWallet: (customerId: number, params: {
    ledger_page?: number; ledger_page_size?: number;
  } = {}): Promise<CustomerWalletDetail> =>
    apiClient.get(`${base}/customer/${customerId}`, { params }).then(r => r.data),

  // Recharge partner wallet
  rechargePartner: (payload: {
    partner_id: number;
    amount: number;
    payment_mode: "CASH" | "UPI";
    upi_reference?: string;
    remarks?: string;
  }) => apiClient.post(`${base}/recharge`, payload).then(r => r.data),

  // Credit wallet
  credit: (payload: {
    wallet_type: "PARTNER" | "CUSTOMER";
    entity_id: number;
    amount: number;
    cause: string;
    remarks?: string;
  }) => apiClient.post(`${base}/credit`, payload).then(r => r.data),

  // Debit wallet
  debit: (payload: {
    wallet_type: "PARTNER" | "CUSTOMER";
    entity_id: number;
    amount: number;
    cause: string;
    remarks?: string;
  }) => apiClient.post(`${base}/debit`, payload).then(r => r.data),
};
