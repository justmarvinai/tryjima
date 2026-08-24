import { Text, TextStyle, type TextStyleAlign } from "pixi.js";
import type { FontRegistry, FontRole } from "./fonts";

export interface MakeTextOptions {
  text: string;
  role: FontRole;
  weight?: number;
  size: number;
  color?: string | number;
  align?: TextStyleAlign;
  letterSpacing?: number;
  lineHeight?: number;
  anchor?: number | { x: number; y: number };
}

/**
 * Create a Pixi Text bound to a registered font role. Text resolution follows
 * the renderer's resolution at render time, so the same object re-rasterizes
 * crisply at export scale — no reading back a DPR-scaled preview (CLAUDE.md).
 */
export function makeText(fonts: FontRegistry, opts: MakeTextOptions): Text {
  const style = new TextStyle({
    fontFamily: fonts.family(opts.role),
    fontSize: opts.size,
    fontWeight: String(opts.weight ?? 500) as TextStyle["fontWeight"],
    fill: opts.color ?? "#101014",
    align: opts.align ?? "left",
    letterSpacing: opts.letterSpacing ?? 0,
    ...(opts.lineHeight !== undefined ? { lineHeight: opts.lineHeight } : {}),
  });
  const t = new Text({ text: opts.text, style });
  if (typeof opts.anchor === "number") t.anchor.set(opts.anchor);
  else if (opts.anchor) t.anchor.set(opts.anchor.x, opts.anchor.y);
  return t;
}
