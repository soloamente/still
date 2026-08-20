import { HomeTasteMatchedHero } from "@/components/home/home-taste-matched-hero";
import { serverApi } from "@/lib/server-api";
import type { TasteMatchedDiscoveryPayload } from "@/lib/taste-matched-discovery";
import { traceTiming } from "@/lib/trace-timing";

/**
 * Isolated RSC boundary for the taste hero — keeps slow `/api/taste/for-you` off the
 * critical path so catalogue chips and the poster grid can stream first.
 */
export async function HomeTasteMatchedHeroRsc() {
	const api = await serverApi();
	const tasteMatchedRail = await traceTiming("home", "taste for-you", () =>
		api.api.taste["for-you"]
			.get()
			.then((res) => {
				if (res.error || !res.data) return null;
				return res.data as TasteMatchedDiscoveryPayload;
			})
			.catch(() => null),
	);

	return <HomeTasteMatchedHero initial={tasteMatchedRail} />;
}
