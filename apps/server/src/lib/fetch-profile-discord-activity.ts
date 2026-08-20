/**
 * Resolves viewer-scoped Discord activity for a profile handle.
 * Keeps Lanyard reads and visibility rules out of the Elysia route handler.
 */

import {
	type DiscordActivityDisplay,
	formatDiscordActivity,
} from "./discord-activity";
import { isDiscordActivityEnabled } from "./discord-activity-config";
import { resolveDiscordActivityCoverAccent } from "./discord-activity-cover-palette";
import {
	fetchDiscordActivityProfileMetadata,
	fetchProfileAccessByHandle,
} from "./discord-activity-metadata-cache";
import { canViewerSeeDiscordActivity } from "./discord-activity-visibility";
import { getCachedLanyardPresence } from "./lanyard-client";
import { fetchMutualFollowingIds } from "./mutual-follow-cache";
import { loadPatronEntitlements } from "./patron-entitlements";
import { patronHasPlanFeature } from "./plan-feature-access";

export type ProfileDiscordActivityResponse =
	| { visible: false }
	| { visible: true; activity: DiscordActivityDisplay };

export type FetchProfileDiscordActivityResult =
	| { ok: true; body: ProfileDiscordActivityResponse }
	| { ok: false; status: 404; error: string };

/**
 * Returns formatted Discord activity for a profile when the viewer is allowed
 * to see it. Never includes raw Discord snowflakes in the response body.
 */
export async function fetchProfileDiscordActivity(input: {
	handle: string;
	viewerId: string | null;
}): Promise<FetchProfileDiscordActivityResult> {
	if (!isDiscordActivityEnabled()) {
		return { ok: true, body: { visible: false } };
	}

	const access = await fetchProfileAccessByHandle(input.handle.trim());
	if (!access) {
		return { ok: false, status: 404, error: "Not found" };
	}

	const ownerUserId = access.userId;
	const isOwner = input.viewerId === ownerUserId;
	if (access.isPrivate && !isOwner) {
		return { ok: false, status: 404, error: "Not found" };
	}

	const metadata = await fetchDiscordActivityProfileMetadata(ownerUserId);

	// Hide activity when the profile owner lacks Attuned+ discord_activity entitlement.
	const ownerEntitlements = await loadPatronEntitlements(ownerUserId);
	if (!patronHasPlanFeature(ownerEntitlements, "discord_activity")) {
		return { ok: true, body: { visible: false } };
	}

	const discordAccountId = metadata.discordAccountId;
	const isDiscordConnected = discordAccountId != null;

	let isMutualWithViewer = false;
	if (input.viewerId && input.viewerId !== ownerUserId) {
		const mutualIds = await fetchMutualFollowingIds(input.viewerId);
		isMutualWithViewer = mutualIds.includes(ownerUserId);
	}

	const maySeeActivity = canViewerSeeDiscordActivity({
		viewerId: input.viewerId,
		ownerUserId,
		ownerPreferences: metadata.preferences,
		isDiscordConnected,
		canViewProfile: true,
		isMutualWithViewer,
	});

	if (!maySeeActivity || !discordAccountId) {
		return { ok: true, body: { visible: false } };
	}

	const presence = await getCachedLanyardPresence(discordAccountId);
	const formatted = formatDiscordActivity(presence);
	if (!formatted) {
		return { ok: true, body: { visible: false } };
	}

	const accentColor = await resolveDiscordActivityCoverAccent(
		formatted.imageUrl,
	);
	const activity: DiscordActivityDisplay = {
		...formatted,
		accentColor,
	};

	return { ok: true, body: { visible: true, activity } };
}
