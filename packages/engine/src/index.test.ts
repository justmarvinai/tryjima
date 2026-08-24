import { describe, it, expect } from "vitest";
// Import from ./version (not the barrel) so this Node test never pulls in the
// Pixi-touching browser modules.
import { ENGINE_VERSION } from "./version";

describe("@jima/engine", () => {
  it("exposes a version string", () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
