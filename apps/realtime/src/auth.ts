export type RealtimeTokenClaims = { sub: string; exp: number };

/** Verify an HS256 JWT using Web Crypto. Returns null on any failure. */
export async function verifyConnectToken(
	token: string,
	secret: string,
	nowSec: number = Math.floor(Date.now() / 1000),
): Promise<RealtimeTokenClaims | null> {
	const parts = token.split(".");
	if (parts.length !== 3) return null;
	const [header, payload, sig] = parts;
	if (!header || !payload || !sig) return null;

	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["verify"],
	);

	const sigB64 = sig.replace(/-/g, "+").replace(/_/g, "/");
	let sigBytes: Uint8Array;
	try {
		sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
	} catch {
		return null;
	}

	const valid = await crypto.subtle.verify(
		"HMAC",
		key,
		sigBytes,
		enc.encode(`${header}.${payload}`),
	);
	if (!valid) return null;

	let claims: RealtimeTokenClaims;
	try {
		const payloadJson = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
		claims = JSON.parse(payloadJson) as RealtimeTokenClaims;
	} catch {
		return null;
	}

	if (typeof claims.sub !== "string" || !claims.sub) return null;
	if (typeof claims.exp !== "number" || claims.exp < nowSec) return null;

	return claims;
}

export function timingSafeEqual(a: string, b: string): boolean {
	const enc = new TextEncoder();
	const ab = enc.encode(a);
	const bb = enc.encode(b);
	if (ab.length !== bb.length) return false;
	let diff = 0;
	for (let i = 0; i < ab.length; i++) {
		diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
	}
	return diff === 0;
}
