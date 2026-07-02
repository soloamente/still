import { describe, expect, test } from "bun:test";

import {
	arePatronPresenceMapsEqual,
	normalizePatronPresenceSnapshot,
	type PatronPresenceSnapshot,
} from "./patron-online-presence";

describe("arePatronPresenceMapsEqual", () => {
	test("returns true for identical maps", () => {
		const snapshot: PatronPresenceSnapshot = {
			presence: [
				{ handle: "alice", state: "active" },
				{ handle: "bob", state: "away" },
			],
		};
		const a = normalizePatronPresenceSnapshot(snapshot);
		const b = normalizePatronPresenceSnapshot(snapshot);
		expect(arePatronPresenceMapsEqual(a, b)).toBe(true);
	});

	test("returns false when a handle state differs", () => {
		const a = normalizePatronPresenceSnapshot({
			presence: [{ handle: "alice", state: "active" }],
		});
		const b = normalizePatronPresenceSnapshot({
			presence: [{ handle: "alice", state: "away" }],
		});
		expect(arePatronPresenceMapsEqual(a, b)).toBe(false);
	});

	test("returns false when size differs", () => {
		const a = normalizePatronPresenceSnapshot({
			presence: [{ handle: "alice", state: "active" }],
		});
		const b = normalizePatronPresenceSnapshot({ presence: [] });
		expect(arePatronPresenceMapsEqual(a, b)).toBe(false);
	});
});
