import { useState } from "react";
import { TEMPLATE_COUNT } from "@jima/templates/durations";
import { cn, Container, SectionHeading, ChevronDownIcon } from "@/ui";

const FAQ: { q: string; a: string }[] = [
  {
    q: "Is it really free? What's the catch?",
    a: "Yes, and there isn't one. Jima renders everything on your own device, so there are no server bills to cover — no account, no watermark, no export limit, no upsell hiding at the end.",
  },
  {
    q: "Do my videos get uploaded anywhere?",
    a: "No. Both tools decode, render and encode inside your browser. Jima is a set of static files; there is no backend that could receive a video. You can prove it: open the network tab, or pull the plug once the page has loaded.",
  },
  {
    q: "Then what is the model download in Captions?",
    a: "The one exception. The first time you transcribe, your browser fetches a ~150 MB Whisper model from the Hugging Face CDN and caches it. That request contains no audio — it is the same download for everyone — and every transcription after it works offline.",
  },
  {
    q: "Which languages does Captions understand?",
    a: "English and German, detected automatically and overridable if the detection guesses wrong on a short clip.",
  },
  {
    q: "What are the input limits?",
    a: "Captions takes an .mp4 up to 200 MB and 60 seconds — the short-form range, and the point where in-browser encoding stays comfortable. Motion has no input file at all beyond any images you add.",
  },
  {
    q: "What can I export?",
    a: `Captions burns subtitles into an MP4 at your source resolution, and can also write .srt or .vtt subtitle files. Motion exports MP4, WebM (including transparent WebM) and GIF, up to 1080p, in 1:1, 4:5, 9:16 and 16:9.`,
  },
  {
    q: "Which browsers work?",
    a: "Chrome and Edge 113+ do everything, and are what to use for a video export. Safari 16.4+ handles most of it. Firefox can browse and edit, and exports WebM and GIF. Anything without WebCodecs will say so up front rather than failing halfway through an export.",
  },
  {
    q: "Can I use the exports commercially?",
    a: `Yes. Everything you export is yours, for any purpose. All ${TEMPLATE_COUNT} templates and every bundled typeface are licensed for it.`,
  },
  {
    q: "Where is my work saved?",
    a: "In this browser, in its own storage — your open project, your caption style, your brand kit and your recent projects. Nothing syncs, nothing is backed up, and clearing your site data deletes it for good.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="border-t border-line bg-base py-20 sm:py-28">
      <Container>
        <div className="mx-auto max-w-3xl">
          <SectionHeading align="center" eyebrow="FAQ" size="lg" title="Questions, answered." />
          <div className="mt-10 flex flex-col gap-2.5">
            {FAQ.map((item, i) => {
              const isOpen = open === i;
              return (
                <div
                  key={item.q}
                  className={cn(
                    "overflow-hidden rounded-card border bg-surface transition-colors",
                    isOpen ? "border-lime/35" : "border-line",
                  )}
                >
                  <h3>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    >
                      <span className="font-display text-[15px] font-semibold text-chalk sm:text-base">{item.q}</span>
                      <ChevronDownIcon
                        width={17}
                        height={17}
                        className={cn("shrink-0 transition-transform duration-200", isOpen ? "rotate-180 text-lime" : "text-dim")}
                      />
                    </button>
                  </h3>
                  {isOpen && <p className="px-5 pb-5 text-[14.5px] leading-relaxed text-ash">{item.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}
