import type { ComponentType, SVGProps } from "react";
import { TEMPLATE_COUNT } from "@jima/templates/durations";
import { CaptionsIcon, MotionIcon } from "@/ui";

/**
 * The product registry — the single place that knows Jima has two tools.
 *
 * Nav, the product switcher, the command palette, the landing cards, the
 * projects library and the OG/meta copy all read from here, so adding a third
 * product later is one entry rather than a hunt through the app.
 */
export type ProductId = "captions" | "motion";

export interface Product {
  id: ProductId;
  /** Full name, always "Jima <Name>". */
  name: string;
  /** The name without the "Jima" prefix, for lockups and chrome. */
  short: "Captions" | "Motion";
  path: string;
  /** One line, used in nav flyouts and the landing cards. */
  tagline: string;
  /** A sentence, used where there is room to say more. */
  blurb: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Tailwind text colour for the product's accent detail. */
  accent: string;
  /** Tailwind background for the product's icon chip. */
  chip: string;
}

export const PRODUCTS: Product[] = [
  {
    id: "captions",
    name: "Jima Captions",
    short: "Captions",
    path: "/captions",
    tagline: "Auto-captions for short-form video",
    blurb:
      "Drop in an MP4 and get word-perfect, word-timed captions — transcribed by a speech model running on your own device, styled how you like, burned into a full-quality export.",
    icon: CaptionsIcon,
    accent: "text-lime",
    chip: "bg-lime-tint text-lime ring-1 ring-inset ring-lime/25",
  },
  {
    id: "motion",
    name: "Jima Motion",
    short: "Motion",
    path: "/motion",
    tagline: `Animated posts from ${TEMPLATE_COUNT} templates`,
    blurb:
      "Pick a template, type your words, drop in an image — and export a polished motion-graphics clip as MP4, WebM or GIF. Rendered frame-by-frame in your browser, never on a server.",
    icon: MotionIcon,
    accent: "text-lime",
    chip: "bg-lime-tint text-lime ring-1 ring-inset ring-lime/25",
  },
];

export function product(id: ProductId): Product {
  const found = PRODUCTS.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown product: ${id}`);
  return found;
}
