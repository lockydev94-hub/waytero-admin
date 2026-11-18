// ============================================================
// WAYTERO ADMIN — ROUTE DEFINITIONS
// Doc: Admin Portal §38 Route Structure
// ============================================================
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";

import { RouteGuard } from "./RouteGuard";
import { AdminLayout } from "../layouts/AdminLayout";

const LoginPage                = lazy(() => import("../pages/auth/LoginPage"));
const UnauthorizedPage         = lazy(() => import("../pages/auth/UnauthorizedPage"));
const DashboardPage            = lazy(() => import("../pages/dashboard/DashboardPage"));
const BookingsPage             = lazy(() => import("../pages/bookings/BookingsPage"));
const BookingMasterDetailPage  = lazy(() => import("../pages/bookings/BookingMasterDetailPage"));
const CabBookingDetailPage     = lazy(() => import("../pages/bookings/CabBookingDetailPage"));
const HotelBookingDetailPage   = lazy(() => import("../pages/bookings/HotelBookingDetailPage"));
const TourBookingDetailPage    = lazy(() => import("../pages/bookings/TourBookingDetailPage"));
const HotelSwitchesPage        = lazy(() => import("../pages/bookings/HotelSwitchesPage"));
const PartnersPage             = lazy(() => import("../pages/partners/PartnersPage"));
const DriversPage              = lazy(() => import("../pages/drivers/DriversPage"));
const VehiclesPage             = lazy(() => import("../pages/vehicles/VehiclesPage"));
const HotelsPage               = lazy(() => import("../pages/hotels/HotelsPage"));
const ToursPage                = lazy(() => import("../pages/tours/ToursPage"));
const TourDetailPage           = lazy(() => import("../pages/tours/TourDetailPage"));
const PaymentsPage             = lazy(() => import("../pages/payments/PaymentsPage"));
const WalletsPage              = lazy(() => import("../pages/wallets/WalletsPage"));
const SettlementsPage          = lazy(() => import("../pages/settlements/SettlementsPage"));
const CouponDisbursementsPage  = lazy(() => import("../pages/settlements/CouponDisbursementsPage"));
const HandoverReconciliationPage = lazy(() => import("../pages/settlements/HandoverReconciliationPage"));
const ReportsPage              = lazy(() => import("../pages/reports/ReportsPage"));
const AuditPage                = lazy(() => import("../pages/audit/AuditPage"));
const UsersPage                = lazy(() => import("../pages/users/UsersPage"));
const SettingsPage             = lazy(() => import("../pages/settings/SettingsPage"));
const CouponsPage              = lazy(() => import("../pages/coupons/CouponsPage"));
const CustomerCarePage         = lazy(() => import("../pages/customer-care/CustomerCarePage"));
const PartnerSupportPage       = lazy(() => import("../pages/partner-support/PartnerSupportPage"));
const CabBookingPage           = lazy(() => import("../pages/customer-care/CabBookingPage"));
const CabRateCardPage          = lazy(() => import("../pages/customer-care/CabRateCardPage"));
const HotelBookingPage         = lazy(() => import("../pages/customer-care/HotelBookingPage"));
const TourBookingPage          = lazy(() => import("../pages/customer-care/TourBookingPage"));
const TripAssistancePage       = lazy(() => import("../pages/trip-assistance/TripAssistancePage"));
const CabOpsPage                = lazy(() => import("../pages/cab-ops/CabOpsPage"));
const VehicleMaintenancePage    = lazy(() => import("../pages/vehicles/VehicleMaintenancePage"));
const HotelCommissionAuditPage  = lazy(() => import("../pages/hotels/HotelCommissionAuditPage"));
const CancellationRequestsPage  = lazy(() => import("../pages/cancellation/CancellationRequestsPage"));
const CancellationPolicyPage    = lazy(() => import("../pages/cancellation/CancellationPolicyPage"));
const CmsPage                   = lazy(() => import("../pages/cms/CmsPage"));
const SectionEditorPage         = lazy(() => import("../pages/cms/SectionEditorPage"));
const BlogListPage              = lazy(() => import("../pages/blog/BlogListPage"));
const BlogEditorPage            = lazy(() => import("../pages/blog/BlogEditorPage"));
const LandingPagesListPage      = lazy(() => import("../pages/landing-pages/LandingPagesListPage"));
const LandingPageEditorPage     = lazy(() => import("../pages/landing-pages/LandingPageEditorPage"));
const WebsitePagesListPage      = lazy(() => import("../pages/website-pages/WebsitePagesListPage"));
const WebsitePageEditorPage     = lazy(() => import("../pages/website-pages/WebsitePageEditorPage"));
const OffersPage                = lazy(() => import("../pages/offers/OffersPage"));
const RoutesPage                = lazy(() => import("../pages/cab-routes/RoutesPage"));
const PartnerApplicationsPage   = lazy(() => import("../pages/leads/PartnerApplicationsPage"));
const ContactMessagesPage       = lazy(() => import("../pages/leads/ContactMessagesPage"));
const EnquiriesPage             = lazy(() => import("../pages/leads/EnquiriesPage"));
const CallbackRequestsPage      = lazy(() => import("../pages/leads/CallbackRequestsPage"));
const FeedbackQueuePage         = lazy(() => import("../pages/leads/FeedbackQueuePage"));
const ChatPage                  = lazy(() => import("../pages/chat/ChatPage"));
const TaxGstPage                = lazy(() => import("../pages/tax/TaxGstPage"));
const AccountDeletionPage       = lazy(() => import("../pages/accountDeletion/AccountDeletionRequestsPage"));
const EmailLogsPage             = lazy(() => import("../pages/email/EmailLogsPage"));
const EmailTemplatesPage        = lazy(() => import("../pages/email/EmailTemplatesPage"));
const NoticesPage               = lazy(() => import("../pages/notices/NoticesPage"));
const OnboardingDocsPage        = lazy(() => import("../pages/onboarding-docs/OnboardingDocsPage"));
const ProfilePage               = lazy(() => import("../pages/profile/ProfilePage"));
const WorkHoursPage             = lazy(() => import("../pages/work-hours/WorkHoursPage"));
const BranchesPage              = lazy(() => import("../pages/branches/BranchesPage"));

function PageLoader() {
  return (
    <Box display="flex" alignItems="center" justifyContent="center" minHeight="60vh">
      <CircularProgress size={36} />
    </Box>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Protected — inside AdminLayout */}
        <Route element={<RouteGuard />}>
          <Route element={<AdminLayout />}>
            <Route path="/dashboard"   element={<DashboardPage />} />

            {/* Role mismatch lands here — RouteGuard navigates to /unauthorized,
                so the route must exist or the catch-all bounces in a loop. */}
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Bookings — list, master detail, cab detail */}
            <Route path="/bookings"                             element={<BookingsPage />} />
            <Route path="/bookings/switches"                    element={<HotelSwitchesPage />} />
            <Route path="/bookings/:bookingId"                  element={<BookingMasterDetailPage />} />
            <Route path="/bookings/:bookingId/cab/:cabId"       element={<CabBookingDetailPage />} />
            <Route path="/bookings/:bookingId/hotel/:hotelId"   element={<HotelBookingDetailPage />} />
            <Route path="/bookings/:bookingId/tour/:tourId"     element={<TourBookingDetailPage />} />

            <Route path="/partners"    element={<PartnersPage />} />
            <Route path="/drivers"     element={<DriversPage />} />
            <Route path="/vehicles"    element={<VehiclesPage />} />
            <Route path="/hotels"      element={<HotelsPage />} />
            <Route path="/tours"       element={<ToursPage />} />
            <Route path="/tours/:packageId" element={<TourDetailPage />} />
            <Route path="/payments"    element={<PaymentsPage />} />
            <Route path="/wallets"     element={<WalletsPage />} />
            <Route path="/settlements" element={<SettlementsPage />} />
            <Route path="/settlements/coupon-disbursements" element={<CouponDisbursementsPage />} />
            <Route path="/settlements/handover-reconciliation" element={<HandoverReconciliationPage />} />
            <Route path="/reports"     element={<ReportsPage />} />
            <Route path="/tax-gst"     element={<TaxGstPage />} />
            <Route path="/audit"       element={<AuditPage />} />
            <Route path="/users"       element={<UsersPage />} />
            <Route path="/settings"    element={<SettingsPage />} />
            <Route path="/coupons"     element={<CouponsPage />} />
            <Route path="/customer-care"                                    element={<CustomerCarePage />} />
            <Route path="/partner-support"                                 element={<PartnerSupportPage />} />
            <Route path="/cab-rate-card"                                   element={<CabRateCardPage />} />
            <Route path="/customer-care/cab-booking/:customerId"            element={<CabBookingPage />} />
            <Route path="/customer-care/hotel-booking/:customerId"          element={<HotelBookingPage />} />
            <Route path="/customer-care/tour-booking/:customerId"           element={<TourBookingPage />} />
            <Route path="/trip-assistance"                                     element={<TripAssistancePage />} />
            <Route path="/cab-ops"                                            element={<CabOpsPage />} />
            <Route path="/vehicles/maintenance"                               element={<VehicleMaintenancePage />} />
            <Route path="/hotels/commission-audit"                            element={<HotelCommissionAuditPage />} />
            <Route path="/cancellation/requests"                              element={<CancellationRequestsPage />} />
            <Route path="/cancellation/policy"                                element={<CancellationPolicyPage />} />

            {/* Website CMS — homepage sections, header, footer */}
            <Route path="/cms"                         element={<CmsPage />} />
            <Route path="/cms/sections/:sectionKey"    element={<SectionEditorPage />} />

            {/* Blog */}
            <Route path="/cms/blog"                    element={<BlogListPage />} />
            <Route path="/cms/blog/new"                element={<BlogEditorPage />} />
            <Route path="/cms/blog/:id"                element={<BlogEditorPage />} />

            {/* Landing pages — dedicated city / state service pages */}
            <Route path="/cms/landing-pages"            element={<LandingPagesListPage />} />
            <Route path="/cms/landing-pages/new"        element={<LandingPageEditorPage />} />
            <Route path="/cms/landing-pages/:id"        element={<LandingPageEditorPage />} />

            {/* Website pages — the prose of the policy/trust/company pages,
                stored as LEGAL_PAGE_* configurations and editable here. */}
            <Route path="/cms/pages"                    element={<WebsitePagesListPage />} />
            <Route path="/cms/pages/:slug"              element={<WebsitePageEditorPage />} />

            {/* Offers — coupon-backed hero slider + public offer pages */}
            <Route path="/offers"                       element={<OffersPage />} />

            {/* Cab routes — admin-managed intercity corridors for Popular Routes */}
            <Route path="/cab-routes"                   element={<RoutesPage />} />

            {/* Website leads — partner applications + contact messages */}
            <Route path="/leads/partner-applications"  element={<PartnerApplicationsPage />} />
            <Route path="/leads/contact-messages"      element={<ContactMessagesPage />} />

            {/* Public capture surfaces — enquiry rail, callback card, /feedback */}
            <Route path="/leads/enquiries"             element={<EnquiriesPage />} />
            <Route path="/leads/callback-requests"     element={<CallbackRequestsPage />} />
            <Route path="/leads/feedback"              element={<FeedbackQueuePage />} />

            {/* Live chat board */}
            <Route path="/chat"                        element={<ChatPage />} />

            {/* Customer account-deletion requests */}
            <Route path="/account-deletion"            element={<AccountDeletionPage />} />
            <Route path="/email/logs"                  element={<EmailLogsPage />} />
            <Route path="/email/templates"             element={<EmailTemplatesPage />} />
            <Route path="/notices"                      element={<NoticesPage />} />
            <Route path="/onboarding-docs"             element={<OnboardingDocsPage />} />

            {/* The signed-in admin's own account, and the attendance report */}
            <Route path="/profile"                      element={<ProfilePage />} />
            <Route path="/work-hours"                   element={<WorkHoursPage />} />

            {/* Branch offices — the register every queue is filtered by */}
            <Route path="/branches"                     element={<BranchesPage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
