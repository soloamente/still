import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const envMock: Record<string, string | undefined> = {
	LANYARD_INTERNAL_URL: "http://lanyard:4001",
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
const originalFetch = globalThis.fetch;

beforeEach(() => {
	fetchCallCount = 0;
	globalThis.fetch = mock(async (input: RequestInfo | URL) => {
		fetchCallCount += 1;
		const url = String(input);
		expect(url).toBe("http://lanyard:4001/v1/users/94490510688792576");

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
	}) as typeof fetch;
});

afterEach(async () => {
	globalThis.fetch = originalFetch;
	const { resetLanyardPresenceCacheForTests } = await import(
		"./lanyard-client"
	);
	resetLanyardPresenceCacheForTests();
	envMock.LANYARD_INTERNAL_URL = "http://lanyard:4001";
});

describe("fetchLanyardPresence", () => {
	test("returns null when Lanyard URL is unset", async () => {
		envMock.LANYARD_INTERNAL_URL = undefined;
		const { fetchLanyardPresence } = await import("./lanyard-client");

		expect(await fetchLanyardPresence("94490510688792576")).toBeNull();
		expect(fetchCallCount).toBe(0);
	});

	test("returns data on successful Lanyard response", async () => {
		const { fetchLanyardPresence } = await import("./lanyard-client");

		expect(await fetchLanyardPresence("94490510688792576")).toEqual(
			samplePresence,
		);
		expect(fetchCallCount).toBe(1);
	});

	test("returns null when Lanyard responds with success false", async () => {
		globalThis.fetch = mock(async () => {
			fetchCallCount += 1;
			return new Response(JSON.stringify({ success: false }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}) as typeof fetch;

		const { fetchLanyardPresence } = await import("./lanyard-client");

		expect(await fetchLanyardPresence("94490510688792576")).toBeNull();
	});
});

describe("getCachedLanyardPresence", () => {
	test("reuses cached payload within TTL", async () => {
		const { getCachedLanyardPresence } = await import("./lanyard-client");

		expect(await getCachedLanyardPresence("94490510688792576")).toEqual(
			samplePresence,
		);
		expect(await getCachedLanyardPresence("94490510688792576")).toEqual(
			samplePresence,
		);
		expect(fetchCallCount).toBe(1);
	});
});
