import { PageShell } from "@/shell/PageShell";
import { Callout, LI, P, Section, Strong, UL } from "@/shell/prose";

export default function Privacy() {
  return (
    <PageShell
      eyebrow="Legal"
      title="Privacy Policy"
      meta="Last updated 24 August 2026"
      intro={
        <>
          Jima is built so privacy isn't a promise you have to take on trust — it's how the tool works. Here is
          exactly what happens to your data in both Jima Captions and Jima Motion.
        </>
      }
    >
      <div className="space-y-2">
        <Callout>
          <Strong>The short version:</Strong> your videos, audio, images and text are processed entirely inside your
          browser, on your own device. They are never uploaded to us or to anyone else. Jima has no accounts, no
          cookies, no analytics and no tracking of any kind.
        </Callout>

        <Section title="Why we can say that">
          <P>
            Jima has no backend. What we deploy is a folder of static files — HTML, JavaScript, fonts and a WebAssembly
            runtime — served from a CDN. There is no application server, no database and no storage bucket. Even if we
            wanted your footage, there is nothing on our side that could receive it.
          </P>
          <P>
            You do not have to take our word for this. Open your browser's network tab while you work, or disconnect
            from the internet after the page has loaded: both tools keep working.
          </P>
        </Section>

        <Section title="What happens to your media">
          <P>In Jima Captions, everything below runs locally:</P>
          <UL>
            <LI>Your .mp4 is read from disk and decoded by your browser. It is never sent anywhere.</LI>
            <LI>
              Transcription runs a speech-recognition model <em>on your device</em>, through WebGPU or WebAssembly.
              Your audio never leaves the browser tab.
            </LI>
            <LI>Captions are drawn, and the video re-encoded, by your own CPU/GPU.</LI>
            <LI>
              The exported file is created in the browser and handed to your normal download — it does not pass through
              any server.
            </LI>
          </UL>
          <P>In Jima Motion, the same holds for the text and images you add and for every frame it renders.</P>
        </Section>

        <Section title="The only network requests Jima makes">
          <UL>
            <LI>
              <Strong>The app itself</Strong> — HTML, JavaScript, CSS and self-hosted fonts, from our own origin. No
              font CDN is used, because that would hand a third party your IP address on every page load.
            </LI>
            <LI>
              <Strong>The speech model, once.</Strong> The first time you transcribe, Captions downloads an
              open-source Whisper model (roughly 150 MB) from the Hugging Face CDN and your browser caches it. That
              request is identical for every user and contains none of your data. Afterwards, transcription works
              offline.
            </LI>
            <LI>
              <Strong>The ONNX runtime</Strong> that executes the model — served from our own origin, not a
              third-party CDN.
            </LI>
          </UL>
          <P>That is the complete list. There is no analytics beacon, no error reporting and no telemetry.</P>
        </Section>

        <Section title="What is stored on your device">
          <P>
            So you can pick up where you left off, Jima saves a small amount of data in your browser's own storage
            (<Strong>localStorage</Strong> and <Strong>IndexedDB</Strong>):
          </P>
          <UL>
            <LI>Your open Motion project — template, text, colours, settings and any images you added.</LI>
            <LI>Your caption style and chosen language, so a new video starts the way you like it.</LI>
            <LI>Your brand kit — three colours and two typeface choices.</LI>
            <LI>Your recent projects list, and which templates you have favourited.</LI>
          </UL>
          <P>
            This lives only on this device, in this browser. It is never transmitted to us, and we have no way to read
            it. You can delete all of it from the <Strong>Projects</Strong> page, or by clearing your browser's site
            data — and when you do, it is genuinely gone, because no copy exists anywhere else.
          </P>
          <P>
            Your source video is <Strong>never</Strong> written to storage. It exists only in memory while the tab is
            open.
          </P>
        </Section>

        <Section title="Cookies">
          <P>Jima sets no cookies. There is no consent banner because there is nothing to consent to.</P>
        </Section>

        <Section title="Hosting">
          <P>
            The static files are served by Vercel, which — like any web host — processes standard request data such as
            IP addresses in order to deliver the page. That is the ordinary mechanics of loading a website and applies
            to the app shell only; your media is never part of a request.
          </P>
        </Section>

        <Section title="Children">
          <P>
            Jima collects no personal data from anyone, of any age, because it collects no personal data at all.
          </P>
        </Section>

        <Section title="Changes">
          <P>
            If this policy ever changes, the date at the top changes with it. Any change that weakened the guarantees
            above would require rebuilding Jima around a server, which is not a direction this project is going.
          </P>
        </Section>
      </div>
    </PageShell>
  );
}
