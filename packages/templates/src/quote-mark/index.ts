import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outQuint,
  outExpo,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const DEG = Math.PI / 180;
const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "paper-ink", name: "Paper + ink", colors: { background: "#FFFFFF", textColor: "#14131A", accent: "#FF4D1C", roleColor: "#5B5B68" } },
  { id: "midnight-gold", name: "Midnight + gold", colors: { background: "#15121D", textColor: "#FFFFFF", accent: "#E7B84E", roleColor: "#B7B2C6" } },
  { id: "sage-clay", name: "Sage + clay", colors: { background: "#F1F5EC", textColor: "#1D2A18", accent: "#C9683A", roleColor: "#55624D" } },
  { id: "cobalt-ice", name: "Cobalt + ice", colors: { background: "#EAF1FF", textColor: "#0E2340", accent: "#2F6FED", roleColor: "#45577A" } },
];

interface AspectLayout {
  fontFrac: number;
  maxWidthFrac: number;
  centerYFrac: number;
}

function aspectLayout(aspect: Aspect): AspectLayout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.048, maxWidthFrac: 0.58, centerYFrac: 0.52 };
    case "9:16":
      return { fontFrac: 0.06, maxWidthFrac: 0.76, centerYFrac: 0.47 };
    case "4:5":
      return { fontFrac: 0.054, maxWidthFrac: 0.76, centerYFrac: 0.46 };
    case "1:1":
      return { fontFrac: 0.056, maxWidthFrac: 0.76, centerYFrac: 0.48 };
  }
}

/** Greedy-wrap into <= maxLines lines (serif, weight 600), shrinking so the widest line fits. */
function wrapAndFit(
  fonts: FontRegistry,
  text: string,
  size0: number,
  maxWidth: number,
  maxLines: number,
): { lines: string[]; size: number } {
  const family = fonts.family("serif");
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight: 600, size: sz });
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [""], size: size0 };
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (!cur || measure(next, size0) <= maxWidth) cur = next;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  let packed = lines;
  if (packed.length > maxLines) {
    packed = [...packed.slice(0, maxLines - 1), packed.slice(maxLines - 1).join(" ")];
  }
  let size = size0;
  for (let guard = 0; guard < 8; guard++) {
    const widest = Math.max(...packed.map((l) => measure(l, size)));
    if (widest <= maxWidth || widest === 0) break;
    size = Math.max(16, Math.floor(size * (maxWidth / widest)));
  }
  return { lines: packed, size };
}

/** Shrink a single line of body text so it never exceeds maxWidth. */
function fitLineSize(fonts: FontRegistry, text: string, size0: number, maxWidth: number): number {
  const w = fonts.measure(text, { family: fonts.family("body"), weight: 600, size: size0 });
  return w > maxWidth ? Math.max(12, Math.floor(size0 * (maxWidth / w))) : size0;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#14131A"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const roleColor = pc("roleColor", "#5B5B68");

  const quote = str(values.quote, "The fastest way we've found to make our posts look professionally animated.");
  const author = str(values.author, "Sam Rivera");
  const role = str(values.role, "Head of Design, Northwind");
  const showMark = on(values.showMark);

  const W = size.width;
  const H = size.height;
  const cx = W / 2;
  const L = aspectLayout(ctx.aspect);
  const DUR = 4.4;

  // --- Background (full-frame, first child so transparent export can blank it) ---
  const bgRect = new Graphics().rect(-W / 2, -H / 2, W, H).fill(bg);
  bgRect.position.set(W / 2, H / 2);
  bgRect.label = "bg";
  bgRect.scale.set(1.02);
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  timeline
    .to(bgRect, { prop: "scale.x", from: 1.02, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(bgRect, { prop: "scale.y", from: 1.02, to: 1, start: 0, duration: 0.4, ease: outQuad });

  const content = new Container();
  content.label = "content";
  root.addChild(content);

  // --- Lay out the quote into lines ---
  const size0 = Math.round(W * L.fontFrac);
  const maxWidth = W * L.maxWidthFrac;
  const { lines, size: fontSize } = wrapAndFit(fonts, quote, size0, maxWidth, 4);
  const lineHeight = Math.round(fontSize * 1.32);
  const totalH = lines.length * lineHeight;
  const centerY = H * L.centerYFrac;
  const blockTop = centerY - totalH / 2;

  const serifFamily = fonts.family("serif");
  const lineWidths = lines.map((l) => fonts.measure(l, { family: serifFamily, weight: 600, size: fontSize }));
  const blockW = Math.max(...lineWidths, 1);
  const blockLeft = cx - blockW / 2;

  // --- Giant decorative quotation mark (top-left of the quote block) ---
  if (showMark) {
    const markSize = fontSize * 2.4;
    const mark = makeText(fonts, {
      text: "“",
      role: "serif",
      weight: 600,
      size: markSize,
      color: accent,
      anchor: { x: 0, y: 1 },
    });
    const markX = blockLeft - markSize * 0.05;
    const markY = blockTop + fontSize * 0.2;
    mark.position.set(markX, markY);
    mark.alpha = 0;
    mark.scale.set(0.4);
    mark.rotation = -6 * DEG;
    mark.label = "mark";
    content.addChild(mark);
    timeline
      .to(mark, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.3, ease: outQuad })
      .to(mark, { prop: "scale.x", from: 0.4, to: 1, start: 0.05, duration: 0.55, ease: makeOutBack(1.7) })
      .to(mark, { prop: "scale.y", from: 0.4, to: 1, start: 0.05, duration: 0.55, ease: makeOutBack(1.7) })
      .to(mark, { prop: "rotation", from: -6 * DEG, to: 0, start: 0.05, duration: 0.55, ease: makeOutBack(1.7) });
  }

  // --- Quote lines: staggered fade + rise, line by line ---
  const lineStart0 = showMark ? 0.42 : 0.15;
  const lineStagger = 0.2;
  const lineDur = 0.5;
  const riseFrom = fontSize * 0.4;
  lines.forEach((line, i) => {
    const t = makeText(fonts, { text: line, role: "serif", weight: 600, size: fontSize, color: textColor, anchor: 0.5, align: "center" });
    const ly = blockTop + i * lineHeight + lineHeight / 2;
    t.position.set(cx, ly + riseFrom);
    t.alpha = 0;
    content.addChild(t);
    const start = lineStart0 + i * lineStagger;
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start, duration: lineDur, ease: outQuad })
      .to(t, { prop: "y", from: ly + riseFrom, to: ly, start, duration: lineDur + 0.1, ease: outQuint });
  });

  // --- Attribution: "— Name, Role" slides in from the left ---
  const lastLineStart = lineStart0 + (lines.length - 1) * lineStagger;
  const attrStart = lastLineStart + lineDur + 0.3;
  const attrRaw = role.length > 0 ? `— ${author}, ${role}` : `— ${author}`;
  const attrSize0 = Math.round(fontSize * 0.46);
  const attrSize = fitLineSize(fonts, attrRaw, attrSize0, maxWidth);
  const attrY = blockTop + totalH + fontSize * 0.85;
  const attrOffset = Math.min(W, H) * 0.07;
  const attr = makeText(fonts, { text: attrRaw, role: "body", weight: 600, size: attrSize, color: roleColor, anchor: 0.5, align: "center" });
  attr.position.set(cx - attrOffset, attrY);
  attr.alpha = 0;
  content.addChild(attr);
  timeline
    .to(attr, { prop: "alpha", from: 0, to: 1, start: attrStart, duration: 0.4, ease: outQuad })
    .to(attr, { prop: "x", from: cx - attrOffset, to: cx, start: attrStart, duration: 0.5, ease: outExpo });

  return { timeline, duration: DUR };
}

export const quoteMark: TemplateDefinition = {
  id: "quote-mark",
  name: "Quote Mark",
  tagline: "A giant quotation mark opens onto a line-by-line testimonial.",
  category: "testimonial",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.1,
  fontRoles: { quote: "serif", author: "body" },
  palettes: PALETTES,
  fields: [
    { key: "quote", type: "textarea", label: "Quote", default: "The fastest way we've found to make our posts look professionally animated.", maxLength: 150, maxLines: 4, shrinkToFit: true },
    { key: "author", type: "text", label: "Author", default: "Sam Rivera", maxLength: 32 },
    { key: "role", type: "text", label: "Role", default: "Head of Design, Northwind", maxLength: 40, optional: true },
    { key: "showMark", type: "toggle", label: "Quote mark", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
