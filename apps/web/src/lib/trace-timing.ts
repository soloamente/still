import "server-only";

/**
 * Opt-in server render timing. Silent unless `STILL_TRACE_TIMING=1`, so this can
 * stay in the tree and be switched on when a route feels slow in prod or dev.
 */
const TRACE_ENABLED = process.env.STILL_TRACE_TIMING === "1";

/** Times `fn`, logging `scope.label` with elapsed ms. Returns the awaited value untouched. */
export async function traceTiming<T>(
	scope: string,
	label: string,
	fn: () => Promise<T>,
): Promise<T> {
	if (!TRACE_ENABLED) return fn();
	const startedAt = performance.now();
	try {
		return await fn();
	} finally {
		const elapsed = Math.round(performance.now() - startedAt);
		console.log(`[trace:${scope}] ${label} ${elapsed}ms`);
	}
}
