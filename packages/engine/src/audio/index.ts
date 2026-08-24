// Sound layer public surface. Cues are derived from a timeline's motion beats and
// the template's sound profile; the synth turns each cue into a stack of
// procedurally-voiced Web Audio layers (live for preview, offline for export).
// Sound never affects the visual render or golden frames.
export * from "./profile";
export * from "./cues";
export * from "./music";
export * from "./voices";
export * from "./sfx";
export * from "./scheduler";
