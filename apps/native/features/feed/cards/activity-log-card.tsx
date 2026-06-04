import { Text, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Poster } from "@/components/ui/poster";
import { Stars } from "@/components/ui/stars";
import {
	type LogPayload,
	patronName,
} from "@/features/feed/activity-feed-types";
import { formatTimeAgo } from "@/features/feed/format-time-ago";

export function ActivityLogCard({
	payload,
	at,
}: {
	payload: LogPayload;
	at: string;
}) {
	const media = payload.movie ?? payload.tv ?? null;
	return (
		<View className="mb-3 rounded-2xl border border-border bg-card p-3">
			<View className="mb-2.5 flex-row items-center" style={{ gap: 8 }}>
				<Avatar uri={payload.user?.image} name={patronName(payload)} />
				<Text className="text-foreground" style={{ fontSize: 12.5 }}>
					<Text className="font-bold">{patronName(payload)}</Text>
					<Text className="text-muted-foreground">
						{" "}
						rated · {formatTimeAgo(at)}
					</Text>
				</Text>
			</View>
			<View className="flex-row" style={{ gap: 12 }}>
				<Poster path={media?.posterPath} />
				<View style={{ flex: 1, gap: 4 }}>
					<Text
						className="font-bold text-foreground"
						numberOfLines={2}
						style={{ fontSize: 14 }}
					>
						{media?.title ?? "Untitled"}
					</Text>
					<Stars rating={payload.log.rating} />
					<View className="flex-row" style={{ gap: 8 }}>
						{payload.log.liked ? (
							<Text className="text-muted-foreground" style={{ fontSize: 11 }}>
								♥ liked
							</Text>
						) : null}
						{payload.log.rewatch ? (
							<Text className="text-muted-foreground" style={{ fontSize: 11 }}>
								↺ rewatch
							</Text>
						) : null}
					</View>
				</View>
			</View>
		</View>
	);
}
