// @jima/captions — the Jima Captions engine.
//
// On-device speech-to-text (Whisper via transformers.js), a word-level cue
// model, one pure caption renderer shared by preview and export, and a
// WebCodecs burn-in pipeline. No network calls beyond the one-time model
// download; no user media ever leaves the device.
export * from "./captions/index";
export * from "./video/index";
export * from "./fonts/index";
export * from "./platform/index";
export * from "./format";
export { CAPTIONS_STRINGS } from "./i18n";
