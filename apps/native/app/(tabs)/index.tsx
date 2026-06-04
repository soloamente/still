import { SafeAreaView } from "react-native-safe-area-context";

import { ActivityFeedScreen } from "@/features/feed/activity-feed-screen";

export default function HomeScreen() {
	return (
		<SafeAreaView className="flex-1 bg-background" edges={["top"]}>
			<ActivityFeedScreen />
		</SafeAreaView>
	);
}
