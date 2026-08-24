import type { TemplateDefinition, Values } from "../sdk/types";
import type { Aspect } from "../layout/aspect";
import { TemplateRunner } from "./runner";

export interface PosterConfig {
  aspect: Aspect;
  values?: Values;
  paletteId?: string;
  seed?: number;
  /** Render scale for the thumbnail (default 0.35 of logical size). */
  resolution?: number;
}

const cache = new Map<string, string>();
// Serialize poster renders so at most one short-lived WebGL context exists at a
// time — a full gallery of 12 cards mounting at once must not spin up 12
// contexts (browser context-count limits + contention).
let queue: Promise<unknown> = Promise.resolve();

function key(def: TemplateDefinition, c: PosterConfig): string {
  return [def.id, c.aspect, c.paletteId ?? "", c.resolution ?? 0.35, JSON.stringify(c.values ?? {})].join(
    "|",
  );
}

/**
 * Render a template's poster frame (at `posterTime`) to a PNG data URL for
 * gallery thumbnails. Cached by inputs and serialized across calls.
 */
export async function renderPosterDataURL(
  def: TemplateDefinition,
  config: PosterConfig,
): Promise<string> {
  const k = key(def, config);
  const hit = cache.get(k);
  if (hit) return hit;

  const run = queue.then(async () => {
    const cached = cache.get(k);
    if (cached) return cached;
    const runner = await TemplateRunner.create(def, {
      aspect: config.aspect,
      resolution: config.resolution ?? 0.35,
      ...(config.paletteId ? { paletteId: config.paletteId } : {}),
      ...(config.values ? { values: config.values } : {}),
      ...(config.seed !== undefined ? { seed: config.seed } : {}),
    });
    try {
      runner.renderAt(def.posterTime);
      const url = runner.canvas.toDataURL("image/png");
      cache.set(k, url);
      return url;
    } finally {
      runner.destroy();
    }
  });
  // Keep the queue chained but don't let one failure break the chain.
  queue = run.catch(() => undefined);
  return run;
}

export function clearPosterCache(): void {
  cache.clear();
}
