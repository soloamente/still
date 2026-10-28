/**
 * Honest private-gate responses — prefer 403 + structured body over a silent 404
 * so patrons see “this is private” instead of “this does not exist.”
 *
 * Missing resources still use 404. Existence of a private object is intentionally
 * revealed (product choice for Sense private UX).
 */

export const PROFILE_PRIVATE_CODE = "PROFILE_PRIVATE" as const;
export const CONTENT_PRIVATE_CODE = "CONTENT_PRIVATE" as const;

export type ContentPrivateKind = "profile" | "content";

export type ContentPrivatePayload = {
	error: string;
	code: typeof PROFILE_PRIVATE_CODE | typeof CONTENT_PRIVATE_CODE;
	/** Secondary line for clients that want a short “you can’t access…” cue. */
	message: string;
};

/** JSON body for `status(403, contentPrivatePayload(...))`. */
export function contentPrivatePayload(
	kind: ContentPrivateKind,
): ContentPrivatePayload {
	switch (kind) {
		case "profile":
			return {
				error: "This profile is private",
				code: PROFILE_PRIVATE_CODE,
				message: "You can't access this profile",
			};
		case "content":
			return {
				error: "This content is private",
				code: CONTENT_PRIVATE_CODE,
				message: "You can't access this content",
			};
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

export function isContentPrivatePayload(
	value: unknown,
): value is ContentPrivatePayload {
	if (!value || typeof value !== "object") return false;
	const code = (value as { code?: unknown }).code;
	return code === PROFILE_PRIVATE_CODE || code === CONTENT_PRIVATE_CODE;
}
