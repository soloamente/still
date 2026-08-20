// The `light` profile (major languages only) rather than the full model, which
// is badly overfit on rare languages: measured against 501 real reviews it
// labelled plain English like "My friends got traumatized by Anora…" as Berber
// with accuracy 1.000, and informal Italian as Berber too. `light` gets both
// right, still covers ja/ko/zh/ru/ar/hi/tr, and removed every bogus rare-language
// hit from the corpus.
import { detect } from "tinyld/light";

/**
 * Mention tokens (`#[Dune](/movies/438631)`, `@[Denis Villeneuve](/people/1032)`)
 * are proper nouns plus a latin URL path. Left in place they drag detection
 * toward English, so they come out before we judge the patron's own prose.
 */
const MENTION_TOKEN = /[#@]\[[^\]]*\]\([^)]*\)/g;
const URL_TOKEN = /https?:\/\/\S+/g;

/** Han, hiragana/katakana, and hangul — dense scripts where a few characters already decide it. */
const DENSE_SCRIPT = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/;

/**
 * Minimum prose length before we trust a result. tinyld's accuracy score is not
 * usable as a gate (correct Spanish prose scores ~0.11 while correct German
 * scores 1.0, and wrong answers can score 1.000), but it reliably misfires on
 * very short input. Length is the signal that actually separates the two cases.
 */
const MIN_LATIN_LENGTH = 24;
const MIN_DENSE_SCRIPT_LENGTH = 8;

/** Review text with mention tokens and URLs removed, whitespace collapsed. */
export function stripUndetectableNoise(body: string): string {
	return body
		.replace(MENTION_TOKEN, " ")
		.replace(URL_TOKEN, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Best-effort source language for a review body, as a base ISO-639-1 tag.
 *
 * Returns `null` whenever the text is too short or too ambiguous to call. That
 * is deliberate: a null means readers simply get no translate affordance, which
 * is far better than confidently mislabelling an English review as Irish and
 * offering to translate it into the language it is already written in.
 */
export function detectReviewLanguage(body: string): string | null {
	const prose = stripUndetectableNoise(body);
	if (!prose) return null;

	const minLength = DENSE_SCRIPT.test(prose)
		? MIN_DENSE_SCRIPT_LENGTH
		: MIN_LATIN_LENGTH;
	if (prose.length < minLength) return null;

	const detected = detect(prose).trim().toLowerCase();
	if (!detected) return null;

	// tinyld yields base tags already; guard anyway so a future upgrade emitting
	// `pt-BR` cannot widen what we persist.
	const base = detected.split(/[-_]/)[0];
	return base && base.length >= 2 ? base : null;
}
