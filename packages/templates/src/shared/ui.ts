import { Container, Graphics } from "pixi.js";
import { makeText, type FontRegistry } from "@jima/engine";

// Small UI building blocks shared by the social / promo / travel families —
// dashed paths (tickets, flight routes), pill buttons, and avatars. All pure and
// deterministic.

export interface DashOptions {
  dash: number;
  gap: number;
  width: number;
  color: string;
  cap?: "round" | "butt" | "square";
}

/**
 * Stroke a dashed polyline through `pts` (flat [x0,y0,x1,y1,…]) into `g`. Handy
 * for coupon perforations and a plane's dashed flight arc (sample the arc into
 * points first). Emits one stroke call, so set other styles before/after.
 */
export function dashedPath(g: Graphics, pts: number[], opts: DashOptions): void {
  const period = opts.dash + opts.gap;
  if (period <= 0) return; // avoid NaN phase from `% 0`
  let carry = 0; // distance already consumed within the current period
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x0 = pts[i]!;
    const y0 = pts[i + 1]!;
    const x1 = pts[i + 2]!;
    const y1 = pts[i + 3]!;
    const segLen = Math.hypot(x1 - x0, y1 - y0);
    if (segLen === 0) continue;
    const ux = (x1 - x0) / segLen;
    const uy = (y1 - y0) / segLen;
    let pos = 0;
    // Resume the dash pattern where the previous segment left off.
    let phase = carry;
    while (pos < segLen) {
      const inDash = phase < opts.dash;
      const remainInPhase = inDash ? opts.dash - phase : period - phase;
      const step = Math.min(remainInPhase, segLen - pos);
      if (inDash) {
        g.moveTo(x0 + ux * pos, y0 + uy * pos).lineTo(x0 + ux * (pos + step), y0 + uy * (pos + step));
      }
      pos += step;
      phase = (phase + step) % period;
    }
    carry = phase;
  }
  g.stroke({ color: opts.color, width: opts.width, cap: opts.cap ?? "butt" });
}

/** Sample a circular arc into a flat polyline (for dashedPath). */
export function arcPoints(cx: number, cy: number, r: number, a0: number, a1: number, steps = 48): number[] {
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return out;
}

/** A fully-rounded pill (roundRect with semicircular ends), centered at origin. */
export function makePill(w: number, h: number, color: string): Graphics {
  return new Graphics().roundRect(-w / 2, -h / 2, w, h, h / 2).fill(color);
}

/** A classic pointer-cursor silhouette with its tip at (0,0), scaled to `s`. */
export function pointerCursor(s: number, fill: string, stroke: string): Graphics {
  const k = s / 28;
  const pts = [0, 0, 0, 24, 6, 18, 10, 28, 14, 26, 10, 16, 18, 16].map((v) => v * k);
  return new Graphics()
    .poly(pts)
    .fill(fill)
    .poly(pts)
    .stroke({ color: stroke, width: Math.max(1, s * 0.04), join: "round" });
}

export interface AvatarOptions {
  radius: number;
  bg: string;
  initial?: string;
  textColor?: string;
  ring?: { color: string; width: number };
}

/** A circular avatar chip (filled circle + optional initial + optional ring). */
export function avatar(fonts: FontRegistry, opts: AvatarOptions): Container {
  const c = new Container();
  if (opts.ring) {
    c.addChild(new Graphics().circle(0, 0, opts.radius + opts.ring.width).fill(opts.ring.color));
  }
  c.addChild(new Graphics().circle(0, 0, opts.radius).fill(opts.bg));
  if (opts.initial) {
    c.addChild(
      makeText(fonts, {
        text: opts.initial,
        role: "display",
        weight: 700,
        size: Math.round(opts.radius * 1.0),
        color: opts.textColor ?? "#FFFFFF",
        anchor: 0.5,
      }),
    );
  }
  return c;
}
