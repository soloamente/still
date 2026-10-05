/** Personal unpacked build talks to local Sense. A production host comes later. */
export const SENSE_COMPANION_ORIGIN = "http://127.0.0.1:3001";

/**
 * Elysia on this PC. Watching heartbeats go here so the Next `/api` rewrite
 * cannot drop the POST body.
 */
export const SENSE_COMPANION_API_ORIGIN = "http://127.0.0.1:3000";
