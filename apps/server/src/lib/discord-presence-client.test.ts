import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const INTERNAL_SECRET = "presence-internal-secret";

const envMock: Record<string, string | undefined> = {
	DISCORD_PRESENCE_WORKER_URL: "http://presence.example",
	DISCORD_PRESENCE_INTERNAL_SECRET: INTERNAL_SECRET,
};

mock.module("@still/env/server", () => ({
	env: envMock,
}));

const samplePresence = {
	listening_to_spotify: true,
	spotify: {
		song: "Let Go",
		artist: "Ark Patrol",
		album_art_url: null,
	},
	activities: [],
	discord_status: "online",
};

let fetchCallCount = 0;
let lastAuthorization: string | undefined;
const originalFetch = globalThis.fetch;

/** Reads Authorization from fetch init — Worker calls must send Bearer exactly. */
function authorizationFromInit(init?: RequestInit): string | undefined {
	const headers = init?.headers;
	if (!headers) return undefined;
	if (headers instanceof Headers) {
		return headers.get("Authorization") ?? undefined;
	}
	if (Array.isArray(headers)) {
		const found = headers.find(
			([name]) => name.toLowerCase() === "authorization",
		);
		return found?.[1];
	}
	const record = headers as Record<string, string>;
	return record.Authorization ?? record.authorization;
}

beforeEach(() => {
	fetchCallCount = 0;
	lastAuthorization = undefined;
	globalThis.fetch = mock(
		async (input: RequestInfo | URL, init?: RequestInit) => {
			fetchCallCount += 1;
			lastAuthorization = authorizationFromInit(init);
			const url = String(input);
			expect(url).toBe("http://presence.example/v1/users/94490510688792576");

			return new Response(
				JSON.stringify({
					success: true,
					data: samplePresence,
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		},
	) as typeof fetch;
});

afterEach(async () => {
	globalThis.fetch = originalFetch;
	const { resetDiscordPresenceCacheForTests } = await import(
		"./discord-presence-client"
	);
	resetDiscordPresenceCacheForTests();
	envMock.DISCORD_PRESENCE_WORKER_URL = "http://presence.example";
	envMock.DISCORD_PRESENCE_INTERNAL_SECRET = INTERNAL_SECRET;
});

describe("fetchDiscordPresence", () => {
	test("returns null when Worker URL is unset", async () => {
		envMock.DISCORD_PRESENCE_WORKER_URL = undefined;
		const { fetchDiscordPresence } = await import("./discord-presence-client");

		expect(await fetchDiscordPresence("94490510688792576")).toBeNull();
		expect(fetchCallCount).toBe(0);
	});

	test("returns null when internal secret is unset", async () => {
		envMock.DISCORD_PRESENCE_INTERNAL_SECRET = undefined;
		const { fetchDiscordPresence } = await import("./discord-presence-client");

		expect(await fetchDiscordPresence("94490510688792576")).toBeNull();
		expect(fetchCallCount).toBe(0);
	});

	test("returns data on successful Worker response", async () => {
		const { fetchDiscordPresence } = await import("./discord-presence-client");

		expect(await fetchDiscordPresence("94490510688792576")).toEqual(
			samplePresence,
		);
		expect(fetchCallCount).toBe(1);
		expect(lastAuthorization).toBe(`Bearer ${INTERNAL_SECRET}`);
	});

	test("returns null when Worker responds with success false", async () => {
		globalThis.fetch = mock(async () => {
			fetchCallCount += 1;
			return new Response(JSON.stringify({ success: false }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}) as typeof fetch;

		const { fetchDiscordPresence } = await import("./discord-presence-client");

		expect(await fetchDiscordPresence("94490510688792576")).toBeNull();
	});
});

describe("getCachedDiscordPresence", () => {
	test("reuses cached payload within TTL", async () => {
		const { getCachedDiscordPresence } = await import(
			"./discord-presence-client"
		);

		expect(await getCachedDiscordPresence("94490510688792576")).toEqual(
			samplePresence,
		);
		expect(await getCachedDiscordPresence("94490510688792576")).toEqual(
			samplePresence,
		);
		expect(fetchCallCount).toBe(1);
	});
});
