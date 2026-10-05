import {
	activityIsPaused,
	type CompanionActivityMessage,
} from "../presence/activity-log";
import { upgradeArtworkUrl } from "../presence/artwork-url";
import {
	companionServiceDisplayName,
	inferBrowsePageKind,
	isGenericBrowseTitle,
} from "../presence/service-platform-brand";

export const POPUP_WATCH_STORAGE_KEY = "senseCompanionWatch";

/** What the patron is doing. Exploring is the catalogue; viewing is a title page. */
export type PopupWatchMode = "playing" | "paused" | "exploring" | "viewing";

/** Last thing the popup should show. `null` means the player tab went quiet. */
export type PopupWatch = {
	service: string;
	title: string;
	season: number | null;
	episode: number | null;
	paused: boolean;
	mode: PopupWatchMode;
	coverUrl: string | null;
};

function readPopupWatchMode(value: unknown, paused: boolean): PopupWatchMode {
	switch (value) {
		case "playing":
		case "paused":
		case "exploring":
		case "viewing":
			return value;
		default:
			return paused ? "paused" : "playing";
	}
}

function episodeNumber(value: number | null): number | null {
	return typeof value === "number" && value >= 1 ? value : null;
}

function browseTitle(raw: string | null): string | null {
	const title = raw?.trim() ?? "";
	if (!title || isGenericBrowseTitle(title)) return null;
	return title;
}

/** Collapse a content-script message into the one line the popup renders. */
export function popupWatchFromMessage(
	message: CompanionActivityMessage,
): PopupWatch | null {
	if (message.type === "sense-companion:clear") return null;
	const media = message.senseMedia;
	const coverUrl = upgradeArtworkUrl(message.activity.largeImageKey);
	if (media) {
		const season =
			media.kind === "episode" ? episodeNumber(media.season) : null;
		const episode =
			media.kind === "episode" ? episodeNumber(media.episode) : null;
		const paused = activityIsPaused(message.activity);
		return {
			service: message.service,
			title: media.title,
			season,
			episode: season != null ? episode : null,
			paused,
			mode: paused ? "paused" : "playing",
			coverUrl,
		};
	}
	const named = browseTitle(
		message.activity.name ??
			message.activity.details ??
			message.activity.largeImageText,
	);
	const pageKind = inferBrowsePageKind(message.pagePath);
	const onTitle =
		pageKind === "movie" ||
		pageKind === "tv" ||
		pageKind === "title" ||
		named != null;
	if (onTitle && (named != null || pageKind !== "catalogue")) {
		const fallback =
			pageKind === "tv"
				? "TV page"
				: pageKind === "movie"
					? "Movie page"
					: "Title";
		return {
			service: message.service,
			title: named ?? fallback,
			season: null,
			episode: null,
			paused: false,
			mode: "viewing",
			coverUrl,
		};
	}
	return {
		service: message.service,
		title: companionServiceDisplayName(message.service),
		season: null,
		episode: null,
		paused: false,
		mode: "exploring",
		coverUrl: null,
	};
}

export function formatPopupWatchState(watch: PopupWatch): string {
	switch (watch.mode) {
		case "playing":
			return "Watching";
		case "paused":
			return "Paused";
		case "exploring":
			return "Exploring";
		case "viewing":
			return "Viewing";
		default: {
			const unreachable: never = watch.mode;
			return unreachable;
		}
	}
}

export function formatPopupWatchDetail(watch: PopupWatch): string {
	if (watch.mode === "exploring") return "";
	if (watch.mode === "viewing") return watch.service;
	const mark =
		watch.season != null && watch.episode != null
			? `S${watch.season} E${watch.episode}`
			: null;
	return [mark, watch.service].filter((part) => part != null).join(" · ");
}

export function readPopupWatch(value: unknown): PopupWatch | null {
	if (typeof value !== "object" || value === null) return null;
	const watch = value as Partial<PopupWatch>;
	if (typeof watch.service !== "string" || watch.service.length === 0) {
		return null;
	}
	if (typeof watch.title !== "string" || watch.title.length === 0) return null;
	if (typeof watch.paused !== "boolean") return null;
	const season = episodeNumber(
		typeof watch.season === "number" ? watch.season : null,
	);
	const episode = episodeNumber(
		typeof watch.episode === "number" ? watch.episode : null,
	);
	const mode = readPopupWatchMode(watch.mode, watch.paused);
	return {
		service: watch.service,
		title: watch.title,
		season,
		episode: season != null ? episode : null,
		paused: mode === "paused",
		mode,
		coverUrl:
			typeof watch.coverUrl === "string" &&
			watch.coverUrl.startsWith("https://")
				? watch.coverUrl
				: null,
	};
}
