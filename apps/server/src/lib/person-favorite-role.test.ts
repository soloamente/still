import { describe, expect, test } from "bun:test";

import {
	personFavoriteRoleKey,
	personFavoriteRoleLabel,
} from "./person-favorite-role";

describe("personFavoriteRoleKey", () => {
	test("normalizes cast character", () => {
		expect(
			personFavoriteRoleKey({ kind: "cast", character: "Paul Atreides" }),
		).toBe("cast:paul atreides");
	});

	test("falls back when cast character missing", () => {
		expect(personFavoriteRoleKey({ kind: "cast" })).toBe("cast:");
		expect(personFavoriteRoleKey({ kind: "cast", character: "  " })).toBe(
			"cast:",
		);
	});

	test("normalizes crew job", () => {
		expect(personFavoriteRoleKey({ kind: "crew", job: "Director" })).toBe(
			"crew:director",
		);
	});

	test("falls back when crew job missing", () => {
		expect(personFavoriteRoleKey({ kind: "crew" })).toBe("crew:");
	});
});

describe("personFavoriteRoleLabel", () => {
	test("cast uses stars in", () => {
		expect(
			personFavoriteRoleLabel({ kind: "cast", character: "Paul" }),
		).toBe("stars in");
	});

	test("Director maps to directed", () => {
		expect(personFavoriteRoleLabel({ kind: "crew", job: "Director" })).toBe(
			"directed",
		);
	});

	test("writing jobs map to wrote", () => {
		expect(personFavoriteRoleLabel({ kind: "crew", job: "Writer" })).toBe(
			"wrote",
		);
		expect(
			personFavoriteRoleLabel({ kind: "crew", job: "Screenplay" }),
		).toBe("wrote");
	});

	test("unknown or empty crew falls back to worked on", () => {
		expect(personFavoriteRoleLabel({ kind: "crew", job: "Editor" })).toBe(
			"worked on",
		);
		expect(personFavoriteRoleLabel({ kind: "crew" })).toBe("worked on");
	});
});
