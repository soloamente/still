import { describe, expect, test } from "bun:test";

import {
	buildMovieDetailViewHref,
	parseMovieDetailTvQuoteEpisode,
	parseMovieDetailView,
	parseMovieDetailViewFromSearchParams,
} from "./movie-detail-view";

describe("parseMovieDetailView", () => {
	test("defaults to about", () => {
		expect(parseMovieDetailView(undefined)).toBe("about");
		expect(parseMovieDetailView("unknown")).toBe("about");
	});

	test("parses all detail tabs", () => {
		expect(parseMovieDetailView("streaming")).toBe("streaming");
		expect(parseMovieDetailView("community")).toBe("community");
		expect(parseMovieDetailView("quotes")).toBe("quotes");
	});
});

describe("parseMovieDetailViewFromSearchParams", () => {
	test("prefers view over legacy tab", () => {
		expect(
			parseMovieDetailViewFromSearchParams({
				view: "community",
				tab: "quotes",
			}),
		).toBe("community");
	});

	test("falls back to tab query param", () => {
		expect(parseMovieDetailViewFromSearchParams({ tab: "quotes" })).toBe(
			"quotes",
		);
	});
});

describe("buildMovieDetailViewHref", () => {
	test("about omits query string", () => {
		expect(buildMovieDetailViewHref("/movies/550", "about")).toBe(
			"/movies/550",
		);
	});

	test("streaming uses view param", () => {
		expect(buildMovieDetailViewHref("/movies/550", "streaming")).toBe(
			"/movies/550?view=streaming",
		);
	});

	test("TV quotes include season and episode", () => {
		expect(
			buildMovieDetailViewHref("/tv/1399", "quotes", {
				listingKind: "tv",
				season: 1,
				episode: 3,
			}),
		).toBe("/tv/1399?view=quotes&season=1&episode=3");
	});
});

describe("parseMovieDetailTvQuoteEpisode", () => {
	test("parses positive season and episode", () => {
		expect(
			parseMovieDetailTvQuoteEpisode({ season: "2", episode: "5" }),
		).toEqual({ season: 2, episode: 5 });
	});

	test("returns null when missing", () => {
		expect(parseMovieDetailTvQuoteEpisode({ season: "1" })).toBeNull();
	});
});
