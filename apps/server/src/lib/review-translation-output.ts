/**
 * The prompt tells the model to "output only the translation", but a prompt is a
 * request, not a guarantee. This is the code-side gate: a reply that is empty or
 * wildly out of proportion to the source is a refusal, an apology, or commentary,
 * and storing it would put that text in front of readers (and in the 24h cache).
 */

export class TranslationOutputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TranslationOutputError";
	}
}

/** `[[n]]` placeholders carry no prose — compare only the words around them. */
const PLACEHOLDER = /\[\[\s*\d+\s*\]\]/g;

/**
 * Below this many prose characters the ratio is noise (a one-word review can
 * legitimately become three words), so only the empty check applies.
 */
const MIN_SOURCE_PROSE_FOR_RATIO = 20;

/**
 * Deliberately wide. Real translation swings a lot with script: CJK source text
 * is several times shorter than the same meaning in English, and the reverse
 * direction shrinks just as hard. These bounds only catch replies that cannot be
 * a translation of the text at all.
 */
const MIN_LENGTH_RATIO = 0.1;
const MAX_LENGTH_RATIO = 10;

function proseLength(text: string): number {
	return text.replace(PLACEHOLDER, "").replace(/\s+/g, " ").trim().length;
}

/**
 * Throws {@link TranslationOutputError} when `translated` cannot plausibly be a
 * translation of `source`. Both strings are the placeholder-masked forms, so
 * mention tokens do not skew the lengths.
 */
export function assertPlausibleTranslation(
	source: string,
	translated: string,
): void {
	const sourceLength = proseLength(source);
	// A body that is only mention tokens has no prose to compare.
	if (sourceLength === 0) return;

	const translatedLength = proseLength(translated);
	if (translatedLength === 0) {
		throw new TranslationOutputError("Translation came back empty");
	}
	if (sourceLength < MIN_SOURCE_PROSE_FOR_RATIO) return;

	const ratio = translatedLength / sourceLength;
	if (ratio < MIN_LENGTH_RATIO || ratio > MAX_LENGTH_RATIO) {
		throw new TranslationOutputError(
			`Translation length is implausible (${translatedLength} vs ${sourceLength} characters)`,
		);
	}
}
