// ============================================================
// WAYTERO ADMIN — OFFER BADGE
// Marketing attribution chip for booking pages/lists. The money
// lives on the coupon; this only says which hero offer brought
// the booking in. Renders nothing when there is no offer.
// ============================================================
import { Chip, Tooltip } from "@mui/material";
import { LocalOffer } from "@mui/icons-material";

interface Props {
  offerTitle?: string | null;
  offerSlug?: string | null;
  size?: "small" | "medium";
}

export default function OfferBadge({ offerTitle, offerSlug, size = "small" }: Props) {
  if (!offerTitle) return null;
  const siteUrl = import.meta.env.VITE_SITE_URL ?? "http://localhost:3002";
  const chip = (
    <Chip
      size={size}
      icon={<LocalOffer sx={{ fontSize: 16 }} />}
      label={`Offer: ${offerTitle}`}
      color="secondary"
      variant="outlined"
      component={offerSlug ? "a" : "div"}
      href={offerSlug ? `${siteUrl}/offers/${offerSlug}` : undefined}
      target={offerSlug ? "_blank" : undefined}
      rel="noreferrer"
      sx={{ fontWeight: 600, textDecoration: "none" }}
    />
  );
  return (
    <Tooltip title="Booked through a hero offer — the discount is on the linked coupon">
      {chip}
    </Tooltip>
  );
}
