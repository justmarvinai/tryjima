import { Link } from "react-router-dom";
import { TEMPLATE_COUNT } from "@jima/templates/durations";
import { PageShell } from "@/shell/PageShell";
import { buttonClasses, cn, Badge, ArrowRightIcon, CaptionsIcon, MotionIcon } from "@/ui";
import { H2, H3, LI, P, Strong, UL } from "@/shell/prose";

/**
 * The help page. Written to answer the questions people actually hit — a video
 * that won't import, an export that fails, a transcript that guessed the wrong
 * language — rather than to document every control.
 */
export default function Help() {
  return (
    <PageShell
      eyebrow="Help"
      title="Getting started & troubleshooting"
      intro={<>Everything you need to get a first export out of either tool, and what to do when one misbehaves.</>}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/captions"
          className="group rounded-bento border border-line bg-surface p-6 transition-all hover:-translate-y-0.5 hover:border-lime/35 hover:shadow-pop"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-tint text-lime ring-1 ring-inset ring-lime/25">
            <CaptionsIcon />
          </span>
          <h2 className="mt-4 flex items-center gap-1.5 font-display text-lg font-semibold text-chalk">
            Jima Captions
            <ArrowRightIcon width={15} height={15} className="text-lime transition-transform group-hover:translate-x-0.5" />
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-dim">Upload → transcribe → style → export.</p>
        </Link>
        <Link
          to="/motion"
          className="group rounded-bento border border-line bg-surface p-6 transition-all hover:-translate-y-0.5 hover:border-lime/35 hover:shadow-pop"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-tint text-lime ring-1 ring-inset ring-lime/25">
            <MotionIcon />
          </span>
          <h2 className="mt-4 flex items-center gap-1.5 font-display text-lg font-semibold text-chalk">
            Jima Motion
            <ArrowRightIcon width={15} height={15} className="text-lime transition-transform group-hover:translate-x-0.5" />
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-dim">Pick a template → edit → export.</p>
        </Link>
      </div>

      <H2>Jima Captions, step by step</H2>
      <ol className="flex flex-col gap-5">
        {[
          {
            t: "Add your video",
            b: (
              <>
                Drop in an <Strong>.mp4</Strong> up to <Strong>200 MB</Strong> and <Strong>60 seconds</Strong>. Those
                are the short-form limits and the point where browser-side encoding stays comfortable. A longer or
                heavier file is rejected before anything starts, not halfway through.
              </>
            ),
          },
          {
            t: "Let it listen",
            b: (
              <>
                The first run downloads a speech model (about 150 MB) and caches it — expect a wait once, then never
                again. Transcription uses your GPU through WebGPU where available and falls back to WebAssembly. A
                60-second clip typically takes well under a minute.
              </>
            ),
          },
          {
            t: "Fix the words",
            b: (
              <>
                Click any line to edit it; timings re-flow to match. Split a cue at a word, merge it with the next,
                nudge a start or end by a frame, or strip every "um" in one click. All of it undoes with{" "}
                <Strong>⌘Z</Strong>.
              </>
            ),
          },
          {
            t: "Style it",
            b: (
              <>
                Start from a preset, then change what you like: typeface, size, colour, outline, the karaoke highlight
                (recolour or box), a background pill, and position — which you can also just drag on the preview. What
                you see is what gets encoded; preview and export run the same renderer.
              </>
            ),
          },
          {
            t: "Export",
            b: (
              <>
                Captions are burned in at your source resolution, and the audio track is copied across untouched
                wherever the codec allows. You can also export a <Strong>.srt</Strong> or <Strong>.vtt</Strong> file
                instead, for platforms that want a separate subtitle track.
              </>
            ),
          },
        ].map((s, i) => (
          <li key={s.t} className="flex gap-4">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-[11px] font-semibold text-lime ring-1 ring-inset ring-line">
              {i + 1}
            </span>
            <span>
              <span className="block font-display text-[15px] font-semibold text-chalk">{s.t}</span>
              <span className="mt-1.5 block text-[14.5px] leading-relaxed text-ash">{s.b}</span>
            </span>
          </li>
        ))}
      </ol>

      <H2>Jima Motion, step by step</H2>
      <ol className="flex flex-col gap-5">
        {[
          {
            t: "Find a template",
            b: (
              <>
                All {TEMPLATE_COUNT} are grouped by what you're posting — social, product & ads, showcase,
                explainers & data, brand & quotes, openers, events & travel, overlays and text. Search by name, or
                favourite the ones you keep coming back to.
              </>
            ),
          },
          {
            t: "Make it yours",
            b: (
              <>
                Change the text, the colours, the fonts and any images. Switch aspect ratio at any point — 1:1, 4:5,
                9:16 and 16:9 all come from the same project, and the layout re-fits rather than cropping. Decorative
                accents can be switched off per template.
              </>
            ),
          },
          {
            t: "Set the pace",
            b: (
              <>
                Speed runs 0.25×–3× and the export honours it. You can trim the front, hold the last frame, dial the
                motion energy up or down, and loop. Optional sound is synthesised from the template's own timeline
                beats — no sample files, so it stays as private as everything else.
              </>
            ),
          },
          {
            t: "Export",
            b: (
              <>
                MP4 or WebM up to 1080p, or a GIF. WebM can be exported with a transparent background, for overlaying
                the animation onto footage in another editor.
              </>
            ),
          },
        ].map((s, i) => (
          <li key={s.t} className="flex gap-4">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-[11px] font-semibold text-lime ring-1 ring-inset ring-line">
              {i + 1}
            </span>
            <span>
              <span className="block font-display text-[15px] font-semibold text-chalk">{s.t}</span>
              <span className="mt-1.5 block text-[14.5px] leading-relaxed text-ash">{s.b}</span>
            </span>
          </li>
        ))}
      </ol>

      <H2>Browser support</H2>
      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2">
              <th scope="col" className="px-4 py-3 font-semibold text-chalk">Browser</th>
              <th scope="col" className="px-4 py-3 font-semibold text-chalk">Captions</th>
              <th scope="col" className="px-4 py-3 font-semibold text-chalk">Motion</th>
            </tr>
          </thead>
          <tbody className="text-ash">
            {[
              ["Chrome / Edge 113+", "Everything", "Everything"],
              ["Brave, Arc, Opera (Chromium)", "Everything", "Everything"],
              ["Safari 16.4+", "Everything", "Everything"],
              ["Firefox", "Not yet — no video encode", "Edit & export WebM / GIF"],
            ].map(([browser, cap, mot]) => (
              <tr key={browser} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium text-chalk">{browser}</td>
                <td className="px-4 py-3">{cap}</td>
                <td className="px-4 py-3">{mot}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <P>
        Both tools check for what they need on load and say so up front if something is missing, rather than failing
        at the export step. Mobile browsers can browse and edit; a long export is far happier on a desktop.
      </P>

      <H2>When something goes wrong</H2>

      <H3>My video is rejected</H3>
      <P>
        Captions takes <Strong>.mp4</Strong> only, up to 200 MB and 60 seconds. A <Strong>.mov</Strong> or{" "}
        <Strong>.webm</Strong> needs converting first. An .mp4 that still fails usually carries a video codec your
        browser cannot decode — H.264 is the safe choice.
      </P>

      <H3>Transcription is slow, or stuck at "loading model"</H3>
      <P>
        The first run downloads roughly 150 MB. On a slow connection that takes a while, and the progress bar is
        genuinely the download. If it never finishes, a network filter may be blocking the Hugging Face CDN. After the
        first success it is cached and works offline.
      </P>

      <H3>It transcribed the wrong language</H3>
      <P>
        Detection runs on the audio and can guess wrong on very short or noisy clips. Set the language explicitly in
        the transcript panel and run it again.
      </P>

      <H3>The export fails or produces a broken file</H3>
      <UL>
        <LI>Use Chrome or Edge — they have the most complete WebCodecs support.</LI>
        <LI>Close other heavy tabs. Encoding is memory-hungry, and a 1080p export needs real headroom.</LI>
        <LI>On a laptop, plug in: some browsers throttle hardware encoding on battery.</LI>
        <LI>In Motion, try GIF or WebM — they take a different code path from MP4.</LI>
      </UL>

      <H3>My project disappeared</H3>
      <P>
        Everything is stored in this browser only. A private window, cleared site data, a different browser or a
        different device all mean a different (or empty) store. There is no cloud copy to restore from — that is the
        trade for nothing ever being uploaded.
      </P>

      <H2>Keyboard shortcuts</H2>
      <div className="flex flex-wrap gap-2">
        {[
          ["⌘K", "Command palette"],
          ["⌘Z", "Undo"],
          ["⌘⇧Z", "Redo"],
          ["Space", "Play / pause"],
        ].map(([k, label]) => (
          <span key={k} className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-xs text-ash ring-1 ring-inset ring-line">
            <kbd className="font-mono text-[11px] font-semibold text-chalk">{k}</kbd>
            {label}
          </span>
        ))}
      </div>

      <H2>Still stuck?</H2>
      <P>
        Jima has no support inbox — it is a free tool with no account behind it. What it does have is honest
        limits: if a browser cannot do something, it says so rather than pretending. Check the{" "}
        <Link to="/whats-new" className="font-medium text-lime hover:text-lime-bright">
          release notes
        </Link>{" "}
        in case it is something recently changed.
      </P>

      <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-line pt-8">
        <Badge tone="lime">Free forever</Badge>
        <Link to="/" className={cn(buttonClasses("secondary", "sm"), "ml-auto")}>
          Back to Jima
        </Link>
      </div>
    </PageShell>
  );
}
