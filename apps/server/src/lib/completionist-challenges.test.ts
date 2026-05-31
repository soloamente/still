import { describe, expect, test } from "bun:test";

import {
	computeChallengeProgress,
	getCompletionistChallengeById,
} from "./completionist-challenges";

describe("completionist-challenges", () => {
	test("computeChallengeProgress counts unique required films", () => {
		const def = getCompletionistChallengeById("challenge_nolan_essentials");
		expect(def).toBeDefined();
		if (!def) return;
		const watched = new Set([77, 155, 99999]);
		const progress = computeChallengeProgress(def.movieIds, watched);
		expect(progress.watched).toBe(2);
		expect(progress.total).toBe(def.movieIds.length);
		expect(progress.completed).toBe(false);
		expect(progress.remainingMovieIds.length).toBe(progress.total - 2);
	});

	test("marks completed when every film is logged", () => {
		const def = getCompletionistChallengeById("challenge_ghibli_magic");
		expect(def).toBeDefined();
		if (!def) return;
		const watched = new Set(def.movieIds);
		const progress = computeChallengeProgress(def.movieIds, watched);
		expect(progress.completed).toBe(true);
		expect(progress.percent).toBe(100);
	});
});
