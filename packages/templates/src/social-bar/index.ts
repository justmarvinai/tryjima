import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  makeOutBack,
  safeZone,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon, type IconName, ICON_NAMES } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

/** Largest size <= size0 at which `text` fits `maxWidth` (crisp, single-line). */
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
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

const ICON_SET = new Set<string>(ICON_NAMES);
const DEFAULT_ICONS: IconName[] = ["play", "heart", "bookmark"];

interface HandleEntry {
  icon: IconName | null;
  handle: string;
}

/** Parse "icon|@handle" or plain "@handle"; auto-assigns an icon by index. */
function parseHandle(raw: string, index: number): HandleEntry {
  const parts = raw.split("|").map((s) => s.trim());
  let icon: IconName | null = DEFAULT_ICONS[index % DEFAULT_ICONS.length] ?? "play";
  let handle = raw.trim();
  if (parts.length >= 2 && parts[0] && ICON_SET.has(parts[0])) {
    icon = parts[0] as IconName;
    handle = (parts[1] ?? "").trim();
  }
  if (handle.length === 0) handle = "@handle";
  if (!handle.startsWith("@")) handle = `@${handle}`;
  return { icon, handle };
}

const DEFAULT_HANDLES = ["@ourchannel", "@ourbrand", "@ourshop"];

// A "Follow along" lower bar: a prompt over a centered row of platform handle
// chips that stagger in. Only the full-frame `bg` rect is tied to the
// background field (blanked by transparent export); each chip uses its own
// palette-only `cardBg` (with a soft shadow) so the row survives as overlay
// content over footage.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#EEF1F6", cardBg: "#FFFFFF", textColor: "#0B0B0F", accent: "#2E5BD6" } },
  { id: "mint", name: "Mint", colors: { background: "#E7F5EE", cardBg: "#FFFFFF", textColor: "#0B1F16", accent: "#046A4E" } },
  { id: "sunset", name: "Sunset", colors: { background: "#FFF1E8", cardBg: "#FFFFFF", textColor: "#2A1408", accent: "#D2551A" } },
  { id: "grape", name: "Grape", colors: { background: "#140C22", cardBg: "#241633", textColor: "#FFFFFF", accent: "#C4A0FF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF1F6"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#0B0B0F"));
  const accent = str(values.accent, pc("accent", "#2E5BD6"));

  const prompt = str(values.prompt, "Follow along");
  const showIcons = values.showIcons !== false;
  const handles = asList(values.handles, DEFAULT_HANDLES).slice(0, 3).map(parseHandle);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const innerW = w - zone.left - zone.right;

  // --- Chip metrics (shrink handle text so the whole row fits the frame). ---
  const chipPadX = Math.round(minDim * 0.022);
  const chipH = Math.round(minDim * 0.066);
  const iconSize = showIcons ? Math.round(chipH * 0.42) : 0;
  const iconGap = showIcons ? Math.round(minDim * 0.012) : 0;
  const chipGap = Math.round(minDim * 0.018);
  const n = handles.length;

  // Budget per-chip handle width so n chips + gaps fit innerW.
  const rowBudget = innerW * 0.98;
  const fixedPerChip = chipPadX * 2 + (showIcons ? iconSize + iconGap : 0);
  const availTextTotal = rowBudget - n * fixedPerChip - (n - 1) * chipGap;
  const perChipTextMax = Math.max(48, availTextTotal / n);

  const handleSize0 = Math.round(minDim * 0.026);
  const handleSize = handles.reduce(
    (acc, hnd) => Math.min(acc, fitSize(fonts, hnd.handle, "body", 600, handleSize0, perChipTextMax)),
    handleSize0,
  );

  interface Chip {
    node: Container;
    width: number;
  }
  const chips: Chip[] = handles.map((hnd) => {
    const handleW = fonts.measure(hnd.handle, { family: fonts.family("body"), weight: 600, size: handleSize });
    const chipW = chipPadX * 2 + (showIcons ? iconSize + iconGap : 0) + handleW;

    const node = new Container();
    const e = Math.round(chipH * 0.04);
    const off = Math.round(chipH * 0.06);
    const radius = chipH / 2;
    node.addChild(
      new Graphics()
        .roundRect(-chipW / 2 - e, -chipH / 2 - e + off, chipW + e * 2, chipH + e * 2, radius + e)
        .fill({ color: "#000000", alpha: 0.14 }),
    );
    node.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, radius).fill(cardBg));

    let inner = -chipW / 2 + chipPadX;
    if (showIcons && hnd.icon) {
      const icon = makeIcon(hnd.icon, iconSize, { color: accent, holeColor: cardBg });
      icon.position.set(inner + iconSize / 2, 0);
      node.addChild(icon);
      inner += iconSize + iconGap;
    }
    const handleText = makeText(fonts, {
      text: hnd.handle,
      role: "body",
      weight: 600,
      size: handleSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    handleText.position.set(inner, 0);
    node.addChild(handleText);

    return { node, width: chipW };
  });

  // --- Prompt (centered, above the chip row). ---
  const promptSize = fitSize(fonts, prompt, "display", 700, Math.round(minDim * 0.036), innerW * 0.9);
  const promptText = makeText(fonts, {
    text: prompt,
    role: "display",
    weight: 700,
    size: promptSize,
    color: textColor,
    anchor: 0.5,
    align: "center",
  });

  // --- Vertical stack, anchored to the lower area, centered horizontally. ---
  const rowGap = Math.round(minDim * 0.028);
  const marginBottom = Math.round(minDim * 0.04);
  const rowCenterY = h - zone.bottom - marginBottom - chipH / 2;
  const promptY = rowCenterY - chipH / 2 - rowGap - promptSize / 2;

  promptText.position.set(cx, promptY + minDim * 0.02);
  promptText.alpha = 0;
  root.addChild(promptText);
  timeline
    .to(promptText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outExpo })
    .to(promptText, { prop: "y", from: promptY + minDim * 0.02, to: promptY, start: 0, duration: 0.5, ease: outExpo });

  const totalRowW = chips.reduce((s, c) => s + c.width, 0) + (n - 1) * chipGap;
  let x = cx - totalRowW / 2;
  chips.forEach((c, i) => {
    const chipCX = x + c.width / 2;
    c.node.position.set(chipCX, rowCenterY);
    c.node.scale.set(0);
    root.addChild(c.node);
    const start = 0.32 + i * 0.12;
    timeline
      .to(c.node, { prop: "scale.x", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(1.8) })
      .to(c.node, { prop: "scale.y", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(1.8) });
    x += c.width + chipGap;
  });

  return { timeline, duration: 4.0 };
}

export const socialBar: TemplateDefinition = {
  id: "social-bar",
  name: "Social Bar",
  tagline: "A follow-along prompt over a row of handle chips that stagger in.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { prompt: "display", handles: "body" },
  palettes: PALETTES,
  fields: [
    { key: "prompt", type: "text", label: "Prompt", default: "Follow along", maxLength: 28, shrinkToFit: true },
    {
      key: "handles",
      type: "textlist",
      label: "Handles",
      default: DEFAULT_HANDLES,
      minItems: 2,
      maxItems: 3,
      maxLength: 22,
      help: 'One per line, e.g. "@yourhandle". Optionally prefix an icon: "heart|@yourhandle".',
    },
    { key: "showIcons", type: "toggle", label: "Chip icons", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
