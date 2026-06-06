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
