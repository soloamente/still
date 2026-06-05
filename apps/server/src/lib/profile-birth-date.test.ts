import { describe, expect, it } from "bun:test";
import {
	formatBirthdayDisplayPublic,
	parseProfileBirthDate,
	profileBirthDateToIso,
} from "./profile-birth-date";

describe("parseProfileBirthDate", () => {
	it("accepts valid YYYY-MM-DD", () => {
		expect(parseProfileBirthDate("1990-06-05", "2026-06-05")).toBe(
			"1990-06-05",
		);
	});

	it("rejects future dates", () => {
		expect(parseProfileBirthDate("2099-01-01", "2026-06-05")).toBeNull();
	});

	it("rejects garbage", () => {
		expect(parseProfileBirthDate("not-a-date")).toBeNull();
	});

	it("returns null for empty", () => {
		expect(parseProfileBirthDate("")).toBeNull();
		expect(parseProfileBirthDate(null)).toBeNull();
	});
});

describe("formatBirthdayDisplayPublic", () => {
	it("returns month and day only", () => {
		expect(formatBirthdayDisplayPublic("1990-06-05")).toBe("June 5");
	});
});

describe("profileBirthDateToIso", () => {
	it("formats Date values", () => {
		const d = new Date("1990-06-05T12:00:00");
		expect(profileBirthDateToIso(d)).toBe("1990-06-05");
	});
});
