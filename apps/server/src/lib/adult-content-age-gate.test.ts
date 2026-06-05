import { describe, expect, it } from "bun:test";
import { patronMeetsAdultAgeGate } from "./adult-content-age-gate";

describe("patronMeetsAdultAgeGate", () => {
	it("rejects under 18", () => {
		const today = new Date();
		const y = today.getFullYear() - 17;
		expect(patronMeetsAdultAgeGate(`${y}-06-05`)).toBe(false);
	});

	it("accepts exactly 18", () => {
		const today = new Date();
		const y = today.getFullYear() - 18;
		expect(patronMeetsAdultAgeGate(`${y}-01-01`)).toBe(true);
	});

	it("rejects invalid date", () => {
		expect(patronMeetsAdultAgeGate("not-a-date")).toBe(false);
	});
});
