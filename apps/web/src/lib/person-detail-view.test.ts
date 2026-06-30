import { describe, expect, test } from "bun:test";

import {
	buildPersonDetailViewHref,
	parsePersonDetailView,
	parsePersonDetailViewFromSearchParams,
} from "./person-detail-view";

describe("parsePersonDetailView", () => {
	test("defaults to about", () => {
		expect(parsePersonDetailView(undefined)).toBe("about");
		expect(parsePersonDetailView("unknown")).toBe("about");
	});

	test("parses filmography", () => {
		expect(parsePersonDetailView("filmography")).toBe("filmography");
	});
});

describe("parsePersonDetailViewFromSearchParams", () => {
	test("reads view query param", () => {
		expect(parsePersonDetailViewFromSearchParams({ view: "filmography" })).toBe(
			"filmography",
		);
	});
});

describe("buildPersonDetailViewHref", () => {
	test("about omits query string", () => {
		expect(buildPersonDetailViewHref("/people/1395183", "about")).toBe(
			"/people/1395183",
		);
	});

	test("filmography uses view param", () => {
		expect(buildPersonDetailViewHref("/people/1395183", "filmography")).toBe(
			"/people/1395183?view=filmography",
		);
	});
});
