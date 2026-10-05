import { describe, expect, test } from "bun:test";

import {
	CompanionPairing,
	MemoryCompanionPairingStore,
} from "./companion-pairing";

const USER_ID = "usr_companion";

function harness() {
	let now = Date.parse("2026-09-30T00:00:00.000Z");
	let ids = 0;
	const store = new MemoryCompanionPairingStore();
	const pairing = new CompanionPairing(store, {
		now: () => now,
		randomCode: () => "AB12CD34",
		randomToken: () => "device-token-plain",
		randomId: () => `dev_${++ids}`,
	});
	return {
		store,
		pairing,
		advance(ms: number) {
			now += ms;
		},
	};
}

describe("companion pairing", () => {
	test("issues a 10-minute code and stores only its hash", async () => {
		const { pairing, store } = harness();

		const issued = await pairing.issueCode(USER_ID);

		expect(issued.code).toBe("AB12-CD34");
		expect(issued.expiresAt).toBe("2026-09-30T00:10:00.000Z");
		expect(store.codesHavePlaintext("AB12CD34")).toBe(false);
	});

	test("exchanges a code once for a device token and rejects reuse", async () => {
		const { pairing, store } = harness();
		await pairing.issueCode(USER_ID);

		const first = await pairing.exchange("ab12-cd34");
		expect(first).toEqual({ token: "device-token-plain" });
		expect(store.devicesHavePlaintext("device-token-plain")).toBe(false);

		const second = await pairing.exchange("AB12CD34");
		expect(second).toEqual({ error: "already_used" });
	});

	test("rejects an expired or unknown code", async () => {
		const { pairing, advance } = harness();
		await pairing.issueCode(USER_ID);
		advance(10 * 60 * 1000 + 1);

		expect(await pairing.exchange("AB12-CD34")).toEqual({ error: "expired" });
		expect(await pairing.exchange("ZZZZ-ZZZZ")).toEqual({
			error: "invalid_code",
		});
	});

	test("a new code replaces the previous unused one", async () => {
		const { pairing, store } = harness();
		await pairing.issueCode(USER_ID);

		const next = new CompanionPairing(store, {
			now: () => Date.parse("2026-09-30T00:01:00.000Z"),
			randomCode: () => "WXYZ9876",
			randomToken: () => "second-token",
			randomId: () => "dev_next",
		});
		await next.issueCode(USER_ID);

		expect(await pairing.exchange("AB12-CD34")).toEqual({
			error: "invalid_code",
		});
		expect(await next.exchange("WXYZ-9876")).toEqual({ token: "second-token" });
	});

	test("revoke kills the stored token", async () => {
		const { pairing } = harness();
		await pairing.issueCode(USER_ID);
		const exchanged = await pairing.exchange("AB12-CD34");
		if ("error" in exchanged) throw new Error(exchanged.error);

		expect(await pairing.session(exchanged.token)).toEqual({
			ok: true,
			userId: USER_ID,
			deviceId: "dev_1",
		});
		expect(await pairing.status(USER_ID)).toEqual({
			paired: true,
			devices: [{ id: "dev_1", createdAt: "2026-09-30T00:00:00.000Z" }],
		});

		expect(await pairing.revoke(USER_ID)).toEqual({ revoked: 1 });
		expect(await pairing.session(exchanged.token)).toBeNull();
		expect(await pairing.status(USER_ID)).toEqual({
			paired: false,
			devices: [],
		});
	});

	test("links a signed-in browser without a pairing code", async () => {
		const { pairing, store } = harness();

		const linked = await pairing.issueDevice(USER_ID);

		expect(linked).toEqual({ token: "device-token-plain" });
		expect(store.devicesHavePlaintext("device-token-plain")).toBe(false);
		expect(await pairing.session(linked.token)).toEqual({
			ok: true,
			userId: USER_ID,
			deviceId: "dev_1",
		});
	});
});
