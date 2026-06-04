import { Text, View } from "react-native";

type DivergencePayload = {
	movieId?: number;
	tvId?: number;
	title?: string;
	posterPath?: string | null;
	viewerRating?: number | null;
	peerRating?: number | null;
};

function isDivergence(payload: unknown): payload is DivergencePayload {
	return (
		typeof payload === "object" &&
		payload !== null &&
		("movieId" in payload || "tvId" in payload)
	);
}

export function ActivityDivergenceCard({ payload }: { payload: unknown }) {
	if (!isDivergence(payload)) return null;
	return (
		<View className="mb-3 rounded-2xl border border-border bg-card p-3">
			<Text className="mb-1 text-muted-foreground" style={{ fontSize: 11 }}>
				Taste divergence
			</Text>
			<Text className="font-bold text-foreground" style={{ fontSize: 14 }}>
				{payload.title ?? "A title you both rated"}
			</Text>
			<View className="mt-2 flex-row" style={{ gap: 16 }}>
				<Text className="text-foreground" style={{ fontSize: 12 }}>
					You: {payload.viewerRating ?? "—"}
				</Text>
				<Text className="text-muted-foreground" style={{ fontSize: 12 }}>
					Them: {payload.peerRating ?? "—"}
				</Text>
			</View>
		</View>
	);
}
