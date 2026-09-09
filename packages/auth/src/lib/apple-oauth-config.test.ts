import { describe, expect, it, mock } from "bun:test";

// `@still/env/server` validates required vars (DATABASE_URL, …) at import time
// and this package has no `.env`; stub it like the server-side Discord config
// test does so the pure helpers can be exercised in isolation.
mock.module("@still/env/server", () => ({
	env: {},
}));

const { appleClientSecretClaims, normalizeApplePrivateKey } = await import(
	"./apple-oauth-config"
);

describe("normalizeApplePrivateKey", () => {
	it("restores newlines escaped by dotenv", () => {
		const raw =
			"-----BEGIN PRIVATE KEY-----\\nMIGTAgEA\\n-----END PRIVATE KEY-----";
		expect(normalizeApplePrivateKey(raw)).toBe(
			"-----BEGIN PRIVATE KEY-----\nMIGTAgEA\n-----END PRIVATE KEY-----",
		);
	});

	it("leaves real newlines untouched", () => {
		const raw =
			"-----BEGIN PRIVATE KEY-----\nMIGTAgEA\n-----END PRIVATE KEY-----";
		expect(normalizeApplePrivateKey(raw)).toBe(raw);
	});
});

describe("appleClientSecretClaims", () => {
	const now = 1_760_000_000;

	it("issues a JWT bound to the team and client", () => {
		const claims = appleClientSecretClaims(
			{ clientId: "fans.sense.si", teamId: "TEAM123" },
			now,
		);
		expect(claims.iss).toBe("TEAM123");
		expect(claims.sub).toBe("fans.sense.si");
		expect(claims.aud).toBe("https://appleid.apple.com");
		expect(claims.iat).toBe(now);
	});

	it("expires inside Apple's six-month ceiling", () => {
		const claims = appleClientSecretClaims(
			{ clientId: "fans.sense.si", teamId: "TEAM123" },
			now,
		);
		expect(claims.exp - claims.iat).toBeLessThanOrEqual(15_777_000);
		expect(claims.exp).toBeGreaterThan(claims.iat);
	});
});
