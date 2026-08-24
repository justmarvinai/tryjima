import type { Container, Texture } from "pixi.js";
import type { Aspect, Size } from "../layout/aspect";
import type { Rng } from "../timeline/rng";
import type { JimaTimeline } from "../timeline/timeline";
import type { FontRegistry, FontRole } from "../text/fonts";
import type { SoundProfile } from "../audio/profile";

export type { Aspect } from "../layout/aspect";

export type TemplateCategory =
  | "announcement"
  | "statement"
  | "promo"
  | "product"
  | "tech"
  | "photo"
  | "stat"
  | "testimonial"
  | "brand"
  | "event"
  | "educational"
  | "comparison"
  | "social"
  | "travel"
  | "showcase"
  // v1.7 additions
  | "overlay" // lower-thirds, name tags, callouts, subtitle bars (pair with alpha export)
  | "intro"; // channel/logo openers, stingers, countdown intros

export type FieldType =
  | "text"
  | "textarea"
  | "textlist"
  | "image"
  | "color"
  | "select"
  | "slider"
  | "toggle";

export interface SelectOption {
  value: string;
  label: string;
}

// One editable control. Constraints are optional and type-specific; the Studio
// renders the right widget per `type` (DESIGN_ARCHITECTURE.md §7.2).
export interface TemplateField {
  key: string;
  type: FieldType;
  label: string;
  default: unknown;
  help?: string;
  optional?: boolean;
  // text / textarea / textlist
  maxLength?: number;
  maxLines?: number;
  minItems?: number;
  maxItems?: number;
  shrinkToFit?: boolean;
  // select
  options?: SelectOption[];
  // slider
  min?: number;
  max?: number;
  step?: number;
}

export interface Palette {
  id: string;
  name: string;
  /** Named color roles this palette provides; templates read by key. */
  colors: Record<string, string>;
}

export type Values = Record<string, unknown>;

/**
 * Sentinel background value meaning "no fill" — a fully-transparent RGBA hex.
 * Templates resolve their backdrop as `str(values.background, palette.background)`
 * and `.fill()` it; filling with this makes the full-frame background rect
 * invisible, so a renderer cleared with alpha 0 shows through. Used for
 * transparent (alpha) WebM exports; harmless elsewhere.
 */
export const TRANSPARENT_BG = "#00000000";

// Everything a template's build() needs. Provided by the runtime per
// (template, aspect, values). Pure inputs only — no globals, no wall-clock.
export interface TemplateContext {
  root: Container;
  aspect: Aspect;
  size: Size;
  values: Values;
  palette: Palette;
  rng: Rng;
  fonts: FontRegistry;
  /** Pre-loaded textures for image fields (null when empty/unset). */
  images: Record<string, Texture | null>;
}

export interface BuiltTemplate {
  timeline: JimaTimeline;
  /** Seconds at speed 1. Defaults to timeline.duration; override to add a hold. */
  duration?: number;
  /**
   * Optional per-frame hook run after `timeline.evaluate(t)`, before render.
   * Must be a pure function of t (count-ups, particle physics, digit rolls).
   */
  update?: (t: number) => void;
}

/** A value that references a user image by object URL (from the Studio). */
export function isImageRef(v: unknown): v is { url: string } {
  return typeof v === "object" && v !== null && typeof (v as { url?: unknown }).url === "string";
}

export interface TemplateDefinition {
  id: string;
  name: string;
  tagline: string;
  category: TemplateCategory;
  aspects: Aspect[];
  defaultAspect: Aspect;
  loopable: boolean;
  /** Seconds — gallery/OG poster frame. */
  posterTime: number;
  fields: TemplateField[];
  palettes: Palette[];
  fontRoles?: Record<string, FontRole>;
  /**
   * Sonic character for the optional sound layer. Defaults to the category's
   * profile, which is right for almost everything; set it when a template sounds
   * unlike its neighbours (a data-driven social post, a cinematic product reveal).
   */
  sound?: SoundProfile;
  /** Estimate duration before a full build (for UI); optional. */
  estimateDuration?: (values: Values) => number;
  build: (ctx: TemplateContext) => BuiltTemplate;
}

/** Merge a template's field defaults with partial user values. */
export function resolveValues(def: TemplateDefinition, values?: Values): Values {
  const out: Values = {};
  for (const f of def.fields) out[f.key] = f.default;
  if (values) {
    for (const key of Object.keys(values)) {
      if (values[key] !== undefined) out[key] = values[key];
    }
  }
  return out;
}
