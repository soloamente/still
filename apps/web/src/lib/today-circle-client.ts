import { stillApiOrigin } from "@/lib/still-api-origin";
import type { TodayCirclePayload } from "@/lib/today-circle";

/**
 * Retry for the circle card. Movie stays parameter-free; TV adds `media=tv`.
 * `null` means the read failed again — the card keeps its retry action.
 */
export async function fetchTodayCircleClient(
	media: "movie" | "tv",
	signal?: AbortSignal,
): Promise<TodayCirclePayload | null> {
	const url = new URL("/api/today/circle", stillApiOrigin());
	if (media === "tv") url.searchParams.set("media", "tv");
	try {
		const response = await fetch(url, {
			credentials: "include",
			cache: "no-store",
			signal,
		});
		if (!response.ok) return null;
		return (await response.json()) as TodayCirclePayload;
	} catch (err) {
		if (err instanceof DOMException && err.name === "AbortError") return null;
		console.error("[fetchTodayCircleClient] failed:", err);
		return null;
	}
}
