// Use-case groups for the gallery. Templates carry a fine-grained `category`;
// the gallery presents them in these broader, browsable sections (in order).
export interface TemplateGroup {
  id: string;
  label: string;
  blurb: string;
  categories: string[];
}

export const GROUPS: TemplateGroup[] = [
  { id: "text", label: "Text & titles", blurb: "Kinetic type, headlines, quotes-as-titles", categories: ["statement", "announcement"] },
  { id: "overlays", label: "Overlays & lower-thirds", blurb: "Name tags, callouts, subtitle bars — export transparent, drop on footage", categories: ["overlay"] },
  { id: "social", label: "Social", blurb: "Likes, follows, subscribes, Reels & platform UI", categories: ["social"] },
  { id: "product", label: "Product & ads", blurb: "Product reveals, offers, sales, CTAs", categories: ["product", "promo"] },
  { id: "showcase", label: "Showcase", blurb: "Galleries, features, device mockups, photos", categories: ["showcase", "photo", "tech"] },
  { id: "explain", label: "Explainers & data", blurb: "Steps, timelines, comparisons, stats", categories: ["educational", "comparison", "stat"] },
  { id: "brand", label: "Brand & quotes", blurb: "Logos, badges, end cards, testimonials", categories: ["brand", "testimonial"] },
  { id: "openers", label: "Openers", blurb: "Channel intros, logo stingers & countdown openers", categories: ["intro"] },
  { id: "events", label: "Events & travel", blurb: "Save-the-dates, locations, trips", categories: ["event", "travel"] },
];

const OTHER: TemplateGroup = { id: "other", label: "More", blurb: "", categories: [] };

/** Short, human-friendly label per fine-grained template category (badges/chips). */
export const CATEGORY_LABEL: Record<string, string> = {
  announcement: "Announcement",
  statement: "Text",
  promo: "Promo",
  product: "Product",
  tech: "Tech",
  photo: "Photo",
  stat: "Data",
  testimonial: "Quote",
  brand: "Brand",
  event: "Event",
  educational: "Explainer",
  comparison: "Compare",
  social: "Social",
  travel: "Travel",
  showcase: "Showcase",
  overlay: "Overlay",
  intro: "Opener",
  loop: "Background",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category;
}

const BY_CATEGORY = new Map<string, TemplateGroup>();
for (const g of GROUPS) for (const c of g.categories) BY_CATEGORY.set(c, g);

export function groupOf(category: string): TemplateGroup {
  return BY_CATEGORY.get(category) ?? OTHER;
}
