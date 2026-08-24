import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

/** Rough perceived luminance of a #rrggbb color (0..1). */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(11, Math.floor(size0 * (maxWidth / w))) : size0;
}

// A TikTok-style "green screen" frame: the full-frame swappable background block,
// a person-silhouette cutout that rises into it, a small "Green Screen" tag, and
// a caption bar. The swappable screen is the `background` field; the person and
// caption bar carry their own palette roles so they stay legible over any screen.
const PALETTES: Palette[] = [
  { id: "chroma-green", name: "Chroma green", colors: { background: "#14B86B", silhouette: "#063A22", captionBar: "#0B1F16", textColor: "#FFFFFF", accent: "#FFD84D" } },
  { id: "chroma-blue", name: "Chroma blue", colors: { background: "#2E7DF6", silhouette: "#08234A", captionBar: "#0A1830", textColor: "#FFFFFF", accent: "#FFFFFF" } },
  { id: "sunset", name: "Sunset", colors: { background: "#FF6A3D", silhouette: "#3A0E02", captionBar: "#200A04", textColor: "#FFFFFF", accent: "#FFD84D" } },
  { id: "night", name: "Night", colors: { background: "#101218", silhouette: "#E9EDF4", captionBar: "#1E2230", textColor: "#FFFFFF", accent: "#7C5CFF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#14B86B"));
  const silhouette = pc("silhouette", "#063A22");
  const captionBar = pc("captionBar", "#0B1F16");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FFD84D"));
  const onAccent = luminance(accent) < 0.5 ? "#FFFFFF" : "#101014";
  const caption = str(values.caption, "wait for it...");
  const tag = str(values.tag, "Green Screen");
  const showTag = on(values.showTag);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Caption bar (bottom of safe area) ---
  const capSize = fitSize(fonts, caption, "display", 700, Math.round(minDim * 0.05), safe.width * 0.82);
  const capW = Math.min(safe.width * 0.9, fonts.measure(caption, { family: fonts.family("display"), weight: 700, size: capSize }) + capSize * 1.6);
  const capH = capSize + capSize * 0.9;
  const capCy = safe.y + safe.height - capH / 2;

  // --- Person silhouette (rises into the screen, above the caption) ---
  const personBottom = capCy - capH / 2 - minDim * 0.04;
  const personS = Math.min(safe.width * 0.72, (personBottom - safe.y) * 0.92);
  const personCy = personBottom - personS * 0.5;
  const person = new Container();
  person.position.set(cx, personCy + minDim * 0.05);
  person.alpha = 0;
  person.scale.set(0.92);
  root.addChild(person);
  // Soft rim behind the cutout to separate it from the screen.
  const rim = makeIcon("user", personS * 1.06, { color: captionBar });
  rim.alpha = 0.28;
  person.addChild(rim);
  person.addChild(makeIcon("user", personS, { color: silhouette }));
  timeline
    .to(person, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.4, ease: outQuad })
    .to(person, { prop: "y", from: personCy + minDim * 0.05, to: personCy, start: 0.1, duration: 0.7, ease: outExpo })
    .to(person, { prop: "scale.x", from: 0.92, to: 1, start: 0.1, duration: 0.7, ease: spring(0.5) })
    .to(person, { prop: "scale.y", from: 0.92, to: 1, start: 0.1, duration: 0.7, ease: spring(0.5) });

  // --- Caption bar surface + text ---
  const capBox = new Container();
  capBox.position.set(cx, capCy);
  capBox.alpha = 0;
  root.addChild(capBox);
  capBox.addChild(new Graphics().roundRect(-capW / 2, -capH / 2, capW, capH, capH * 0.28).fill(captionBar));
  capBox.addChild(makeText(fonts, { text: caption, role: "display", weight: 700, size: capSize, color: textColor, anchor: 0.5, align: "center" }));
  timeline
    .to(capBox, { prop: "alpha", from: 0, to: 1, start: 0.55, duration: 0.4, ease: outQuad })
    .to(capBox, { prop: "y", from: capCy + minDim * 0.03, to: capCy, start: 0.55, duration: 0.5, ease: outExpo });

  // --- "Green Screen" tag (top-left, inside safe) ---
  if (showTag) {
    const tagSize = fitSize(fonts, tag, "body", 700, Math.round(minDim * 0.03), safe.width * 0.5);
    const tagW = fonts.measure(tag, { family: fonts.family("body"), weight: 700, size: tagSize }) + tagSize * 2.0;
    const tagH = tagSize + tagSize * 0.95;
    const dotR = tagH * 0.16;
    const chip = new Container();
    chip.position.set(safe.x + tagW / 2 + minDim * 0.01, safe.y + tagH / 2 + minDim * 0.01);
    chip.scale.set(0);
    root.addChild(chip);
    chip.addChild(new Graphics().roundRect(-tagW / 2, -tagH / 2, tagW, tagH, tagH / 2).fill(accent));
    chip.addChild(new Graphics().circle(-tagW / 2 + tagH * 0.5, 0, dotR).fill(onAccent));
    const tagText = makeText(fonts, { text: tag, role: "body", weight: 700, size: tagSize, color: onAccent, anchor: { x: 0, y: 0.5 } });
    tagText.position.set(-tagW / 2 + tagH * 0.5 + dotR + tagSize * 0.4, 0);
    chip.addChild(tagText);
    timeline
      .to(chip, { prop: "scale.x", from: 0, to: 1, start: 0.75, duration: 0.5, ease: spring(0.46) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start: 0.75, duration: 0.5, ease: spring(0.46) });
  }

  return { timeline, duration: 3.8 };
}

export const greenScreen: TemplateDefinition = {
  id: "green-screen",
  name: "Green Screen",
  tagline: "A green-screen frame: a silhouette rises over a swappable backdrop with a caption.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { caption: "display", tag: "body" },
  palettes: PALETTES,
  fields: [
    { key: "caption", type: "text", label: "Caption", default: "wait for it...", maxLength: 40, shrinkToFit: true },
    { key: "tag", type: "text", label: "Tag text", default: "Green Screen", maxLength: 18, shrinkToFit: true },
    { key: "showTag", type: "toggle", label: "Green Screen tag", default: true },
    { key: "background", type: "color", label: "Backdrop", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Tag color", default: "", optional: true },
  ],
  build,
};
