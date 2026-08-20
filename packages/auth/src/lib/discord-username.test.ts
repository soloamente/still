import { describe, expect, test } from "bun:test";

import { fetchDiscordUsername } from "./discord-username";

describe("fetchDiscordUsername", () => {
	test("returns null when the token is empty", async () => {
		expect(await fetchDiscordUsername("   ")).toBeNull();
	});
});
