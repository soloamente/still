import { TodayWeekCard } from "@/components/home/today-week-card";
import type { TodayWeekRead } from "@/lib/today-on-sense-reads";

/**
 * Independent Suspense stream for Today "Your week". The read is started by the
 * page shell; timezone comes from the device cookie (UTC on first visit — the
 * client card corrects and refetches).
 */
export async function TodayWeekCardRsc({
	read,
}: {
	read: Promise<TodayWeekRead>;
}) {
	const { pulse, timeZone } = await read;
	return <TodayWeekCard initial={pulse} initialTimeZone={timeZone} />;
}
