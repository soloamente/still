import { describe, expect, test } from "bun:test";

import {
	type CanViewerSeeDiscordActivityInput,
	canViewerSeeDiscordActivity,
} from "./discord-activity-visibility";
import { PROFILE_PRIVACY_PRESENCE_VISIBILITY_PUBLIC } from "./profile-media";

const OWNER_ID = "usr_owner";
const VIEWER_ID = "usr_viewer";

function baseInput(
	overrides: Partial<CanViewerSeeDiscordActivityInput> = {},
): CanViewerSeeDiscordActivityInput {
	return {
		viewerId: VIEWER_ID,
		ownerUserId: OWNER_ID,
		ownerPreferences: {},
		isDiscordConnected: true,
		canViewProfile: true,
		isMutualWithViewer: false,
		...overrides,
	};
}

describe("canViewerSeeDiscordActivity", () => {
	const cases: Array<{
		name: string;
		input: Partial<CanViewerSeeDiscordActivityInput>;
		expected: boolean;
	}> = [
		{
			name: "unsigned viewer never sees activity",
			input: { viewerId: null },
			expected: false,
		},
		{
			name: "owner sees self when connected and enabled",
			input: { viewerId: OWNER_ID, ownerUserId: OWNER_ID },
			expected: true,
		},
		{
			name: "owner hidden when Discord not connected",
			input: {
				viewerId: OWNER_ID,
				ownerUserId: OWNER_ID,
				isDiscordConnected: false,
			},
			expected: false,
		},
		{
			name: "owner hidden when activity toggle off",
			input: {
				viewerId: OWNER_ID,
				ownerUserId: OWNER_ID,
				ownerPreferences: {
					integrations: { discordActivityEnabled: false },
				},
			},
			expected: false,
		},
		{
			name: "friends-only mutual follower on viewable profile",
			input: { isMutualWithViewer: true },
			expected: true,
		},
		{
			name: "friends-only non-mutual viewer",
			input: { isMutualWithViewer: false },
			expected: false,
		},
		{
			name: "public visibility allows non-mutual signed-in viewer",
			input: {
				ownerPreferences: {
					privacy: {
						presenceVisibility: PROFILE_PRIVACY_PRESENCE_VISIBILITY_PUBLIC,
					},
				},
				isMutualWithViewer: false,
			},
			expected: true,
		},
		{
			name: "private profile hides activity from non-owner",
			input: { canViewProfile: false, isMutualWithViewer: true },
			expected: false,
		},
		{
			name: "owner still sees self on private profile",
			input: {
				viewerId: OWNER_ID,
				ownerUserId: OWNER_ID,
				canViewProfile: false,
			},
			expected: true,
		},
		{
			name: "disabled activity hidden from mutual follower",
			input: {
				isMutualWithViewer: true,
				ownerPreferences: {
					integrations: { discordActivityEnabled: false },
				},
			},
			expected: false,
		},
		{
			name: "not connected hides from public viewer",
			input: {
				isDiscordConnected: false,
				ownerPreferences: {
					privacy: {
						presenceVisibility: PROFILE_PRIVACY_PRESENCE_VISIBILITY_PUBLIC,
					},
				},
			},
			expected: false,
		},
	];

	for (const { name, input, expected } of cases) {
		test(name, () => {
			expect(canViewerSeeDiscordActivity(baseInput(input))).toBe(expected);
		});
	}
});
