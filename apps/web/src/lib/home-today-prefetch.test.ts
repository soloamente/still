import { describe, expect, test } from "bun:test";

import { shouldPrefetchInactiveToday } from "./home-today-prefetch";

describe("shouldPrefetchInactiveToday", () => {
	test("does not request the other tab before paint or hover", () => {
		expect(
			shouldPrefetchInactiveToday({
				inactiveRequested: false,
				trigger: "mount",
			}),
		).toBe(false);
	});

	test("requests once after the active Today paints", () => {
		expect(
			shouldPrefetchInactiveToday({
				inactiveRequested: false,
				trigger: "painted",
			}),
		).toBe(true);
	});

	test("requests when the other pill is hovered", () => {
		expect(
			shouldPrefetchInactiveToday({
				inactiveRequested: false,
				trigger: "hover",
			}),
		).toBe(true);
	});

	test("does not request twice", () => {
		expect(
			shouldPrefetchInactiveToday({
				inactiveRequested: true,
				trigger: "hover",
			}),
		).toBe(false);
	});
});
