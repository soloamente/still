import { describe, expect, it } from "bun:test";

import { normalizeProfileBirthDateYmd } from "./normalize-profile-birth-date";

describe("normalizeProfileBirthDateYmd", () => {
	it("keeps YYYY-MM-DD", () => {
		expect(normalizeProfileBirthDateYmd("1990-06-05")).toBe("1990-06-05");
	});

	it("strips ISO datetime to the calendar day", () => {
		expect(normalizeProfileBirthDateYmd("1990-06-05T00:00:00.000Z")).toBe(
			"1990-06-05",
		);
	});

	it("formats Date via UTC calendar parts", () => {
		expect(
			normalizeProfileBirthDateYmd(new Date("1990-06-05T00:00:00.000Z")),
		).toBe("1990-06-05");
	});

	it("returns null for empty or garbage", () => {
		expect(normalizeProfileBirthDateYmd(null)).toBeNull();
		expect(normalizeProfileBirthDateYmd("")).toBeNull();
		expect(normalizeProfileBirthDateYmd("not-a-date")).toBeNull();
	});
});
