import { Image } from "expo-image";
import { View } from "react-native";

import { tmdbPosterUrlFromPath } from "@/features/feed/tmdb-poster-url";

export function Poster({
	path,
	width = 58,
}: {
	path: string | null | undefined;
	width?: number;
}) {
	const height = Math.round(width * 1.5);
	const uri = tmdbPosterUrlFromPath(path, "w342");
	if (!uri) {
		return (
			<View className="bg-muted" style={{ width, height, borderRadius: 8 }} />
		);
	}
	return (
		<Image
			source={{ uri }}
			style={{ width, height, borderRadius: 8 }}
			contentFit="cover"
			transition={150}
		/>
	);
}
