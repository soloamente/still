/**
 * Constant-time string comparison using Web Crypto-safe primitives (no
 * `node:crypto`). Runtime-agnostic: works on Bun, Node, and Cloudflare Workers.
 * Length differences short-circuit (lengths are not secret).
 */
export function constantTimeEqual(a: string, b: string): boolean {
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
