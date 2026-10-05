import type {
	TasteMatchedDiscoveryPayload,
	TasteMatchMovie,
} from "./taste-matched-discovery";
import { reconcileTasteMatchMovies } from "./taste-matched-discovery";

/** Mirrors `apps/server/src/lib/taste-matched-discovery.ts` — client queue depth. */
export const TASTE_MATCH_TARGET_RESULTS = 24;

/** Debounce window before coalesced `GET /api/taste/for-you` backfill. */
export const TASTE_QUEUE_BACKFILL_DEBOUNCE_MS = 150;

/**
 * Spotlight index after removing a title from the taste queue.
 * Keeping the index when removing the active row lets the next title slide in.
 */
export function activeIndexAfterRemoval(
	removedIndex: number,
	activeIndex: number,
	remainingLength: number,
): number {
	let next = activeIndex;
	if (removedIndex < activeIndex) {
		next -= 1;
	}
	const maxIndex = Math.max(0, remainingLength - 1);
	return Math.min(Math.max(0, next), maxIndex);
}

/**
 * Append unseen candidates to the queue tail until `targetLength` or exhaustion.
 * Returns the same array reference when nothing new is appended.
 */
export function mergeTailBackfill(
	current: TasteMatchMovie[],
	candidates: TasteMatchMovie[],
	targetLength = TASTE_MATCH_TARGET_RESULTS,
): TasteMatchMovie[] {
	if (current.length >= targetLength) {
		return current;
	}

	const onScreen = new Set(current.map((movie) => movie.tmdbId));
	const next = [...current];

	for (const candidate of candidates) {
		if (next.length >= targetLength) {
			break;
		}
		if (onScreen.has(candidate.tmdbId)) {
			continue;
		}
		onScreen.add(candidate.tmdbId);
		next.push(candidate);
	}

	return next.length === current.length ? current : next;
}

/** Same titles in the same order — a refetch can skip a rail rewrite. */
export function sameTasteRailIds(
	current: readonly { tmdbId: number }[],
	next: readonly { tmdbId: number }[],
): boolean {
	if (current.length !== next.length) return false;
	return current.every((film, index) => film.tmdbId === next[index]?.tmdbId);
}

/**
 * Poster rail after a diary log. Drop the logged title even if for-you is a
 * moment stale, and keep today's pinned hero when the new ranking omits it.
 */
export function railAfterTasteRefresh<T extends { tmdbId: number }>(args: {
	fresh: readonly T[];
	pinned: T | null;
	consumedTmdbId: number | null;
}): T[] {
	const withoutConsumed = args.fresh.filter(
		(film) => film.tmdbId !== args.consumedTmdbId,
	);
	const pinned = args.pinned;
	if (
		pinned == null ||
		pinned.tmdbId === args.consumedTmdbId ||
		withoutConsumed.some((film) => film.tmdbId === pinned.tmdbId)
	) {
		return withoutConsumed;
	}
	return [pinned, ...withoutConsumed];
}

/** Debounced scheduler — coalesces rapid queue mutations into one backfill fetch. */
export function createTasteQueueBackfillScheduler(options: {
	debounceMs?: number;
	runBackfill: () => void | Promise<void>;
}) {
	let timer: ReturnType<typeof setTimeout> | null = null;
	const debounceMs = options.debounceMs ?? TASTE_QUEUE_BACKFILL_DEBOUNCE_MS;

	function cancel() {
		if (timer) {
			clearTimeout(timer);
		}
		timer = null;
	}

	function schedule() {
		cancel();
		timer = setTimeout(() => {
			timer = null;
			void options.runBackfill();
		}, debounceMs);
	}

	return { schedule, cancel };
}

/** Eden-backed backfill runner — merges fresh for-you rows onto the queue tail. */
export function buildTasteQueueBackfillRunner(args: {
	getMovies: () => TasteMatchMovie[];
	setMovies: (next: TasteMatchMovie[]) => void;
	fetchForYou: () => Promise<TasteMatchedDiscoveryPayload | null>;
}): () => Promise<void> {
	return async () => {
		const current = args.getMovies();
		const data = await args.fetchForYou();
		if (!data || data.coldStart) {
			return;
		}

		const candidates = reconcileTasteMatchMovies(
			data.movies,
			data.consumedTmdbIds,
		);
		const consumed = new Set(data.consumedTmdbIds ?? []);
		// A full queue used to skip the fetch, so a log that was not already
		// removed stayed on the rail.
		const pruned =
			consumed.size === 0
				? current
				: current.filter((movie) => !consumed.has(movie.tmdbId));
		if (pruned.length >= TASTE_MATCH_TARGET_RESULTS) {
			if (pruned.length !== current.length) {
				args.setMovies(pruned);
			}
			return;
		}
		const merged = mergeTailBackfill(pruned, candidates);
		if (merged !== pruned || pruned.length !== current.length) {
			args.setMovies(merged);
		}
	};
}
