import { describe, expect, test } from "bun:test";

import {
	formatPersonFavoriteReleaseNotification,
	formatPersonFavoriteStreamingNotification,
	personFavoriteListingHref,
} from "./person-favorite-notification-copy";

describe("personFavoriteListingHref", () => {
	test("routes movie and tv", () => {
		expect(personFavoriteListingHref({ mediaKind: "movie", tmdbId: 1 })).toBe(
			"/movies/1",
		);
		expect(personFavoriteListingHref({ mediaKind: "tv", tmdbId: 9 })).toBe(
			"/tv/9",
		);
	});
});

describe("formatPersonFavoriteReleaseNotification", () => {
	test("includes role label and optional date", () => {
		expect(
			formatPersonFavoriteReleaseNotification({
				personName: "Denis Villeneuve",
				roleLabel: "directed",
				title: "Dune: Part Three",
				releaseDate: "19 Mar",
			}),
		).toEqual({
			title: "Denis Villeneuve directed Dune: Part Three",
			body: "New release · 19 Mar",
		});
	});
});

describe("formatPersonFavoriteStreamingNotification", () => {
	test("names provider", () => {
		expect(
			formatPersonFavoriteStreamingNotification({
				personName: "Timothée Chalamet",
				roleLabel: "stars in",
				title: "Title",
				providerName: "Netflix",
			}),
		).toEqual({
			title: "Timothée Chalamet stars in Title",
			body: "Now on Netflix",
		});
	});
});
