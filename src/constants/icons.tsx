// ============================================================
// WAYTERO ADMIN — NAV ICONS
// One string→icon map shared by the sidebar and the global search,
// so a nav item can never render an icon in one place and a blank
// square in the other.
// ============================================================
import {
  Dashboard, ConfirmationNumber, Handshake, Person, DirectionsCar,
  Hotel, Tour, AccountBalance, BarChart, ManageAccounts, Settings,
  History, LocalOffer, HeadsetMic, DirectionsRun, AccountBalanceWallet,
  Build, SwapHoriz, Cancel, Gavel, Web, Article, Email, Forum,
  Receipt, PersonOff, MarkEmailRead, Campaign, AltRoute, Public,
  Description, ContactSupport, PhoneCallback, RateReview,
} from "@mui/icons-material";

export const NAV_ICONS: Record<string, React.ReactNode> = {
  Dashboard:          <Dashboard />,
  ConfirmationNumber: <ConfirmationNumber />,
  Handshake:          <Handshake />,
  Person:             <Person />,
  DirectionsCar:      <DirectionsCar />,
  Hotel:              <Hotel />,
  Tour:               <Tour />,
  AccountBalance:     <AccountBalance />,
  BarChart:           <BarChart />,
  ManageAccounts:     <ManageAccounts />,
  Settings:           <Settings />,
  History:            <History />,
  LocalOffer:         <LocalOffer />,
  HeadsetMic:         <HeadsetMic />,
  DirectionsRun:      <DirectionsRun />,
  AccountBalanceWallet: <AccountBalanceWallet />,
  Build:              <Build />,
  SwapHoriz:          <SwapHoriz />,
  Cancel:             <Cancel />,
  Gavel:              <Gavel />,
  Web:                <Web />,
  Article:            <Article />,
  Email:              <Email />,
  Forum:              <Forum />,
  Receipt:            <Receipt />,
  PersonOff:          <PersonOff />,
  MarkEmailRead:      <MarkEmailRead />,
  Campaign:           <Campaign />,
  AltRoute:           <AltRoute />,
  Public:             <Public />,
  Description:        <Description />,
  ContactSupport:     <ContactSupport />,
  PhoneCallback:      <PhoneCallback />,
  RateReview:         <RateReview />,
};
