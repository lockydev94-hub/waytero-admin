// ============================================================
// WAYTERO ADMIN PORTAL — CONSTANTS
// API base, cache TTLs, nav items — per docs
// ============================================================

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

// Cache durations (ms) — Doc: State Management §21-23
export const CACHE_TTL = {
  SHORT:  30_000,   // 30s — bookings, trips
  MEDIUM: 300_000,  //  5m — partners, drivers, vehicles
  LONG:   86_400_000, // 24h — settings, cities, vehicle categories
};

// Token storage keys
export const TOKEN_KEYS = {
  ACCESS:  "wt_access_token",
  REFRESH: "wt_refresh_token",
  USER:    "wt_user",
};

// Sidebar nav items — Doc: Admin Portal §7-8
// Grouped into logical sections; NAV_ITEMS remains a flat projection so
// existing lookups (page-title in AdminLayout) keep working.
export type NavRole = "SUPER_ADMIN" | "ADMIN" | "CCO" | "FINANCE_MANAGER" | "VERIFICATION_OFFICER";

export interface NavItem {
  key: string;
  label: string;
  icon: string;
  path: string;
  roles: NavRole[];
  keywords?: string;
}

export interface NavSection {
  key: string;
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    key: "overview",
    title: "Overview",
    items: [
      { key: "dashboard", label: "Dashboard", icon: "Dashboard", path: "/dashboard", roles: ["SUPER_ADMIN","ADMIN","CCO","FINANCE_MANAGER","VERIFICATION_OFFICER"], keywords: "home overview stats analytics" },
    ],
  },
  {
    key: "operations",
    title: "Operations",
    items: [
      { key: "bookings", label: "Bookings", icon: "ConfirmationNumber", path: "/bookings", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "booking cab hotel tour order trip" },
      { key: "hotel-switches", label: "Hotel Switches", icon: "SwapHoriz", path: "/bookings/switches", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "switch transfer hotel move" },
      { key: "cab-ops", label: "Cab Operations", icon: "DirectionsCar", path: "/cab-ops", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "cab breakdown swap handover taxi driver assign" },
      { key: "trip-assistance", label: "Trip Assistance", icon: "DirectionsRun", path: "/trip-assistance", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "trip help emergency assist" },
      { key: "customer-care", label: "Customer Care", icon: "HeadsetMic", path: "/customer-care", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "customer support help care issue log" },
    ],
  },
  {
    key: "network",
    title: "Network & Supply",
    items: [
      { key: "partners", label: "Partners", icon: "Handshake", path: "/partners", roles: ["SUPER_ADMIN","ADMIN","CCO","VERIFICATION_OFFICER"], keywords: "partner vendor business cab owner" },
      { key: "drivers", label: "Drivers", icon: "Person", path: "/drivers", roles: ["SUPER_ADMIN","ADMIN","CCO","VERIFICATION_OFFICER"], keywords: "driver cab driver employee" },
      { key: "vehicles", label: "Vehicles", icon: "DirectionsCar", path: "/vehicles", roles: ["SUPER_ADMIN","ADMIN","VERIFICATION_OFFICER"], keywords: "vehicle cab car fleet" },
      { key: "vehicles-maintenance", label: "Vehicle Maintenance", icon: "Build", path: "/vehicles/maintenance", roles: ["SUPER_ADMIN","ADMIN"], keywords: "maintenance service repair vehicle" },
      { key: "hotels", label: "Hotels", icon: "Hotel", path: "/hotels", roles: ["SUPER_ADMIN","ADMIN","VERIFICATION_OFFICER"], keywords: "hotel stay room property" },
      { key: "hotels-commission-audit", label: "Hotel Commission Audit", icon: "Receipt", path: "/hotels/commission-audit", roles: ["SUPER_ADMIN","ADMIN"], keywords: "commission hotel audit gst" },
      { key: "tours", label: "Tours", icon: "Tour", path: "/tours", roles: ["SUPER_ADMIN","ADMIN"], keywords: "tour package travel excursion" },
    ],
  },
  {
    key: "finance",
    title: "Finance",
    items: [
      { key: "payments", label: "Payments", icon: "AccountBalance", path: "/payments", roles: ["SUPER_ADMIN","ADMIN","FINANCE_MANAGER"], keywords: "finance payment transaction money" },
      { key: "wallets", label: "Wallets", icon: "AccountBalanceWallet", path: "/wallets", roles: ["SUPER_ADMIN","ADMIN","FINANCE_MANAGER"], keywords: "wallet balance money" },
      { key: "settlements", label: "Settlements", icon: "AccountBalance", path: "/settlements", roles: ["SUPER_ADMIN","ADMIN","FINANCE_MANAGER"], keywords: "settlement payout payment" },
      { key: "handover-reconciliation", label: "Handover Reconciliation", icon: "SwapHoriz", path: "/settlements/handover-reconciliation", roles: ["SUPER_ADMIN","ADMIN","FINANCE_MANAGER"], keywords: "handover reconcile reconciliation" },
      { key: "coupons", label: "Coupons", icon: "LocalOffer", path: "/coupons", roles: ["SUPER_ADMIN","ADMIN"], keywords: "coupon offer discount promo" },
      { key: "tax-gst", label: "Tax & GST", icon: "Receipt", path: "/tax-gst", roles: ["SUPER_ADMIN","ADMIN","FINANCE_MANAGER"], keywords: "tax gst gst rates" },
      { key: "reports", label: "Reports", icon: "BarChart", path: "/reports", roles: ["SUPER_ADMIN","ADMIN","FINANCE_MANAGER"], keywords: "report analytics summary finance" },
    ],
  },
  {
    key: "customer-resolution",
    title: "Customer Resolution",
    items: [
      { key: "cancellation-requests", label: "Cancellation Requests", icon: "Cancel", path: "/cancellation/requests", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "cancellation cancel refund" },
      { key: "cancellation-policy", label: "Cancellation Policy", icon: "Gavel", path: "/cancellation/policy", roles: ["SUPER_ADMIN","ADMIN"], keywords: "cancellation policy rule refund" },
      { key: "account-deletion", label: "Account Deletion", icon: "PersonOff", path: "/account-deletion", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "account deletion remove customer" },
    ],
  },
  {
    key: "communication",
    title: "Communication",
    items: [
      { key: "chat", label: "Live Chat", icon: "Forum", path: "/chat", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "chat live message support" },
      { key: "notices", label: "Partner Notices", icon: "Campaign", path: "/notices", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "notice announcement partner broadcast" },
      { key: "email-logs", label: "Email Logs", icon: "MarkEmailRead", path: "/email/logs", roles: ["SUPER_ADMIN","ADMIN"], keywords: "email log mail sent" },
      { key: "partner-applications", label: "Partner Applications", icon: "Handshake", path: "/leads/partner-applications", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "partner apply application lead" },
      { key: "contact-messages", label: "Contact Messages", icon: "Email", path: "/leads/contact-messages", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "contact message enquiry lead" },
    ],
  },
  {
    key: "content",
    title: "Website & Content",
    items: [
      { key: "cms", label: "Website CMS", icon: "Web", path: "/cms", roles: ["SUPER_ADMIN","ADMIN"], keywords: "cms website content section header footer" },
      { key: "blog", label: "Blog", icon: "Article", path: "/cms/blog", roles: ["SUPER_ADMIN","ADMIN"], keywords: "blog article post content" },
    ],
  },
  {
    key: "system",
    title: "System",
    items: [
      { key: "users", label: "Users", icon: "ManageAccounts", path: "/users", roles: ["SUPER_ADMIN"], keywords: "user admin staff employee" },
      { key: "audit", label: "Audit Logs", icon: "History", path: "/audit", roles: ["SUPER_ADMIN","ADMIN"], keywords: "audit log activity trail" },
      { key: "settings", label: "Settings", icon: "Settings", path: "/settings", roles: ["SUPER_ADMIN"], keywords: "settings configuration system" },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export type NavKey = typeof NAV_ITEMS[number]["key"];

// ── Audit log filter vocabularies ─────────────────────────────────────────────
// Doc Ref: Docs/04_API_Documentation/12_ADMIN_API.md §28 (Audit Events)
// Mirror the module_name constants on the backend (app.modules.admin.services
// .audit_logger.AuditLogger). Keep both lists in sync.

export const AUDIT_MODULES = [
  "AUTH",
  "PARTNER",
  "DRIVER",
  "VEHICLE",
  "HOTEL",
  "TOUR",
  "BOOKING",
  "PAYMENT",
  "WALLET",
  "SETTLEMENT",
  "COUPON",
  "NOTIFICATION",
  "ROLE",
  "CONFIG",
  "STAFF",
] as const;

export type AuditModule = (typeof AUDIT_MODULES)[number];

export const AUDIT_ACTION_TYPES = [
  // Auth lifecycle
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "LOGOUT",
  "OTP_SENT",
  "OTP_VERIFIED",
  "OTP_FAILED",
  "PASSWORD_CHANGED",
  "TOKEN_REFRESHED",
  "ACCOUNT_LOCKED",
  // Status mutations
  "STATUS_UPDATED",
  "PARTNER_APPROVED",
  "PARTNER_SUSPENDED",
  "PARTNER_REJECTED",
  "DRIVER_APPROVED",
  "DRIVER_SUSPENDED",
  "DRIVER_BLOCKED",
  "VEHICLE_APPROVED",
  "VEHICLE_SUSPENDED",
  "HOTEL_APPROVED",
  "HOTEL_SUSPENDED",
  "TOUR_APPROVED",
  "PASSWORD_RESET",
  "COMMISSION_GROUP_ASSIGNED",
  // Verification
  "VERIFICATION_APPROVED",
  "VERIFICATION_REJECTED",
  "DOCUMENT_VERIFIED",
  // Admin actions
  "BROADCAST_SENT",
  "PRICING_UPDATED",
  "COMMISSION_UPDATED",
  "SETTLEMENT_APPROVED",
  "CONFIGURATION_UPDATED",
  // RBAC
  "ROLE_CREATED",
  "ROLE_UPDATED",
  "PERMISSION_ASSIGNED",
  "USER_SUSPENDED",
  // Staff
  "STAFF_CREATED",
  "STAFF_ACTIVATED",
  "STAFF_SUSPENDED",
  "STAFF_PASSWORD_RESET",
] as const;

export type AuditActionType = (typeof AUDIT_ACTION_TYPES)[number];
