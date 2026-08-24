import type { TemplateDefinition, Values } from "@jima/engine";

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Values passed to the engine. Image descriptors carry a `url` the engine loads
 * into a texture (TemplateContext.images), so those pass through unchanged.
 *
 * Also sanitizes `color` fields: a half-typed or malformed hex ("#3", "red",
 * "#gg0000") reaching a template's `.fill()` would throw and tear down the live
 * scene, so we blank it — the template then falls back to its palette color.
 * Only allocates a new object when something actually needs fixing.
 */
export function engineValues(def: TemplateDefinition, values: Values): Values {
  let out: Values | null = null;
  for (const f of def.fields) {
    if (f.type !== "color") continue;
    const v = values[f.key];
    if (typeof v === "string" && v.length > 0 && !HEX.test(v)) {
      if (!out) out = { ...values };
      out[f.key] = "";
    }
  }
  return out ?? values;
}
