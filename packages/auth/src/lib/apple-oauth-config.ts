import { env } from "@still/env/server";
import { importPKCS8, SignJWT } from "jose";

/** Apple caps client-secret JWTs at six months; stay comfortably under it. */
const CLIENT_SECRET_TTL_SECONDS = 180 * 24 * 60 * 60;

/**
 * Sign in with Apple credentials are configured. `APPLE_APP_BUNDLE_IDENTIFIER`
 * is deliberately not required here — the web flow works without it and the
 * provider builder adds it only when present.
 */
export function hasAppleOAuthCredentials(): boolean {
	return Boolean(
		env.APPLE_CLIENT_ID?.trim() &&
			env.APPLE_TEAM_ID?.trim() &&
			env.APPLE_KEY_ID?.trim() &&
			env.APPLE_PRIVATE_KEY?.trim(),
	);
}

/**
 * `.p8` contents pasted into an env file arrive with literal `\n` sequences;
 * `importPKCS8` needs real newlines.
 */
export function normalizeApplePrivateKey(raw: string): string {
	return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

export type AppleClientSecretClaims = {
	iss: string;
	sub: string;
	aud: string;
	iat: number;
	exp: number;
};

/** Pure claim builder — kept separate from signing so it is unit-testable. */
export function appleClientSecretClaims(
	input: { clientId: string; teamId: string },
	nowSeconds: number,
): AppleClientSecretClaims {
	return {
		// Apple: `iss` is the 10-char Team ID, `sub` is the Services ID (client id).
		iss: input.teamId,
		sub: input.clientId,
		aud: "https://appleid.apple.com",
		iat: nowSeconds,
		exp: nowSeconds + CLIENT_SECRET_TTL_SECONDS,
	};
}

/**
 * ES256 JWT Apple accepts in place of a static client secret. Generated on
 * demand (the Better Auth provider entry is async) so the secret is always
 * fresh rather than a hand-minted token that silently expires after six months.
 */
export async function generateAppleClientSecret(): Promise<string> {
	const clientId = env.APPLE_CLIENT_ID as string;
	const teamId = env.APPLE_TEAM_ID as string;
	const keyId = env.APPLE_KEY_ID as string;
	const key = await importPKCS8(
		normalizeApplePrivateKey(env.APPLE_PRIVATE_KEY as string),
		"ES256",
	);
	const claims = appleClientSecretClaims(
		{ clientId, teamId },
		Math.floor(Date.now() / 1000),
	);
	// `kid` must be the Key ID of the .p8 key so Apple can pick the public half.
	return new SignJWT({})
		.setProtectedHeader({ alg: "ES256", kid: keyId })
		.setIssuer(claims.iss)
		.setSubject(claims.sub)
		.setAudience(claims.aud)
		.setIssuedAt(claims.iat)
		.setExpirationTime(claims.exp)
		.sign(key);
}
