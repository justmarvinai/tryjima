import { useMemo } from 'react';
import { detectCapabilities, type CapabilityReport } from '@jima/captions/platform';

/**
 * Detects browser capabilities once per mount. Detection is synchronous and
 * cheap, so a memo is enough — no context/provider needed.
 */
export function useCaptionCapabilities(): CapabilityReport {
  return useMemo(() => detectCapabilities(), []);
}
