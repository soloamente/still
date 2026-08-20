import { env } from "@still/env/server";

/** Default public funding bar target when env is unset or invalid. */
export const DISCORD_ACTIVITY_PRO_TARGET_DEFAULT = 50;

/**
 * Parse `DISCORD_ACTIVITY_PRO_TARGET` from raw env text.
 * Returns the default when missing, non-numeric, or not a positive integer.
 */
export function parseDiscordActivityProTarget(raw: string | undefined): number {
	if (raw == null) return DISCORD_ACTIVITY_PRO_TARGET_DEFAULT;
	const n = Number.parseInt(raw.trim(), 10);
	if (!Number.isFinite(n) || n < 1) return DISCORD_ACTIVITY_PRO_TARGET_DEFAULT;
	return n;
}

/** Resolved Pro target from server env — defaults to 50 when unset/invalid. */
export function getDiscordActivityProTarget(): number {
	return parseDiscordActivityProTarget(env.DISCORD_ACTIVITY_PRO_TARGET);
}
