import type { TemplateRunner } from "../runtime/runner";
import type { MotionBlur } from "./types";

/**
 * Paint one output frame, with or without synthetic motion blur.
 *
 * Shared by the video and GIF loops so both honour the same setting — GIF wants
 * it most, since 12–15 fps is exactly where un-blurred motion strobes.
 *
 * `frameDur` is the *timeline* seconds one output frame covers (already scaled
 * by playback speed), so the shutter window stays a real fraction of the frame
 * even when the animation is sped up or slowed down.
 */
export function renderFrame(
  runner: TemplateRunner,
  t: number,
  frameDur: number,
  blur?: MotionBlur | null,
): void {
  if (blur && blur.samples > 1 && blur.shutter > 0) {
    runner.renderBlurredAt(t, blur.samples, frameDur * blur.shutter);
  } else {
    runner.renderAt(t);
  }
}
