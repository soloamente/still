import { describe, expect, test } from "bun:test";

import {
	classifyDatabaseTarget,
	formatDatabaseTargetBootLine,
	sanitizeDatabaseHostLabel,
} from "./database-target";

describe("sanitizeDatabaseHostLabel", () => {
	test("redacts credentials from postgres URLs", () => {
		const label = sanitizeDatabaseHostLabel(
			"postgresql://user:secret@ep-cool-name.us-east-2.aws.neon.tech/neondb?sslmode=require",
		);
		expect(label).toBe("ep-cool-name.us-east-2.aws.neon.tech/neondb");
		expect(label).not.toContain("secret");
		expect(label).not.toContain("user:");
	});

	test("labels localhost safely", () => {
		expect(sanitizeDatabaseHostLabel("postgresql://localhost:5432/still")).toBe(
			"localhost/still",
		);
	});
});

describe("classifyDatabaseTarget", () => {
	test("marks localhost as local without job warnings", () => {
		expect(
			classifyDatabaseTarget(
				"postgresql://localhost:5432/still",
				"development",
			),
		).toEqual({
			kind: "local",
			label: "localhost/still",
			warnRecurringJobs: false,
		});
	});

	test("marks neon development URLs as warn-worthy", () => {
		const summary = classifyDatabaseTarget(
			"postgresql://u:p@ep-dev-branch.us-east-2.aws.neon.tech/neondb",
			"development",
		);
		expect(summary.kind).toBe("development");
		expect(summary.warnRecurringJobs).toBe(true);
		expect(summary.label).toContain("neon-dev:");
	});

	test("marks production neon as production", () => {
		const summary = classifyDatabaseTarget(
			"postgresql://u:p@ep-prod.us-east-2.aws.neon.tech/neondb",
			"production",
		);
		expect(summary.kind).toBe("production");
		expect(summary.warnRecurringJobs).toBe(true);
	});
});

describe("formatDatabaseTargetBootLine", () => {
	test("includes kind and label only", () => {
		const line = formatDatabaseTargetBootLine({
			kind: "local",
			label: "localhost/still",
			warnRecurringJobs: false,
		});
		expect(line).toBe("[boot] Database target: local (localhost/still)");
	});
});
