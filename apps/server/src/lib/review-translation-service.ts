import type { ReviewTranslationProvider } from "./review-translation-provider";

/** A translation as it is stored and returned. */
export type StoredReviewTranslation = {
	title: string | null;
	body: string;
	model: string;
};

export type ReviewTranslationSource = {
	id: string;
	body: string;
	title: string | null;
	sourceLanguage: string | null;
};

export type ReviewTranslationOutcome =
	| { status: "same_language"; language: string }
	| ({ status: "translated"; language: string } & StoredReviewTranslation);

export type ReviewTranslationDeps = {
	loadStored: (
		reviewId: string,
		language: string,
	) => Promise<StoredReviewTranslation | null>;
	saveStored: (
		input: { reviewId: string; language: string } & StoredReviewTranslation,
	) => Promise<void>;
	translate: ReviewTranslationProvider["translate"];
};

/**
 * Normalize a requested language to the base tag we store and compare against.
 *
 * `en-US`, `EN`, `en_us` all collapse to `en`. Region is dropped on purpose:
 * translating a review separately for `en-US` and `en-GB` would double the cost
 * for no reader benefit. Returns null for anything that is not a plausible
 * language subtag, so callers can reject junk before spending a model call.
 *
 * The *whole* string must be locale-shaped, not just its first subtag —
 * otherwise a phrase like `not-a-language` would slip through as `not`.
 */
const LOCALE_TAG_PATTERN = /^[a-z]{2,3}([-_][a-z0-9]{2,8})*$/;

export function normalizeLanguageTag(raw: string): string | null {
	const tag = raw.trim().toLowerCase();
	if (!LOCALE_TAG_PATTERN.test(tag)) return null;
	return tag.split(/[-_]/)[0] ?? null;
}

/**
 * Resolve a review translation, cheapest path first: skip when the review is
 * already in the reader's language, then reuse the stored row, and only then pay
 * for a model call — persisting the result so nobody pays for it twice.
 *
 * Redis caching sits outside this function (in the route) so this stays a plain,
 * fully testable unit.
 */
export async function resolveReviewTranslation(
	source: ReviewTranslationSource,
	targetLanguage: string,
	deps: ReviewTranslationDeps,
): Promise<ReviewTranslationOutcome> {
	if (source.sourceLanguage === targetLanguage) {
		return { status: "same_language", language: targetLanguage };
	}

	const stored = await deps.loadStored(source.id, targetLanguage);
	if (stored) {
		return { status: "translated", language: targetLanguage, ...stored };
	}

	const translated = await deps.translate({
		body: source.body,
		title: source.title,
		sourceLanguage: source.sourceLanguage,
		targetLanguage,
	});

	await deps.saveStored({
		reviewId: source.id,
		language: targetLanguage,
		title: translated.title,
		body: translated.body,
		model: translated.model,
	});

	return {
		status: "translated",
		language: targetLanguage,
		title: translated.title,
		body: translated.body,
		model: translated.model,
	};
}
