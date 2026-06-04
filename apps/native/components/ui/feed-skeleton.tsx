import { View } from "react-native";

function SkeletonCard() {
	return (
		<View className="mb-3 rounded-2xl border border-border bg-card p-3">
			<View className="mb-3 flex-row items-center" style={{ gap: 8 }}>
				<View
					className="bg-muted"
					style={{ width: 24, height: 24, borderRadius: 12 }}
				/>
				<View
					className="bg-muted"
					style={{ width: 120, height: 10, borderRadius: 4 }}
				/>
			</View>
			<View className="flex-row" style={{ gap: 12 }}>
				<View
					className="bg-muted"
					style={{ width: 58, height: 87, borderRadius: 8 }}
				/>
				<View style={{ flex: 1, gap: 8 }}>
					<View
						className="bg-muted"
						style={{ width: "70%", height: 12, borderRadius: 4 }}
					/>
					<View
						className="bg-muted"
						style={{ width: "40%", height: 10, borderRadius: 4 }}
					/>
				</View>
			</View>
		</View>
	);
}

export function FeedSkeleton({ count = 6 }: { count?: number }) {
	return (
		<View className="px-3 pt-2">
			{Array.from({ length: count }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list — order never changes
				<SkeletonCard key={i} />
			))}
		</View>
	);
}
