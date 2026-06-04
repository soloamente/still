import { Image } from "expo-image";
import { Text, View } from "react-native";

export function Avatar({
	uri,
	name,
	size = 28,
}: {
	uri: string | null | undefined;
	name: string;
	size?: number;
}) {
	const initial = name.trim().charAt(0).toUpperCase() || "?";
	if (uri) {
		return (
			<Image
				source={{ uri }}
				style={{ width: size, height: size, borderRadius: size / 2 }}
				contentFit="cover"
				transition={150}
			/>
		);
	}
	return (
		<View
			className="items-center justify-center bg-muted"
			style={{ width: size, height: size, borderRadius: size / 2 }}
		>
			<Text
				className="font-semibold text-foreground"
				style={{ fontSize: size * 0.45 }}
			>
				{initial}
			</Text>
		</View>
	);
}
