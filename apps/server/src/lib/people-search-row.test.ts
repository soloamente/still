import { describe, expect, test } from "bun:test";

import { mapTmdbPersonToSearchRow } from "./people-search-row";

describe("mapTmdbPersonToSearchRow", () => {
	test("maps id, name, role and up to 3 known-for titles (movie title or tv name)", () => {
		const row = mapTmdbPersonToSearchRow({
			id: 525,
			name: "Christopher Nolan",
			profile_path: "/abc.jpg",
			known_for_department: "Directing",
			known_for: [
				{ title: "Inception" },
				{ name: "Some Show" },
				{ title: "Oppenheimer" },
				{ title: "Dunkirk" },
			],
		});
		expect(row).toEqual({
			id: 525,
			name: "Christopher Nolan",
			profileUrl: "https://image.tmdb.org/t/p/w185/abc.jpg",
			knownForDepartment: "Directing",
			knownForTitles: ["Inception", "Some Show", "Oppenheimer"],
		});
	});

	test("null profileUrl when no photo, null department when absent, empty titles when no known_for", () => {
		const row = mapTmdbPersonToSearchRow({
			id: 1,
			name: "Nobody",
			profile_path: null,
		});
		expect(row.profileUrl).toBeNull();
		expect(row.knownForDepartment).toBeNull();
		expect(row.knownForTitles).toEqual([]);
	});

	test("skips known_for entries that have neither title nor name", () => {
		const row = mapTmdbPersonToSearchRow({
			id: 2,
			name: "X",
			profile_path: null,
			known_for: [{}, { title: "Real" }, { name: "" }],
		});
		expect(row.knownForTitles).toEqual(["Real"]);
	});
});
