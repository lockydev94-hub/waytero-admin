// ============================================================
// WAYTERO ADMIN — CMS SECTION CONTENT SCHEMA
// Doc Ref: Migration 0044_website_cms
//
//  One description of what each homepage band's `content` JSONB holds,
//  used by the typed editor, the read-only preview, the serializer and the
//  validator. Nothing here is display logic — see SectionContentEditor.tsx.
//
//  The contract is enforced server-side by
//  Backend/app/modules/admin/services/__init__.py:
//    SECTION_CONTENT_KEYS (:932) — the only top-level keys a band accepts
//    TYPED_SLOTS          (:954) — names that would overwrite a real column
//    validate_content     (:958) — rejects both on create/update
//  SECTION_ALLOWED_KEYS and VARIANT_TYPED_SLOTS below mirror those two. If the
//  backend changes, change them here too — the editor keys items off them to
//  decide what to keep, what to hand through untouched, and what has to be
//  discarded before a save can succeed.
//
//  Field names inside each array are the literal keys the PUBLIC renderer
//  reads with `pick(variant, key)`, and the icon lists are the names its
//  `ICONS` lookup actually maps. They are not interchangeable between bands:
//  SERVICES knows 4 icons, HOW_IT_WORKS knows 13. Author anything else and
//  the renderer either ignores it or, historically, rendered it as a bogus
//  element — which is why these are dropdowns and not free text.
// ============================================================

// ── Field kinds ────────────────────────────────────────────────

export type FieldKind = "text" | "textarea" | "number" | "select" | "image";

export interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  /** Only for kind "select". */
  options?: readonly string[];
  /** Coerce the stored value on save. "number" for stats/rating. */
  coerce?: "number";
  placeholder?: string;
  help?: string;
  /** Only for kind "image": the crop slot the uploader enforces. */
  imageKind?: "image" | "icon";
}

/** Sentinel field key holding the row text for a `string[]` band. */
export const STRING_ROW_KEY = "value";

export interface PickerSpec {
  /** GET /admin/settings/cms/picker-items?type=… */
  type: string;
  label: string;
  help: string;
  /** For `rowKind: "string"` bands, which picked field becomes the string. */
  stringField?: string;
}

export interface ArraySpec {
  key: string;
  /** Singular noun for the row header and the "Add …" button. */
  itemLabel: string;
  max: number;
  fields: FieldSpec[];
  /**
   * "string" — the array holds plain strings (partner brand names).
   * "object" — the array holds the `fields` above.
   */
  rowKind: "string" | "object";
  /**
   * Field the public renderer uses as the React key. Two rows sharing it make
   * the carousel misbehave, so duplicates are reported.
   */
  keyField?: string;
  /**
   * True → a duplicate is a save-blocking error (the admin typed both rows).
   * False → a warning (two real customers can share a display name).
   */
  duplicateIsError?: boolean;
  /**
   * SERVICES and WHY_US read a hardcoded, invented default when `items` is
   * ABSENT but hide entirely on `[]`. An emptied list must therefore write
   * `[]`, not omit the key, or the invented cards come back.
   */
  emptyMeansHidden?: boolean;
  picker?: PickerSpec;
  addLabel?: string;
}

export interface ObjectSpec {
  key: string;
  label: string;
  fields: FieldSpec[];
  help: string;
}

export interface BandSchema {
  arrays: ArraySpec[];
  objects?: ObjectSpec[];
}

// ── Icon name lists ────────────────────────────────────────────
// Mirrors of the customer-web renderers. Edit both sides or the picker
// offers a name the site cannot draw.

/** customer-web/src/components/renderers/HeroMarquee.tsx:26-29 */
const HERO_ICONS = [
  "Layers", "ReceiptText", "ShieldCheck", "Store", "Navigation", "Headset",
  "Star", "MapPin", "Zap", "BadgePercent", "Wallet", "Plane",
] as const;

/** HeroSection.tsx's TRUST_ICONS — the chips beside the headline. */
const HERO_TRUST_ICONS = [
  "BadgeCheck", "ReceiptText", "Headset", "ShieldCheck", "Sparkles", "Compass",
  "Star", "MapPin", "Wallet", "Zap", "Plane", "Users",
] as const;

/** customer-web/src/components/renderers/ServicesSection.tsx:3-8 */
const SERVICES_ICONS = ["Car", "Hotel", "Map", "MapPin"] as const;

/** customer-web/src/components/renderers/RideTypesSection.tsx:20-24 — each
 *  name carries its own colour on the site, so they are not interchangeable. */
const RIDE_TYPE_ICONS = ["CarFront", "Plane", "MoveRight", "CircleUserRound", "RefreshCw"] as const;

/** customer-web/src/components/renderers/WhyUsSection.tsx:13-20 */
const WHY_US_ICONS = [
  "Zap", "ShieldCheck", "IndianRupee", "Lock", "Headphones",
  // Kept for variants authored before the 2026-11 redesign.
  "Tag", "Phone", "Smartphone",
] as const;

/** customer-web/src/components/renderers/HowItWorksSection.tsx:19-33 */
const HOW_IT_WORKS_ICONS = [
  "Search", "CalendarCheck", "ShieldCheck", "Plane", "Car", "MapPin", "Wallet",
  "Smartphone", "CreditCard", "Star", "Users", "Gift", "HandHeart", "CheckCircle2",
] as const;

/** ServicesSection.tsx:15 / WhyUsSection.tsx:26 — accepted `tone` values. */
const TONES_4 = ["primary", "accent", "success", "info"] as const;
const TONES_6 = ["primary", "success", "accent", "info", "warning", "danger"] as const;

// ── Backend contract mirrors ───────────────────────────────────

/** Mirrors SECTION_CONTENT_KEYS (services/__init__.py:932-951). */
export const SECTION_ALLOWED_KEYS: Record<string, readonly string[]> = {
  HERO: ["marquee_items", "trust_items"],
  SERVICES: ["items", "eyebrow", "title", "subtitle"],
  RIDE_TYPES: ["items"],
  WHY_US: ["items", "eyebrow", "title", "subtitle"],
  STATS: ["stats", "eyebrow", "title"],
  HOW_IT_WORKS: ["steps"],
  TESTIMONIALS: ["testimonials", "eyebrow", "title", "subtitle"],
  PARTNERS: ["partners", "cta", "eyebrow", "title", "subtitle"],
  CTA: ["title", "subtitle"],
  FAQ: ["faqs"],
  FEATURED_HOTELS: ["eyebrow", "title", "subtitle"],
  POPULAR_DESTINATIONS: ["eyebrow", "title", "subtitle"],
  TOUR_PACKAGES: ["eyebrow", "title", "subtitle"],
  POPULAR_ROUTES: [],
  POPULAR_CITIES: [],
  OFFERS: [],
  BLOG: [],
  NEWSLETTER: [],
  APP_DOWNLOAD: [],
};

/**
 * Mirrors TYPED_SLOTS (services/__init__.py:954) — derived there from the ORM,
 * listed here because the editor has no runtime access to it. A content key
 * naming one of these silently overwrites the column the admin edits above it,
 * so the backend refuses it and the editor shows it as discardable-only.
 */
export const VARIANT_TYPED_SLOTS: readonly string[] = [
  "id", "page_section_id", "section_key", "variant_name", "variant_tag",
  "display_order", "is_active", "headline", "subheadline", "body_text",
  "cta_text", "cta_link", "background_image_url", "background_video_url",
  "mobile_image_url", "icon_url", "accent_color", "animation_style",
  "text_alignment", "overlay_opacity", "service_type", "starts_at", "ends_at",
  "created_at", "updated_at",
];

// ── Per-band shape ─────────────────────────────────────────────

export const SECTION_CONTENT_SCHEMA: Record<string, BandSchema> = {
  HERO: {
    arrays: [
      {
        key: "marquee_items",
        itemLabel: "strip item",
        rowKind: "object",
        max: 12,
        keyField: "label",
        fields: [
          { key: "icon", label: "Icon", kind: "select", options: HERO_ICONS,
            help: "Blank uses the strip's default icon." },
          { key: "label", label: "Label", kind: "text", required: true,
            help: "Items without a label are dropped by the site." },
          { key: "sublabel", label: "Sub-label", kind: "text" },
        ],
      },
      {
        key: "trust_items",
        itemLabel: "trust chip",
        rowKind: "object",
        max: 6,
        keyField: "label",
        fields: [
          { key: "icon", label: "Icon", kind: "select", options: HERO_TRUST_ICONS,
            help: "Sets the chip beside the headline. Blank uses a shield." },
          { key: "label", label: "Label", kind: "text", required: true,
            help: "Empty rows are dropped; with none at all the site shows its three defaults." },
        ],
      },
    ],
  },

  SERVICES: {
    arrays: [
      {
        key: "items",
        itemLabel: "service card",
        rowKind: "object",
        max: 8,
        keyField: "title",
        duplicateIsError: true,
        emptyMeansHidden: true,
        addLabel: "Add service card",
        picker: {
          type: "SERVICES",
          label: "Service types",
          help: "Pulls active service types (Cab / Hotel / Tour) from the database.",
        },
        fields: [
          { key: "icon", label: "Icon", kind: "select", options: SERVICES_ICONS,
            help: "This band draws only these four." },
          { key: "title", label: "Title", kind: "text", required: true },
          { key: "desc", label: "Description", kind: "textarea" },
          { key: "link", label: "Link", kind: "text", placeholder: "/cabs",
            help: "Cards pointing at a vertical that is switched off site-wide are hidden." },
          { key: "tone", label: "Tone", kind: "select", options: TONES_4 },
        ],
      },
    ],
  },

  // The heading and sub-heading are the variant's own headline/subheadline
  // slots, so only the cards live here.
  RIDE_TYPES: {
    arrays: [
      {
        key: "items",
        itemLabel: "ride type",
        rowKind: "object",
        max: 6,
        keyField: "title",
        duplicateIsError: true,
        emptyMeansHidden: true,
        addLabel: "Add ride type",
        fields: [
          { key: "icon", label: "Icon", kind: "select", options: RIDE_TYPE_ICONS,
            help: "This band draws only these five, each in its own colour. Blank uses the cab." },
          { key: "title", label: "Title", kind: "text", required: true },
          { key: "desc", label: "Description", kind: "textarea" },
          { key: "href", label: "Link", kind: "text", placeholder: "/cabs",
            help: "Blank sends the card to the cab search." },
        ],
      },
    ],
  },

  WHY_US: {
    arrays: [
      {
        key: "items",
        itemLabel: "reason",
        rowKind: "object",
        max: 8,
        keyField: "title",
        duplicateIsError: true,
        emptyMeansHidden: true,
        addLabel: "Add reason",
        fields: [
          { key: "icon", label: "Icon", kind: "select", options: WHY_US_ICONS,
            help: "This band draws only these names. The icon takes its colour from the tone." },
          { key: "title", label: "Title", kind: "text", required: true },
          { key: "desc", label: "Description", kind: "textarea" },
          { key: "tone", label: "Tone", kind: "select", options: TONES_6 },
        ],
      },
    ],
  },

  STATS: {
    arrays: [
      {
        key: "stats",
        itemLabel: "stat",
        rowKind: "object",
        max: 8,
        keyField: "label",
        duplicateIsError: true,
        addLabel: "Add stat",
        fields: [
          { key: "value", label: "Value", kind: "number", required: true, coerce: "number",
            help: "Printed as a whole number with no thousands separator — 50000 shows as 50000." },
          { key: "suffix", label: "Suffix", kind: "text", placeholder: "+" },
          { key: "label", label: "Label", kind: "text", required: true },
        ],
      },
    ],
  },

  HOW_IT_WORKS: {
    arrays: [
      {
        key: "steps",
        itemLabel: "step",
        rowKind: "object",
        max: 8,
        keyField: "title",
        // HowItWorksSection.tsx:56 keys the list on the title, so a repeat
        // collides React keys rather than just looking odd.
        duplicateIsError: true,
        addLabel: "Add step",
        fields: [
          { key: "icon", label: "Icon", kind: "select", options: HOW_IT_WORKS_ICONS,
            help: "Blank uses a map pin." },
          { key: "title", label: "Title", kind: "text", required: true,
            help: "The step number is generated from the order." },
          { key: "description", label: "Description", kind: "textarea", required: true },
        ],
      },
    ],
  },

  TESTIMONIALS: {
    arrays: [
      {
        key: "testimonials",
        itemLabel: "review",
        rowKind: "object",
        max: 12,
        keyField: "name",
        // Two approved reviews can genuinely come from two "Rahul S." rows,
        // so a repeat here is a caution rather than a block.
        duplicateIsError: false,
        addLabel: "Add review",
        picker: {
          type: "REVIEWS",
          label: "approved reviews",
          help: "Pulls reviews an admin has approved in Feedback, with the " +
                "customer shown by a shortened display name.",
        },
        fields: [
          { key: "name", label: "Name", kind: "text", required: true },
          { key: "role", label: "Role", kind: "text", placeholder: "Business traveller" },
          { key: "city", label: "City", kind: "text" },
          { key: "text", label: "Review", kind: "textarea", required: true },
          { key: "rating", label: "Rating", kind: "select", coerce: "number",
            options: ["5", "4", "3", "2", "1"], help: "Blank means 5." },
          { key: "avatar", label: "Avatar", kind: "image", imageKind: "icon" },
        ],
      },
    ],
  },

  PARTNERS: {
    arrays: [
      {
        key: "partners",
        itemLabel: "brand",
        rowKind: "string",
        max: 24,
        addLabel: "Add brand",
        picker: {
          type: "PARTNERS",
          label: "approved partners",
          help: "Pulls business names from partners whose account is approved " +
                "or active. Only add brands WayTero actually works with.",
          stringField: "name",
        },
        fields: [
          { key: STRING_ROW_KEY, label: "Brand name", kind: "text", required: true },
        ],
      },
    ],
    objects: [
      {
        key: "cta",
        label: "Partner CTA button",
        help: "Left blank, the band shows its own “Become a Partner” button.",
        fields: [
          { key: "label", label: "Button text", kind: "text", required: true },
          { key: "href", label: "Button link", kind: "text", required: true,
            placeholder: "/partner" },
        ],
      },
    ],
  },

  FAQ: {
    arrays: [
      {
        key: "faqs",
        itemLabel: "question",
        rowKind: "object",
        max: 12,
        keyField: "question",
        // FaqSection.tsx:68 keys the accordion on the question, so two rows
        // with the same wording collide.
        duplicateIsError: true,
        addLabel: "Add question",
        fields: [
          { key: "question", label: "Question", kind: "text", required: true },
          { key: "answer", label: "Answer", kind: "textarea", required: true },
          { key: "category", label: "Category", kind: "text",
            help: "Tab this question files under (e.g. Cab Booking, Payments & Refunds). Blank goes under General. One category only means no tab rail is shown." },
        ],
      },
    ],
  },

  // CTA's only content keys are title/subtitle, which are fallbacks for the
  // heading and sub-heading inputs already in the dialog — nothing to author.
  CTA: { arrays: [] },
};

/**
 * Bands whose cards the homepage pulls from live tables when it renders. They
 * take no content array (the backend rejects one), so the editor shows an
 * explainer instead of a form.
 */
export const LIVE_DATA_BANDS: Record<string, string> = {
  FEATURED_HOTELS: "featured hotels",
  TOUR_PACKAGES: "tour packages",
  POPULAR_DESTINATIONS: "destinations",
  POPULAR_ROUTES: "cab routes",
  POPULAR_CITIES: "cities",
  OFFERS: "offers",
  BLOG: "blog posts",
};

/** Bands that are pure functional strips — copy fields and nothing else. */
export const NO_CONTENT_BANDS: readonly string[] = ["NEWSLETTER", "APP_DOWNLOAD"];

/** Which keys the editor owns, so everything else can be classified. */
export function managedKeys(sectionKey: string): string[] {
  const schema = SECTION_CONTENT_SCHEMA[sectionKey];
  if (!schema) return [];
  const keys = schema.arrays.map((a) => a.key);
  for (const obj of schema.objects ?? []) keys.push(obj.key);
  return keys;
}
