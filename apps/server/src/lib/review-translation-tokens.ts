/**
 * Review bodies carry inline mention tokens — `#[Dune](/movies/438631)` for
 * listings and `@[Denis Villeneuve](/people/1032)` for people and patrons. They
 * must come back from translation byte-identical: the label is a canonical title
 * or name that should not be translated, and the path is a live link that
 * `content-mentions.ts` parses on render.
 *
 * Asking a model nicely to "preserve these verbatim" is not a guarantee. Instead
 * we swap each token for a numbered placeholder before translating and put the
 * originals back afterwards, so preservation is structural rather than hopeful.
 * It also stops the model spending tokens on text it must not change.
 */

const MENTION_TOKEN = /[#@]\[[^\]]*\]\([^)]*\)/g;

/** Lenient on purpose — models sometimes pad placeholders to `[[ 0 ]]`. */
const PLACEHOLDER = /\[\[\s*(\d+)\s*\]\]/g;

export type MaskedBody = {
	/** Body text with every mention token replaced by `[[n]]`. */
	masked: string;
	/** Original token strings, indexed by placeholder number. */
	tokens: string[];
};

export function maskMentionTokens(body: string): MaskedBody {
	const tokens: string[] = [];
	const masked = body.replace(MENTION_TOKEN, (token) => {
		const index = tokens.length;
		tokens.push(token);
		return `[[${index}]]`;
	});
	return { masked, tokens };
}

export class MentionPlaceholderError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MentionPlaceholderError";
	}
}

/**
 * Put the original mention tokens back.
 *
 * Throws when the model dropped, duplicated or invented a placeholder. Failing
 * loudly is deliberate: a review whose links silently vanished is worse than no
 * translation at all, and the caller keeps showing the original text.
 */
export function restoreMentionTokens(masked: string, tokens: string[]): string {
	const seen = new Set<number>();
	const restored = masked.replace(PLACEHOLDER, (_match, rawIndex: string) => {
		const index = Number(rawIndex);
		const token = tokens[index];
		if (token === undefined) {
			throw new MentionPlaceholderError(
				`Translation invented placeholder [[${index}]]`,
			);
		}
		if (seen.has(index)) {
			throw new MentionPlaceholderError(
				`Translation duplicated placeholder [[${index}]]`,
			);
		}
		seen.add(index);
		return token;
	});

	if (seen.size !== tokens.length) {
		const missing = tokens
			.map((_token, index) => index)
			.filter((index) => !seen.has(index));
		throw new MentionPlaceholderError(
			`Translation dropped placeholder(s) ${missing.map((i) => `[[${i}]]`).join(", ")}`,
		);
	}

	return restored;
}
