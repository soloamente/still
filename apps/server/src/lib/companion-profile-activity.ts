import type { CompanionNowWatchingView } from "./companion-now-watching";
import type { DiscordActivityDisplay } from "./discord-activity";
import { readCompanionWatchingEnabledPref } from "./discord-activity-preferences";
import {
	PROFILE_PRIVACY_PRESENCE_VISIBILITY_PUBLIC,
	readProfilePresenceVisibilityPref,
} from "./profile-media";

/** Patron-facing service name for the profile row. */
export function companionProviderLabel(
	provider: CompanionNowWatchingView["provider"],
): string {
	switch (provider) {
		case "netflix":
			return "Netflix";
		case "disney":
			return "Disney+";
		case "hotstar":
			return "Hotstar";
		case "prime":
			return "Prime Video";
		case "apple":
			return "Apple TV+";
		case "max":
			return "HBO Max";
		case "web":
			return "Web";
		default: {
			const neverProvider: never = provider;
			return neverProvider;
		}
	}
}

/** Episode mark used on the profile row, e.g. S4 E1. */
export function formatCompanionEpisodeMark(
	season: number | null,
	episode: number | null,
): string | null {
	if (season == null || episode == null) return null;
	if (!Number.isInteger(season) || !Number.isInteger(episode)) return null;
	if (season < 1 || episode < 1) return null;
	return `S${season} E${episode}`;
}

/** Discord-style episode row: S4 E1 - Chapter One. */
export function formatCompanionEpisodeDetailLine(input: {
	showTitle: string;
	season: number | null;
	episode: number | null;
	episodeTitle?: string | null;
}): string | null {
	const mark = formatCompanionEpisodeMark(input.season, input.episode);
	const episodeName =
		input.episodeTitle?.trim() &&
		input.episodeTitle.trim() !== input.showTitle.trim()
			? input.episodeTitle.trim()
			: null;
	const line = [mark, episodeName].filter(Boolean).join(" - ");
	return line.length > 0 ? line : null;
}

/**
 * Profile hero copy for a Companion heartbeat.
 * `activitySource` tells the row to link the title instead of treating it as Discord.
 */
export function formatCompanionProfileActivity(
	view: CompanionNowWatchingView,
): DiscordActivityDisplay {
	const service =
		view.provider === "web" && view.serviceLabel
			? view.serviceLabel
			: companionProviderLabel(view.provider);
	const episodeDetail =
		view.kind === "tv"
			? formatCompanionEpisodeDetailLine({
					showTitle: view.title,
					season: view.season,
					episode: view.episode,
					episodeTitle: view.episodeTitle,
				})
			: null;
	const durationSec = view.durationSec;
	const positionSec = view.positionSec;
	const playback =
		durationSec != null &&
		durationSec > 0 &&
		positionSec != null &&
		Number.isFinite(positionSec)
			? {
					positionSec: Math.max(0, positionSec),
					durationSec,
					sampledAt: view.updatedAt,
				}
			: undefined;
	return {
		kind: "watching",
		activitySource: "companion",
		label: `Watching ${view.title}`,
		headline: view.title,
		...(episodeDetail ? { detail: episodeDetail } : {}),
		source: service,
		href: view.href,
		imageUrl: view.posterUrl ?? null,
		paused: view.paused,
		...(playback ? { playback } : {}),
	};
}

export type CanViewerSeeCompanionWatchingInput = {
	viewerId: string | null;
	ownerUserId: string;
	ownerPreferences: Record<string, unknown> | null | undefined;
	canViewProfile: boolean;
	isMutualWithViewer: boolean;
};

/**
 * Same presence gate as online status, plus the "Share what I'm watching" toggle.
 * The owner still sees their own row unless they turned sharing off.
 */
export function canViewerSeeCompanionWatching(
	input: CanViewerSeeCompanionWatchingInput,
): boolean {
	if (!readCompanionWatchingEnabledPref(input.ownerPreferences)) return false;

	const isSelf =
		input.viewerId !== null && input.viewerId === input.ownerUserId;
	if (isSelf) return true;
	if (!input.viewerId) return false;
	if (!input.canViewProfile) return false;

	const presenceVisibility = readProfilePresenceVisibilityPref(
		input.ownerPreferences,
	);
	if (presenceVisibility === PROFILE_PRIVACY_PRESENCE_VISIBILITY_PUBLIC) {
		return true;
	}
	return input.isMutualWithViewer;
}
