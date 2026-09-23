import { TodayCircleCard } from "@/components/home/today-circle-card";
import { serverApi } from "@/lib/server-api";
import type { TodayCirclePayload } from "@/lib/today-circle";
import { traceTiming } from "@/lib/trace-timing";

/** Independent Suspense stream for Today "From your circle" — never blocks the pick. */
export async function TodayCircleCardRsc() {
	const api = await serverApi();
	const payload = await traceTiming("home", "today circle", () =>
		api.api.today.circle
			.get()
			.then((res) => {
				if (res.error || !res.data) return null;
				return res.data as TodayCirclePayload;
			})
			.catch(() => null),
	);

	return <TodayCircleCard payload={payload} />;
}
