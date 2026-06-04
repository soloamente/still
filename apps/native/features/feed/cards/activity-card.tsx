import type {
	ActivityItem,
	ListPayload,
	LogPayload,
	ReviewPayload,
} from "@/features/feed/activity-feed-types";

import { ActivityDivergenceCard } from "./activity-divergence-card";
import { ActivityListCard } from "./activity-list-card";
import { ActivityLogCard } from "./activity-log-card";
import { ActivityReviewCard } from "./activity-review-card";

export function ActivityCard({ item }: { item: ActivityItem }) {
	switch (item.kind) {
		case "log":
			return (
				<ActivityLogCard payload={item.payload as LogPayload} at={item.at} />
			);
		case "review":
			return (
				<ActivityReviewCard
					payload={item.payload as ReviewPayload}
					at={item.at}
				/>
			);
		case "list":
			return (
				<ActivityListCard payload={item.payload as ListPayload} at={item.at} />
			);
		case "divergence":
			return <ActivityDivergenceCard payload={item.payload} />;
		default:
			return null;
	}
}
