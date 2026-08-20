const DISCORD_USERS_ME_URL = "https://discord.com/api/v10/users/@me";
const USERNAME_CACHE_TTL_MS = 5 * 60 * 1000;

type UsernameCacheEntry = {
	username: string | null;
	expiresAt: number;
};

const usernameCache = new Map<string, UsernameCacheEntry>();

/** Test helper — drop the in-process Discord username cache. */
export function resetDiscordUsernameCacheForTests(): void {
	usernameCache.clear();
}

function readUsernameFromDiscordUser(body: unknown): string | null {
	if (!body || typeof body !== "object") return null;
	const username =
		"username" in body && typeof body.username === "string"
			? body.username.trim()
			: "";
	return username || null;
}

/** Discord `GET /users/@me` — unique username, not display name. */
export async function fetchDiscordUsername(
	accessToken: string,
): Promise<string | null> {
	const token = accessToken.trim();
	if (!token) return null;

	try {
		const response = await fetch(DISCORD_USERS_ME_URL, {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/json",
			},
			signal: AbortSignal.timeout(5_000),
		});
		if (!response.ok) return null;
		return readUsernameFromDiscordUser(await response.json());
	} catch (error) {
		console.error("[discord-username] users/@me failed", error);
		return null;
	}
}

/** Cached username for a linked Discord account (5 min). */
export async function resolveDiscordUsernameForAccount(input: {
	accountId: string;
	accessToken: string | null;
}): Promise<string | null> {
	const accountId = input.accountId.trim();
	if (!accountId) return null;

	const now = Date.now();
	const cached = usernameCache.get(accountId);
	if (cached && cached.expiresAt > now) return cached.username;

	const username = input.accessToken
		? await fetchDiscordUsername(input.accessToken)
		: null;
	usernameCache.set(accountId, {
		username,
		expiresAt: now + USERNAME_CACHE_TTL_MS,
	});
	return username;
}
