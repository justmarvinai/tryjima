import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  shrinkToFit,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "peach", name: "Peach", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", card: "#F1F2F5", onAccent: "#FFFFFF" } },
  { id: "dark", name: "Dark", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF6A3D", card: "#1E1E24", onAccent: "#FFFFFF" } },
  { id: "grape", name: "Grape", colors: { background: "#F4EFFF", textColor: "#241052", accent: "#7C5CFF", card: "#FFFFFF", onAccent: "#FFFFFF" } },
  { id: "hot-pink", name: "Hot pink", colors: { background: "#1B0B14", textColor: "#FFFFFF", accent: "#FF2E9E", card: "#2B1220", onAccent: "#FFFFFF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const cardColor = pc("card", "#F1F2F5");
  const onAccent = pc("onAccent", "#FFFFFF");

  const header = str(values.header, "Ask me anything");
  const question = str(values.question, "What camera do you use?");
  const showCaret = values.showCaret !== false;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const minDim = Math.min(size.width, size.height);
  const safe = safeRect(ctx.aspect);
  const cx = size.width / 2;

  const clusterW = Math.min(safe.width * 0.94, minDim * 0.84);

  // --- Header pill sizing ---
  const headerFontBase = Math.round(minDim * 0.044);
  const headerMeasure = (s: string, sz: number): number => fonts.measure(s, { family: fonts.family("display"), weight: 700, size: sz });
  const headerSize = shrinkToFit(header, headerMeasure, { maxWidth: clusterW * 0.86, baseSize: headerFontBase, minSize: Math.round(headerFontBase * 0.6) });
  const headerPadY = Math.round(headerSize * 0.62);
  const headerH = headerSize + headerPadY * 2;
  const headerW = Math.min(headerMeasure(header, headerSize) + headerSize * 1.7, clusterW);

  // --- Input box sizing ---
  const boxPadX = Math.round(minDim * 0.045);
  const qFontBase = Math.round(minDim * 0.04);
  const qMeasure = (s: string, sz: number): number => fonts.measure(s, { family: fonts.family("body"), weight: 600, size: sz });
  const qSize = shrinkToFit(question, qMeasure, { maxWidth: clusterW - boxPadX * 2 - qFontBase, baseSize: qFontBase, minSize: Math.round(qFontBase * 0.55) });
  const boxH = Math.round(qSize * 2.6);
  const boxW = clusterW;
  const boxR = Math.round(boxH * 0.34);

  const gapHeaderBox = Math.round(minDim * 0.045);
  const totalH = headerH + gapHeaderBox + boxH;
  const top = safe.y + safe.height / 2 - totalH / 2;
  const headerCy = top + headerH / 2;
  const boxCy = top + headerH + gapHeaderBox + boxH / 2;

  // --- Header ---
  const headerC = new Container();
  headerC.addChild(new Graphics().roundRect(-headerW / 2, -headerH / 2, headerW, headerH, headerH / 2).fill(accent));
  headerC.addChild(makeText(fonts, { text: header, role: "display", weight: 700, size: headerSize, color: onAccent, anchor: 0.5, align: "center" }));
  headerC.position.set(cx, headerCy + 34);
  headerC.alpha = 0;
  headerC.scale.set(0.75);
  root.addChild(headerC);
  timeline
    .to(headerC, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.3, ease: outQuad })
    .to(headerC, { prop: "scale.x", from: 0.75, to: 1, start: 0.1, duration: 0.55, ease: spring(0.45) })
    .to(headerC, { prop: "scale.y", from: 0.75, to: 1, start: 0.1, duration: 0.55, ease: spring(0.45) })
    .to(headerC, { prop: "y", from: headerCy + 34, to: headerCy, start: 0.1, duration: 0.55, ease: outExpo });

  // --- Input box ---
  const boxC = new Container();
  boxC.addChild(new Graphics().roundRect(-boxW / 2, -boxH / 2, boxW, boxH, boxR).fill(cardColor));
  boxC.position.set(cx, boxCy + 30);
  boxC.alpha = 0;
  boxC.scale.set(0.85);
  root.addChild(boxC);
  const BOX_START = 0.4;
  timeline
    .to(boxC, { prop: "alpha", from: 0, to: 1, start: BOX_START, duration: 0.35, ease: outQuad })
    .to(boxC, { prop: "scale.x", from: 0.85, to: 1, start: BOX_START, duration: 0.5, ease: spring(0.45) })
    .to(boxC, { prop: "scale.y", from: 0.85, to: 1, start: BOX_START, duration: 0.5, ease: spring(0.45) })
    .to(boxC, { prop: "y", from: boxCy + 30, to: boxCy, start: BOX_START, duration: 0.5, ease: outExpo });

  // Typed question text (left-aligned; substring + caret glyph both driven by t).
  const textX = -boxW / 2 + boxPadX;
  const qNode = makeText(fonts, { text: "", role: "body", weight: 600, size: qSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  qNode.position.set(textX, 0);
  boxC.addChild(qNode);

  const TYPE_START = 0.85;
  const TYPE_BUDGET = 1.9;
  const speed = TYPE_BUDGET / Math.max(1, question.length);

  const update = (t: number): void => {
    const elapsed = t - TYPE_START;
    const shown = elapsed <= 0 ? 0 : Math.min(question.length, Math.floor(elapsed / speed));
    const blinkOn = showCaret && t >= BOX_START && t % 0.9 < 0.5;
    qNode.text = question.slice(0, shown) + (blinkOn ? "|" : "");
  };

  return { timeline, duration: 4.2, update };
}

export const qaBox: TemplateDefinition = {
  id: "qa-box",
  name: "Q&A Box",
  tagline: "An \"ask me anything\" sticker types out a question live.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { header: "display", question: "body" },
  palettes: PALETTES,
  fields: [
    { key: "header", type: "text", label: "Header", default: "Ask me anything", maxLength: 30, shrinkToFit: true },
    { key: "question", type: "text", label: "Question", default: "What camera do you use?", maxLength: 56, shrinkToFit: true },
    { key: "showCaret", type: "toggle", label: "Blinking caret", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
