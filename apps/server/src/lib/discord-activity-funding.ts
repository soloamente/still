import { countPolarPayingSubscribers } from "./count-polar-paying-subscribers";
import { isDiscordActivityEnabled } from "./discord-activity-config";
import { getDiscordActivityProTarget } from "./discord-activity-pro-target";
import { cachedRead, cacheRedis } from "./redis-cache";

/** Public funding bar payload — no patron PII. */
export type DiscordActivityFundingPayload = {
	current: number;
	target: number;
	productionEnabled: boolean;
};

const FUNDING_COUNT_CACHE_KEY = "cache:discord-activity:funding-count:v1";
const FUNDING_COUNT_TTL_SEC = 60;

/**
 * Funding progress for Discord activity rollout.
 * Only Polar subscriber count is cached (~60s); target and production flag
 * are resolved live so ops env flips are not stuck behind cache TTL.
 */
export async function getDiscordActivityFundingPayload(): Promise<DiscordActivityFundingPayload> {
	const redis = await cacheRedis();
	const current = await cachedRead(
		redis,
		FUNDING_COUNT_CACHE_KEY,
		FUNDING_COUNT_TTL_SEC,
		() => countPolarPayingSubscribers(),
	);
	return {
		current,
		target: getDiscordActivityProTarget(),
		productionEnabled: isDiscordActivityEnabled(),
	};
}
