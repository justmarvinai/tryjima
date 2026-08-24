import { autoDetectRenderer, Container, RenderTexture, Sprite, type Renderer } from "pixi.js";
import type { Size } from "../layout/aspect";

export interface SceneRendererOptions {
  size: Size;
  /** Device/exports scale. Preview clamps to ≤2; export sets exact output scale. */
  resolution?: number;
  background?: string | number;
  backgroundAlpha?: number;
  antialias?: boolean;
}

/**
 * Owns a Pixi WebGL renderer and renders a scene deterministically.
 *
 * WebGL is forced (not WebGPU): its readback is synchronous and consistent
 * across devices, which matters for golden frames and export (ADR-004). Render
 * happens on demand — there is no Ticker — so a given (scene, t) always paints
 * identical pixels.
 */
export class SceneRenderer {
  readonly renderer: Renderer;
  private lostHandler: (() => void) | null = null;
  private accum: AccumTargets | null = null;

  private constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  static async create(opts: SceneRendererOptions): Promise<SceneRenderer> {
    const resolution = opts.resolution ?? 1;
    const renderer = await autoDetectRenderer({
      preference: "webgl",
      width: opts.size.width,
      height: opts.size.height,
      resolution,
      autoDensity: false,
      background: opts.background ?? "#ffffff",
      backgroundAlpha: opts.backgroundAlpha ?? 1,
      antialias: opts.antialias ?? true,
      clearBeforeRender: true,
      // Keep the drawn buffer readable so the exporter can capture each frame
      // (VideoFrame-from-canvas / 2D readback) reliably after render.
      preserveDrawingBuffer: true,
    });
    return new SceneRenderer(renderer);
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.canvas as HTMLCanvasElement;
  }

  resize(size: Size, resolution?: number): void {
    if (resolution !== undefined) this.renderer.resolution = resolution;
    this.renderer.resize(size.width, size.height);
    // The blur targets are sized in device pixels; a resize invalidates them.
    this.disposeAccum();
  }

  render(root: Container): void {
    this.renderer.render(root);
  }

  /**
   * Render `count` sub-frames and paint their **average** to the canvas —
   * synthetic motion blur. `drawSubframe(i)` must pose the scene for sub-frame i.
   *
   * The average is accumulated with an incremental mean: sub-frame `i` is
   * composited at alpha `1/(i+1)`, and `(1-a)·dst + a·src` with that schedule is
   * exactly the running mean. Each sub-frame goes to an offscreen target first
   * and is then blitted as a single sprite, because a Container's `alpha`
   * multiplies each *child* separately — group opacity is what the average needs,
   * and doing it per-child would blend overlapping elements into each other.
   *
   * Premultiplied alpha means this holds for the transparent-export path too:
   * colour and alpha both come out as the mean across the shutter window.
   */
  renderAveraged(root: Container, count: number, drawSubframe: (i: number) => void): void {
    if (count <= 1) {
      drawSubframe(0);
      this.renderer.render(root);
      return;
    }
    const t = this.ensureAccum();
    for (let i = 0; i < count; i++) {
      drawSubframe(i);
      this.renderer.render({ container: root, target: t.frame, clear: true });
      t.frameSprite.alpha = 1 / (i + 1);
      this.renderer.render({ container: t.frameSprite, target: t.accum, clear: i === 0 });
    }
    this.renderer.render({ container: t.accumSprite, clear: true });
  }

  private ensureAccum(): AccumTargets {
    const width = this.renderer.width;
    const height = this.renderer.height;
    const resolution = this.renderer.resolution;
    if (this.accum && this.accum.width === width && this.accum.height === height) return this.accum;
    this.disposeAccum();
    const make = (): RenderTexture =>
      RenderTexture.create({ width, height, resolution, antialias: false });
    const frame = make();
    const accum = make();
    const frameSprite = new Sprite(frame);
    const accumSprite = new Sprite(accum);
    this.accum = { width, height, frame, accum, frameSprite, accumSprite };
    return this.accum;
  }

  private disposeAccum(): void {
    if (!this.accum) return;
    this.accum.frameSprite.destroy();
    this.accum.accumSprite.destroy();
    this.accum.frame.destroy(true);
    this.accum.accum.destroy(true);
    this.accum = null;
  }

  /**
   * Wire context-loss recovery. The GL context holds no state we can't rebuild
   * from the store, so on restore the caller just re-renders the current frame.
   */
  onContextLost(reRender: () => void): void {
    const canvas = this.canvas;
    this.lostHandler = () => {
      // Give the driver a tick, then repaint from application state.
      queueMicrotask(reRender);
    };
    canvas.addEventListener("webglcontextrestored", this.lostHandler);
  }

  destroy(): void {
    if (this.lostHandler) {
      this.canvas.removeEventListener("webglcontextrestored", this.lostHandler);
      this.lostHandler = null;
    }
    this.disposeAccum();
    this.renderer.destroy();
  }
}

/** Offscreen targets for {@link SceneRenderer.renderAveraged}, built on demand. */
interface AccumTargets {
  width: number;
  height: number;
  frame: RenderTexture;
  accum: RenderTexture;
  frameSprite: Sprite;
  accumSprite: Sprite;
}

/** A fresh empty root container for a scene. */
export function createRoot(): Container {
  const root = new Container();
  root.label = "jima-root";
  return root;
}
