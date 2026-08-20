import { describe, expect, test } from "bun:test";

import {
	type SettingsFormDirtySnapshot,
	settingsFormIsDirty,
	settingsFormSnapshotsEqual,
} from "@/components/profile/settings-form-dirty";

function snap(
	overrides: Partial<SettingsFormDirtySnapshot> = {},
): SettingsFormDirtySnapshot {
	return {
		displayName: "Ada",
		bio: "",
		pronouns: "",
		location: "",
		website: "",
		birthDate: "",
		showBirthDateOnProfile: false,
		presenceVisibility: "friends",
		discordActivityEnabled: false,
		isPrivate: false,
		audioEnabled: false,
		audioAtmosphere: false,
		audioFeedback: false,
		smoothScroll: true,
		castCrewMonochromeOnHover: false,
		profilePortraitGrayscaleUntilHover: false,
		catalogMonochromePeersOnHover: false,
		showAdultContent: false,
		catalogTmdbWatchRegion: "",
		catalogTmdbLanguage: "",
		reviewTranslationLanguage: "",
		watchlistStreamingAlerts: false,
		appTheme: "theme-theater",
		profileAccent: null,
		bannerFrame: "none",
		notificationPrefs: {
			"follow.created": true,
			"comment.on_review": true,
			"comment.replied": true,
			"mention.in_review_or_comment": true,
			"badge.awarded": true,
			"import.completed": true,
			"taste.challenge": true,
			"challenge.completed": true,
			"review.liked": false,
			"chat.message": true,
			"tv.new_episode": true,
			watchlist_now_streaming: true,
		},
		...overrides,
	};
}

describe("settingsFormIsDirty", () => {
	test("stale profile after save is not dirty when committed matches the form", () => {
		const saved = snap({ displayName: "Ada Lovelace" });
		const staleProfile = snap({ displayName: "Ada" });

		expect(settingsFormSnapshotsEqual(saved, staleProfile)).toBe(false);
		expect(settingsFormIsDirty(saved, saved, false)).toBe(false);
	});

	test("edit after save is dirty against the committed snapshot", () => {
		const committed = snap({ displayName: "Ada Lovelace" });
		const edited = snap({ displayName: "Ada Lovelace!" });

		expect(settingsFormIsDirty(edited, committed, false)).toBe(true);
	});

	test("pending banner or avatar keeps the form dirty", () => {
		const same = snap();
		expect(settingsFormIsDirty(same, same, true)).toBe(true);
	});

	test("no committed snapshot — differ from profile is dirty", () => {
		expect(
			settingsFormIsDirty(snap({ bio: "hi" }), snap({ bio: "" }), false),
		).toBe(true);
	});
});
