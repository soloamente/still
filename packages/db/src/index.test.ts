import { afterEach, describe, expect, mock, test } from "bun:test";

// Hermetic: stub the env module so importing ./index does not require a real
// DATABASE_URL (mirrors the mock.module pattern in 00-realtime-publish.test.ts).
mock.module("@still/env/server", () => ({
	env: {
		DATABASE_URL:
			"postgres://user:pass@db.fake.neon.tech/neondb?sslmode=require",
	},
}));

const { currentDbDriverName, db, resetDbForTests, setDbConnectionString } =
	await import("./index");

afterEach(() => {
	setDbConnectionString(undefined);
	resetDbForTests();
});

describe("db lazy proxy", () => {
	test("exposes drizzle query methods without opening a connection", () => {
		expect(typeof db.select).toBe("function");
		expect(typeof db.execute).toBe("function");
	});

	test("defaults to the neon-http driver", () => {
		void db.select;
		expect(currentDbDriverName()).toBe("neon-http");
	});

	test("switches to postgres-js once a Hyperdrive string is set", () => {
		setDbConnectionString("postgres://hyperdrive-pooled/db");
		void db.select;
		expect(currentDbDriverName()).toBe("postgres-js");
	});
});
