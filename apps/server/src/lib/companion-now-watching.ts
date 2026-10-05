import { z } from "zod";

import { resolveCompanionEpisodeTitle } from "./companion-episode-name";

/** A missed heartbeat drops the row. Shorter than PreMiD's 20-minute forwarding timeout. */
export const COMPANION_HEARTBEAT_TTL_MS = 90_000;

/** Same title cannot stay on the profile longer than this when runtime is unknown. */
export const COMPANION_HARD_STOP_MS = 20 * 60 * 1000;

/** Extra wall-clock after reported runtime so credits still show on profile. */
export const COMPANION_HARD_STOP_CREDITS_BUFFER_MS = 15 * 60 * 1000;

/**
 * Profile row TTL for one title: at least 20 minutes, or reported runtime plus
 * credits buffer when the player sends a trustworthy duration.
 */
export function companionProfileHardStopMs(
	durationSec: number | null | undefined,
): number {
	if (
		durationSec == null ||
		!Number.isFinite(durationSec) ||
		durationSec <= 0
	) {
		return COMPANION_HARD_STOP_MS;
	}
	const runtimeMs = durationSec * 1000 + COMPANION_HARD_STOP_CREDITS_BUFFER_MS;
	return Math.max(COMPANION_HARD_STOP_MS, runtimeMs);
}

/** TMDb matches are stable; don't search again on every playback tick. */
export const COMPANION_MATCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const WATCH_PREFIX = "sense:companion:watching:v1:";
const SUPPRESS_PREFIX = "sense:companion:watching-stop:v1:";
const MATCH_PREFIX = "sense:companion:match:v1:";

export const companionNowWatchingBody = z.object({
	clear: z.boolean().optional(),
	paused: z.boolean().optional(),
	media: z
		.object({
			provider: z.enum([
				"netflix",
				"disney",
				"hotstar",
				"prime",
				"apple",
				"max",
				"web",
			]),
			/** Display name for `web` players (the site, not the word Web). */
			serviceLabel: z.string().trim().min(1).max(80).optional(),
			kind: z.enum(["movie", "episode"]),
			title: z.string().trim().min(1).max(300),
			season: z.number().int().nullable(),
			episode: z.number().int().nullable(),
			episodeTitle: z.string().trim().min(1).max(300).optional(),
			positionSec: z.number().nullable(),
			durationSec: z.number().nullable(),
		})
		.nullable()
		.optional(),
});

export type CompanionNowWatchingBody = z.infer<typeof companionNowWatchingBody>;

export type CompanionMatchCandidate = {
	id: number;
	title: string;
	posterPath?: string | null;
};

export type CompanionNowWatchingView = {
	title: string;
	provider:
		| "netflix"
		| "disney"
		| "hotstar"
		| "prime"
		| "apple"
		| "max"
		| "web";
	/** Set when the player is a site outside the built-in services. */
	serviceLabel?: string;
	kind: "movie" | "tv";
	tmdbId: number | null;
	href: string | null;
	season: number | null;
	episode: number | null;
	/** Episode name when it differs from the show title. */
	episodeTitle?: string | null;
	positionSec: number | null;
	durationSec: number | null;
	paused: boolean;
	updatedAt: string;
	/** TMDb poster, sized for the profile row. Omitted when the match has no art. */
	posterUrl?: string | null;
};

type StoredWatch = {
	titleKey: string;
	startedAt: number;
	/** Browser that reported this title. Another browser's clear must not drop it. */
	deviceId: string | null;
	payload: CompanionNowWatchingView;
};

export type CompanionWatchingStore = {
	get(key: string, now: number): Promise<string | null>;
	set(key: string, value: string, expiresAt: number): Promise<void>;
	del(key: string): Promise<void>;
};

export type CompanionTitleSearch = (input: {
	kind: "movie" | "episode";
	title: string;
}) => Promise<CompanionMatchCandidate[]>;

/** Lowercase, drop punctuation, collapse spaces. `Stranger Things` matches `stranger things`. */
export function normalizeCompanionTitle(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

export function pickCompanionMatch(
	query: string,
	candidates: readonly CompanionMatchCandidate[],
): CompanionMatchCandidate | null {
	const wanted = normalizeCompanionTitle(query);
	if (!wanted) return null;
	const exact = candidates.find(
		(candidate) => normalizeCompanionTitle(candidate.title) === wanted,
	);
	return exact ?? candidates[0] ?? null;
}

export function companionWatchHref(
	kind: "movie" | "tv",
	tmdbId: number,
): string {
	return kind === "movie" ? `/movies/${tmdbId}` : `/tv/${tmdbId}`;
}

/** Profile-sized TMDb poster. Paths from search already start with `/`. */
export function companionPosterUrl(
	posterPath: string | null | undefined,
): string | null {
	if (!posterPath?.startsWith("/")) return null;
	return `https://image.tmdb.org/t/p/w342${posterPath}`;
}

/**
 * One profile session.
 * Season and episode are part of the key so autoplay of the next episode
 * starts a new row. A show-only key kept the previous episode's hide alive.
 */
function titleKey(body: CompanionNowWatchingBody): string | null {
	const media = body.media;
	if (!media) return null;
	const title = normalizeCompanionTitle(media.title);
	if (media.kind === "movie") return `${media.provider}|movie|${title}`;
	return `${media.provider}|episode|${title}|${media.season ?? ""}|${media.episode ?? ""}`;
}

/** Replay or the next episode landing on the opening seconds. */
function isPlayheadAtStart(positionSec: number | null | undefined): boolean {
	return (
		typeof positionSec === "number" &&
		Number.isFinite(positionSec) &&
		positionSec >= 0 &&
		positionSec <= 20
	);
}

export class CompanionNowWatching {
	private readonly now: () => number;

	constructor(
		private readonly store: CompanionWatchingStore,
		private readonly search: CompanionTitleSearch,
		options: { now?: () => number } = {},
	) {
		this.now = options.now ?? Date.now;
	}

	async heartbeat(
		userId: string,
		body: CompanionNowWatchingBody,
		deviceId?: string,
	): Promise<CompanionNowWatchingView | null> {
		if (body.clear || !body.media) {
			const now = this.now();
			const existing = await this.readStored(userId, now);
			// The idle browser says nothing is playing. Leave the other browser's title up.
			if (deviceId && existing?.deviceId && existing.deviceId !== deviceId) {
				return existing.payload;
			}
			await this.clear(userId);
			return null;
		}

		const now = this.now();
		const key = titleKey(body);
		if (!key) {
			await this.clear(userId);
			return null;
		}

		// Build the view from the heartbeat body even when the profile row is
		// hard-stopped. Auto-log reads playhead from this return value, not Redis.
		const view = await this.buildView(body, now);
		if (!view) {
			await this.clear(userId);
			return null;
		}

		const suppressKey = `${SUPPRESS_PREFIX}${userId}`;
		const suppressed = await this.store.get(suppressKey, now);
		// A new play from the start is a new session, even when the hide is still set.
		const restart =
			suppressed === key && isPlayheadAtStart(body.media?.positionSec);
		if (suppressed === key && !restart) {
			await this.store.set(suppressKey, key, now + COMPANION_HEARTBEAT_TTL_MS);
			await this.store.del(`${WATCH_PREFIX}${userId}`);
			return view;
		}
		if (restart) await this.store.del(suppressKey);

		const existing = await this.readStored(userId, now);
		const sameTitle = !restart && existing?.titleKey === key;
		const startedAt = sameTitle ? existing.startedAt : now;
		const hardStopMs = companionProfileHardStopMs(view.durationSec);
		if (now >= startedAt + hardStopMs) {
			await this.store.del(`${WATCH_PREFIX}${userId}`);
			await this.store.set(suppressKey, key, now + COMPANION_HEARTBEAT_TTL_MS);
			return view;
		}

		const stored: StoredWatch = {
			titleKey: key,
			startedAt,
			deviceId: deviceId ?? existing?.deviceId ?? null,
			payload: view,
		};
		await this.store.set(
			`${WATCH_PREFIX}${userId}`,
			JSON.stringify(stored),
			now + COMPANION_HEARTBEAT_TTL_MS,
		);
		return view;
	}

	async read(userId: string): Promise<CompanionNowWatchingView | null> {
		const stored = await this.readStored(userId, this.now());
		if (!stored) return null;
		const hardStopMs = companionProfileHardStopMs(stored.payload.durationSec);
		if (this.now() >= stored.startedAt + hardStopMs) {
			const now = this.now();
			await this.store.del(`${WATCH_PREFIX}${userId}`);
			await this.store.set(
				`${SUPPRESS_PREFIX}${userId}`,
				stored.titleKey,
				now + COMPANION_HEARTBEAT_TTL_MS,
			);
			return null;
		}
		return stored.payload;
	}

	private async clear(userId: string): Promise<void> {
		await this.store.del(`${WATCH_PREFIX}${userId}`);
		await this.store.del(`${SUPPRESS_PREFIX}${userId}`);
	}

	/** Match TMDb and shape the payload the profile row and auto-log share. */
	private async buildView(
		body: CompanionNowWatchingBody,
		now: number,
	): Promise<CompanionNowWatchingView | null> {
		const media = body.media;
		if (!media) return null;
		const matched = await this.matchTitle(media.kind, media.title, now);
		const profileKind = media.kind === "movie" ? "movie" : "tv";
		const posterUrl = companionPosterUrl(matched?.posterPath);
		const episodeTitle =
			media.kind === "episode"
				? await resolveCompanionEpisodeTitle({
						tmdbId: matched?.id ?? null,
						season: media.season,
						episode: media.episode,
						episodeTitle: media.episodeTitle,
					})
				: null;
		return {
			title: matched?.title ?? media.title,
			provider: media.provider,
			kind: profileKind,
			tmdbId: matched?.id ?? null,
			href: matched ? companionWatchHref(profileKind, matched.id) : null,
			season: media.season,
			episode: media.episode,
			...(episodeTitle ? { episodeTitle } : {}),
			positionSec: media.positionSec,
			durationSec: media.durationSec,
			paused: body.paused === true,
			updatedAt: new Date(now).toISOString(),
			...(posterUrl ? { posterUrl } : {}),
			...(media.provider === "web" && media.serviceLabel
				? { serviceLabel: media.serviceLabel }
				: {}),
		};
	}

	private async readStored(
		userId: string,
		now: number,
	): Promise<StoredWatch | null> {
		const raw = await this.store.get(`${WATCH_PREFIX}${userId}`, now);
		if (!raw) return null;
		try {
			return JSON.parse(raw) as StoredWatch;
		} catch {
			return null;
		}
	}

	private async matchTitle(
		kind: "movie" | "episode",
		title: string,
		now: number,
	): Promise<CompanionMatchCandidate | null> {
		const cacheKey = `${MATCH_PREFIX}${kind}:${normalizeCompanionTitle(title)}`;
		const cached = await this.store.get(cacheKey, now);
		if (cached !== null) {
			if (cached === "null") return null;
			try {
				return JSON.parse(cached) as CompanionMatchCandidate;
			} catch {
				return null;
			}
		}
		const picked = pickCompanionMatch(
			title,
			await this.search({ kind, title }),
		);
		await this.store.set(
			cacheKey,
			JSON.stringify(picked),
			now + COMPANION_MATCH_CACHE_TTL_MS,
		);
		return picked;
	}
}

type MemoryRow = { value: string; expiresAt: number };

/** Test store. Entries disappear once `now` passes `expiresAt`. */
export class MemoryCompanionWatchingStore implements CompanionWatchingStore {
	private readonly rows = new Map<string, MemoryRow>();

	async get(key: string, now: number): Promise<string | null> {
		const row = this.rows.get(key);
		if (!row || row.expiresAt <= now) {
			this.rows.delete(key);
			return null;
		}
		return row.value;
	}

	async set(key: string, value: string, expiresAt: number): Promise<void> {
		this.rows.set(key, { value, expiresAt });
	}

	async del(key: string): Promise<void> {
		this.rows.delete(key);
	}
}
