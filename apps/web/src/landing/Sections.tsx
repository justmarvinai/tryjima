import { Link } from "react-router-dom";
import { TEMPLATE_COUNT } from "@jima/templates/durations";
import {
  buttonClasses,
  cn,
  Container,
  Marker,
  Reveal,
  SectionHeading,
  ArrowRightIcon,
  ShieldIcon,
  BoltIcon,
  PaletteIcon,
  FolderIcon,
  TypeIcon,
  LayersIcon,
  WaveformIcon,
  DownloadIcon,
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
    <section className="border-t border-line bg-shell py-20 sm:py-28" aria-labelledby="privacy-title">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-lime">Privacy by architecture</p>
            <h2 id="privacy-title" className="headline-xl mt-4 text-4xl text-chalk sm:text-5xl">
              Your footage never <Marker>leaves this tab</Marker>.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-ash">
              Most "private" tools promise not to look at what you upload. Jima doesn't need the promise: nothing is
              uploaded, so there is nothing to look at.
            </p>
            <Link to="/privacy" className={cn(buttonClasses("secondary", "md"), "group mt-8")}>
              Read the privacy policy
              <ArrowRightIcon width={16} height={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <ul className="flex flex-col gap-3">
            {PRIVACY_POINTS.map(({ icon: Icon, title, body }, i) => (
              // The <li> has to be the direct child of the <ul>: wrapping it in
              // Reveal's <div> breaks the list for assistive tech (axe flags it
              // as both "list has non-li children" and "li with no list parent").
              <li key={title} className="rounded-card border border-line bg-surface p-6">
                <Reveal delay={i * 80}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-lime-tint text-lime ring-1 ring-inset ring-lime/25">
                      <Icon width={17} height={17} />
                    </span>
                    <h3 className="font-display text-base font-semibold text-chalk">{title}</h3>
                  </div>
                  <p className="mt-3 text-[14.5px] leading-relaxed text-ash">{body}</p>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
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
    <section className="border-t border-line bg-shell py-16 sm:py-20" aria-label="Jima by the numbers">
      <Container>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-bento border border-line bg-line lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-shell px-6 py-8 text-center">
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <span className="headline-xl block text-4xl text-lime sm:text-5xl">{s.value}</span>
                <span className="mt-2 block font-display text-sm font-semibold text-chalk">{s.label}</span>
                <span className="mt-1 block text-xs text-dim">{s.note}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}

/* ==================================================================== *
 * How it works — three steps, per tool, side by side.
 * ==================================================================== */

const FLOWS = [
  {
    tool: "Captions",
    to: "/captions",
    steps: [
      { icon: DownloadIcon, title: "Drop an MP4", body: "Up to 200 MB and 60 seconds. It is read from disk, not sent anywhere." },
      { icon: WaveformIcon, title: "It listens", body: "Whisper runs on your GPU (or CPU) and returns every word with its own timestamp." },
      { icon: DownloadIcon, title: "Style and export", body: "Pick a preset, drag it into place, and burn it in at source quality." },
    ],
  },
  {
    tool: "Motion",
    to: "/motion",
    steps: [
      { icon: LayersIcon, title: "Pick a template", body: `${TEMPLATE_COUNT} of them, filtered by what you're actually posting.` },
      { icon: TypeIcon, title: "Make it yours", body: "Your words, your colours, your fonts, your aspect ratio, your pace." },
      { icon: DownloadIcon, title: "Export", body: "MP4, WebM — transparent if you want — or a GIF. No watermark." },
    ],
  },
];

export function HowItWorks() {
  return (
    <section className="border-t border-line bg-void py-20 sm:py-28" aria-labelledby="how-title">
      <Container>
        <SectionHeading
          eyebrow="How it goes"
          title={<span id="how-title">Three steps. Either tool.</span>}
          lead="No onboarding, no project setup, no sign-in wall. Open the tab and start."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {FLOWS.map((flow, fi) => (
            <Reveal key={flow.tool} delay={fi * 90}>
              <div className="h-full rounded-bento border border-line bg-surface p-7 sm:p-8">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl font-bold tracking-tight text-chalk">Jima {flow.tool}</h3>
                  <Link
                    to={flow.to}
                    className="group inline-flex items-center gap-1.5 text-[13px] font-semibold text-lime hover:text-lime-bright"
                  >
                    Open
                    <ArrowRightIcon width={14} height={14} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>

                <ol className="mt-6 flex flex-col gap-5">
                  {flow.steps.map((s, i) => {
                    const Icon = s.icon;
                    return (
                      <li key={s.title} className="flex gap-4">
                        <span className="relative flex flex-col items-center">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-lime ring-1 ring-inset ring-line">
                            <Icon width={16} height={16} />
                          </span>
                          {i < flow.steps.length - 1 && (
                            <span className="mt-1 w-px flex-1 bg-line" aria-hidden />
                          )}
                        </span>
                        <span className="pb-1">
                          <span className="flex items-baseline gap-2">
                            <span className="font-mono text-[10px] tabular-nums text-dim">0{i + 1}</span>
                            <span className="font-display text-[15px] font-semibold text-chalk">{s.title}</span>
                          </span>
                          <span className="mt-1 block text-[14px] leading-relaxed text-ash">{s.body}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
