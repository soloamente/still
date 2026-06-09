import { describe, expect, test } from "bun:test";

import {
	formatReleaseVersionLabel,
	whatsNewReleasePillLabel,
} from "@/lib/product-changelog";

describe("formatReleaseVersionLabel", () => {
	test("prefixes bare semver with v", () => {
		expect(formatReleaseVersionLabel("0.2.0")).toBe("v0.2.0");
	});

	test("keeps existing v prefix", () => {
		expect(formatReleaseVersionLabel("v0.2.0")).toBe("v0.2.0");
	});
});

describe("whatsNewReleasePillLabel", () => {
	test("joins changelog version and date", () => {
		expect(whatsNewReleasePillLabel("2026-06-09-share-previews")).toBe(
			"v0.2.4 · June 9, 2026",
		);
	});

	test("joins prior share-previews release version and date", () => {
		expect(whatsNewReleasePillLabel("2026-06-09-home-reviews-detail")).toBe(
			"v0.2.3 · June 9, 2026",
		);
	});

	test("joins prior release version and date", () => {
		expect(whatsNewReleasePillLabel("2026-06-08-search-detail-polish")).toBe(
			"v0.2.2 · June 8, 2026",
		);
	});

	test("joins prior release version and date", () => {
		expect(whatsNewReleasePillLabel("2026-06-07-reviews-tagging-reader")).toBe(
			"v0.2.1 · June 7, 2026",
		);
	});

	test("joins prior release version and date", () => {
		expect(
			whatsNewReleasePillLabel("2026-06-06-detail-editorial-community"),
		).toBe("v0.2.0 · June 6, 2026");
	});

	test("formats leading YYYY-MM-DD from id when changelog entry is missing", () => {
		expect(whatsNewReleasePillLabel("2026-01-15-custom-release")).toBe(
			"January 15, 2026",
		);
	});
});
