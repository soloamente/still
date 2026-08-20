import { describe, expect, mock, test } from "bun:test";

import { scrollWindowToTopInstant } from "./scroll-document-to-top";

describe("scrollWindowToTopInstant", () => {
	test("calls window.scrollTo with top 0 and instant behavior", () => {
		const scrollTo = mock(() => {});
		const original = globalThis.window;
		// @ts-expect-error test stub
		globalThis.window = { scrollTo };
		try {
			scrollWindowToTopInstant();
			expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
		} finally {
			globalThis.window = original;
		}
	});
});
