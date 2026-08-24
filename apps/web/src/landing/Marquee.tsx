import { Link } from "react-router-dom";
import { templates } from "@jima/templates";
import { TEMPLATE_COUNT } from "@jima/templates/durations";
import type { TemplateDefinition } from "@jima/engine";
import { PosterThumb } from "@/motion/components/PosterThumb";
import { buttonClasses, cn, Container, SectionHeading, ArrowRightIcon } from "@/ui";

function RailCard({ def, duplicate }: { def: TemplateDefinition; duplicate?: boolean }) {
  return (
    <Link
      to={`/motion?t=${def.id}`}
      // The marquee renders each row twice for a seamless loop; the second copy
      // is decorative — hide it from AT and the tab order to avoid double
      // announcements and tabbing onto moving targets.
      {...(duplicate ? { "aria-hidden": true, tabIndex: -1 } : {})}
      className="group/card block w-[168px] shrink-0 overflow-hidden rounded-card border border-line bg-surface shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-lime/40 hover:shadow-pop sm:w-[196px]"
    >
      <PosterThumb def={def} aspect="1:1" paletteId={def.palettes[0]?.id} alt={def.name} className="w-full" />
      <div className="px-3 py-2.5">
        <p className="truncate font-display text-[13px] font-semibold text-chalk">{def.name}</p>
      </div>
    </Link>
  );
}

function Row({ items, direction }: { items: TemplateDefinition[]; direction: "left" | "right" }) {
  return (
    <div className="group flex overflow-hidden">
      <div
        className="flex shrink-0 gap-4 pr-4 group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]"
        style={{ animation: `jima-marquee-${direction} 130s linear infinite` }}
      >
        {items.map((def, i) => (
          <RailCard key={`a-${def.id}-${i}`} def={def} />
        ))}
        {items.map((def, i) => (
          <RailCard key={`b-${def.id}-${i}`} def={def} duplicate />
        ))}
      </div>
    </div>
  );
}

export default function Marquee() {
  // Sample the library evenly for a varied, lighter marquee. Every poster is a
  // real engine render, so this is the difference between ~40 WebGL draws and
  // ~500; the rows are long enough to loop seamlessly either way.
  const sample = templates.filter((_, i) => i % 12 === 0);
  const half = Math.ceil(sample.length / 2);
  return (
    <section id="templates" className="overflow-hidden border-t border-line bg-void py-20 sm:py-24" aria-label="Template previews">
      <Container>
        <SectionHeading
          align="center"
          eyebrow="Template library"
          title="Something for whatever you're posting"
          lead="Product drops, reels, quotes, sale banners, lower-thirds, openers, charts, travel, events — every one of them editable down to the last colour."
        />
      </Container>

      {/* Held to the content column: the rows still scroll past that width, but
          dissolve at the column edges instead of hard-cutting at the viewport. */}
      <Container className="mt-12">
        <div className="edge-fade-x flex flex-col gap-4">
          <Row items={sample.slice(0, half)} direction="left" />
          <Row items={sample.slice(half)} direction="right" />
        </div>
      </Container>

      <Container className="mt-10 text-center">
        <p className="font-display text-base font-semibold text-silver">
          <span className="text-lime">{TEMPLATE_COUNT}</span> templates, all free, all yours.
        </p>
        <Link to="/motion" className={cn(buttonClasses("secondary", "md"), "group mt-6")}>
          Open the library
          <ArrowRightIcon width={16} height={16} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </Container>
    </section>
  );
}
