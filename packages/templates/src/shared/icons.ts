import { Graphics } from "pixi.js";

// A small library of bold, filled glyph icons drawn from Pixi primitives —
// deterministic, resolution-independent, and centered at the origin so they can
// be scaled/rotated about their middle. Each icon fits roughly within a
// `size`×`size` box. Used across the social / icon / travel template families.

export type IconName =
  | "play"
  | "heart"
  | "thumb"
  | "bell"
  | "star"
  | "bolt"
  | "check"
  | "plus"
  | "cart"
  | "comment"
  | "share"
  | "bookmark"
  | "pin"
  | "plane"
  | "folder"
  | "user";

export const ICON_NAMES: IconName[] = [
  "play",
  "heart",
  "thumb",
  "bell",
  "star",
  "bolt",
  "check",
  "plus",
  "cart",
  "comment",
  "share",
  "bookmark",
  "pin",
  "plane",
  "folder",
  "user",
];

export interface IconOptions {
  /** Fill/stroke color. */
  color: string;
  /** For punched-out details (pin hole, comment dots); usually the background. */
  holeColor?: string;
}

/**
 * Draw a named icon into a fresh Graphics, centered at (0,0). Scale the returned
 * object to taste — vectors stay crisp at any export resolution.
 */
export function makeIcon(name: IconName, size: number, opts: IconOptions): Graphics {
  const g = new Graphics();
  const S = size;
  const c = opts.color;
  const hole = opts.holeColor ?? "#FFFFFF";
  switch (name) {
    case "play":
      g.poly([-0.28 * S, -0.44 * S, 0.44 * S, 0, -0.28 * S, 0.44 * S]).fill(c);
      break;
    case "heart": {
      // Two circles + a rotated square (diamond) → a clean solid heart.
      const d = 0.42 * S;
      const cy = 0.04 * S;
      const r = 0.3 * S;
      g.poly([0, cy - d, d, cy, 0, cy + d, -d, cy]).fill(c);
      g.circle(-0.21 * S, cy - 0.21 * S, r).fill(c);
      g.circle(0.21 * S, cy - 0.21 * S, r).fill(c);
      break;
    }
    case "thumb": {
      // Stylised thumbs-up: overlapping parts so they read as one hand.
      g.roundRect(-0.34 * S, 0.04 * S, 0.36 * S, 0.34 * S, 0.06 * S).fill(c); // cuff (overlaps fist)
      g.roundRect(-0.02 * S, -0.1 * S, 0.44 * S, 0.46 * S, 0.1 * S).fill(c); // fist
      g.roundRect(-0.1 * S, -0.42 * S, 0.24 * S, 0.44 * S, 0.12 * S).fill(c); // thumb (overlaps fist top-left)
      break;
    }
    case "bell": {
      g.moveTo(-0.32 * S, 0.22 * S)
        .quadraticCurveTo(-0.34 * S, -0.12 * S, 0, -0.34 * S)
        .quadraticCurveTo(0.34 * S, -0.12 * S, 0.32 * S, 0.22 * S)
        .closePath()
        .fill(c);
      g.roundRect(-0.4 * S, 0.2 * S, 0.8 * S, 0.11 * S, 0.055 * S).fill(c); // rim
      g.circle(0, 0.4 * S, 0.09 * S).fill(c); // clapper
      g.circle(0, -0.4 * S, 0.07 * S).fill(c); // top knob
      break;
    }
    case "star":
      g.star(0, 0, 5, 0.5 * S, 0.21 * S).fill(c);
      break;
    case "bolt":
      g
        .poly([
          0.12 * S, -0.5 * S,
          -0.36 * S, 0.08 * S,
          -0.04 * S, 0.08 * S,
          -0.14 * S, 0.5 * S,
          0.38 * S, -0.12 * S,
          0.04 * S, -0.12 * S,
        ])
        .fill(c);
      break;
    case "check":
      g
        .poly([-0.34 * S, 0.02 * S, -0.1 * S, 0.28 * S, 0.36 * S, -0.28 * S], false)
        .stroke({ color: c, width: Math.max(2, 0.16 * S), cap: "round", join: "round" });
      break;
    case "plus":
      g.roundRect(-0.5 * S, -0.13 * S, 1.0 * S, 0.26 * S, 0.1 * S).fill(c);
      g.roundRect(-0.13 * S, -0.5 * S, 0.26 * S, 1.0 * S, 0.1 * S).fill(c);
      break;
    case "cart": {
      // handle
      g
        .poly([-0.5 * S, -0.34 * S, -0.32 * S, -0.34 * S, -0.16 * S, 0.16 * S], false)
        .stroke({ color: c, width: Math.max(2, 0.1 * S), cap: "round", join: "round" });
      g.poly([-0.34 * S, -0.16 * S, 0.44 * S, -0.16 * S, 0.34 * S, 0.2 * S, -0.24 * S, 0.2 * S]).fill(c); // basket
      g.circle(-0.12 * S, 0.36 * S, 0.08 * S).fill(c);
      g.circle(0.24 * S, 0.36 * S, 0.08 * S).fill(c);
      break;
    }
    case "comment": {
      g.roundRect(-0.44 * S, -0.36 * S, 0.88 * S, 0.58 * S, 0.15 * S).fill(c);
      g.poly([-0.2 * S, 0.18 * S, -0.02 * S, 0.18 * S, -0.28 * S, 0.46 * S]).fill(c); // tail
      // three dots
      for (const dx of [-0.2, 0, 0.2]) g.circle(dx * S, -0.07 * S, 0.06 * S).fill(hole);
      break;
    }
    case "share": {
      g
        .moveTo(-0.3 * S, 0)
        .lineTo(0.28 * S, -0.32 * S)
        .moveTo(-0.3 * S, 0)
        .lineTo(0.28 * S, 0.32 * S)
        .stroke({ color: c, width: Math.max(2, 0.09 * S), cap: "round" });
      g.circle(-0.3 * S, 0, 0.14 * S).fill(c);
      g.circle(0.28 * S, -0.32 * S, 0.14 * S).fill(c);
      g.circle(0.28 * S, 0.32 * S, 0.14 * S).fill(c);
      break;
    }
    case "bookmark":
      g.poly([-0.28 * S, -0.44 * S, 0.28 * S, -0.44 * S, 0.28 * S, 0.44 * S, 0, 0.22 * S, -0.28 * S, 0.44 * S]).fill(c);
      break;
    case "pin": {
      g.circle(0, -0.12 * S, 0.34 * S).fill(c);
      g.poly([-0.3 * S, 0.0 * S, 0.3 * S, 0.0 * S, 0, 0.5 * S]).fill(c);
      g.circle(0, -0.12 * S, 0.13 * S).fill(hole);
      break;
    }
    case "plane":
      // paper plane pointing up-right
      g.poly([0.48 * S, -0.48 * S, -0.44 * S, -0.06 * S, -0.04 * S, 0.08 * S]).fill(c);
      g.poly([-0.04 * S, 0.08 * S, 0.08 * S, 0.46 * S, 0.24 * S, -0.16 * S]).fill(c);
      break;
    case "folder":
      g.roundRect(-0.45 * S, -0.34 * S, 0.44 * S, 0.24 * S, 0.05 * S).fill(c); // tab
      g.roundRect(-0.45 * S, -0.24 * S, 0.9 * S, 0.56 * S, 0.07 * S).fill(c); // body
      break;
    case "user":
      g.circle(0, -0.2 * S, 0.24 * S).fill(c); // head
      g.roundRect(-0.34 * S, 0.12 * S, 0.68 * S, 0.44 * S, 0.22 * S).fill(c); // shoulders
      break;
    default:
      // Unknown name (only reachable if the IconName union is bypassed) — draw a
      // visible dot placeholder rather than returning an empty, invisible glyph.
      g.circle(0, 0, 0.3 * S).fill(c);
      break;
  }
  return g;
}
