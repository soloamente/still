import { cookies } from "next/headers";

import { serverApi } from "@/lib/server-api";
import type { TasteMatchedDiscoveryPayload } from "@/lib/taste-matched-discovery";
import type { TodayCirclePayload } from "@/lib/today-circle";
import { TODAY_TZ_COOKIE, type TodayWeekPulse } from "@/lib/today-week-pulse";
import { traceTiming } from "@/lib/trace-timing";

export type TodayWeekRead = {
	pulse: TodayWeekPulse | null;
	/** Zone the pulse was computed in — the client refetches when the device differs. */
	timeZone: string;
};

/**
 * In-flight Today reads. Started by the `/home` page shell (before auth, profile,
 * and catalogue waves) and awaited inside each card's own Suspense boundary.
 * Every promise resolves — failures become `null` so a card shows its error UI.
 */
export type TodayOnSenseReads = {
	pick: Promise<TasteMatchedDiscoveryPayload | null>;
	week: Promise<TodayWeekRead>;
	circle: Promise<TodayCirclePayload | null>;
};

function decodeCookieTimeZone(raw: string | undefined): string {
	if (!raw) return "UTC";
	try {
		return decodeURIComponent(raw);
	} catch {
		// Malformed cookie — server also normalizes unknown zones to UTC.
		return "UTC";
	}
}

export async function fetchTodayPick(): Promise<TasteMatchedDiscoveryPayload | null> {
	const api = await serverApi();
	return traceTiming("home", "taste for-you", () =>
		api.api.taste["for-you"]
			.get()
			.then((res) => {
				if (res.error || !res.data) return null;
				return res.data as TasteMatchedDiscoveryPayload;
			})
			.catch(() => null),
	);
}

/** Week pulse in the device-timezone cookie (UTC on first visit). */
export async function fetchTodayWeek(): Promise<TodayWeekRead> {
	const store = await cookies();
	const timeZone = decodeCookieTimeZone(store.get(TODAY_TZ_COOKIE)?.value);
	const api = await serverApi();
	const pulse = await traceTiming("home", "today week", () =>
		api.api.today.week
			.get({ query: { tz: timeZone } })
			.then((res) => {
				if (res.error || !res.data) return null;
				return res.data as TodayWeekPulse;
			})
			.catch(() => null),
	);
	return { pulse, timeZone };
}

export async function fetchTodayCircle(): Promise<TodayCirclePayload | null> {
	const api = await serverApi();
	return traceTiming("home", "today circle", () =>
		api.api.today.circle
			.get()
			.then((res) => {
				if (res.error || !res.data) return null;
				return res.data as TodayCirclePayload;
			})
			.catch(() => null),
	);
}

export function startTodayOnSenseReads(): TodayOnSenseReads {
	return {
		pick: fetchTodayPick(),
		week: fetchTodayWeek(),
		circle: fetchTodayCircle(),
	};
}
