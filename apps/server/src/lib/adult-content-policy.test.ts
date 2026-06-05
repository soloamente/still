import { describe, expect, it } from "bun:test";
import {
	buildAdultBlockedMoviePayload,
	filterOutAdultRows,
	isMovieAdult,
	isTvAdultFromRow,
	readShowAdultContentPref,
	shouldBlockAdultDetail,
} from "./adult-content-policy";

describe("readShowAdultContentPref", () => {
	it("defaults to false when absent", () => {
		expect(readShowAdultContentPref(null)).toBe(false);
		expect(readShowAdultContentPref({})).toBe(false);
	});
	it("reads true when set", () => {
		expect(readShowAdultContentPref({ showAdultContent: true })).toBe(true);
	});
});

describe("isMovieAdult", () => {
	it("true when row.adult", () => {
		expect(isMovieAdult({ adult: true })).toBe(true);
	});
	it("false when row.adult false", () => {
		expect(isMovieAdult({ adult: false })).toBe(false);
	});
});

describe("isTvAdultFromRow", () => {
	it("true when tv.adult", () => {
		expect(isTvAdultFromRow({ adult: true, tmdbJson: null })).toBe(true);
	});
	it("true when _stillAdult cache says adult", () => {
		expect(
			isTvAdultFromRow({
				adult: false,
				tmdbJson: {
					_stillAdult: {
						isAdult: true,
						sources: ["mal_rating"],
						fetchedAt: "",
					},
				},
			}),
		).toBe(true);
	});
});

describe("shouldBlockAdultDetail", () => {
	it("blocks when adult and pref off", () => {
		expect(shouldBlockAdultDetail(false, true)).toBe(true);
	});
	it("does not block when pref on", () => {
		expect(shouldBlockAdultDetail(true, true)).toBe(false);
	});
});

describe("filterOutAdultRows", () => {
	it("removes adult rows when pref off", () => {
		const rows = [{ id: 1 }, { id: 2 }];
		const out = filterOutAdultRows(rows, false, (r) => r.id === 2);
		expect(out).toEqual([{ id: 1 }]);
	});
});

describe("buildAdultBlockedMoviePayload", () => {
	it("marks blocked movie detail", () => {
		expect(buildAdultBlockedMoviePayload(42, "Title")).toEqual({
			adultBlocked: true,
			kind: "movie",
			tmdbId: 42,
			title: "Title",
		});
	});
});
