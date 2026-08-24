import { PageShell } from "@/shell/PageShell";
import { Callout, LI, P, Section, Strong, UL } from "@/shell/prose";

export default function Terms() {
  return (
    <PageShell
      eyebrow="Legal"
      title="Terms of Use"
      meta="Last updated 24 August 2026"
      intro={
        <>
          Short, plain terms for a tool with no account and no payment. Using Jima Captions or Jima Motion means you
          are fine with what's below.
        </>
      }
    >
      <div className="space-y-2">
        <Callout>
          <Strong>In one line:</Strong> Jima is free, everything you make is yours, and it comes with no warranty —
          keep your own backups of anything you care about.
        </Callout>

        <Section title="What you get">
          <P>
            Both tools are free to use, with no account, no payment, no quota, no watermark and no feature held back
            behind a plan. There is nothing to buy and nothing to cancel.
          </P>
        </Section>

        <Section title="What you make is yours">
          <P>
            Every file you export from Jima belongs to you, for any use — personal, commercial, client work,
            advertising, whatever you like. We claim no rights over it and there is no attribution requirement.
          </P>
          <P>
            The bundled templates and typefaces are licensed to permit this. The typefaces are all under the SIL Open
            Font License; the templates are ours and you may use their output freely. What you may not do is
            redistribute the template source or the font files as a product of your own.
          </P>
        </Section>

        <Section title="What you're responsible for">
          <UL>
            <LI>
              The content you put in. Do not use Jima to make material that is illegal, or to caption or animate media
              you have no right to use.
            </LI>
            <LI>
              Your own copies. Jima stores your work in your browser only. Clearing site data, using a private window,
              or a browser evicting storage under pressure will lose it, and we cannot recover it — nobody can, because
              no copy exists elsewhere.
            </LI>
            <LI>
              Checking your export. The tool is thorough, but automated transcription makes mistakes; read the
              transcript before you publish.
            </LI>
          </UL>
        </Section>

        <Section title="No warranty">
          <P>
            Jima is provided "as is", without warranty of any kind. It relies on browser features (WebCodecs, WebGPU,
            WebGL2, WebAssembly) whose behaviour differs between browsers and versions and which can change without
            notice. We do not guarantee that any particular file will import, transcribe, render or export correctly.
          </P>
          <P>
            To the extent permitted by law, we are not liable for lost work, lost time, or any damages arising from
            using — or being unable to use — Jima.
          </P>
        </Section>

        <Section title="Availability">
          <P>
            Jima is a personal project offered as a courtesy. There is no service-level commitment, and the site may
            change or become unavailable at any time. Because everything runs client-side, anything you have already
            exported keeps working regardless.
          </P>
        </Section>

        <Section title="Changes to these terms">
          <P>If these terms change, the date at the top changes with them.</P>
        </Section>
      </div>
    </PageShell>
  );
}
