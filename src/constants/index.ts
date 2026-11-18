// ============================================================
// WAYTERO ADMIN PORTAL — CONSTANTS
// API base, cache TTLs, nav items — per docs
// ============================================================

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

/**
 * Public website origin — used for "open in website" links so an admin can see
 * the page they just edited for real. 3002 is the customer-web dev port
 * (Frontend/customer-web/package.json); set VITE_SITE_URL for staging/prod.
 */
export const SITE_URL = import.meta.env.VITE_SITE_URL ?? "http://localhost:3002";

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
//
// Order rule: within a section an item sits where its CLOCK demands, not
// where it was invented. Operations runs from "a customer is waiting right
// now" down to "this can wait until the end of the day".
export type NavRole = "SUPER_ADMIN" | "ADMIN" | "CCO" | "FINANCE_MANAGER" | "VERIFICATION_OFFICER";

export const NAV_KEYS = [
  "dashboard",
  "bookings", "cab-ops", "trip-assistance", "hotel-switches", "customer-care",
  "partner-support", "cab-rate-card",
  "chat", "callback-requests", "contact-messages", "enquiries",
  "partner-applications", "guest-feedback",
  "partners", "drivers", "vehicles", "onboarding-docs", "vehicles-maintenance",
  "hotels", "hotels-commission-audit", "tours", "cab-routes",
  "payments", "wallets", "settlements", "handover-reconciliation", "coupons",
  "tax-gst", "reports",
  "cancellation-requests", "cancellation-policy", "account-deletion",
  "notices", "email-templates", "email-logs",
  "cms", "offers", "blog", "landing-pages", "website-pages",
  "users", "work-hours", "audit", "settings", "branches",
] as const;

export type NavKey = typeof NAV_KEYS[number];

export interface NavItem {
  key: NavKey;
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
    // Everything here is a queue someone is waiting on, fastest clock first.
    key: "operations",
    title: "Operations",
    items: [
      { key: "bookings", label: "Bookings", icon: "ConfirmationNumber", path: "/bookings", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "booking cab hotel tour order trip" },
      { key: "cab-ops", label: "Cab Operations", icon: "DirectionsCar", path: "/cab-ops", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "cab breakdown swap handover taxi driver assign" },
      { key: "trip-assistance", label: "Trip Assistance", icon: "DirectionsRun", path: "/trip-assistance", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "trip help emergency assist sos" },
      { key: "hotel-switches", label: "Hotel Switches", icon: "SwapHoriz", path: "/bookings/switches", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "switch transfer hotel move" },
      { key: "customer-care", label: "Customer Care", icon: "HeadsetMic", path: "/customer-care", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "customer support help care issue log" },
      { key: "partner-support", label: "Partner Support", icon: "SupportAgent", path: "/partner-support", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "partner support help ticket issue app payment document trip" },
      { key: "cab-rate-card", label: "Cab Rate Card", icon: "PriceChange", path: "/cab-rate-card", roles: ["SUPER_ADMIN","ADMIN"], keywords: "cab rate card package price tariff supplier local outstation daily agreed customer price" },
      { key: "chat", label: "Live Chat", icon: "Forum", path: "/chat", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "chat live message support" },
      { key: "callback-requests", label: "Callback Requests", icon: "PhoneCallback", path: "/leads/callback-requests", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "callback request call me mobile phone lead" },
      { key: "contact-messages", label: "Contact Messages", icon: "Email", path: "/leads/contact-messages", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "contact message enquiry lead" },
      { key: "enquiries", label: "Website Enquiries", icon: "ContactSupport", path: "/leads/enquiries", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "enquiry lead quote quotation callback rail website" },
      { key: "partner-applications", label: "Partner Applications", icon: "Handshake", path: "/leads/partner-applications", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "partner apply application lead" },
      { key: "guest-feedback", label: "Guest Feedback", icon: "RateReview", path: "/leads/feedback", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "feedback review rating guest booking moderation" },
    ],
  },
  {
    key: "network",
    title: "Network & Supply",
    items: [
      { key: "partners", label: "Partners", icon: "Handshake", path: "/partners", roles: ["SUPER_ADMIN","ADMIN","CCO","VERIFICATION_OFFICER"], keywords: "partner vendor business cab owner" },
      { key: "drivers", label: "Drivers", icon: "Person", path: "/drivers", roles: ["SUPER_ADMIN","ADMIN","CCO","VERIFICATION_OFFICER"], keywords: "driver cab driver employee" },
      { key: "vehicles", label: "Vehicles", icon: "DirectionsCar", path: "/vehicles", roles: ["SUPER_ADMIN","ADMIN","VERIFICATION_OFFICER"], keywords: "vehicle cab car fleet" },
      { key: "onboarding-docs", label: "Onboarding Docs", icon: "Description", path: "/onboarding-docs", roles: ["SUPER_ADMIN","ADMIN","CCO","VERIFICATION_OFFICER"], keywords: "onboarding guide form pdf partner driver vehicle documents" },
      { key: "vehicles-maintenance", label: "Vehicle Maintenance", icon: "Build", path: "/vehicles/maintenance", roles: ["SUPER_ADMIN","ADMIN"], keywords: "maintenance service repair vehicle" },
      { key: "hotels", label: "Hotels", icon: "Hotel", path: "/hotels", roles: ["SUPER_ADMIN","ADMIN","VERIFICATION_OFFICER"], keywords: "hotel stay room property" },
      { key: "hotels-commission-audit", label: "Hotel Commission Audit", icon: "Receipt", path: "/hotels/commission-audit", roles: ["SUPER_ADMIN","ADMIN"], keywords: "commission hotel audit gst" },
      { key: "tours", label: "Tours", icon: "Tour", path: "/tours", roles: ["SUPER_ADMIN","ADMIN"], keywords: "tour package travel excursion" },
      { key: "cab-routes", label: "Cab Routes", icon: "AltRoute", path: "/cab-routes", roles: ["SUPER_ADMIN","ADMIN"], keywords: "route intercity outstation distance bhubaneswar odisha popular routes fare" },
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
    // Policy-gated and worked in batches, so not part of the act-now queue.
    key: "customer-resolution",
    title: "Customer Resolution",
    items: [
      { key: "cancellation-requests", label: "Cancellation Requests", icon: "Cancel", path: "/cancellation/requests", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "cancellation cancel refund" },
      { key: "cancellation-policy", label: "Cancellation Policy", icon: "Gavel", path: "/cancellation/policy", roles: ["SUPER_ADMIN","ADMIN"], keywords: "cancellation policy rule refund" },
      { key: "account-deletion", label: "Account Deletion", icon: "PersonOff", path: "/account-deletion", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "account deletion remove customer" },
    ],
  },
  {
    // Tools that send or inspect, rather than queues that wait.
    key: "communication",
    title: "Communication",
    items: [
      { key: "notices", label: "Partner Notices", icon: "Campaign", path: "/notices", roles: ["SUPER_ADMIN","ADMIN","CCO"], keywords: "notice announcement partner broadcast" },
      { key: "email-templates", label: "Email Templates", icon: "Email", path: "/email/templates", roles: ["SUPER_ADMIN","ADMIN"], keywords: "email template subject body branding edit" },
      { key: "email-logs", label: "Email Logs", icon: "MarkEmailRead", path: "/email/logs", roles: ["SUPER_ADMIN","ADMIN"], keywords: "email log mail sent" },
    ],
  },
  {
    key: "content",
    title: "Website & Content",
    items: [
      { key: "cms", label: "Website CMS", icon: "Web", path: "/cms", roles: ["SUPER_ADMIN","ADMIN"], keywords: "cms website content section header footer" },
      { key: "offers", label: "Offers", icon: "LocalOffer", path: "/offers", roles: ["SUPER_ADMIN","ADMIN"], keywords: "offer hero slider coupon marketing promo landing" },
      { key: "blog", label: "Blog", icon: "Article", path: "/cms/blog", roles: ["SUPER_ADMIN","ADMIN"], keywords: "blog article post content" },
      { key: "landing-pages", label: "Landing Pages", icon: "Public", path: "/cms/landing-pages", roles: ["SUPER_ADMIN","ADMIN"], keywords: "landing page city state seo cab hotel tour bhubaneswar odisha marketing" },
      { key: "website-pages", label: "Pages", icon: "Article", path: "/cms/pages", roles: ["SUPER_ADMIN","ADMIN"], keywords: "page privacy terms refund cookies safety support careers press policy copy prose legal content" },
    ],
  },
  {
    key: "system",
    title: "System",
    items: [
      { key: "branches", label: "Branch Offices", icon: "Storefront", path: "/branches", roles: ["SUPER_ADMIN"], keywords: "branch office city location head office headquarters register" },
      { key: "users", label: "Users", icon: "ManageAccounts", path: "/users", roles: ["SUPER_ADMIN"], keywords: "user admin staff employee" },
      { key: "work-hours", label: "Work Hours", icon: "History", path: "/work-hours", roles: ["SUPER_ADMIN"], keywords: "attendance leave staff hours login time presence" },
      { key: "audit", label: "Audit Logs", icon: "History", path: "/audit", roles: ["SUPER_ADMIN","ADMIN"], keywords: "audit log activity trail" },
      { key: "settings", label: "Settings", icon: "Settings", path: "/settings", roles: ["SUPER_ADMIN"], keywords: "settings configuration system idle lock logout mpin" },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

// Detail routes are not in the sidebar, so a prefix match cannot name them.
// Checked BEFORE the nav match: "/cms/pages/privacy" starts with the nav path
// "/cms/pages" but is an editor, not the list.
const TITLE_BY_PATH: Array<[RegExp, string]> = [
  [/^\/bookings\/(?!switches$)[^/]+$/,                    "Booking Detail"],
  [/^\/bookings\/[^/]+\/cab\/[^/]+$/,                     "Cab Booking Detail"],
  [/^\/bookings\/[^/]+\/hotel\/[^/]+$/,                   "Hotel Booking Detail"],
  [/^\/bookings\/[^/]+\/tour\/[^/]+$/,                    "Tour Booking Detail"],
  [/^\/cms\/sections\/[^/]+$/,                            "Section Editor"],
  [/^\/cms\/blog\/new$/,                                  "New Blog Post"],
  [/^\/cms\/blog\/[^/]+$/,                                "Blog Editor"],
  [/^\/cms\/landing-pages\/new$/,                         "New Landing Page"],
  [/^\/cms\/landing-pages\/[^/]+$/,                       "Landing Page Editor"],
  [/^\/cms\/pages\/[^/]+$/,                               "Page Editor"],
  [/^\/tours\/[^/]+$/,                                    "Tour Detail"],
  [/^\/cab-rate-card$/,                                   "Cab Rate Card"],
  [/^\/customer-care\/cab-booking\/[^/]+$/,               "Customer Cab Bookings"],
  [/^\/customer-care\/hotel-booking\/[^/]+$/,             "Customer Hotel Bookings"],
  [/^\/customer-care\/tour-booking\/[^/]+$/,              "Customer Tour Bookings"],
  [/^\/settlements\/coupon-disbursements$/,               "Coupon Disbursements"],
  [/^\/profile$/,                                         "Profile"],
  [/^\/unauthorized$/,                                    "Not Authorised"],
];

/**
 * The one nav item a pathname belongs to: the longest matching path wins,
 * so "/bookings/switches" is Hotel Switches and not also Bookings.
 */
export function findActiveNavItem(pathname: string): NavItem | null {
  let best: NavItem | null = null;
  for (const n of NAV_ITEMS) {
    if (pathname !== n.path && !pathname.startsWith(`${n.path}/`)) continue;
    if (!best || n.path.length > best.path.length) best = n;
  }
  return best;
}

/**
 * The page title for the topbar. Detail routes are matched first because
 * "/cms/pages/privacy" starts with the nav path "/cms/pages" but is an
 * editor, not the list.
 */
export function resolveNavTitle(pathname: string): string {
  for (const [pattern, title] of TITLE_BY_PATH) {
    if (pattern.test(pathname)) return title;
  }
  return findActiveNavItem(pathname)?.label ?? "WayTero Admin";
}

// ── Which roles may open which route ─────────────────────────────────────────
// The sidebar hides a row you have no business in; that is a courtesy, not a
// control — anyone can type /users into the address bar. RouteGuard reads this
// table so the hidden rows are also refused. The list is derived from
// NAV_SECTIONS rather than written twice, because a second table is a second
// place to forget an update: change a nav item's roles and its gate follows.
//
// This is the client-side half only. Every one of these screens enforces role
// and branch in SQL on the server; a page that renders here but whose API 403s
// is a page the owner will see an error on, not a way in.
const ALL_STAFF_ROLES: NavRole[] = ["SUPER_ADMIN","ADMIN","CCO","FINANCE_MANAGER","VERIFICATION_OFFICER"];

// Routes the sidebar does not list, so no nav prefix names them. Everything
// else inherits its nav item's roles by prefix — "/bookings/42" is Bookings,
// and adding a detail route needs no entry here.
const EXTRA_ROUTE_ROLES: Array<[RegExp, NavRole[]]> = [
  [/^\/profile$/,      ALL_STAFF_ROLES],
  [/^\/unauthorized$/, ALL_STAFF_ROLES],
];

/**
 * Roles allowed on this pathname, or null when nothing claims it.
 *
 * A detail route inherits its list page: "/bookings/42" resolves to the
 * Bookings nav item by prefix, so it needs no entry of its own. Anything that
 * matches no nav path stays unrestricted here and is still refused by the
 * server — null means "the sidebar was never the gate for this", not "open".
 */
export function allowedRolesForPath(pathname: string): NavRole[] | null {
  for (const [pattern, roles] of EXTRA_ROUTE_ROLES) {
    if (pattern.test(pathname)) return roles;
  }
  return findActiveNavItem(pathname)?.roles ?? null;
}

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
