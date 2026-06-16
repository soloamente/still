import { describe, expect, test } from "bun:test";

import type { PatronActivityState } from "./patron-activity-tracker";
import { createPresenceHeartbeatScheduler } from "./presence-heartbeat-scheduler";

describe("createPresenceHeartbeatScheduler", () => {
	test("active posts immediately", async () => {
		const posts: PatronActivityState[] = [];
		const scheduler = createPresenceHeartbeatScheduler(
			() => "active",
			async (state) => {
				posts.push(state);
				return true;
			},
			50,
		);

		scheduler.onActivityChange("active");
		expect(posts).toEqual(["active"]);
		scheduler.dispose();
	});

	test("away debounces until state settles", async () => {
		const posts: PatronActivityState[] = [];
		let state: PatronActivityState = "away";
		const scheduler = createPresenceHeartbeatScheduler(
			() => state,
			async (next) => {
				posts.push(next);
				return true;
			},
			40,
		);

		scheduler.onActivityChange("away");
		expect(posts).toEqual([]);

		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(posts).toEqual(["away"]);

		state = "active";
		scheduler.onActivityChange("away");
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(posts).toEqual(["away"]);

		scheduler.dispose();
	});

	test("away debounce cancelled when active returns quickly", async () => {
		const posts: PatronActivityState[] = [];
		let state: PatronActivityState = "away";
		const scheduler = createPresenceHeartbeatScheduler(
			() => state,
			async (next) => {
				posts.push(next);
				return true;
			},
			40,
		);

		scheduler.onActivityChange("away");
		state = "active";
		scheduler.onActivityChange("active");

		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(posts).toEqual(["active"]);

		scheduler.dispose();
	});
});
