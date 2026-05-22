import { describe, expect, it } from "bun:test";

import { retiredCatalogueRedirectUrl } from "./retired-catalogue-redirect";

describe("retiredCatalogueRedirectUrl", () => {
	it("maps retired search and movie catalogue paths to /home", () => {
		expect(retiredCatalogueRedirectUrl("/search", "")).toBe("/home");
		expect(retiredCatalogueRedirectUrl("/movies/popular", "")).toBe(
			"/home?sort=popular",
		);
		expect(retiredCatalogueRedirectUrl("/movies/now-playing", "")).toBe(
			"/home?sort=popular&venue=theaters",
		);
		expect(retiredCatalogueRedirectUrl("/movies/upcoming", "")).toBe(
			"/home?sort=upcoming",
		);
	});

	it("maps retired TV catalogue paths to /home browse=tv", () => {
		expect(retiredCatalogueRedirectUrl("/tv/on-the-air", "")).toBe(
			"/home?browse=tv&sort=popular&run=ongoing",
		);
		expect(
			retiredCatalogueRedirectUrl(
				"/tv/discover",
				"?status=returning&sort=popularity.desc",
			),
		).toBe("/home?browse=tv&sort=popular&run=ongoing");
	});
});
