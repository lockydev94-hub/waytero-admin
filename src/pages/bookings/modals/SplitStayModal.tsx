// ============================================================
// WAYTERO ADMIN — SPLIT STAY MODAL
// Doc Ref: Hotel Switch Spec; Migration 0042_hotel_switch
// Thin wrapper around SwitchHotelModal that pins the post-checkin flow.
// Only allowed when reservation_status ∈ {CHECKED_IN, IN_HOUSE}.
// ============================================================
import SwitchHotelModal from "./SwitchHotelModal";
import type { HotelBookingOut } from "../../../services/booking.service";

interface Props {
  open: boolean;
  onClose: () => void;
  bookingId: number;
  hotelId: number;
  hb: HotelBookingOut;
  onDone?: () => void;
}

export default function SplitStayModal({ open, onClose, bookingId, hotelId, hb, onDone }: Props) {
  return (
    <SwitchHotelModal
      open={open}
      onClose={onClose}
      isSplitMode
      bookingId={bookingId}
      hotelId={hotelId}
      hb={hb}
      onDone={onDone}
    />
  );
}
