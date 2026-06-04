import { describe, expect, test } from "bun:test";

import { buildBrowseSurfaceNavigateHref } from "@/lib/home-browse-surface-nav";
import { emptyHomeLobbyPersisted } from "@/lib/home-lobby-persist";

describe("buildBrowseSurfaceNavigateHref", () => {
	test("movies from tv keeps sort params on /home", () => {
		const href = buildBrowseSurfaceNavigateHref("movies", {
			isHomeLobby: true,
			currentParams: new URLSearchParams("browse=tv&sort=popular"),
			persisted: emptyHomeLobbyPersisted(),
		});
		expect(href).toBe("/home?sort=popular");
	});

	test("tv from movies sets browse=tv", () => {
		const href = buildBrowseSurfaceNavigateHref("tv", {
			isHomeLobby: true,
			currentParams: new URLSearchParams("sort=latest"),
			persisted: emptyHomeLobbyPersisted(),
		});
		expect(href).toBe("/home?sort=latest&browse=tv");
	});

	test("community uses persisted feed and period", () => {
		const href = buildBrowseSurfaceNavigateHref("community", {
			isHomeLobby: true,
			currentParams: new URLSearchParams("sort=popular"),
			persisted: {
				...emptyHomeLobbyPersisted(),
				community: { feed: "reviews", period: "month" },
			},
		});
		// `month` is the default period — omitted from the URL.
		expect(href).toBe("/home?browse=community&sort=reviews");
	});

	test("leaving community restores persisted movies slot", () => {
		const href = buildBrowseSurfaceNavigateHref("movies", {
			isHomeLobby: true,
			currentParams: new URLSearchParams(
				"browse=community&sort=lists&period=week",
			),
			persisted: {
				...emptyHomeLobbyPersisted(),
				movies: { sort: "latest", venue: "theaters" },
			},
		});
		// Theatrical is implicit for Latest — venue omitted.
		expect(href).toBe("/home?sort=latest");
	});

	test("off /home uses persisted href builder", () => {
		const href = buildBrowseSurfaceNavigateHref("community", {
			isHomeLobby: false,
			currentParams: new URLSearchParams(),
			persisted: {
				...emptyHomeLobbyPersisted(),
				community: { feed: "activity", period: "year" },
			},
		});
		expect(href).toBe("/home?browse=community&sort=activity&period=year");
	});

	test("movies to tv strips committed search and restores tv persist", () => {
		const href = buildBrowseSurfaceNavigateHref("tv", {
			isHomeLobby: true,
			currentParams: new URLSearchParams("sort=latest&search=noir"),
			persisted: {
				...emptyHomeLobbyPersisted(),
				tv: { sort: "popular", venue: "home" },
			},
		});
		expect(href).not.toContain("search=");
		expect(href).toBe("/home?browse=tv&sort=popular&venue=home");
	});

	test("re-tapping movies while search is active clears search", () => {
		const href = buildBrowseSurfaceNavigateHref("movies", {
			isHomeLobby: true,
			currentParams: new URLSearchParams("search=studio%3Apixar"),
			persisted: {
				...emptyHomeLobbyPersisted(),
				movies: { sort: "popular", venue: "home" },
			},
		});
		expect(href).not.toContain("search=");
		expect(href).toBe("/home?sort=popular&venue=home");
	});

	test("community from search drops search param", () => {
		const href = buildBrowseSurfaceNavigateHref("community", {
			isHomeLobby: true,
			currentParams: new URLSearchParams("browse=tv&search=anime"),
			persisted: emptyHomeLobbyPersisted(),
		});
		expect(href).not.toContain("search=");
		expect(href).toBe("/home?browse=community");
	});
});
