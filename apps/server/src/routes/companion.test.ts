import { describe, expect, test } from "bun:test";

import { MemoryCompanionPairingStore } from "../lib/companion-pairing";
import { buildCompanionRoute } from "./companion";

const USER_ID = "usr_companion";

function makeApp(user: { id: string } | null) {
	const store = new MemoryCompanionPairingStore();
	const app = buildCompanionRoute({
		deriveUser: () => user,
		store,
		now: () => Date.parse("2026-09-30T00:00:00.000Z"),
		randomCode: () => "AB12CD34",
		randomToken: () => "device-token-plain",
		randomId: () => "dev_1",
	});
	return { app, store };
}

describe("POST /api/me/companion/pair", () => {
	test("401 when signed out", async () => {
		const { app } = makeApp(null);
		const res = await app.handle(
			new Request("http://test/api/me/companion/pair", { method: "POST" }),
		);
		expect(res.status).toBe(401);
	});

	test("returns a display code for the signed-in patron", async () => {
		const { app } = makeApp({ id: USER_ID });
		const res = await app.handle(
			new Request("http://test/api/me/companion/pair", { method: "POST" }),
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			code: "AB12-CD34",
			expiresAt: "2026-09-30T00:10:00.000Z",
		});
	});
});

describe("companion device token", () => {
	test("exchanges the code, accepts the token, then revoke kills it", async () => {
		const { app } = makeApp({ id: USER_ID });
		const issued = await app.handle(
			new Request("http://test/api/me/companion/pair", { method: "POST" }),
		);
		const { code } = (await issued.json()) as { code: string };

		const exchanged = await app.handle(
			new Request("http://test/api/companion/token", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ code }),
			}),
		);
		expect(exchanged.status).toBe(200);
		const { token } = (await exchanged.json()) as { token: string };

		const session = await app.handle(
			new Request("http://test/api/companion/session", {
				headers: { authorization: `Bearer ${token}` },
			}),
		);
		expect(session.status).toBe(200);
		expect(await session.json()).toEqual({ ok: true, profileUrl: null });

		const status = await app.handle(
			new Request("http://test/api/me/companion"),
		);
		expect(status.status).toBe(200);
		expect(await status.json()).toEqual({
			paired: true,
			devices: [{ id: "dev_1", createdAt: "2026-09-30T00:00:00.000Z" }],
		});

		const revoked = await app.handle(
			new Request("http://test/api/me/companion", { method: "DELETE" }),
		);
		expect(revoked.status).toBe(200);
		expect(await revoked.json()).toEqual({ ok: true, revoked: 1 });

		const after = await app.handle(
			new Request("http://test/api/companion/session", {
				headers: { authorization: `Bearer ${token}` },
			}),
		);
		expect(after.status).toBe(401);
	});

	test("401 for an unknown code", async () => {
		const { app } = makeApp(null);
		const res = await app.handle(
			new Request("http://test/api/companion/token", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ code: "ZZZZ-ZZZZ" }),
			}),
		);
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: "invalid_code" });
	});

	test("session returns a public profile URL for the Discord button", async () => {
		const store = new MemoryCompanionPairingStore();
		const app = buildCompanionRoute({
			deriveUser: () => ({ id: USER_ID }),
			store,
			now: () => Date.parse("2026-09-30T00:00:00.000Z"),
			randomCode: () => "AB12CD34",
			randomToken: () => "device-token-plain",
			randomId: () => "dev_1",
			publicOrigin: "https://sense.example",
			profileForUser: async () => ({ handle: "ada", isPrivate: false }),
		});
		const issued = await app.handle(
			new Request("http://test/api/me/companion/pair", { method: "POST" }),
		);
		const { code } = (await issued.json()) as { code: string };
		const exchanged = await app.handle(
			new Request("http://test/api/companion/token", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ code }),
			}),
		);
		const { token } = (await exchanged.json()) as { token: string };
		const session = await app.handle(
			new Request("http://test/api/companion/session", {
				headers: { authorization: `Bearer ${token}` },
			}),
		);
		expect(session.status).toBe(200);
		expect(await session.json()).toEqual({
			ok: true,
			profileUrl: "https://sense.example/profile/ada",
		});
	});

	test("session omits the profile URL when the profile is private", async () => {
		const store = new MemoryCompanionPairingStore();
		const app = buildCompanionRoute({
			deriveUser: () => ({ id: USER_ID }),
			store,
			now: () => Date.parse("2026-09-30T00:00:00.000Z"),
			randomCode: () => "AB12CD34",
			randomToken: () => "device-token-plain",
			randomId: () => "dev_1",
			publicOrigin: "https://sense.example",
			profileForUser: async () => ({ handle: "ada", isPrivate: true }),
		});
		const issued = await app.handle(
			new Request("http://test/api/me/companion/pair", { method: "POST" }),
		);
		const { code } = (await issued.json()) as { code: string };
		const exchanged = await app.handle(
			new Request("http://test/api/companion/token", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ code }),
			}),
		);
		const { token } = (await exchanged.json()) as { token: string };
		const session = await app.handle(
			new Request("http://test/api/companion/session", {
				headers: { authorization: `Bearer ${token}` },
			}),
		);
		expect(session.status).toBe(200);
		expect(await session.json()).toEqual({ ok: true, profileUrl: null });
	});
});
