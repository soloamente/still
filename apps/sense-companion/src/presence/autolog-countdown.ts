import {
	COMPANION_AUTO_LOG_MIN_DURATION_SEC,
	COMPANION_AUTO_LOG_RATIO,
} from "../pairing/now-watching";

export const AUTOLOG_COUNTDOWN_WINDOW_SEC = 15 * 60;
export const AUTOLOG_SENTENCE_MS = 4_000;

export type AutologCountdownState = {
	key: string | null;
	sentenceShown: boolean;
	sentenceStartedAt: number | null;
	frozenRemainingSec: number | null;
};

export type AutologMediaClock = {
	provider: string;
	kind: string;
	title: string;
	season: number | null;
	episode: number | null;
	positionSec: number | null;
	durationSec: number | null;
};

export type AutologCountdownPhase = "hidden" | "sentence" | "clock";

export function emptyAutologCountdownState(): AutologCountdownState {
	return {
		key: null,
		sentenceShown: false,
		sentenceStartedAt: null,
		frozenRemainingSec: null,
	};
}

/** Seconds until the 90% log point. Null when this title cannot log. */
export function autologRemainingSec(
	positionSec: number | null,
	durationSec: number | null,
): number | null {
	if (positionSec == null || durationSec == null) return null;
	if (!Number.isFinite(positionSec) || !Number.isFinite(durationSec))
		return null;
	if (durationSec < COMPANION_AUTO_LOG_MIN_DURATION_SEC) return null;
	if (positionSec < 0 || positionSec > durationSec + 30) return null;
	return durationSec * COMPANION_AUTO_LOG_RATIO - positionSec;
}

export function formatAutologMinutes(remainingSec: number): string {
	const minutes = Math.max(1, Math.ceil(remainingSec / 60));
	return `${minutes} min`;
}

export function formatAutologClock(remainingSec: number): string {
	const total = Math.max(0, Math.ceil(remainingSec));
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** 0 at 15 minutes left, 1 at the log point. */
export function autologRingProgress(remainingSec: number): number {
	const used = 1 - remainingSec / AUTOLOG_COUNTDOWN_WINDOW_SEC;
	return Math.min(1, Math.max(0, used));
}

function titleKey(media: AutologMediaClock): string {
	return [
		media.provider,
		media.kind,
		media.title.trim().toLowerCase(),
		media.season ?? "",
		media.episode ?? "",
	].join("\0");
}

function inWindow(remaining: number | null): remaining is number {
	return (
		remaining != null &&
		remaining > 0 &&
		remaining <= AUTOLOG_COUNTDOWN_WINDOW_SEC
	);
}

export function nextAutologCountdown(input: {
	state: AutologCountdownState;
	now: number;
	paired: boolean;
	paused: boolean;
	logged: boolean;
	media: AutologMediaClock | null;
}): {
	state: AutologCountdownState;
	phase: AutologCountdownPhase;
	remainingSec: number | null;
} {
	if (!input.paired || input.logged || input.media == null) {
		return {
			state: input.media == null ? emptyAutologCountdownState() : input.state,
			phase: "hidden",
			remainingSec: null,
		};
	}
	const key = titleKey(input.media);
	const sameKey = input.state.key === key;
	const live = autologRemainingSec(
		input.media.positionSec,
		input.media.durationSec,
	);
	if (!inWindow(live)) {
		// Leaving before the sentence finishes used to forget it had started.
		// The same title comes back on the clock instead of repeating it.
		const sentenceStarted =
			sameKey &&
			(input.state.sentenceShown || input.state.sentenceStartedAt != null);
		return {
			state: {
				key,
				sentenceShown: sentenceStarted,
				sentenceStartedAt: null,
				frozenRemainingSec: null,
			},
			phase: "hidden",
			remainingSec: null,
		};
	}
	const remembered = sameKey ? input.state.frozenRemainingSec : null;
	const remainingSec = input.paused ? (remembered ?? live) : live;
	let sentenceShown = sameKey ? input.state.sentenceShown : false;
	let sentenceStartedAt = sameKey ? input.state.sentenceStartedAt : null;
	let phase: AutologCountdownPhase = "clock";
	if (!sentenceShown) {
		if (sentenceStartedAt == null) sentenceStartedAt = input.now;
		if (input.now - sentenceStartedAt >= AUTOLOG_SENTENCE_MS) {
			sentenceShown = true;
			sentenceStartedAt = null;
			phase = "clock";
		} else {
			phase = "sentence";
		}
	}
	return {
		state: {
			key,
			sentenceShown,
			sentenceStartedAt,
			frozenRemainingSec: remainingSec,
		},
		phase,
		remainingSec,
	};
}
