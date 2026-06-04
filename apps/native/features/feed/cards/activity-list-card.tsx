import { Text, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Poster } from "@/components/ui/poster";
import {
	type ListPayload,
	patronName,
} from "@/features/feed/activity-feed-types";
import { formatTimeAgo } from "@/features/feed/format-time-ago";

export function ActivityListCard({
	payload,
	at,
}: {
	payload: ListPayload;
	at: string;
}) {
	const covers = (payload.list.coverPosterPaths ?? []).slice(0, 4);
	return (
		<View className="mb-3 rounded-2xl border border-border bg-card p-3">
			<View className="mb-2.5 flex-row items-center" style={{ gap: 8 }}>
				<Avatar uri={payload.user?.image} name={patronName(payload)} />
				<Text className="text-foreground" style={{ fontSize: 12.5 }}>
					<Text className="font-bold">{patronName(payload)}</Text>
					<Text className="text-muted-foreground">
						{" "}
						made a list · {formatTimeAgo(at)}
					</Text>
				</Text>
			</View>
			<Text className="mb-2 font-bold text-foreground" style={{ fontSize: 14 }}>
				{payload.list.title}
			</Text>
			<View className="flex-row" style={{ gap: 6 }}>
				{covers.length > 0 ? (
					covers.map((path, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: cover strip — stable positional rendering
						<Poster key={i} path={path} width={44} />
					))
				) : (
					<View
						className="bg-muted"
						style={{ width: 44, height: 66, borderRadius: 8 }}
					/>
				)}
			</View>
			<Text className="mt-2 text-muted-foreground" style={{ fontSize: 11 }}>
				{payload.list.itemsCount} films
			</Text>
		</View>
	);
}
