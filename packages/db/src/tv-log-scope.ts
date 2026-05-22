import type { TvLogScope } from "./schema/activity";

export interface TvLogScopeInput {
	logScope?: TvLogScope | null;
	seasonNumber?: number | null;
	episodeNumber?: number | null;
}

/** Validates scoped TV diary fields before insert/update (shared by API + tests). */
export function validateTvLogScope(
	input: TvLogScopeInput,
): { ok: true } | { ok: false; message: string } {
	const scope = input.logScope ?? "show";

	if (scope === "show") {
		if (input.seasonNumber != null || input.episodeNumber != null) {
			return {
				ok: false,
				message: "Whole-show logs cannot include season or episode numbers",
			};
		}
		return { ok: true };
	}

	if (scope === "season") {
		if (input.seasonNumber == null || !Number.isFinite(input.seasonNumber)) {
			return { ok: false, message: "Season logs require seasonNumber" };
		}
		if (input.episodeNumber != null) {
			return {
				ok: false,
				message: "Season logs cannot include episodeNumber",
			};
		}
		return { ok: true };
	}

	if (scope === "episode") {
		if (input.seasonNumber == null || !Number.isFinite(input.seasonNumber)) {
			return { ok: false, message: "Episode logs require seasonNumber" };
		}
		if (input.episodeNumber == null || !Number.isFinite(input.episodeNumber)) {
			return { ok: false, message: "Episode logs require episodeNumber" };
		}
		return { ok: true };
	}

	return { ok: false, message: "Invalid logScope" };
}

/** Normalize scope + numbers for DB insert (movie logs always stay `show`). */
export function normalizeTvLogScopeForInsert(
	tvId: number | null | undefined,
	input: TvLogScopeInput,
): {
	logScope: TvLogScope;
	seasonNumber: number | null;
	episodeNumber: number | null;
} {
	if (tvId == null) {
		return { logScope: "show", seasonNumber: null, episodeNumber: null };
	}
	const scope = input.logScope ?? "show";
	return {
		logScope: scope,
		seasonNumber: scope === "show" ? null : (input.seasonNumber ?? null),
		episodeNumber: scope === "episode" ? (input.episodeNumber ?? null) : null,
	};
}
