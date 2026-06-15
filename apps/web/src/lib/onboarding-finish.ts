import type { OnboardingMovie } from "./onboarding-types";

export type OnboardingFinishInput = {
	avatarFile: File | null;
	tasteRatings: Record<number, number>;
	handle: string;
	displayName: string;
	bio: string;
	favoriteMovieIds: number[];
};

export type OnboardingFinishDeps = {
	uploadAvatar: (file: File) => Promise<void>;
	postLog: (movieId: number, rating: number) => Promise<void>;
	patchProfile: (body: {
		handle: string;
		displayName: string;
		bio?: string;
		favoriteMovieIds: number[];
		markOnboarded: true;
	}) => Promise<unknown>;
	recomputeTaste: () => Promise<{ headline?: string }>;
};

/** Persist avatar, taste logs, profile, then recompute taste signature. */
export async function runOnboardingFinish(
	input: OnboardingFinishInput,
	deps: OnboardingFinishDeps,
): Promise<{ headline: string | null }> {
	if (input.avatarFile) {
		await deps.uploadAvatar(input.avatarFile);
	}

	for (const [movieIdStr, rating] of Object.entries(input.tasteRatings)) {
		await deps.postLog(Number(movieIdStr), rating);
	}

	await deps.patchProfile({
		handle: input.handle,
		displayName: input.displayName,
		bio: input.bio.trim() || undefined,
		favoriteMovieIds: input.favoriteMovieIds,
		markOnboarded: true,
	});

	const taste = await deps.recomputeTaste();
	return { headline: taste.headline?.trim() ?? null };
}

/** Map favorites tiles to id list for PATCH. */
export function favoriteMovieIdsFromTiles(movies: OnboardingMovie[]): number[] {
	return movies.map((m) => m.id);
}
