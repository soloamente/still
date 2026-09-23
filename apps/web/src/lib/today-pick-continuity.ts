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
	mediaKind: "movie";
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
};

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

function safeRemove(storage: TodayPickContinuityStorage) {
	try {
		storage.removeItem(TODAY_PICK_CONTINUITY_KEY);
	} catch {
		// Storage can throw when disabled — continuity is best-effort.
	}
}

function isFilmSnapshot(value: unknown): value is TasteMatchMovie {
	if (value == null || typeof value !== "object") return false;
	const film = value as Partial<TasteMatchMovie>;
	return typeof film.tmdbId === "number" && typeof film.title === "string";
}

function parseEntry(raw: string | null): TodayPickContinuity | null {
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
		entry.mediaKind !== "movie" ||
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
		mediaKind: "movie",
		reason: entry.reason,
		film: entry.film,
		setAt: entry.setAt,
		completedVia,
	};
}

function writeEntry(
	storage: TodayPickContinuityStorage,
	entry: TodayPickContinuity,
) {
	try {
		storage.setItem(TODAY_PICK_CONTINUITY_KEY, JSON.stringify(entry));
	} catch {
		// Quota / disabled storage — the cue simply won't show.
	}
}

/** Called when the patron opens the Today pick's title page. */
export function writeTodayPickContinuity(
	input: { film: TasteMatchMovie; reason: string },
	opts?: StorageOpts,
): void {
	const storage = resolveStorage(opts);
	if (!storage) return;
	const previous = parseEntry(readRaw(storage));
	writeEntry(storage, {
		tmdbId: input.film.tmdbId,
		mediaKind: "movie",
		reason: input.reason,
		film: input.film,
		setAt: opts?.now ?? Date.now(),
		// Re-opening the same finished pick keeps its completion.
		completedVia:
			previous?.tmdbId === input.film.tmdbId ? previous.completedVia : null,
	});
}

function readRaw(storage: TodayPickContinuityStorage): string | null {
	try {
		return storage.getItem(TODAY_PICK_CONTINUITY_KEY);
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
	const raw = readRaw(storage);
	const entry = parseEntry(raw);
	const now = opts?.now ?? Date.now();
	if (!entry || now - entry.setAt > TODAY_PICK_CONTINUITY_TTL_MS) {
		if (raw != null) safeRemove(storage);
		return null;
	}
	return entry;
}

export function clearTodayPickContinuity(opts?: StorageOpts): void {
	const storage = resolveStorage(opts);
	if (storage) safeRemove(storage);
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
	const entry = readTodayPickContinuity({ storage, now: opts?.now });
	if (!entry || entry.tmdbId !== tmdbId) return;
	if (entry.completedVia === "diary") return;
	writeEntry(storage, { ...entry, completedVia: via });
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
