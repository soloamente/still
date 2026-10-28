import type { CompanionAutoLogResult } from "./companion-auto-log";
import {
	COMPANION_AUTO_LOG_MIN_DURATION_SEC,
	COMPANION_AUTO_LOG_RATIO,
	companionAutoLogKey,
	companionAutoLogRecentlyRecorded,
	companionPlaybackReadyToLog,
} from "./companion-auto-log";
import type {
	CompanionNowWatchingBody,
	CompanionNowWatchingView,
} from "./companion-now-watching";

/** Patron-facing auto-log outcome on each heartbeat (extension toasts). */
export type CompanionAutoLogStatus =
	| "pending"
	| "logged"
	| "unmatched"
	| "failed"
	| "skipped";

export type CompanionAutoLogReason =
	| "no_match"
	| "no_episode"
	| "not_ready"
	| "write"
	| "recent";

export type CompanionAutoLogReport = {
	status: CompanionAutoLogStatus;
	reason?: CompanionAutoLogReason;
	/** Early catalogue warning vs end-of-playback error copy. */
	timing?: "early" | "late";
};

/** Playhead in the last tenth — even when TMDb match is still missing. */
function playbackAtAutoLogGate(view: CompanionNowWatchingView): boolean {
	const position = view.positionSec;
	const duration = view.durationSec;
	if (position == null || duration == null) return false;
	if (!Number.isFinite(position) || !Number.isFinite(duration)) return false;
	if (duration < COMPANION_AUTO_LOG_MIN_DURATION_SEC) return false;
	if (position < 0 || position > duration + 30) return false;
	return position / duration >= COMPANION_AUTO_LOG_RATIO;
}

export function resolveCompanionAutoLogReport(input: {
	body: CompanionNowWatchingBody;
	view: CompanionNowWatchingView | null;
	logged: CompanionAutoLogResult | null;
	recordAttempted: boolean;
	userId: string;
	now: number;
}): CompanionAutoLogReport | null {
	if (input.body.clear === true) return null;
	const media = input.body.media;
	if (!media) return null;
	if (!input.view) return null;
	if (input.logged) return { status: "logged" };

	const ready = companionPlaybackReadyToLog(input.view);
	const timing: "early" | "late" = playbackAtAutoLogGate(input.view)
		? "late"
		: "early";

	const episodeIdentityMissing =
		media.kind === "episode" &&
		(media.season == null ||
			media.episode == null ||
			media.season < 1 ||
			media.episode < 1);

	if (episodeIdentityMissing) {
		return {
			status: "unmatched",
			reason: "no_episode",
			timing,
		};
	}

	if (input.view.tmdbId == null) {
		return {
			status: "unmatched",
			reason: "no_match",
			timing,
		};
	}

	if (!ready) {
		return { status: "pending", reason: "not_ready" };
	}

	const key = companionAutoLogKey(input.userId, input.view);
	if (
		key != null &&
		!input.recordAttempted &&
		companionAutoLogRecentlyRecorded(key, input.now)
	) {
		return { status: "skipped", reason: "recent", timing: "late" };
	}

	if (input.recordAttempted && input.logged == null) {
		return { status: "failed", reason: "write", timing: "late" };
	}

	return { status: "pending", reason: "not_ready" };
}
