import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "heroui-native";
import { View } from "react-native";

const STAR_POSITIONS = ["s0", "s1", "s2", "s3", "s4"] as const;

export function Stars({ rating }: { rating: number | null | undefined }) {
	const accent = useThemeColor("accent");
	if (rating == null) return null;
	const outOfFive = Math.max(0, Math.min(5, rating / 2));
	const full = Math.floor(outOfFive);
	const half = outOfFive - full >= 0.5;
	return (
		<View className="flex-row" style={{ gap: 1 }}>
			{STAR_POSITIONS.map((pos, i) => {
				const name =
					i < full ? "star" : i === full && half ? "star-half" : "star-outline";
				return <Ionicons key={pos} name={name} size={13} color={accent} />;
			})}
		</View>
	);
}
