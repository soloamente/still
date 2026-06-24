export const REALTIME_TOKEN_TTL_SEC = 60;

/** Mint a short-lived HS256 JWT for WebSocket connect auth. Web Crypto only (Bun + Node 18+). */
export async function signConnectToken(
	userId: string,
	secret: string,
	ttlSec = REALTIME_TOKEN_TTL_SEC,
	nowSec = Math.floor(Date.now() / 1000),
): Promise<string> {
	const b64url = (s: string) =>
		btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

	const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
	const payload = b64url(JSON.stringify({ sub: userId, exp: nowSec + ttlSec }));

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
