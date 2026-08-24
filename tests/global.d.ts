// Shared browser-context globals the suites read.
//
// Two separate hooks live here:
//   - `__jimaHarnessReady` / `__jimaReadCanvas` come from the render harness
//     (apps/web/harness), which is test-only and never deployed.
//   - `__JIMA__` is set by the Captions app itself, but only when the page is
//     opened with `?__e2e` — so tests can drive the store and the shared
//     renderer without shipping a global in normal use.
export {};

import type { drawCaptions } from "../packages/captions/src/captions/render";
import type { useAppStore } from "../apps/web/src/captions/state/store";

declare global {
  interface Window {
    __jimaHarnessReady?: boolean;
    __jimaReadCanvas?: () => { rgba: Uint8Array; width: number; height: number };
    __JIMA__?: {
      store: typeof useAppStore;
      drawCaptions: typeof drawCaptions;
    };
  }
}
