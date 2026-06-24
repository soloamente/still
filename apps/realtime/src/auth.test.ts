import { describe, expect, test } from "bun:test";

import { timingSafeEqual, verifyConnectToken } from "./auth";

const SECRET = "test-secret-for-unit-tests-only";

async function mintToken(
	userId: string,
	secret: string,
	expOffset = 60,
): Promise<string> {
	const b64url = (s: string) =>
		btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
	const nowSec = Math.floor(Date.now() / 1000);
	const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
	const payload = b64url(
		JSON.stringify({ sub: userId, exp: nowSec + expOffset }),
	);
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sigBuffer = await crypto.subtle.sign(
		"HMAC",
		key,
		enc.encode(`${header}.${payload}`),
	);
	const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");
	return `${header}.${payload}.${sig}`;
}

describe("verifyConnectToken", () => {
	test("valid token returns claims", async () => {
		const token = await mintToken("usr_1", SECRET);
		const claims = await verifyConnectToken(token, SECRET);
		expect(claims).not.toBeNull();
		expect(claims?.sub).toBe("usr_1");
	});

	test("expired token returns null", async () => {
		const token = await mintToken("usr_1", SECRET, -10);
		expect(await verifyConnectToken(token, SECRET)).toBeNull();
	});

	test("wrong secret returns null", async () => {
		const token = await mintToken("usr_1", SECRET);
		expect(await verifyConnectToken(token, "wrong-secret")).toBeNull();
	});

	test("tampered payload returns null", async () => {
		const token = await mintToken("usr_1", SECRET);
		const parts = token.split(".");
		const tamperedPayload = btoa(
			JSON.stringify({ sub: "usr_evil", exp: 9999999999 }),
		)
			.replace(/=/g, "")
			.replace(/\+/g, "-")
			.replace(/\//g, "_");
		const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
		expect(await verifyConnectToken(tampered, SECRET)).toBeNull();
	});

	test("malformed token returns null", async () => {
		expect(await verifyConnectToken("not.a.valid.jwt", SECRET)).toBeNull();
		expect(await verifyConnectToken("bad", SECRET)).toBeNull();
	});
});

describe("timingSafeEqual", () => {
	test("equal strings", () => {
		expect(timingSafeEqual("abc", "abc")).toBe(true);
	});

	test("different strings same length", () => {
		expect(timingSafeEqual("abc", "abd")).toBe(false);
	});

	test("different lengths", () => {
		expect(timingSafeEqual("ab", "abc")).toBe(false);
	});
});
