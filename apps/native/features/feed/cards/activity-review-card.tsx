import { Text, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Poster } from "@/components/ui/poster";
import {
	patronName,
	type ReviewPayload,
} from "@/features/feed/activity-feed-types";
import { formatTimeAgo } from "@/features/feed/format-time-ago";

export function ActivityReviewCard({
	payload,
	at,
}: {
	payload: ReviewPayload;
	at: string;
}) {
	return (
		<View className="mb-3 rounded-2xl border border-border bg-card p-3">
			<View className="mb-2.5 flex-row items-center" style={{ gap: 8 }}>
				<Avatar uri={payload.user?.image} name={patronName(payload)} />
				<Text className="text-foreground" style={{ fontSize: 12.5 }}>
					<Text className="font-bold">{patronName(payload)}</Text>
					<Text className="text-muted-foreground">
						{" "}
						reviewed · {formatTimeAgo(at)}
					</Text>
				</Text>
			</View>
			<View className="flex-row" style={{ gap: 12 }}>
				<Poster path={payload.movie?.posterPath} />
				<View style={{ flex: 1, gap: 4 }}>
					<Text
						className="font-bold text-foreground"
						numberOfLines={2}
						style={{ fontSize: 14 }}
					>
						{payload.movie?.title ?? payload.review.title ?? "Untitled"}
					</Text>
					<Text
						className="text-muted-foreground"
						numberOfLines={3}
						style={{ fontSize: 11.5, fontStyle: "italic" }}
					>
						{payload.review.body}
					</Text>
				</View>
			</View>
			<View className="mt-2.5 flex-row" style={{ gap: 16 }}>
				<Text className="text-muted-foreground" style={{ fontSize: 11 }}>
					♥ {payload.review.likesCount}
				</Text>
				<Text className="text-muted-foreground" style={{ fontSize: 11 }}>
					💬 {payload.review.commentsCount}
				</Text>
			</View>
		</View>
	);
}
