// The official Jima logo, inlined from assets/Jima Full Logo_no_shadow.svg.
//
// Inlined (rather than an <img src>) for three reasons: it paints with the first
// render instead of flashing in, it costs no extra request, and `currentColor`
// lets one asset serve ink-on-white chrome and white-on-emerald bands alike.
// The artwork itself is unchanged — same paths, same proportions.

import type { CSSProperties } from "react";

// The source file pads the artwork inside a 1971x822 canvas. Both viewBoxes are
// tightened to the actual ink so a given height renders the logo at that height
// (padding would otherwise shrink it unpredictably at each call site).
// Content bounds: x 0..1937.5, y 128.9 (i/j dots) .. 776.8 (j descender).
const VIEWBOX_FULL = "0 126 1940 653";
// Tight box around the mark alone (rounded tile + tail), for square icon slots.
const VIEWBOX_MARK = "0 138 500 508";

/** The mark: a rounded tile with a tail, drawn as two paths. */
const MARK_PATHS = (
  <>
    <path d="M478.78 140H255.27C244.224 140 235.27 148.954 235.27 160V383.51C235.27 394.556 244.224 403.51 255.27 403.51H478.78C489.825 403.51 498.78 394.556 498.78 383.51V160C498.78 148.954 489.825 140 478.78 140Z" />
    <path d="M215.269 403.51H20.0392C2.2192 403.51 -6.7008 425.05 5.8992 437.65L201.129 632.88C213.729 645.48 235.269 636.56 235.269 618.74V423.51C235.269 412.46 226.319 403.51 215.269 403.51Z" />
  </>
);

/** The "jima" wordmark glyphs. */
const WORDMARK_PATH = (
  <path d="M604.474 776.795C587.651 776.795 571.024 773.665 554.592 767.405C537.769 761.537 522.316 752.343 508.232 739.824L556.939 662.361C566.329 668.229 575.718 671.163 585.108 671.163C594.889 671.163 603.104 667.838 609.755 661.187C616.406 654.536 619.732 644.56 619.732 631.258V286.781H734.753V644.168C734.753 672.337 728.493 696.202 715.974 715.763C703.846 735.716 687.805 750.778 667.853 760.95C648.291 771.513 627.165 776.795 604.474 776.795ZM677.829 255.679C656.311 255.679 638.902 249.81 625.6 238.073C612.298 225.945 605.647 210.883 605.647 192.887C605.647 174.499 612.298 159.241 625.6 147.113C638.902 134.985 656.311 128.921 677.829 128.921C699.347 128.921 716.561 134.985 729.471 147.113C742.773 159.241 749.424 174.499 749.424 192.887C749.424 210.883 742.773 225.945 729.471 238.073C716.561 249.81 699.347 255.679 677.829 255.679ZM801.167 616V286.781H916.188V616H801.167ZM859.264 255.679C837.747 255.679 820.337 249.81 807.035 238.073C793.733 225.945 787.083 210.883 787.083 192.887C787.083 174.499 793.733 159.241 807.035 147.113C820.337 134.985 837.747 128.921 859.264 128.921C880.782 128.921 897.996 134.985 910.906 147.113C924.208 159.241 930.859 174.499 930.859 192.887C930.859 210.883 924.208 225.945 910.906 238.073C897.996 249.81 880.782 255.679 859.264 255.679ZM978.347 616V286.781H1093.37V357.789C1098.06 341.749 1105.5 328.252 1115.67 317.297C1125.84 305.952 1137.77 297.344 1151.47 291.476C1165.16 285.608 1179.63 282.673 1194.89 282.673C1223.84 282.673 1247.32 291.672 1265.31 309.668C1283.7 327.273 1294.85 352.312 1298.76 384.784C1303.07 360.528 1310.89 340.966 1322.24 326.1C1333.58 311.233 1347.28 300.279 1363.32 293.237C1379.36 286.194 1396.37 282.673 1414.37 282.673C1455.84 282.673 1487.34 295.388 1508.85 320.818C1530.76 345.857 1541.72 379.894 1541.72 422.929V616H1426.7V438.187C1426.7 419.408 1421.61 404.737 1411.44 394.174C1401.66 383.219 1388.55 377.742 1372.12 377.742C1355.69 377.742 1342.39 384.197 1332.21 397.108C1322.43 409.627 1317.54 425.276 1317.54 444.055V616H1202.52V438.187C1202.52 419.408 1197.63 404.737 1187.85 394.174C1178.07 383.219 1164.96 377.742 1148.53 377.742C1137.58 377.742 1127.99 380.676 1119.78 386.545C1111.56 392.413 1105.11 400.433 1100.41 410.605C1095.72 420.386 1093.37 431.536 1093.37 444.055V616H978.347ZM1722.1 620.108C1693.15 620.108 1668.5 612.479 1648.16 597.221C1627.82 581.963 1612.36 561.619 1601.8 536.189C1591.24 510.368 1585.95 482.2 1585.95 451.684C1585.95 421.168 1591.24 393.195 1601.8 367.766C1612.36 341.945 1627.82 321.405 1648.16 306.147C1668.5 290.498 1693.15 282.673 1722.1 282.673C1746.36 282.673 1767.29 289.52 1784.89 303.213C1802.89 316.906 1815.41 336.076 1822.45 360.723V286.781H1937.47V616H1878.79C1860.79 616 1846.9 611.11 1837.12 601.329C1827.34 591.548 1822.45 577.66 1822.45 559.663V542.645C1815.41 567.292 1802.89 586.462 1784.89 600.155C1767.29 613.457 1746.36 620.108 1722.1 620.108ZM1762.59 519.171C1773.94 519.171 1784.11 516.432 1793.11 510.955C1802.11 505.478 1809.15 497.849 1814.24 488.068C1819.71 477.896 1822.45 465.768 1822.45 451.684C1822.45 437.6 1819.71 425.472 1814.24 415.3C1809.15 405.128 1802.11 397.303 1793.11 391.826C1784.11 385.958 1773.94 383.024 1762.59 383.024C1751.25 383.024 1741.08 385.958 1732.08 391.826C1723.08 397.303 1716.04 405.128 1710.95 415.3C1705.87 425.472 1703.32 437.6 1703.32 451.684C1703.32 465.768 1705.87 477.896 1710.95 488.068C1716.04 497.849 1723.08 505.478 1732.08 510.955C1741.08 516.432 1751.25 519.171 1762.59 519.171Z" />
);

/**
 * The full lockup (mark + wordmark). Width follows height, so give it a height
 * either with a class (`h-7`) or via `style` — `Wordmark` passes an `em` height
 * so the text-sized call sites it replaced keep working. Decorative by default;
 * pass a `title` where it's the only label for a link.
 */
export function JimaLogo({
  className,
  title,
  style,
}: {
  className?: string | undefined;
  title?: string | undefined;
  style?: CSSProperties | undefined;
}) {
  return (
    <svg
      viewBox={VIEWBOX_FULL}
      className={className}
      style={{ width: "auto", ...style }}
      fill="currentColor"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {MARK_PATHS}
      {WORDMARK_PATH}
    </svg>
  );
}

/**
 * The mark on its own, for square slots (app icon, favicon, compact chrome).
 * Sized by the caller's width/height classes.
 */
export function JimaMark({ className, title }: { className?: string | undefined; title?: string | undefined }) {
  return (
    <svg
      viewBox={VIEWBOX_MARK}
      className={className}
      fill="currentColor"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {MARK_PATHS}
    </svg>
  );
}

/**
 * The Jima wordmark at text size. The SVG's height is set in `em`, so the same
 * `text-xl` / `text-2xl` classes that size surrounding text size the logo too.
 * Inherits `currentColor`, defaulting to chalk.
 */
export function Wordmark({ className, title = "Jima" }: { className?: string; title?: string }) {
  return (
    <span className={["inline-flex items-center text-chalk", className].filter(Boolean).join(" ")}>
      {/* Labelled, not decorative: this stands in for the literal word "jima",
          so a link wrapping only the logo still has an accessible name. A
          wrapper's own aria-label still wins. */}
      <JimaLogo style={{ height: "1.05em" }} title={title} />
    </span>
  );
}

/**
 * Product lockup — "jima ⟩ Captions", the way Figma writes "Figma Design".
 *
 * The parent brand always leads and never changes weight or colour; the product
 * name follows in the display face at a lighter weight. That hierarchy is the
 * whole point of the merge: one company, two tools, and it should be legible in
 * a 24px-tall piece of chrome.
 */
export function ProductLockup({
  product,
  className,
  muted = false,
}: {
  product: "Captions" | "Motion";
  className?: string;
  muted?: boolean;
}) {
  return (
    <span className={["inline-flex items-center gap-2", className].filter(Boolean).join(" ")}>
      <JimaLogo style={{ height: "1.05em" }} title={`Jima ${product}`} className="text-chalk" />
      <span aria-hidden className="h-[0.9em] w-px shrink-0 bg-line-2" />
      <span
        className={[
          "font-display text-[0.92em] font-medium tracking-tight",
          muted ? "text-ash" : "text-chalk",
        ].join(" ")}
        aria-hidden
      >
        {product}
      </span>
    </span>
  );
}
