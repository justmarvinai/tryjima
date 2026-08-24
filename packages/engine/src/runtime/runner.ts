import { Texture, type Container } from "pixi.js";
import type { Aspect } from "../layout/aspect";
import { sizeOf, type Size } from "../layout/aspect";
import { createRng } from "../timeline/rng";
import type { JimaTimeline } from "../timeline/timeline";
import type { FontRegistry } from "../text/fonts";
import { createDefaultFontRegistry } from "../text/fonts";
import { isImageRef, resolveValues, type Palette, type TemplateDefinition, type Values } from "../sdk/types";
import { SceneRenderer, createRoot } from "./stage";

type ImageMap = Record<string, Texture | null>;

async function loadImages(
  def: TemplateDefinition,
  values: Values,
): Promise<{ map: ImageMap; bitmaps: ImageBitmap[] }> {
  const map: ImageMap = {};
  const bitmaps: ImageBitmap[] = [];
  const jobs = def.fields
    .filter((f) => f.type === "image")
    .map(async (f) => {
      const v = values[f.key];
      if (isImageRef(v)) {
        try {
          const res = await fetch(v.url);
          const bmp = await createImageBitmap(await res.blob());
          bitmaps.push(bmp);
          map[f.key] = Texture.from(bmp);
        } catch {
          map[f.key] = null;
        }
      } else {
        map[f.key] = null;
      }
    });
  await Promise.all(jobs);
  return { map, bitmaps };
}

export interface RunnerConfig {
  aspect: Aspect;
  values?: Values;
  paletteId?: string;
  seed?: number;
  resolution?: number;
  fonts?: FontRegistry;
  /** Clear the canvas with alpha 0 (for transparent/alpha WebM export). */
  transparent?: boolean;
  /**
   * Motion energy, 0–2 (1 = as authored). Scales every ease's character and how
   * far things travel, without changing timing. See
   * {@link JimaTimeline.applyEnergy}.
   */
  energy?: number;
  /** Seconds cut off the front — the output starts at this point in the timeline. */
  trim?: number;
  /** Seconds the final frame is held after the timeline ends. */
  hold?: number;
}

/** Output length once the front is trimmed and the tail is held. */
export function outputDuration(timelineDuration: number, trim: number, hold: number): number {
  return Math.max(0.1, timelineDuration - Math.min(trim, timelineDuration) + hold);
}

/** Energy → the two gains {@link JimaTimeline.applyEnergy} takes. */
export function energyGains(energy: number | undefined): { ease: number; travel: number } {
  const e = Math.max(0, Math.min(2, energy ?? 1));
  // Travel is deliberately gentler than ease: at zero energy things should
  // arrive from closer in, not teleport into place with no movement at all.
  return { ease: e, travel: 0.55 + 0.45 * e };
}

/** Every user-supplied string in a value bag, concatenated. */
function textOf(values: Values): string {
  const parts: string[] = [];
  for (const v of Object.values(values)) {
    if (typeof v === "string") parts.push(v);
    else if (Array.isArray(v)) for (const item of v) if (typeof item === "string") parts.push(item);
  }
  return parts.join(" ");
}

function pickPalette(def: TemplateDefinition, id?: string): Palette {
  if (id) {
    const found = def.palettes.find((p) => p.id === id);
    if (found) return found;
  }
  const first = def.palettes[0];
  if (!first) throw new Error(`Template "${def.id}" declares no palettes`);
  return first;
}

/**
 * A built, seekable template instance bound to a renderer. `renderAt(t)` is a
 * pure function of t (the timeline is stateless), so preview, golden frames and
 * export all drive it the same way and get identical pixels.
 *
 * `rebuildScene` rebuilds the scene graph in place (same renderer/canvas/aspect)
 * for live editing — cheap enough for per-keystroke value changes.
 */
export class TemplateRunner {
  readonly def: TemplateDefinition;
  readonly aspect: Aspect;
  readonly size: Size;
  root: Container;
  timeline: JimaTimeline;
  /**
   * Output length in seconds — what the player and the exporter count in. With
   * trim/hold at their defaults this is exactly the timeline's own length.
   */
  duration: number;
  /** The template's own length, before trim and hold. */
  timelineDuration: number;
  /** Seconds cut off the front. */
  readonly trim: number;
  /** Seconds the last frame is held on the end. */
  readonly hold: number;
  private update: ((t: number) => void) | undefined;
  private images: ImageMap;
  private readonly imageBitmaps: ImageBitmap[];
  private readonly scene: SceneRenderer;
  private readonly fonts: FontRegistry;
  private readonly seed: number;
  private readonly energy: number | undefined;
  private lastT = 0;

  private constructor(args: {
    def: TemplateDefinition;
    aspect: Aspect;
    size: Size;
    root: Container;
    timeline: JimaTimeline;
    duration: number;
    update: ((t: number) => void) | undefined;
    images: ImageMap;
    imageBitmaps: ImageBitmap[];
    scene: SceneRenderer;
    fonts: FontRegistry;
    seed: number;
    energy: number | undefined;
    trim: number;
    hold: number;
  }) {
    this.def = args.def;
    this.aspect = args.aspect;
    this.size = args.size;
    this.root = args.root;
    this.timeline = args.timeline;
    this.trim = args.trim;
    this.hold = args.hold;
    this.timelineDuration = args.duration;
    this.duration = outputDuration(args.duration, args.trim, args.hold);
    this.update = args.update;
    this.images = args.images;
    this.imageBitmaps = args.imageBitmaps;
    this.scene = args.scene;
    this.fonts = args.fonts;
    this.seed = args.seed;
    this.energy = args.energy;
  }

  static async create(def: TemplateDefinition, config: RunnerConfig): Promise<TemplateRunner> {
    const aspect = config.aspect;
    const size = sizeOf(aspect);
    const fonts = config.fonts ?? createDefaultFontRegistry();
    await fonts.ensureAll();

    const seed = config.seed ?? 0x1a1a;
    const energy = config.energy;
    const trim = Math.max(0, config.trim ?? 0);
    const hold = Math.max(0, config.hold ?? 0);
    const resolved = resolveValues(def, config.values);
    // Emoji live in user text, so the face they need can only be known here —
    // after the values are resolved and before the first frame is painted.
    await fonts.ensureEmoji(textOf(resolved));
    const { map: images, bitmaps: imageBitmaps } = await loadImages(def, resolved);
    const built = buildScene(def, {
      size,
      aspect,
      values: config.values,
      paletteId: config.paletteId,
      fonts,
      seed,
      images,
      energy,
    });

    const scene = await SceneRenderer.create({
      size,
      resolution: config.resolution ?? 1,
      background: "#ffffff",
      ...(config.transparent ? { backgroundAlpha: 0 } : {}),
    });

    const runner = new TemplateRunner({
      def,
      aspect,
      size,
      root: built.root,
      timeline: built.timeline,
      duration: built.duration,
      update: built.update,
      images,
      imageBitmaps,
      scene,
      fonts,
      seed,
      energy,
      trim,
      hold,
    });
    scene.onContextLost(() => runner.renderAt(runner.lastT));
    return runner;
  }

  get canvas(): HTMLCanvasElement {
    return this.scene.canvas;
  }

  /**
   * Rebuild the scene graph with new values/palette (same renderer + aspect).
   * Reuses already-loaded image textures — add/remove of an image should go
   * through a full recreate (the editor keys the preview on image changes).
   */
  /**
   * Load any emoji face the new values need. Call before {@link rebuildScene}
   * when text may have changed — it is async, and rebuilding is not.
   */
  async ensureFontsFor(values?: Values): Promise<void> {
    await this.fonts.ensureEmoji(textOf(resolveValues(this.def, values)));
  }

  rebuildScene(values?: Values, paletteId?: string): void {
    // Build the new scene BEFORE tearing down the current one. If buildScene
    // throws on a transient bad value (e.g. a half-typed hex color reaching a
    // template's .fill()), the live root is left intact showing the last good
    // frame instead of being destroyed — the error propagates to the caller.
    const built = buildScene(this.def, {
      size: this.size,
      aspect: this.aspect,
      values,
      paletteId,
      fonts: this.fonts,
      seed: this.seed,
      images: this.images,
      energy: this.energy,
    });
    this.root.destroy({ children: true });
    this.root = built.root;
    this.timeline = built.timeline;
    this.timelineDuration = built.duration;
    this.duration = outputDuration(built.duration, this.trim, this.hold);
    this.update = built.update;
    this.renderAt(Math.min(this.lastT, this.duration));
  }

  /** Change render resolution in place (e.g. on preview container resize). */
  resize(resolution: number): void {
    this.scene.resize(this.size, resolution);
    this.renderAt(this.lastT);
  }

  /**
   * Map an **output** time to a timeline time.
   *
   * Trim slides the window forward; hold clamps at the end so the final frame
   * simply persists. Everything downstream — the player, the export loops, the
   * scrubber — counts in output time and never needs to know either exists.
   */
  timelineTime(outputT: number): number {
    return Math.min(this.timelineDuration, Math.max(0, this.trim + outputT));
  }

  /** Evaluate at output time t (seconds) and paint one frame. */
  renderAt(t: number): void {
    this.lastT = t;
    const tt = this.timelineTime(t);
    this.timeline.evaluate(tt);
    this.update?.(tt);
    this.scene.render(this.root);
  }

  /**
   * Paint one frame with synthetic motion blur: the average of `samples` poses
   * spread evenly across a shutter window centred on `t`.
   *
   * This is only possible because the timeline is a pure `f(t)` — there is no
   * per-frame state to rewind, so a sub-frame is just another evaluation. A
   * 180° shutter (`shutter` = half the frame interval) is the film default and
   * is what makes fast whooshes and spins stop strobing.
   */
  renderBlurredAt(t: number, samples: number, shutter: number): void {
    const n = Math.max(1, Math.round(samples));
    this.lastT = t;
    this.scene.renderAveraged(this.root, n, (i) => {
      // Centred box filter over the shutter, sampled at bin centres.
      const offset = shutter > 0 ? ((i + 0.5) / n - 0.5) * shutter : 0;
      const sub = this.timelineTime(Math.min(this.duration, Math.max(0, t + offset)));
      this.timeline.evaluate(sub);
      this.update?.(sub);
    });
  }

  destroy(): void {
    this.scene.destroy();
    this.root.destroy({ children: true });
    // Free decoded image resources: destroy the image textures (their sources
    // aren't freed by root.destroy) and close the ImageBitmaps so a long Studio
    // session that repeatedly rebuilds image templates doesn't accumulate them.
    for (const key of Object.keys(this.images)) this.images[key]?.destroy(true);
    for (const bmp of this.imageBitmaps) bmp.close();
  }
}

function buildScene(
  def: TemplateDefinition,
  args: {
    size: Size;
    aspect: Aspect;
    values?: Values | undefined;
    paletteId?: string | undefined;
    fonts: FontRegistry;
    seed: number;
    images: ImageMap;
    energy?: number | undefined;
  },
): { root: Container; timeline: JimaTimeline; duration: number; update: ((t: number) => void) | undefined } {
  const values = resolveValues(def, args.values);
  const palette = pickPalette(def, args.paletteId);
  const root = createRoot();
  const built = def.build({
    root,
    aspect: args.aspect,
    size: args.size,
    values,
    palette,
    rng: createRng(args.seed),
    fonts: args.fonts,
    images: args.images,
  });
  // Energy reshapes the finished timeline rather than asking 495 templates to
  // implement it: the transform only touches ease curves and start values, so
  // every template gets it for free and none of them can get it wrong.
  const gains = energyGains(args.energy);
  built.timeline.applyEnergy(gains.ease, gains.travel);
  return {
    root,
    timeline: built.timeline,
    duration: built.duration ?? built.timeline.duration,
    update: built.update,
  };
}
