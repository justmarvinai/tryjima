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
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);

const PALETTES: Palette[] = [
  { id: "paper-ink", name: "Paper + ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", roleColor: "#5B5B68" } },
  { id: "cream-espresso", name: "Cream + espresso", colors: { background: "#F7F1E8", textColor: "#3A2417", accent: "#B5642A", roleColor: "#8A6A50" } },
  { id: "porcelain-navy", name: "Porcelain + navy", colors: { background: "#F1F4F9", textColor: "#16233A", accent: "#3B5BA5", roleColor: "#5A6A85" } },
  { id: "blush-plum", name: "Blush + plum", colors: { background: "#FBEEF4", textColor: "#3A1533", accent: "#B0407F", roleColor: "#8A5A78" } },
];

function quoteFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.058 : aspect === "9:16" ? 0.082 : 0.075;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;

  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const roleColor = pc("roleColor", "#5B5B68");
  const fontRole = (str(values.fontRole, "serif") as FontRole) === "display" ? "display" : "serif";

  const quote = str(values.quote, "Jima made our launch posts look like we hired a motion studio.");
  const author = str(values.author, "Sam Rivera");
  const role = str(values.role, "");
  const showAccentBar = values.accentBar !== false;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const cx = size.width / 2;
  const fontSize = Math.round(size.width * quoteFrac(ctx.aspect));
  const lineHeight = Math.round(fontSize * 1.24);
  const timeline = new JimaTimeline();

  // Giant quotation-mark watermark (behind the words).
  const mark = makeText(fonts, { text: "“", role: fontRole, weight: 600, size: Math.round(size.width * 0.42), color: accent, anchor: 0.5 });
  const markX = size.width * (ctx.aspect === "16:9" ? 0.2 : 0.24);
  const markY = size.height * 0.32;
  mark.position.set(markX, markY);
  mark.alpha = 0;
  root.addChild(mark);
  timeline
    .to(mark, { prop: "alpha", from: 0, to: 0.12, start: 0.0, duration: 0.7, ease: outQuad })
    .to(mark, { prop: "y", from: markY - 20, to: markY, start: 0.0, duration: 0.7, ease: outQuint });

  // Quote words (wrapped, per-word reveal).
  const boxes = layoutWords(quote, fonts, {
    role: fontRole,
    weight: 600,
    fontSize,
    lineHeight,
    maxWidth: size.width * 0.8,
    align: "center",
    anchorX: cx,
    centerY: size.height * 0.42,
  });
  const wordNodes: Text[] = [];
  boxes.forEach((box, i) => {
    const t = makeText(fonts, { text: box.text, role: fontRole, weight: 600, size: fontSize, color: textColor, anchor: 0.5 });
    t.position.set(box.cx, box.cy);
    t.alpha = 0;
    root.addChild(t);
    wordNodes.push(t);
    const start = 0.5 + i * 0.045;
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.35, ease: outQuad })
      .to(t, { prop: "y", from: box.cy + 6, to: box.cy, start, duration: 0.4, ease: outQuint });
  });

  const lastCy = boxes.length ? Math.max(...boxes.map((b) => b.cy)) : size.height * 0.42;
  const attributionY = lastCy + fontSize * 1.4;

  // Accent rule.
  if (showAccentBar) {
    const ruleW = fontSize * 1.4;
    const rule = new Graphics().roundRect(0, 0, ruleW, Math.max(3, fontSize * 0.06), 3).fill(accent);
    rule.position.set(cx - ruleW / 2, attributionY - fontSize * 0.5);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 2.6, duration: 0.4, ease: outExpo });
  }

  // Optional avatar (circle-cropped), centered above the author.
  const avatarTex = images.avatar ?? null;
  let authorY = attributionY;
  if (avatarTex) {
    const r = fontSize * 0.7;
    const avatarCY = attributionY + r * 0.2;
    const holder = new Container();
    const sprite = new Sprite(avatarTex);
    sprite.anchor.set(0.5);
    const cover = (2 * r) / Math.min(avatarTex.width, avatarTex.height);
    sprite.scale.set(cover);
    const maskG = new Graphics().circle(0, 0, r).fill(0xffffff);
    holder.addChild(sprite, maskG);
    sprite.mask = maskG;
    holder.position.set(cx, avatarCY);
    holder.scale.set(0);
    root.addChild(holder);
    timeline
      .to(holder, { prop: "scale.x", from: 0, to: 1, start: 3.0, duration: 0.4, ease: makeOutBack(1.8) })
      .to(holder, { prop: "scale.y", from: 0, to: 1, start: 3.0, duration: 0.4, ease: makeOutBack(1.8) });
    authorY = avatarCY + r + fontSize * 0.6;
  }

  const authorText = makeText(fonts, { text: author, role: "body", weight: 600, size: Math.round(fontSize * 0.5), color: textColor, anchor: 0.5, align: "center" });
  authorText.position.set(cx, authorY);
  authorText.alpha = 0;
  root.addChild(authorText);
  timeline
    .to(authorText, { prop: "alpha", from: 0, to: 1, start: 2.7, duration: 0.4, ease: outQuad })
    .to(authorText, { prop: "y", from: authorY + 10, to: authorY, start: 2.7, duration: 0.4, ease: outQuint });

  if (role.length > 0) {
    const roleText = makeText(fonts, { text: role, role: "body", weight: 500, size: Math.round(fontSize * 0.36), color: roleColor, anchor: 0.5, align: "center" });
    const ry = authorY + fontSize * 0.6;
    roleText.position.set(cx, ry);
    roleText.alpha = 0;
    root.addChild(roleText);
    timeline.to(roleText, { prop: "alpha", from: 0, to: 0.85, start: 2.95, duration: 0.4, ease: outQuad });
  }

  return { timeline, duration: 6.0 };
}

export const quoteSpotlight: TemplateDefinition = {
  id: "quote-spotlight",
  name: "Quote Spotlight",
  tagline: "A testimonial that reveals word by word.",
  category: "testimonial",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.5,
  palettes: PALETTES,
  fields: [
    { key: "quote", type: "textarea", label: "Quote", default: "Jima made our launch posts look like we hired a motion studio.", maxLength: 160, maxLines: 4, shrinkToFit: true },
    { key: "author", type: "text", label: "Author", default: "Sam Rivera", maxLength: 32 },
    { key: "role", type: "text", label: "Role", default: "Head of Social, Northwind", maxLength: 40, optional: true },
    { key: "avatar", type: "image", label: "Avatar", default: "", optional: true },
    { key: "fontRole", type: "select", label: "Font", default: "serif", options: [{ value: "serif", label: "Serif" }, { value: "display", label: "Sans" }] },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
