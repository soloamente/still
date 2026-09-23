import { cookies } from "next/headers";

import { TodayWeekCard } from "@/components/home/today-week-card";
import { serverApi } from "@/lib/server-api";
import { TODAY_TZ_COOKIE, type TodayWeekPulse } from "@/lib/today-week-pulse";
import { traceTiming } from "@/lib/trace-timing";

/**
 * Independent Suspense stream for Today "Your week". Timezone comes from the
 * device cookie (UTC on first visit — the client card corrects and refetches).
 */
function decodeCookieTimeZone(raw: string | undefined): string {
	if (!raw) return "UTC";
	try {
		return decodeURIComponent(raw);
	} catch {
		// Malformed cookie — server also normalizes unknown zones to UTC.
		return "UTC";
	}
}

export async function TodayWeekCardRsc() {
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

	return <TodayWeekCard initial={pulse} initialTimeZone={timeZone} />;
}
