import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { templates } from "@jima/templates";
import type { TemplateDefinition } from "@jima/engine";
import { useMotionStore } from "./state/store";
import { Gallery } from "./gallery/Gallery";
import { Editor } from "./editor/Editor";
import { CapabilityFloor, hasWebGL2 } from "@/shell/CapabilityFloor";
import {
  deleteProject,
  loadProject,
  loadProjectFor,
  resolveImageValues,
  saveProject,
  type PersistedProject,
} from "./state/persistence";

export function MotionApp() {
  const [supported] = useState(hasWebGL2);
  const def = useMotionStore((s) => s.def);
  const openTemplate = useMotionStore((s) => s.openTemplate);
  const close = useMotionStore((s) => s.close);
  const [resume, setResume] = useState<PersistedProject | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const allTemplates = useMemo(() => templates, []);

  useEffect(() => {
    document.title = `Jima Motion — animated posts from ${templates.length} templates`;
  }, []);

  /** Open a template, restoring its saved project if there is one. */
  const openWithSaved = useCallback(
    async (target: TemplateDefinition, saved: PersistedProject | null) => {
      if (!saved || saved.templateId !== target.id) {
        openTemplate(target);
        return;
      }
      const values = await resolveImageValues(saved.values);
      openTemplate(target, {
        aspect: saved.aspect,
        paletteId: saved.paletteId,
        font: saved.font,
        bodyFont: saved.bodyFont,
        values,
        speed: saved.speed,
        energy: saved.energy ?? 1,
        trim: saved.trim ?? 0,
        hold: saved.hold ?? 0,
        loop: saved.loop,
      });
    },
    [openTemplate],
  );

  // Deep-link (?t=<id>) and restore-on-load. Runs once: after this the URL is
  // driven by the open template, not the other way round.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (!supported || bootstrapped.current) return;
    bootstrapped.current = true;

    setResume(loadProject());
    const wanted = searchParams.get("t");
    if (!wanted) return;
    const target = allTemplates.find((t) => t.id === wanted);
    if (target) void openWithSaved(target, loadProjectFor(target.id));
  }, [supported, allTemplates, openWithSaved, searchParams]);

  // Keep ?t= in sync with the open template, without pushing history entries.
  useEffect(() => {
    if (!bootstrapped.current) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (def) next.set("t", def.id);
        else next.delete("t");
        return next;
      },
      { replace: true },
    );
  }, [def, setSearchParams]);

  // Debounced autosave of the editable slice.
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!supported) return;
    const unsub = useMotionStore.subscribe((s) => {
      if (!s.templateId) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        saveProject({
          templateId: s.templateId!,
          aspect: s.aspect,
          ...(s.paletteId ? { paletteId: s.paletteId } : {}),
          ...(s.font ? { font: s.font } : {}),
          ...(s.bodyFont ? { bodyFont: s.bodyFont } : {}),
          values: s.values,
          speed: s.speed,
          energy: s.energy,
          trim: s.trim,
          hold: s.hold,
          loop: s.loop,
        });
      }, 500);
    });
    return () => {
      unsub();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [supported]);

  if (!supported) {
    return (
      <CapabilityFloor
        product="motion"
        title="This browser can't run Motion yet"
        body="Motion renders every frame on your device with WebGL2, which this browser doesn't provide."
        missing={["WebGL2"]}
      />
    );
  }

  if (def) {
    return <Editor def={def} templates={allTemplates} onBack={close} />;
  }

  return (
    <Gallery
      templates={allTemplates}
      resume={resume}
      onOpen={(t: TemplateDefinition) => openTemplate(t)}
      onResume={async () => {
        if (!resume) return;
        const target = allTemplates.find((t) => t.id === resume.templateId);
        if (!target) return;
        await openWithSaved(target, resume);
      }}
      onDismissResume={() => {
        // Dismiss deletes the saved project — the same thing this button has
        // always done — so it also disappears from /projects. The button says
        // so; anything softer would leave a "dismissed" project lingering in
        // the library with no way to tell it apart.
        if (resume) void deleteProject(resume.templateId);
        setResume(null);
      }}
    />
  );
}
