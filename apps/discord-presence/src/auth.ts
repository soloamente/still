/** Constant-time string compare for Bearer secrets (copied from apps/realtime). */
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

/**
 * Internal Worker routes accept `Authorization: Bearer ${secret}` only.
 * Missing, empty, or mismatched headers fail closed.
 */
export function authorizeInternal(request: Request, secret: string): boolean {
	if (!secret) return false;
	const authorization = request.headers.get("Authorization");
	if (!authorization) return false;
	return timingSafeEqual(authorization, `Bearer ${secret}`);
}
