import { afterAll, describe, expect, test } from "bun:test";
import { MOVIEFAMOUS_PROVIDER_SLUG } from "./moviefamous-quotes-provider";
import { shouldProtectQuoteFromImportOverwrite } from "./quote-import";
import {
	isQuoteImportEnabled,
	quoteProviderSlugFromEnv,
	resolveQuoteProvider,
} from "./quote-provider";

describe("shouldProtectQuoteFromImportOverwrite", () => {
	test("protects staff and patron rows", () => {
		expect(shouldProtectQuoteFromImportOverwrite("staff")).toBe(true);
		expect(shouldProtectQuoteFromImportOverwrite("patron")).toBe(true);
	});

	test("allows external_api overwrite", () => {
		expect(shouldProtectQuoteFromImportOverwrite("external_api")).toBe(false);
	});
});

describe("resolveQuoteProvider", () => {
	const originalProvider = process.env.QUOTE_API_PROVIDER;
	const originalImport = process.env.QUOTE_IMPORT_ENABLED;

	test("returns null when env unset", () => {
		delete process.env.QUOTE_API_PROVIDER;
		expect(quoteProviderSlugFromEnv()).toBeNull();
		expect(resolveQuoteProvider()).toBeNull();
	});

	test("returns null for stub slug", () => {
		process.env.QUOTE_API_PROVIDER = "stub";
		expect(quoteProviderSlugFromEnv()).toBeNull();
		expect(resolveQuoteProvider()).toBeNull();
	});

	test("recognizes moviequotes slug", () => {
		process.env.QUOTE_API_PROVIDER = "moviequotes";
		expect(quoteProviderSlugFromEnv()).toBe("moviequotes");
	});

	test("recognizes moviefamous slug without api key", () => {
		process.env.QUOTE_API_PROVIDER = "moviefamous";
		expect(quoteProviderSlugFromEnv()).toBe(MOVIEFAMOUS_PROVIDER_SLUG);
		expect(resolveQuoteProvider()).not.toBeNull();
	});

	test("isQuoteImportEnabled reads env flag", () => {
		process.env.QUOTE_IMPORT_ENABLED = "true";
		expect(isQuoteImportEnabled()).toBe(true);
		process.env.QUOTE_IMPORT_ENABLED = "false";
		expect(isQuoteImportEnabled()).toBe(false);
	});

	afterAll(() => {
		if (originalProvider === undefined) {
			delete process.env.QUOTE_API_PROVIDER;
		} else {
			process.env.QUOTE_API_PROVIDER = originalProvider;
		}
		if (originalImport === undefined) {
			delete process.env.QUOTE_IMPORT_ENABLED;
		} else {
			process.env.QUOTE_IMPORT_ENABLED = originalImport;
		}
	});
});
