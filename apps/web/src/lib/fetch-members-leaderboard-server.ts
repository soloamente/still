import "server-only";

import { cookies } from "next/headers";

import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import type {
	MembersLeaderboardPayload,
	MembersLeaderboardSort,
} from "@/lib/members-leaderboard-types";
import { stillApiOrigin } from "@/lib/still-api-origin";

/** RSC seed for Community Ranks patron slices — forwards cookies for follow state. */
export async function fetchMembersLeaderboardServer(args: {
	sort: MembersLeaderboardSort;
	period: HomeLeaderboardPeriod;
	page?: number;
	limit?: number;
	tz?: string;
}): Promise<MembersLeaderboardPayload | null> {
	const store = await cookies();
	const cookieHeader = store
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");

	const url = new URL("/api/members/leaderboard", stillApiOrigin());
	url.searchParams.set("sort", args.sort);
	url.searchParams.set("period", args.period);
	if (args.page != null) url.searchParams.set("page", String(args.page));
	if (args.limit != null) url.searchParams.set("limit", String(args.limit));
	if (args.tz) url.searchParams.set("tz", args.tz);

	try {
		const response = await fetch(url, {
			cache: "no-store",
			headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
		});
		if (!response.ok) return null;
		return (await response.json()) as MembersLeaderboardPayload;
	} catch {
		return null;
	}
}
