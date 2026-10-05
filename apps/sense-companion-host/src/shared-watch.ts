import {
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import type { CompanionActivityMessage } from "./companion-message";

/**
 * Chrome starts one helper per browser. They do not share memory, so the
 * browser that is paired cannot see playback from the other one unless both
 * write it here. The pairing token never goes in these files.
 */
export const SHARED_WATCH_TTL_MS = 90_000;

export type SharedWatchEntry = {
	updatedAt: number;
	message: CompanionActivityMessage;
};

export function sharedWatchDirectory(): string {
	const base =
		process.env.LOCALAPPDATA ||
		process.env.XDG_DATA_HOME ||
		path.join(os.homedir(), ".local", "share");
	return path.join(base, "Sense", "companion-watch");
}

export function readSourceId(value: unknown): string | null {
	if (typeof value !== "object" || value === null) return null;
	const sourceId = (value as { sourceId?: unknown }).sourceId;
	if (typeof sourceId !== "string") return null;
	const trimmed = sourceId.trim();
	if (trimmed.length === 0 || trimmed.length > 80) return null;
	return trimmed;
}

/** One file per browser so two helpers can write at the same time. */
export function sourceFileName(sourceId: string): string {
	const safe = sourceId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
	return `${safe || "unknown"}.json`;
}

/** Drop anything except the playback fields. The pairing token must not be stored. */
export function snapshotWithoutToken(
	message: CompanionActivityMessage,
): CompanionActivityMessage {
	if (message.type === "sense-companion:clear") {
		return { type: message.type, service: message.service };
	}
	return {
		type: message.type,
		service: message.service,
		activity: message.activity,
		senseMedia: message.senseMedia,
		presenceMode: message.presenceMode,
		pagePath: message.pagePath,
		discordFields: message.discordFields,
		profileButtonUrl: message.profileButtonUrl,
		...(message.titleButtonUrl
			? { titleButtonUrl: message.titleButtonUrl }
			: {}),
	};
}

export function isFreshWatch(entry: SharedWatchEntry, now: number): boolean {
	return now - entry.updatedAt <= SHARED_WATCH_TTL_MS && entry.updatedAt <= now;
}

function isPlaying(
	message: CompanionActivityMessage,
): message is Extract<
	CompanionActivityMessage,
	{ type: "sense-companion:activity" }
> {
	return (
		message.type === "sense-companion:activity" && message.senseMedia !== null
	);
}

/**
 * A browser that is still playing wins over another browser that sent clear.
 * Two playing browsers: the newer update wins.
 */
export function pickSharedWatch(
	entries: readonly SharedWatchEntry[],
	now: number,
): CompanionActivityMessage | null {
	let playing: SharedWatchEntry | null = null;
	let cleared: SharedWatchEntry | null = null;
	for (const entry of entries) {
		if (!isFreshWatch(entry, now)) continue;
		if (isPlaying(entry.message)) {
			if (!playing || entry.updatedAt >= playing.updatedAt) playing = entry;
			continue;
		}
		if (!cleared || entry.updatedAt >= cleared.updatedAt) cleared = entry;
	}
	return playing?.message ?? cleared?.message ?? null;
}

export function writeSourceSnapshot(
	directory: string,
	sourceId: string,
	message: CompanionActivityMessage,
	now: number,
): void {
	mkdirSync(directory, { recursive: true });
	const file = path.join(directory, sourceFileName(sourceId));
	const tmp = `${file}.${process.pid}.tmp`;
	const entry: SharedWatchEntry = { updatedAt: now, message };
	writeFileSync(tmp, JSON.stringify(entry));
	renameSync(tmp, file);
}

export function readSharedWatch(
	directory: string,
	now: number,
): SharedWatchEntry[] {
	let names: string[] = [];
	try {
		names = readdirSync(directory);
	} catch {
		return [];
	}
	const entries: SharedWatchEntry[] = [];
	for (const name of names) {
		if (!name.endsWith(".json")) continue;
		const file = path.join(directory, name);
		let entry: SharedWatchEntry | null = null;
		try {
			entry = JSON.parse(readFileSync(file, "utf8")) as SharedWatchEntry;
		} catch {
			continue;
		}
		if (
			!entry ||
			typeof entry.updatedAt !== "number" ||
			!entry.message ||
			typeof entry.message !== "object"
		) {
			continue;
		}
		if (!isFreshWatch(entry, now)) {
			try {
				unlinkSync(file);
			} catch {
				// The other helper may be replacing this file.
			}
			continue;
		}
		entries.push(entry);
	}
	return entries;
}
