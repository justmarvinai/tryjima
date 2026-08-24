import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  linear,
  outExpo,
  makeOutBack,
  steps,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { layoutChars } from "../shared/words";

// A modern, minimal typing reveal: the headline types in glyph-by-glyph (each
// character snaps to fully visible — a real "steps" cut, not a fade) while a
// blocky caret jumps between glyph slots and blinks once typing pauses. When
// typing finishes, the caret morphs — slides and stretches — into a full
// accent underline. Cleaner and more contemporary than `typewriter` (a
// monospace terminal-window effect with chrome and a forever-blinking caret):
// there is no terminal chrome here, the font is the display headline face,
// and the caret has a deliberate final act instead of blinking forever.

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "mint-console", name: "Mint console", colors: { background: "#ECFBF3", textColor: "#14342A", accent: "#12A150" } },
  { id: "blueprint", name: "Blueprint", colors: { background: "#EAF1FB", textColor: "#14294A", accent: "#2E5BD6" } },
];

interface Layout {
  fontFrac: number;
  maxWidthFrac: number;
  centerYFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.08, maxWidthFrac: 0.78, centerYFrac: 0.48 };
    case "9:16":
      return { fontFrac: 0.098, maxWidthFrac: 0.84, centerYFrac: 0.46 };
    case "4:5":
      return { fontFrac: 0.09, maxWidthFrac: 0.82, centerYFrac: 0.46 };
    case "1:1":
    default:
      return { fontFrac: 0.088, maxWidthFrac: 0.82, centerYFrac: 0.47 };
  }
}

const TYPE_START = 0.4;
const PER_CHAR = 0.05;
const PAUSE = 0.5;
const MORPH_DUR = 0.55;
const BLINK_PERIOD = 0.9;
const HOLD_TAIL = 1.1;

function totalCharsOf(headline: string): number {
  return headline.replace(/\s+/g, "").length;
}

function computeDuration(values: Values): number {
  const headline = str(values.headline, "Type less. Say more.");
  const n = totalCharsOf(headline);
  const morphStart = TYPE_START + n * PER_CHAR + PAUSE;
  return Math.max(3.0, morphStart + MORPH_DUR + HOLD_TAIL);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Type less. Say more.");
  const showCaret = on(values.showCaret);

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerYFrac;
  const fontSize = Math.round(size.width * L.fontFrac);
  const lineHeight = Math.round(fontSize * 1.2);

  const content = new Container();
  root.addChild(content);

  const boxes = layoutChars(headline, fonts, {
    role: "display",
    weight: 700,
    fontSize,
    lineHeight,
    maxWidth: size.width * L.maxWidthFrac,
    align: "center",
    anchorX: cx,
    centerY,
  });

  const timeline = new JimaTimeline();
  if (boxes.length === 0) return { timeline, duration: 3.0 };

  const totalChars = boxes.length;
  const typeEnd = TYPE_START + totalChars * PER_CHAR;
  const morphStart = typeEnd + PAUSE;

  // Each glyph snaps fully visible at its own instant — a real discrete
  // "typed" cut (steps easing), not a fade — staggered by its index.
  for (const box of boxes) {
    const t = makeText(fonts, { text: box.char, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5 });
    t.position.set(box.cx, box.cy);
    t.alpha = 0;
    content.addChild(t);
    const start = TYPE_START + box.index * PER_CHAR;
    timeline.to(t, { prop: "alpha", from: 0, to: 1, start, duration: PER_CHAR, ease: steps(1, "end") });
  }

  const left = Math.min(...boxes.map((b) => b.cx - b.width / 2));
  const right = Math.max(...boxes.map((b) => b.cx + b.width / 2));
  const bottom = Math.max(...boxes.map((b) => b.cy)) + fontSize * 0.62;

  let caret: Graphics | null = null;
  if (showCaret) {
    const caretW = Math.max(2, fontSize * 0.13);
    const caretH = fontSize * 0.94;
    const caretNode = new Graphics().roundRect(-caretW / 2, -caretH / 2, caretW, caretH, caretW * 0.3).fill(accent);
    const firstBox = boxes[0]!;
    caretNode.position.set(firstBox.cx + firstBox.width / 2 + fontSize * 0.06, firstBox.cy);
    content.addChild(caretNode);

    // Discrete jump-and-hold per glyph via zero-duration tweens: a real cursor
    // jumps between character slots rather than sliding. JimaTimeline resolves
    // whichever tween on a prop started latest, so a run of these correctly
    // hands off glyph to glyph, and the final morph tween below hands off from
    // the last one in exactly the same way (mixing in a `.set()` here instead
    // would always lose to any `.to()` on the same prop, so tweens only).
    for (const box of boxes) {
      const jumpX = box.cx + box.width / 2 + fontSize * 0.06;
      const start = TYPE_START + box.index * PER_CHAR;
      timeline
        .to(caretNode, { prop: "x", from: jumpX, to: jumpX, start, duration: 0, ease: linear })
        .to(caretNode, { prop: "y", from: box.cy, to: box.cy, start, duration: 0, ease: linear });
    }

    const lastBox = boxes[totalChars - 1]!;
    const lastX = lastBox.cx + lastBox.width / 2 + fontSize * 0.06;

    // Morph: the tall caret block slides to center and stretches into a wide,
    // thin accent underline, with a small overshoot as it "clicks" into place.
    const underlineW = right - left;
    const underlineH = Math.max(4, fontSize * 0.1);
    const underlineY = bottom + fontSize * 0.34;
    timeline
      .to(caretNode, { prop: "x", from: lastX, to: (left + right) / 2, start: morphStart, duration: MORPH_DUR, ease: outExpo })
      .to(caretNode, { prop: "y", from: lastBox.cy, to: underlineY, start: morphStart, duration: MORPH_DUR, ease: outExpo })
      .to(caretNode, { prop: "scale.x", from: 1, to: underlineW / caretW, start: morphStart, duration: MORPH_DUR, ease: makeOutBack(1.5) })
      .to(caretNode, { prop: "scale.y", from: 1, to: underlineH / caretH, start: morphStart, duration: MORPH_DUR, ease: outExpo });

    caret = caretNode;
  }

  const caretRef = caret;
  const update = (t: number): void => {
    if (!caretRef) return;
    if (t < TYPE_START) {
      caretRef.visible = false;
    } else if (t < typeEnd) {
      caretRef.visible = true;
    } else if (t < morphStart) {
      const idle = t - typeEnd;
      caretRef.visible = idle % BLINK_PERIOD < BLINK_PERIOD / 2;
    } else {
      caretRef.visible = true;
    }
  };

  return { timeline, duration: computeDuration(values), update };
}

export const typeCursor: TemplateDefinition = {
  id: "type-cursor",
  name: "Type Cursor",
  tagline: "A clean typing reveal whose blinking caret morphs into an underline.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { headline: "display" },
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Type less. Say more.", maxLength: 34, shrinkToFit: true },
    { key: "showCaret", type: "toggle", label: "Caret + underline", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
