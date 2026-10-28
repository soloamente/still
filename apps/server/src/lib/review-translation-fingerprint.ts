import { createHash } from "node:crypto";

/**
 * Bump whenever `buildTranslationSystemPrompt` changes meaningfully. It is part
 * of every fingerprint, so old stored translations and hot-cache entries stop
 * matching instead of being served as if the new prompt had produced them.
 */
export const TRANSLATION_PROMPT_VERSION = "1";

/**
 * What a stored translation was made *from*: prompt recipe, model, and the exact
 * title + body sent for translation.
 *
 * A stored row is only reusable when its fingerprint equals the current one.
 * That makes staleness structural — an edit mid-translation, a title-only edit,
 * or a model/prompt change all produce a different fingerprint, so nothing has
 * to remember to delete the old row at the right moment.
 *
 * The target language is not part of it: rows are already keyed by
 * `(review_id, target_language)`.
 */
export function reviewTranslationFingerprint(input: {
	title: string | null;
	body: string;
	model: string;
}): string {
	// JSON keeps field boundaries unambiguous ("a","bc" must not equal "ab","c").
	return createHash("sha256")
		.update(
			JSON.stringify([
				TRANSLATION_PROMPT_VERSION,
				input.model,
				input.title ?? null,
				input.body,
			]),
		)
		.digest("hex");
}
