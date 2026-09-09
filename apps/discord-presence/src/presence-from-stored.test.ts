import { describe, expect, test } from "bun:test";

import { presenceFromStoredJson } from "./presence-from-stored";

const EMPTY_SUCCESS = {
	discord_status: "offline",
	activities: [],
	listening_to_spotify: false,
	spotify: null,
};

describe("presenceFromStoredJson", () => {
	test("missing stored JSON yields empty presence", () => {
		expect(presenceFromStoredJson(null)).toEqual(EMPTY_SUCCESS);
	});

	test("invalid stored JSON yields empty presence", () => {
		expect(presenceFromStoredJson("{not-json")).toEqual(EMPTY_SUCCESS);
		expect(presenceFromStoredJson("")).toEqual(EMPTY_SUCCESS);
		expect(presenceFromStoredJson("null")).toEqual(EMPTY_SUCCESS);
	});

	test("valid raw snapshot JSON maps to Lanyard on read", () => {
		const stored = JSON.stringify({
			status: "online",
			activities: [{ type: 0, name: "Hades II" }],
		});
		expect(presenceFromStoredJson(stored)).toEqual({
			discord_status: "online",
			activities: [{ type: 0, name: "Hades II" }],
			listening_to_spotify: false,
			spotify: null,
		});
	});
});
