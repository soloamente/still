import { describe, expect, it } from "bun:test";
import { outranks, rankOf } from "./staff-rank";

describe("rankOf", () => {
	it("orders roles highest-first", () => {
		expect(rankOf("owner")).toBeGreaterThan(rankOf("admin"));
		expect(rankOf("admin")).toBeGreaterThan(rankOf("moderator"));
		expect(rankOf("moderator")).toBeGreaterThan(rankOf("support"));
		expect(rankOf("support")).toBeGreaterThan(rankOf("user"));
	});

	it("treats unknown/empty role as plain user", () => {
		expect(rankOf(null)).toBe(rankOf("user"));
		expect(rankOf("bogus")).toBe(rankOf("user"));
	});
});

describe("outranks", () => {
	it("is true only when actor is strictly above target", () => {
		expect(outranks("admin", "moderator")).toBe(true);
		expect(outranks("owner", "admin")).toBe(true);
		expect(outranks("admin", "admin")).toBe(false); // peer
		expect(outranks("moderator", "admin")).toBe(false); // lower
		expect(outranks("admin", "owner")).toBe(false);
	});
});
