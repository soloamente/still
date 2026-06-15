/** Mirror `apps/server/src/lib/handle-re.ts` for client-side handle validation. */
export const HANDLE_RE = /^[a-z0-9._-]{2,24}$/;

export type HandleValidation = { ok: true } | { ok: false; reason: "format" };

/** Normalize patron handle input as they type (lowercase, no spaces). */
export function normalizeHandleInput(raw: string): string {
	return raw.trim().toLowerCase().replace(/\s+/g, "");
}

export function validateHandle(raw: string): HandleValidation {
	const handle = normalizeHandleInput(raw);
	if (!HANDLE_RE.test(handle)) return { ok: false, reason: "format" };
	return { ok: true };
}

/** True when the typed handle matches one already saved on the signed-in profile. */
export function isOwnSavedHandle(
	candidate: string,
	savedHandle: string | undefined,
): boolean {
	const normalized = normalizeHandleInput(candidate);
	const owned = normalizeHandleInput(savedHandle ?? "");
	return Boolean(owned) && normalized === owned;
}
