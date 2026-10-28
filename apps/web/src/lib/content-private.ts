/**
 * Client/RSC helpers for API private gates (403 PROFILE_PRIVATE / CONTENT_PRIVATE).
 * Mirrors `apps/server/src/lib/content-private.ts` without importing server code.
 */

export const PROFILE_PRIVATE_CODE = "PROFILE_PRIVATE" as const;
export const CONTENT_PRIVATE_CODE = "CONTENT_PRIVATE" as const;

export type ContentPrivateKind = "profile" | "content";

export function isContentPrivateCode(
	code: unknown,
): code is typeof PROFILE_PRIVATE_CODE | typeof CONTENT_PRIVATE_CODE {
	return code === PROFILE_PRIVATE_CODE || code === CONTENT_PRIVATE_CODE;
}

/** Pull private-gate code from an Eden treaty error `value`. */
export function contentPrivateCodeFromEdenError(
	error: unknown,
): typeof PROFILE_PRIVATE_CODE | typeof CONTENT_PRIVATE_CODE | null {
	if (!error || typeof error !== "object" || !("value" in error)) return null;
	const value = (error as { value: unknown }).value;
	if (!value || typeof value !== "object") return null;
	const code = (value as { code?: unknown }).code;
	return isContentPrivateCode(code) ? code : null;
}

export function contentPrivateKindFromCode(
	code: typeof PROFILE_PRIVATE_CODE | typeof CONTENT_PRIVATE_CODE,
): ContentPrivateKind {
	return code === PROFILE_PRIVATE_CODE ? "profile" : "content";
}

export function contentPrivateCopy(kind: ContentPrivateKind): {
	title: string;
	body: string;
} {
	switch (kind) {
		case "profile":
			return {
				title: "This profile is private",
				body: "You can't access this profile.",
			};
		case "content":
			return {
				title: "This content is private",
				body: "You can't access this content.",
			};
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}
