import type { MonthRecapPayload } from "@/lib/month-recap-types";
import { stillApiOrigin } from "@/lib/still-api-origin";

/** Signed-in browser fetch for the global month-recap winners payload. */
export async function fetchMonthRecapClient(
	tz: string,
): Promise<MonthRecapPayload | null> {
	const url = new URL("/api/community/month-recap", stillApiOrigin());
	url.searchParams.set("tz", tz);

	try {
		const response = await fetch(url, {
			credentials: "include",
			cache: "no-store",
		});
		if (!response.ok) return null;
		return (await response.json()) as MonthRecapPayload;
	} catch {
		return null;
	}
}
