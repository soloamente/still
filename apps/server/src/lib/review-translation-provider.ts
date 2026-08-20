import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "@still/env/server";
import { gateway, generateObject } from "ai";
import { z } from "zod";

import {
	maskMentionTokens,
	restoreMentionTokens,
} from "./review-translation-tokens";

/**
 * Cheap and fast; review translation is high volume and low stakes per call.
 * The gateway routes by a `provider/model` id, the direct Google provider takes
 * the bare model name — same model, two spellings.
 *
 * Pinned rather than the floating `gemini-flash-lite-latest` alias so a Google
 * release cannot silently change translation quality or price. Note that
 * `gemini-2.5-flash-lite` still appears in the models list but 404s for newer
 * accounts ("no longer available to new users"), so it is not a safe default.
 */
const DEFAULT_GOOGLE_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_GATEWAY_MODEL = `google/${DEFAULT_GOOGLE_MODEL}`;

/**
 * Which engine serves translations. A Google AI Studio key wins when both are
 * set: it is the direct path, with no gateway account in the middle.
 */
export type ReviewTranslationEngine = "google" | "gateway" | null;

/** Pure so the precedence rule is testable without touching process env. */
export function resolveReviewTranslationEngine(keys: {
	googleApiKey?: string | undefined;
	gatewayApiKey?: string | undefined;
}): ReviewTranslationEngine {
	if (keys.googleApiKey) return "google";
	if (keys.gatewayApiKey) return "gateway";
	return null;
}

export function resolveReviewTranslationModel(
	engine: ReviewTranslationEngine,
	override?: string | undefined,
): string {
	if (override) return override;
	return engine === "google" ? DEFAULT_GOOGLE_MODEL : DEFAULT_GATEWAY_MODEL;
}

export function reviewTranslationEngine(): ReviewTranslationEngine {
	return resolveReviewTranslationEngine({
		googleApiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
		gatewayApiKey: env.AI_GATEWAY_API_KEY,
	});
}

export type ReviewTranslationRequest = {
	body: string;
	title: string | null;
	/** Detected language of the source text, or null when it could not be called. */
	sourceLanguage: string | null;
	targetLanguage: string;
};

export type ReviewTranslationResult = {
	title: string | null;
	body: string;
	/** Which engine produced this, recorded on the stored row. */
	model: string;
};

/**
 * Swappable seam for the translation engine. The route only knows this shape, so
 * moving off the gateway (or stubbing it in tests) touches nothing else.
 */
export type ReviewTranslationProvider = {
	translate(
		request: ReviewTranslationRequest,
	): Promise<ReviewTranslationResult>;
};

/** What we ask the model for, before placeholders are swapped back. */
const translationSchema = z.object({
	title: z.string(),
	body: z.string(),
});

export type TranslationGenerate = (input: {
	model: string;
	system: string;
	prompt: string;
}) => Promise<z.infer<typeof translationSchema>>;

/** Feature switch — no key, no translation, and the UI hides the control. */
export function isReviewTranslationConfigured(): boolean {
	return reviewTranslationEngine() !== null;
}

export function reviewTranslationModel(): string {
	return resolveReviewTranslationModel(
		reviewTranslationEngine(),
		env.REVIEW_TRANSLATION_MODEL,
	);
}

/** English name for a language tag, for use inside the prompt. */
export function languageDisplayName(tag: string): string {
	try {
		return new Intl.DisplayNames(["en"], { type: "language" }).of(tag) ?? tag;
	} catch {
		return tag;
	}
}

export function buildTranslationSystemPrompt(targetLanguage: string): string {
	const target = languageDisplayName(targetLanguage);
	return [
		`You translate film and TV reviews into ${target}.`,
		"",
		"Rules:",
		`- Translate the review into ${target}. If it is already in ${target}, return it unchanged.`,
		"- Preserve every [[n]] placeholder exactly as written. Keep the same set of placeholders; you may move them so the sentence reads naturally, but never renumber, drop, duplicate or translate them.",
		"- Do not translate film, series or people's names.",
		"- Keep the writer's voice: casual phrasing, slang, humour, profanity and enthusiasm all stay. Do not make the text more formal or more polite than the original.",
		"- Preserve line breaks and markdown formatting.",
		"- Output only the translation. Never add notes, explanations, apologies or quotation marks that were not in the original.",
		'- If there is no title, return an empty string for "title".',
	].join("\n");
}

export function buildTranslationUserPrompt(input: {
	maskedBody: string;
	title: string | null;
	sourceLanguage: string | null;
}): string {
	const from = input.sourceLanguage
		? `The review is written in ${languageDisplayName(input.sourceLanguage)}.`
		: "The source language is unknown; infer it.";
	return [
		from,
		"",
		`Title: ${input.title ?? ""}`,
		"",
		"Review:",
		input.maskedBody,
	].join("\n");
}

/**
 * Resolve the configured engine to a language model.
 *
 * Built per call rather than at module load so the process does not need a key
 * present at import time (tests import this module with no env at all).
 */
function resolveLanguageModel(modelId: string) {
	const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
	if (apiKey) {
		// Explicit key rather than relying on ambient env: `@still/env` is the
		// single source of truth, and process.env may be filtered by Turbo.
		return createGoogleGenerativeAI({ apiKey })(modelId);
	}
	return gateway(modelId);
}

async function generateViaProvider(input: {
	model: string;
	system: string;
	prompt: string;
}): Promise<z.infer<typeof translationSchema>> {
	const { object } = await generateObject({
		model: resolveLanguageModel(input.model),
		schema: translationSchema,
		system: input.system,
		prompt: input.prompt,
		// Translation wants fidelity, not invention.
		temperature: 0.2,
	});
	return object;
}

/**
 * Build a provider.
 *
 * `generate` is injectable so the masking, prompting and restoring logic can be
 * tested without a network call or an API key.
 */
export function createReviewTranslationProvider(
	generate: TranslationGenerate = generateViaProvider,
): ReviewTranslationProvider {
	return {
		async translate(request) {
			const model = reviewTranslationModel();
			const { masked, tokens } = maskMentionTokens(request.body);

			const raw = await generate({
				model,
				system: buildTranslationSystemPrompt(request.targetLanguage),
				prompt: buildTranslationUserPrompt({
					maskedBody: masked,
					title: request.title,
					sourceLanguage: request.sourceLanguage,
				}),
			});

			// Throws when placeholders were mangled — the caller keeps the original.
			const body = restoreMentionTokens(raw.body, tokens);
			const title = raw.title.trim();

			return {
				title: request.title === null || title.length === 0 ? null : title,
				body,
				model,
			};
		},
	};
}
