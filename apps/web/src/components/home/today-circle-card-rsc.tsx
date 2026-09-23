import { TodayCircleCard } from "@/components/home/today-circle-card";
import type { TodayCirclePayload } from "@/lib/today-circle";

/** Independent Suspense stream for Today "From your circle" — never blocks the pick. */
export async function TodayCircleCardRsc({
	read,
}: {
	read: Promise<TodayCirclePayload | null>;
}) {
	const payload = await read;
	return <TodayCircleCard payload={payload} />;
}
