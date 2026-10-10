import { describe, expect, test } from "bun:test";

import {
	LEGAL_FOOTER_NAV,
	legalSurfaceFromPath,
	legalSurfaceSlideDirection,
} from "./legal-surface";

describe("legal-surface", () => {
	test("footer nav ends with Trust after Privacy · Terms · Cookies", () => {
		expect(LEGAL_FOOTER_NAV.map((item) => item.id)).toEqual([
			"privacy",
			"terms",
			"cookies",
			"trust",
		]);
	});

	test("path parser covers all footer surfaces", () => {
		expect(legalSurfaceFromPath("/privacy")).toBe("privacy");
		expect(legalSurfaceFromPath("/terms/")).toBe("terms");
		expect(legalSurfaceFromPath("/cookies")).toBe("cookies");
		expect(legalSurfaceFromPath("/trust")).toBe("trust");
		expect(legalSurfaceFromPath("/refunds")).toBeNull();
	});

	test("slide direction follows footer order", () => {
		expect(legalSurfaceSlideDirection("privacy", "trust")).toBe("forward");
		expect(legalSurfaceSlideDirection("trust", "privacy")).toBe("back");
		expect(legalSurfaceSlideDirection("cookies", "terms")).toBe("back");
	});
});
