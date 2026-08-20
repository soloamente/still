/**
 * Pure shapes for review translation responses — kept free of `@/lib/api` so
 * unit tests do not boot the web env schema.
 */

export type ReviewTranslationResult =
	| { status: "same_language"; language: string }
	| {
			status: "translated";
			language: string;
			title: string | null;
			body: string;
	  };

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object") return null;
	return value as Record<string, unknown>;
}

/** Normalize Eden/JSON payloads into a typed translation outcome. */
export function normalizeReviewTranslationResult(
	data: unknown,
): ReviewTranslationResult | null {
	const row = asRecord(data);
	if (!row) return null;
	const status = row.status;
	const language =
		typeof row.language === "string" ? row.language.trim().toLowerCase() : "";
	if (!language) return null;

	if (status === "same_language") {
		return { status: "same_language", language };
	}

	if (status === "translated") {
		const body = typeof row.body === "string" ? row.body : null;
		if (body == null) return null;
		const title = typeof row.title === "string" ? row.title : null;
		return {
			status: "translated",
			language,
			title,
			body,
		};
	}

	return null;
}
