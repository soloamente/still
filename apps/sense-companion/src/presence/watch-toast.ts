import type { PopupWatch } from "../popup/watch-state";

/** Last notice already shown. A new mode or title shows again. */
export type WatchToastState = {
	key: string | null;
	mode: PopupWatch["mode"] | null;
	title: string | null;
	season: number | null;
	episode: number | null;
};

export function emptyWatchToastState(): WatchToastState {
	return { key: null, mode: null, title: null, season: null, episode: null };
}

/** Green when the helper accepted a paired save. Red when it did not. */
export function watchDeliveryOk(input: {
	paired: boolean;
	posted: boolean;
}): boolean {
	return input.paired && input.posted;
}

export function readWatchToastId(value: unknown): string | null {
	if (typeof value !== "object" || value === null) return null;
	const id = (value as { toastId?: unknown }).toastId;
	return typeof id === "string" && id.length > 0 ? id : null;
}

/** Which mark the pill draws. The eye is only for playback. */
export type WatchToastIcon = "eye" | "explore" | "info" | "pause" | "play";

/** Lead word, title, and the mark for this notice. */
export type WatchToastCopy = {
	lead: string;
	title: string;
	detail: string | null;
	icon: WatchToastIcon;
};

function episodeMark(watch: PopupWatch): string | null {
	return watch.season != null && watch.episode != null
		? `S${watch.season} E${watch.episode}`
		: null;
}

export function watchToastCopy(
	watch: PopupWatch,
	resume: boolean,
): WatchToastCopy {
	const mark = episodeMark(watch);
	switch (watch.mode) {
		case "playing":
			return {
				lead: resume ? "Resuming" : "Watching",
				title: watch.title,
				detail: mark,
				icon: resume ? "play" : "eye",
			};
		case "paused":
			return {
				lead: "Paused",
				title: watch.title,
				detail: mark,
				icon: "pause",
			};
		case "exploring":
			return {
				lead: "Exploring",
				title: watch.title,
				detail: null,
				icon: "explore",
			};
		case "viewing":
			return {
				lead: "Viewing",
				title: watch.title,
				detail: null,
				icon: "info",
			};
		default: {
			const unreachable: never = watch.mode;
			return unreachable;
		}
	}
}

function watchToastKey(watch: PopupWatch): string {
	const episode =
		watch.season != null && watch.episode != null
			? `\0${watch.season}\0${watch.episode}`
			: "";
	return `${watch.mode}\0${watch.title}${episode}`;
}

function remember(watch: PopupWatch, key: string): WatchToastState {
	return {
		key,
		mode: watch.mode,
		title: watch.title,
		season: watch.season,
		episode: watch.episode,
	};
}

function sameTitle(state: WatchToastState, watch: PopupWatch): boolean {
	return (
		state.title === watch.title &&
		state.season === watch.season &&
		state.episode === watch.episode
	);
}

/** A stored play, or a pause that followed one, for this same title. */
function titleHasPlayed(state: WatchToastState, watch: PopupWatch): boolean {
	return (
		(state.mode === "playing" || state.mode === "paused") &&
		sameTitle(state, watch)
	);
}

/**
 * True when the mode or the title changes. A pause before this title has
 * played is ignored and not stored. Pause, resume, exploring, and a title
 * page each get their own notice. A partial episode waits for both numbers.
 */
export function nextWatchToast(
	state: WatchToastState,
	watch: PopupWatch | null,
): { state: WatchToastState; show: boolean; resume: boolean } {
	if (!watch)
		return { state: emptyWatchToastState(), show: false, resume: false };
	// Season without an episode is not a play or a pause yet.
	if (watch.season != null && watch.episode == null) {
		return { state, show: false, resume: false };
	}
	// The player often reports paused before the first frame. Forget that.
	if (watch.mode === "paused" && !titleHasPlayed(state, watch)) {
		return { state, show: false, resume: false };
	}
	const key = watchToastKey(watch);
	if (key === state.key) return { state, show: false, resume: false };
	const resume =
		state.mode === "paused" &&
		watch.mode === "playing" &&
		state.title === watch.title &&
		state.season === watch.season &&
		state.episode === watch.episode;
	return { state: remember(watch, key), show: true, resume };
}
