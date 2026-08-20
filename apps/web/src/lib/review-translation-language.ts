/**
 * Target language for translating other patrons' reviews.
 *
 * Base ISO-639-1 tags only — the server stores and compares base tags, so
 * `en-US` and `en-GB` are the same translation and must not be paid for twice.
 */

/**
 * Offered in Settings. Deliberately not exhaustive: the resolver accepts any
 * valid tag the browser reports, so a patron whose system is set to a language
 * missing from this list still gets translations — the list only exists to keep
 * the dropdown to a sensible length.
 */
export const REVIEW_TRANSLATION_LANGUAGE_OPTIONS = [
	{ value: "en", label: "English" },
	{ value: "es", label: "Español" },
	{ value: "fr", label: "Français" },
	{ value: "de", label: "Deutsch" },
	{ value: "it", label: "Italiano" },
	{ value: "pt", label: "Português" },
	{ value: "nl", label: "Nederlands" },
	{ value: "pl", label: "Polski" },
	{ value: "sv", label: "Svenska" },
	{ value: "da", label: "Dansk" },
	{ value: "fi", label: "Suomi" },
	{ value: "tr", label: "Türkçe" },
	{ value: "ru", label: "Русский" },
	{ value: "ar", label: "العربية" },
	{ value: "hi", label: "हिन्दी" },
	{ value: "ja", label: "日本語" },
	{ value: "ko", label: "한국어" },
	{ value: "zh", label: "中文" },
] as const;

export const DEFAULT_REVIEW_TRANSLATION_LANGUAGE = "en";

/**
 * Collapse a locale to the base tag the API expects. Mirrors
 * `normalizeLanguageTag` in `apps/server/src/lib/review-translation-service.ts`,
 * including requiring the whole string to be locale-shaped so a phrase like
 * `not-a-language` is rejected instead of read as `not`.
 */
const LOCALE_TAG_PATTERN = /^[a-z]{2,3}([-_][a-z0-9]{2,8})*$/;

export function normalizeReviewTranslationLanguage(
	raw: string | null | undefined,
): string | null {
	if (!raw) return null;
	const tag = raw.trim().toLowerCase();
	if (!LOCALE_TAG_PATTERN.test(tag)) return null;
	return tag.split(/[-_]/)[0] ?? null;
}

/**
 * The language reviews should be translated into: explicit Settings choice,
 * else the browser's language, else English.
 */
export function resolveReviewTranslationLanguage(input: {
	preference: string | null | undefined;
	navigatorLanguage: string | null | undefined;
}): string {
	return (
		normalizeReviewTranslationLanguage(input.preference) ??
		normalizeReviewTranslationLanguage(input.navigatorLanguage) ??
		DEFAULT_REVIEW_TRANSLATION_LANGUAGE
	);
}

/**
 * Human name for a language tag, in the reader's own language where the
 * platform can manage it ("Japanese" for an English reader, "japonais" for a
 * French one). Falls back to the raw tag rather than throwing on junk.
 */
export function reviewLanguageDisplayName(
	tag: string,
	displayLocale?: string,
): string {
	try {
		return (
			new Intl.DisplayNames([displayLocale ?? "en"], { type: "language" }).of(
				tag,
			) ?? tag
		);
	} catch {
		return tag;
	}
}
