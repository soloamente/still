import { describe, expect, test } from "bun:test";

import { splitTextSegments } from "@/components/onboarding/onboarding-letter-reveal";

describe("splitTextSegments", () => {
	test("keeps spaces between words", () => {
		const segments = splitTextSegments("Sono Scemo");
		expect(segments.map((s) => s.text).join("")).toBe("Sono Scemo");
		expect(segments.some((s) => s.isSpace && s.text === " ")).toBe(true);
	});

	test("preserves multiple spaces", () => {
		const segments = splitTextSegments("A  B");
		expect(segments.map((s) => s.text).join("")).toBe("A  B");
	});

	test("single word has no space segments", () => {
		const segments = splitTextSegments("SonoScemo");
		expect(segments).toHaveLength(1);
		expect(segments[0]?.isSpace).toBe(false);
	});
});
