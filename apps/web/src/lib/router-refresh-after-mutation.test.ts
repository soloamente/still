import { describe, expect, test } from "bun:test";
import { shouldRefreshRouteAfterMutation } from "./router-refresh-after-mutation";

describe("shouldRefreshRouteAfterMutation", () => {
	test("refreshes movie and TV detail routes", () => {
		expect(shouldRefreshRouteAfterMutation("/movies/1708589")).toBe(true);
		expect(shouldRefreshRouteAfterMutation("/tv/1399")).toBe(true);
	});

	test("refreshes diary and profile lobbies", () => {
		expect(shouldRefreshRouteAfterMutation("/diary")).toBe(true);
		expect(shouldRefreshRouteAfterMutation("/profile/adgv")).toBe(true);
	});

	test("skips home catalogue to avoid grid re-stagger", () => {
		expect(shouldRefreshRouteAfterMutation("/home")).toBe(false);
	});
});
