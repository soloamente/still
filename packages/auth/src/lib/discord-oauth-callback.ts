import { account, db } from "@still/db";
import { and, eq } from "drizzle-orm";

import { hasDiscordActivityInfrastructure } from "./discord-activity-config";
import {
	addPatronToPresenceGuild,
	removePatronFromPresenceGuild,
} from "./discord-presence-guild";
import {
	PROFILE_PREF_DISCORD_ACTIVITY_ENABLED,
	PROFILE_PREF_DISCORD_PRESENCE_GUILD_JOINED,
	readDiscordIntegrationPreferences,
	writeDiscordIntegrationPreferences,
} from "./discord-profile-integration";
import { resolveDiscordUsernameForAccount } from "./discord-username";

type DiscordAccountRow = {
	accountId: string;
	accessToken: string | null;
};

/** Optional server hook — auth package cannot import Redis cache helpers. */
type DiscordMetadataInvalidator = (userId: string) => void | Promise<void>;
let discordMetadataInvalidator: DiscordMetadataInvalidator | null = null;

export function registerDiscordMetadataInvalidator(
	fn: DiscordMetadataInvalidator,
): void {
	discordMetadataInvalidator = fn;
}

async function notifyDiscordMetadataChanged(userId: string): Promise<void> {
	try {
		await discordMetadataInvalidator?.(userId);
	} catch (err) {
		console.error("[discord] metadata cache invalidation failed", err);
	}
}

/** Loads the patron's linked Discord OAuth account row when present. */
export async function fetchDiscordAccountForUser(
	userId: string,
): Promise<DiscordAccountRow | null> {
	const [row] = await db
		.select({
			accountId: account.accountId,
			accessToken: account.accessToken,
		})
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, "discord")))
		.limit(1);

	if (!row?.accountId?.trim()) return null;
	return {
		accountId: row.accountId.trim(),
		accessToken: row.accessToken,
	};
}

/**
 * Runs after Better Auth links or refreshes a Discord account — guild join +
 * profile integration prefs.
 */
export async function handleDiscordAccountLinked(input: {
	userId: string;
	discordAccountId: string;
	accessToken: string | null | undefined;
}): Promise<{ guildJoined: boolean }> {
	const guildJoined =
		hasDiscordActivityInfrastructure() && input.accessToken?.trim()
			? await addPatronToPresenceGuild(
					input.discordAccountId,
					input.accessToken,
				)
			: false;

	await writeDiscordIntegrationPreferences(input.userId, {
		[PROFILE_PREF_DISCORD_ACTIVITY_ENABLED]: true,
		[PROFILE_PREF_DISCORD_PRESENCE_GUILD_JOINED]: guildJoined,
	});

	await notifyDiscordMetadataChanged(input.userId);

	return { guildJoined };
}

/** Runs before Discord account unlink/delete — guild kick + disable activity prefs. */
export async function handleDiscordAccountUnlinked(input: {
	userId: string;
	discordAccountId: string;
}): Promise<void> {
	if (hasDiscordActivityInfrastructure()) {
		await removePatronFromPresenceGuild(input.discordAccountId);
	}

	await writeDiscordIntegrationPreferences(input.userId, {
		[PROFILE_PREF_DISCORD_ACTIVITY_ENABLED]: false,
		[PROFILE_PREF_DISCORD_PRESENCE_GUILD_JOINED]: false,
	});

	await notifyDiscordMetadataChanged(input.userId);
}

export type DiscordLinkStatus = {
	connected: boolean;
	guildJoined: boolean;
	discordActivityEnabled: boolean;
	/** Unique Discord username when the account is linked and `/users/@me` succeeds. */
	discordUsername: string | null;
};

/** Settings/status payload for Discord connect UI. */
export async function readDiscordLinkStatusForUser(
	userId: string,
): Promise<DiscordLinkStatus> {
	const linked = await fetchDiscordAccountForUser(userId);
	const prefs = await readDiscordIntegrationPreferences(userId);
	const discordUsername = linked
		? await resolveDiscordUsernameForAccount(linked)
		: null;

	return {
		connected: linked != null,
		guildJoined: prefs.discordPresenceGuildJoined,
		discordActivityEnabled: prefs.discordActivityEnabled,
		discordUsername,
	};
}

/** Retries Sense Presence guild join when OAuth succeeded but the bot add failed. */
export async function finishDiscordPresenceGuildSetup(
	userId: string,
): Promise<
	| { ok: true; guildJoined: boolean }
	| { ok: false; code: "NOT_LINKED" | "NO_TOKEN" | "FEATURE_DISABLED" }
> {
	if (!hasDiscordActivityInfrastructure()) {
		return { ok: false, code: "FEATURE_DISABLED" };
	}

	const linked = await fetchDiscordAccountForUser(userId);
	if (!linked) return { ok: false, code: "NOT_LINKED" };
	if (!linked.accessToken?.trim()) return { ok: false, code: "NO_TOKEN" };

	const { guildJoined } = await handleDiscordAccountLinked({
		userId,
		discordAccountId: linked.accountId,
		accessToken: linked.accessToken,
	});

	return { ok: true, guildJoined };
}

/** Disconnect Discord — kick guild member, clear prefs, delete account row. */
export async function disconnectDiscordAccountForUser(
	userId: string,
): Promise<boolean> {
	const linked = await fetchDiscordAccountForUser(userId);
	if (!linked) return false;

	await handleDiscordAccountUnlinked({
		userId,
		discordAccountId: linked.accountId,
	});

	await db
		.delete(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, "discord")));

	return true;
}

/**
 * Best-effort Sense Presence guild kick before account deletion removes the
 * Discord `account` row via cascade.
 */
export async function kickDiscordPresenceGuildOnUserDelete(
	userId: string,
): Promise<void> {
	if (!hasDiscordActivityInfrastructure()) return;

	try {
		const linked = await fetchDiscordAccountForUser(userId);
		if (!linked) return;
		await removePatronFromPresenceGuild(linked.accountId);
	} catch (err) {
		console.error(
			"[discord-oauth-callback] guild kick on user delete failed",
			err,
		);
	}
}
