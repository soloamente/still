import { describe, expect, test } from "bun:test";

import {
	buildTastePillLabel,
	ECLECTIC_PERSONA_POOL,
	personaForGenreId,
} from "./taste-persona-lexicon";

describe("personaForGenreId", () => {
	test("maps drama to Dramatist", () => {
		expect(personaForGenreId(18)).toBe("Dramatist");
	});

	test("maps animation to Toonist", () => {
		expect(personaForGenreId(16)).toBe("Toonist");
	});

	test("unknown id falls back to Cinephile", () => {
		expect(personaForGenreId(99999)).toBe("Cinephile");
	});
});

describe("buildTastePillLabel", () => {
	const stats = (overrides: {
		primaryGenreId?: number | null;
		secondaryGenreId?: number | null;
		tertiaryGenreId?: number | null;
		logCount?: number;
	}) => ({
		primaryGenreId: 18,
		secondaryGenreId: 35,
		tertiaryGenreId: 53,
		logCount: 12,
		...overrides,
	});

	test("purist uses primary persona", () => {
		expect(buildTastePillLabel("genre-purist", stats())).toBe("Dramatist");
	});

	test("genre-led uses primary persona", () => {
		expect(buildTastePillLabel("genre-led", stats())).toBe("Dramatist");
	});

	test("dual uses primary persona only", () => {
		expect(
			buildTastePillLabel(
				"dual-affinity",
				stats({ primaryGenreId: 18, secondaryGenreId: 16 }),
			),
		).toBe("Dramatist");
	});

	test("eclectic picks from pool stably", () => {
		const input = stats({
			primaryGenreId: 18,
			secondaryGenreId: 35,
			tertiaryGenreId: 53,
			logCount: 15,
		});
		const a = buildTastePillLabel("eclectic", input);
		const b = buildTastePillLabel("eclectic", input);
		expect(ECLECTIC_PERSONA_POOL).toContain(a);
		expect(a).toBe(b);
	});

	test("forming returns null", () => {
		expect(buildTastePillLabel("forming", stats())).toBeNull();
	});

	test("duo uses short primary persona when needed", () => {
		const label = buildTastePillLabel(
			"dual-affinity",
			stats({ primaryGenreId: 10767, secondaryGenreId: 99 }),
		);
		expect(label).toBe("Talk");
	});
});
