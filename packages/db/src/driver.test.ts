import { describe, expect, test } from "bun:test";

import { resolveDbDriver } from "./driver";

describe("resolveDbDriver", () => {
	test("uses neon-http with DATABASE_URL when no Hyperdrive string", () => {
		const choice = resolveDbDriver({
			hyperdriveConnString: undefined,
			databaseUrl: "postgres://neon-http-url",
		});
		expect(choice).toEqual({
			driver: "neon-http",
			connectionString: "postgres://neon-http-url",
		});
	});

	test("uses postgres-js with the Hyperdrive string when present", () => {
		const choice = resolveDbDriver({
			hyperdriveConnString: "postgres://hyperdrive-pooled",
			databaseUrl: "postgres://neon-http-url",
		});
		expect(choice).toEqual({
			driver: "postgres-js",
			connectionString: "postgres://hyperdrive-pooled",
		});
	});

	test("treats an empty/whitespace Hyperdrive string as unset", () => {
		const choice = resolveDbDriver({
			hyperdriveConnString: "   ",
			databaseUrl: "postgres://neon-http-url",
		});
		expect(choice.driver).toBe("neon-http");
	});
});
