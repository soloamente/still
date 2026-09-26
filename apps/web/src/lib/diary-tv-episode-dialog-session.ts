/**
 * One TV episode dialog for the diary lobby.
 * A second poster does not open until the current flight home finishes.
 * Escape, the scrim, and Close clear any queued poster so it cannot reopen.
 */

export interface DiaryTvDialogShow {
	key: string;
	tmdbId: number;
	title: string;
	posterPath: string | null;
}

export type DiaryTvDialogSession =
	| { phase: "closed" }
	| { phase: "open"; show: DiaryTvDialogShow }
	| { phase: "closing"; show: DiaryTvDialogShow; nextKey: string | null };

type ShowLookup = (key: string) => DiaryTvDialogShow | null;

/** Left click on a diary TV poster. */
export function chooseDiaryTvPoster(
	session: DiaryTvDialogSession,
	key: string,
	lookup: ShowLookup,
): DiaryTvDialogSession {
	switch (session.phase) {
		case "closed": {
			const show = lookup(key);
			if (!show) return session;
			return { phase: "open", show };
		}
		case "open": {
			if (session.show.key === key) {
				return { phase: "closing", show: session.show, nextKey: null };
			}
			// Keep this show mounted for the flight home. Open the next one later.
			return { phase: "closing", show: session.show, nextKey: key };
		}
		case "closing": {
			if (session.show.key === key) {
				return { ...session, nextKey: null };
			}
			return { ...session, nextKey: key };
		}
		default: {
			const _exhaustive: never = session;
			return _exhaustive;
		}
	}
}

/** Escape, scrim, or Close. Never toggles the dialog back open. */
export function dismissDiaryTvDialog(
	session: DiaryTvDialogSession,
): DiaryTvDialogSession {
	switch (session.phase) {
		case "closed":
			return session;
		case "open":
			return { phase: "closing", show: session.show, nextKey: null };
		case "closing":
			if (session.nextKey == null) return session;
			return { ...session, nextKey: null };
		default: {
			const _exhaustive: never = session;
			return _exhaustive;
		}
	}
}

/** The flight home or the missing-cell fade has finished. */
export function completeDiaryTvDialogClose(
	session: DiaryTvDialogSession,
	lookup: ShowLookup,
): DiaryTvDialogSession {
	switch (session.phase) {
		case "closed":
		case "open":
			return session;
		case "closing": {
			if (session.nextKey == null) return { phase: "closed" };
			const show = lookup(session.nextKey);
			if (!show) return { phase: "closed" };
			return { phase: "open", show };
		}
		default: {
			const _exhaustive: never = session;
			return _exhaustive;
		}
	}
}

/**
 * The lobby replaced the grid. If the open show left, start the close so the
 * dialog can fade while it stays mounted. Drop a queued show that left too.
 */
export function syncDiaryTvDialogToGrid(
	session: DiaryTvDialogSession,
	presentKeys: ReadonlySet<string>,
): DiaryTvDialogSession {
	switch (session.phase) {
		case "closed":
			return session;
		case "open":
			if (presentKeys.has(session.show.key)) return session;
			return { phase: "closing", show: session.show, nextKey: null };
		case "closing": {
			const nextKey =
				session.nextKey != null && presentKeys.has(session.nextKey)
					? session.nextKey
					: null;
			if (nextKey === session.nextKey) return session;
			return { ...session, nextKey };
		}
		default: {
			const _exhaustive: never = session;
			return _exhaustive;
		}
	}
}

/**
 * Close motion. Fly only when the cell can still receive the poster.
 * A missing cell, a show that left the grid, or reduced motion fades in place.
 */
export function diaryTvPosterCloseKind(input: {
	reduceMotion: boolean;
	cellInGrid: boolean;
	cellConnected: boolean;
	hasOrigin: boolean;
	hasPose: boolean;
}): "fly" | "fade" {
	if (
		input.reduceMotion ||
		!input.cellInGrid ||
		!input.cellConnected ||
		!input.hasOrigin ||
		!input.hasPose
	) {
		return "fade";
	}
	return "fly";
}
