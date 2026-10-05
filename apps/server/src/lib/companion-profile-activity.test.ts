import { describe, expect, test } from "bun:test";

import type { CompanionNowWatchingView } from "./companion-now-watching";
import {
	canViewerSeeCompanionWatching,
	formatCompanionProfileActivity,
} from "./companion-profile-activity";

const OWNER = "usr_owner";
const VIEWER = "usr_viewer";

const WATCHING: CompanionNowWatchingView = {
	title: "Stranger Things",
	provider: "netflix",
	kind: "tv",
	tmdbId: 66732,
	href: "/tv/66732",
	season: 4,
	episode: 1,
	episodeTitle: "Chapter One",
	positionSec: 30,
	durationSec: 3600,
	paused: false,
	updatedAt: "2026-09-30T00:00:00.000Z",
	posterUrl: "https://image.tmdb.org/t/p/w342/st.jpg",
};

describe("formatCompanionProfileActivity", () => {
	test("a third-party player uses the site name", () => {
		expect(
			formatCompanionProfileActivity({
				...WATCHING,
				provider: "web",
				kind: "movie",
				season: null,
				episode: null,
				serviceLabel: "Movy",
				href: "/movies/1",
			}).source,
		).toBe("Movy");
	});

	test("builds the profile line and title link", () => {
		expect(formatCompanionProfileActivity(WATCHING)).toMatchObject({
			kind: "watching",
			activitySource: "companion",
			label: "Watching Stranger Things",
			headline: "Stranger Things",
			detail: "S4 E1 - Chapter One",
			source: "Netflix",
			href: "/tv/66732",
			imageUrl: "https://image.tmdb.org/t/p/w342/st.jpg",
			paused: false,
			playback: {
				positionSec: 30,
				durationSec: 3600,
				sampledAt: "2026-09-30T00:00:00.000Z",
			},
		});
	});

	test("a paused movie names the service and keeps the playhead", () => {
		expect(
			formatCompanionProfileActivity({
				...WATCHING,
				provider: "max",
				kind: "movie",
				title: "Am I OK?",
				href: "/movies/641934",
				season: null,
				episode: null,
				positionSec: 151,
				durationSec: 5192,
				paused: true,
			}),
		).toMatchObject({
			headline: "Am I OK?",
			source: "HBO Max",
			paused: true,
			playback: {
				positionSec: 151,
				durationSec: 5192,
				sampledAt: "2026-09-30T00:00:00.000Z",
			},
		});
	});

	test("omits the episode mark for a movie", () => {
		expect(
			formatCompanionProfileActivity({
				...WATCHING,
				kind: "movie",
				title: "The Matrix",
				href: "/movies/603",
				season: null,
				episode: null,
				posterUrl: null,
			}),
		).toMatchObject({
			label: "Watching The Matrix",
			headline: "The Matrix",
			href: "/movies/603",
		});
	});
});

describe("canViewerSeeCompanionWatching", () => {
	test("owner sees it, and a friends-only profile hides it from everyone else", () => {
		const input = {
			ownerUserId: OWNER,
			ownerPreferences: {},
			canViewProfile: true,
			isMutualWithViewer: false,
		};
		expect(canViewerSeeCompanionWatching({ ...input, viewerId: OWNER })).toBe(
			true,
		);
		expect(canViewerSeeCompanionWatching({ ...input, viewerId: VIEWER })).toBe(
			false,
		);
		expect(canViewerSeeCompanionWatching({ ...input, viewerId: null })).toBe(
			false,
		);
	});

	test("a mutual follow can see a friends-only row", () => {
		expect(
			canViewerSeeCompanionWatching({
				viewerId: VIEWER,
				ownerUserId: OWNER,
				ownerPreferences: {},
				canViewProfile: true,
				isMutualWithViewer: true,
			}),
		).toBe(true);
	});

	test("public presence lets any signed-in patron see it", () => {
		expect(
			canViewerSeeCompanionWatching({
				viewerId: VIEWER,
				ownerUserId: OWNER,
				ownerPreferences: { privacy: { presenceVisibility: "public" } },
				canViewProfile: true,
				isMutualWithViewer: false,
			}),
		).toBe(true);
	});

	test("the share toggle hides it from the owner too", () => {
		expect(
			canViewerSeeCompanionWatching({
				viewerId: OWNER,
				ownerUserId: OWNER,
				ownerPreferences: {
					integrations: { companionWatchingEnabled: false },
				},
				canViewProfile: true,
				isMutualWithViewer: true,
			}),
		).toBe(false);
	});
});
