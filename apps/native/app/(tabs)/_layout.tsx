import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useThemeColor } from "heroui-native";

export default function TabLayout() {
	const foreground = useThemeColor("foreground");
	const background = useThemeColor("background");
	const accent = useThemeColor("accent");

	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarShowLabel: true,
				tabBarActiveTintColor: foreground,
				tabBarInactiveTintColor: `${foreground}80`,
				tabBarStyle: { backgroundColor: background },
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "Home",
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="home" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="search"
				options={{
					title: "Search",
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="search" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="log"
				options={{
					title: "Log",
					tabBarIcon: ({ size }) => (
						<Ionicons name="add-circle" size={size + 14} color={accent} />
					),
				}}
			/>
			<Tabs.Screen
				name="inbox"
				options={{
					title: "Inbox",
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="notifications" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="you"
				options={{
					title: "You",
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="person" size={size} color={color} />
					),
				}}
			/>
		</Tabs>
	);
}
