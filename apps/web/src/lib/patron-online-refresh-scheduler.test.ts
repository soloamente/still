import { describe, expect, test } from "bun:test";

import { createPatronOnlineRefreshScheduler } from "./patron-online-refresh-scheduler";

describe("createPatronOnlineRefreshScheduler", () => {
	test("coalesces concurrent refresh calls into one in-flight fetch", async () => {
		let inFlight = 0;
		let maxInFlight = 0;
		let runs = 0;

		const scheduler = createPatronOnlineRefreshScheduler(async () => {
			inFlight += 1;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await new Promise((resolve) => setTimeout(resolve, 20));
			runs += 1;
			inFlight -= 1;
		});

		scheduler.refresh();
		scheduler.refresh();
		scheduler.refresh();

		await new Promise((resolve) => setTimeout(resolve, 80));

		expect(maxInFlight).toBe(1);
		expect(runs).toBeGreaterThanOrEqual(1);
	});

	test("runs a trailing refresh after in-flight completes", async () => {
		let runs = 0;

		const scheduler = createPatronOnlineRefreshScheduler(async () => {
			runs += 1;
			await new Promise((resolve) => setTimeout(resolve, 10));
		});

		scheduler.refresh();
		scheduler.refresh();

		await new Promise((resolve) => setTimeout(resolve, 60));

		expect(runs).toBe(2);
	});
});
