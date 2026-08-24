import { Link } from "react-router-dom";
import { TEMPLATE_COUNT } from "@jima/templates/durations";
import {
  buttonClasses,
  cn,
  Container,
  ArrowRightIcon,
  ShieldIcon,
  BoltIcon,
  PaletteIcon,
  FolderIcon,
  TypeIcon,
  LayersIcon,
} from "@/ui";

/* ==================================================================== *
 * "Nothing leaves your device" — the claim the whole product rests on.
 * ==================================================================== */

const PRIVACY_POINTS = [
  {
    icon: ShieldIcon,
    title: "No upload, no server",
    body: "Your video is decoded, transcribed, drawn on and re-encoded by your own browser. Jima is static files on a CDN — there is no backend that could receive your footage even if someone asked it to.",
  },
  {
    icon: BoltIcon,
    title: "The model comes to you",
    body: "Captions downloads a ~150 MB speech model once, from the Hugging Face CDN, and your browser caches it. After that the whole thing works with the network switched off. Your audio is never part of that request.",
  },
  {
    icon: FolderIcon,
    title: "Your work stays yours",
    body: "Projects, style presets and the brand kit live in this browser's own storage. No account holds them, nothing syncs, and clearing your site data really does delete them.",
  },
];

export function PrivacyBand() {
  return (
    <section
      className="relative overflow-hidden border-t border-line bg-shell py-24 sm:py-32"
      aria-labelledby="privacy-title"
    >
      {/* A video signal rather than a fabric: fine rules, one accent wash, and
          nothing else. This band is a statement, so the only thing allowed to
          be loud on it is the sentence. */}
      <div className="pointer-events-none absolute inset-0 -z-10 scanlines opacity-70" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "radial-gradient(58% 46% at 50% 0%, rgb(200 255 61 / 9%) 0%, transparent 70%)" }}
        aria-hidden
      />

      <Container>
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-lime">
          Privacy by architecture
        </p>

        <h2
          id="privacy-title"
          className="headline-mega mx-auto mt-7 max-w-5xl text-center text-[clamp(2.5rem,7.4vw,6rem)] text-chalk"
        >
          Nothing is uploaded.
          <br />
          <span className="text-dim">There is no server.</span>
        </h2>

        <p className="mx-auto mt-9 max-w-2xl text-center text-lg leading-relaxed text-ash">
          Most &ldquo;private&rdquo; tools promise not to look at what you upload. Jima doesn&rsquo;t need the
          promise — your video is decoded, transcribed, drawn on and re-encoded by your own browser, and the site
          itself is static files on a CDN.
        </p>

        <div className="mt-11 flex justify-center">
          <Link to="/privacy" className={cn(buttonClasses("secondary", "md"), "group")}>
            Read the privacy policy
            <ArrowRightIcon width={16} height={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <ul className="mt-16 grid gap-px overflow-hidden rounded-bento border border-line bg-line md:grid-cols-3">
          {PRIVACY_POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="bg-shell p-7">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-lime-tint text-lime ring-1 ring-inset ring-lime/25">
                <Icon width={17} height={17} />
              </span>
              <h3 className="mt-4 font-display text-base font-semibold text-chalk">{title}</h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-ash">{body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* ==================================================================== *
 * The brand kit — the one thing that is genuinely shared between tools.
 * ==================================================================== */

const KIT_ROWS = [
  { icon: PaletteIcon, label: "Three colours", detail: "Background, text, accent" },
  { icon: TypeIcon, label: "Two typefaces", detail: "Headline and body" },
  { icon: LayersIcon, label: "Applied in both", detail: "Templates and caption styles" },
];

export function BrandKitBand() {
  return (
    <section className="border-t border-line bg-void py-20 sm:py-28" aria-labelledby="kit-title">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lg:order-1">
            <div className="relative overflow-hidden rounded-bento border border-line bg-surface p-7 shadow-card">
              <div className="flex items-center justify-between">
                <p className="font-display text-sm font-semibold text-chalk">Your brand kit</p>
                <span className="rounded-full bg-lime-tint px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-lime">
                  Saved
                </span>
              </div>

              <div className="mt-5 flex gap-2.5">
                {["#111419", "#F2F3F5", "#C8FF3D"].map((c) => (
                  <div key={c} className="flex-1">
                    <div className="h-14 rounded-xl ring-1 ring-inset ring-line-2" style={{ background: c }} />
                    <p className="mt-1.5 text-center font-mono text-[10px] uppercase text-dim">{c}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-2">
                {KIT_ROWS.map(({ icon: Icon, label, detail }) => (
                  <div key={label} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5">
                    <Icon width={16} height={16} className="shrink-0 text-lime" />
                    <span className="text-[13px] font-medium text-chalk">{label}</span>
                    <span className="ml-auto text-[12px] text-dim">{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-lime">One kit, both tools</p>
            <h2 id="kit-title" className="headline-xl mt-4 text-4xl text-chalk sm:text-5xl">
              Set your brand once.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-ash">
              Save three colours and two typefaces, and they are one click away in every template <em>and</em> in your
              caption styles. The two tools carry the same font roster on purpose, so a caption and a title card can
              actually match.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/brand" className={cn(buttonClasses("primary", "md"), "group")}>
                Set up your kit
                <ArrowRightIcon width={16} height={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link to="/projects" className={buttonClasses("secondary", "md")}>
                See your projects
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ==================================================================== *
 * Hard numbers.
 * ==================================================================== */

const STATS: { value: string; label: string; note: string }[] = [
  { value: String(TEMPLATE_COUNT), label: "templates", note: "across 9 use cases" },
  { value: "0", label: "bytes uploaded", note: "there is no server" },
  { value: "1080p", label: "max export", note: "MP4 · WebM · GIF" },
  { value: "€0", label: "forever", note: "no account, no watermark" },
];

export function Stats() {
  return (
    <section className="relative overflow-hidden border-t border-line bg-void" aria-label="Jima by the numbers">
      <div className="pointer-events-none absolute inset-0 -z-10 brush-grain opacity-25" aria-hidden />
      <Container>
        <dl className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-x lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="group px-2 py-12 sm:px-6 lg:py-16">
              <dt className="sr-only">{s.label}</dt>
              <dd>
                {/* Numbers at headline scale. A stat card with a 40px figure in
                    it reads as a footnote; this reads as a claim. */}
                <span className="headline-mega block text-[clamp(2.5rem,4.6vw,3.75rem)] text-chalk transition-colors duration-300 group-hover:text-lime">
                  {s.value}
                </span>
                <span className="mt-3 block font-display text-[15px] font-semibold text-chalk">{s.label}</span>
                <span className="mt-1 block text-[13px] text-dim">{s.note}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
