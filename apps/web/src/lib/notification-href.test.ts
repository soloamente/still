import { describe, expect, test } from "bun:test";

import {
	notificationPayloadHref,
	profileTasteCompareFromSearch,
} from "./notification-href";

describe("notification-href", () => {
	test("rewrites legacy review href when movieId is present", () => {
		expect(
			notificationPayloadHref({
				href: "/reviews/rev_1",
				movieId: 42,
				reviewId: "rev_1",
			}),
		).toBe("/movies/42?review=rev_1");
	});

	test("builds href from ids when href missing", () => {
		expect(
			notificationPayloadHref({
				reviewId: "rev_1",
				movieId: 42,
			}),
		).toBe("/movies/42?review=rev_1");
	});

	test("profileTasteCompareFromSearch", () => {
		expect(profileTasteCompareFromSearch("?tasteCompare=1")).toBe(true);
		expect(profileTasteCompareFromSearch("?tasteCompare=true")).toBe(true);
		expect(profileTasteCompareFromSearch("?tasteCompare=0")).toBe(false);
	});
});
