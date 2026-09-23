import {
	type HomeTasteHeroCompletionMode,
	HomeTasteMatchedHero,
} from "@/components/home/home-taste-matched-hero";
import type { TasteMatchedDiscoveryPayload } from "@/lib/taste-matched-discovery";
import { fetchTodayPick } from "@/lib/today-on-sense-reads";

/**
 * Isolated RSC boundary for the taste hero — keeps slow `/api/taste/for-you` off the
 * critical path so catalogue chips and the poster grid can stream first.
 * Pass `read` when the page shell already started the request.
 */
export async function HomeTasteMatchedHeroRsc({
	completionMode,
	read,
}: {
	completionMode?: HomeTasteHeroCompletionMode;
	read?: Promise<TasteMatchedDiscoveryPayload | null>;
}) {
	const tasteMatchedRail = await (read ?? fetchTodayPick());

	return (
		<HomeTasteMatchedHero
			initial={tasteMatchedRail}
			completionMode={completionMode}
		/>
	);
}
