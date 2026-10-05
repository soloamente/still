import { describe, expect, test } from "bun:test";

import { largestArtworkUrl, upgradeArtworkUrl } from "./artwork-url";

describe("largestArtworkUrl", () => {
	test("uses the biggest poster Discord can fetch, not a huge webp", () => {
		expect(
			largestArtworkUrl([
				{ w: 200, h: 300, url: "https://example.test/small.jpg" },
				{ w: 1000, h: 1500, url: "https://example.test/large.jpg" },
				{ w: 3000, h: 4500, url: "https://example.test/huge.webp" },
			]),
		).toBe("https://example.test/large.jpg");
	});
});

describe("upgradeArtworkUrl", () => {
	test("drops the upstream icon host and leaves signed poster urls alone", () => {
		expect(
			upgradeArtworkUrl("https://cdn.rcd.gg/PreMiD/resources/play.png"),
		).toBeNull();
		expect(
			upgradeArtworkUrl("https://occ.nflxso.net/boxart.jpg?r=e8c&sig=a+b"),
		).toBe("https://occ.nflxso.net/boxart.jpg?r=e8c&sig=a+b");
		expect(
			upgradeArtworkUrl(
				"https://images.cdn.prd.api.discomax.com/poster.jpeg?f=jpg&q=75&w=300",
			),
		).toBe(
			"https://images.cdn.prd.api.discomax.com/poster.jpeg?f=jpg&q=75&w=300",
		);
	});

	test("asks Disney, Apple, Amazon, and TMDb for a sharper file", () => {
		expect(
			upgradeArtworkUrl(
				"https://disney.images.edge.bamgrid.com/ripcut-delivery/v2/variant/disney/abc/compose?format=png&width=512",
			),
		).toBe(
			"https://disney.images.edge.bamgrid.com/ripcut-delivery/v2/variant/disney/abc/compose?format=jpeg&width=800",
		);
		expect(
			upgradeArtworkUrl(
				"https://is1-ssl.mzstatic.com/image/thumb/video/abc/200x200bb.jpg",
			),
		).toBe("https://is1-ssl.mzstatic.com/image/thumb/video/abc/800x800bb.jpg");
		expect(
			upgradeArtworkUrl(
				"https://m.media-amazon.com/images/S/pv-target-images/abc._SX300_FMjpg_.jpg",
			),
		).toBe(
			"https://m.media-amazon.com/images/S/pv-target-images/abc._SX800_.jpg",
		);
		expect(
			upgradeArtworkUrl("https://image.tmdb.org/t/p/w200/poster.jpg"),
		).toBe("https://image.tmdb.org/t/p/w780/poster.jpg");
	});
});
