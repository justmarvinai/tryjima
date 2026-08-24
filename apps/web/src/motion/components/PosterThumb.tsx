import { useEffect, useRef, useState } from "react";
import { renderPosterDataURL, type Aspect, type TemplateDefinition, type Values } from "@jima/engine";

export function PosterThumb({
  def,
  aspect,
  paletteId,
  values,
  className,
  alt,
}: {
  def: TemplateDefinition;
  aspect: Aspect;
  paletteId?: string | undefined;
  values?: Values | undefined;
  className?: string | undefined;
  alt?: string | undefined;
}) {
  const [url, setUrl] = useState<string | null>(null);
  // Only render the poster once its thumbnail is near the viewport. With a large
  // gallery (and the landing marquee), rendering all posters on mount would fire
  // dozens of WebGL renders at once through the engine's single serialized
  // context — slow to settle and starves the live editor preview. Lazy rendering
  // keeps concurrent work to the handful of visible cards.
  const [seen, setSeen] = useState(false);
  const holderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (seen) return;
    const el = holderRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setSeen(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "250px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  useEffect(() => {
    if (!seen) return;
    let alive = true;
    void renderPosterDataURL(def, {
      aspect,
      ...(paletteId ? { paletteId } : {}),
      ...(values ? { values } : {}),
    })
      .then((u) => {
        if (alive) setUrl(u);
      })
      .catch(() => {
        /* poster render failed — leave placeholder */
      });
    return () => {
      alive = false;
    };
  }, [seen, def, aspect, paletteId, values]);

  return (
    <div
      ref={holderRef}
      className={`relative overflow-hidden bg-porcelain ${className ?? ""}`}
      style={{ aspectRatio: aspect.replace(":", " / ") }}
    >
      {url ? (
        <img src={url} alt={alt ?? `${def.name} preview`} className="h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 animate-pulse bg-mist/50" aria-hidden />
      )}
    </div>
  );
}
