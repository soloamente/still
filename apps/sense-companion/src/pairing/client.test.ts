import { describe, expect, test } from "bun:test";

import {
	linkCompanion,
	memoryCompanionTokenStore,
	pairCompanion,
	pairErrorCopy,
	readCompanionStatus,
} from "./client";

const ORIGIN = "http://127.0.0.1:3001";

describe("pairCompanion", () => {
	test("stores the device token from a pairing code", async () => {
		const store = memoryCompanionTokenStore();
		const result = await pairCompanion({
			origin: ORIGIN,
			code: " ab12-cd34 ",
			store,
			fetchImpl: async (url, init) => {
				expect(String(url)).toBe(`${ORIGIN}/api/companion/token`);
				expect(init?.method).toBe("POST");
				expect(JSON.parse(String(init?.body))).toEqual({ code: "AB12-CD34" });
				return new Response(JSON.stringify({ token: "device-token" }), {
					status: 200,
				});
			},
		});

		expect(result).toEqual({ ok: true });
		expect(await store.get()).toBe("device-token");
	});

	test("does not store a token when the code is rejected", async () => {
		const store = memoryCompanionTokenStore();
		const result = await pairCompanion({
			origin: ORIGIN,
			code: "ZZZZ-ZZZZ",
			store,
			fetchImpl: async () =>
				new Response(JSON.stringify({ error: "expired" }), { status: 401 }),
		});

		expect(result).toEqual({ ok: false, error: "expired" });
		expect(await store.get()).toBeNull();
		expect(pairErrorCopy("expired")).toBe(
			"That code expired. Ask Sense for a new one.",
		);
	});
});

describe("readCompanionStatus", () => {
	test("clears a revoked token", async () => {
		const store = memoryCompanionTokenStore("device-token");
		const status = await readCompanionStatus({
			origin: ORIGIN,
			store,
			fetchImpl: async (url, init) => {
				expect(String(url)).toBe(`${ORIGIN}/api/companion/session`);
				expect(init?.headers).toEqual({
					authorization: "Bearer device-token",
				});
				return new Response("Sign in", { status: 401 });
			},
		});

		expect(status).toBe("not_paired");
		expect(await store.get()).toBeNull();
	});

	test("stays paired when the token is still valid", async () => {
		const store = memoryCompanionTokenStore("device-token");
		const status = await readCompanionStatus({
			origin: ORIGIN,
			store,
			fetchImpl: async () =>
				new Response(JSON.stringify({ ok: true }), { status: 200 }),
		});

		expect(status).toBe("paired");
		expect(await store.get()).toBe("device-token");
	});
});

describe("linkCompanion", () => {
	test("stores a token from the signed-in Sense session", async () => {
		const store = memoryCompanionTokenStore();
		const result = await linkCompanion({
			store,
			origins: ["http://localhost:3001"],
			fetchImpl: async (url, init) => {
				expect(String(url)).toBe("http://localhost:3001/api/me/companion/link");
				expect(init?.credentials).toBe("include");
				expect(init?.headers?.["x-sense-companion"]).toBe("link");
				return new Response(JSON.stringify({ token: "linked-token" }), {
					status: 200,
				});
			},
		});

		expect(result).toBe("paired");
		expect(await store.get()).toBe("linked-token");
	});

	test("does not mint another token when one is already stored", async () => {
		const store = memoryCompanionTokenStore("already");
		let called = false;
		const result = await linkCompanion({
			store,
			fetchImpl: async () => {
				called = true;
				return new Response(null, { status: 500 });
			},
		});

		expect(result).toBe("paired");
		expect(called).toBe(false);
		expect(await store.get()).toBe("already");
	});
});
