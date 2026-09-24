import type { TasteMatchMovie } from "@/lib/taste-matched-discovery";

/**
 * Session-scoped link between the Today pick and its title page:
 * - detail shows a small **Today’s pick** cue + the same reason line as Home;
 * - logging / watchlisting on detail marks the pick complete, so Home (which
 *   unmounted on navigation) restores it as done instead of rotating it away.
 * Not a DB flag — cleared on **Pick another** / **Not interested** or after the TTL.
 */

export const TODAY_PICK_CONTINUITY_KEY = "still:today-pick:v1";

/** Long enough for a detail visit + back; short enough that tomorrow's pick starts clean. */
export const TODAY_PICK_CONTINUITY_TTL_MS = 2 * 60 * 60 * 1000;

export type TodayPickCompletedVia = "diary" | "watchlist";

export type TodayPickContinuity = {
	tmdbId: number;
	mediaKind: "movie" | "tv";
	/** Home's one-line reason (e.g. "Because you gravitate toward thrillers"). */
	reason: string;
	/** Snapshot so Home can re-show the finished pick after the server drops it. */
	film: TasteMatchMovie;
	setAt: number;
	completedVia: TodayPickCompletedVia | null;
};

export type TodayPickContinuityStorage = Pick<
	Storage,
	"getItem" | "setItem" | "removeItem"
>;

type StorageOpts = {
	/** `null` = no storage (SSR, blocked); omitted = `window.sessionStorage`. */
	storage?: TodayPickContinuityStorage | null;
	now?: number;
	/** Which Today tab's pick to read/write — movie uses legacy `still:today-pick:v1`. */
	media?: "movie" | "tv";
};

/** Session storage key per catalogue (movies and TV do not share one slot). */
export function todayPickContinuityKey(
	media: "movie" | "tv" = "movie",
): string {
	return media === "tv" ? "still:today-pick:v1:tv" : TODAY_PICK_CONTINUITY_KEY;
}

function resolveStorage(opts?: StorageOpts): TodayPickContinuityStorage | null {
	if (opts && "storage" in opts) return opts.storage ?? null;
	if (typeof window === "undefined") return null;
	try {
		return window.sessionStorage;
	} catch {
		// Safari private mode / blocked storage.
		return null;
	}
}

function safeRemove(storage: TodayPickContinuityStorage, key: string) {
	try {
		storage.removeItem(key);
	} catch {
		// Storage can throw when disabled — continuity is best-effort.
	}
}

function isFilmSnapshot(value: unknown): value is TasteMatchMovie {
	if (value == null || typeof value !== "object") return false;
	const film = value as Partial<TasteMatchMovie>;
	return typeof film.tmdbId === "number" && typeof film.title === "string";
}

function parseEntry(
	raw: string | null,
	expectedMediaKind: "movie" | "tv",
): TodayPickContinuity | null {
	if (!raw) return null;
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return null;
	}
	if (data == null || typeof data !== "object") return null;
	const entry = data as Partial<TodayPickContinuity>;
	if (
		typeof entry.tmdbId !== "number" ||
		entry.mediaKind !== expectedMediaKind ||
		typeof entry.reason !== "string" ||
		typeof entry.setAt !== "number" ||
		!isFilmSnapshot(entry.film) ||
		entry.film.tmdbId !== entry.tmdbId
	) {
		return null;
	}
	const completedVia =
		entry.completedVia === "diary" || entry.completedVia === "watchlist"
			? entry.completedVia
			: null;
	return {
		tmdbId: entry.tmdbId,
		mediaKind: expectedMediaKind,
		reason: entry.reason,
		film: entry.film,
		setAt: entry.setAt,
		completedVia,
	};
}

function writeEntry(
	storage: TodayPickContinuityStorage,
	key: string,
	entry: TodayPickContinuity,
) {
	try {
		storage.setItem(key, JSON.stringify(entry));
	} catch {
		// Quota / disabled storage — the cue simply won't show.
	}
}

/** Called when the patron opens the Today pick's title page. */
export function writeTodayPickContinuity(
	input: { film: TasteMatchMovie; reason: string; media?: "movie" | "tv" },
	opts?: StorageOpts,
): void {
	const storage = resolveStorage(opts);
	if (!storage) return;
	const media = input.media ?? "movie";
	const key = todayPickContinuityKey(media);
	const previous = parseEntry(readRaw(storage, key), media);
	writeEntry(storage, key, {
		tmdbId: input.film.tmdbId,
		mediaKind: media,
		reason: input.reason,
		film: input.film,
		setAt: opts?.now ?? Date.now(),
		// Re-opening the same finished pick keeps its completion.
		completedVia:
			previous?.tmdbId === input.film.tmdbId ? previous.completedVia : null,
	});
}

function readRaw(
	storage: TodayPickContinuityStorage,
	key: string,
): string | null {
	try {
		return storage.getItem(key);
	} catch {
		return null;
	}
}

/** Current entry, or `null` when missing / malformed / expired (those are removed). */
export function readTodayPickContinuity(
	opts?: StorageOpts,
): TodayPickContinuity | null {
	const storage = resolveStorage(opts);
	if (!storage) return null;
	const media = opts?.media ?? "movie";
	const key = todayPickContinuityKey(media);
	const raw = readRaw(storage, key);
	const entry = parseEntry(raw, media);
	const now = opts?.now ?? Date.now();
	if (!entry || now - entry.setAt > TODAY_PICK_CONTINUITY_TTL_MS) {
		if (raw != null) safeRemove(storage, key);
		return null;
	}
	return entry;
}

export function clearTodayPickContinuity(opts?: StorageOpts): void {
	const storage = resolveStorage(opts);
	if (!storage) return;
	const key = todayPickContinuityKey(opts?.media ?? "movie");
	safeRemove(storage, key);
}

/**
 * Mark the continuity pick finished from any surface (detail Quick Log,
 * watchlist). Other titles are ignored; a diary log is never downgraded.
 */
export function markTodayPickContinuityCompleted(
	tmdbId: number,
	via: TodayPickCompletedVia,
	opts?: StorageOpts,
): void {
	const storage = resolveStorage(opts);
	if (!storage) return;
	const media = opts?.media ?? "movie";
	const key = todayPickContinuityKey(media);
	const entry = readTodayPickContinuity({ storage, now: opts?.now, media });
	if (!entry || entry.tmdbId !== tmdbId) return;
	if (entry.completedVia === "diary") return;
	writeEntry(storage, key, { ...entry, completedVia: via });
}

/** Detail cue for this title, or `null` when it wasn't opened from the Today pick. */
export function todayPickDetailCue(
	entry: TodayPickContinuity | null,
	mediaKind: "movie" | "tv",
	tmdbId: number,
): { reason: string } | null {
	if (!entry || entry.mediaKind !== mediaKind || entry.tmdbId !== tmdbId) {
		return null;
	}
	return { reason: entry.reason };
}
