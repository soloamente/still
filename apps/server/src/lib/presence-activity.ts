/** Patron input/visibility state carried on presence heartbeats. */
export type PatronActivityState = "active" | "away";

export const PRESENCE_ACTIVITY_HASH_KEY = "sense:presence:activity";

/** Redis HASH key — userId → active|away for global online badges. */
export function presenceActivityRedisKey(): string {
	return PRESENCE_ACTIVITY_HASH_KEY;
}

/** Coerce POST body / Redis values; unknown shapes fail closed to active. */
export function normalizeActivityState(
	raw: string | undefined | null,
): PatronActivityState {
	if (raw === "away") return "away";
	return "active";
}

export type PresenceActivityRedis = {
	hset: (key: string, field: string, value: string) => Promise<unknown>;
	hget: (key: string, field: string) => Promise<string | null>;
	hdel: (key: string, field: string) => Promise<unknown>;
};

/** Persist latest activity state for a patron (refreshed on every heartbeat). */
export async function writeActivityStateForUser(
	redis: PresenceActivityRedis,
	userId: string,
	state: PatronActivityState,
): Promise<void> {
	await redis.hset(presenceActivityRedisKey(), userId, state);
}

/** Drop activity metadata when the patron leaves all presence rooms. */
export async function clearActivityStateForUser(
	redis: PresenceActivityRedis,
	userId: string,
): Promise<void> {
	await redis.hdel(presenceActivityRedisKey(), userId);
}

/** Read activity for one patron; missing hash field means active (legacy heartbeats). */
export async function readActivityStateForUser(
	redis: Pick<PresenceActivityRedis, "hget">,
	userId: string,
): Promise<PatronActivityState> {
	const raw = await redis.hget(presenceActivityRedisKey(), userId);
	return normalizeActivityState(raw);
}

/** Batch-read activity states for patron chips (defaults missing fields to active). */
export async function readActivityStatesForUserIds(
	redis: Pick<PresenceActivityRedis, "hget">,
	userIds: readonly string[],
): Promise<Map<string, PatronActivityState>> {
	const states = new Map<string, PatronActivityState>();
	await Promise.all(
		userIds.map(async (userId) => {
			states.set(userId, await readActivityStateForUser(redis, userId));
		}),
	);
	return states;
}
