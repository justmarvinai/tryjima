import { Container, Graphics, Sprite, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuint,
  outQuad,
  outExpo,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";
import { makeIcon } from "../shared/icons";
import { avatar } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);

const PALETTES: Palette[] = [
  { id: "paper-ink", name: "Paper + ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", empty: "#D8D8DE", roleColor: "#5B5B68" } },
  { id: "sunrise", name: "Sunrise", colors: { background: "#FFF8EE", textColor: "#2A2016", accent: "#F5A623", empty: "#E6DCCB", roleColor: "#7A6144" } },
  { id: "porcelain", name: "Porcelain", colors: { background: "#F1F4F9", textColor: "#16233A", accent: "#2E5BD6", empty: "#CBD3E0", roleColor: "#526078" } },
  { id: "ink", name: "Ink", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF6A3C", empty: "#33343C", roleColor: "#A7ADB8" } },
];

function quoteFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.05 : aspect === "9:16" ? 0.062 : 0.058;
}

interface QuoteLayout {
  boxes: ReturnType<typeof layoutWords>;
  fontSize: number;
  lineHeight: number;
}

function layoutQuote(
  quote: string,
  fonts: TemplateContext["fonts"],
  aspect: Aspect,
  cx: number,
  maxWidth: number,
  maxHeight: number,
  centerY: number,
): QuoteLayout {
  let fontSize = Math.round(cx * 2 * quoteFrac(aspect));
  const minSize = Math.round(cx * 2 * 0.03);
  let lineHeight = Math.round(fontSize * 1.3);
  let boxes = layoutWords(quote, fonts, { role: "serif", weight: 600, fontSize, lineHeight, maxWidth, align: "center", anchorX: cx, centerY });
  for (let iter = 0; iter < 6; iter++) {
    const lines = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
    if (lines * lineHeight <= maxHeight || fontSize <= minSize) break;
    fontSize = Math.round(fontSize * 0.9);
    lineHeight = Math.round(fontSize * 1.3);
    boxes = layoutWords(quote, fonts, { role: "serif", weight: 600, fontSize, lineHeight, maxWidth, align: "center", anchorX: cx, centerY });
  }
  return { boxes, fontSize, lineHeight };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const emptyColor = pc("empty", "#D8D8DE");
  const roleColor = pc("roleColor", "#5B5B68");
  const quote = str(values.quote, "Honestly the easiest tool I've used — my posts look pro now.");
  const author = str(values.author, "Sam Rivera");
  const role = str(values.role, "");
  const rating = Math.max(1, Math.min(5, Math.round(num(values.rating, 5))));

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const timeline = new JimaTimeline();

  // Star row.
  const starSize = Math.round(w * (ctx.aspect === "16:9" ? 0.05 : 0.066));
  const starGap = starSize * 1.28;
  const starsY = h * 0.24;
  const starX0 = cx - starGap * 2;
  for (let i = 0; i < 5; i++) {
    const holder = new Container();
    holder.addChild(makeIcon("star", starSize, { color: i < rating ? accent : emptyColor }));
    holder.position.set(starX0 + i * starGap, starsY);
    holder.scale.set(0);
    root.addChild(holder);
    const start = 0.3 + i * 0.12;
    timeline
      .to(holder, { prop: "scale.x", from: 0, to: 1, start, duration: 0.42, ease: makeOutBack(1.7) })
      .to(holder, { prop: "scale.y", from: 0, to: 1, start, duration: 0.42, ease: makeOutBack(1.7) });
  }

  // Quote (serif, word-by-word reveal).
  const ql = layoutQuote(quote, fonts, ctx.aspect, cx, w * 0.82, h * 0.3, h * 0.46);
  const wordNodes: Text[] = [];
  ql.boxes.forEach((box, i) => {
    const t = makeText(fonts, { text: box.text, role: "serif", weight: 600, size: ql.fontSize, color: textColor, anchor: 0.5 });
    t.position.set(box.cx, box.cy);
    t.alpha = 0;
    root.addChild(t);
    wordNodes.push(t);
    const start = 1.1 + i * 0.045;
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.35, ease: outQuad })
      .to(t, { prop: "y", from: box.cy + 8, to: box.cy, start, duration: 0.4, ease: outQuint });
  });

  const nWords = ql.boxes.length;
  const lastCy = ql.boxes.length ? Math.max(...ql.boxes.map((b) => b.cy)) : h * 0.46;
  const authorStart = Math.min(3.0, 1.1 + nWords * 0.045 + 0.4);

  // Accent rule.
  const showAccentBar = values.accentBar !== false;
  const ruleY = lastCy + ql.fontSize * 0.9;
  if (showAccentBar) {
    const ruleW = ql.fontSize * 1.4;
    const rule = new Graphics().roundRect(-ruleW / 2, 0, ruleW, Math.max(3, ql.fontSize * 0.06), 3).fill(accent);
    rule.position.set(cx, ruleY);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: authorStart - 0.2, duration: 0.4, ease: outExpo });
  }

  // Author row: avatar (image or initial) + name + role, centered.
  const authorSize = Math.round(w * (ctx.aspect === "16:9" ? 0.03 : 0.04));
  const nameSize = authorSize;
  const roleSize = Math.round(authorSize * 0.78);
  const rA = authorSize * 1.05;
  const gap = authorSize * 0.7;
  const nameW = fonts.measure(author, { family: fonts.family("body"), weight: 600, size: nameSize });
  const roleW = role.length > 0 ? fonts.measure(role, { family: fonts.family("body"), weight: 500, size: roleSize }) : 0;
  const textBlockW = Math.max(nameW, roleW);
  const rowW = 2 * rA + gap + textBlockW;
  const authorY = ruleY + ql.fontSize * 1.3 + rA;
  const startX = cx - rowW / 2;
  const textX = startX + 2 * rA + gap;

  const row = new Container();
  row.alpha = 0;
  root.addChild(row);

  const avatarTex = images.avatar ?? null;
  const avatarHolder = new Container();
  if (avatarTex) {
    const sprite = new Sprite(avatarTex);
    sprite.anchor.set(0.5);
    const cover = (2 * rA) / Math.min(avatarTex.width, avatarTex.height);
    sprite.scale.set(cover);
    const maskG = new Graphics().circle(0, 0, rA).fill(0xffffff);
    avatarHolder.addChild(sprite, maskG);
    sprite.mask = maskG;
    avatarHolder.addChild(new Graphics().circle(0, 0, rA).stroke({ color: accent, width: Math.max(2, rA * 0.06) }));
  } else {
    const initial = (author.trim().charAt(0) || "?").toUpperCase();
    avatarHolder.addChild(avatar(fonts, { radius: rA, bg: accent, initial, textColor: "#FFFFFF" }));
  }
  avatarHolder.position.set(startX + rA, authorY);
  avatarHolder.scale.set(0);
  row.addChild(avatarHolder);

  const nameText = makeText(fonts, { text: author, role: "body", weight: 600, size: nameSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  nameText.position.set(textX, role.length > 0 ? authorY - roleSize * 0.6 : authorY);
  row.addChild(nameText);
  if (role.length > 0) {
    const roleText = makeText(fonts, { text: role, role: "body", weight: 500, size: roleSize, color: roleColor, anchor: { x: 0, y: 0.5 } });
    roleText.position.set(textX, authorY + nameSize * 0.55);
    row.addChild(roleText);
  }

  timeline
    .to(row, { prop: "alpha", from: 0, to: 1, start: authorStart, duration: 0.45, ease: outQuad })
    .to(avatarHolder, { prop: "scale.x", from: 0, to: 1, start: authorStart + 0.05, duration: 0.45, ease: makeOutBack(1.7) })
    .to(avatarHolder, { prop: "scale.y", from: 0, to: 1, start: authorStart + 0.05, duration: 0.45, ease: makeOutBack(1.7) });

  return { timeline, duration: 4.2 };
}

export const reviewStars: TemplateDefinition = {
  id: "review-stars",
  name: "Review Stars",
  tagline: "A five-star review with a warm testimonial.",
  category: "testimonial",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.0,
  palettes: PALETTES,
  fields: [
    { key: "rating", type: "slider", label: "Rating", default: 5, min: 1, max: 5, step: 1 },
    { key: "quote", type: "textarea", label: "Quote", default: "Honestly the easiest tool I've used — my posts look pro now.", maxLength: 140, shrinkToFit: true },
    { key: "author", type: "text", label: "Author", default: "Sam Rivera", maxLength: 28 },
    { key: "role", type: "text", label: "Role", default: "Social lead", maxLength: 28, optional: true },
    { key: "avatar", type: "image", label: "Avatar", default: "", optional: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
