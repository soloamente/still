import { describe, expect, test } from "bun:test";

import {
	buildTranslationSystemPrompt,
	buildTranslationUserPrompt,
	createReviewTranslationProvider,
	languageDisplayName,
	resolveReviewTranslationEngine,
	resolveReviewTranslationModel,
	type TranslationGenerate,
} from "./review-translation-provider";
import { MentionPlaceholderError } from "./review-translation-tokens";

describe("resolveReviewTranslationEngine", () => {
	test("prefers a direct Google key over the gateway", () => {
		expect(
			resolveReviewTranslationEngine({
				googleApiKey: "AQ.key",
				gatewayApiKey: "vck_key",
			}),
		).toBe("google");
	});

	test("falls back to the gateway when only that key is set", () => {
		expect(resolveReviewTranslationEngine({ gatewayApiKey: "vck_key" })).toBe(
			"gateway",
		);
	});

	test("reports unconfigured when neither key is set", () => {
		expect(resolveReviewTranslationEngine({})).toBeNull();
	});
});

describe("resolveReviewTranslationModel", () => {
	test("omits the provider prefix for the direct Google engine", () => {
		expect(resolveReviewTranslationModel("google")).toBe(
			"gemini-3.5-flash-lite",
		);
	});

	test("keeps the provider prefix the gateway routes on", () => {
		expect(resolveReviewTranslationModel("gateway")).toBe(
			"google/gemini-3.5-flash-lite",
		);
	});

	test("an explicit override wins for either engine", () => {
		expect(resolveReviewTranslationModel("google", "gemini-3-pro")).toBe(
			"gemini-3-pro",
		);
		expect(resolveReviewTranslationModel("gateway", "openai/gpt-5")).toBe(
			"openai/gpt-5",
		);
	});
});

describe("languageDisplayName", () => {
	test("names common tags in English for the prompt", () => {
		expect(languageDisplayName("ja")).toBe("Japanese");
		expect(languageDisplayName("it")).toBe("Italian");
	});

	test("falls back to the raw tag rather than throwing", () => {
		expect(languageDisplayName("zzzz")).toBe("zzzz");
	});
});

describe("prompts", () => {
	test("system prompt names the target language and protects placeholders", () => {
		const system = buildTranslationSystemPrompt("en");
		expect(system).toContain("into English");
		expect(system).toContain("[[n]]");
		expect(system).toContain("never renumber, drop, duplicate or translate");
	});

	test("user prompt states the source language when known", () => {
		expect(
			buildTranslationUserPrompt({
				maskedBody: "ciao",
				title: null,
				sourceLanguage: "it",
			}),
		).toContain("written in Italian");
	});

	test("user prompt asks the model to infer an unknown source", () => {
		expect(
			buildTranslationUserPrompt({
				maskedBody: "ciao",
				title: null,
				sourceLanguage: null,
			}),
		).toContain("source language is unknown");
	});
});

describe("createReviewTranslationProvider", () => {
	const body =
		"Ho visto #[Dune](/movies/438631) con @[Ada](/profile/ada) ed è stupendo.";

	test("masks mentions before the model sees them and restores them after", async () => {
		let seenPrompt = "";
		const generate: TranslationGenerate = async ({ prompt }) => {
			seenPrompt = prompt;
			return {
				title: "",
				body: "Watched [[0]] with [[1]] and it is stunning.",
			};
		};

		const result = await createReviewTranslationProvider(generate).translate({
			body,
			title: null,
			sourceLanguage: "it",
			targetLanguage: "en",
		});

		// The model never receives the real link targets.
		expect(seenPrompt).toContain("[[0]]");
		expect(seenPrompt).not.toContain("438631");
		expect(result.body).toBe(
			"Watched #[Dune](/movies/438631) with @[Ada](/profile/ada) and it is stunning.",
		);
		expect(result.title).toBeNull();
		expect(result.model).toBeTruthy();
	});

	test("propagates a placeholder failure instead of returning a broken body", async () => {
		const generate: TranslationGenerate = async () => ({
			title: "",
			body: "Watched it and it is stunning.",
		});

		await expect(
			createReviewTranslationProvider(generate).translate({
				body,
				title: null,
				sourceLanguage: "it",
				targetLanguage: "en",
			}),
		).rejects.toThrow(MentionPlaceholderError);
	});

	test("returns a translated title when the review had one", async () => {
		const generate: TranslationGenerate = async () => ({
			title: "A stunning desert",
			body: "Plain body.",
		});

		const result = await createReviewTranslationProvider(generate).translate({
			body: "Corpo semplice.",
			title: "Un deserto stupendo",
			sourceLanguage: "it",
			targetLanguage: "en",
		});

		expect(result.title).toBe("A stunning desert");
	});

	test("keeps the title null when the review had none, even if the model invents one", async () => {
		const generate: TranslationGenerate = async () => ({
			title: "Helpfully Invented Title",
			body: "Plain body.",
		});

		const result = await createReviewTranslationProvider(generate).translate({
			body: "Corpo semplice.",
			title: null,
			sourceLanguage: "it",
			targetLanguage: "en",
		});

		expect(result.title).toBeNull();
	});
});
