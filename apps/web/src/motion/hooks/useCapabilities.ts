import { useEffect, useState } from "react";
import { detectCapabilities, type Capabilities } from "@jima/engine";

/** Probe export capabilities once; null while detecting. */
export function useCapabilities(): Capabilities | null {
  const [caps, setCaps] = useState<Capabilities | null>(null);
  useEffect(() => {
    let alive = true;
    void detectCapabilities().then((c) => {
      if (alive) setCaps(c);
    });
    return () => {
      alive = false;
    };
  }, []);
  return caps;
}
