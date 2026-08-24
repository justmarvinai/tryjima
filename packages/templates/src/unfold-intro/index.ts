import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outQuint,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

// A letter folded in thirds unfolds downward panel by panel: each panel hinges
// open (scaleY from its top edge) while its shading lightens, the title prints
// on the middle panel as it opens, and the flattened sheet settles to a hold.
// The title always sits on the light paper (>= 4.5:1 in every palette).
const PALETTES: Palette[] = [
  { id: "linen", name: "Linen", colors: { background: "#EFE9DF", paper: "#FDFBF4", textColor: "#2A2118", accent: "#C2603B" } },
  { id: "airmail", name: "Airmail", colors: { background: "#E7EFF9", paper: "#FFFFFF", textColor: "#142A44", accent: "#2E6FD8" } },
  { id: "sage", name: "Sage", colors: { background: "#E9F1E8", paper: "#FAFDF6", textColor: "#1E2C1E", accent: "#4A8F5D" } },
  { id: "midnight-desk", name: "Midnight desk", colors: { background: "#171420", paper: "#272134", textColor: "#F5F0E6", accent: "#E5B54A" } },
];

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.052 : aspect === "9:16" ? 0.07 : 0.062;
}

const OPEN2 = 0.75; // middle panel unfolds
const OPEN3 = 1.55; // bottom panel unfolds
const OPEN_DUR = 0.7;
const DURATION = 4.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EFE9DF"));
  const paper = str(values.paperColor, pc("paper", "#FDFBF4"));
  const textColor = str(values.textColor, pc("textColor", "#2A2118"));
  const accent = str(values.accent, pc("accent", "#C2603B"));
  const title = str(values.title, "Dear Friends");
  const subtitle = str(values.subtitle, "you're warmly invited");
  const showLetterhead = on(values.showLetterhead);
  const showCrease = on(values.showCrease);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const sheetW = zone.width * (ctx.aspect === "16:9" ? 0.56 : 0.84);
  const sheetH = Math.min(zone.height * 0.88, sheetW * 1.3);
  const panelH = sheetH / 3;
  const sheetTop = zone.y + (zone.height - sheetH) / 2;

  // Letter container, pivoted at the sheet center so the settle scales evenly.
  const letter = new Container();
  letter.position.set(cx, sheetTop + sheetH / 2);
  letter.pivot.set(0, sheetH / 2);
  letter.alpha = 0;
  root.addChild(letter);
  timeline
    .to(letter, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.35, ease: outQuad })
    .to(letter, { prop: "position.y", from: sheetTop + sheetH / 2 - 36, to: sheetTop + sheetH / 2, start: 0.1, duration: 0.5, ease: outQuint });

  // Full-sheet shadow, revealed once the letter lies flat.
  const e = minDim * 0.018;
  const sheetShadow = new Graphics()
    .roundRect(-sheetW / 2 - e, -e * 0.2, sheetW + 2 * e, sheetH + e * 1.6, e)
    .fill({ color: "#000000", alpha: 0.12 });
  sheetShadow.alpha = 0;
  letter.addChild(sheetShadow);
  timeline.to(sheetShadow, { prop: "alpha", from: 0, to: 1, start: 2.3, duration: 0.35, ease: outQuad });

  // --- Top panel (already open) with letterhead accents ---
  const panel1 = new Container();
  letter.addChild(panel1);
  panel1.addChild(new Graphics().rect(-sheetW / 2, 0, sheetW, panelH).fill(paper));
  if (showLetterhead) {
    const pad = sheetW * 0.09;
    const seal = new Graphics()
      .circle(sheetW / 2 - pad - panelH * 0.16, panelH * 0.42, panelH * 0.16)
      .fill({ color: accent, alpha: 0.92 })
      .circle(sheetW / 2 - pad - panelH * 0.16, panelH * 0.42, panelH * 0.1)
      .stroke({ color: "#FFFFFF", alpha: 0.7, width: 3 });
    panel1.addChild(seal);
    panel1.addChild(
      new Graphics()
        .roundRect(-sheetW / 2 + pad, panelH * 0.3, sheetW * 0.3, panelH * 0.055, panelH * 0.028)
        .fill({ color: "#000000", alpha: 0.12 })
        .roundRect(-sheetW / 2 + pad, panelH * 0.44, sheetW * 0.22, panelH * 0.055, panelH * 0.028)
        .fill({ color: "#000000", alpha: 0.08 }),
    );
  }

  // Folded-stack hint: the closed panels' paper edges under the top panel.
  const edge = Math.max(4, panelH * 0.02);
  const hint = new Graphics()
    .rect(-sheetW / 2, panelH, sheetW, edge)
    .fill(paper)
    .rect(-sheetW / 2, panelH, sheetW, edge)
    .fill({ color: "#000000", alpha: 0.1 })
    .rect(-sheetW / 2, panelH + edge, sheetW, edge)
    .fill(paper)
    .rect(-sheetW / 2, panelH + edge, sheetW, edge)
    .fill({ color: "#000000", alpha: 0.2 })
    .rect(-sheetW / 2, panelH + edge * 2, sheetW, edge * 1.6)
    .fill({ color: "#000000", alpha: 0.08 });
  letter.addChild(hint);
  timeline.to(hint, { prop: "alpha", from: 1, to: 0, start: OPEN2 + 0.05, duration: 0.3, ease: outQuad });

  // --- A hinged panel that unfolds downward (scaleY from its top edge) ---
  const makePanel = (hingeY: number, openAt: number): { panel: Container; shade: Graphics } => {
    const panel = new Container();
    panel.position.set(0, hingeY);
    panel.scale.y = 0;
    letter.addChild(panel);
    panel.addChild(new Graphics().rect(-sheetW / 2, 0, sheetW, panelH).fill(paper));
    if (showCrease) {
      panel.addChild(
        new Graphics()
          .moveTo(-sheetW / 2 + 6, 1.5)
          .lineTo(sheetW / 2 - 6, 1.5)
          .stroke({ color: "#000000", alpha: 0.12, width: 2 }),
      );
    }
    timeline.to(panel, { prop: "scale.y", from: 0, to: 1, start: openAt, duration: OPEN_DUR, ease: makeOutBack(1.12) });
    // Tone shading: dark while facing away, lightening as the panel opens.
    const shade = new Graphics().rect(-sheetW / 2, 0, sheetW, panelH).fill("#000000");
    shade.alpha = 0.42;
    timeline.to(shade, { prop: "alpha", from: 0.42, to: 0, start: openAt, duration: OPEN_DUR * 0.9, ease: outQuad });
    return { panel, shade };
  };

  // --- Middle panel: the title prints on it as it opens ---
  const p2 = makePanel(panelH, OPEN2);
  const pad2 = sheetW * 0.09;
  const titleSize = fitSize(
    fonts,
    title,
    "display",
    700,
    Math.round(Math.min(panelH * 0.42, w * titleFrac(ctx.aspect))),
    sheetW - 2 * pad2,
  );
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(0, panelH / 2);
  titleText.alpha = 0;
  p2.panel.addChild(titleText);
  timeline.to(titleText, { prop: "alpha", from: 0, to: 1, start: OPEN2 + 0.27, duration: 0.45, ease: outQuad });
  p2.panel.addChild(p2.shade);

  // --- Bottom panel: accent rule + optional subtitle ---
  const p3 = makePanel(panelH * 2, OPEN3);
  const hasSub = subtitle.length > 0;
  const subSize = Math.max(18, Math.round(titleSize * 0.3));
  const ruleH = Math.max(4, Math.round(minDim * 0.005));
  const blockH = hasSub ? ruleH + subSize * 0.8 + subSize : ruleH;
  const ruleY = panelH / 2 - blockH / 2 + ruleH / 2;
  p3.panel.addChild(new Graphics().roundRect(-sheetW * 0.07, ruleY - ruleH / 2, sheetW * 0.14, ruleH, ruleH / 2).fill(accent));
  if (hasSub) {
    const subFit = fitSize(fonts, subtitle, "body", 500, subSize, sheetW - 2 * pad2);
    const subY = ruleY + ruleH / 2 + subSize * 0.8 + subSize / 2;
    const subText = makeText(fonts, { text: subtitle, role: "body", weight: 500, size: subFit, color: textColor, anchor: 0.5, align: "center", letterSpacing: 1 });
    subText.position.set(0, subY);
    subText.alpha = 0;
    p3.panel.addChild(subText);
    timeline.to(subText, { prop: "alpha", from: 0, to: 0.85, start: OPEN3 + 0.4, duration: 0.4, ease: outQuad });
  }
  p3.panel.addChild(p3.shade);

  // --- Final flatten: a gentle settle once the sheet lies flat ---
  timeline
    .to(letter, { prop: "scale.x", from: 1, to: 1.012, start: 2.4, duration: 0.14, ease: outQuad })
    .to(letter, { prop: "scale.x", from: 1.012, to: 1, start: 2.54, duration: 0.26, ease: outQuad })
    .to(letter, { prop: "scale.y", from: 1, to: 1.012, start: 2.4, duration: 0.14, ease: outQuad })
    .to(letter, { prop: "scale.y", from: 1.012, to: 1, start: 2.54, duration: 0.26, ease: outQuad });

  return { timeline, duration: DURATION };
}

export const unfoldIntro: TemplateDefinition = {
  id: "unfold-intro",
  name: "Unfold Intro",
  tagline: "A folded letter unfolds panel by panel to present your title.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.2,
  fontRoles: { title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Dear Friends", maxLength: 26, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "you're warmly invited", maxLength: 44, optional: true, shrinkToFit: true },
    { key: "showLetterhead", type: "toggle", label: "Letterhead accents", default: true },
    { key: "showCrease", type: "toggle", label: "Fold creases", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
    { key: "paperColor", type: "color", label: "Paper", default: "", optional: true },
  ],
  build,
};
