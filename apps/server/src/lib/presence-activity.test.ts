import { describe, expect, test } from "bun:test";

import {
	normalizeActivityState,
	presenceActivityRedisKey,
	readActivityStateForUser,
} from "./presence-activity";

describe("normalizeActivityState", () => {
	test("defaults missing to active", () => {
		expect(normalizeActivityState(undefined)).toBe("active");
	});

	test("accepts away", () => {
		expect(normalizeActivityState("away")).toBe("away");
	});

	test("rejects invalid values", () => {
		expect(normalizeActivityState("offline")).toBe("active");
	});
});

describe("readActivityStateForUser", () => {
	test("missing hash field returns active", async () => {
		const redis = {
			hget: async () => null,
		};
		expect(await readActivityStateForUser(redis, "usr_1")).toBe("active");
	});

	test("away hash value returns away", async () => {
		const redis = {
			hget: async () => "away",
		};
		expect(await readActivityStateForUser(redis, "usr_1")).toBe("away");
	});
});

test("presenceActivityRedisKey is stable", () => {
	expect(presenceActivityRedisKey()).toBe("sense:presence:activity");
});
