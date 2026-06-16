import { describe, expect, test } from "bun:test";

import { normalizePatronPresenceSnapshot } from "./patron-online-presence";

describe("normalizePatronPresenceSnapshot", () => {
	test("maps presence rows to lowercase handle keys", () => {
		const map = normalizePatronPresenceSnapshot({
			presence: [
				{ handle: "Ada", state: "away" },
				{ handle: "bob", state: "active" },
			],
		});
		expect(map.get("ada")).toBe("away");
		expect(map.get("bob")).toBe("active");
	});
});
