import { Graphics, Container } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  spring,
  shrinkToFit,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { groupThousands, parseTargetNumber } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
  { id: "dark", name: "Dark", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF4FF", textColor: "#0B2447", accent: "#2E7DF6", onAccent: "#FFFFFF" } },
  { id: "grape-night", name: "Grape night", colors: { background: "#14101F", textColor: "#FFFFFF", accent: "#7C5CFF", onAccent: "#FFFFFF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const showIcon = values.showIcon !== false;
  const label = str(values.label, "followers");
  const target = parseTargetNumber(str(values.target, "12,400"));
  const targetStr = groupThousands(target);

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const minDim = Math.min(size.width, size.height);
  const safe = safeRect(ctx.aspect);
  const cx = size.width / 2;

  const familyDisplay = fonts.family("display");
  const measureNum = (s: string, sz: number): number => fonts.measure(s, { family: familyDisplay, weight: 700, size: sz });
  const familyBody = fonts.family("body");
  const measureLabel = (s: string, sz: number): number => fonts.measure(s, { family: familyBody, weight: 600, size: sz });

  const discR = Math.round(minDim * 0.125);
  const numberFontBase = Math.round(minDim * 0.16);
  const numberFont = shrinkToFit(targetStr, measureNum, { maxWidth: safe.width * 0.86, baseSize: numberFontBase, minSize: Math.round(numberFontBase * 0.4) });
  const labelFontBase = Math.round(numberFont * 0.3);
  const labelFont = shrinkToFit(label, measureLabel, { maxWidth: safe.width * 0.86, baseSize: labelFontBase, minSize: Math.round(labelFontBase * 0.5) });

  const gapIconNum = Math.round(minDim * 0.045);
  const gapNumLabel = Math.round(numberFont * 0.24);
  const numberH = numberFont * 1.05;
  const labelH = labelFont * 1.2;
  const iconBlockH = showIcon ? discR * 2 + gapIconNum : 0;
  const totalH = iconBlockH + numberH + gapNumLabel + labelH;
  const top = safe.y + safe.height / 2 - totalH / 2;

  let cursorY = top;
  const iconCenterY = cursorY + discR;
  if (showIcon) cursorY += discR * 2 + gapIconNum;
  const numberCenterY = cursorY + numberH / 2;
  cursorY += numberH + gapNumLabel;
  const labelCenterY = cursorY + labelH / 2;

  if (showIcon) {
    const disc = new Container();
    disc.addChild(new Graphics().circle(0, 0, discR).fill(accent));
    disc.addChild(makeIcon("user", discR * 1.15, { color: onAccent }));
    disc.position.set(cx, iconCenterY);
    disc.scale.set(0);
    root.addChild(disc);
    timeline
      .to(disc, { prop: "scale.x", from: 0, to: 1, start: 0.1, duration: 0.7, ease: spring(0.45) })
      .to(disc, { prop: "scale.y", from: 0, to: 1, start: 0.1, duration: 0.7, ease: spring(0.45) });
  }

  const numberText = makeText(fonts, { text: groupThousands(0), role: "display", weight: 700, size: numberFont, color: textColor, anchor: 0.5 });
  numberText.position.set(cx, numberCenterY);
  numberText.alpha = 0;
  numberText.scale.set(0.85);
  root.addChild(numberText);
  const numStart = showIcon ? 0.3 : 0.15;
  timeline
    .to(numberText, { prop: "alpha", from: 0, to: 1, start: numStart, duration: 0.4, ease: outQuad })
    .to(numberText, { prop: "scale.x", from: 0.85, to: 1, start: numStart, duration: 0.5, ease: outQuint })
    .to(numberText, { prop: "scale.y", from: 0.85, to: 1, start: numStart, duration: 0.5, ease: outQuint });

  // Count-up, landing with a small confirmation bounce.
  const COUNT_START = numStart + 0.2;
  const COUNT_END = 2.4;
  timeline
    .to(numberText, { prop: "scale.x", from: 1, to: 1.08, start: COUNT_END, duration: 0.14, ease: outQuad })
    .to(numberText, { prop: "scale.y", from: 1, to: 1.08, start: COUNT_END, duration: 0.14, ease: outQuad })
    .to(numberText, { prop: "scale.x", from: 1.08, to: 1, start: COUNT_END + 0.14, duration: 0.28, ease: outQuad })
    .to(numberText, { prop: "scale.y", from: 1.08, to: 1, start: COUNT_END + 0.14, duration: 0.28, ease: outQuad });

  const labelText = makeText(fonts, { text: label, role: "body", weight: 600, size: labelFont, color: textColor, anchor: 0.5, align: "center" });
  labelText.position.set(cx, labelCenterY + 14);
  labelText.alpha = 0;
  root.addChild(labelText);
  const labelStart = showIcon ? 0.5 : 0.35;
  timeline
    .to(labelText, { prop: "alpha", from: 0, to: 0.72, start: labelStart, duration: 0.45, ease: outQuad })
    .to(labelText, { prop: "y", from: labelCenterY + 14, to: labelCenterY, start: labelStart, duration: 0.55, ease: outExpo });

  const update = (t: number): void => {
    const u = t <= COUNT_START ? 0 : t >= COUNT_END ? 1 : (t - COUNT_START) / (COUNT_END - COUNT_START);
    const eased = 1 - Math.pow(1 - u, 3);
    numberText.text = groupThousands(Math.round(target * eased));
  };

  return { timeline, duration: 4.0, update };
}

export const followersCount: TemplateDefinition = {
  id: "followers-count",
  name: "Followers Count",
  tagline: "A follower count ticks up beside a user icon and label.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.0,
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Label", default: "followers", maxLength: 24, shrinkToFit: true },
    { key: "target", type: "text", label: "Target", default: "12,400", maxLength: 12, help: "Digits — counts up to this.", shrinkToFit: true },
    { key: "showIcon", type: "toggle", label: "Show icon", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
