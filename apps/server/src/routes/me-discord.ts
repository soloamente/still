import { Elysia } from "elysia";

import { freshContext } from "../context";
import { isDiscordActivityEnabled } from "../lib/discord-activity-config";
import { invalidateDiscordActivityMetadata } from "../lib/discord-activity-metadata-cache";
import {
	disconnectDiscordAccountForUser,
	finishDiscordPresenceGuildSetup,
	readDiscordLinkStatusForUser,
} from "../lib/discord-oauth-callback";
import { loadPatronEntitlements } from "../lib/patron-entitlements";
import {
	patronHasPlanFeature,
	planFeatureRequiredBody,
} from "../lib/plan-feature-access";

type MeDiscordRequestUser = { id: string } | null;

interface MeDiscordRouteOptions {
	deriveUser?: () => { id: string } | null;
}

/** Attuned+ `discord_activity` entitlement — required when production flag is on. */
async function patronCanUseDiscordActivity(userId: string): Promise<boolean> {
	const entitlements = await loadPatronEntitlements(userId);
	return patronHasPlanFeature(entitlements, "discord_activity");
}

const DISCORD_ACTIVITY_PRO_MESSAGE = "Discord activity is included with Pro";

/**
 * Patron Discord connect helpers — finish guild setup retry + disconnect.
 * OAuth link itself stays on Better Auth `/api/auth/*`.
 */
export function buildMeDiscordRoute(
	options: MeDiscordRouteOptions = {},
): Elysia {
	const base = new Elysia({ prefix: "/api/me", tags: ["me"] });
	const deriveUser = options.deriveUser;
	const withAuth = (deriveUser
		? base.derive({ as: "global" }, () => ({
				user: deriveUser(),
			}))
		: base.use(freshContext)) as unknown as Elysia;

	return withAuth
		.get("/discord/status", async (ctx) => {
			const { user, status } = ctx as typeof ctx & {
				user: MeDiscordRequestUser;
			};
			if (!user) return status(401, "Sign in");
			if (!isDiscordActivityEnabled()) {
				const linkStatus = await readDiscordLinkStatusForUser(user.id);
				return {
					featureEnabled: false as const,
					connected: false,
					guildJoined: false,
					discordActivityEnabled: false,
					discordUsername: linkStatus.discordUsername,
				};
			}

			const [linkStatus, canUseDiscordActivity] = await Promise.all([
				readDiscordLinkStatusForUser(user.id),
				patronCanUseDiscordActivity(user.id),
			]);
			return {
				featureEnabled: true as const,
				canUseDiscordActivity,
				...linkStatus,
			};
		})
		.post("/discord/finish-setup", async (ctx) => {
			const { user, status } = ctx as typeof ctx & {
				user: MeDiscordRequestUser;
			};
			if (!user) return status(401, "Sign in");
			if (!isDiscordActivityEnabled()) return status(404, "Not found");

			if (!(await patronCanUseDiscordActivity(user.id))) {
				return status(
					403,
					planFeatureRequiredBody(
						"discord_activity",
						DISCORD_ACTIVITY_PRO_MESSAGE,
					),
				);
			}

			const result = await finishDiscordPresenceGuildSetup(user.id);
			if (!result.ok) {
				if (result.code === "FEATURE_DISABLED") {
					return status(404, "Not found");
				}
				if (result.code === "NOT_LINKED") {
					return status(400, "Discord is not connected");
				}
				return status(400, "Discord access token missing — reconnect Discord");
			}

			return { ok: true as const, guildJoined: result.guildJoined };
		})
		.delete("/discord", async (ctx) => {
			const { user, status } = ctx as typeof ctx & {
				user: MeDiscordRequestUser;
			};
			if (!user) return status(401, "Sign in");
			if (!isDiscordActivityEnabled()) return status(404, "Not found");

			if (!(await patronCanUseDiscordActivity(user.id))) {
				return status(
					403,
					planFeatureRequiredBody(
						"discord_activity",
						DISCORD_ACTIVITY_PRO_MESSAGE,
					),
				);
			}

			const disconnected = await disconnectDiscordAccountForUser(user.id);
			if (!disconnected) {
				return status(400, "Discord is not connected");
			}

			void invalidateDiscordActivityMetadata(user.id);

			return { ok: true as const };
		}) as unknown as Elysia;
}

export const meDiscordRoute = buildMeDiscordRoute();
