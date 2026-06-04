import { useThemeColor } from "heroui-native";
import { useCallback } from "react";
import {
	ActivityIndicator,
	FlatList,
	Pressable,
	RefreshControl,
	Text,
	View,
} from "react-native";

import { FeedSkeleton } from "@/components/ui/feed-skeleton";
import { type ActivityItem, activityRowKey } from "./activity-feed-types";
import { ActivityCard } from "./cards/activity-card";
import { useActivityFeed } from "./use-activity-feed";

export function ActivityFeedScreen() {
	const foreground = useThemeColor("foreground");
	const {
		data,
		isPending,
		isError,
		refetch,
		isRefetching,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useActivityFeed();

	const items: ActivityItem[] = data?.pages.flat() ?? [];

	const onEndReached = useCallback(() => {
		if (hasNextPage && !isFetchingNextPage) fetchNextPage();
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	if (isPending) {
		return (
			<View className="flex-1 bg-background">
				<FeedSkeleton />
			</View>
		);
	}

	if (isError && items.length === 0) {
		return (
			<View className="flex-1 items-center justify-center bg-background px-8">
				<Text className="mb-3 text-center text-muted-foreground">
					Couldn't load your feed.
				</Text>
				<Pressable
					className="rounded-full border border-border px-5 py-2"
					onPress={() => refetch()}
				>
					<Text className="text-foreground">Tap to retry</Text>
				</Pressable>
			</View>
		);
	}

	if (items.length === 0) {
		return (
			<View className="flex-1 items-center justify-center bg-background px-8">
				<Text className="text-center text-muted-foreground">
					Follow people to fill your feed.
				</Text>
			</View>
		);
	}

	return (
		<FlatList
			className="flex-1 bg-background"
			contentContainerStyle={{
				paddingHorizontal: 12,
				paddingTop: 8,
				paddingBottom: 24,
			}}
			data={items}
			keyExtractor={(item) => activityRowKey(item)}
			renderItem={({ item }) => <ActivityCard item={item} />}
			onEndReached={onEndReached}
			onEndReachedThreshold={0.5}
			refreshControl={
				<RefreshControl
					refreshing={isRefetching}
					onRefresh={refetch}
					tintColor={foreground}
				/>
			}
			ListFooterComponent={
				isFetchingNextPage ? (
					<View className="py-4">
						<ActivityIndicator color={foreground} />
					</View>
				) : null
			}
		/>
	);
}
