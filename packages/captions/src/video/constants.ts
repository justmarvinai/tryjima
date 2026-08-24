/** Input limits for uploaded videos. See CLAUDE.md — these are hard product constraints. */

export const MAX_FILE_BYTES = 200 * 1024 * 1024; // 200 MB
export const MAX_FILE_MB = 200;

/** Advertised duration limit, shown to users. */
export const MAX_DURATION_SECONDS = 60;

/**
 * Slack added on top of the limit before rejecting. Container durations often
 * land a hair over a round number (e.g. 60.04 s), so we accept up to ~61 s and
 * still call it "60 seconds" in the UI.
 */
export const DURATION_TOLERANCE_SECONDS = 1;

/** Effective hard cutoff used by validation. */
export const DURATION_CUTOFF_SECONDS = MAX_DURATION_SECONDS + DURATION_TOLERANCE_SECONDS;

export const ACCEPTED_MIME_TYPES = ['video/mp4'] as const;
export const ACCEPTED_EXTENSIONS = ['.mp4'] as const;

/** `accept` attribute for the file <input>. */
export const FILE_INPUT_ACCEPT = 'video/mp4,.mp4';
