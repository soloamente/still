import { describe, expect, test } from "bun:test";

import { resolveEnglishStrings } from "./strings.ts";

describe("resolveEnglishStrings", () => {
	test("maps PreMiD string keys to English copy", async () => {
		const strings = await resolveEnglishStrings({
			pause: "general.paused",
			watchingSeries: "general.watchingSeries",
			seriesDisplayShort: "netflix.seriesDisplay.short",
		});

		expect(strings.pause).toBe("Paused");
		expect(strings.watchingSeries).toBe("Watching a series");
		expect(strings.seriesDisplayShort).toBe("S{0} E{1} - {2}");
	});
});
