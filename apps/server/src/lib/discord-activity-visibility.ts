/**
 * Viewer gate for Discord profile activity — mirrors Sense online presence privacy.
 * Route handlers call this before fetching Lanyard so visibility rules stay centralized.
 */

import { readDiscordActivityEnabledPref } from "./discord-activity-preferences";
import {
	PROFILE_PRIVACY_PRESENCE_VISIBILITY_PUBLIC,
	readProfilePresenceVisibilityPref,
} from "./profile-media";

export type CanViewerSeeDiscordActivityInput = {
	/** Signed-in viewer id, or null when unsigned. */
	viewerId: string | null;
	ownerUserId: string;
	ownerPreferences: Record<string, unknown> | null | undefined;
	/** Owner has a linked Discord account row. */
	isDiscordConnected: boolean;
	/** Whether the viewer may load the profile page (private profile rules). */
	canViewProfile: boolean;
	/** Mutual follow between viewer and owner — used for friends-only visibility. */
	isMutualWithViewer: boolean;
};

/**
 * Whether a viewer may receive formatted Discord activity for a profile owner.
 * Self-view ignores `presenceVisibility` when connected + enabled (account menu parity).
 */
export function canViewerSeeDiscordActivity(
	input: CanViewerSeeDiscordActivityInput,
): boolean {
	if (!input.isDiscordConnected) return false;
	if (!readDiscordActivityEnabledPref(input.ownerPreferences)) return false;

	const isSelf =
		input.viewerId !== null && input.viewerId === input.ownerUserId;
	if (isSelf) return true;

	// Unsigned patrons never see others' Discord activity.
	if (!input.viewerId) return false;

	// Private/hidden profiles must not leak activity through the API.
	if (!input.canViewProfile) return false;

	const presenceVisibility = readProfilePresenceVisibilityPref(
		input.ownerPreferences,
	);
	if (presenceVisibility === PROFILE_PRIVACY_PRESENCE_VISIBILITY_PUBLIC) {
		return true;
	}

	return input.isMutualWithViewer;
}
