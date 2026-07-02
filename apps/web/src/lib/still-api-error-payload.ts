/** Shape returned by Elysia `onError` — not a successful route payload. */
export type StillApiErrorPayload = {
	error: string;
	code: string;
};

/** True when JSON is an API error object (e.g. stale deploy missing routes). */
export function isStillApiErrorPayload(
	data: unknown,
): data is StillApiErrorPayload {
	if (typeof data !== "object" || data === null) return false;
	const row = data as Record<string, unknown>;
	return typeof row.code === "string" && typeof row.error === "string";
}
