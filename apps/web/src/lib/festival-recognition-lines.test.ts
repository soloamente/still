import { describe, expect, test } from "bun:test";

import {
	buildFestivalRecognitionListRows,
	groupFestivalDetailLines,
	parseFestivalAchievementDetail,
} from "@/lib/festival-recognition-lines";
import type { FestivalRecognitionEntry } from "@/lib/movie-festival-recognition";

describe("groupFestivalDetailLines", () => {
	test("pairs year then detail", () => {
		expect(groupFestivalDetailLines(["2016", "Winner: Best Actor"])).toEqual([
			{ year: "2016", detail: "Winner: Best Actor" },
		]);
	});
});

describe("parseFestivalAchievementDetail", () => {
	test("strips Winner: into won status", () => {
		expect(parseFestivalAchievementDetail("Winner: Best Actor")).toEqual({
			status: "won",
			label: "Best Actor",
		});
	});

	test("strips Nominee: into nominated status", () => {
		expect(parseFestivalAchievementDetail("Nominee: Best Picture")).toEqual({
			status: "nominated",
			label: "Best Picture",
		});
	});

	test("keeps festival screening without status", () => {
		expect(parseFestivalAchievementDetail("Festival screening")).toEqual({
			status: null,
			label: "Festival screening",
		});
	});
});

describe("buildFestivalRecognitionListRows", () => {
	test("orders wins before nominations and strips status prefixes", () => {
		const entries: FestivalRecognitionEntry[] = [
			{
				id: "oscars",
				icon: "oscars",
				title: "Academy Awards",
				lines: ["2016", "Nominee: Best Picture", "2016", "Winner: Best Actor"],
			},
		];
		const rows = buildFestivalRecognitionListRows(entries);
		expect(rows.map((r) => r.status)).toEqual(["won", "nominated"]);
		expect(rows[0]?.achievement).toBe("Best Actor");
		expect(rows[1]?.achievement).toBe("Best Picture");
	});
});
