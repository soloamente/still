import { db, profile } from "@still/db";
import { eq } from "drizzle-orm";

export const PROFILE_PREF_INTEGRATIONS = "integrations" as const;
export const PROFILE_PREF_DISCORD_ACTIVITY_ENABLED =
	"discordActivityEnabled" as const;
export const PROFILE_PREF_DISCORD_PRESENCE_GUILD_JOINED =
	"discordPresenceGuildJoined" as const;

function readIntegrationsObject(
	preferences: Record<string, unknown>,
): Record<string, unknown> {
	const raw = preferences[PROFILE_PREF_INTEGRATIONS];
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
		return {};
	}
	return raw as Record<string, unknown>;
}

async function readProfilePreferences(
	userId: string,
): Promise<Record<string, unknown>> {
	const [row] = await db
		.select({ preferences: profile.preferences })
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);

	const prefs = row?.preferences;
	if (prefs && typeof prefs === "object" && !Array.isArray(prefs)) {
		return prefs as Record<string, unknown>;
	}
	return {};
}

/** Persist Discord integration toggles under `profile.preferences.integrations`. */
export async function writeDiscordIntegrationPreferences(
	userId: string,
	patch: Record<string, unknown>,
): Promise<void> {
	const existing = await readProfilePreferences(userId);
	const integrations = {
		...readIntegrationsObject(existing),
		...patch,
	};
	const nextPreferences = {
		...existing,
		[PROFILE_PREF_INTEGRATIONS]: integrations,
	};

	await db
		.update(profile)
		.set({ preferences: nextPreferences })
		.where(eq(profile.userId, userId));
}

export async function readDiscordIntegrationPreferences(
	userId: string,
): Promise<{
	discordActivityEnabled: boolean;
	discordPresenceGuildJoined: boolean;
}> {
	const preferences = await readProfilePreferences(userId);
	const integrations = readIntegrationsObject(preferences);
	const activityRaw = integrations[PROFILE_PREF_DISCORD_ACTIVITY_ENABLED];
	const guildRaw = integrations[PROFILE_PREF_DISCORD_PRESENCE_GUILD_JOINED];

	return {
		discordActivityEnabled:
			typeof activityRaw === "boolean" ? activityRaw : true,
		discordPresenceGuildJoined: guildRaw === true,
	};
}
