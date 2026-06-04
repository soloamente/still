import { useInfiniteQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

import {
	type ActivityItem,
	parseFeedApiActivityItems,
} from "./activity-feed-types";
import {
	FEED_PAGE_SIZE,
	getDeviceTimeZone,
	nextBeforeCursor,
} from "./feed-pagination";

/** Phase 1 default window — see spec "Open considerations". */
const FEED_PERIOD = "all" as const;

export function useActivityFeed() {
	const { data: session } = authClient.useSession();
	const signedIn = Boolean(session?.user);

	return useInfiniteQuery<ActivityItem[], Error>({
		queryKey: ["activity-feed", signedIn],
		initialPageParam: null as string | null,
		queryFn: async ({ pageParam }) => {
			const tz = getDeviceTimeZone();
			if (signedIn) {
				const res = await api.api.feed.get({
					query: {
						limit: String(FEED_PAGE_SIZE),
						period: FEED_PERIOD,
						tz,
						...(pageParam ? { before: pageParam as string } : {}),
					},
				});
				if (res.error) throw new Error("Failed to load feed");
				return parseFeedApiActivityItems(res.data);
			}
			const res = await api.api.feed.discover.get({
				query: { period: FEED_PERIOD, tz },
			});
			if (res.error) throw new Error("Failed to load feed");
			return parseFeedApiActivityItems(res.data);
		},
		getNextPageParam: (lastPage) =>
			signedIn ? nextBeforeCursor(lastPage) : undefined,
	});
}
