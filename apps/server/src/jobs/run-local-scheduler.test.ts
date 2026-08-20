import { describe, expect, test } from "bun:test";

import { isLocalJobsEnabled } from "./run-local-scheduler";

describe("isLocalJobsEnabled", () => {
	test("defaults to false when unset", () => {
		const prior = process.env.RUN_LOCAL_JOBS;
		delete process.env.RUN_LOCAL_JOBS;
		expect(isLocalJobsEnabled()).toBe(false);
		if (prior === undefined) delete process.env.RUN_LOCAL_JOBS;
		else process.env.RUN_LOCAL_JOBS = prior;
	});

	test("accepts true/1/yes", () => {
		const prior = process.env.RUN_LOCAL_JOBS;
		process.env.RUN_LOCAL_JOBS = "true";
		expect(isLocalJobsEnabled()).toBe(true);
		process.env.RUN_LOCAL_JOBS = "1";
		expect(isLocalJobsEnabled()).toBe(true);
		process.env.RUN_LOCAL_JOBS = "yes";
		expect(isLocalJobsEnabled()).toBe(true);
		if (prior === undefined) delete process.env.RUN_LOCAL_JOBS;
		else process.env.RUN_LOCAL_JOBS = prior;
	});

	test("rejects other values", () => {
		const prior = process.env.RUN_LOCAL_JOBS;
		process.env.RUN_LOCAL_JOBS = "false";
		expect(isLocalJobsEnabled()).toBe(false);
		if (prior === undefined) delete process.env.RUN_LOCAL_JOBS;
		else process.env.RUN_LOCAL_JOBS = prior;
	});
});
