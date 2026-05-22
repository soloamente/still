import { describe, expect, test } from "bun:test";

import {
	buildAchievementsLobbyHref,
	isAchievementsLobbyTabId,
	parseAchievementsLobbyTab,
} from "./achievements-lobby-tab";

describe("parseAchievementsLobbyTab", () => {
	test("goals tab when query is goals", () => {
		expect(parseAchievementsLobbyTab("goals")).toBe("goals");
	});

	test("defaults to badges for missing or unknown tab", () => {
		expect(parseAchievementsLobbyTab(undefined)).toBe("badges");
		expect(parseAchievementsLobbyTab(null)).toBe("badges");
		expect(parseAchievementsLobbyTab("badges")).toBe("badges");
		expect(parseAchievementsLobbyTab("activity")).toBe("badges");
	});
});

describe("buildAchievementsLobbyHref", () => {
	test("badges omits query param", () => {
		expect(buildAchievementsLobbyHref("badges")).toBe("/achievements");
	});

	test("goals uses tab query", () => {
		expect(buildAchievementsLobbyHref("goals")).toBe("/achievements?tab=goals");
	});
});

describe("isAchievementsLobbyTabId", () => {
	test("accepts known tab ids only", () => {
		expect(isAchievementsLobbyTabId("badges")).toBe(true);
		expect(isAchievementsLobbyTabId("goals")).toBe(true);
		expect(isAchievementsLobbyTabId("reviews")).toBe(false);
	});
});
