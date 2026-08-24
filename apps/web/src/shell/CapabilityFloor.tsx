import { Link } from "react-router-dom";
import { buttonClasses, cn, JimaMark, ShieldIcon } from "@/ui";
import { PRODUCTS, type ProductId } from "./products";

/**
 * The shared "this browser can't do it" screen, used by both tools.
 *
 * Jima does its work with APIs that are not universal yet (WebCodecs for video
 * encoding, WebGL2 for the motion engine). The rule from both predecessors
 * holds: say so up front, name what is missing, and point at a browser that
 * works — never a half-loaded editor that dies at the export step.
 *
 * It also offers the *other* tool, which is new: Motion needs only WebGL2, so a
 * browser that can't export a captioned MP4 can very often still run Motion,
 * and vice versa.
 */
export function CapabilityFloor({
  product,
  title,
  body,
  missing = [],
}: {
  product: ProductId;
  title: string;
  body: string;
  /** Names of the specific APIs that are unavailable. */
  missing?: string[];
}) {
  const other = PRODUCTS.find((p) => p.id !== product);
  const OtherIcon = other?.icon;

  return (
    <main className="grid min-h-dvh place-items-center bg-void px-5 py-12">
      <div className="w-full max-w-lg">
        <Link to="/" aria-label="Jima home" className="inline-block rounded-lg">
          <JimaMark className="h-8 w-8 text-lime" />
        </Link>

        <p className="mt-8 font-mono text-xs uppercase tracking-[0.18em] text-lime">Almost there</p>
        <h1 className="headline-xl mt-3 text-3xl text-chalk sm:text-4xl">{title}</h1>
        <p className="mt-5 text-[15px] leading-relaxed text-ash">{body}</p>
        <p className="mt-4 text-[15px] leading-relaxed text-ash">
          A current <span className="font-medium text-chalk">Chrome</span>,{" "}
          <span className="font-medium text-chalk">Edge</span>, <span className="font-medium text-chalk">Brave</span> or{" "}
          <span className="font-medium text-chalk">Arc</span> on desktop will run it.
        </p>

        {missing.length > 0 && (
          <div className="mt-7 rounded-card border border-line bg-surface p-5">
            <p className="text-sm font-semibold text-chalk">Missing in this browser</p>
            <ul className="mt-2.5 space-y-1.5">
              {missing.map((item) => (
                <li key={item} className="flex items-center gap-2 font-mono text-[13px] text-dim">
                  <span aria-hidden className="text-error">
                    ✕
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to="/" className={buttonClasses("secondary", "md")}>
            Back to Jima
          </Link>
          {other && OtherIcon && (
            <Link to={other.path} className={cn(buttonClasses("ghost", "md"), "group")}>
              <OtherIcon width={16} height={16} />
              Try {other.name} instead
            </Link>
          )}
        </div>

        <p className="mt-10 flex items-center gap-2 text-xs text-dim">
          <ShieldIcon width={14} height={14} className="text-lime" />
          Nothing was uploaded to check this — the test ran in your browser.
        </p>
      </div>
    </main>
  );
}

/**
 * WebGL2 probe for Jima Motion. Releases the probe context immediately rather
 * than leaving it for GC — browsers cap the number of live WebGL contexts, and
 * the editor needs every one it can get.
 */
export function hasWebGL2(): boolean {
  if (typeof document === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return gl != null;
  } catch {
    return false;
  }
}
