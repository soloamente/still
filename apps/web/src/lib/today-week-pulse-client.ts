import { stillApiOrigin } from "@/lib/still-api-origin";
import { TODAY_TZ_COOKIE, type TodayWeekPulse } from "@/lib/today-week-pulse";

/** Persist device timezone for the next RSC seed (1 year, lax — not sensitive). */
export function writeTodayTimeZoneCookie(timeZone: string): void {
	if (typeof document === "undefined") return;
	// biome-ignore lint/suspicious/noDocumentCookie: tiny non-sensitive pref read by the RSC seed
	document.cookie = `${TODAY_TZ_COOKIE}=${encodeURIComponent(timeZone)}; path=/; max-age=31536000; samesite=lax`;
}

export async function fetchTodayWeekPulseClient(
	timeZone: string,
	signal?: AbortSignal,
): Promise<TodayWeekPulse | null> {
	const url = new URL("/api/today/week", stillApiOrigin());
	url.searchParams.set("tz", timeZone);
	try {
		const response = await fetch(url, {
			credentials: "include",
			cache: "no-store",
			signal,
		});
		if (!response.ok) return null;
		return (await response.json()) as TodayWeekPulse;
	} catch (err) {
		// Unmount aborts are expected; everything else surfaces as the quiet retry state.
		if (err instanceof DOMException && err.name === "AbortError") return null;
		console.error("[fetchTodayWeekPulseClient] failed:", err);
		return null;
	}
}
